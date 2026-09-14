import { connectDB } from "@/lib/db";
import { ApiRateLimit } from "@/models/api-rate-limit";

export interface RateLimitRepository {
  increment(key: string, windowStart: Date, expiresAt: Date): Promise<number>;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: Date;
}

interface RateLimitOptions {
  key: string;
  limit: number;
  windowMs: number;
  now?: Date;
}

const mongooseRateLimits: RateLimitRepository = {
  async increment(key, windowStart, expiresAt) {
    await connectDB();
    try {
      const bucket = await ApiRateLimit.findOneAndUpdate(
        { key, windowStart },
        {
          $inc: { count: 1 },
          $setOnInsert: { expiresAt },
        },
        { upsert: true, new: true },
      );
      return bucket.count;
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === 11000
      ) {
        const bucket = await ApiRateLimit.findOneAndUpdate(
          { key, windowStart },
          { $inc: { count: 1 } },
          { new: true },
        );
        if (bucket) return bucket.count;
      }
      throw error;
    }
  },
};

export async function consumeRateLimit(
  repository: RateLimitRepository = mongooseRateLimits,
  options: RateLimitOptions,
): Promise<RateLimitResult> {
  const now = options.now ?? new Date();
  const windowStartMs = Math.floor(now.getTime() / options.windowMs) * options.windowMs;
  const windowStart = new Date(windowStartMs);
  const resetAt = new Date(windowStartMs + options.windowMs);
  const count = await repository.increment(options.key, windowStart, resetAt);
  return {
    allowed: count <= options.limit,
    limit: options.limit,
    remaining: Math.max(0, options.limit - count),
    resetAt,
  };
}

export function rateLimitHeaders(
  result: RateLimitResult,
  now = new Date(),
): Headers {
  const headers = new Headers({
    "RateLimit-Limit": String(result.limit),
    "RateLimit-Remaining": String(result.remaining),
    "RateLimit-Reset": String(Math.floor(result.resetAt.getTime() / 1000)),
  });
  if (!result.allowed) {
    headers.set(
      "Retry-After",
      String(Math.max(1, Math.ceil((result.resetAt.getTime() - now.getTime()) / 1000))),
    );
  }
  return headers;
}

export const RATE_LIMITS = {
  general: { limit: 120, windowMs: 60_000 },
  upload: { limit: 20, windowMs: 60_000 },
  tokenCreation: { limit: 10, windowMs: 60 * 60_000 },
} as const;
