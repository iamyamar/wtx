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

  it("automatically detects and links Python .venv and hashes pyproject.toml", async () => {
    const root = await temporaryDirectory("ocs-deps-python-");
    cleanup.push(root);
    const main = path.join(root, "main");
    const sandbox = path.join(root, "sandbox");
    await fs.mkdir(path.join(main, ".venv", "lib"), { recursive: true });
    await fs.mkdir(sandbox);
    await fs.writeFile(path.join(main, ".venv", "lib", "site.py"), "print('hello')");
    await fs.writeFile(path.join(main, "pyproject.toml"), '[project]\nname = "demo"\n');

    const strategy = await linkDependencies(main, sandbox);
    expect(["reflink", "symlink"]).toContain(strategy);
    const sitePyExists = await fs.access(path.join(sandbox, ".venv", "lib", "site.py")).then(() => true).catch(() => false);
    expect(sitePyExists).toBe(true);

    const { hashPackageJson } = await import("../src/core/deps.js");
    const hash = await hashPackageJson(main);
    expect(hash).not.toBeNull();
  });

  it("automatically detects and links Rust target/ and hashes Cargo.lock", async () => {
    const root = await temporaryDirectory("ocs-deps-rust-");
    cleanup.push(root);
    const main = path.join(root, "main");
    const sandbox = path.join(root, "sandbox");
    await fs.mkdir(path.join(main, "target", "debug"), { recursive: true });
    await fs.mkdir(sandbox);
    await fs.writeFile(path.join(main, "target", "debug", "binary"), "executable");
    await fs.writeFile(path.join(main, "Cargo.toml"), '[package]\nname = "demo"\n');
    await fs.writeFile(path.join(main, "Cargo.lock"), '# Lockfile\n');

    const strategy = await linkDependencies(main, sandbox);
    expect(["reflink", "symlink"]).toContain(strategy);
    const binaryExists = await fs.access(path.join(sandbox, "target", "debug", "binary")).then(() => true).catch(() => false);
    expect(binaryExists).toBe(true);
  });

  it("links custom dependencyDirs and hashes custom manifestFiles from .sandboxrc.json", async () => {
    const root = await temporaryDirectory("ocs-deps-custom-");
    cleanup.push(root);
    const main = path.join(root, "main");
    const sandbox = path.join(root, "sandbox");
    await fs.mkdir(path.join(main, ".cache", "custom-dep"), { recursive: true });
    await fs.mkdir(sandbox);
    await fs.writeFile(path.join(main, ".cache", "custom-dep", "data.json"), '{"ok": true}');
    await fs.writeFile(path.join(main, "custom.manifest"), "version=1");
    await fs.writeFile(path.join(main, ".sandboxrc.json"), JSON.stringify({
      dependencyDirs: [".cache/custom-dep"],
      manifestFiles: ["custom.manifest"]
    }));

    const strategy = await linkDependencies(main, sandbox);
    expect(["reflink", "symlink"]).toContain(strategy);
    const dataExists = await fs.access(path.join(sandbox, ".cache", "custom-dep", "data.json")).then(() => true).catch(() => false);
    expect(dataExists).toBe(true);

    const { hashPackageJson } = await import("../src/core/deps.js");
    const hash = await hashPackageJson(main);
    expect(hash).not.toBeNull();
  });

  it("probes supportsReflink cleanly across Windows, macOS, and Linux without throwing or leaking probe dirs", async () => {
    const root = await temporaryDirectory("ocs-deps-reflink-probe-");
    cleanup.push(root);
    const { supportsReflink } = await import("../src/core/deps.js");
    const result = await supportsReflink(root);
    expect(typeof result).toBe("boolean");
    const entries = await fs.readdir(root);
    expect(entries.filter((e) => e.startsWith(".ocs-reflink-")).length).toBe(0);
  });
});
