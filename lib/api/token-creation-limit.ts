import {
  consumeRateLimit,
  RATE_LIMITS,
  type RateLimitRepository,
} from "@/lib/api/rate-limit";

export function consumeTokenCreationLimit(
  userId: string,
  repository?: RateLimitRepository,
  now?: Date,
) {
  return consumeRateLimit(repository, {
    key: `token-creation:${userId}`,
    ...RATE_LIMITS.tokenCreation,
    now,
  });
}
