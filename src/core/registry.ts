import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import lockfile from "proper-lockfile";
import { registryPath, sandboxRoot } from "./paths.js";
import type { Registry, SandboxRecord } from "../types.js";

async function ensureRegistryFile(): Promise<void> {
  await fs.mkdir(sandboxRoot(), { recursive: true });
  try {
    await fs.access(registryPath());
  } catch {
    await fs.writeFile(registryPath(), "{}\n", { encoding: "utf8", flag: "wx" }).catch(async (error: NodeJS.ErrnoException) => {
      if (error.code !== "EEXIST") throw error;
    });
  }
}

async function readRegistryFile(): Promise<Registry> {
  const raw = await fs.readFile(registryPath(), "utf8");
  try {
    const parsed: unknown = JSON.parse(raw || "{}");
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
      throw new Error("Registry must be a JSON object");
    }
    return parsed as Registry;
  } catch (error) {
    throw new Error(
      `Cannot read sandbox registry at ${registryPath()}: ${error instanceof Error ? error.message : String(error)}. ` +
        "Fix or restore the file before running another mutating command.",
    );
  }
}

async function writeRegistryFile(registry: Registry): Promise<void> {
  const file = registryPath();
  const temp = path.join(path.dirname(file), `.registry-${process.pid}-${crypto.randomUUID()}.tmp`);
  await fs.writeFile(temp, `${JSON.stringify(registry, null, 2)}\n`, "utf8");
  await fs.rename(temp, file);
}

export async function readRegistry(): Promise<Registry> {
  await ensureRegistryFile();
  return readRegistryFile();
}

/** Perform a complete read–mutate–write cycle under one cross-process lock. */
export async function withRegistry<T>(fn: (registry: Registry) => Promise<T> | T): Promise<T> {
  await ensureRegistryFile();
  const release = await lockfile.lock(registryPath(), {
    realpath: false,
    retries: { retries: 12, factor: 1.35, minTimeout: 20, maxTimeout: 500 },
    stale: 15_000,
  });

  try {
    const registry = await readRegistryFile();
    const result = await fn(registry);
    await writeRegistryFile(registry);
    return result;
  } finally {
    await release();
  }
}

export async function upsertSandbox(record: SandboxRecord): Promise<void> {
  await withRegistry((registry) => {
    registry[record.repoKey] ??= {};
    registry[record.repoKey][record.branch] = record;
  });
}

/**
 * Reserving a registry entry before creating a worktree makes concurrent
 * `create` requests for the same branch deterministic. A failed create removes
 * this reservation; `doctor` also reports abandoned reservations.
 */
export async function reserveSandbox(
  repoKey: string,
  branch: string,
  makeRecord: (registry: Registry) => Promise<SandboxRecord> | SandboxRecord,
): Promise<SandboxRecord> {
  return withRegistry(async (registry) => {
    const existing = registry[repoKey]?.[branch];
    if (existing) {
      const STALE_CREATING_MS = 5 * 60 * 1000;
      if (
        existing.state === "creating" &&
        Date.now() - new Date(existing.createdAt).getTime() > STALE_CREATING_MS
      ) {
        delete registry[repoKey]![branch];
      } else {
        throw new Error(
          `A sandbox for branch "${branch}" is already registered (state: ${existing.state}). ` +
            `Run \`wtx status ${branch}\` or \`wtx doctor --repair\`.`,
        );
      }
    }
    const record = await makeRecord(registry);
    registry[repoKey] ??= {};
    registry[repoKey][branch] = record;
    return record;
  });
}

export async function getSandbox(repoKey: string, branch: string): Promise<SandboxRecord | undefined> {
  const registry = await readRegistry();
  return registry[repoKey]?.[branch];
}

export async function removeSandbox(repoKey: string, branch: string): Promise<void> {
  await withRegistry((registry) => {
    delete registry[repoKey]?.[branch];
    if (registry[repoKey] && Object.keys(registry[repoKey]).length === 0) delete registry[repoKey];
  });
}

export async function touchSandbox(repoKey: string, branch: string): Promise<void> {
  await withRegistry((registry) => {
    const record = registry[repoKey]?.[branch];
    if (record) record.lastAccessed = new Date().toISOString();
  });
}
