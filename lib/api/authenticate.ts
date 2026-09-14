import { after } from "next/server";
import { connectDB } from "@/lib/db";
import { apiError } from "@/lib/api/errors";
import {
  parseApiToken,
  verifyApiToken,
  type ApiScope,
} from "@/lib/api/tokens";
import { ApiToken } from "@/models/api-token";

export interface ApiPrincipal {
  userId: string;
  tokenId: string;
  scopes: ApiScope[];
}

export interface ApiTokenAuthRecord {
  id: string;
  ownerId: string;
  tokenHash: string;
  scopes: ApiScope[];
  expiresAt: Date | null;
  revokedAt: Date | null;
  lastUsedAt: Date | null;
}

interface AuthenticateDependencies {
  pepper?: string;
  now?: Date;
  lookup?: (publicId: string) => Promise<ApiTokenAuthRecord | null>;
  touch?: (tokenId: string, usedAt: Date) => Promise<void>;
  schedule?: (work: () => void | Promise<void>) => void;
}

type AuthenticationResult =
  | { ok: true; principal: ApiPrincipal }
  | { ok: false; response: Response };

async function lookupToken(publicId: string): Promise<ApiTokenAuthRecord | null> {
  await connectDB();
  const token = await ApiToken.findOne({ publicId }).select("+tokenHash").lean();
  if (!token) return null;
  return {
    id: token._id.toString(),
    ownerId: token.ownerId.toString(),
    tokenHash: token.tokenHash,
    scopes: token.scopes,
    expiresAt: token.expiresAt,
    revokedAt: token.revokedAt,
    lastUsedAt: token.lastUsedAt,
  };
}

async function touchToken(tokenId: string, usedAt: Date): Promise<void> {
  const cutoff = new Date(usedAt.getTime() - 5 * 60 * 1000);
  await ApiToken.updateOne(
    {
      _id: tokenId,
      $or: [{ lastUsedAt: null }, { lastUsedAt: { $lt: cutoff } }],
    },
    { $set: { lastUsedAt: usedAt } },
  );
}

function invalidToken(requestId?: string) {
  return apiError(401, "invalid_token", "The API token is missing or invalid.", {
    requestId,
    headers: { "WWW-Authenticate": "Bearer" },
  });
}

export async function authenticateApiRequest(
  request: Request,
  requiredScope: ApiScope,
  dependencies: AuthenticateDependencies = {},
): Promise<AuthenticationResult> {
  const match = /^Bearer ([^\s]+)$/.exec(request.headers.get("authorization") ?? "");
  if (!match) return { ok: false, response: invalidToken() };

  const parsed = parseApiToken(match[1]);
  if (!parsed) return { ok: false, response: invalidToken() };

  const lookup = dependencies.lookup ?? lookupToken;
  const record = await lookup(parsed.publicId);
  const pepper = dependencies.pepper ?? process.env.API_TOKEN_HASH_PEPPER ?? "";
  if (!record || !verifyApiToken(match[1], record.tokenHash, pepper)) {
    return { ok: false, response: invalidToken() };
  }

  const now = dependencies.now ?? new Date();
  if (record.revokedAt || (record.expiresAt && record.expiresAt <= now)) {
    return { ok: false, response: invalidToken() };
  }

  if (!record.scopes.includes(requiredScope)) {
    return {
      ok: false,
      response: apiError(
        403,
        "insufficient_scope",
        `This operation requires the ${requiredScope} scope.`,
      ),
    };
  }

  const staleBefore = new Date(now.getTime() - 5 * 60 * 1000);
  if (!record.lastUsedAt || record.lastUsedAt < staleBefore) {
    const touch = dependencies.touch ?? touchToken;
    const schedule = dependencies.schedule ?? ((work) => after(work));
    schedule(() => touch(record.id, now));
  }

  return {
    ok: true,
    principal: {
      userId: record.ownerId,
      tokenId: record.id,
      scopes: record.scopes,
    },
  };
}
