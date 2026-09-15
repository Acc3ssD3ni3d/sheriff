import { createHash, timingSafeEqual } from "node:crypto";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { deleteFromR2 } from "@/lib/r2";
import { File } from "@/models/file";
import { StorageUsage } from "@/models/storage-usage";

interface ExpiredUpload { id: string; storageKey: string }

export interface CleanupDependencies {
  findExpired(now: Date): Promise<ExpiredUpload[]>;
  release(id: string): Promise<boolean>;
  deleteObject(key: string): Promise<void>;
}

export function secretsMatch(presented: string, expected: string): boolean {
  if (!presented || !expected) return false;
  const left = createHash("sha256").update(presented).digest();
  const right = createHash("sha256").update(expected).digest();
  return timingSafeEqual(left, right);
}

export async function cleanupExpiredUploads(
  dependencies: CleanupDependencies,
  now = new Date(),
) {
  const candidates = await dependencies.findExpired(now);
  let processed = 0;
  let failed = 0;
  for (const candidate of candidates) {
    const released = await dependencies.release(candidate.id);
    if (!released) continue;
    processed += 1;
    try {
      await dependencies.deleteObject(candidate.storageKey);
    } catch {
      failed += 1;
    }
  }
  return { processed, failed };
}

export function createMongoCleanupDependencies(): CleanupDependencies {
  return {
    async findExpired(now) {
      await connectDB();
      const files = await File.find({
        status: "uploading",
        reservationState: "reserved",
        uploadExpiresAt: { $lte: now },
      }).select("_id storageKey").limit(100).lean();
      return files.map((file) => ({ id: file._id.toString(), storageKey: file.storageKey }));
    },
    async release(id) {
      await connectDB();
      return mongoose.connection.transaction(async (session) => {
        const file = await File.findOneAndUpdate(
          { _id: id, status: "uploading", reservationState: "reserved" },
          { $set: { status: "failed", reservationState: "released" } },
          { new: true, session },
        );
        if (!file) return false;
        await StorageUsage.updateOne(
          { ownerId: file.ownerId, reservedBytes: { $gte: file.size } },
          { $inc: { reservedBytes: -file.size } },
          { session },
        );
        return true;
      });
    },
    deleteObject: deleteFromR2,
  };
}
