import chalk from "chalk";
import { repositoryKey } from "../core/paths.js";
import { readRegistry } from "../core/registry.js";
import { destroyCommand } from "./destroy.js";

export interface GcOptions {
  olderThan: string;
  dryRun: boolean;
  force: boolean;
}

function parseDuration(input: string): number {
  const match = input.match(/^(\d+)\s*(d|h|m|w)$/);
  if (!match) throw new Error(`Invalid duration: "${input}". Use e.g. 7d, 24h, 2w.`);
  const value = Number(match[1]);
  const unit = match[2];
  const multipliers: Record<string, number> = { m: 60_000, h: 3_600_000, d: 86_400_000, w: 604_800_000 };
  return value * multipliers[unit];
}

export async function gcCommand(mainRepoPath: string, options: GcOptions): Promise<void> {
  const repoKey = repositoryKey(mainRepoPath);
  const registry = await readRegistry();
  const records = Object.values(registry[repoKey] ?? {});
  const threshold = Date.now() - parseDuration(options.olderThan);

  const stale = records.filter((r) => new Date(r.lastAccessed).getTime() < threshold);
  if (!stale.length) {
    console.log(chalk.green("No sandboxes older than " + options.olderThan + "."));
    return;
  }

  for (const record of stale) {
    if (options.dryRun) {
      console.log(chalk.yellow(`Would remove: ${record.branch} (last accessed: ${record.lastAccessed})`));
    } else {
      await destroyCommand(mainRepoPath, record.branch, options.force);
    }
  }

  if (options.dryRun) {
    console.log(chalk.cyan(`${stale.length} sandbox(es) would be removed. Run without --dry-run to proceed.`));
  }
}
