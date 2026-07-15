import fs from "node:fs/promises";
import { afterEach, describe, expect, it } from "vitest";
import { readRegistry, upsertSandbox } from "../src/core/registry.js";
import type { SandboxRecord } from "../src/types.js";
import { temporaryDirectory } from "./helpers.js";

let registryHome: string | undefined;
afterEach(async () => {
  delete process.env.WTX_HOME;
  if (registryHome) await fs.rm(registryHome, { recursive: true, force: true });
  registryHome = undefined;
});

describe("registry locking", () => {
  it("preserves concurrent upserts", async () => {
    registryHome = await temporaryDirectory("wtx-registry-");
    process.env.WTX_HOME = registryHome;
    const now = new Date().toISOString();
    const recordFor = (branch: string): SandboxRecord => ({
      repo: "demo",
      repoKey: "demo-key",
      branch,
      path: `/tmp/${branch}`,
      mainRepoPath: "/tmp/demo",
      createdAt: now,
      lastAccessed: now,
      depsStrategy: "none",
      port: null,
      packageJsonHash: null,
      state: "ready",
    });

    await Promise.all(Array.from({ length: 10 }, (_, index) => upsertSandbox(recordFor(`feature-${index}`))));
    const registry = await readRegistry();
    expect(Object.keys(registry["demo-key"])).toHaveLength(10);
  });
});
