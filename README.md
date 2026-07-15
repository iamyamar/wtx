# wtx — Instant, Isolated Workspace Sandboxes for Developers & AI Agents

> **`wtx` (WorkTree eXtended)** lets you instantly create clean, isolated workspace folders for your Git branches—complete with all your project packages (`node_modules`) and env (`.env`, `.env.local`) ready to go in **0 seconds** with **0 extra disk space**. 
> Whether you are building multiple features at once or letting AI coding assistants work in the background, `wtx` keeps your main project clean, prevents broken local dev servers, and saves you from ever waiting for slow package reinstalls again.

---

## 💡 Why `wtx`? The Problem It Solves

When you switch branches or test new ideas in a normal Git repository, you run into three major frustrations:
1. **Broken Editor & Live Sessions:** Running tests, builds, or switching branches right in your main project folder disrupts your open code editor tabs, uncommitted changes, and running local servers.
2. **Slow, Heavy Package Installs:** Creating separate folders (`git worktree`) usually leaves you with empty directories that lack `node_modules` or Python virtual environments (`.venv`). Re-running `npm install` inside every new branch wastes gigabytes of hard drive space and takes forever.
3. **Port Collisions:** When you or your AI agents try to run two development servers at the same time, they crash with "Port already in use" errors (`EADDRINUSE`).

### The `wtx` Solution
`wtx` solves all three problems automatically:
- **Instant Package Cloning:** `wtx` clones your project's `node_modules` or `.venv` instantly using your operating system's smart block-sharing technology. You get 100% independent package folders in `0 ms` using `0 bytes` of extra disk space.
- **Auto-Reserved Ports:** Every sandbox gets its own unique local `PORT` number assigned automatically, so multiple servers run side by side without crashing.
- **Multi-Language Support:** Works out-of-the-box with JavaScript/TypeScript (`node_modules`), Python (`.venv`), Rust (`target/`), Go, PHP, Ruby, and Java.

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
