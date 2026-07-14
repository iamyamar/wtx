import fs from "node:fs/promises";
import path from "node:path";
import chalk from "chalk";
import { hashPackageJson } from "../core/deps.js";
import { repoSandboxDir, repositoryKey } from "../core/paths.js";
import { readRegistry, removeSandbox, upsertSandbox } from "../core/registry.js";
import { listWorktrees, pruneWorktrees, removeWorktree } from "../core/worktree.js";
import type { SandboxRecord, WorktreeInfo } from "../types.js";

export interface DoctorOptions {
  repair: boolean;
  adoptOrphans: boolean;
  removeOrphans: boolean;
}

function isInside(parent: string, candidate: string): boolean {
  const relative = path.relative(parent, candidate);
  return relative !== "" && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function branchFromWorktree(worktree: WorktreeInfo): string | undefined {
  const prefix = "refs/heads/";
  return worktree.branch?.startsWith(prefix) ? worktree.branch.slice(prefix.length) : undefined;
}

export async function doctorCommand(mainRepoPath: string, options: DoctorOptions): Promise<void> {
  if (options.adoptOrphans && options.removeOrphans) {
    throw new Error("Choose either --adopt-orphans or --remove-orphans, not both.");
  }
  const repoKey = repositoryKey(mainRepoPath);
  const sandboxDirectory = repoSandboxDir(repoKey);
  const realSandboxDirectory = await fs.realpath(sandboxDirectory).catch(() => path.resolve(sandboxDirectory));
  const registry = await readRegistry();
  const records = registry[repoKey] ?? {};
  const worktrees = await listWorktrees(mainRepoPath);
  const sandboxWorktrees = await Promise.all(
    worktrees.map(async (worktree) => {
      const realPath = await fs.realpath(worktree.path).catch(() => path.resolve(worktree.path));
      return { ...worktree, realPath };
    }),
  ).then((list) => list.filter((worktree) => isInside(realSandboxDirectory, worktree.realPath)));
  const existingSandboxWorktrees = await Promise.all(
    sandboxWorktrees.map(async (worktree) => ({
      worktree,
      exists: await fs.access(worktree.path).then(() => true).catch(() => false),
    })),
  );
  const actualPaths = new Set(
    existingSandboxWorktrees.filter(({ exists }) => exists).map(({ worktree }) => worktree.realPath),
  );
  const registeredPaths = new Set(
    await Promise.all(Object.values(records).map(async (record) => fs.realpath(record.path).catch(() => path.resolve(record.path)))),
  );
  const staleRecords = await Promise.all(
    Object.values(records).map(async (record) => ({
      record,
      realPath: await fs.realpath(record.path).catch(() => path.resolve(record.path)),
    })),
  );
  const stale = staleRecords.filter(({ realPath }) => !actualPaths.has(realPath)).map(({ record }) => record);
  const orphans = sandboxWorktrees.filter((worktree) => !registeredPaths.has(worktree.realPath));

  console.log(`Registered sandboxes: ${Object.keys(records).length}`);
  console.log(`Git worktrees under ${sandboxDirectory}: ${sandboxWorktrees.length}`);
  if (!stale.length && !orphans.length) {
    console.log(chalk.green("Doctor found no registry/worktree discrepancies."));
    return;
  }

  for (const record of stale) console.log(chalk.yellow(`Stale registry entry: ${record.branch} (${record.path})`));
  for (const worktree of orphans) console.log(chalk.yellow(`Unregistered worktree: ${worktree.path} (${branchFromWorktree(worktree) ?? "detached HEAD"})`));

  if (options.repair) {
    for (const record of stale) await removeSandbox(repoKey, record.branch);
    if (stale.length) console.log(chalk.green(`Removed ${stale.length} stale registry entr${stale.length === 1 ? "y" : "ies"}.`));
  }

  if (options.adoptOrphans) {
    let adopted = 0;
    for (const worktree of orphans) {
      const branch = branchFromWorktree(worktree);
      if (!branch) {
        console.log(chalk.yellow(`Skipped detached worktree: ${worktree.path}`));
        continue;
      }
      const existing = records[branch];
      if (existing) {
        console.log(chalk.yellow(`Skipped ${worktree.path}; branch "${branch}" already has a registry record.`));
        continue;
      }
      const now = new Date().toISOString();
      const record: SandboxRecord = {
        repo: path.basename(mainRepoPath),
        repoKey,
        branch,
        path: path.resolve(worktree.path),
        mainRepoPath,
        createdAt: now,
        lastAccessed: now,
        depsStrategy: "none",
        port: null,
        packageJsonHash: await hashPackageJson(mainRepoPath),
        state: "ready",
      };
      await upsertSandbox(record);
      adopted += 1;
    }
    if (adopted) console.log(chalk.green(`Adopted ${adopted} orphaned worktree${adopted === 1 ? "" : "s"}.`));
  }

  if (options.removeOrphans) {
    for (const worktree of orphans) await removeWorktree(mainRepoPath, worktree.path, true);
    if (orphans.length) await pruneWorktrees(mainRepoPath);
    if (orphans.length) console.log(chalk.green(`Removed ${orphans.length} orphaned worktree${orphans.length === 1 ? "" : "s"}.`));
  }
}
