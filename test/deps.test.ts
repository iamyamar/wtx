import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { linkDependencies } from "../src/core/deps.js";
import { temporaryDirectory } from "./helpers.js";

const cleanup: string[] = [];
afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })));
});

describe("dependency sharing", () => {
  it("uses a private reflink copy when available, otherwise documents symlink sharing", async () => {
    const root = await temporaryDirectory();
    cleanup.push(root);
    const main = path.join(root, "main");
    const sandbox = path.join(root, "sandbox");
    await fs.mkdir(path.join(main, "node_modules", "demo"), { recursive: true });
    await fs.mkdir(sandbox);
    const source = path.join(main, "node_modules", "demo", "value.txt");
    const target = path.join(sandbox, "node_modules", "demo", "value.txt");
    await fs.writeFile(source, "main");

    const strategy = await linkDependencies(main, sandbox);
    expect(["reflink", "symlink"]).toContain(strategy);
    await fs.writeFile(target, "sandbox");

    const sourceValue = await fs.readFile(source, "utf8");
    expect(sourceValue).toBe(strategy === "reflink" ? "main" : "sandbox");
  });
});
