# opencode-sandbox

`opencode-sandbox` (or `ocs`) creates isolated Git worktrees for feature work without copying an entire repository. It can reuse `node_modules` through filesystem copy-on-write clones where supported, otherwise through an explicit symlink fallback.

## Install and run

```sh
pnpm install
pnpm build
pnpm link --global

# Run from inside a Git repository
ocs create feature/login
ocs list
ocs status feature/login
ocs destroy feature/login
```

For scripts and CI, prevent the interactive subshell:

```sh
ocs create feature/login --no-shell
```

Each sandbox receives a deterministic, currently-free `PORT` in the 3000–4200 range. Pass `--no-port` if the project does not use one.

## Commands

| Command | Purpose |
| --- | --- |
| `ocs create <branch>` | Create/reuse a local branch in a new Git worktree and enter it. |
| `ocs destroy <branch>` | Remove a registered sandbox; preserves uncommitted changes unless `--force` is supplied. |
| `ocs list` | Show sandboxes belonging to the current repository. |
| `ocs status <branch>` | Report directory state and package/lockfile drift. |
| `ocs doctor` | Report registry/worktree mismatches. |
| `ocs doctor --repair` | Remove stale registry records only. |
| `ocs doctor --adopt-orphans` | Register untracked sandbox worktrees. |
| `ocs doctor --remove-orphans` | Explicitly force-remove untracked sandbox worktrees. |

## Shared configuration

By default, a sandbox exposes these ignored files from the main checkout with symlinks when they exist:

```text
.env
.env.local
.vscode/settings.json
```

Override that list in the main repository's `.sandboxrc.json`:

```json
{
  "sharedFiles": [".env.local", "config/dev.json"]
}
```

Entries must be repository-relative paths; absolute paths and paths that escape the repository are rejected.

## Design and safety notes

- Git worktrees are the isolation boundary. This avoids the shared `HEAD` and index corruption caused by mixing `--git-dir` and `--work-tree` manually.
- State is held at `~/.opencode/sandboxes/registry.json`, protected by a cross-process lock and atomic writes. Set `OPENCODE_SANDBOX_HOME` for isolated testing.
- Sandbox paths include hashes. `feature/a` cannot collide with `feature-a`, and two repositories named `api` have different sandbox roots.
- On Linux the tool probes `cp --reflink=always`; on macOS it probes BSD `cp -cR`. It falls back to a dependency symlink if clone-on-write is unavailable. The CLI clearly warns that a symlinked `node_modules` is shared and editable by both checkouts.
- `doctor` is conservative by default: it only reports discrepancies. Repair and destructive actions require explicit flags.

## Development

```sh
pnpm typecheck
pnpm test
pnpm build
```

Tests create disposable local Git repositories and require Git to be installed.
