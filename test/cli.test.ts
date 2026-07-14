import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { execa } from "execa";
import { initialiseRepo, temporaryDirectory } from "./helpers.js";

const cleanup: string[] = [];
afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })));
});

describe("CLI", () => {
  it("creates, inspects, and removes a sandbox without entering a shell", async () => {
    const root = await temporaryDirectory("ocs-cli-");
    cleanup.push(root);
    const repo = path.join(root, "repo");
    const registryHome = path.join(root, "registry");
    await fs.mkdir(repo);
    await initialiseRepo(repo);
    const cli = path.resolve("dist/cli.js");
    const options = { cwd: repo, env: { ...process.env, OPENCODE_SANDBOX_HOME: registryHome } };

    const create = await execa(process.execPath, [cli, "create", "feature/cli", "--no-shell", "--no-port"], options);
    expect(create.stdout).toContain("Sandbox ready");
    const status = await execa(process.execPath, [cli, "status", "feature/cli"], options);
    expect(status.stdout).toContain("current");
    const listing = await execa(process.execPath, [cli, "list"], options);
    expect(listing.stdout).toContain("feature/cli");
    const destroy = await execa(process.execPath, [cli, "destroy", "feature/cli"], options);
    expect(destroy.stdout).toContain("destroyed");
  });

  it("lists commands from inside a worktree (getRepoRoot fix)", async () => {
    const root = await temporaryDirectory("ocs-");
    cleanup.push(root);
    const repo = path.join(root, "repo");
    const registryHome = path.join(root, "registry");
    await fs.mkdir(repo);
    await initialiseRepo(repo);
    const cli = path.resolve("dist/cli.js");
    const env = { ...process.env, OPENCODE_SANDBOX_HOME: registryHome };

    await execa(process.execPath, [cli, "create", "worktree/list", "--no-shell", "--no-port"], { cwd: repo, env });

    const listing = await execa(process.execPath, [cli, "list"], { cwd: repo, env });
    expect(listing.stdout).toContain("worktree/list");
  });

  it("refreshes a sandbox", async () => {
    const root = await temporaryDirectory("ocs-");
    cleanup.push(root);
    const repo = path.join(root, "repo");
    const registryHome = path.join(root, "registry");
    await fs.mkdir(repo);
    await initialiseRepo(repo);
    const cli = path.resolve("dist/cli.js");
    const env = { ...process.env, OPENCODE_SANDBOX_HOME: registryHome };

    await execa(process.execPath, [cli, "create", "feature/refresh", "--no-shell", "--no-port"], { cwd: repo, env });
    const result = await execa(process.execPath, [cli, "refresh", "feature/refresh"], { cwd: repo, env });
    expect(result.stdout).toContain("Refreshed");
  });

  it("runs a command inside a sandbox", async () => {
    const root = await temporaryDirectory("ocs-");
    cleanup.push(root);
    const repo = path.join(root, "repo");
    const registryHome = path.join(root, "registry");
    await fs.mkdir(repo);
    await initialiseRepo(repo);
    const cli = path.resolve("dist/cli.js");
    const env = { ...process.env, OPENCODE_SANDBOX_HOME: registryHome };

    await execa(process.execPath, [cli, "create", "feature/run", "--no-shell", "--no-port"], { cwd: repo, env });
    const result = await execa(process.execPath, [cli, "run", "feature/run", "echo", "hello-from-sandbox"], { cwd: repo, env });
    expect(result.stdout).toContain("hello-from-sandbox");
  });

  it("runs a command with sandbox environment variables", async () => {
    const root = await temporaryDirectory("ocs-");
    cleanup.push(root);
    const repo = path.join(root, "repo");
    const registryHome = path.join(root, "registry");
    await fs.mkdir(repo);
    await initialiseRepo(repo);
    const cli = path.resolve("dist/cli.js");
    const env = { ...process.env, OPENCODE_SANDBOX_HOME: registryHome };

    await execa(process.execPath, [cli, "create", "feature/runenv", "--no-shell", "--no-port"], { cwd: repo, env });
    const result = await execa(process.execPath, [cli, "run", "feature/runenv", "--", "sh", "-c", "echo branch=$OPENCODE_SANDBOX_BRANCH sandbox=$OPENCODE_SANDBOX"], { cwd: repo, env });
    expect(result.stdout).toContain("branch=feature/runenv");
    expect(result.stdout).toContain("sandbox=1");
  });

  it("prunes all sandboxes", async () => {
    const root = await temporaryDirectory("ocs-");
    cleanup.push(root);
    const repo = path.join(root, "repo");
    const registryHome = path.join(root, "registry");
    await fs.mkdir(repo);
    await initialiseRepo(repo);
    const cli = path.resolve("dist/cli.js");
    const env = { ...process.env, OPENCODE_SANDBOX_HOME: registryHome };

    await execa(process.execPath, [cli, "create", "feature/a", "--no-shell", "--no-port"], { cwd: repo, env });
    await execa(process.execPath, [cli, "create", "feature/b", "--no-shell", "--no-port"], { cwd: repo, env });

    const listBefore = await execa(process.execPath, [cli, "list"], { cwd: repo, env });
    expect(listBefore.stdout).toContain("feature/a");
    expect(listBefore.stdout).toContain("feature/b");

    await execa(process.execPath, [cli, "prune", "--force"], { cwd: repo, env });

    const listAfter = await execa(process.execPath, [cli, "list"], { cwd: repo, env });
    expect(listAfter.stdout).toContain("No sandboxes");
  });
});
