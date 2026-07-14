import { execa } from "execa";

/** Convert an ISO timestamp to a human-friendly relative string. */
export function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 0) return "just now";
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

/** Return disk usage of a directory (async, calls du). */
export async function getDiskUsage(dirPath: string): Promise<string> {
  try {
    const { stdout } = await execa("du", ["-sh", dirPath]);
    return stdout.split("\t")[0].trim();
  } catch {
    return "unknown";
  }
}
