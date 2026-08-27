import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { File } from "@/models/file";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(_req: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const { id } = await params;
    await connectDB();

    const file = await File.findOne({ _id: id, ownerId: session.user.id });
    if (!file) {
      return NextResponse.json(
        { success: false, error: "File not found" },
        { status: 404 },
      );
    }

    file.deletedAt = null;
    await file.save();

    return NextResponse.json({ success: true, message: "File restored" });
  } catch (error) {
    console.error("Restore error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to restore file" },
      { status: 500 },
    );
  }
}
