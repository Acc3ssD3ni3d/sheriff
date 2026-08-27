import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { File } from "@/models/file";
import { getPresignedUploadUrl } from "@/lib/r2";
import { fileInitUploadSchema } from "@/lib/validation";
import { generateStorageKey, sanitizeFilename } from "@/lib/utils";
import mongoose from "mongoose";

const SYSTEM_STORAGE_LIMIT_BYTES = 9.5 * 1024 * 1024 * 1024; // 9.5 GB max system safeguard

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
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const order = searchParams.get("order") === "asc" ? 1 : -1;

    await connectDB();

    const query: Record<string, unknown> = {
      ownerId: session.user.id,
      status: "completed",
      deletedAt: null,
    };

    if (search) {
      query.originalName = { $regex: search, $options: "i" };
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
        // Increased from 100MB to 10GB for realistic free tier capacity
        userStorageLimit: 10 * 1024 * 1024 * 1024,
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

    const { originalName, mimeType, size } = result.data;

    await connectDB();

    // System-wide 9.5 GB free-tier aggregate check
    const systemAgg = await File.aggregate([
      { $match: { status: "completed", deletedAt: null } },
      { $group: { _id: null, totalBytes: { $sum: "$size" } } },
    ]);
    const systemBytesUsed = systemAgg[0]?.totalBytes || 0;

    if (systemBytesUsed + size > SYSTEM_STORAGE_LIMIT_BYTES) {
      return NextResponse.json(
        {
          success: false,
          error: "Storage capacity reached. Please try again later.",
        },
        { status: 403 },
      );
    }

    const sanitizedName = sanitizeFilename(originalName);
    const storageKey = generateStorageKey(session.user.id, sanitizedName);

    const newFile = await File.create({
      ownerId: session.user.id,
      originalName: sanitizedName,
      storageKey,
      mimeType,
      size,
      status: "uploading",
      visibility: "private",
    });

    const uploadUrl = await getPresignedUploadUrl(storageKey);

    return NextResponse.json(
      {
        success: true,
        data: {
          fileId: newFile._id.toString(),
          uploadUrl,
          storageKey,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Init upload error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to initiate upload" },
      { status: 500 },
    );
  }
}
