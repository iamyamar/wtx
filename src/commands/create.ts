import chalk from "chalk";
import { checkDrift, dependencyWarning, hashPackageJson, linkDependencies, linkSharedConfig, readSandboxConfig, readFullConfig } from "../core/deps.js";
import { sandboxPath, repositoryKey } from "../core/paths.js";
import { allocatePort } from "../core/ports.js";
import { removeSandbox, reserveSandbox, upsertSandbox } from "../core/registry.js";
import { openSandboxShell } from "../core/shell.js";
import { branchIsCheckedOutElsewhere, createWorktree, getRepoName, getRepoRoot, pruneWorktrees, removeWorktree } from "../core/worktree.js";
import { runHook } from "../core/hooks.js";
import type { DependencyStrategy, SandboxRecord } from "../types.js";

export interface CreateOptions {
  shell: boolean;
  port: boolean;
  from?: string;
  hooks: boolean;
}

function registeredPorts(registry: Record<string, Record<string, SandboxRecord>>): number[] {
  return Object.values(registry)
    .flatMap((repositories) => Object.values(repositories))
    .flatMap((record) => (record.port === null ? [] : [record.port]));
}

export async function createCommand(branch: string, options: CreateOptions): Promise<void> {
  const mainRepoPath = await getRepoRoot(process.cwd());

  // Guard: prevent checking out a branch that's already in use
  if (await branchIsCheckedOutElsewhere(mainRepoPath, branch)) {
    throw new Error(
      `Branch "${branch}" is already checked out in another worktree. Use a different branch name or detach it first.`,
    );
  }

  const repoName = await getRepoName(mainRepoPath);
  const repoKey = repositoryKey(mainRepoPath);
  const dir = sandboxPath(repoKey, branch);
  const now = new Date().toISOString();

  // Read config for port range
  const fullConfig = await readFullConfig(mainRepoPath);

  const reservation = await reserveSandbox(repoKey, branch, async (registry) => ({
    repo: repoName,
    repoKey,
    branch,
    path: dir,
    mainRepoPath,
    createdAt: now,
    lastAccessed: now,
    depsStrategy: "none",
    port: options.port ? await allocatePort(branch, registeredPorts(registry), fullConfig.portRange) : null,
    packageJsonHash: null,
    state: "creating",
  }));

  let worktreeCreated = false;
  try {
    console.log(chalk.cyan(`Creating sandbox for ${branch}…`));
    await createWorktree(mainRepoPath, dir, branch, options.from);
    worktreeCreated = true;

    const depsStrategy = await linkDependencies(mainRepoPath, dir);
    const sharedFiles = await readSandboxConfig(mainRepoPath);
    const linkedFiles = await linkSharedConfig(mainRepoPath, dir, sharedFiles);
    const completeRecord: SandboxRecord = {
      ...reservation,
      depsStrategy,
      packageJsonHash: await hashPackageJson(mainRepoPath),
      state: "ready",
      lastAccessed: new Date().toISOString(),
    };
    await upsertSandbox(completeRecord);

    const portDescription = completeRecord.port === null ? "no port allocated" : `port ${completeRecord.port}`;
    console.log(chalk.green(`Sandbox ready: ${dir} (${portDescription}, deps: ${depsStrategy}).`));
    if (linkedFiles.length) console.log(`Shared config: ${linkedFiles.join(", ")}`);
    const warning = dependencyWarning(depsStrategy);
    if (warning) console.log(chalk.yellow(warning));
    if (await checkDrift(mainRepoPath, completeRecord.packageJsonHash)) {
      console.log(chalk.yellow("Dependencies changed while the sandbox was being created; run `ocs status` before using it."));
    }

    // Run post-create hook
    if (options.hooks) {
      await runHook(mainRepoPath, "postCreate", dir, branch);
    }

    if (options.shell) await openSandboxShell(dir, branch, completeRecord.port);
  } catch (error) {
    if (worktreeCreated) {
      await removeWorktree(mainRepoPath, dir, true).catch(() => undefined);
      await pruneWorktrees(mainRepoPath).catch(() => undefined);
    }
    await removeSandbox(repoKey, branch).catch(() => undefined);
    throw error;
  }
}
