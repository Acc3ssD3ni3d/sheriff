import { describe, expect, it } from "vitest";
import { apiError, apiSuccess } from "@/lib/api/errors";

describe("API responses", () => {
  it("keeps the stable success envelope and request ID header", async () => {
    const response = apiSuccess({ id: "file-1" }, "req_fixed");

    expect(response.headers.get("X-Request-Id")).toBe("req_fixed");
    expect(await response.json()).toEqual({
      data: { id: "file-1" },
      requestId: "req_fixed",
    });
  });

  it("keeps the stable error envelope", async () => {
    const response = apiError(403, "insufficient_scope", "Missing scope.", {
      requestId: "req_fixed",
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: {
        code: "insufficient_scope",
        message: "Missing scope.",
        requestId: "req_fixed",
      },
    });
  });

  it("preserves supplied headers while adding the request ID", () => {
    const response = apiSuccess({ ok: true }, "req_fixed", {
      headers: { "RateLimit-Limit": "120" },
    });

    expect(response.headers.get("RateLimit-Limit")).toBe("120");
    expect(response.headers.get("X-Request-Id")).toBe("req_fixed");
  });
});
