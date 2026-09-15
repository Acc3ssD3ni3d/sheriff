import mongoose from "mongoose";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { apiError, apiSuccess, createRequestId } from "@/lib/api/errors";
import { ApiToken } from "@/models/api-token";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const requestId = createRequestId();
  const session = await auth();
  if (!session?.user?.id) {
    return apiError(401, "unauthorized", "Sign in is required.", { requestId });
  }

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    return apiError(404, "token_not_found", "Token not found.", { requestId });
  }

  await connectDB();
  const token = await ApiToken.findOne({ _id: id, ownerId: session.user.id });
  if (!token) {
    return apiError(404, "token_not_found", "Token not found.", { requestId });
  }

  if (!token.revokedAt) {
    token.revokedAt = new Date();
    token.activeSlot = null;
    await token.save();
  }

  return apiSuccess({ id, revokedAt: token.revokedAt }, requestId);
}
