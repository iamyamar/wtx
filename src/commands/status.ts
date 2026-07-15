import fs from "node:fs/promises";
import chalk from "chalk";
import { checkDrift } from "../core/deps.js";
import { repositoryKey } from "../core/paths.js";
import { getSandbox, touchSandbox } from "../core/registry.js";
import { formatRelativeTime } from "../core/format.js";

export async function statusCommand(mainRepoPath: string, branch: string, options: { json: boolean } = { json: false }): Promise<void> {
  const record = await getSandbox(repositoryKey(mainRepoPath), branch);
  if (!record) throw new Error(`No sandbox registered for branch "${branch}".`);

  const exists = await fs.access(record.path).then(() => true).catch(() => false);
  const drifted = await checkDrift(record.mainRepoPath, record.packageJsonHash);
  const row = {
    branch: record.branch,
    state: record.state,
    path: record.path,
    port: record.port ?? "\u2014",
    deps: record.depsStrategy,
    directory: exists ? "present" : "missing",
    dependencies: drifted ? "stale" : "current",
    created: formatRelativeTime(record.createdAt),
    accessed: formatRelativeTime(record.lastAccessed),
  };

  if (options.json) {
    console.log(JSON.stringify(row, null, 2));
  } else {
    console.table([row]);
  }
  if (!options.json) {
    if (!exists) console.log(chalk.red("Sandbox directory is missing. Run `wtx doctor --repair` to clear its stale registry entry."));
    if (drifted) console.log(chalk.yellow("Main package manifest or lockfile changed since this sandbox was created; recreate it to refresh dependencies."));
  }
  if (exists) await touchSandbox(record.repoKey, record.branch);
}
