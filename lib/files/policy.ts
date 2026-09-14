import { sanitizeFilename } from "@/lib/utils";

const MIME_BY_EXTENSION: Record<string, readonly string[]> = {
  txt: ["text/plain"],
  csv: ["text/csv", "application/csv"],
  json: ["application/json"],
  pdf: ["application/pdf"],
  png: ["image/png"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  gif: ["image/gif"],
  webp: ["image/webp"],
  svg: ["image/svg+xml"],
  mp3: ["audio/mpeg"],
  wav: ["audio/wav", "audio/x-wav"],
  m4a: ["audio/mp4", "audio/x-m4a"],
  mp4: ["video/mp4"],
  webm: ["video/webm"],
  mov: ["video/quicktime"],
  zip: ["application/zip", "application/x-zip-compressed"],
  gz: ["application/gzip", "application/x-gzip"],
  doc: ["application/msword"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  xls: ["application/vnd.ms-excel"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
};

export interface UploadMetadataInput {
  filename: string;
  contentType: string;
  size: number;
}

export class FilePolicyError extends Error {
  constructor(
    public readonly code: "invalid_file" | "file_too_large",
    message: string,
  ) {
    super(message);
    this.name = "FilePolicyError";
  }
}

export function validateUploadMetadata(
  input: UploadMetadataInput,
  maxFileSize: number,
): UploadMetadataInput {
  if (!Number.isSafeInteger(input.size) || input.size <= 0) {
    throw new FilePolicyError("invalid_file", "File size must be a positive integer.");
  }
  if (input.size > maxFileSize) {
    throw new FilePolicyError("file_too_large", "File exceeds the maximum allowed size.");
  }

  const filename = sanitizeFilename(input.filename.trim());
  if (!filename || filename === "." || filename === "..") {
    throw new FilePolicyError("invalid_file", "Filename is invalid.");
  }

  const contentType = input.contentType.trim().toLowerCase();
  if (!contentType || contentType.length > 255) {
    throw new FilePolicyError("invalid_file", "Content type is invalid.");
  }

  const extension = filename.includes(".")
    ? filename.split(".").pop()?.toLowerCase() ?? ""
    : "";
  const allowed = MIME_BY_EXTENSION[extension];
  if (allowed && !allowed.includes(contentType)) {
    throw new FilePolicyError(
      "invalid_file",
      "Content type does not match the filename extension.",
    );
  }
  if (!allowed && contentType !== "application/octet-stream") {
    throw new FilePolicyError(
      "invalid_file",
      "This filename extension and content type are not supported.",
    );
  }

  return { filename, contentType, size: input.size };
}
