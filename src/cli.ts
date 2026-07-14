#!/usr/bin/env node
import { Command } from "commander";
import { createCommand } from "./commands/create.js";
import { destroyCommand } from "./commands/destroy.js";
import { doctorCommand } from "./commands/doctor.js";
import { enterCommand } from "./commands/enter.js";
import { listCommand } from "./commands/list.js";
import { pruneCommand } from "./commands/prune.js";
import { refreshCommand } from "./commands/refresh.js";
import { runCommand } from "./commands/run.js";
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
  .command("enter <branch>")
  .description("Open a shell in an existing sandbox")
  .action(async (branch: string) => enterCommand(await getRepoRoot(process.cwd()), branch));

program
  .command("prune")
  .description("Remove all sandboxes for this repository")
  .option("-f, --force", "Discard uncommitted or untracked changes")
  .action(async (options: { force: boolean }) => pruneCommand(await getRepoRoot(process.cwd()), options.force));

program
  .command("refresh <branch>")
  .description("Re-link dependencies and shared config for a sandbox")
  .action(async (branch: string) => refreshCommand(await getRepoRoot(process.cwd()), branch));

program
  .command("run <branch>")
  .description("Run a command inside a sandbox")
  .allowUnknownOption()
  .argument("<command...>", "Command to execute")
  .option("-s, --shell", "Run command through a shell")
  .action(async (branch: string, command: string[], options: { shell: boolean }) => runCommand(await getRepoRoot(process.cwd()), branch, command, options.shell));

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
