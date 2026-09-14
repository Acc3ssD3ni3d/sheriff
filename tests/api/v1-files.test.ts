import { describe, expect, it } from "vitest";
import {
  publicFile,
  uploadErrorResponse,
} from "@/lib/api/files";
import { UploadServiceError } from "@/lib/files/service";

describe("versioned file API contract", () => {
  it("does not expose storage internals in file metadata", () => {
    const result = publicFile({
      _id: "file-1",
      originalName: "report.pdf",
      mimeType: "application/pdf",
      size: 100,
      status: "completed",
      visibility: "private",
      shareToken: null,
      deletedAt: null,
      createdAt: new Date("2026-09-14T00:00:00Z"),
      updatedAt: new Date("2026-09-14T00:00:00Z"),
      storageKey: "user/private-object",
      ownerId: "user-1",
    });

    expect(result).toEqual({
      id: "file-1",
      filename: "report.pdf",
      contentType: "application/pdf",
      size: 100,
      status: "completed",
      visibility: "private",
      shareToken: null,
      deletedAt: null,
      createdAt: new Date("2026-09-14T00:00:00Z"),
      updatedAt: new Date("2026-09-14T00:00:00Z"),
    });
    expect(result).not.toHaveProperty("storageKey");
    expect(result).not.toHaveProperty("ownerId");
  });

  it.each([
    ["file_too_large", 413],
    ["invalid_file", 400],
    ["quota_exceeded", 409],
    ["idempotency_conflict", 409],
    ["file_not_found", 404],
    ["upload_verification_failed", 409],
  ] as const)("maps %s to HTTP %s", async (code, status) => {
    const response = uploadErrorResponse(
      new UploadServiceError(code, "Safe message"),
      "req_fixed",
    );
    expect(response.status).toBe(status);
    expect((await response.json()).error).toMatchObject({ code, requestId: "req_fixed" });
  });
});
