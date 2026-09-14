import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { deleteFromR2 } from "@/lib/r2";
import { File } from "@/models/file";
import { StorageUsage } from "@/models/storage-usage";

interface DeletableFile {
  id: string;
  storageKey: string;
  size: number;
}

export interface PermanentDeletionDependencies {
  getOwned(ownerId: string, id: string): Promise<DeletableFile | null>;
  deleteObject(key: string): Promise<void>;
  deleteRecordAndReleaseUsage(file: DeletableFile, ownerId: string): Promise<void>;
  markFailure(id: string): Promise<void>;
}

export class FileDeletionError extends Error {
  constructor(public readonly code: "file_not_found" | "storage_delete_failed") {
    super(code === "file_not_found" ? "File not found." : "Storage deletion failed; retry later.");
    this.name = "FileDeletionError";
  }
}

export async function permanentlyDeleteFile(
  dependencies: PermanentDeletionDependencies,
  ownerId: string,
  id: string,
) {
  const file = await dependencies.getOwned(ownerId, id);
  if (!file) throw new FileDeletionError("file_not_found");
  try {
    await dependencies.deleteObject(file.storageKey);
  } catch {
    await dependencies.markFailure(file.id);
    throw new FileDeletionError("storage_delete_failed");
  }
  await dependencies.deleteRecordAndReleaseUsage(file, ownerId);
}

export function createMongoDeletionDependencies(): PermanentDeletionDependencies {
  return {
    async getOwned(ownerId, id) {
      if (!mongoose.isValidObjectId(id)) return null;
      await connectDB();
      const file = await File.findOne({
        _id: id,
        ownerId,
        status: "completed",
        deletedAt: { $ne: null },
      });
      return file ? { id: file._id.toString(), storageKey: file.storageKey, size: file.size } : null;
    },
    deleteObject: deleteFromR2,
    async deleteRecordAndReleaseUsage(file, ownerId) {
      await connectDB();
      await mongoose.connection.transaction(async (session) => {
        const removed = await File.deleteOne({ _id: file.id, ownerId }, { session });
        if (removed.deletedCount === 1) {
          await StorageUsage.updateOne(
            { ownerId },
            { $inc: { usedBytes: -file.size } },
            { session },
          );
        }
      });
    },
    async markFailure(id) {
      await connectDB();
      await File.updateOne({ _id: id }, { $set: { deletionState: "deletion_failed" } });
    },
  };
}
