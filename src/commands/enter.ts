import chalk from "chalk";
import { repositoryKey } from "../core/paths.js";
import { getSandbox } from "../core/registry.js";
import { openSandboxShell } from "../core/shell.js";

export async function enterCommand(mainRepoPath: string, branch: string): Promise<void> {
  const repoKey = repositoryKey(mainRepoPath);
  const record = await getSandbox(repoKey, branch);
  if (!record) {
    console.log(chalk.yellow(`No sandbox registered for branch "${branch}".`));
    console.log(`Run \`ocs create ${branch}\` to create one.`);
    return;
  }
  await openSandboxShell(record.path, record.branch, record.port);
}
