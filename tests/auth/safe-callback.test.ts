import { describe, expect, it } from "vitest";
import { safeCallbackPath } from "@/lib/auth-callback";

describe("safe auth callback paths", () => {
  it.each([
    ["/dashboard?upload=true", "/dashboard?upload=true"],
    ["https://evil.example", "/dashboard"],
    ["//evil.example", "/dashboard"],
    ["javascript:alert(1)", "/dashboard"],
    ["/\\evil.example", "/dashboard"],
  ])("maps %s safely", (value, expected) => {
    expect(safeCallbackPath(value, "/dashboard")).toBe(expected);
  });
});
