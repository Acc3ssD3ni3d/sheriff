import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { visibilitySchema } from "@/lib/validation";
import { updateOwnedFile } from "@/lib/files/management";

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

    const file = await updateOwnedFile(session.user.id, id, {
      visibility: result.data.visibility,
    });

    if (!file) {
      return NextResponse.json(
        { success: false, error: "File not found or unauthorized" },
        { status: 404 },
      );
    }

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
