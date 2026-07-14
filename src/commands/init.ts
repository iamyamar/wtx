import fs from "node:fs/promises";
import path from "node:path";
import chalk from "chalk";
import type { SandboxConfig } from "../types.js";

export async function initCommand(mainRepoPath: string, options: { shared?: string[] }): Promise<void> {
  const configPath = path.join(mainRepoPath, ".sandboxrc.json");

  try {
    await fs.access(configPath);
    console.log(chalk.yellow(`.sandboxrc.json already exists at ${configPath}.`));
    process.exitCode = 1;
    return;
  } catch {
    /* doesn't exist, good */
  }

  const config: SandboxConfig = {
    sharedFiles: options.shared ?? [".env", ".env.local", ".vscode/settings.json"],
    dependencyDirs: ["node_modules", ".venv", "target", "vendor"],
  };

  await fs.writeFile(configPath, JSON.stringify(config, null, 2) + "\n", "utf8");
  console.log(chalk.green(`Created ${configPath}`));
}
