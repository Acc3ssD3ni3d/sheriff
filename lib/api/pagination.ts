import { z } from "zod";

export interface FileCursor {
  sortValue: string | number;
  id: string;
}

const cursorSchema = z.object({
  v: z.literal(1),
  sortValue: z.union([z.string(), z.number()]),
  id: z.string().min(1),
});

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().min(1).nullable().default(null),
  search: z.string().max(200).default(""),
  sort: z.enum(["createdAt", "originalName", "size"]).default("createdAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
  include: z.enum(["active", "trash"]).default("active"),
});

export function encodeCursor(cursor: FileCursor): string {
  return Buffer.from(JSON.stringify({ v: 1, ...cursor }), "utf8").toString(
    "base64url",
  );
}

export function decodeCursor(value: string): FileCursor {
  try {
    const decoded = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    const result = cursorSchema.parse(decoded);
    return { sortValue: result.sortValue, id: result.id };
  } catch {
    throw new Error("Invalid pagination cursor.");
  }
}

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function parseListQuery(searchParams: URLSearchParams) {
  return listQuerySchema.parse({
    limit: searchParams.get("limit") ?? undefined,
    cursor: searchParams.get("cursor"),
    search: searchParams.get("search") ?? undefined,
    sort: searchParams.get("sort") ?? undefined,
    order: searchParams.get("order") ?? undefined,
    include: searchParams.get("include") ?? undefined,
  });
}
