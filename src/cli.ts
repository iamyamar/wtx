#!/usr/bin/env node
import { Command } from "commander";
import { completionCommand } from "./commands/completion.js";
import { createCommand } from "./commands/create.js";
import { destroyCommand } from "./commands/destroy.js";
import { diffCommand } from "./commands/diff.js";
import { doctorCommand } from "./commands/doctor.js";
import { enterCommand } from "./commands/enter.js";
import { gcCommand } from "./commands/gc.js";
import { initCommand } from "./commands/init.js";
import { listCommand } from "./commands/list.js";
import { logCommand } from "./commands/log.js";
import { openCommand } from "./commands/open.js";
import { pruneCommand } from "./commands/prune.js";
import { refreshCommand } from "./commands/refresh.js";
import { renameCommand } from "./commands/rename.js";
import { runCommand } from "./commands/run.js";
import { stashCommand } from "./commands/stash.js";
import { statusCommand } from "./commands/status.js";
import { syncCommand } from "./commands/sync.js";
import { whichCommand } from "./commands/which.js";
import { getRepoRoot } from "./core/worktree.js";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const pkg = require("../package.json");

const program = new Command();
program
  .name("wtx")
  .description(pkg.description)
  .version(pkg.version)
  .option("--json", "Output results as JSON")
  .option("-q, --quiet", "Suppress non-error output")
  .option("-v, --verbose", "Show detailed output");

program
  .command("create <branch>")
  .description("Create a sandbox and open a shell in it")
  .option("--no-shell", "Create the sandbox without entering an interactive shell")
  .option("--no-port", "Do not reserve a PORT value")
  .option("--from <base>", "Base branch or ref to branch from")
  .option("--no-hooks", "Skip post-create hooks")
  .action(createCommand);

program
  .command("destroy <branch>")
  .description("Remove a sandbox worktree")
  .option("-f, --force", "Discard uncommitted or untracked worktree changes")
  .option("--no-hooks", "Skip pre-destroy hooks")
  .action(async (branch: string, options: { force: boolean; hooks: boolean }) =>
    destroyCommand(await getRepoRoot(process.cwd()), branch, options.force, !options.hooks),
  );

program
  .command("list")
  .description("List registered sandboxes for this repository")
  .option("-a, --all", "List sandboxes across all repositories")
  .option("--size", "Include disk usage for each sandbox")
  .action(async (options: { all?: boolean; size?: boolean }, cmd: Command) =>
    listCommand(await getRepoRoot(process.cwd()), {
      all: Boolean(options.all),
      json: Boolean(cmd.optsWithGlobals().json),
      size: Boolean(options.size),
    }),
  );

program
  .command("status <branch>")
  .description("Show sandbox state and dependency drift")
  .action(async (branch: string, _options: unknown, cmd: Command) =>
    statusCommand(await getRepoRoot(process.cwd()), branch, { json: Boolean(cmd.optsWithGlobals().json) }),
  );

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
  .action(async (branch: string, command: string[], options: { shell: boolean }) =>
    runCommand(await getRepoRoot(process.cwd()), branch, command, options.shell),
  );

program
  .command("doctor")
  .description("Compare the registry with Git worktrees")
  .option("--repair", "Remove registry entries whose worktrees no longer exist")
  .option("--adopt-orphans", "Register untracked sandbox worktrees")
  .option("--remove-orphans", "Force-remove untracked sandbox worktrees")
  .action(async (options) => doctorCommand(await getRepoRoot(process.cwd()), options));

program
  .command("sync <branch>")
  .description("Rebase or merge upstream changes into a sandbox")
  .option("--merge", "Use merge instead of rebase")
  .option("--from <upstream>", "Upstream branch (default: main)")
  .action(async (branch: string, options: { merge?: boolean; from?: string }) =>
    syncCommand(await getRepoRoot(process.cwd()), branch, { merge: Boolean(options.merge), from: options.from }),
  );

program
  .command("open <branch>")
  .description("Open a sandbox in your editor or file manager")
  .option("--editor <name>", "Editor to use (default: $EDITOR or code)")
  .option("--finder", "Open in file manager instead")
  .action(async (branch: string, options: { editor?: string; finder?: boolean }) =>
    openCommand(await getRepoRoot(process.cwd()), branch, { editor: options.editor, finder: Boolean(options.finder) }),
  );

program
  .command("which <branch>")
  .description("Print the sandbox directory path (for scripting)")
  .action(async (branch: string) => whichCommand(await getRepoRoot(process.cwd()), branch));

program
  .command("diff <branch>")
  .description("Show changes in a sandbox relative to main")
  .option("--stat", "Show diffstat summary only")
  .option("--from <base>", "Base branch to diff against (default: main)")
  .action(async (branch: string, options: { stat?: boolean; from?: string }) =>
    diffCommand(await getRepoRoot(process.cwd()), branch, { stat: Boolean(options.stat), from: options.from }),
  );

program
  .command("log <branch>")
  .description("Show commits in a sandbox not in main")
  .option("-n, --number <count>", "Limit number of commits")
  .option("--from <base>", "Base branch (default: main)")
  .action(async (branch: string, options: { number?: string; from?: string }) =>
    logCommand(await getRepoRoot(process.cwd()), branch, { number: options.number, from: options.from }),
  );

program
  .command("gc")
  .description("Remove sandboxes not accessed within a time threshold")
  .option("--older-than <duration>", "Duration threshold (e.g. 7d, 24h, 2w)", "7d")
  .option("--dry-run", "Show what would be removed without removing")
  .option("-f, --force", "Discard uncommitted changes in old sandboxes")
  .action(async (options: { olderThan: string; dryRun?: boolean; force?: boolean }) =>
    gcCommand(await getRepoRoot(process.cwd()), { olderThan: options.olderThan, dryRun: Boolean(options.dryRun), force: Boolean(options.force) }),
  );

program
  .command("init")
  .description("Create a .sandboxrc.json configuration file")
  .option("--shared <files...>", "Files to share with sandboxes")
  .action(async (options: { shared?: string[] }) =>
    initCommand(await getRepoRoot(process.cwd()), { shared: options.shared }),
  );

program
  .command("stash <branch>")
  .description("Stash or restore changes in a sandbox")
  .argument("[action]", "push, pop, or list", "push")
  .action(async (branch: string, action: string) =>
    stashCommand(await getRepoRoot(process.cwd()), branch, action),
  );

program
  .command("rename <old-branch> <new-branch>")
  .description("Rename a sandbox branch")
  .action(async (oldBranch: string, newBranch: string) =>
    renameCommand(await getRepoRoot(process.cwd()), oldBranch, newBranch),
  );

program
  .command("completion <shell>")
  .description("Output shell completion script (bash, zsh, or fish)")
  .action(async (shell: string) => completionCommand(shell));

program.parseAsync().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`wtx: ${message}`);
  process.exitCode = 1;
});
