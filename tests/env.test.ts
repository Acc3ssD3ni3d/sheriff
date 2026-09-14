import { describe, expect, it } from "vitest";
import { getServerEnv } from "@/lib/env";

const valid = {
  MONGODB_URI: "mongodb://localhost/test",
  AUTH_SECRET: "auth",
  API_TOKEN_HASH_PEPPER: "pepper",
  CLEANUP_SECRET: "cleanup",
  R2_ACCOUNT_ID: "account",
  R2_ACCESS_KEY_ID: "access",
  R2_SECRET_ACCESS_KEY: "secret",
  R2_BUCKET_NAME: "bucket",
};

describe("server environment", () => {
  it("reports missing production variables without printing values", () => {
    expect(() => getServerEnv({}, "production")).toThrow(
      "Missing required environment variables: API_TOKEN_HASH_PEPPER, AUTH_SECRET, CLEANUP_SECRET, MONGODB_URI, R2_ACCESS_KEY_ID, R2_ACCOUNT_ID, R2_BUCKET_NAME, R2_SECRET_ACCESS_KEY",
    );
  });

  it("uses byte defaults and accepts safe positive overrides", () => {
    expect(getServerEnv(valid, "production")).toMatchObject({
      MAX_FILE_SIZE_BYTES: 5 * 1024 ** 3,
      USER_STORAGE_LIMIT_BYTES: 10 * 1024 ** 3,
    });
    expect(getServerEnv({
      ...valid,
      MAX_FILE_SIZE_BYTES: "1000",
      USER_STORAGE_LIMIT_BYTES: "2000",
    }, "production")).toMatchObject({
      MAX_FILE_SIZE_BYTES: 1000,
      USER_STORAGE_LIMIT_BYTES: 2000,
    });
  });

  it.each(["0", "-1", "1.5", "not-a-number"])(
    "rejects unsafe byte configuration %s",
    (value) => {
      expect(() => getServerEnv({ ...valid, MAX_FILE_SIZE_BYTES: value }, "production"))
        .toThrow("MAX_FILE_SIZE_BYTES");
    },
  );
});
