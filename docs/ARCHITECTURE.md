# Architecture

## Why Git worktrees

The old pattern of launching commands with a manually selected `--git-dir` and `--work-tree` is fragile because Git's metadata, index, `HEAD`, and hooks were never designed to be independently managed that way. This tool delegates checkout creation and removal entirely to `git worktree`, so each sandbox has a real worktree-private `HEAD` and index while sharing Git's object database safely.

```text
ocs create feature/login
        |
        +-- resolve physical Git repository root
        +-- reserve { repoKey, branch, port } in locked registry (state: creating)
        +-- git worktree add [-b] ~/.opencode/sandboxes/<repoKey>/<branch-hash>
        +-- clone node_modules with reflink, or symlink it as explicit fallback
        +-- symlink approved repo-local shared files
        +-- snapshot package manifest + lockfiles
        +-- mark registry entry ready
        +-- optional shell with OPENCODE_SANDBOX=1 and PORT
```

`create` writes a short-lived `creating` entry before touching Git. That serializes duplicate branch requests and port assignment across processes. If creation fails, it removes that reservation and attempts Git cleanup. Any interrupted process is intentionally recoverable through `doctor` rather than relying on an unprovable transaction across Git, filesystem, and registry operations.

## Components

| Module | Responsibility |
| --- | --- |
| `core/paths.ts` | One sandbox root; collision-safe repository and branch directory names. |
| `core/registry.ts` | Locked, atomic state store; reservation and lifecycle updates. |
| `core/worktree.ts` | All Git interactions and porcelain parsing. |
| `core/deps.ts` | Dependency copy-on-write probe/copy, symlink fallback, package drift checks, shared config validation. |
| `core/ports.ts` | Deterministic candidate port with registry and local availability checks. |
| `core/shell.ts` | Interactive sandbox shell environment. |
| `commands/*` | User-facing orchestration only; no command writes the registry directly. |

## Registry

The registry is `~/.opencode/sandboxes/registry.json` by default. Its top-level key is not merely a repository basename: it is a readable basename plus a hash of the physical repository path. This prevents two unrelated folders named `api` from sharing state. Branch names are kept verbatim as map keys, while their directories use a readable sanitized name plus a branch hash; `feature/a` and `feature-a` therefore cannot collide.

Every mutation holds a `proper-lockfile` lock across read, mutation, and atomic temp-file rename. Readers always see either the old complete JSON document or the new complete document.

## Recovery model

`doctor` compares registered paths with `git worktree list --porcelain`, limited to the current repository's sandbox root.

- Default: report stale registry entries and orphaned worktrees only.
- `--repair`: remove stale registry entries (missing or no longer Git-recognized).
- `--adopt-orphans`: create ready registry records for attached orphaned worktrees.
- `--remove-orphans`: explicitly force-remove orphaned worktrees.

It never touches worktrees outside the computed sandbox root.

## Dependency behavior

On Linux, the tool probes `cp --reflink=always`; on macOS it probes `cp -cR`. The probe occurs on the actual main-repository filesystem, not by platform assumption. A successful reflink clone has private file inodes and copy-on-write storage. If unavailable, the tool creates a `node_modules` symlink and prints a warning: edits within dependencies alter the main checkout too. If the main checkout has no `node_modules`, no link is created.

The package manifest hash includes `package.json` and any detected npm, pnpm, Yarn, or Bun lockfile. `status` treats a hash difference as drift and recommends recreation.

## Port allocation boundary

The registry lock prevents two OCS sandboxes from selecting the same recorded port, and the allocator checks that the port is locally free. It cannot hold a listening socket until a user's application starts, so the port remains an advisory default; applications must still handle `EADDRINUSE` like any other development server.

## Deliberate scope boundary

This repository is a standalone CLI. An OpenCode slash command or VS Code extension should invoke this CLI rather than duplicate its registry/worktree logic. Their exact host APIs are product-specific and intentionally not guessed here.
