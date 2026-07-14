import chalk from "chalk";
import { execa } from "execa";
import { repositoryKey } from "../core/paths.js";
import { getSandbox, touchSandbox } from "../core/registry.js";

export interface OpenOptions {
  editor?: string;
  finder: boolean;
}

export async function openCommand(mainRepoPath: string, branch: string, options: OpenOptions): Promise<void> {
  const repoKey = repositoryKey(mainRepoPath);
  const record = await getSandbox(repoKey, branch);
  if (!record) {
    console.log(chalk.yellow(`No sandbox registered for branch "${branch}".`));
    process.exitCode = 1;
    return;
  }

  await touchSandbox(repoKey, branch);

  if (options.finder) {
    const cmd = process.platform === "darwin" ? "open" : "xdg-open";
    await execa(cmd, [record.path]);
    console.log(chalk.green(`Opened ${record.path} in file manager.`));
    return;
  }

  const editor = options.editor || process.env.EDITOR || "code";
  console.log(chalk.cyan(`Opening "${branch}" in ${editor}…`));
  await execa(editor, [record.path], { stdio: "inherit", reject: false });
}
