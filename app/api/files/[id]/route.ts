import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { File } from "@/models/file";
import { renameFileSchema } from "@/lib/validation";
import { cancelUpload, UploadServiceError } from "@/lib/files/service";
import { createMongoUploadDependencies } from "@/lib/files/mongo-upload";
import {
  createMongoDeletionDependencies,
  FileDeletionError,
  permanentlyDeleteFile,
} from "@/lib/files/deletion";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = await auth();
    await connectDB();

    const file = await File.findById(id);
    if (!file) {
      return NextResponse.json(
        { success: false, error: "File not found" },
        { status: 404 },
      );
    }

    const token = req.nextUrl.searchParams.get("token");
    const isOwner = session?.user?.id === file.ownerId.toString();
    const hasValidToken = Boolean(
      token && file.visibility === "public" && file.shareToken === token,
    );
    if (file.deletedAt || file.status !== "completed" || (!isOwner && !hasValidToken)) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 403 },
      );
    }

    return NextResponse.json({ success: true, data: file });
  } catch (error) {
    console.error("Get file error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch file" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const { id } = await params;
    const body = await req.json();

    await connectDB();

    if (body.name) {
      const result = renameFileSchema.safeParse({ name: body.name });
      if (!result.success) {
        return NextResponse.json(
          {
            success: false,
            error: result.error.issues[0]?.message || "Invalid name",
          },
          { status: 400 },
        );
      }
      const updated = await File.findOneAndUpdate(
        { _id: id, ownerId: session.user.id },
        { $set: { originalName: result.data.name } },
        { new: true },
      );
      return NextResponse.json({ success: true, data: updated });
    }

    return NextResponse.json(
      { success: false, error: "Nothing to update" },
      { status: 400 },
    );
  } catch (error) {
    console.error("Update file error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update file" },
      { status: 500 },
    );
  }
}

// Atomic soft-delete or permanent delete
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const permanent = searchParams.get("permanent") === "true";

    await connectDB();

    const file = await File.findOne({ _id: id, ownerId: session.user.id });
    if (!file) {
      return NextResponse.json(
        { success: false, error: "File not found" },
        { status: 404 },
      );
    }

    if (permanent) {
      try {
        await permanentlyDeleteFile(
          createMongoDeletionDependencies(),
          session.user.id,
          id,
        );
      } catch (error) {
        if (error instanceof FileDeletionError) {
          return NextResponse.json(
            { success: false, error: error.message, code: error.code },
            { status: error.code === "file_not_found" ? 404 : 502 },
          );
        }
        throw error;
      }
      return NextResponse.json({
        success: true,
        message: "File permanently deleted",
      });
    }

    if (file.status === "uploading") {
      try {
        await cancelUpload(createMongoUploadDependencies(), session.user.id, id);
        return NextResponse.json({ success: true, message: "Upload cancelled" });
      } catch (error) {
        if (error instanceof UploadServiceError) {
          return NextResponse.json(
            { success: false, error: error.message, code: error.code },
            { status: error.code === "file_not_found" ? 404 : 409 },
          );
        }
        throw error;
      }
    }

    // Direct atomic write to MongoDB
    await File.updateOne(
      { _id: id, ownerId: session.user.id },
      { $set: { deletedAt: new Date(), visibility: "private", shareToken: null } },
    );

    return NextResponse.json({ success: true, message: "File moved to trash" });
  } catch (error) {
    console.error("Delete file error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete file" },
      { status: 500 },
    );
  }
}
