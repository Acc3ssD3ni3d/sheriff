import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface IStorageUsageDocument extends Document {
  ownerId: mongoose.Types.ObjectId;
  usedBytes: number;
  reservedBytes: number;
  initializedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const storageUsageSchema = new Schema<IStorageUsageDocument>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    usedBytes: { type: Number, required: true, min: 0, default: 0 },
    reservedBytes: { type: Number, required: true, min: 0, default: 0 },
    initializedAt: { type: Date, required: true },
  },
  { timestamps: true },
);

export const StorageUsage: Model<IStorageUsageDocument> =
  mongoose.models.StorageUsage ||
  mongoose.model<IStorageUsageDocument>("StorageUsage", storageUsageSchema);
