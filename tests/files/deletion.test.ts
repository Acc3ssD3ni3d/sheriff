import { describe, expect, it, vi } from "vitest";
import { permanentlyDeleteFile } from "@/lib/files/deletion";

describe("permanent file deletion", () => {
  it("deletes storage before removing metadata and quota", async () => {
    const order: string[] = [];
    await permanentlyDeleteFile({
      getOwned: async () => ({ id: "file-1", storageKey: "key", size: 12 }),
      deleteObject: async () => { order.push("object"); },
      deleteRecordAndReleaseUsage: async () => { order.push("record"); },
      markFailure: vi.fn(),
    }, "user-1", "file-1");
    expect(order).toEqual(["object", "record"]);
  });

  it("retains metadata and marks a retryable failure when storage deletion fails", async () => {
    const remove = vi.fn();
    const markFailure = vi.fn();
    await expect(permanentlyDeleteFile({
      getOwned: async () => ({ id: "file-1", storageKey: "key", size: 12 }),
      deleteObject: async () => { throw new Error("R2 unavailable"); },
      deleteRecordAndReleaseUsage: remove,
      markFailure,
    }, "user-1", "file-1")).rejects.toMatchObject({ code: "storage_delete_failed" });
    expect(remove).not.toHaveBeenCalled();
    expect(markFailure).toHaveBeenCalledWith("file-1", "user-1");
  });
});
