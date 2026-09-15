import {
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

export const API_SCOPES = [
  "files:read",
  "files:write",
  "files:delete",
] as const;

export type ApiScope = (typeof API_SCOPES)[number];

export interface ParsedApiToken {
  publicId: string;
  secret: string;
}

const TOKEN_PATTERN = /^shf_pat_([A-Za-z0-9_-]{16})_([A-Za-z0-9_-]{43})$/;

function requirePepper(pepper: string): void {
  if (!pepper) {
    throw new Error("API_TOKEN_HASH_PEPPER is required");
  }
}

export function digestApiToken(token: string, pepper: string): string {
  requirePepper(pepper);
  return createHmac("sha256", pepper).update(token, "utf8").digest("hex");
}

export function parseApiToken(value: string): ParsedApiToken | null {
  const match = TOKEN_PATTERN.exec(value);
  if (!match) return null;
  return { publicId: match[1], secret: match[2] };
}

export function verifyApiToken(
  token: string,
  storedHash: string,
  pepper: string,
): boolean {
  const candidate = Buffer.from(digestApiToken(token, pepper), "hex");
  const expected = Buffer.from(storedHash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

export function generateApiToken(pepper: string) {
  const publicId = randomBytes(12).toString("base64url");
  const secret = randomBytes(32).toString("base64url");
  const plaintext = `shf_pat_${publicId}_${secret}`;
  const prefix = `shf_pat_${publicId.slice(0, 8)}...`;
  const tokenHash = digestApiToken(plaintext, pepper);

  return {
    plaintext,
    publicId,
    prefix,
    tokenHash,
    record: { publicId, prefix, tokenHash },
  };
}
