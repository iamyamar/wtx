import chalk from "chalk";
import { execa } from "execa";
import { repositoryKey } from "../core/paths.js";
import { getSandbox } from "../core/registry.js";

export async function stashCommand(
  mainRepoPath: string,
  branch: string,
  action: string = "push",
): Promise<void> {
  const record = await getSandbox(repositoryKey(mainRepoPath), branch);
  if (!record) {
    console.log(chalk.yellow(`No sandbox registered for branch "${branch}".`));
    process.exitCode = 1;
    return;
  }

  const args =
    action === "push" ? ["stash", "push", "-u", "-m", `ocs-stash-${branch}`] :
    action === "pop"  ? ["stash", "pop"] :
    action === "list" ? ["stash", "list"] :
    (() => { throw new Error(`Unknown stash action: "${action}". Use push, pop, or list.`); })();
  await execa("git", args as string[], { cwd: record.path, stdio: "inherit" });
}
