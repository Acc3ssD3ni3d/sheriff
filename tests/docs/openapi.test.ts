import { describe, expect, it } from "vitest";
import { parse, validate } from "@readme/openapi-parser";

describe("public API contract", () => {
  it("is a valid OpenAPI 3.1 document with every supported operation", async () => {
    const validation = await validate("public/openapi.yaml");
    expect(validation.valid).toBe(true);
    const api = await parse("public/openapi.yaml") as {
      openapi: string;
      paths?: Record<string, Record<string, unknown>>;
      components?: { securitySchemes?: Record<string, unknown>; schemas?: Record<string, unknown> };
    };
    expect(api.openapi).toMatch(/^3\.1\./);
    const operations = [
      ["/api/v1/files", "get"], ["/api/v1/files", "post"],
      ["/api/v1/files/{id}", "get"], ["/api/v1/files/{id}", "patch"],
      ["/api/v1/files/{id}", "delete"],
      ["/api/v1/files/{id}/complete", "post"],
      ["/api/v1/files/{id}/download", "get"],
      ["/api/v1/files/{id}/restore", "post"],
    ] as const;
    for (const [path, method] of operations) {
      expect(api.paths?.[path]?.[method]).toBeDefined();
    }
    expect(api.components?.securitySchemes?.bearerAuth).toBeDefined();
    expect(api.components?.schemas).toMatchObject({ ApiError: {}, File: {}, UploadInitialization: {} });
  });
});
