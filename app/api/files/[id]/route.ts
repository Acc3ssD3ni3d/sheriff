import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { File } from "@/models/file";
import { deleteFromR2 } from "@/lib/r2";
import { renameFileSchema } from "@/lib/validation";

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

    const isOwner = session?.user?.id === file.ownerId.toString();
    if (!isOwner && file.visibility !== "public") {
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

    if (body.status) {
      if (!["completed", "failed"].includes(body.status)) {
        return NextResponse.json(
          { success: false, error: "Invalid status" },
          { status: 400 },
        );
      }
      const updated = await File.findOneAndUpdate(
        { _id: id, ownerId: session.user.id },
        { $set: { status: body.status } },
        { new: true },
      );
      return NextResponse.json({ success: true, data: updated });
    }

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
        await deleteFromR2(file.storageKey);
      } catch (r2Err) {
        console.error("R2 delete warning:", r2Err);
      }
      await File.deleteOne({ _id: id, ownerId: session.user.id });
      return NextResponse.json({
        success: true,
        message: "File permanently deleted",
      });
    }

    // Direct atomic write to MongoDB
    await File.updateOne(
      { _id: id, ownerId: session.user.id },
      { $set: { deletedAt: new Date() } },
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
