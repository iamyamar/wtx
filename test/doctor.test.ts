import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { doctorCommand } from "../src/commands/doctor.js";
import { repoSandboxDir, repositoryKey } from "../src/core/paths.js";
import { readRegistry, upsertSandbox } from "../src/core/registry.js";
import { createWorktree } from "../src/core/worktree.js";
import type { SandboxRecord } from "../src/types.js";
import { initialiseRepo, temporaryDirectory } from "./helpers.js";

let root: string | undefined;
afterEach(async () => {
  vi.restoreAllMocks();
  delete process.env.WTX_HOME;
  if (root) await fs.rm(root, { recursive: true, force: true });
  root = undefined;
});

describe("doctor", () => {
  it("cleans a registry entry after its sandbox directory was manually deleted", async () => {
    root = await temporaryDirectory("wtx-doctor-");
    const repo = path.join(root, "repo");
    await fs.mkdir(repo);
    await initialiseRepo(repo);
    process.env.WTX_HOME = path.join(root, "registry");
    const repoKey = repositoryKey(repo);
    const sandbox = path.join(repoSandboxDir(repoKey), "lost-worktree");
    await createWorktree(repo, sandbox, "feature/lost");
    const now = new Date().toISOString();
    const record: SandboxRecord = {
      repo: "repo",
      repoKey,
      branch: "feature/lost",
      path: sandbox,
      mainRepoPath: repo,
      createdAt: now,
      lastAccessed: now,
      depsStrategy: "none",
      port: null,
      packageJsonHash: null,
      state: "ready",
    };
    await upsertSandbox(record);
    await fs.rm(sandbox, { recursive: true, force: true });

    await doctorCommand(repo, { repair: true, adoptOrphans: false, removeOrphans: false });
    expect((await readRegistry())[repoKey]?.["feature/lost"]).toBeUndefined();
  });

  it("registers untracked sandbox worktrees when using --adopt-orphans", async () => {
    root = await temporaryDirectory("wtx-doctor-");
    const repo = path.join(root, "repo");
    await fs.mkdir(repo);
    await initialiseRepo(repo);
    process.env.WTX_HOME = path.join(root, "registry");
    const repoKey = repositoryKey(repo);
    const sandbox = path.join(repoSandboxDir(repoKey), "orphan-worktree");
    await createWorktree(repo, sandbox, "feature/orphan");

    await doctorCommand(repo, { repair: false, adoptOrphans: true, removeOrphans: false });
    const registry = await readRegistry();
    expect(registry[repoKey]?.["feature/orphan"]).toBeDefined();
  });

  it("removes untracked sandbox worktrees when using --remove-orphans", async () => {
    root = await temporaryDirectory("wtx-doctor-");
    const repo = path.join(root, "repo");
    await fs.mkdir(repo);
    await initialiseRepo(repo);
    process.env.WTX_HOME = path.join(root, "registry");
    const repoKey = repositoryKey(repo);
    const sandbox = path.join(repoSandboxDir(repoKey), "unwanted-orphan");
    await createWorktree(repo, sandbox, "feature/unwanted");

    await doctorCommand(repo, { repair: false, adoptOrphans: false, removeOrphans: true });
    const exists = await fs.access(sandbox).then(() => true).catch(() => false);
    expect(exists).toBe(false);
  });
});
