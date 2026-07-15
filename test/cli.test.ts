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
    const root = await temporaryDirectory("wtx-cli-");
    cleanup.push(root);
    const repo = path.join(root, "repo");
    const registryHome = path.join(root, "registry");
    await fs.mkdir(repo);
    await initialiseRepo(repo);
    const cli = path.resolve("dist/cli.js");
    const options = { cwd: repo, env: { ...process.env, WTX_HOME: registryHome } };

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
    const root = await temporaryDirectory("wtx-");
    cleanup.push(root);
    const repo = path.join(root, "repo");
    const registryHome = path.join(root, "registry");
    await fs.mkdir(repo);
    await initialiseRepo(repo);
    const cli = path.resolve("dist/cli.js");
    const env = { ...process.env, WTX_HOME: registryHome };

    await execa(process.execPath, [cli, "create", "worktree/list", "--no-shell", "--no-port"], { cwd: repo, env });

    const listing = await execa(process.execPath, [cli, "list"], { cwd: repo, env });
    expect(listing.stdout).toContain("worktree/list");
  });

  it("refreshes a sandbox", async () => {
    const root = await temporaryDirectory("wtx-");
    cleanup.push(root);
    const repo = path.join(root, "repo");
    const registryHome = path.join(root, "registry");
    await fs.mkdir(repo);
    await initialiseRepo(repo);
    const cli = path.resolve("dist/cli.js");
    const env = { ...process.env, WTX_HOME: registryHome };

    await execa(process.execPath, [cli, "create", "feature/refresh", "--no-shell", "--no-port"], { cwd: repo, env });
    const result = await execa(process.execPath, [cli, "refresh", "feature/refresh"], { cwd: repo, env });
    expect(result.stdout).toContain("Refreshed");
  });

  it("runs a command inside a sandbox", async () => {
    const root = await temporaryDirectory("wtx-");
    cleanup.push(root);
    const repo = path.join(root, "repo");
    const registryHome = path.join(root, "registry");
    await fs.mkdir(repo);
    await initialiseRepo(repo);
    const cli = path.resolve("dist/cli.js");
    const env = { ...process.env, WTX_HOME: registryHome };

    await execa(process.execPath, [cli, "create", "feature/run", "--no-shell", "--no-port"], { cwd: repo, env });
    const result = await execa(process.execPath, [cli, "run", "feature/run", "echo", "hello-from-sandbox"], { cwd: repo, env });
    expect(result.stdout).toContain("hello-from-sandbox");
  });

  it("runs a command with sandbox environment variables", async () => {
    const root = await temporaryDirectory("wtx-");
    cleanup.push(root);
    const repo = path.join(root, "repo");
    const registryHome = path.join(root, "registry");
    await fs.mkdir(repo);
    await initialiseRepo(repo);
    const cli = path.resolve("dist/cli.js");
    const env = { ...process.env, WTX_HOME: registryHome };

    await execa(process.execPath, [cli, "create", "feature/runenv", "--no-shell", "--no-port"], { cwd: repo, env });
    const result = await execa(process.execPath, [cli, "run", "feature/runenv", "--", "sh", "-c", "echo branch=$WTX_SANDBOX_BRANCH sandbox=$WTX_SANDBOX"], { cwd: repo, env });
    expect(result.stdout).toContain("branch=feature/runenv");
    expect(result.stdout).toContain("sandbox=1");
  });

  it("prunes all sandboxes", async () => {
    const root = await temporaryDirectory("wtx-");
    cleanup.push(root);
    const repo = path.join(root, "repo");
    const registryHome = path.join(root, "registry");
    await fs.mkdir(repo);
    await initialiseRepo(repo);
    const cli = path.resolve("dist/cli.js");
    const env = { ...process.env, WTX_HOME: registryHome };

    await execa(process.execPath, [cli, "create", "feature/a", "--no-shell", "--no-port"], { cwd: repo, env });
    await execa(process.execPath, [cli, "create", "feature/b", "--no-shell", "--no-port"], { cwd: repo, env });

    const listBefore = await execa(process.execPath, [cli, "list"], { cwd: repo, env });
    expect(listBefore.stdout).toContain("feature/a");
    expect(listBefore.stdout).toContain("feature/b");

    await execa(process.execPath, [cli, "prune", "--force"], { cwd: repo, env });

    const listAfter = await execa(process.execPath, [cli, "list"], { cwd: repo, env });
    expect(listAfter.stdout).toContain("No sandboxes");
  });

  it("create rejects a branch already checked out", async () => {
    const root = await temporaryDirectory("wtx-");
    cleanup.push(root);
    const repo = path.join(root, "repo");
    const registryHome = path.join(root, "registry");
    await fs.mkdir(repo);
    await initialiseRepo(repo);
    const cli = path.resolve("dist/cli.js");
    const env = { ...process.env, WTX_HOME: registryHome };

    await execa("git", ["checkout", "-b", "already-checked-out"], { cwd: repo });
    await expect(
      execa(process.execPath, [cli, "create", "already-checked-out", "--no-shell", "--no-port"], { cwd: repo, env }),
    ).rejects.toThrow("already checked out in another worktree");
  });

  it("create with --from branches from a specific ref", async () => {
    const root = await temporaryDirectory("wtx-");
    cleanup.push(root);
    const repo = path.join(root, "repo");
    const registryHome = path.join(root, "registry");
    await fs.mkdir(repo);
    await initialiseRepo(repo);
    const cli = path.resolve("dist/cli.js");
    const env = { ...process.env, WTX_HOME: registryHome };

    await fs.writeFile(path.join(repo, "base.txt"), "base content");
    await execa("git", ["add", "base.txt"], { cwd: repo });
    await execa("git", ["commit", "-m", "add base.txt"], { cwd: repo });
    await execa("git", ["branch", "base-branch"], { cwd: repo });

    await fs.writeFile(path.join(repo, "main.txt"), "main content");
    await execa("git", ["add", "main.txt"], { cwd: repo });
    await execa("git", ["commit", "-m", "add main.txt"], { cwd: repo });

    await execa(process.execPath, [cli, "create", "feature/from-test", "--no-shell", "--no-port", "--from", "base-branch"], { cwd: repo, env });
    const which = await execa(process.execPath, [cli, "which", "feature/from-test"], { cwd: repo, env });
    const sandboxDir = which.stdout.trim();
    const exists = await fs.access(path.join(sandboxDir, "base.txt")).then(() => true).catch(() => false);
    const mainExists = await fs.access(path.join(sandboxDir, "main.txt")).then(() => true).catch(() => false);
    expect(exists).toBe(true);
    expect(mainExists).toBe(false);
  });

  it("enter sets exit code 1 for missing branch", async () => {
    const root = await temporaryDirectory("wtx-");
    cleanup.push(root);
    const repo = path.join(root, "repo");
    const registryHome = path.join(root, "registry");
    await fs.mkdir(repo);
    await initialiseRepo(repo);
    const cli = path.resolve("dist/cli.js");
    const env = { ...process.env, WTX_HOME: registryHome };

    const result = await execa(process.execPath, [cli, "enter", "non-existent"], { cwd: repo, env, reject: false });
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain("No sandbox registered");
  });

  it("sync rebases a sandbox onto main", async () => {
    const root = await temporaryDirectory("wtx-");
    cleanup.push(root);
    const repo = path.join(root, "repo");
    const registryHome = path.join(root, "registry");
    await fs.mkdir(repo);
    await initialiseRepo(repo);
    const cli = path.resolve("dist/cli.js");
    const env = { ...process.env, WTX_HOME: registryHome };

    await execa(process.execPath, [cli, "create", "feature/sync", "--no-shell", "--no-port"], { cwd: repo, env });
    await fs.writeFile(path.join(repo, "new-on-main.txt"), "new content");
    await execa("git", ["add", "new-on-main.txt"], { cwd: repo });
    await execa("git", ["commit", "-m", "add new-on-main"], { cwd: repo });

    const sync = await execa(process.execPath, [cli, "sync", "feature/sync"], { cwd: repo, env });
    expect(sync.stdout).toContain("synced with main");
  });

  it("which prints the sandbox path", async () => {
    const root = await temporaryDirectory("wtx-");
    cleanup.push(root);
    const repo = path.join(root, "repo");
    const registryHome = path.join(root, "registry");
    await fs.mkdir(repo);
    await initialiseRepo(repo);
    const cli = path.resolve("dist/cli.js");
    const env = { ...process.env, WTX_HOME: registryHome };

    await execa(process.execPath, [cli, "create", "feature/which", "--no-shell", "--no-port"], { cwd: repo, env });
    const result = await execa(process.execPath, [cli, "which", "feature/which"], { cwd: repo, env });
    expect(result.stdout.trim()).toContain("feature-which");
  });

  it("gc removes old sandboxes", async () => {
    const root = await temporaryDirectory("wtx-");
    cleanup.push(root);
    const repo = path.join(root, "repo");
    const registryHome = path.join(root, "registry");
    await fs.mkdir(repo);
    await initialiseRepo(repo);
    const cli = path.resolve("dist/cli.js");
    const env = { ...process.env, WTX_HOME: registryHome };

    await execa(process.execPath, [cli, "create", "feature/gc", "--no-shell", "--no-port"], { cwd: repo, env });
    // gc with older-than 0m removes anything not accessed right now
    await execa(process.execPath, [cli, "gc", "--older-than", "0m", "--force"], { cwd: repo, env });
    const list = await execa(process.execPath, [cli, "list"], { cwd: repo, env });
    expect(list.stdout).toContain("No sandboxes");
  });

  it("gc --dry-run does not remove anything", async () => {
    const root = await temporaryDirectory("wtx-");
    cleanup.push(root);
    const repo = path.join(root, "repo");
    const registryHome = path.join(root, "registry");
    await fs.mkdir(repo);
    await initialiseRepo(repo);
    const cli = path.resolve("dist/cli.js");
    const env = { ...process.env, WTX_HOME: registryHome };

    await execa(process.execPath, [cli, "create", "feature/gc-dry", "--no-shell", "--no-port"], { cwd: repo, env });
    const gc = await execa(process.execPath, [cli, "gc", "--older-than", "0m", "--dry-run"], { cwd: repo, env });
    expect(gc.stdout).toContain("Would remove");
    const list = await execa(process.execPath, [cli, "list"], { cwd: repo, env });
    expect(list.stdout).toContain("feature/gc-dry");
  });

  it("init creates .sandboxrc.json", async () => {
    const root = await temporaryDirectory("wtx-");
    cleanup.push(root);
    const repo = path.join(root, "repo");
    await fs.mkdir(repo);
    await initialiseRepo(repo);
    const cli = path.resolve("dist/cli.js");

    await execa(process.execPath, [cli, "init"], { cwd: repo });
    const exists = await fs.access(path.join(repo, ".sandboxrc.json")).then(() => true).catch(() => false);
    expect(exists).toBe(true);
  });

  it("rename updates the branch name", async () => {
    const root = await temporaryDirectory("wtx-");
    cleanup.push(root);
    const repo = path.join(root, "repo");
    const registryHome = path.join(root, "registry");
    await fs.mkdir(repo);
    await initialiseRepo(repo);
    const cli = path.resolve("dist/cli.js");
    const env = { ...process.env, WTX_HOME: registryHome };

    await execa(process.execPath, [cli, "create", "feature/old", "--no-shell", "--no-port"], { cwd: repo, env });
    await execa(process.execPath, [cli, "rename", "feature/old", "feature/new"], { cwd: repo, env });
    const list = await execa(process.execPath, [cli, "list"], { cwd: repo, env });
    expect(list.stdout).not.toContain("feature/old");
    expect(list.stdout).toContain("feature/new");
  });

  it("stash push and pop work inside a sandbox", async () => {
    const root = await temporaryDirectory("wtx-");
    cleanup.push(root);
    const repo = path.join(root, "repo");
    const registryHome = path.join(root, "registry");
    await fs.mkdir(repo);
    await initialiseRepo(repo);
    const cli = path.resolve("dist/cli.js");
    const env = { ...process.env, WTX_HOME: registryHome };

    await execa(process.execPath, [cli, "create", "feature/stash", "--no-shell", "--no-port"], { cwd: repo, env });
    const which = await execa(process.execPath, [cli, "which", "feature/stash"], { cwd: repo, env });
    const sandboxDir = which.stdout.trim();
    await fs.writeFile(path.join(sandboxDir, "stashed.txt"), "stashed content");

    await execa(process.execPath, [cli, "stash", "feature/stash", "push"], { cwd: repo, env });
    const stashedExists = await fs.access(path.join(sandboxDir, "stashed.txt")).then(() => true).catch(() => false);
    expect(stashedExists).toBe(false);

    await execa(process.execPath, [cli, "stash", "feature/stash", "pop"], { cwd: repo, env });
    const poppedExists = await fs.access(path.join(sandboxDir, "stashed.txt")).then(() => true).catch(() => false);
    expect(poppedExists).toBe(true);
  });

  it("list --json outputs valid JSON", async () => {
    const root = await temporaryDirectory("wtx-");
    cleanup.push(root);
    const repo = path.join(root, "repo");
    const registryHome = path.join(root, "registry");
    await fs.mkdir(repo);
    await initialiseRepo(repo);
    const cli = path.resolve("dist/cli.js");
    const env = { ...process.env, WTX_HOME: registryHome };

    await execa(process.execPath, [cli, "create", "feature/json", "--no-shell", "--no-port"], { cwd: repo, env });
    const list = await execa(process.execPath, [cli, "list", "--json"], { cwd: repo, env });
    const parsed = JSON.parse(list.stdout);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0].branch).toBe("feature/json");
  });

  it("list shows missing directories", async () => {
    const root = await temporaryDirectory("wtx-");
    cleanup.push(root);
    const repo = path.join(root, "repo");
    const registryHome = path.join(root, "registry");
    await fs.mkdir(repo);
    await initialiseRepo(repo);
    const cli = path.resolve("dist/cli.js");
    const env = { ...process.env, WTX_HOME: registryHome };

    await execa(process.execPath, [cli, "create", "feature/missing", "--no-shell", "--no-port"], { cwd: repo, env });
    const which = await execa(process.execPath, [cli, "which", "feature/missing"], { cwd: repo, env });
    await fs.rm(which.stdout.trim(), { recursive: true, force: true });

    const list = await execa(process.execPath, [cli, "list"], { cwd: repo, env });
    expect(list.stdout).toContain("missing");
  });
});
