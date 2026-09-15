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
  error?: unknown;
  [key: string]: unknown;
}

const ERROR_OWN_KEYS_IGNORED = new Set(["message", "stack", "name"]);

function errorDiagnostics(error: unknown): Record<string, unknown> {
  if (error === undefined) return {};
  if (!(error instanceof Error)) {
    return { errorDetails: redactApiLogValue(error) };
  }

  const details = Object.fromEntries(
    Object.entries(error).filter(([key]) => !ERROR_OWN_KEYS_IGNORED.has(key)),
  );

  return {
    errorName: error.name,
    errorMessage: error.message,
    errorStack: error.stack,
    ...(Object.keys(details).length > 0
      ? { errorDetails: redactApiLogValue(details) }
      : {}),
  };
}

export function writeApiLog(event: ApiLogEvent): void {
  const { requestId, route, status, durationMs, userId, tokenId, errorCode, error } = event;
  console.info("api_request", {
    requestId,
    route,
    status,
    durationMs,
    userId,
    tokenId,
    errorCode,
    ...errorDiagnostics(error),
  });
}
