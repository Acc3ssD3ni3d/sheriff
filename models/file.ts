import mongoose, { Schema, Document, Model } from "mongoose";

export type FileVisibility = "public" | "private";
export type FileStatus = "uploading" | "completed" | "failed";

export interface IFileDocument extends Document {
  ownerId: mongoose.Types.ObjectId;
  originalName: string;
  storageKey: string;
  mimeType: string;
  size: number;
  visibility: FileVisibility;
  shareToken?: string | null;
  status: FileStatus;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const fileSchema = new Schema<IFileDocument>(
  {
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Owner is required"],
    },
    originalName: {
      type: String,
      required: [true, "Original filename is required"],
      trim: true,
    },
    storageKey: {
      type: String,
      required: [true, "Storage key is required"],
      unique: true,
    },
    mimeType: {
      type: String,
      required: [true, "MIME type is required"],
    },
    size: {
      type: Number,
      required: [true, "File size is required"],
      min: [0, "File size cannot be negative"],
    },
    visibility: {
      type: String,
      enum: ["public", "private"],
      default: "private",
    },
    shareToken: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ["uploading", "completed", "failed"],
      default: "uploading",
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

fileSchema.index({ ownerId: 1, createdAt: -1 });
fileSchema.index(
  { shareToken: 1 },
  {
    unique: true,
    partialFilterExpression: { shareToken: { $type: "string" } },
  },
);

// Delete cached model in dev mode so schema modifications always re-register
if (process.env.NODE_ENV === "development" && mongoose.models.File) {
  delete mongoose.models.File;
}

export const File: Model<IFileDocument> =
  mongoose.models.File || mongoose.model<IFileDocument>("File", fileSchema);
