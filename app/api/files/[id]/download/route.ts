import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { File } from "@/models/file";
import { getPresignedDownloadUrl } from "@/lib/r2";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = await auth();

    await connectDB();
    const file = await File.findById(id);

    if (!file || file.status !== "completed") {
      return NextResponse.json(
        { success: false, error: "File not found or not ready" },
        { status: 404 },
      );
    }

    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");
    const shouldRedirect = searchParams.get("redirect") === "true";

    const isOwner = session?.user?.id === file.ownerId.toString();
    const isPublic = file.visibility === "public";
    const hasValidToken = token && file.shareToken === token;

    if (!isOwner && !isPublic && !hasValidToken) {
      return NextResponse.json(
        { success: false, error: "Unauthorized access" },
        { status: 403 },
      );
    }

    // Generate signed download URL from R2
    const downloadUrl = await getPresignedDownloadUrl(
      file.storageKey,
      file.originalName,
    );

    // If direct link from share page, 302 redirect directly to R2 download stream
    if (shouldRedirect) {
      return NextResponse.redirect(downloadUrl);
    }

    return NextResponse.json({
      success: true,
      data: {
        downloadUrl,
        filename: file.originalName,
      },
    });
  } catch (error) {
    console.error("Download error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate download link" },
      { status: 500 },
    );
  }
}
