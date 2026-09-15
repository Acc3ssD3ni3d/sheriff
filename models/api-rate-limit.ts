import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface IApiRateLimitDocument extends Document {
  key: string;
  windowStart: Date;
  count: number;
  expiresAt: Date;
}

const apiRateLimitSchema = new Schema<IApiRateLimitDocument>({
  key: { type: String, required: true },
  windowStart: { type: Date, required: true },
  count: { type: Number, required: true, default: 0 },
  expiresAt: { type: Date, required: true, expires: 0 },
});

apiRateLimitSchema.index({ key: 1, windowStart: 1 }, { unique: true });

export const ApiRateLimit: Model<IApiRateLimitDocument> =
  mongoose.models.ApiRateLimit ||
  mongoose.model<IApiRateLimitDocument>("ApiRateLimit", apiRateLimitSchema);
