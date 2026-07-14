import chalk from "chalk";
import { repositoryKey } from "../core/paths.js";
import { readRegistry, removeSandbox } from "../core/registry.js";
import { pruneWorktrees, removeWorktree } from "../core/worktree.js";

export async function pruneCommand(mainRepoPath: string, force: boolean): Promise<void> {
  const repoKey = repositoryKey(mainRepoPath);
  const registry = await readRegistry();
  const records = Object.values(registry[repoKey] ?? {});
  if (!records.length) {
    console.log("No sandboxes to prune.");
    return;
  }

  let removed = 0;
  let failed = 0;
  for (const record of records) {
    try {
      await removeWorktree(record.mainRepoPath, record.path, force);
      await removeSandbox(repoKey, record.branch);
      console.log(chalk.green(`Removed sandbox "${record.branch}".`));
      removed += 1;
    } catch (error) {
      if (!force) {
        console.log(chalk.yellow(`Skipped "${record.branch}" — uncommitted changes. Re-run with --force to discard.`));
      } else {
        console.log(chalk.red(`Failed to remove "${record.branch}": ${error instanceof Error ? error.message : String(error)}`));
      }
      failed += 1;
    }
  }
  await pruneWorktrees(mainRepoPath);

  if (removed) console.log(chalk.green(`Pruned ${removed} sandbox${removed === 1 ? "" : "es"}.`));
  if (failed) console.log(chalk.yellow(`${failed} sandbox${failed === 1 ? "" : "es"} skipped or failed.`));
}
