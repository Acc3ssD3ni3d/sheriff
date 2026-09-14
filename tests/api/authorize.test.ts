import { describe, expect, it, vi } from "vitest";
import { authorizeApiRequest } from "@/lib/api/authorize";

describe("API authorization boundary", () => {
  it("returns authentication failures without consuming a rate-limit bucket", async () => {
    const limit = vi.fn();
    const result = await authorizeApiRequest(
      new Request("https://example.test/api/v1/files"),
      "files:read",
      "general",
      {
        authenticate: async () => ({
          ok: false,
          response: new Response(null, { status: 401 }),
        }),
        limit,
      },
    );
    expect(result.ok).toBe(false);
    expect(limit).not.toHaveBeenCalled();
  });

  it("keys limits by API token and exposes standard headers", async () => {
    const limit = vi.fn().mockResolvedValue({
      allowed: true,
      limit: 120,
      remaining: 119,
      resetAt: new Date("2026-09-14T00:01:00Z"),
    });
    const result = await authorizeApiRequest(
      new Request("https://example.test/api/v1/files"),
      "files:read",
      "general",
      {
        authenticate: async () => ({
          ok: true,
          principal: { userId: "user-1", tokenId: "token-1", scopes: ["files:read"] },
        }),
        limit,
        now: new Date("2026-09-14T00:00:00Z"),
      },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(limit).toHaveBeenCalledWith(undefined, expect.objectContaining({
      key: "api:general:token-1",
      limit: 120,
    }));
    expect(result.headers.get("RateLimit-Remaining")).toBe("119");
  });

  it("returns 429 with Retry-After after a bucket is exhausted", async () => {
    const result = await authorizeApiRequest(
      new Request("https://example.test/api/v1/files"),
      "files:write",
      "upload",
      {
        authenticate: async () => ({
          ok: true,
          principal: { userId: "user-1", tokenId: "token-1", scopes: ["files:write"] },
        }),
        limit: async () => ({
          allowed: false,
          limit: 20,
          remaining: 0,
          resetAt: new Date("2026-09-14T00:01:00Z"),
        }),
        now: new Date("2026-09-14T00:00:30Z"),
      },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(429);
    expect(result.response.headers.get("Retry-After")).toBe("30");
  });
});
