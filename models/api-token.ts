import mongoose, { Schema, type Document, type Model } from "mongoose";
import { API_SCOPES, type ApiScope } from "@/lib/api/tokens";

export interface IApiTokenDocument extends Document {
  ownerId: mongoose.Types.ObjectId;
  name: string;
  publicId: string;
  tokenHash: string;
  prefix: string;
  scopes: ApiScope[];
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  activeSlot: number | null;
  createdAt: Date;
  updatedAt: Date;
}

const apiTokenSchema = new Schema<IApiTokenDocument>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 80 },
    publicId: { type: String, required: true, unique: true },
    tokenHash: { type: String, required: true, select: false },
    prefix: { type: String, required: true },
    scopes: [{ type: String, enum: API_SCOPES, required: true }],
    expiresAt: { type: Date, default: null },
    lastUsedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
    activeSlot: { type: Number, min: 0, max: 9, default: null },
  },
  { timestamps: true },
);

apiTokenSchema.index({ ownerId: 1, createdAt: -1 });
apiTokenSchema.index({ ownerId: 1, revokedAt: 1 });
apiTokenSchema.index(
  { ownerId: 1, activeSlot: 1 },
  {
    unique: true,
    partialFilterExpression: { activeSlot: { $type: "number" } },
  },
);

export const ApiToken: Model<IApiTokenDocument> =
  mongoose.models.ApiToken ||
  mongoose.model<IApiTokenDocument>("ApiToken", apiTokenSchema);
