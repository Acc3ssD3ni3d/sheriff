const REQUIRED_PRODUCTION_KEYS = [
  "API_TOKEN_HASH_PEPPER",
  "AUTH_SECRET",
  "CLEANUP_SECRET",
  "MONGODB_URI",
  "R2_ACCESS_KEY_ID",
  "R2_ACCOUNT_ID",
  "R2_BUCKET_NAME",
  "R2_SECRET_ACCESS_KEY",
] as const;

type Environment = Record<string, string | undefined>;

function positiveInteger(
  env: Environment,
  key: string,
  fallback: number,
): number {
  const raw = env[key];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${key} must be a positive safe integer`);
  }
  return value;
}

export function getServerEnv(
  env: Environment = process.env,
  nodeEnv = process.env.NODE_ENV,
) {
  if (nodeEnv === "production") {
    const missing = REQUIRED_PRODUCTION_KEYS.filter((key) => !env[key]);
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
    }
  }

  return {
    MONGODB_URI: env.MONGODB_URI ?? "",
    AUTH_SECRET: env.AUTH_SECRET ?? "",
    API_TOKEN_HASH_PEPPER: env.API_TOKEN_HASH_PEPPER ?? "",
    CLEANUP_SECRET: env.CLEANUP_SECRET ?? "",
    R2_ACCOUNT_ID: env.R2_ACCOUNT_ID ?? "",
    R2_ACCESS_KEY_ID: env.R2_ACCESS_KEY_ID ?? "",
    R2_SECRET_ACCESS_KEY: env.R2_SECRET_ACCESS_KEY ?? "",
    R2_BUCKET_NAME: env.R2_BUCKET_NAME ?? "",
    R2_ENDPOINT: env.R2_ENDPOINT,
    MAX_FILE_SIZE_BYTES: positiveInteger(env, "MAX_FILE_SIZE_BYTES", 5 * 1024 ** 3),
    USER_STORAGE_LIMIT_BYTES: positiveInteger(
      env,
      "USER_STORAGE_LIMIT_BYTES",
      10 * 1024 ** 3,
    ),
  };
}
