import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { File } from "@/models/file";
import { fileInitUploadSchema } from "@/lib/validation";
import mongoose from "mongoose";
import { createMongoUploadDependencies } from "@/lib/files/mongo-upload";
import { initializeUpload, UploadServiceError } from "@/lib/files/service";
import { getFileLimits } from "@/lib/files/config";
import { escapeRegex } from "@/lib/api/pagination";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const requestedSort = searchParams.get("sortBy") || "createdAt";
    const sortBy = ["createdAt", "originalName", "size"].includes(requestedSort)
      ? requestedSort
      : "createdAt";
    const order = searchParams.get("order") === "asc" ? 1 : -1;

    await connectDB();

    const query: Record<string, unknown> = {
      ownerId: session.user.id,
      status: "completed",
      deletedAt: null,
    };

    if (search) {
      query.originalName = { $regex: escapeRegex(search.slice(0, 200)), $options: "i" };
    }

    const files = await File.find(query)
      .sort({ [sortBy]: order })
      .lean();

    // Per-user storage calculation
    const userAgg = await File.aggregate([
      {
        $match: {
          ownerId: new mongoose.Types.ObjectId(session.user.id),
          status: "completed",
          deletedAt: null,
        },
      },
      { $group: { _id: null, totalBytes: { $sum: "$size" } } },
    ]);
    const userBytesUsed = userAgg[0]?.totalBytes || 0;

    return NextResponse.json({
      success: true,
      data: files,
      stats: {
        userBytesUsed,
        userStorageLimit: getFileLimits().storageLimit,
      },
    });
  } catch (error) {
    console.error("List files error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch files" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const body = await req.json();
    const result = fileInitUploadSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error.issues[0]?.message || "Invalid payload",
        },
        { status: 400 },
      );
    }

    const upload = await initializeUpload(
      createMongoUploadDependencies(),
      session.user.id,
      {
        filename: result.data.originalName,
        contentType: result.data.mimeType,
        size: result.data.size,
      },
      req.headers.get("idempotency-key"),
    );

    return NextResponse.json(
      {
        success: true,
        data: {
          ...upload,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof UploadServiceError) {
      const status = error.code === "file_too_large" ? 413 : error.code === "invalid_file" ? 400 : 409;
      return NextResponse.json({ success: false, error: error.message, code: error.code }, { status });
    }
    console.error("Init upload error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to initiate upload" },
      { status: 500 },
    );
  }
}
