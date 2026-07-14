import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execa } from "execa";

export async function temporaryDirectory(prefix = "ocs-test-"): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

export async function initialiseRepo(directory: string): Promise<void> {
  await execa("git", ["init", "-b", "main"], { cwd: directory });
  await execa("git", ["config", "user.email", "ocs@example.test"], { cwd: directory });
  await execa("git", ["config", "user.name", "OCS Test"], { cwd: directory });
  await fs.writeFile(path.join(directory, "README.md"), "test\n");
  await execa("git", ["add", "README.md"], { cwd: directory });
  await execa("git", ["commit", "-m", "initial"], { cwd: directory });
}
