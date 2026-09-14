import { describe, expect, it, vi } from "vitest";
import { cleanupExpiredUploads, secretsMatch } from "@/lib/files/cleanup";

describe("stale upload cleanup", () => {
  it("releases each expired reservation and attempts object deletion", async () => {
    const release = vi.fn().mockResolvedValue(true);
    const remove = vi.fn().mockResolvedValue(undefined);
    const result = await cleanupExpiredUploads({
      findExpired: async () => [{ id: "one", storageKey: "a" }, { id: "two", storageKey: "b" }],
      release,
      deleteObject: remove,
    }, new Date("2026-09-14T12:00:00Z"));
    expect(result).toEqual({ processed: 2, failed: 0 });
    expect(release).toHaveBeenCalledTimes(2);
    expect(remove).toHaveBeenCalledTimes(2);
  });

  it("does not delete an object when reservation release lost a race", async () => {
    const remove = vi.fn();
    const result = await cleanupExpiredUploads({
      findExpired: async () => [{ id: "one", storageKey: "a" }],
      release: async () => false,
      deleteObject: remove,
    }, new Date());
    expect(result).toEqual({ processed: 0, failed: 0 });
    expect(remove).not.toHaveBeenCalled();
  });

  it("compares cleanup credentials without prefix matches", () => {
    expect(secretsMatch("correct-secret", "correct-secret")).toBe(true);
    expect(secretsMatch("correct", "correct-secret")).toBe(false);
    expect(secretsMatch("", "correct-secret")).toBe(false);
  });
});
