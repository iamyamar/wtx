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
  delete process.env.OPENCODE_SANDBOX_HOME;
  if (root) await fs.rm(root, { recursive: true, force: true });
  root = undefined;
});

describe("doctor", () => {
  it("cleans a registry entry after its sandbox directory was manually deleted", async () => {
    root = await temporaryDirectory("ocs-doctor-");
    const repo = path.join(root, "repo");
    await fs.mkdir(repo);
    await initialiseRepo(repo);
    process.env.OPENCODE_SANDBOX_HOME = path.join(root, "registry");
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
});
