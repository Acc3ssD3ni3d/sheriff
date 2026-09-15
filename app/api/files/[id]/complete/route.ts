import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createMongoUploadDependencies } from "@/lib/files/mongo-upload";
import { completeUpload, UploadServiceError } from "@/lib/files/service";

interface Context { params: Promise<{ id: string }> }

export async function POST(_request: Request, context: Context) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  try {
    const file = await completeUpload(createMongoUploadDependencies(), session.user.id, id);
    return NextResponse.json({ success: true, data: file });
  } catch (error) {
    if (error instanceof UploadServiceError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.code === "file_not_found" ? 404 : 409 },
      );
    }
    console.error("Upload completion failed");
    return NextResponse.json({ success: false, error: "Failed to complete upload" }, { status: 500 });
  }
}
