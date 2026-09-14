import { describe, expect, it } from "vitest";
import { validateUploadMetadata } from "@/lib/files/policy";

describe("upload metadata policy", () => {
  it("sanitizes a valid filename", () => {
    expect(validateUploadMetadata({
      filename: "quarterly report (final).pdf",
      contentType: "application/pdf",
      size: 1024,
    }, 10_000)).toEqual({
      filename: "quarterly_report_final_.pdf",
      contentType: "application/pdf",
      size: 1024,
    });
  });

  it.each([0, -1, 1.5])("rejects invalid byte length %s", (size) => {
    expect(() => validateUploadMetadata({
      filename: "file.txt",
      contentType: "text/plain",
      size,
    }, 10_000)).toThrow("positive integer");
  });

  it("rejects files above the configured maximum", () => {
    expect(() => validateUploadMetadata({
      filename: "file.txt",
      contentType: "text/plain",
      size: 10_001,
    }, 10_000)).toThrow("maximum");
  });

  it("rejects contradictory known extensions and MIME types", () => {
    expect(() => validateUploadMetadata({
      filename: "invoice.pdf",
      contentType: "image/png",
      size: 100,
    }, 10_000)).toThrow("does not match");
  });

  it("allows unknown extensions only as generic binary data", () => {
    expect(validateUploadMetadata({
      filename: "archive.custom",
      contentType: "application/octet-stream",
      size: 100,
    }, 10_000).contentType).toBe("application/octet-stream");
    expect(() => validateUploadMetadata({
      filename: "archive.custom",
      contentType: "text/html",
      size: 100,
    }, 10_000)).toThrow("not supported");
  });
});
