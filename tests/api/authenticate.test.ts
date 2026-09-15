import { describe, expect, it, vi } from "vitest";
import { authenticateApiRequest } from "@/lib/api/authenticate";
import { generateApiToken, type ApiScope } from "@/lib/api/tokens";

const PEPPER = "pepper-for-tests";

function request(authorization?: string) {
  return new Request("https://sheriff.test/api/v1/files", {
    headers: authorization ? { authorization } : {},
  });
}

function fixture(overrides: Partial<{
  tokenHash: string;
  scopes: ApiScope[];
  expiresAt: Date | null;
  revokedAt: Date | null;
  lastUsedAt: Date | null;
}> = {}) {
  const generated = generateApiToken(PEPPER);
  return {
    generated,
    record: {
      id: "token-1",
      ownerId: "user-1",
      tokenHash: generated.tokenHash,
      scopes: ["files:read"] as ApiScope[],
      expiresAt: null,
      revokedAt: null,
      lastUsedAt: null,
      ...overrides,
    },
  };
}

async function errorBody(result: Awaited<ReturnType<typeof authenticateApiRequest>>) {
  if (result.ok) throw new Error("Expected authentication to fail");
  return result.response.json();
}

describe("API bearer authentication", () => {
  it.each([
    { authorization: undefined, case: "missing header" },
    { authorization: "Basic abc", case: "wrong scheme" },
    { authorization: "Bearer malformed", case: "malformed token" },
  ])("returns the same 401 contract for $case", async ({ authorization }) => {
    const lookup = vi.fn();
    const result = await authenticateApiRequest(
      request(authorization),
      "files:read",
      { pepper: PEPPER, lookup, schedule: vi.fn() },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
      expect(result.response.headers.get("WWW-Authenticate")).toBe("Bearer");
      expect((await result.response.json()).error).toMatchObject({
        code: "invalid_token",
        message: "The API token is missing or invalid.",
      });
    }
  });

  it("does not reveal whether a token ID or digest was wrong", async () => {
    const valid = fixture();
    const unknown = await authenticateApiRequest(
      request(`Bearer ${valid.generated.plaintext}`),
      "files:read",
      { pepper: PEPPER, lookup: async () => null, schedule: vi.fn() },
    );
    const wrongDigestFixture = fixture({ tokenHash: "0".repeat(64) });
    const wrongDigest = await authenticateApiRequest(
      request(`Bearer ${wrongDigestFixture.generated.plaintext}`),
      "files:read",
      {
        pepper: PEPPER,
        lookup: async () => wrongDigestFixture.record,
        schedule: vi.fn(),
      },
    );

    expect((await errorBody(unknown)).error.message).toBe(
      (await errorBody(wrongDigest)).error.message,
    );
  });

  it.each([
    { revokedAt: new Date("2026-09-01T00:00:00Z") },
    { expiresAt: new Date("2026-09-13T00:00:00Z") },
  ])("rejects revoked or expired credentials", async (override) => {
    const value = fixture(override);
    const result = await authenticateApiRequest(
      request(`Bearer ${value.generated.plaintext}`),
      "files:read",
      {
        pepper: PEPPER,
        now: new Date("2026-09-14T00:00:00Z"),
        lookup: async () => value.record,
        schedule: vi.fn(),
      },
    );
    expect(result.ok).toBe(false);
  });

  it("returns 403 when the token lacks the requested scope", async () => {
    const value = fixture();
    const result = await authenticateApiRequest(
      request(`Bearer ${value.generated.plaintext}`),
      "files:delete",
      { pepper: PEPPER, lookup: async () => value.record, schedule: vi.fn() },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
      expect((await result.response.json()).error.code).toBe("insufficient_scope");
    }
  });

  it("returns an owner principal and schedules stale usage metadata", async () => {
    const value = fixture({ lastUsedAt: new Date("2026-09-14T11:00:00Z") });
    const touch = vi.fn(async () => undefined);
    const scheduled: Array<() => void | Promise<void>> = [];
    const result = await authenticateApiRequest(
      request(`Bearer ${value.generated.plaintext}`),
      "files:read",
      {
        pepper: PEPPER,
        now: new Date("2026-09-14T12:00:00Z"),
        lookup: async () => value.record,
        touch,
        schedule: (work) => scheduled.push(work),
      },
    );

    expect(result).toMatchObject({
      ok: true,
      principal: { userId: "user-1", tokenId: "token-1", scopes: ["files:read"] },
    });
    expect(scheduled).toHaveLength(1);
    await scheduled[0]();
    expect(touch).toHaveBeenCalledWith("token-1", new Date("2026-09-14T12:00:00Z"));
  });

  it("does not schedule a write when last use is recent", async () => {
    const value = fixture({ lastUsedAt: new Date("2026-09-14T11:58:00Z") });
    const schedule = vi.fn();
    await authenticateApiRequest(
      request(`Bearer ${value.generated.plaintext}`),
      "files:read",
      {
        pepper: PEPPER,
        now: new Date("2026-09-14T12:00:00Z"),
        lookup: async () => value.record,
        schedule,
      },
    );
    expect(schedule).not.toHaveBeenCalled();
  });
});
