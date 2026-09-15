import { describe, expect, it } from "vitest";
import {
  createPersonalApiToken,
  expiresAtForSelection,
  revokePersonalApiToken,
  type ApiTokenRepository,
  type StoredApiToken,
} from "@/lib/api/token-service";

const NOW = new Date("2026-09-14T12:00:00.000Z");

class MemoryTokenRepository implements ApiTokenRepository {
  records: StoredApiToken[] = [];

  async clearExpiredSlots(ownerId: string, now: Date) {
    for (const record of this.records) {
      if (
        record.ownerId === ownerId &&
        record.activeSlot !== null &&
        record.expiresAt &&
        record.expiresAt <= now
      ) {
        record.activeSlot = null;
      }
    }
  }

  async create(record: StoredApiToken) {
    if (
      this.records.some(
        (candidate) =>
          candidate.ownerId === record.ownerId &&
          candidate.activeSlot === record.activeSlot,
      )
    ) {
      const error = new Error("duplicate slot") as Error & { code: number };
      error.code = 11000;
      throw error;
    }
    this.records.push(record);
    return record;
  }

  async revoke(ownerId: string, id: string, now: Date) {
    const record = this.records.find(
      (candidate) => candidate.ownerId === ownerId && candidate.id === id,
    );
    if (!record) return null;
    record.revokedAt ??= now;
    record.activeSlot = null;
    return record;
  }
}

describe("personal API token lifecycle", () => {
  it.each([
    [30, "2026-10-14T12:00:00.000Z"],
    [90, "2026-12-13T12:00:00.000Z"],
    [365, "2027-09-14T12:00:00.000Z"],
    [null, null],
  ] as const)("converts expiry selection %s", (days, expected) => {
    expect(expiresAtForSelection(days, NOW)?.toISOString() ?? null).toBe(expected);
  });

  it("creates a token in the first free active slot", async () => {
    const repository = new MemoryTokenRepository();

    const result = await createPersonalApiToken(
      repository,
      "user-1",
      { name: "Backup", scopes: ["files:read"], expiresInDays: 90 },
      "pepper-for-tests",
      NOW,
    );

    expect(result.token).toMatch(/^shf_pat_/);
    expect(result.record.activeSlot).toBe(0);
    expect(result.record.tokenHash).not.toBe(result.token);
  });

  it("enforces ten concurrently safe active slots", async () => {
    const repository = new MemoryTokenRepository();
    for (let index = 0; index < 10; index += 1) {
      await createPersonalApiToken(
        repository,
        "user-1",
        { name: `Token ${index}`, scopes: ["files:read"], expiresInDays: null },
        "pepper-for-tests",
        NOW,
      );
    }

    await expect(
      createPersonalApiToken(
        repository,
        "user-1",
        { name: "Eleventh", scopes: ["files:read"], expiresInDays: null },
        "pepper-for-tests",
        NOW,
      ),
    ).rejects.toMatchObject({ code: "token_limit_reached" });
  });

  it("reuses a slot released by expiration", async () => {
    const repository = new MemoryTokenRepository();
    repository.records.push({
      id: "expired",
      ownerId: "user-1",
      name: "Expired",
      publicId: "expired-public-id",
      prefix: "shf_pat_expired...",
      tokenHash: "hash",
      scopes: ["files:read"],
      expiresAt: new Date("2026-09-13T12:00:00.000Z"),
      lastUsedAt: null,
      revokedAt: null,
      activeSlot: 0,
      createdAt: new Date("2026-08-01T00:00:00.000Z"),
    });

    const result = await createPersonalApiToken(
      repository,
      "user-1",
      { name: "Replacement", scopes: ["files:read"], expiresInDays: 30 },
      "pepper-for-tests",
      NOW,
    );

    expect(result.record.activeSlot).toBe(0);
  });

  it("revokes only a token owned by the caller and is idempotent", async () => {
    const repository = new MemoryTokenRepository();
    const created = await createPersonalApiToken(
      repository,
      "user-1",
      { name: "CLI", scopes: ["files:read"], expiresInDays: null },
      "pepper-for-tests",
      NOW,
    );

    expect(
      await revokePersonalApiToken(repository, "user-2", created.record.id, NOW),
    ).toBeNull();
    const revoked = await revokePersonalApiToken(
      repository,
      "user-1",
      created.record.id,
      NOW,
    );
    const revokedAgain = await revokePersonalApiToken(
      repository,
      "user-1",
      created.record.id,
      new Date("2026-09-15T00:00:00.000Z"),
    );

    expect(revoked?.revokedAt).toEqual(NOW);
    expect(revokedAgain?.revokedAt).toEqual(NOW);
    expect(revokedAgain?.activeSlot).toBeNull();
  });
});
