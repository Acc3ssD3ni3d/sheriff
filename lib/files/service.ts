import { createHash, randomBytes } from "node:crypto";
import { generateStorageKey } from "@/lib/utils";
import {
  FilePolicyError,
  validateUploadMetadata,
  type UploadMetadataInput,
} from "@/lib/files/policy";

export type ReservationState = "reserved" | "used" | "released";

export interface UploadFileRecord {
  id: string;
  ownerId: string;
  originalName: string;
  storageKey: string;
  mimeType: string;
  size: number;
  status: "uploading" | "completed" | "failed";
  reservationState: ReservationState;
  uploadExpiresAt: Date;
  idempotencyKeyHash: string | null;
  idempotencyPayloadHash: string | null;
  idempotencyExpiresAt: Date | null;
}

export interface UploadServiceDependencies {
  maxFileSize: number;
  storageLimit: number;
  findIdempotent(
    ownerId: string,
    keyHash: string,
    now: Date,
  ): Promise<UploadFileRecord | null>;
  reserve(record: UploadFileRecord): Promise<UploadFileRecord | null>;
  getOwned(ownerId: string, id: string): Promise<UploadFileRecord | null>;
  finalize(id: string): Promise<UploadFileRecord>;
  failAndRelease(id: string): Promise<UploadFileRecord>;
  createUploadUrl(
    storageKey: string,
    contentType: string,
    size: number,
  ): Promise<string>;
  headObject(
    storageKey: string,
  ): Promise<{ size: number; contentType: string } | null>;
  deleteObject(storageKey: string): Promise<void>;
}

export type UploadErrorCode =
  | "invalid_file"
  | "file_too_large"
  | "quota_exceeded"
  | "idempotency_conflict"
  | "file_not_found"
  | "invalid_upload_state"
  | "upload_expired"
  | "upload_not_found"
  | "upload_verification_failed";

export class UploadServiceError extends Error {
  constructor(
    public readonly code: UploadErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "UploadServiceError";
  }
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function payloadHash(input: UploadMetadataInput): string {
  return sha256(JSON.stringify([input.filename, input.contentType, input.size]));
}

async function uploadResponse(
  dependencies: UploadServiceDependencies,
  record: UploadFileRecord,
) {
  return {
    fileId: record.id,
    uploadUrl: await dependencies.createUploadUrl(
      record.storageKey,
      record.mimeType,
      record.size,
    ),
    method: "PUT" as const,
    headers: { "Content-Type": record.mimeType },
    expiresAt: record.uploadExpiresAt,
  };
}

export async function initializeUpload(
  dependencies: UploadServiceDependencies,
  ownerId: string,
  rawInput: UploadMetadataInput,
  idempotencyKey: string | null,
  now = new Date(),
) {
  let input: UploadMetadataInput;
  try {
    input = validateUploadMetadata(rawInput, dependencies.maxFileSize);
  } catch (error) {
    if (error instanceof FilePolicyError) {
      throw new UploadServiceError(error.code, error.message);
    }
    throw error;
  }

  const keyHash = idempotencyKey ? sha256(idempotencyKey) : null;
  const requestHash = payloadHash(input);
  if (keyHash) {
    const previous = await dependencies.findIdempotent(ownerId, keyHash, now);
    if (previous) {
      if (previous.idempotencyPayloadHash !== requestHash) {
        throw new UploadServiceError(
          "idempotency_conflict",
          "The idempotency key was already used for another upload.",
        );
      }
      return uploadResponse(dependencies, previous);
    }
  }

  const id = randomBytes(12).toString("hex");
  const record: UploadFileRecord = {
    id,
    ownerId,
    originalName: input.filename,
    storageKey: generateStorageKey(ownerId, input.filename),
    mimeType: input.contentType,
    size: input.size,
    status: "uploading",
    reservationState: "reserved",
    uploadExpiresAt: new Date(now.getTime() + 15 * 60 * 1000),
    idempotencyKeyHash: keyHash,
    idempotencyPayloadHash: keyHash ? requestHash : null,
    idempotencyExpiresAt: keyHash
      ? new Date(now.getTime() + 24 * 60 * 60 * 1000)
      : null,
  };

  const reserved = await dependencies.reserve(record);
  if (!reserved) {
    throw new UploadServiceError("quota_exceeded", "Storage quota exceeded.");
  }
  if (
    keyHash &&
    reserved.idempotencyPayloadHash &&
    reserved.idempotencyPayloadHash !== requestHash
  ) {
    throw new UploadServiceError(
      "idempotency_conflict",
      "The idempotency key was already used for another upload.",
    );
  }
  return uploadResponse(dependencies, reserved);
}

export async function completeUpload(
  dependencies: UploadServiceDependencies,
  ownerId: string,
  fileId: string,
  now = new Date(),
): Promise<UploadFileRecord> {
  const file = await dependencies.getOwned(ownerId, fileId);
  if (!file) {
    throw new UploadServiceError("file_not_found", "File not found.");
  }
  if (file.status === "completed" && file.reservationState === "used") {
    return file;
  }
  if (file.status !== "uploading" || file.reservationState !== "reserved") {
    throw new UploadServiceError("invalid_upload_state", "Upload cannot be completed.");
  }
  if (file.uploadExpiresAt <= now) {
    await dependencies.failAndRelease(file.id);
    await dependencies.deleteObject(file.storageKey).catch(() => undefined);
    throw new UploadServiceError("upload_expired", "Upload reservation expired.");
  }

  const object = await dependencies.headObject(file.storageKey);
  if (!object) {
    await dependencies.failAndRelease(file.id);
    throw new UploadServiceError("upload_not_found", "Uploaded object was not found.");
  }
  if (object.size !== file.size || object.contentType !== file.mimeType) {
    await dependencies.failAndRelease(file.id);
    await dependencies.deleteObject(file.storageKey).catch(() => undefined);
    throw new UploadServiceError(
      "upload_verification_failed",
      "Uploaded object does not match the reservation.",
    );
  }

  return dependencies.finalize(file.id);
}

export async function cancelUpload(
  dependencies: UploadServiceDependencies,
  ownerId: string,
  fileId: string,
): Promise<UploadFileRecord> {
  const file = await dependencies.getOwned(ownerId, fileId);
  if (!file) throw new UploadServiceError("file_not_found", "File not found.");
  if (file.status !== "uploading" || file.reservationState !== "reserved") {
    throw new UploadServiceError("invalid_upload_state", "Upload cannot be cancelled.");
  }
  const failed = await dependencies.failAndRelease(file.id);
  await dependencies.deleteObject(file.storageKey).catch(() => undefined);
  return failed;
}
