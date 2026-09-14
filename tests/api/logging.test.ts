import { afterEach, describe, expect, it, vi } from "vitest";
import { redactApiLogValue, writeApiLog } from "@/lib/api/logging";

afterEach(() => vi.restoreAllMocks());

describe("API logging", () => {
  it("redacts credentials and signed storage data recursively", () => {
    expect(redactApiLogValue({
      authorization: "Bearer secret",
      nested: {
        token: "secret",
        tokenHash: "hash",
        uploadUrl: "https://signed.example/upload",
        downloadUrl: "https://signed.example/download",
        storageKey: "user/object",
      },
      status: 401,
    })).toEqual({
      authorization: "[REDACTED]",
      nested: {
        token: "[REDACTED]",
        tokenHash: "[REDACTED]",
        uploadUrl: "[REDACTED]",
        downloadUrl: "[REDACTED]",
        storageKey: "[REDACTED]",
      },
      status: 401,
    });
  });

  it("logs only the operational allowlist", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    writeApiLog({
      requestId: "req_1",
      route: "/api/v1/files",
      status: 200,
      durationMs: 12,
      userId: "user-1",
      tokenId: "token-1",
      errorCode: undefined,
      authorization: "Bearer should-not-log",
    });

    expect(info).toHaveBeenCalledWith("api_request", {
      requestId: "req_1",
      route: "/api/v1/files",
      status: 200,
      durationMs: 12,
      userId: "user-1",
      tokenId: "token-1",
      errorCode: undefined,
    });
  });

  it("records redacted error diagnostics when given an error", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const error = new Error("connection refused");
    writeApiLog({
      requestId: "req_2",
      route: "/api/v1/files",
      status: 500,
      durationMs: 5,
      errorCode: "internal_error",
      error,
    });

    const logged = info.mock.calls[0][1] as Record<string, unknown>;
    expect(logged.errorName).toBe("Error");
    expect(logged.errorMessage).toBe("connection refused");
    expect(typeof logged.errorStack).toBe("string");
  });

  it("redacts credentials carried on a thrown error", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const error = Object.assign(new Error("upstream rejected"), {
      authorization: "Bearer secret",
      context: { storageKey: "user/object" },
    });
    writeApiLog({
      requestId: "req_3",
      route: "/api/v1/files",
      status: 500,
      durationMs: 5,
      errorCode: "internal_error",
      error,
    });

    const logged = info.mock.calls[0][1] as Record<string, unknown>;
    expect(logged.errorDetails).toEqual({
      authorization: "[REDACTED]",
      context: { storageKey: "[REDACTED]" },
    });
  });
});
