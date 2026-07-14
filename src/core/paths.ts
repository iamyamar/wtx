import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";

export function sandboxRoot(): string {
  return process.env.OPENCODE_SANDBOX_HOME
    ? path.resolve(process.env.OPENCODE_SANDBOX_HOME)
    : path.join(os.homedir(), ".opencode", "sandboxes");
}

/**
 * Directory-safe name that preserves enough text to be recognisable while
 * disambiguating repositories with the same basename in different locations.
 */
export function repositoryKey(repoPath: string): string {
  const basename = path.basename(repoPath).replace(/[^a-zA-Z0-9._-]+/g, "-") || "repo";
  const suffix = crypto.createHash("sha256").update(path.resolve(repoPath)).digest("hex").slice(0, 10);
  return `${basename}-${suffix}`;
}

export function repoSandboxDir(repoKey: string): string {
  return path.join(sandboxRoot(), repoKey);
}

/** A readable, collision-safe branch directory (feature/a and feature-a differ). */
export function sandboxPath(repoKey: string, branch: string): string {
  const readable = branch
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "branch";
  const suffix = crypto.createHash("sha256").update(branch).digest("hex").slice(0, 10);
  return path.join(repoSandboxDir(repoKey), `${readable}-${suffix}`);
}

export function registryPath(): string {
  return path.join(sandboxRoot(), "registry.json");
}
