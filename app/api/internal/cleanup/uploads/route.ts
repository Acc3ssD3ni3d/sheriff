import { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";
import {
  cleanupExpiredUploads,
  createMongoCleanupDependencies,
  secretsMatch,
} from "@/lib/files/cleanup";

export async function POST(request: Request) {
  const expected = getServerEnv().CLEANUP_SECRET;
  const match = /^Bearer ([^\s]+)$/.exec(request.headers.get("authorization") ?? "");
  if (!match || !secretsMatch(match[1], expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await cleanupExpiredUploads(createMongoCleanupDependencies());
  return NextResponse.json(result);
}
