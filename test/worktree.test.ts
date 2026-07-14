import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { execa } from "execa";
import { createWorktree, removeWorktree } from "../src/core/worktree.js";
import { initialiseRepo, temporaryDirectory } from "./helpers.js";

const cleanup: string[] = [];
afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })));
});

describe("Git worktree isolation", () => {
  it("creates independent branches without changing the main checkout index or HEAD", async () => {
    const repo = await temporaryDirectory();
    cleanup.push(repo);
    await initialiseRepo(repo);
    const first = path.join(repo, "..", "sandbox-one");
    const second = path.join(repo, "..", "sandbox-two");

    await Promise.all([
      createWorktree(repo, first, "feature/one"),
      createWorktree(repo, second, "feature/two"),
    ]);
    await fs.writeFile(path.join(first, "one.txt"), "one\n");
    await fs.writeFile(path.join(second, "two.txt"), "two\n");

    const mainStatus = await execa("git", ["status", "--porcelain"], { cwd: repo });
    const mainBranch = await execa("git", ["branch", "--show-current"], { cwd: repo });
    const firstStatus = await execa("git", ["status", "--porcelain"], { cwd: first });
    const secondStatus = await execa("git", ["status", "--porcelain"], { cwd: second });
    expect(mainStatus.stdout).toBe("");
    expect(mainBranch.stdout).toBe("main");
    expect(firstStatus.stdout).toContain("one.txt");
    expect(secondStatus.stdout).toContain("two.txt");

    await removeWorktree(repo, first, true);
    await removeWorktree(repo, second, true);
  });
});
