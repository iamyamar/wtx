import chalk from "chalk";
import { execa } from "execa";
import { repositoryKey } from "../core/paths.js";
import { getSandbox } from "../core/registry.js";

export interface DiffOptions {
  stat: boolean;
  from?: string;
}

export async function diffCommand(mainRepoPath: string, branch: string, options: DiffOptions): Promise<void> {
  const record = await getSandbox(repositoryKey(mainRepoPath), branch);
  if (!record) {
    console.log(chalk.yellow(`No sandbox registered for branch "${branch}".`));
    process.exitCode = 1;
    return;
  }

  const base = options.from ?? "main";
  const args = ["diff", `${base}...${branch}`];
  if (options.stat) args.push("--stat");
  await execa("git", args, { cwd: record.path, stdio: "inherit" });
}
