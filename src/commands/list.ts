import fs from "node:fs/promises";
import chalk from "chalk";
import { repositoryKey } from "../core/paths.js";
import { readRegistry } from "../core/registry.js";
import { formatRelativeTime, getDiskUsage } from "../core/format.js";

export interface ListOptions {
  all: boolean;
  json: boolean;
  size: boolean;
}

export async function listCommand(mainRepoPath: string, options: ListOptions = { all: false, json: false, size: false }): Promise<void> {
  const registry = await readRegistry();
  let records;

  if (options.all) {
    records = Object.values(registry)
      .flatMap((repos) => Object.values(repos))
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  } else {
    const repoKey = repositoryKey(mainRepoPath);
    records = Object.values(registry[repoKey] ?? {}).sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  if (!records.length) {
    if (!options.json) console.log("No sandboxes registered" + (options.all ? "." : " for this repository."));
    if (options.json) console.log("[]");
    return;
  }

  const rows = await Promise.all(
    records.map(async (record) => {
      const exists = await fs.access(record.path).then(() => true).catch(() => false);
      const row: Record<string, string | number | null> = {
        ...(options.all ? { repo: record.repo } : {}),
        branch: record.branch,
        state: record.state === "ready" ? (exists ? "\u2705 ready" : "\u26A0\uFE0F missing") : "\u23F3 creating",
        port: record.port ?? "\u2014" as unknown as number,
        deps: record.depsStrategy,
        created: formatRelativeTime(record.createdAt),
        accessed: formatRelativeTime(record.lastAccessed),
      };
      if (options.size && exists) {
        row.size = await getDiskUsage(record.path);
      }
      row.path = record.path;
      return row;
    }),
  );

  if (options.json) {
    console.log(JSON.stringify(rows, null, 2));
    return;
  }

  console.table(rows);
  if (records.some((record) => record.depsStrategy === "symlink")) {
    console.log(chalk.yellow("Symlinked dependencies are shared with the main checkout."));
  }
  const missingCount = rows.filter((r) => String(r.state).includes("missing")).length;
  if (missingCount) {
    console.log(chalk.yellow(`${missingCount} sandbox(es) have missing directories. Run \`wtx doctor --repair\` to clean up.`));
  }
}
