import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { File } from "@/models/file";
import { visibilitySchema } from "@/lib/validation";
import { generateShareToken } from "@/lib/utils";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PATCH /api/files/[id]/visibility - Toggle public/private & generate/revoke shareToken
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

    const result = visibilitySchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error.issues[0]?.message || "Invalid visibility",
        },
        { status: 400 },
      );
    }

    await connectDB();
    const file = await File.findOne({ _id: id, ownerId: session.user.id });

    if (!file) {
      return NextResponse.json(
        { success: false, error: "File not found or unauthorized" },
        { status: 404 },
      );
    }

    const newVisibility = result.data.visibility;
    file.visibility = newVisibility;

    if (newVisibility === "public") {
      // Generate a shareToken if one doesn't exist yet
      if (!file.shareToken) {
        file.shareToken = generateShareToken();
      }
    } else {
      // Revoke share token when made private
      file.shareToken = null;
    }

    await file.save();

    return NextResponse.json({
      success: true,
      data: {
        id: file._id,
        visibility: file.visibility,
        shareToken: file.shareToken,
      },
    });
  } catch (error) {
    console.error("Visibility toggle error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update visibility" },
      { status: 500 },
    );
  }
}
