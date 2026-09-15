import { describe, expect, it } from "vitest";
import {
  API_SCOPES,
  digestApiToken,
  generateApiToken,
  parseApiToken,
  verifyApiToken,
} from "@/lib/api/tokens";

describe("personal API token primitives", () => {
  it("creates a parseable token without placing plaintext in its record", () => {
    const created = generateApiToken("pepper-for-tests");

    expect(created.plaintext).toMatch(
      /^shf_pat_[A-Za-z0-9_-]{16}_[A-Za-z0-9_-]{43}$/,
    );
    expect(parseApiToken(created.plaintext)).toEqual({
      publicId: created.publicId,
      secret: created.plaintext.slice("shf_pat_".length + 16 + 1),
    });
    expect(JSON.stringify(created.record)).not.toContain(created.plaintext);
    expect(created.prefix).toBe(`shf_pat_${created.publicId.slice(0, 8)}...`);
  });

  it("generates a different credential every time", () => {
    const first = generateApiToken("pepper-for-tests");
    const second = generateApiToken("pepper-for-tests");

    expect(first.plaintext).not.toBe(second.plaintext);
    expect(first.tokenHash).not.toBe(second.tokenHash);
  });

  it.each([
    "",
    "Bearer shf_pat_public_secret",
    "shf_pat_too-short_secret",
    "shf_key_abcdefghijklmnop_abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNO",
    "shf_pat_abcdefghijklmnop_secret-with-invalid!",
  ])("rejects malformed token %j", (value) => {
    expect(parseApiToken(value)).toBeNull();
  });

  it("uses the pepper when digesting and verifies only the original", () => {
    const token =
      "shf_pat_abcdefghijklmnop_abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNO";
    const digest = digestApiToken(token, "pepper-one");

    expect(digest).toMatch(/^[a-f0-9]{64}$/);
    expect(digestApiToken(token, "pepper-two")).not.toBe(digest);
    expect(verifyApiToken(token, digest, "pepper-one")).toBe(true);
    expect(verifyApiToken(`${token}x`, digest, "pepper-one")).toBe(false);
  });

  it("rejects a missing token pepper", () => {
    expect(() => digestApiToken("any-token", "")).toThrow(
      "API_TOKEN_HASH_PEPPER",
    );
  });

  it("exposes only the approved scopes", () => {
    expect(API_SCOPES).toEqual(["files:read", "files:write", "files:delete"]);
  });
});
