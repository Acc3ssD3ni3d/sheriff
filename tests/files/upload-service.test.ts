import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  cancelUpload,
  completeUpload,
  initializeUpload,
  UploadServiceError,
  type UploadFileRecord,
  type UploadServiceDependencies,
} from "@/lib/files/service";

const NOW = new Date("2026-09-14T12:00:00Z");

function memoryDependencies(): UploadServiceDependencies & {
  files: UploadFileRecord[];
  used: number;
  reserved: number;
  object: { size: number; contentType: string } | null;
} {
  const state = {
    files: [] as UploadFileRecord[],
    used: 0,
    reserved: 0,
    object: null as { size: number; contentType: string } | null,
  };
  return Object.assign(state, {
    maxFileSize: 10_000,
    storageLimit: 20_000,
    async findIdempotent(ownerId: string, keyHash: string, now: Date) {
      return state.files.find((file) =>
        file.ownerId === ownerId && file.idempotencyKeyHash === keyHash &&
        !!file.idempotencyExpiresAt && file.idempotencyExpiresAt > now) ?? null;
    },
    async reserve(input: UploadFileRecord) {
      if (state.used + state.reserved + input.size > 20_000) return null;
      state.reserved += input.size;
      state.files.push(input);
      return input;
    },
    async getOwned(ownerId: string, id: string) {
      return state.files.find((file) => file.ownerId === ownerId && file.id === id) ?? null;
    },
    async finalize(id: string) {
      const file = state.files.find((candidate) => candidate.id === id)!;
      if (file.reservationState === "used") return file;
      state.reserved -= file.size;
      state.used += file.size;
      file.status = "completed";
      file.reservationState = "used";
      return file;
    },
    async failAndRelease(id: string) {
      const file = state.files.find((candidate) => candidate.id === id)!;
      if (file.reservationState === "reserved") state.reserved -= file.size;
      file.status = "failed";
      file.reservationState = "released";
      return file;
    },
    async createUploadUrl() {
      return "https://r2.example/signed-put";
    },
    async headObject() {
      return state.object;
    },
    async deleteObject() {},
  } satisfies UploadServiceDependencies);
}

const input = {
  filename: "report.pdf",
  contentType: "application/pdf",
  size: 1000,
};

describe("verified upload service", () => {
  it("reserves quota and returns a short-lived direct upload", async () => {
    const dependencies = memoryDependencies();
    const result = await initializeUpload(dependencies, "user-1", input, null, NOW);

    expect(result).toMatchObject({
      uploadUrl: "https://r2.example/signed-put",
      method: "PUT",
      headers: { "Content-Type": "application/pdf" },
    });
    expect(result.expiresAt.toISOString()).toBe("2026-09-14T12:15:00.000Z");
    expect(dependencies.reserved).toBe(1000);
  });

  it("replays the same idempotency key and rejects another payload", async () => {
    const dependencies = memoryDependencies();
    const first = await initializeUpload(dependencies, "user-1", input, "retry-1", NOW);
    const repeated = await initializeUpload(dependencies, "user-1", input, "retry-1", NOW);
    expect(repeated.fileId).toBe(first.fileId);
    expect(dependencies.reserved).toBe(1000);

    await expect(initializeUpload(
      dependencies,
      "user-1",
      { ...input, size: 1001 },
      "retry-1",
      NOW,
    )).rejects.toMatchObject({ code: "idempotency_conflict" });
  });

  it("does not reserve bytes beyond the user quota", async () => {
    const dependencies = memoryDependencies();
    dependencies.used = 19_500;
    await expect(initializeUpload(dependencies, "user-1", input, null, NOW))
      .rejects.toMatchObject({ code: "quota_exceeded" });
  });

  it.each([
    [null, "upload_not_found"],
    [{ size: 999, contentType: "application/pdf" }, "upload_verification_failed"],
    [{ size: 1000, contentType: "image/png" }, "upload_verification_failed"],
  ] as const)("rejects an invalid R2 object", async (object, code) => {
    const dependencies = memoryDependencies();
    const initialized = await initializeUpload(dependencies, "user-1", input, null, NOW);
    dependencies.object = object;

    await expect(completeUpload(
      dependencies,
      "user-1",
      initialized.fileId,
      new Date("2026-09-14T12:05:00Z"),
    )).rejects.toMatchObject({ code });
    expect(dependencies.reserved).toBe(0);
  });

  it("finalizes verified bytes exactly once", async () => {
    const dependencies = memoryDependencies();
    const initialized = await initializeUpload(dependencies, "user-1", input, null, NOW);
    dependencies.object = { size: 1000, contentType: "application/pdf" };

    await completeUpload(dependencies, "user-1", initialized.fileId, NOW);
    await completeUpload(dependencies, "user-1", initialized.fileId, NOW);
    expect({ used: dependencies.used, reserved: dependencies.reserved }).toEqual({
      used: 1000,
      reserved: 0,
    });
  });

  it("expires reservations before finalization", async () => {
    const dependencies = memoryDependencies();
    const initialized = await initializeUpload(dependencies, "user-1", input, null, NOW);
    dependencies.object = { size: 1000, contentType: "application/pdf" };

    await expect(completeUpload(
      dependencies,
      "user-1",
      initialized.fileId,
      new Date("2026-09-14T12:16:00Z"),
    )).rejects.toMatchObject({ code: "upload_expired" });
    expect(dependencies.reserved).toBe(0);
  });

  it("hashes idempotency keys instead of storing plaintext", async () => {
    const dependencies = memoryDependencies();
    await initializeUpload(dependencies, "user-1", input, "private-retry-key", NOW);
    expect(dependencies.files[0].idempotencyKeyHash).toBe(
      createHash("sha256").update("private-retry-key").digest("hex"),
    );
    expect(JSON.stringify(dependencies.files[0])).not.toContain("private-retry-key");
  });

  it("cancels an uploading reservation and releases quota", async () => {
    const dependencies = memoryDependencies();
    const initialized = await initializeUpload(dependencies, "user-1", input, null, NOW);
    const cancelled = await cancelUpload(dependencies, "user-1", initialized.fileId);
    expect(cancelled.status).toBe("failed");
    expect(dependencies.reserved).toBe(0);
  });

  it("uses typed service errors", () => {
    expect(new UploadServiceError("quota_exceeded", "Quota exceeded"))
      .toMatchObject({ code: "quota_exceeded" });
  });
});
