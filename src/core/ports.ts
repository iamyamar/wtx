import crypto from "node:crypto";
import net from "node:net";

function hashPort(branch: string, min: number, range: number): number {
  const hash = crypto.createHash("sha256").update(branch).digest("hex");
  return min + (Number.parseInt(hash.slice(0, 6), 16) % range);
}

export async function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => server.close(() => resolve(true)));
    server.listen(port, "127.0.0.1");
  });
}

export async function allocatePort(
  branch: string,
  takenPorts: readonly number[],
  portRange: { min: number; max: number } = { min: 3000, max: 4200 },
): Promise<number> {
  const range = portRange.max - portRange.min;
  if (range <= 0) throw new Error(`Invalid port range: ${portRange.min}–${portRange.max}.`);
  let candidate = hashPort(branch, portRange.min, range);
  const maxAttempts = Math.min(range, 200);
  for (let attempts = 0; attempts <= maxAttempts; attempts += 1, candidate += 1) {
    if (candidate > portRange.max) candidate = portRange.min;
    if (!takenPorts.includes(candidate) && (await isPortFree(candidate))) return candidate;
  }
  throw new Error(`No free sandbox port found between ${portRange.min} and ${portRange.max}.`);
}
