export type DependencyStrategy = "reflink" | "symlink" | "none";
export type SandboxState = "creating" | "ready";

export interface SandboxRecord {
  /** Human-readable repository name, used only for display. */
  repo: string;
  /** Stable ID derived from the canonical repository path. */
  repoKey: string;
  branch: string;
  path: string;
  mainRepoPath: string;
  createdAt: string;
  lastAccessed: string;
  depsStrategy: DependencyStrategy;
  port: number | null;
  packageJsonHash: string | null;
  state: SandboxState;
}

export type Registry = Record<string, Record<string, SandboxRecord>>;

export interface SandboxConfig {
  /** Ignored files or directories to expose to a sandbox by symlink. */
  sharedFiles?: string[];
  /** Ignored dependency/build directories to copy/symlink from main repo to worktrees (e.g. node_modules, .venv, target). */
  dependencyDirs?: string[];
  /** Manifest or lock files to hash for drift detection (e.g. package.json, pyproject.toml, Cargo.lock). */
  manifestFiles?: string[];
  /** Port allocation range. */
  portRange?: { min: number; max: number };
  /** Lifecycle hooks. */
  hooks?: {
    postCreate?: string;
    preDestroy?: string;
  };
}

export interface WorktreeInfo {
  path: string;
  head?: string;
  branch?: string;
  detached: boolean;
  bare: boolean;
}
