import { authorizeApiRequest } from "@/lib/api/authorize";
import { apiError, apiSuccess, createRequestId } from "@/lib/api/errors";
import { publicFile, uploadErrorResponse } from "@/lib/api/files";
import { getOwnedFile } from "@/lib/files/management";
import { createMongoUploadDependencies } from "@/lib/files/mongo-upload";
import { completeUpload, UploadServiceError } from "@/lib/files/service";

interface Context { params: Promise<{ id: string }> }

export async function POST(request: Request, context: Context) {
  const authorization = await authorizeApiRequest(request, "files:write", "upload");
  if (!authorization.ok) return authorization.response;
  const requestId = createRequestId();
  const { id } = await context.params;
  try {
    await completeUpload(createMongoUploadDependencies(), authorization.principal.userId, id);
    const file = await getOwnedFile(authorization.principal.userId, id);
    if (!file) return apiError(404, "file_not_found", "File not found.", { requestId, headers: authorization.headers });
    return apiSuccess(publicFile(file), requestId, { headers: authorization.headers });
  } catch (error) {
    if (error instanceof UploadServiceError) {
      const response = uploadErrorResponse(error, requestId);
      authorization.headers.forEach((value, key) => response.headers.set(key, value));
      return response;
    }
    console.error("API upload completion failed", { requestId, error });
    return apiError(500, "internal_error", "Unable to complete upload.", { requestId, headers: authorization.headers });
  }
}
