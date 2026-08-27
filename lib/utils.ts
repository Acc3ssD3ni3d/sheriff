import crypto from "crypto";

export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9.-]/g, "_")
    .replace(/_{2,}/g, "_")
    .slice(0, 200);
}

export function generateStorageKey(
  userId: string,
  originalName: string,
): string {
  const ext = originalName.includes(".") ? originalName.split(".").pop() : "";
  const randomKey = crypto.randomBytes(16).toString("hex");
  return ext ? `${userId}/${randomKey}.${ext}` : `${userId}/${randomKey}`;
}

export function generateShareToken(): string {
  return crypto.randomBytes(24).toString("hex");
}
