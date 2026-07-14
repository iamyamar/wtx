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
});
