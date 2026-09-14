import { authorizeApiRequest } from "@/lib/api/authorize";
import { apiError, apiSuccess, createRequestId } from "@/lib/api/errors";
import { getOwnedFile } from "@/lib/files/management";
import { getPresignedDownloadUrl } from "@/lib/r2";
import { writeApiLog } from "@/lib/api/logging";

interface Context { params: Promise<{ id: string }> }

export async function GET(request: Request, context: Context) {
  const authorization = await authorizeApiRequest(request, "files:read");
  if (!authorization.ok) return authorization.response;
  const requestId = createRequestId();
  try {
    const { id } = await context.params;
    const file = await getOwnedFile(authorization.principal.userId, id);
    if (!file || file.deletedAt) return apiError(404, "file_not_found", "File not found.", { requestId, headers: authorization.headers });
    const url = await getPresignedDownloadUrl(file.storageKey, file.originalName);
    return apiSuccess({ url, expiresIn: 900 }, requestId, { headers: authorization.headers });
  } catch (error) {
    writeApiLog({ requestId, route: "/api/v1/files/:id/download", status: 500, durationMs: 0, tokenId: authorization.principal.tokenId, errorCode: "internal_error", error });
    return apiError(500, "internal_error", "Unable to create download URL.", { requestId, headers: authorization.headers });
  }
}
