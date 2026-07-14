export type DependencyStrategy = "reflink" | "symlink" | "pnpm-shared" | "none";
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
}

export interface WorktreeInfo {
  path: string;
  head?: string;
  branch?: string;
  detached: boolean;
  bare: boolean;
}
