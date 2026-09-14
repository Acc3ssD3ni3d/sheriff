import { randomBytes } from "node:crypto";
import {
  generateApiToken,
  type ApiScope,
} from "@/lib/api/tokens";

export type TokenExpirySelection = 30 | 90 | 365 | null;

export interface StoredApiToken {
  id: string;
  ownerId: string;
  name: string;
  publicId: string;
  prefix: string;
  tokenHash: string;
  scopes: ApiScope[];
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  activeSlot: number | null;
  createdAt: Date;
}

export interface ApiTokenRepository {
  clearExpiredSlots(ownerId: string, now: Date): Promise<void>;
  create(record: StoredApiToken): Promise<StoredApiToken>;
  revoke(
    ownerId: string,
    id: string,
    now: Date,
  ): Promise<StoredApiToken | null>;
}

export interface CreatePersonalApiTokenInput {
  name: string;
  scopes: ApiScope[];
  expiresInDays: TokenExpirySelection;
}

export class ApiTokenServiceError extends Error {
  constructor(
    public readonly code: "token_limit_reached",
    message: string,
  ) {
    super(message);
    this.name = "ApiTokenServiceError";
  }
}

export function expiresAtForSelection(
  days: TokenExpirySelection,
  now = new Date(),
): Date | null {
  if (days === null) return null;
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}

function isDuplicateKey(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 11000
  );
}

export async function createPersonalApiToken(
  repository: ApiTokenRepository,
  ownerId: string,
  input: CreatePersonalApiTokenInput,
  pepper: string,
  now = new Date(),
) {
  await repository.clearExpiredSlots(ownerId, now);
  const generated = generateApiToken(pepper);

  for (let activeSlot = 0; activeSlot < 10; activeSlot += 1) {
    const record: StoredApiToken = {
      id: randomBytes(12).toString("hex"),
      ownerId,
      name: input.name,
      publicId: generated.publicId,
      prefix: generated.prefix,
      tokenHash: generated.tokenHash,
      scopes: input.scopes,
      expiresAt: expiresAtForSelection(input.expiresInDays, now),
      lastUsedAt: null,
      revokedAt: null,
      activeSlot,
      createdAt: now,
    };

    try {
      return {
        token: generated.plaintext,
        record: await repository.create(record),
      };
    } catch (error) {
      if (!isDuplicateKey(error)) throw error;
    }
  }

  throw new ApiTokenServiceError(
    "token_limit_reached",
    "Revoke an existing token before creating another.",
  );
}

export function revokePersonalApiToken(
  repository: ApiTokenRepository,
  ownerId: string,
  id: string,
  now = new Date(),
) {
  return repository.revoke(ownerId, id, now);
}
