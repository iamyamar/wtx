<div align="center">

# ⚡️ wtx — WorkTree eXtended

**Instant, zero-copy Git branch sandboxes for developers & AI coding agents.**

[![NPM Version](https://img.shields.io/npm/v/@yashkumar/wtx?style=flat-square&color=31c27c&logo=npm)](https://www.npmjs.com/package/@yashkumar/wtx)
[![NPM Downloads](https://img.shields.io/npm/dm/@yashkumar/wtx?style=flat-square&color=blue&logo=npm)](https://www.npmjs.com/package/@yashkumar/wtx)
[![GitHub Stars](https://img.shields.io/github/stars/iamyamar/wtx?style=flat-square&color=gold&logo=github)](https://github.com/iamyamar/wtx)
[![GitHub Issues](https://img.shields.io/github/issues/iamyamar/wtx?style=flat-square&color=orange&logo=github)](https://github.com/iamyamar/wtx/issues)
[![License: MIT](https://img.shields.io/badge/License-MIT-purple.svg?style=flat-square)](https://github.com/iamyamar/wtx/blob/main/LICENSE)

</div>

---

> **`wtx`** instantly creates clean, isolated workspace folders for your Git branches—with your packages (`node_modules`) and configs (`.env`, `.env.local`) ready in **0 seconds** with **0 extra disk space**. 
> It empowers developers and **AI coding assistants to work in parallel across multiple branches and multiple features simultaneously** without conflicts or disruptions.

Whether you are building complex features or letting multiple AI agents code concurrently, `wtx`:
- ✨ **Keeps main repo clean** (No uncommitted clutter or broken sessions).
- 🤖 **Parallel AI agent coding** (Run multiple autonomous AI agents simultaneously across isolated branch sandboxes).
- 📦 **Skips `npm install`** (Instant copy-on-write `reflink` package sharing across branches).
- 🔌 **Prevents port crashes** (Auto-reserves unique local `PORT` numbers for concurrent dev servers).
- 🌐 **Multi-language auto-detect** (Works out-of-the-box with Node, Python `.venv`, Rust `target/`, Go, PHP, Java).

---

## 🚀 Quickstart Tutorial (Get Running in 60 Seconds)

### 1. Install `wtx` Globally
```sh
npm install -g @yashkumar/wtx
```
*(Or run commands without installing via zero-install `npx -y @yashkumar/wtx@latest <command>`)*

### 2. Create Your First Sandbox
Create a new branch and open an isolated shell inside your new workspace:
```sh
wtx create feature/login
```
*What happens instantly behind the scenes:*
- A clean isolated workspace folder is created (`~/.wtx/sandboxes/your-project/feature-login`).
- Your `node_modules` (or `.venv`) is duplicated instantly with zero disk usage.
- Shared files like `.env` are automatically linked.
- A unique local `PORT` (e.g., `3004`) is reserved.

### 3. Work & Test Inside Your Sandbox
Run your development server or test suite safely inside the isolated folder:
```sh
npm run dev
# Or run commands from anywhere using `wtx run`:
wtx run feature/login -- npm test
```

### 4. Clean Up When Done
Once your feature is merged or pushed to GitHub, safely remove the sandbox folder:
```sh
wtx destroy feature/login --force
```

---

## 📖 Practical How-To Guides & Everyday Usability

### Guide 1: Running Commands Across Sandboxes Without Changing Directories
You do not need to open separate terminal windows or manually navigate into sandbox folders. Use `wtx run` to execute any command right from your main terminal:
```sh
# Run tests inside your isolated feature branch:
wtx run feature/checkout -- npm test

# Check git status across your sandboxes:
wtx run feature/checkout -- git status

# Commit and push changes directly:
wtx run feature/checkout -- git add . && git commit -m "feat: complete checkout flow"
```

### Guide 2: Using `wtx` with AI / LLM Coding Agents
AI coding assistants (Claude Dev, OpenCode, Cursor, Aider, Antigravity) can work much faster and safer inside `wtx` sandboxes without disrupting your live editor session.

**Recommended command for AI Agents:**
```sh
# Create a sandbox without entering an interactive shell and output exact paths in JSON:
wtx create feature/ai-refactor --no-shell --no-port --json
```
AI agents can then check where the sandbox lives using:
```sh
wtx which feature/ai-refactor
# Returns: /Users/username/.wtx/sandboxes/project-hash/feature-ai-refactor
```

### Guide 3: Customizing Shared Files and Lifecycle Hooks (`.sandboxrc.json`)
If your project uses specific config files (`.env.local`) or custom build setup commands, initialize a `.sandboxrc.json` file in your repository root:
```sh
wtx init
```
Edit `.sandboxrc.json` to tell `wtx` exactly what your project needs:
```json
{
  "dependencyDirs": ["node_modules", ".venv", "target"],
  "sharedFiles": [".env", ".env.local", ".vscode/settings.json"],
  "portRange": { "min": 3000, "max": 4200 },
  "hooks": {
    "postCreate": "npm install && npm run setup",
    "preDestroy": "npm run clean"
  }
}
```

### Guide 4: Checking Sandbox Status & Out-of-Sync Packages
If someone updates `package.json` on the `main` branch, your sandbox packages might become out of sync. Check for changes instantly using `wtx status`:
```sh
wtx status feature/login
```
If `status` shows that packages have drifted, refresh your sandbox dependencies:
```sh
wtx refresh feature/login
```

### Guide 5: Self-Healing Diagnostics (`wtx doctor`)
If you manually delete a folder using your file explorer (`rm -rf`), `wtx` can clean up any leftover tracking data automatically:
```sh
wtx doctor --repair
```

---

## 🧰 Command Reference

All `wtx` commands support `--json` for machine-readable automation and `-q, --quiet` for clean output.

| Command | Example | Description |
| :--- | :--- | :--- |
| `wtx create <branch>` | `wtx create feature/login` | Creates an isolated workspace folder, clones packages, and opens a shell. |
| `wtx run <branch> <cmd>` | `wtx run feature/login -- npm test` | Runs any command inside the specified sandbox workspace. |
| `wtx which <branch>` | `wtx which feature/login` | Prints the exact folder path of the sandbox workspace. |
| `wtx status [branch]` | `wtx status feature/login` | Checks dependency sync status, git branch state, and assigned `PORT`. |
| `wtx list` | `wtx list --json` | Lists all active sandbox workspaces and their disk usage. |
| `wtx open <branch>` | `wtx open feature/login` | Opens the sandbox workspace directly inside your code editor (`VS Code`, `Cursor`). |
| `wtx enter <branch>` | `wtx enter feature/login` | Opens an interactive terminal shell inside the sandbox workspace. |
| `wtx diff <branch>` | `wtx diff feature/login` | Shows git diff statistics between your sandbox and the main base branch. |
| `wtx sync <branch>` | `wtx sync feature/login` | Safely rebases your sandbox branch onto the latest changes from `main`. |
| `wtx stash <branch>` | `wtx stash feature/login --pop` | Pushes or pops git stashes safely inside the sandbox folder. |
| `wtx rename <old> <new>` | `wtx rename feature/old feature/new` | Renames the sandbox branch and updates all tracking records cleanly. |
| `wtx refresh <branch>` | `wtx refresh feature/login` | Re-links dependencies and shared `.env` files from the main project. |
| `wtx destroy <branch>` | `wtx destroy feature/login --force` | Removes the workspace folder and frees up reserved ports. |
| `wtx prune` | `wtx prune --force` | Removes all inactive or completed sandbox workspaces at once. |
| `wtx gc` | `wtx gc --days 7` | Cleans up old, unused sandbox folders automatically. |
| `wtx log <branch>` | `wtx log feature/login` | Displays the recent git commit history inside the sandbox workspace. |
| `wtx doctor` | `wtx doctor --repair` | Runs diagnostics and fixes broken folders or leftover registry records. |
| `wtx init` | `wtx init` | Generates a `.sandboxrc.json` configuration file in your repository. |

---

## 🌐 Automatic Environment Variables

Whenever you run a command inside a `wtx` sandbox (`wtx run` or `wtx enter`), `wtx` automatically provides helpful environment variables to your scripts and servers:

- **`WTX_SANDBOX=1`**: Lets your scripts detect if they are running inside an isolated sandbox.
- **`WTX_SANDBOX_BRANCH="feature/login"`**: Provides the exact branch name of the current sandbox.
- **`PORT=3004`**: Provides a unique, available local port number reserved specifically for this workspace so your dev servers start without port conflicts.

---

## 🐚 Shell Completions

Enable instant tab-completion for branch names and commands in your terminal (`bash`, `zsh`, or `fish`):

```sh
# For zsh (add to ~/.zshrc):
eval "$(wtx completion zsh)"

# For bash (add to ~/.bashrc):
eval "$(wtx completion bash)"

# For fish (add to ~/.config/fish/config.fish):
wtx completion fish | source
```

---

## 📄 License
MIT License. Built for high-performance developer workflows and autonomous AI agents.
