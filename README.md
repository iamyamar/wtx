# opencode-sandbox (`ocs`)

`opencode-sandbox` (or `ocs`) creates isolated Git worktrees for feature work without copying an entire repository. It can reuse `node_modules` through filesystem copy-on-write clones where supported (`reflink`), otherwise through an explicit symlink fallback.

## Features at a glance

- **Zero-Copy Worktrees**: Create isolated environments in seconds using `git worktree`.
- **Intelligent Dependency Sharing**: Auto-probes filesystem capabilities for copy-on-write (`reflink` on Linux/macOS APFS) or safe symlinking.
- **Drift Detection**: Detects lockfile/package manifest drift between main repository and sandboxes.
- **Port Allocation**: Automatically reserves deterministic, conflict-free `PORT` values for your dev servers.
- **Lifecycle Hooks**: Run custom scripts on `postCreate` and `preDestroy`.
- **Shell & Scripting Friendly**: Full `bash`/`zsh`/`fish` prompt integration and JSON-structured output (`--json`) for CI pipelines.

## Installation & Setup

```sh
pnpm install
pnpm build
pnpm link --global

# Or run directly via npx / tsx
ocs --help
```

### Shell Completions

Generate and load completions for your shell (`bash`, `zsh`, or `fish`):

```sh
# Bash (~/.bashrc)
eval "$(ocs completion bash)"

# Zsh (~/.zshrc)
eval "$(ocs completion zsh)"

# Fish (~/.config/fish/config.fish)
ocs completion fish | source
```

## Commands Reference

| Command | Description | Key Options |
| --- | --- | --- |
| `ocs create <branch>` | Create a sandbox and open a shell in it | `--no-shell`, `--no-port`, `--from <base>`, `--no-hooks` |
| `ocs destroy <branch>` | Remove a sandbox worktree | `-f, --force`, `--no-hooks` |
| `ocs list` | List registered sandboxes for this repository | `-a, --all`, `--size`, `--json` |
| `ocs status <branch>` | Show sandbox state and dependency drift | `--json` |
| `ocs enter <branch>` | Open an interactive shell in an existing sandbox | |
| `ocs sync <branch>` | Rebase or merge upstream changes into a sandbox | `--merge`, `--from <upstream>` |
| `ocs open <branch>` | Open a sandbox in your editor or file manager | `--editor <name>`, `--finder` |
| `ocs which <branch>` | Print the sandbox directory path (for scripts/subshells) | |
| `ocs diff <branch>` | Show changes relative to main | `--stat`, `--from <base>` |
| `ocs log <branch>` | Show commits in a sandbox not in main | `-n, --number <count>`, `--from <base>` |
| `ocs stash <branch> [action]` | Stash or restore changes in a sandbox (`push`, `pop`, `list`) | |
| `ocs rename <old> <new>` | Rename a sandbox branch and update the registry | |
| `ocs refresh <branch>` | Re-link dependencies and shared config | |
| `ocs run <branch> <cmd...>` | Run a command inside a sandbox worktree | `-s, --shell` |
| `ocs prune` | Remove all sandboxes for the current repository | `-f, --force` |
| `ocs gc` | Remove sandboxes not accessed within a duration threshold | `--older-than <duration>` (`7d`), `--dry-run`, `-f` |
| `ocs init` | Create a `.sandboxrc.json` configuration file | `--shared <files...>` |
| `ocs doctor` | Compare the registry with Git worktrees and fix mismatches | `--repair`, `--adopt-orphans`, `--remove-orphans` |

## Global Options

All commands support these global flags:
- `--json`: Format command output as machine-readable JSON.
- `-q, --quiet`: Suppress non-error output.
- `-v, --verbose`: Enable detailed/diagnostic output.

## Configuration (`.sandboxrc.json`)

Create a `.sandboxrc.json` file in your repository root (`ocs init`) to customize dependency linking, config sharing, port allocation, and lifecycle hooks across **any programming language or stack**:

```json
{
  "dependencyDirs": [
    "node_modules",
    ".venv",
    "target",
    "vendor"
  ],
  "manifestFiles": [
    "package.json",
    "package-lock.json",
    "pnpm-lock.yaml",
    "pyproject.toml",
    "poetry.lock",
    "Cargo.toml",
    "Cargo.lock",
    "composer.json"
  ],
  "sharedFiles": [
    ".env",
    ".env.local",
    ".vscode/settings.json",
    "config/local.json"
  ],
  "portRange": {
    "min": 3000,
    "max": 4200
  },
  "hooks": {
    "postCreate": "pnpm install && pnpm run build:deps",
    "preDestroy": "pnpm run clean:cache"
  }
}
```

### Multi-Ecosystem Auto-Detection
If `dependencyDirs` or `manifestFiles` are omitted from `.sandboxrc.json`, `ocs` automatically probes the repository for known folders and files across 8+ major language stacks:
- **JavaScript / Node / Deno / Bun**: `node_modules`, `package.json`, `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `bun.lockb`
- **Python (venv / poetry / uv)**: `.venv`, `venv`, `__pypackages__`, `pyproject.toml`, `poetry.lock`, `uv.lock`, `requirements.txt`
- **Rust (Cargo)**: `target`, `Cargo.toml`, `Cargo.lock`
- **PHP (Composer)**: `vendor`, `composer.json`, `composer.lock`
- **Ruby (Bundler / Rails)**: `.bundle`, `Gemfile`, `Gemfile.lock`
- **Go**: `vendor`, `go.mod`, `go.sum`
- **Elixir (Mix)**: `deps`, `_build`, `mix.exs`, `mix.lock`
- **Java / Kotlin / C++**: `.gradle`, `build`, `pom.xml`, `build.gradle`, `CMakeLists.txt`

If multiple dependency folders exist (e.g. `node_modules` + `.venv` in a full-stack project), `ocs` safely links all of them concurrently (`reflink` on APFS/btrfs/xfs, otherwise `symlink`).

### Hooks Security & Execution
Hooks run in the context of the sandbox directory (`OPENCODE_SANDBOX=1`, `OPENCODE_SANDBOX_BRANCH=<branch>`). To bypass post-create or pre-destroy hooks when debugging or cleaning up untrusted branches, pass `--no-hooks`:

```sh
ocs create feature/test --no-hooks
ocs destroy feature/test --no-hooks
```

## Scripting & CI Usage

`ocs` is designed to be easily scripted using `--json`, `ocs which`, and `ocs run`:

```sh
# Navigate directly to a sandbox from a subshell
cd $(ocs which feature/auth)

# Run CI checks in isolation inside a sandbox
ocs create pr-123 --from origin/pr/123 --no-shell --no-port
ocs run pr-123 -- pnpm test
ocs destroy pr-123 --force
```

## Architecture & Safety Notes

- **Collision-Safe Paths**: Sandbox directory paths contain SHA-256 hashes of the repository root and branch name, preventing collisions between repositories with identical names (`api/`) or branches (`feature/a` vs `feature-a`).
- **Concurrent Mutual Exclusion**: Registry state at `~/.opencode/sandboxes/registry.json` (`$OPENCODE_SANDBOX_HOME`) is protected by cross-process file locking via `proper-lockfile`.
- **Self-Healing Doctor**: `ocs doctor` diagnoses orphaned worktrees (`git worktree list`) and stale registry entries (`--repair`, `--adopt-orphans`, `--remove-orphans`).

## Development

```sh
pnpm typecheck
pnpm test
pnpm build
```
