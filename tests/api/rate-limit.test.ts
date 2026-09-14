import { describe, expect, it } from "vitest";
import {
  consumeRateLimit,
  rateLimitHeaders,
  type RateLimitRepository,
} from "@/lib/api/rate-limit";
import { consumeTokenCreationLimit } from "@/lib/api/token-creation-limit";

class MemoryRateLimits implements RateLimitRepository {
  counts = new Map<string, number>();

  async increment(key: string, windowStart: Date) {
    const bucket = `${key}:${windowStart.toISOString()}`;
    const count = (this.counts.get(bucket) ?? 0) + 1;
    this.counts.set(bucket, count);
    return count;
  }
}

describe("fixed-window API rate limiting", () => {
  it("counts requests and rejects the first request above the limit", async () => {
    const repository = new MemoryRateLimits();
    const now = new Date("2026-09-14T12:00:30Z");

    expect(await consumeRateLimit(repository, { key: "general:token-1", limit: 2, windowMs: 60_000, now }))
      .toMatchObject({ allowed: true, remaining: 1 });
    expect(await consumeRateLimit(repository, { key: "general:token-1", limit: 2, windowMs: 60_000, now }))
      .toMatchObject({ allowed: true, remaining: 0 });
    expect(await consumeRateLimit(repository, { key: "general:token-1", limit: 2, windowMs: 60_000, now }))
      .toMatchObject({ allowed: false, remaining: 0 });
  });

  it("resets in the next fixed bucket and isolates policy keys", async () => {
    const repository = new MemoryRateLimits();
    await consumeRateLimit(repository, {
      key: "upload:token-1",
      limit: 1,
      windowMs: 60_000,
      now: new Date("2026-09-14T12:00:59Z"),
    });

    expect(await consumeRateLimit(repository, {
      key: "upload:token-1",
      limit: 1,
      windowMs: 60_000,
      now: new Date("2026-09-14T12:01:00Z"),
    })).toMatchObject({ allowed: true });
    expect(await consumeRateLimit(repository, {
      key: "general:token-1",
      limit: 1,
      windowMs: 60_000,
      now: new Date("2026-09-14T12:00:59Z"),
    })).toMatchObject({ allowed: true });
  });

  it("emits standard limit headers and Retry-After only when rejected", () => {
    const accepted = rateLimitHeaders({
      allowed: true,
      limit: 120,
      remaining: 119,
      resetAt: new Date("2026-09-14T12:01:00Z"),
    }, new Date("2026-09-14T12:00:30Z"));
    const rejected = rateLimitHeaders({
      allowed: false,
      limit: 120,
      remaining: 0,
      resetAt: new Date("2026-09-14T12:01:00Z"),
    }, new Date("2026-09-14T12:00:30Z"));

    expect(Object.fromEntries(accepted)).toMatchObject({
      "ratelimit-limit": "120",
      "ratelimit-remaining": "119",
      "ratelimit-reset": "1789387260",
    });
    expect(accepted.has("Retry-After")).toBe(false);
    expect(rejected.get("Retry-After")).toBe("30");
  });

  it("allows ten token creations per user per hour", async () => {
    const repository = new MemoryRateLimits();
    const now = new Date("2026-09-14T12:30:00Z");
    for (let count = 0; count < 10; count += 1) {
      expect((await consumeTokenCreationLimit("user-1", repository, now)).allowed)
        .toBe(true);
    }
    expect((await consumeTokenCreationLimit("user-1", repository, now)).allowed)
      .toBe(false);
    expect((await consumeTokenCreationLimit("user-2", repository, now)).allowed)
      .toBe(true);
  });
});
