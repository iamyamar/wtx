# AGENTS.md — Universal AI/LLM Agent Operating Guide for `wtx`

> **IMPORTANT MANDATE FOR AI / LLM CODING AGENTS (Claude, OpenCode, Cursor, Aider, Devin, Antigravity, Copilot, etc.):**
> When working on any project that uses `wtx` (or when instructed to isolate your work), **DO NOT** modify files or run tests directly in the user's active main checkout directory. Always perform feature development, refactoring, dependency upgrades, and exploratory tests inside an isolated **`wtx` sandbox worktree**.

---

## 1. What is `wtx`?

`wtx` (WorkTree eXtended) creates isolated, high-performance Git worktrees tailored specifically for autonomous AI/LLM agents and human developers pair-programming without stepping on each other's toes.

### Why `wtx` is superior to `git checkout -b` or plain `git worktree add`:
1. **Zero Contamination**: Running tests, builds, or code edits in the main working directory disrupts the developer's live editor session, uncommitted work, and running dev servers.
2. **Instantaneous Copy-on-Write Dependencies (`reflink`)**: Plain `git worktree add` creates an empty folder without `node_modules`, `target/`, or `.venv/`, requiring slow network/package re-installs (`npm i`) and wasting gigabytes of disk space. `wtx` automatically detects your package ecosystem and performs a true **zero-copy block clone (`reflink`)** on APFS (macOS), ReFS (Windows 11 Dev Drives), and btrfs/xfs (Linux), making `node_modules` instantly available across sandboxes with `0 ms` overhead and `0 bytes` of duplicated disk blocks.
3. **Deterministic Conflict-Free Port Allocation**: Automatically assigns and locks unique `PORT` environment variables (`3000-4200`) to prevent `EADDRINUSE` crashes when multiple AI agents run dev servers concurrently.
4. **Machine-Readable (`--json`)**: Every command supports `--json`, allowing LLMs to parse exact filesystem paths, drift detection, and git commit logs reliably.

---

## 2. Standard Operating Procedure (SOP) for AI Agents

Whenever you are assigned a coding task in a repository, follow this exact 4-step workflow:

### Step 1: Create an Isolated Sandbox Worktree
Create a sandbox branch without dropping into an interactive subshell (`--no-shell`) and optional port reservation:

```sh
# If globally installed:
wtx create feature/auth-fix --no-shell --no-port

# Or via zero-install npx (if wtx is not globally installed on the runner):
npx -y @yashkumar/wtx@latest create feature/auth-fix --no-shell --no-port
```

### Step 2: Locate the Sandbox Directory Path
Get the absolute path to the sandbox directory so you can read/write files or execute commands in isolation:

```sh
wtx which feature/auth-fix
# Output: /Users/username/.wtx/sandboxes/repoHash/branchHash
```
*(You can safely pass this path to your file editing tools like `read_file`, `replace_file_content`, or `grep_search`).*

### Step 3: Run Commands Inside the Sandbox
To run unit tests, type checks, or build scripts inside the isolated worktree without manually `cd`-ing across subshells, use `wtx run`:

```sh
wtx run feature/auth-fix -- npm test
wtx run feature/auth-fix -- git status
wtx run feature/auth-fix -- git add . && git commit -m "feat: fix auth token expiration"
```

### Step 4: Verify Status and Clean Up
Inspect if dependencies or lockfiles have drifted between your sandbox and `main`:

```sh
wtx status feature/auth-fix --json
```

Once your work is verified, pushed to remote (`git push origin feature/auth-fix`), or merged by the user, clean up the isolated worktree:

```sh
wtx destroy feature/auth-fix --force
```

---

## 3. Command Reference for AI Automation (`--json`)

| Command | AI Agent Usage | Description |
| :--- | :--- | :--- |
| `wtx create <branch>` | `wtx create <branch> --no-shell --no-port` | Creates a new Git worktree, clones `node_modules` via `reflink`, links shared config (`.env`), and registers the sandbox. |
| `wtx which <branch>` | `wtx which <branch>` | Prints the absolute filesystem path of the branch's sandbox directory. |
| `wtx run <branch> <cmd...>` | `wtx run <branch> -- <cmd...>` | Executes a shell command inside the specified branch's sandbox directory (`WTX_SANDBOX=1`). |
| `wtx status <branch>` | `wtx status <branch> --json` | Returns JSON status including lockfile drift (`hasDrift: boolean`), git branch state, and reserved `port`. |
| `wtx list` | `wtx list --json` | Lists all active sandboxes for the current repository with disk usage and branch names. |
| `wtx diff <branch>` | `wtx diff <branch> --stat` | Shows git diff statistics between the sandbox branch and the main repository base branch. |
| `wtx destroy <branch>` | `wtx destroy <branch> --force --no-hooks` | Safely removes the git worktree and cleans up registry reservations. |
| `wtx doctor` | `wtx doctor --repair --json` | Self-healing diagnostic tool that cleans up stale registry entries or adopts orphaned git worktrees. |

---

## 4. Environment Variables Injected by `wtx`

When running any process inside a `wtx` sandbox (either via `wtx run` or an interactive `wtx enter`), the following environment variables are automatically injected into the environment:

- `WTX_SANDBOX`: Always set to `"1"`. Check `if (process.env.WTX_SANDBOX === "1")` in scripts/code to detect if you are running inside a sandbox.
- `WTX_SANDBOX_BRANCH`: The current branch name (`e.g. feature/auth-fix`).
- `PORT`: An advisory, deterministic port number locally available and reserved in the registry (`e.g. 3004`).
- `OPENCODE_SANDBOX` / `OPENCODE_SANDBOX_BRANCH`: Injected alongside `WTX_*` for backwards compatibility with legacy `.sandboxrc.json` hook scripts.

---

## 5. Multi-Ecosystem Auto-Detection (`.sandboxrc.json`)

If the repository root has a `.sandboxrc.json` configuration file (`wtx init`), `wtx` respects custom `dependencyDirs` and `sharedFiles`:

```json
{
  "dependencyDirs": ["node_modules", ".venv", "target", "vendor"],
  "manifestFiles": ["package.json", "package-lock.json", "pyproject.toml", "Cargo.lock"],
  "sharedFiles": [".env", ".env.local", ".vscode/settings.json"],
  "portRange": { "min": 3000, "max": 4200 },
  "hooks": {
    "postCreate": "npm install",
    "preDestroy": "npm run clean"
  }
}
```

If no `.sandboxrc.json` exists, `wtx` automatically probes and links known dependency structures across **8+ major language stacks**:
- **JavaScript / TypeScript / Node / Deno / Bun**: `node_modules`, `package.json`, `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `bun.lockb`
- **Python**: `.venv`, `venv`, `__pypackages__`, `pyproject.toml`, `poetry.lock`, `uv.lock`, `requirements.txt`
- **Rust**: `target`, `Cargo.toml`, `Cargo.lock`
- **PHP**: `vendor`, `composer.json`, `composer.lock`
- **Ruby**: `.bundle`, `Gemfile`, `Gemfile.lock`
- **Go**: `vendor`, `go.mod`, `go.sum`
- **Elixir**: `deps`, `_build`, `mix.exs`, `mix.lock`
- **Java / Kotlin / C++**: `.gradle`, `build`, `pom.xml`, `build.gradle`, `CMakeLists.txt`

---

## 6. Developing & Modifying `wtx` Itself (For Agents working in this repository)

If your task is to modify the `wtx` codebase (`/src/*`, `/test/*`), understand the core architecture:

### Core Module Breakdown (`src/core/`)
- `paths.ts`: Calculates the isolated `sandboxRoot()` directory (`~/.wtx/sandboxes` or `process.env.WTX_HOME`) and generates collision-safe SHA-256 directory names (`repo-<hash>/branch-<hash>`).
- `registry.ts`: Atomic JSON state storage (`registry.json`) protected by cross-process file locking (`proper-lockfile`). Serializes concurrent port allocations and branch reservations.
- `worktree.ts`: Wraps `git worktree add`, `git worktree list --porcelain`, `git worktree remove`, and branch creation.
- `deps.ts`: The high-speed copy-on-write filesystem engine. Probes `cp --reflink=always` (or Node `FSCTL_DUPLICATE_EXTENTS_TO_FILE` on Windows ReFS/Dev Drives) and falls back to directory junctions or recursive copy if reflink is unsupported on the volume. Also handles `sharedFiles` symlink/hardlink creation and lockfile drift hashing.
- `ports.ts`: Allocates deterministic free ports (`3000-4200`) and verifies local availability before locking.
- `hooks.ts`: Executes user-defined `postCreate` and `preDestroy` shell commands from `.sandboxrc.json`.

### Building and Testing Command Pipeline
Before submitting code modifications to `wtx`, always run the verification sequence:

```sh
# 1. Run strict TypeScript type verification:
npm run typecheck

# 2. Run the full automated unit test suite (28 tests across 5 test files):
npm test

# 3. Build the production CLI distribution bundle (`dist/cli.js`):
npm run build
```

### Public Documentation Standards (`documentation-writer` Skill)
Whenever you are tasked with upgrading, adding, or refactoring public-facing documentation (`README.md`, `docs/*.md`, or user guides), you **MUST** activate and strictly adhere to the **`documentation-writer`** skill (`.agents/skills/documentation-writer/SKILL.md`).
- **Diátaxis Framework**: Structure documentation clearly based on its core purpose—**Tutorials** (learning-oriented), **How-To Guides** (task-oriented), **Reference** (information-oriented), and **Explanation** (understanding-oriented).
- **Clarity & Precision**: Ensure all user-facing examples, code blocks, and command tables (`wtx create`, `--json` outputs, etc.) are tested, accurate, and structured so both human developers and autonomous AI/LLM agents can understand and follow them without ambiguity.

