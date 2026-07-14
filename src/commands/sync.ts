import chalk from "chalk";
import { execa } from "execa";
import { repositoryKey } from "../core/paths.js";
import { getSandbox, touchSandbox } from "../core/registry.js";
import { checkDrift } from "../core/deps.js";
import { refreshCommand } from "./refresh.js";

export interface SyncOptions {
  merge: boolean;
  from?: string;
}

export async function syncCommand(mainRepoPath: string, branch: string, options: SyncOptions): Promise<void> {
  const repoKey = repositoryKey(mainRepoPath);
  const record = await getSandbox(repoKey, branch);
  if (!record) {
    console.log(chalk.yellow(`No sandbox registered for branch "${branch}".`));
    process.exitCode = 1;
    return;
  }

  const upstream = options.from ?? "main";
  const strategy = options.merge ? "merge" : "rebase";

  // Fetch latest from origin first (ignore errors for local-only repos)
  await execa("git", ["fetch", "origin", upstream], { cwd: record.path, reject: false });

  console.log(chalk.cyan(`Syncing "${branch}" with ${upstream} via ${strategy}…`));
  try {
    await execa("git", [strategy, upstream], { cwd: record.path, stdio: "inherit" });
  } catch {
    console.log(chalk.red(`${strategy} failed. Resolve conflicts in ${record.path} and retry.`));
    process.exitCode = 1;
    return;
  }

  await touchSandbox(repoKey, branch);

  if (await checkDrift(mainRepoPath, record.packageJsonHash)) {
    console.log(chalk.yellow("Dependencies drifted during sync. Running refresh…"));
    await refreshCommand(mainRepoPath, branch);
  }

  console.log(chalk.green(`Sandbox "${branch}" synced with ${upstream}.`));
}
