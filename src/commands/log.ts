import chalk from "chalk";
import { execa } from "execa";
import { repositoryKey } from "../core/paths.js";
import { getSandbox } from "../core/registry.js";

export interface LogOptions {
  number?: string;
  from?: string;
}

export async function logCommand(mainRepoPath: string, branch: string, options: LogOptions): Promise<void> {
  const record = await getSandbox(repositoryKey(mainRepoPath), branch);
  if (!record) {
    console.log(chalk.yellow(`No sandbox registered for branch "${branch}".`));
    process.exitCode = 1;
    return;
  }

  const base = options.from ?? "main";
  const args = ["log", `${base}..${branch}`, "--oneline"];
  if (options.number) args.push("-n", options.number);
  await execa("git", args, { cwd: record.path, stdio: "inherit" });
}
