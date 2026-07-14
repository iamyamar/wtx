import chalk from "chalk";
import { repositoryKey } from "../core/paths.js";
import { readRegistry } from "../core/registry.js";

export async function listCommand(mainRepoPath: string): Promise<void> {
  const repoKey = repositoryKey(mainRepoPath);
  const registry = await readRegistry();
  const records = Object.values(registry[repoKey] ?? {}).sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  if (!records.length) {
    console.log("No sandboxes registered for this repository.");
    return;
  }

  console.table(
    records.map((record) => ({
      branch: record.branch,
      state: record.state,
      port: record.port ?? "—",
      deps: record.depsStrategy,
      created: record.createdAt,
      accessed: record.lastAccessed,
      path: record.path,
    })),
  );
  if (records.some((record) => record.depsStrategy === "symlink")) {
    console.log(chalk.yellow("Symlinked dependencies are shared with the main checkout."));
  }
}
