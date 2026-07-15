import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { execa } from "execa";
import type { DependencyStrategy, SandboxConfig } from "../types.js";

const DEFAULT_SHARED_FILES = [".env", ".env.local", ".vscode/settings.json"];

export const KNOWN_DEPENDENCY_DIRS = [
  "node_modules",   // JS / Node / Bun / Deno
  ".venv",          // Python (venv / uv / poetry)
  "venv",           // Python alternative
  "__pypackages__", // Python PEP 582
  "target",         // Rust (Cargo) / Java (Maven)
  "vendor",         // PHP (Composer) / Go / Ruby
  ".bundle",        // Ruby (Bundler)
  "deps",           // Elixir (Mix)
  "_build",         // Elixir build
  ".gradle",        // Kotlin / Java (Gradle)
  "build",          // General C / C++ / Java build
];

export const KNOWN_MANIFEST_FILES = [
  "package.json", "package-lock.json", "pnpm-lock.yaml", "yarn.lock", "bun.lockb",
  "pyproject.toml", "requirements.txt", "poetry.lock", "Pipfile", "Pipfile.lock", "uv.lock",
  "Cargo.toml", "Cargo.lock",
  "composer.json", "composer.lock",
  "Gemfile", "Gemfile.lock",
  "go.mod", "go.sum",
  "mix.exs", "mix.lock",
  "pom.xml", "build.gradle", "build.gradle.kts", "gradle.properties",
  "CMakeLists.txt", "conanfile.txt", "vcpkg.json",
];

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.lstat(filePath);
    return true;
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

function validateRepoRelativePath(repoPath: string, item: string, fieldName: string): string {
  if (typeof item !== "string" || !item.trim()) throw new Error(`${fieldName} entries must be non-empty strings.`);
  if (path.isAbsolute(item)) throw new Error(`${fieldName} must be repository-relative, not absolute: ${item}`);
  const resolved = path.resolve(repoPath, item);
  const relative = path.relative(repoPath, resolved);
  if (relative === "" || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`${fieldName} entry escapes the repository: ${item}`);
  }
  return relative;
}

/** Return the full parsed .sandboxrc.json config object. */
export async function readFullConfig(repoPath: string): Promise<SandboxConfig> {
  const configPath = path.join(repoPath, ".sandboxrc.json");
  if (!(await pathExists(configPath))) return { sharedFiles: DEFAULT_SHARED_FILES };
  let parsed: SandboxConfig;
  try {
    parsed = JSON.parse(await fs.readFile(configPath, "utf8")) as SandboxConfig;
  } catch (error) {
    throw new Error(`Cannot parse ${configPath}: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error(`${configPath} must contain a JSON object.`);
  }
  return {
    sharedFiles: parsed.sharedFiles === undefined
      ? DEFAULT_SHARED_FILES
      : [...new Set((parsed.sharedFiles as string[]).map((item) => validateRepoRelativePath(repoPath, item, "sharedFiles")))],
    dependencyDirs: parsed.dependencyDirs === undefined
      ? undefined
      : [...new Set((parsed.dependencyDirs as string[]).map((item) => validateRepoRelativePath(repoPath, item, "dependencyDirs")))],
    manifestFiles: parsed.manifestFiles === undefined
      ? undefined
      : [...new Set((parsed.manifestFiles as string[]).map((item) => validateRepoRelativePath(repoPath, item, "manifestFiles")))],
    portRange: parsed.portRange,
    hooks: parsed.hooks,
  };
}

export async function readSandboxConfig(repoPath: string): Promise<string[]> {
  const config = await readFullConfig(repoPath);
  return config.sharedFiles ?? DEFAULT_SHARED_FILES;
}

/** Read active dependency directories (from config or probed known ecosystems). */
export async function readDependencyDirs(repoPath: string): Promise<string[]> {
  const config = await readFullConfig(repoPath);
  if (config.dependencyDirs !== undefined) return config.dependencyDirs;

  const found: string[] = [];
  for (const dir of KNOWN_DEPENDENCY_DIRS) {
    if (await pathExists(path.join(repoPath, dir))) {
      found.push(dir);
    }
  }
  return found;
}

/** Read active manifest/lock files (from config or probed known ecosystems). */
export async function readManifestFiles(repoPath: string): Promise<string[]> {
  const config = await readFullConfig(repoPath);
  if (config.manifestFiles !== undefined) return config.manifestFiles;

  const found: string[] = [];
  for (const file of KNOWN_MANIFEST_FILES) {
    if (await pathExists(path.join(repoPath, file))) {
      found.push(file);
    }
  }
  return found;
}

/** Compute a combined SHA-256 hash of all active manifest/lock files. */
export async function hashPackageJson(repoPath: string): Promise<string | null> {
  const manifests = await readManifestFiles(repoPath);
  if (!manifests.length) return null;

  const hash = crypto.createHash("sha256");
  for (const file of manifests) {
    const filePath = path.join(repoPath, file);
    if (await pathExists(filePath)) {
      hash.update(`\u0000${file}\u0000`);
      hash.update(await fs.readFile(filePath));
    }
  }
  return hash.digest("hex");
}

export const hashManifestFiles = hashPackageJson;

async function runReflinkCopy(source: string, destination: string): Promise<void> {
  if (process.platform === "linux") {
    await execa("cp", ["--reflink=always", "-a", source, destination]);
    return;
  }
  if (process.platform === "darwin") {
    // BSD cp's -c asks APFS/HFS+ for copy-on-write clones.
    await execa("cp", ["-cR", source, destination]);
    return;
  }
  if (process.platform === "win32") {
    // On Windows ReFS / Dev Drive, Node's fs.cp with COPYFILE_FICLONE_FORCE
    // invokes FSCTL_DUPLICATE_EXTENTS_TO_FILE for true copy-on-write block cloning.
    await fs.cp(source, destination, {
      recursive: true,
      mode: fs.constants.COPYFILE_FICLONE_FORCE,
      verbatimSymlinks: true,
    });
    return;
  }
  throw new Error("This platform does not expose a supported reflink copy command.");
}

/** Probe the actual filesystem rather than assuming reflinks from the OS name. */
export async function supportsReflink(dir: string): Promise<boolean> {
  if (process.platform !== "linux" && process.platform !== "darwin" && process.platform !== "win32") {
    return false;
  }
  const probeDir = await fs.mkdtemp(path.join(dir, ".wtx-reflink-"));
  const source = path.join(probeDir, "source");
  const destination = path.join(probeDir, "destination");
  try {
    await fs.writeFile(source, "probe");
    await runReflinkCopy(source, destination);
    return true;
  } catch {
    return false;
  } finally {
    await fs.rm(probeDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

/** Link all active dependency directories (reflink or symlink) into the sandbox. */
export async function linkDependencies(mainRepoPath: string, sandboxDir: string): Promise<DependencyStrategy> {
  const depDirs = await readDependencyDirs(mainRepoPath);
  if (!depDirs.length) return "none";

  const reflinkAvailable = await supportsReflink(mainRepoPath);
  let linkedCount = 0;
  let usedReflink = false;

  for (const depDir of depDirs) {
    const source = path.join(mainRepoPath, depDir);
    const destination = path.join(sandboxDir, depDir);
    if (!(await pathExists(source))) continue;
    if (await pathExists(destination)) {
      throw new Error(`Refusing to replace existing dependency directory: ${destination}`);
    }

    await fs.mkdir(path.dirname(destination), { recursive: true });
    linkedCount += 1;
    if (reflinkAvailable) {
      try {
        await runReflinkCopy(source, destination);
        usedReflink = true;
        continue;
      } catch {
        // A large tree can still fail after a successful one-file probe. Remove
        // only the destination we own, then fall back to a visible symlink/junction.
        await fs.rm(destination, { recursive: true, force: true }).catch(() => undefined);
      }
    }

    try {
      await fs.symlink(source, destination, process.platform === "win32" ? "junction" : "dir");
    } catch {
      // Ultimate fallback for restricted filesystems (FAT32/exFAT/SMB/Docker mounts)
      // where symlinks and directory junctions are forbidden or fail with EPERM.
      await fs.cp(source, destination, { recursive: true, verbatimSymlinks: true });
    }
  }

  if (linkedCount === 0) return "none";
  return usedReflink ? "reflink" : "symlink";
}

/** Symlink selected ignored configuration without overwriting worktree content. */
export async function linkSharedConfig(mainRepoPath: string, sandboxDir: string, files: readonly string[]): Promise<string[]> {
  const linked: string[] = [];
  for (const file of files) {
    const safeFile = validateRepoRelativePath(mainRepoPath, file, "sharedFiles");
    const source = path.join(mainRepoPath, safeFile);
    const destination = path.join(sandboxDir, safeFile);
    if (!(await pathExists(source)) || (await pathExists(destination))) continue;
    await fs.mkdir(path.dirname(destination), { recursive: true });
    const sourceStat = await fs.stat(source);
    if (sourceStat.isDirectory()) {
      try {
        await fs.symlink(source, destination, process.platform === "win32" ? "junction" : "dir");
      } catch {
        await fs.cp(source, destination, { recursive: true, verbatimSymlinks: true }).catch(() => undefined);
      }
    } else {
      try {
        await fs.symlink(source, destination, "file");
      } catch {
        // On Windows without Developer Mode / Admin rights, fs.symlink(..., "file") throws EPERM/EACCES.
        // Fall back to a hard link (which requires zero elevated privileges on NTFS/ReFS and shares live content),
        // and if hard link fails across different partitions, fall back to copyFile.
        try {
          await fs.link(source, destination);
        } catch {
          await fs.copyFile(source, destination).catch(() => undefined);
        }
      }
    }
    linked.push(safeFile);
  }
  return linked;
}

export async function checkDrift(mainRepoPath: string, sandboxRecordHash: string | null): Promise<boolean> {
  if (sandboxRecordHash === null) return false;
  return (await hashPackageJson(mainRepoPath)) !== sandboxRecordHash;
}

export function dependencyWarning(strategy: DependencyStrategy): string | undefined {
  if (strategy === "symlink") {
    return "Dependencies are symlinked: changes inside dependency directories affect the main checkout.";
  }
  if (strategy === "none") {
    return "No dependency directory was found in the main checkout; install dependencies inside this sandbox if needed.";
  }
  return undefined;
}
