import { getServerEnv } from "@/lib/env";

export function getFileLimits() {
  const env = getServerEnv();
  return {
    maxFileSize: env.MAX_FILE_SIZE_BYTES,
    storageLimit: env.USER_STORAGE_LIMIT_BYTES,
  };
}
