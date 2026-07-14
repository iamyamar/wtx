import { repositoryKey } from "../core/paths.js";
import { getSandbox } from "../core/registry.js";

export async function whichCommand(mainRepoPath: string, branch: string): Promise<void> {
  const record = await getSandbox(repositoryKey(mainRepoPath), branch);
  if (!record) {
    process.exitCode = 1;
    return;
  }
  // Raw path only — designed for subshell usage: cd $(ocs which feature/x)
  process.stdout.write(record.path + "\n");
}
