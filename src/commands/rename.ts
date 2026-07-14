import chalk from "chalk";
import { execa } from "execa";
import { repositoryKey } from "../core/paths.js";
import { getSandbox, removeSandbox, upsertSandbox } from "../core/registry.js";

export async function renameCommand(mainRepoPath: string, oldBranch: string, newBranch: string): Promise<void> {
  const repoKey = repositoryKey(mainRepoPath);
  const record = await getSandbox(repoKey, oldBranch);
  if (!record) {
    console.log(chalk.yellow(`No sandbox registered for branch "${oldBranch}".`));
    process.exitCode = 1;
    return;
  }

  // Rename the Git branch inside the worktree
  await execa("git", ["branch", "-m", oldBranch, newBranch], { cwd: record.path });

  // Update registry: remove old key, add new key
  await removeSandbox(repoKey, oldBranch);
  await upsertSandbox({
    ...record,
    branch: newBranch,
    lastAccessed: new Date().toISOString(),
  });

  console.log(chalk.green(`Renamed sandbox "${oldBranch}" → "${newBranch}".`));
}
