import { spawn } from "node:child_process";
import chalk from "chalk";
import { repositoryKey } from "../core/paths.js";
import { getSandbox, touchSandbox } from "../core/registry.js";

export async function runCommand(mainRepoPath: string, branch: string, command: string[], shell: boolean): Promise<void> {
  const repoKey = repositoryKey(mainRepoPath);
  const record = await getSandbox(repoKey, branch);
  if (!record) {
    console.log(chalk.yellow(`No sandbox registered for branch "${branch}".`));
    process.exitCode = 1;
    return;
  }

  await touchSandbox(repoKey, branch);

  const program = shell
    ? [process.env.SHELL || "/bin/bash", "-c", command.join(" ")]
    : command;

  const child = spawn(program[0], program.slice(1), {
    cwd: record.path,
    stdio: "inherit",
    env: {
      ...process.env,
      ...(record.port === null ? {} : { PORT: String(record.port) }),
      OPENCODE_SANDBOX: "1",
      OPENCODE_SANDBOX_BRANCH: record.branch,
    },
  });

  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => {
      process.exitCode = code ?? 1;
      resolve();
    });
  });
}
