import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { restoreOwnedFile } from "@/lib/files/management";

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
    const file = await restoreOwnedFile(session.user.id, id);
    if (!file) {
      return NextResponse.json(
        { success: false, error: "File not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, message: "File restored" });
  } catch (error) {
    console.error("Restore error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to restore file" },
      { status: 500 },
    );
  }
}
