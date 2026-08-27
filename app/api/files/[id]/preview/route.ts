import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { File } from "@/models/file";
import { getPresignedDownloadUrl } from "@/lib/r2";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const token = req.nextUrl.searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { success: false, error: "Missing share token" },
        { status: 400 },
      );
    }

    await connectDB();

    const file = await File.findOne({
      _id: id,
      shareToken: token,
      visibility: "public",
      status: "completed",
      deletedAt: null,
    });

    if (!file) {
      return NextResponse.json(
        { success: false, error: "File not found or access denied" },
        { status: 404 },
      );
    }

    const previewUrl = await getPresignedDownloadUrl(
      file.storageKey,
      file.originalName,
      "inline",
    );

    return NextResponse.redirect(previewUrl, 302);
  } catch (error) {
    console.error("Preview error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate preview" },
      { status: 500 },
    );
  }
}
