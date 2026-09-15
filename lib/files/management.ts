import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { decodeCursor, encodeCursor, escapeRegex } from "@/lib/api/pagination";
import { File } from "@/models/file";
import { generateShareToken, sanitizeFilename } from "@/lib/utils";
import { headR2Object } from "@/lib/r2";

interface BaseListInput {
  search: string;
  include: "active" | "trash";
}

export function buildFileListFilter(ownerId: string, input: BaseListInput) {
  return {
    ownerId,
    status: "completed",
    deletedAt: input.include === "trash" ? { $ne: null } : null,
    ...(input.search
      ? { originalName: { $regex: escapeRegex(input.search), $options: "i" } }
      : {}),
  };
}

export interface ListFilesInput extends BaseListInput {
  limit: number;
  cursor: string | null;
  sort: "createdAt" | "originalName" | "size";
  order: "asc" | "desc";
}

export async function listOwnedFiles(ownerId: string, input: ListFilesInput) {
  await connectDB();
  const direction = input.order === "asc" ? 1 : -1;
  const filter: Record<string, unknown> = buildFileListFilter(ownerId, input);
  if (input.cursor) {
    const cursor = decodeCursor(input.cursor);
    const comparison = direction === 1 ? "$gt" : "$lt";
    filter.$or = [
      { [input.sort]: { [comparison]: cursor.sortValue } },
      { [input.sort]: cursor.sortValue, _id: { [comparison]: cursor.id } },
    ];
  }

  const files = await File.find(filter)
    .sort({ [input.sort]: direction, _id: direction })
    .limit(input.limit + 1)
    .lean();
  const hasMore = files.length > input.limit;
  const page = hasMore ? files.slice(0, input.limit) : files;
  const last = page.at(-1);
  return {
    files: page,
    nextCursor:
      hasMore && last
        ? encodeCursor({
            sortValue:
              input.sort === "createdAt"
                ? last.createdAt.toISOString()
                : last[input.sort],
            id: last._id.toString(),
          })
        : null,
  };
}

export async function getOwnedFile(ownerId: string, id: string) {
  if (!mongoose.isValidObjectId(id)) return null;
  await connectDB();
  return File.findOne({ _id: id, ownerId, status: "completed" });
}

export async function updateOwnedFile(
  ownerId: string,
  id: string,
  update: { filename?: string; visibility?: "public" | "private" },
) {
  const file = await getOwnedFile(ownerId, id);
  if (!file || file.deletedAt) return null;
  if (update.filename !== undefined) {
    const name = sanitizeFilename(update.filename.trim());
    if (!name) throw new Error("invalid_filename");
    file.originalName = name;
  }
  if (update.visibility !== undefined) {
    file.visibility = update.visibility;
    file.shareToken =
      update.visibility === "public" ? file.shareToken || generateShareToken() : null;
  }
  await file.save();
  return file;
}

export async function softDeleteOwnedFile(ownerId: string, id: string) {
  if (!mongoose.isValidObjectId(id)) return null;
  await connectDB();
  return File.findOneAndUpdate(
    { _id: id, ownerId, status: "completed", deletedAt: null },
    {
      $set: {
        deletedAt: new Date(),
        visibility: "private",
        shareToken: null,
      },
    },
    { new: true },
  );
}

export async function restoreOwnedFile(ownerId: string, id: string) {
  if (!mongoose.isValidObjectId(id)) return null;
  await connectDB();
  const file = await File.findOne({
    _id: id,
    ownerId,
    status: "completed",
    deletedAt: { $ne: null },
  });
  if (!file || !(await headR2Object(file.storageKey))) return null;
  return File.findOneAndUpdate(
    { _id: id, ownerId, status: "completed", deletedAt: { $ne: null } },
    { $set: { deletedAt: null } },
    { new: true },
  );
}
