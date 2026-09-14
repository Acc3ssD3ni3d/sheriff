import { apiError } from "@/lib/api/errors";
import {
  UploadServiceError,
  type UploadErrorCode,
} from "@/lib/files/service";

interface FileDocumentLike {
  _id: unknown;
  originalName: string;
  mimeType: string;
  size: number;
  status: string;
  visibility: string;
  shareToken?: string | null;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const uploadStatus: Record<UploadErrorCode, number> = {
  invalid_file: 400,
  file_too_large: 413,
  quota_exceeded: 409,
  idempotency_conflict: 409,
  file_not_found: 404,
  invalid_upload_state: 409,
  upload_expired: 410,
  upload_not_found: 409,
  upload_verification_failed: 409,
};

export function publicFile<T extends FileDocumentLike>(file: T) {
  return {
    id: String(file._id),
    filename: file.originalName,
    contentType: file.mimeType,
    size: file.size,
    status: file.status,
    visibility: file.visibility,
    shareToken: file.shareToken ?? null,
    deletedAt: file.deletedAt ?? null,
    createdAt: file.createdAt,
    updatedAt: file.updatedAt,
  };
}

export function uploadErrorResponse(error: UploadServiceError, requestId: string) {
  return apiError(uploadStatus[error.code], error.code, error.message, {
    requestId,
  });
}
