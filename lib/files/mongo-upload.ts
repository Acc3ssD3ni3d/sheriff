import mongoose, { type ClientSession } from "mongoose";
import { connectDB } from "@/lib/db";
import { getFileLimits } from "@/lib/files/config";
import type {
  UploadFileRecord,
  UploadServiceDependencies,
} from "@/lib/files/service";
import { deleteFromR2, getPresignedUploadUrl, headR2Object } from "@/lib/r2";
import { File, type IFileDocument } from "@/models/file";
import { StorageUsage } from "@/models/storage-usage";

function toRecord(file: IFileDocument): UploadFileRecord {
  return {
    id: file._id.toString(),
    ownerId: file.ownerId.toString(),
    originalName: file.originalName,
    storageKey: file.storageKey,
    mimeType: file.mimeType,
    size: file.size,
    status: file.status,
    reservationState: file.reservationState ?? "released",
    uploadExpiresAt: file.uploadExpiresAt ?? new Date(0),
    idempotencyKeyHash: file.idempotencyKeyHash ?? null,
    idempotencyPayloadHash: file.idempotencyPayloadHash ?? null,
    idempotencyExpiresAt: file.idempotencyExpiresAt ?? null,
  };
}

async function ensureUsage(ownerId: string): Promise<void> {
  await connectDB();
  if (await StorageUsage.exists({ ownerId })) return;

  const totals = await File.aggregate<{ total: number }>([
    {
      $match: {
        ownerId: new mongoose.Types.ObjectId(ownerId),
        status: "completed",
      },
    },
    { $group: { _id: null, total: { $sum: "$size" } } },
  ]);
  try {
    await StorageUsage.create({
      ownerId,
      usedBytes: totals[0]?.total ?? 0,
      reservedBytes: 0,
      initializedAt: new Date(),
    });
  } catch (error) {
    if (
      typeof error !== "object" ||
      error === null ||
      !("code" in error) ||
      error.code !== 11000
    ) {
      throw error;
    }
  }
}

async function inTransaction<T>(work: (session: ClientSession) => Promise<T>) {
  await connectDB();
  return mongoose.connection.transaction(work);
}

export function createMongoUploadDependencies(): UploadServiceDependencies {
  const limits = getFileLimits();
  return {
    ...limits,
    async findIdempotent(ownerId, keyHash, now) {
      await connectDB();
      const file = await File.findOne({
        ownerId,
        idempotencyKeyHash: keyHash,
        idempotencyExpiresAt: { $gt: now },
      });
      return file ? toRecord(file) : null;
    },
    async reserve(record) {
      await ensureUsage(record.ownerId);
      try {
        return await inTransaction(async (session) => {
          const usage = await StorageUsage.findOneAndUpdate(
            {
              ownerId: record.ownerId,
              $expr: {
                $lte: [
                  { $add: ["$usedBytes", "$reservedBytes", record.size] },
                  limits.storageLimit,
                ],
              },
            },
            { $inc: { reservedBytes: record.size } },
            { new: true, session },
          );
          if (!usage) return null;
          const created = await File.create(
            [
              {
                _id: record.id,
                ownerId: record.ownerId,
                originalName: record.originalName,
                storageKey: record.storageKey,
                mimeType: record.mimeType,
                size: record.size,
                status: record.status,
                visibility: "private",
                reservationState: record.reservationState,
                uploadExpiresAt: record.uploadExpiresAt,
                idempotencyKeyHash: record.idempotencyKeyHash,
                idempotencyPayloadHash: record.idempotencyPayloadHash,
                idempotencyExpiresAt: record.idempotencyExpiresAt,
              },
            ],
            { session },
          );
          return toRecord(created[0]);
        });
      } catch (error) {
        if (
          record.idempotencyKeyHash &&
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === 11000
        ) {
          const existing = await File.findOne({
            ownerId: record.ownerId,
            idempotencyKeyHash: record.idempotencyKeyHash,
            idempotencyExpiresAt: { $gt: new Date() },
          });
          if (existing) return toRecord(existing);
        }
        throw error;
      }
    },
    async getOwned(ownerId, id) {
      await connectDB();
      if (!mongoose.isValidObjectId(id)) return null;
      const file = await File.findOne({ _id: id, ownerId });
      return file ? toRecord(file) : null;
    },
    async finalize(id) {
      return inTransaction(async (session) => {
        const file = await File.findOneAndUpdate(
          { _id: id, status: "uploading", reservationState: "reserved" },
          {
            $set: {
              status: "completed",
              reservationState: "used",
              uploadExpiresAt: null,
            },
          },
          { new: true, session },
        );
        if (!file) {
          const existing = await File.findById(id).session(session);
          if (!existing) throw new Error("Upload disappeared during finalization");
          return toRecord(existing);
        }
        await StorageUsage.updateOne(
          { ownerId: file.ownerId, reservedBytes: { $gte: file.size } },
          { $inc: { reservedBytes: -file.size, usedBytes: file.size } },
          { session },
        );
        return toRecord(file);
      });
    },
    async failAndRelease(id) {
      return inTransaction(async (session) => {
        const file = await File.findOneAndUpdate(
          { _id: id, reservationState: "reserved" },
          { $set: { status: "failed", reservationState: "released" } },
          { new: true, session },
        );
        if (!file) {
          const existing = await File.findById(id).session(session);
          if (!existing) throw new Error("Upload disappeared during release");
          return toRecord(existing);
        }
        await StorageUsage.updateOne(
          { ownerId: file.ownerId, reservedBytes: { $gte: file.size } },
          { $inc: { reservedBytes: -file.size } },
          { session },
        );
        return toRecord(file);
      });
    },
    createUploadUrl: getPresignedUploadUrl,
    headObject: headR2Object,
    deleteObject: deleteFromR2,
  };
}
