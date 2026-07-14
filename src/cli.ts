#!/usr/bin/env node
import { Command } from "commander";
import { createCommand } from "./commands/create.js";
import { destroyCommand } from "./commands/destroy.js";
import { doctorCommand } from "./commands/doctor.js";
import { listCommand } from "./commands/list.js";
import { statusCommand } from "./commands/status.js";
import { getRepoRoot } from "./core/worktree.js";

const program = new Command();
program.name("opencode-sandbox").alias("ocs").description("Create isolated Git worktree sandboxes.").version("0.1.0");

program
  .command("create <branch>")
  .description("Create a sandbox and open a shell in it")
  .option("--no-shell", "Create the sandbox without entering an interactive shell")
  .option("--no-port", "Do not reserve a PORT value")
  .action(createCommand);

program
  .command("destroy <branch>")
  .description("Remove a sandbox worktree")
  .option("-f, --force", "Discard uncommitted or untracked worktree changes")
  .action(async (branch: string, options: { force: boolean }) => destroyCommand(await getRepoRoot(process.cwd()), branch, options.force));

program
  .command("list")
  .description("List registered sandboxes for this repository")
  .action(async () => listCommand(await getRepoRoot(process.cwd())));

program
  .command("status <branch>")
  .description("Show sandbox state and dependency drift")
  .action(async (branch: string) => statusCommand(await getRepoRoot(process.cwd()), branch));

program
  .command("doctor")
  .description("Compare the registry with Git worktrees")
  .option("--repair", "Remove registry entries whose worktrees no longer exist")
  .option("--adopt-orphans", "Register untracked sandbox worktrees")
  .option("--remove-orphans", "Force-remove untracked sandbox worktrees")
  .action(async (options) => doctorCommand(await getRepoRoot(process.cwd()), options));

program.parseAsync().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`ocs: ${message}`);
  process.exitCode = 1;
});
