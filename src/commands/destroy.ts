import chalk from "chalk";
import { repositoryKey } from "../core/paths.js";
import { getSandbox, removeSandbox } from "../core/registry.js";
import { pruneWorktrees, removeWorktree } from "../core/worktree.js";
import { runHook } from "../core/hooks.js";

export async function destroyCommand(mainRepoPath: string, branch: string, force = false, noHooks = false): Promise<void> {
  const repoKey = repositoryKey(mainRepoPath);
  const record = await getSandbox(repoKey, branch);
  if (!record) {
    console.log(chalk.yellow(`No sandbox registered for branch "${branch}".`));
    process.exitCode = 1;
    return;
  }

  if (!noHooks) {
    await runHook(mainRepoPath, "preDestroy", record.path, branch);
  }

  try {
    await removeWorktree(record.mainRepoPath, record.path, force);
  } catch (error) {
    if (!force) {
      throw new Error(
        `Sandbox "${branch}" could not be removed. It may contain uncommitted or untracked changes. ` +
          "Commit/stash them first, or re-run with --force to discard the sandbox.",
        { cause: error },
      );
    }
    throw error;
  }
  await pruneWorktrees(record.mainRepoPath);
  await removeSandbox(repoKey, branch);
  console.log(chalk.green(`Sandbox for "${branch}" destroyed.`));
}
