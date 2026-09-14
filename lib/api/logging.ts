const SENSITIVE_KEYS = new Set([
  "authorization",
  "token",
  "tokenhash",
  "uploadurl",
  "downloadurl",
  "storagekey",
]);

export function redactApiLogValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactApiLogValue);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [
      key,
      SENSITIVE_KEYS.has(key.toLowerCase())
        ? "[REDACTED]"
        : redactApiLogValue(nested),
    ]),
  );
}

export interface ApiLogEvent {
  requestId: string;
  route: string;
  status: number;
  durationMs: number;
  userId?: string;
  tokenId?: string;
  errorCode?: string;
  [key: string]: unknown;
}

export function writeApiLog(event: ApiLogEvent): void {
  const { requestId, route, status, durationMs, userId, tokenId, errorCode } = event;
  console.info("api_request", {
    requestId,
    route,
    status,
    durationMs,
    userId,
    tokenId,
    errorCode,
  });
}
