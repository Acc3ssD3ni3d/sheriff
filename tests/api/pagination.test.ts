import { describe, expect, it } from "vitest";
import {
  decodeCursor,
  encodeCursor,
  escapeRegex,
  parseListQuery,
} from "@/lib/api/pagination";

describe("file API pagination", () => {
  it("round-trips a deterministic cursor", () => {
    const cursor = encodeCursor({ sortValue: "2026-09-14T00:00:00.000Z", id: "abc" });
    expect(decodeCursor(cursor)).toEqual({
      sortValue: "2026-09-14T00:00:00.000Z",
      id: "abc",
    });
  });

  it.each(["", "not-base64!", Buffer.from("{}").toString("base64url")])(
    "rejects malformed cursor %j",
    (cursor) => expect(() => decodeCursor(cursor)).toThrow("cursor"),
  );

  it("escapes literal search metacharacters", () => {
    expect(escapeRegex("report.*[final]+(1)?")).toBe(
      "report\\.\\*\\[final\\]\\+\\(1\\)\\?",
    );
  });

  it("applies defaults and strict bounds", () => {
    expect(parseListQuery(new URLSearchParams())).toEqual({
      limit: 25,
      cursor: null,
      search: "",
      sort: "createdAt",
      order: "desc",
      include: "active",
    });
    expect(() => parseListQuery(new URLSearchParams({ limit: "101" }))).toThrow();
    expect(() => parseListQuery(new URLSearchParams({ sort: "storageKey" }))).toThrow();
  });
});
