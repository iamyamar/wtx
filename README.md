# wtx

`wtx` creates isolated Git worktrees for feature work without copying an entire repository. It can reuse `node_modules` through filesystem copy-on-write clones where supported (`reflink`), otherwise through an explicit symlink fallback.

## Features at a glance

- **Zero-Copy Worktrees**: Create isolated environments in seconds using `git worktree`.
- **Intelligent Dependency Sharing**: Auto-probes filesystem capabilities for copy-on-write (`reflink` on Linux/macOS APFS) or safe symlinking.
- **Drift Detection**: Detects lockfile/package manifest drift between main repository and sandboxes.
- **Port Allocation**: Automatically reserves deterministic, conflict-free `PORT` values for your dev servers.
- **Lifecycle Hooks**: Run custom scripts on `postCreate` and `preDestroy`.
- **Shell & Scripting Friendly**: Full `bash`/`zsh`/`fish` prompt integration and JSON-structured output (`--json`) for CI pipelines.

## Installation & Setup

```sh
# Global installation from NPM
npm install -g @yashkumar/wtx

# Once installed globally, run all commands cleanly using `wtx`:
wtx --help

# Or run directly via npx without global installation:
npx @yashkumar/wtx --help
```

### Shell Completions

Generate and load completions for your shell (`bash`, `zsh`, or `fish`):

```sh
# Bash (~/.bashrc)
eval "$(wtx completion bash)"

# Zsh (~/.zshrc)
eval "$(wtx completion zsh)"

# Fish (~/.config/fish/config.fish)
wtx completion fish | source
```

## Commands Reference

| Command | Description | Key Options |
| --- | --- | --- |
| `wtx create <branch>` | Create a sandbox and open a shell in it | `--no-shell`, `--no-port`, `--from <base>`, `--no-hooks` |
| `wtx destroy <branch>` | Remove a sandbox worktree | `-f, --force`, `--no-hooks` |
| `wtx list` | List registered sandboxes for this repository | `-a, --all`, `--size`, `--json` |
| `wtx status <branch>` | Show sandbox state and dependency drift | `--json` |
| `wtx enter <branch>` | Open an interactive shell in an existing sandbox | |
| `wtx sync <branch>` | Rebase or merge upstream changes into a sandbox | `--merge`, `--from <upstream>` |
| `wtx open <branch>` | Open a sandbox in your editor or file manager | `--editor <name>`, `--finder` |
| `wtx which <branch>` | Print the sandbox directory path (for scripts/subshells) | |
| `wtx diff <branch>` | Show changes relative to main | `--stat`, `--from <base>` |
| `wtx log <branch>` | Show commits in a sandbox not in main | `-n, --number <count>`, `--from <base>` |
| `wtx stash <branch> [action]` | Stash or restore changes in a sandbox (`push`, `pop`, `list`) | |
| `wtx rename <old> <new>` | Rename a sandbox branch and update the registry | |
| `wtx refresh <branch>` | Re-link dependencies and shared config | |
| `wtx run <branch> <cmd...>` | Run a command inside a sandbox worktree | `-s, --shell` |
| `wtx prune` | Remove all sandboxes for the current repository | `-f, --force` |
| `wtx gc` | Remove sandboxes not accessed within a duration threshold | `--older-than <duration>` (`7d`), `--dry-run`, `-f` |
| `wtx init` | Create a `.sandboxrc.json` configuration file | `--shared <files...>` |
| `wtx doctor` | Compare the registry with Git worktrees and fix mismatches | `--repair`, `--adopt-orphans`, `--remove-orphans` |

## Global Options

All commands support these global flags:

- `--json`: Format command output as machine-readable JSON.
- `-q, --quiet`: Suppress non-error output.
- `-v, --verbose`: Enable detailed/diagnostic output.

## Configuration (`.sandboxrc.json`)

Create a `.sandboxrc.json` file in your repository root (`wtx init`) to customize dependency linking, config sharing, port allocation, and lifecycle hooks across **any programming language or stack**:

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
    "postCreate": "npm install && npm run build:deps",
    "preDestroy": "npm run clean:cache"
  }
}
```

### Multi-Ecosystem Auto-Detection
If `dependencyDirs` or `manifestFiles` are omitted from `.sandboxrc.json`, `wtx` automatically probes the repository for known folders and files across 8+ major language stacks:
- **JavaScript / Node / Deno / Bun**: `node_modules`, `package.json`, `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `bun.lockb`
- **Python (venv / poetry / uv)**: `.venv`, `venv`, `__pypackages__`, `pyproject.toml`, `poetry.lock`, `uv.lock`, `requirements.txt`
- **Rust (Cargo)**: `target`, `Cargo.toml`, `Cargo.lock`
- **PHP (Composer)**: `vendor`, `composer.json`, `composer.lock`
- **Ruby (Bundler / Rails)**: `.bundle`, `Gemfile`, `Gemfile.lock`
- **Go**: `vendor`, `go.mod`, `go.sum`
- **Elixir (Mix)**: `deps`, `_build`, `mix.exs`, `mix.lock`
- **Java / Kotlin / C++**: `.gradle`, `build`, `pom.xml`, `build.gradle`, `CMakeLists.txt`

If multiple dependency folders exist (e.g. `node_modules` + `.venv` in a full-stack project), `wtx` safely links all of them concurrently (`reflink` on APFS/btrfs/xfs/ReFS, otherwise `symlink` or `junction`).

### Cross-Platform & Windows Resilience (Block Cloning & EPERM Immunity)
`wtx` uses a zero-overhead, 3-tier linking hierarchy designed to guarantee zero `EPERM` or `EXDEV` failures across corporate laptops, Dev Drives, restricted user accounts, and Docker mounts:
- **True Windows Block Cloning (`reflink`)**: On **Windows 11 Dev Drives and ReFS volumes**, `wtx` automatically invokes `FSCTL_DUPLICATE_EXTENTS_TO_FILE` via Node's `COPYFILE_FICLONE_FORCE` to perform instantaneous, zero-copy `node_modules` / `target` block cloning.
- **Directories (`dependencyDirs`, `.vscode`) Hierarchy**: `reflink` $\rightarrow$ `junction` (instantaneous Windows Directory Junction requiring zero Administrator rights or Developer Mode) $\rightarrow$ `recursive copy` (`fs.cp` fallback for SMB/FAT32/Docker mounts).
- **Files (`sharedFiles` like `.env`) Hierarchy**: `symlink("file")` $\rightarrow$ `hardlink` (`fs.link()`, sharing live file data on NTFS/ReFS without elevated privileges) $\rightarrow$ `copyFile`.
- **Path Case Normalization**: `wtx doctor` case-insensitively normalizes paths on Windows (`C:` vs `c:`) so drive letters never trigger false positive orphan warnings.

### Hooks Security & Execution
Hooks run in the context of the sandbox directory (`WTX_SANDBOX=1`, `WTX_SANDBOX_BRANCH=<branch>`). To bypass post-create or pre-destroy hooks when debugging or cleaning up untrusted branches, pass `--no-hooks`:

```sh
wtx create feature/test --no-hooks
wtx destroy feature/test --no-hooks
```

## Scripting & CI Usage

`wtx` is designed to be easily scripted using `--json`, `wtx which`, and `wtx run`:

```sh
# Navigate directly to a sandbox from a subshell
cd $(wtx which feature/auth)

# Run CI checks in isolation inside a sandbox
wtx create pr-123 --from origin/pr/123 --no-shell --no-port
wtx run pr-123 -- npm test
wtx destroy pr-123 --force
```

## Architecture & Safety Notes

- **Collision-Safe Paths**: Sandbox directory paths contain SHA-256 hashes of the repository root and branch name, preventing collisions between repositories with identical names (`api/`) or branches (`feature/a` vs `feature-a`).
- **Concurrent Mutual Exclusion**: Registry state at `~/.wtx/sandboxes/registry.json` (`$WTX_HOME`) is protected by cross-process file locking via `proper-lockfile`.
- **Self-Healing Doctor**: `wtx doctor` diagnoses orphaned worktrees (`git worktree list`) and stale registry entries (`--repair`, `--adopt-orphans`, `--remove-orphans`).

## Development

```sh
npm run typecheck
npm test
npm run build
```

