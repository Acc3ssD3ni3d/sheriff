import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { apiError, apiSuccess, createRequestId } from "@/lib/api/errors";
import {
  ApiTokenServiceError,
  createPersonalApiToken,
  type ApiTokenRepository,
  type StoredApiToken,
} from "@/lib/api/token-service";
import { createApiTokenSchema } from "@/lib/validation";
import { ApiToken } from "@/models/api-token";
import { rateLimitHeaders } from "@/lib/api/rate-limit";
import { consumeTokenCreationLimit } from "@/lib/api/token-creation-limit";
import { getServerEnv } from "@/lib/env";

function serializeToken(token: {
  _id?: unknown;
  id?: string;
  name: string;
  prefix: string;
  scopes: string[];
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: token.id ?? String(token._id),
    name: token.name,
    prefix: token.prefix,
    scopes: token.scopes,
    expiresAt: token.expiresAt,
    lastUsedAt: token.lastUsedAt,
    revokedAt: token.revokedAt,
    createdAt: token.createdAt,
  };
}

const repository: ApiTokenRepository = {
  async clearExpiredSlots(ownerId, now) {
    await ApiToken.updateMany(
      { ownerId, activeSlot: { $ne: null }, expiresAt: { $ne: null, $lte: now } },
      { $set: { activeSlot: null } },
    );
  },
  async create(record) {
    const created = await ApiToken.create({ ...record, _id: record.id });
    return {
      ...record,
      id: created._id.toString(),
    };
  },
  async revoke(ownerId, id, now) {
    const existing = await ApiToken.findOne({ _id: id, ownerId }).select("+tokenHash");
    if (!existing) return null;
    if (!existing.revokedAt) {
      existing.revokedAt = now;
      existing.activeSlot = null;
      await existing.save();
    }
    return {
      id: existing._id.toString(),
      ownerId: existing.ownerId.toString(),
      name: existing.name,
      publicId: existing.publicId,
      tokenHash: existing.tokenHash,
      prefix: existing.prefix,
      scopes: existing.scopes,
      expiresAt: existing.expiresAt,
      lastUsedAt: existing.lastUsedAt,
      revokedAt: existing.revokedAt,
      activeSlot: existing.activeSlot,
      createdAt: existing.createdAt,
    } satisfies StoredApiToken;
  },
};

export async function GET() {
  const requestId = createRequestId();
  const session = await auth();
  if (!session?.user?.id) {
    return apiError(401, "unauthorized", "Sign in is required.", { requestId });
  }

  await connectDB();
  const tokens = await ApiToken.find({ ownerId: session.user.id })
    .select("-tokenHash -publicId -activeSlot")
    .sort({ createdAt: -1 })
    .lean();

  return apiSuccess(tokens.map(serializeToken), requestId);
}

export async function POST(request: Request) {
  const requestId = createRequestId();
  const session = await auth();
  if (!session?.user?.id) {
    return apiError(401, "unauthorized", "Sign in is required.", { requestId });
  }

  const tokenCreationLimit = await consumeTokenCreationLimit(session.user.id);
  if (!tokenCreationLimit.allowed) {
    return apiError(
      429,
      "rate_limit_exceeded",
      "Too many token creation attempts. Try again later.",
      {
        requestId,
        headers: rateLimitHeaders(tokenCreationLimit),
      },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "invalid_json", "Request body must be valid JSON.", {
      requestId,
    });
  }

  const parsed = createApiTokenSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "validation_error", "Token settings are invalid.", {
      requestId,
      details: parsed.error.issues,
    });
  }

  try {
    await connectDB();
    const result = await createPersonalApiToken(
      repository,
      session.user.id,
      parsed.data,
      getServerEnv().API_TOKEN_HASH_PEPPER,
    );
    return apiSuccess(
      { token: result.token, ...serializeToken(result.record) },
      requestId,
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof ApiTokenServiceError) {
      return apiError(409, error.code, error.message, { requestId });
    }
    console.error("Token creation failed", { requestId });
    return apiError(500, "internal_error", "Unable to create token.", {
      requestId,
    });
  }
}
