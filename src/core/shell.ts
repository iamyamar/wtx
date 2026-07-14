import { spawn } from "node:child_process";

export function openSandboxShell(sandboxDir: string, branch: string, port: number | null): Promise<void> {
  const shell = process.env.SHELL || "/bin/bash";
  const isFish = shell.endsWith("/fish") || shell.endsWith("/fish.exe");

  const args: string[] = [];
  if (isFish) {
    args.push(
      "--init-command",
      `function fish_prompt; set_color magenta; echo -n "(sandbox:${branch}) "; set_color normal; echo -n (prompt_pwd) "❯ "; end`,
    );
  }

  const prompt = `\\[\\033[1;35m\\](sandbox:${branch})\\[\\033[0m\\] \\w $ `;
  const child = spawn(shell, args, {
    cwd: sandboxDir,
    stdio: "inherit",
    env: {
      ...process.env,
      ...(port === null ? {} : { PORT: String(port) }),
      ...(isFish ? {} : {
        PS1: prompt,
        PROMPT: `%F{magenta}(sandbox:${branch})%f %~ $ `,
      }),
      OPENCODE_SANDBOX: "1",
      OPENCODE_SANDBOX_BRANCH: branch,
    },
  });

  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", () => resolve());
  });
}
