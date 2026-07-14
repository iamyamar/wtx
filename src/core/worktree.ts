import fs from "node:fs/promises";
import path from "node:path";
import { execa } from "execa";
import type { WorktreeInfo } from "../types.js";

export async function getRepoRoot(cwd: string): Promise<string> {
  const { stdout } = await execa("git", ["rev-parse", "--show-toplevel"], { cwd });
  return fs.realpath(path.resolve(stdout.trim()));
}

export async function getRepoName(cwd: string): Promise<string> {
  return path.basename(await getRepoRoot(cwd));
}

export async function branchIsCheckedOutElsewhere(cwd: string, branch: string): Promise<boolean> {
  return (await listWorktrees(cwd)).some((worktree) => worktree.branch === `refs/heads/${branch}`);
}

async function localBranchExists(repoPath: string, branch: string): Promise<boolean> {
  const result = await execa("git", ["show-ref", "--verify", "--quiet", `refs/heads/${branch}`], {
    cwd: repoPath,
    reject: false,
  });
  if (result.exitCode === 0) return true;
  if (result.exitCode === 1) return false;
  throw new Error(result.stderr || `Could not check whether branch "${branch}" exists.`);
}

export async function createWorktree(mainRepoPath: string, sandboxDir: string, branch: string): Promise<void> {
  await execa("git", ["check-ref-format", "--branch", branch], { cwd: mainRepoPath });
  try {
    await fs.lstat(sandboxDir);
    throw new Error(`Sandbox directory already exists: ${sandboxDir}. Run \`ocs doctor\` before retrying.`);
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  await fs.mkdir(path.dirname(sandboxDir), { recursive: true });
  const args = (await localBranchExists(mainRepoPath, branch))
    ? ["worktree", "add", sandboxDir, branch]
    : ["worktree", "add", "-b", branch, sandboxDir];
  await execa("git", args, { cwd: mainRepoPath });
}

export async function removeWorktree(mainRepoPath: string, sandboxDir: string, force = false): Promise<void> {
  const args = ["worktree", "remove"];
  if (force) args.push("--force");
  args.push(sandboxDir);
  await execa("git", args, { cwd: mainRepoPath });
}

export async function pruneWorktrees(mainRepoPath: string): Promise<void> {
  await execa("git", ["worktree", "prune"], { cwd: mainRepoPath });
}

export function parseWorktreeList(output: string): WorktreeInfo[] {
  return output
    .trim()
    .split("\n\n")
    .filter(Boolean)
    .map((block) => {
      const info: WorktreeInfo = { path: "", detached: false, bare: false };
      for (const line of block.split("\n")) {
        const separator = line.indexOf(" ");
        const key = separator === -1 ? line : line.slice(0, separator);
        const value = separator === -1 ? "" : line.slice(separator + 1);
        if (key === "worktree") info.path = value;
        if (key === "HEAD") info.head = value;
        if (key === "branch") info.branch = value;
        if (key === "detached") info.detached = true;
        if (key === "bare") info.bare = true;
      }
      return info;
    });
}

export async function listWorktrees(mainRepoPath: string): Promise<WorktreeInfo[]> {
  const { stdout } = await execa("git", ["worktree", "list", "--porcelain"], { cwd: mainRepoPath });
  return parseWorktreeList(stdout);
}
