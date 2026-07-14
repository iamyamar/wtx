import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { execa } from "execa";
import type { DependencyStrategy, SandboxConfig } from "../types.js";

const DEFAULT_SHARED_FILES = [".env", ".env.local", ".vscode/settings.json"];
const LOCK_FILES = ["package-lock.json", "pnpm-lock.yaml", "yarn.lock", "bun.lockb"];

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.lstat(filePath);
    return true;
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

export async function hashPackageJson(repoPath: string): Promise<string | null> {
  const packageJson = path.join(repoPath, "package.json");
  if (!(await pathExists(packageJson))) return null;

  const hash = crypto.createHash("sha256");
  hash.update(await fs.readFile(packageJson));
  for (const lockFile of LOCK_FILES) {
    const filePath = path.join(repoPath, lockFile);
    if (await pathExists(filePath)) {
      hash.update(`\u0000${lockFile}\u0000`);
      hash.update(await fs.readFile(filePath));
    }
  }
  return hash.digest("hex");
}

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
  throw new Error("This platform does not expose a supported reflink copy command.");
}

/** Probe the actual filesystem rather than assuming reflinks from the OS name. */
export async function supportsReflink(dir: string): Promise<boolean> {
  if (process.platform !== "linux" && process.platform !== "darwin") return false;
  const probeDir = await fs.mkdtemp(path.join(dir, ".ocs-reflink-"));
  const source = path.join(probeDir, "source");
  const destination = path.join(probeDir, "destination");
  try {
    await fs.writeFile(source, "probe");
    await runReflinkCopy(source, destination);
    return true;
  } catch {
    return false;
  } finally {
    await fs.rm(probeDir, { recursive: true, force: true });
  }
}

export async function linkDependencies(mainRepoPath: string, sandboxDir: string): Promise<DependencyStrategy> {
  const source = path.join(mainRepoPath, "node_modules");
  const destination = path.join(sandboxDir, "node_modules");
  if (!(await pathExists(source))) return "none";
  if (await pathExists(destination)) {
    throw new Error(`Refusing to replace existing dependency directory: ${destination}`);
  }

  if (await supportsReflink(mainRepoPath)) {
    try {
      await runReflinkCopy(source, destination);
      return "reflink";
    } catch {
      // A large tree can still fail after a successful one-file probe. Remove
      // only the destination we own, then fall back to a visible symlink.
      await fs.rm(destination, { recursive: true, force: true });
    }
  }

  await fs.symlink(source, destination, process.platform === "win32" ? "junction" : "dir");
  return "symlink";
}

function validateSharedFile(repoPath: string, item: string): string {
  if (typeof item !== "string" || !item.trim()) throw new Error("sharedFiles entries must be non-empty strings.");
  if (path.isAbsolute(item)) throw new Error(`sharedFiles must be repository-relative, not absolute: ${item}`);
  const resolved = path.resolve(repoPath, item);
  const relative = path.relative(repoPath, resolved);
  if (relative === "" || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`sharedFiles entry escapes the repository: ${item}`);
  }
  return relative;
}

export async function readSandboxConfig(repoPath: string): Promise<string[]> {
  const configPath = path.join(repoPath, ".sandboxrc.json");
  if (!(await pathExists(configPath))) return DEFAULT_SHARED_FILES;
  let parsed: SandboxConfig;
  try {
    parsed = JSON.parse(await fs.readFile(configPath, "utf8")) as SandboxConfig;
  } catch (error) {
    throw new Error(`Cannot parse ${configPath}: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error(`${configPath} must contain a JSON object.`);
  }
  if (parsed.sharedFiles === undefined) return DEFAULT_SHARED_FILES;
  if (!Array.isArray(parsed.sharedFiles)) throw new Error(`${configPath}: sharedFiles must be an array.`);
  return [...new Set(parsed.sharedFiles.map((item) => validateSharedFile(repoPath, item)))];
}

/** Symlink selected ignored configuration without overwriting worktree content. */
export async function linkSharedConfig(mainRepoPath: string, sandboxDir: string, files: readonly string[]): Promise<string[]> {
  const linked: string[] = [];
  for (const file of files) {
    const safeFile = validateSharedFile(mainRepoPath, file);
    const source = path.join(mainRepoPath, safeFile);
    const destination = path.join(sandboxDir, safeFile);
    if (!(await pathExists(source)) || (await pathExists(destination))) continue;
    await fs.mkdir(path.dirname(destination), { recursive: true });
    const sourceStat = await fs.stat(source);
    await fs.symlink(source, destination, sourceStat.isDirectory() ? "dir" : "file");
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
    return "Dependencies are symlinked: changes inside node_modules affect the main checkout.";
  }
  if (strategy === "none") return "No node_modules directory was found in the main checkout; install dependencies inside this sandbox if needed.";
  return undefined;
}
