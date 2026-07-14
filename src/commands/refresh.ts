import fs from "node:fs/promises";
import path from "node:path";
import chalk from "chalk";
import { checkDrift, dependencyWarning, hashPackageJson, linkDependencies, linkSharedConfig, readSandboxConfig, readDependencyDirs } from "../core/deps.js";
import { repositoryKey } from "../core/paths.js";
import { getSandbox, upsertSandbox } from "../core/registry.js";

export async function refreshCommand(mainRepoPath: string, branch: string): Promise<void> {
  const repoKey = repositoryKey(mainRepoPath);
  const record = await getSandbox(repoKey, branch);
  if (!record) {
    console.log(chalk.yellow(`No sandbox registered for branch "${branch}".`));
    process.exitCode = 1;
    return;
  }

  const depDirs = await readDependencyDirs(mainRepoPath);
  for (const dir of depDirs) {
    try {
      await fs.rm(path.join(record.path, dir), { recursive: true, force: true });
    } catch {
      /* directory may not exist or already cleaned */
    }
  }

  const recordHash = await hashPackageJson(mainRepoPath);
  const depsStrategy = await linkDependencies(mainRepoPath, record.path);
  const sharedFiles = await readSandboxConfig(mainRepoPath);
  const linkedFiles = await linkSharedConfig(mainRepoPath, record.path, sharedFiles);

  record.depsStrategy = depsStrategy;
  record.packageJsonHash = recordHash;
  record.lastAccessed = new Date().toISOString();
  await upsertSandbox(record);

  const portDescription = record.port === null ? "no port allocated" : `port ${record.port}`;
  console.log(chalk.green(`Refreshed sandbox "${branch}" (${portDescription}, deps: ${depsStrategy}).`));
  if (linkedFiles.length) console.log(`Shared config: ${linkedFiles.join(", ")}`);
  const warning = dependencyWarning(depsStrategy);
  if (warning) console.log(chalk.yellow(warning));
  if (await checkDrift(mainRepoPath, recordHash)) {
    console.log(chalk.yellow("Dependencies changed while the sandbox was being refreshed."));
  }
}
