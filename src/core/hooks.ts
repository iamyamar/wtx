import { execa } from "execa";
import chalk from "chalk";
import { readFullConfig } from "./deps.js";

export async function runHook(
  mainRepoPath: string,
  hookName: "postCreate" | "preDestroy",
  sandboxDir: string,
  branch: string,
): Promise<void> {
  const config = await readFullConfig(mainRepoPath);
  const command = config.hooks?.[hookName];
  if (!command) return;

  console.log(chalk.cyan(`Running ${hookName} hook: ${command}`));
  try {
    await execa(process.env.SHELL || "/bin/bash", ["-c", command], {
      cwd: sandboxDir,
      stdio: "inherit",
      env: {
        ...process.env,
        OPENCODE_SANDBOX: "1",
        OPENCODE_SANDBOX_BRANCH: branch,
      },
    });
  } catch (error) {
    console.log(
      chalk.yellow(`Hook "${hookName}" failed: ${error instanceof Error ? error.message : String(error)}`),
    );
  }
}
