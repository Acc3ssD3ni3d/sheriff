import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { File } from "@/models/file";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    await connectDB();

    const files = await File.find({
      ownerId: session.user.id,
      status: "completed",
      deletedAt: { $ne: null },
    })
      .sort({ deletedAt: -1 })
      .lean();

    return NextResponse.json({ success: true, data: files });
  } catch (error) {
    console.error("List trash error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch trash" },
      { status: 500 },
    );
  }
}
