import crypto from "node:crypto";
import net from "node:net";

function hashPort(branch: string): number {
  const hash = crypto.createHash("sha256").update(branch).digest("hex");
  return 3_000 + (Number.parseInt(hash.slice(0, 6), 16) % 1_000);
}

export async function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => server.close(() => resolve(true)));
    server.listen(port, "127.0.0.1");
  });
}

export async function allocatePort(branch: string, takenPorts: readonly number[]): Promise<number> {
  let candidate = hashPort(branch);
  for (let attempts = 0; attempts <= 200; attempts += 1, candidate += 1) {
    if (!takenPorts.includes(candidate) && (await isPortFree(candidate))) return candidate;
  }
  throw new Error("No free sandbox port found between 3000 and 4200.");
}
