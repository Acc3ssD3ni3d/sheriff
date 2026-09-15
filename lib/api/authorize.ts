import { apiError } from "@/lib/api/errors";
import {
  authenticateApiRequest,
  type ApiPrincipal,
} from "@/lib/api/authenticate";
import {
  consumeRateLimit,
  rateLimitHeaders,
  RATE_LIMITS,
  type RateLimitRepository,
  type RateLimitResult,
} from "@/lib/api/rate-limit";
import type { ApiScope } from "@/lib/api/tokens";

type Bucket = keyof typeof RATE_LIMITS;
type AuthResult =
  | { ok: true; principal: ApiPrincipal }
  | { ok: false; response: Response };

interface Dependencies {
  authenticate?: (request: Request, scope: ApiScope) => Promise<AuthResult>;
  limit?: (
    repository: RateLimitRepository | undefined,
    options: { key: string; limit: number; windowMs: number; now?: Date },
  ) => Promise<RateLimitResult>;
  repository?: RateLimitRepository;
  now?: Date;
}

export type AuthorizationResult =
  | { ok: true; principal: ApiPrincipal; headers: Headers }
  | { ok: false; response: Response };

export async function authorizeApiRequest(
  request: Request,
  scope: ApiScope,
  bucket: Bucket = "general",
  dependencies: Dependencies = {},
): Promise<AuthorizationResult> {
  const authentication = await (dependencies.authenticate ?? authenticateApiRequest)(
    request,
    scope,
  );
  if (!authentication.ok) return authentication;

  const policy = RATE_LIMITS[bucket];
  const now = dependencies.now ?? new Date();
  const rateLimit = await (dependencies.limit ?? consumeRateLimit)(
    dependencies.repository,
    {
      key: `api:${bucket}:${authentication.principal.tokenId}`,
      ...policy,
      now,
    },
  );
  const headers = rateLimitHeaders(rateLimit, now);
  if (!rateLimit.allowed) {
    return {
      ok: false,
      response: apiError(429, "rate_limit_exceeded", "Too many requests.", {
        headers,
      }),
    };
  }

  return { ok: true, principal: authentication.principal, headers };
}
