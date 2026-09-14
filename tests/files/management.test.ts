import { describe, expect, it } from "vitest";
import { buildFileListFilter } from "@/lib/files/management";

describe("file list query", () => {
  it("always scopes active files to their owner and completed state", () => {
    expect(buildFileListFilter("507f1f77bcf86cd799439011", {
      search: "report.*",
      include: "active",
    })).toEqual({
      ownerId: "507f1f77bcf86cd799439011",
      status: "completed",
      deletedAt: null,
      originalName: { $regex: "report\\.\\*", $options: "i" },
    });
  });

  it("selects only deleted files for trash", () => {
    expect(buildFileListFilter("user-1", { search: "", include: "trash" })).toEqual({
      ownerId: "user-1",
      status: "completed",
      deletedAt: { $ne: null },
    });
  });
});
