import { authorizeApiRequest } from "@/lib/api/authorize";
import { apiError, apiSuccess, createRequestId } from "@/lib/api/errors";
import { getOwnedFile } from "@/lib/files/management";
import { getPresignedDownloadUrl } from "@/lib/r2";

interface Context { params: Promise<{ id: string }> }

export async function GET(request: Request, context: Context) {
  const authorization = await authorizeApiRequest(request, "files:read");
  if (!authorization.ok) return authorization.response;
  const requestId = createRequestId();
  const { id } = await context.params;
  const file = await getOwnedFile(authorization.principal.userId, id);
  if (!file || file.deletedAt) return apiError(404, "file_not_found", "File not found.", { requestId, headers: authorization.headers });
  const url = await getPresignedDownloadUrl(file.storageKey, file.originalName);
  return apiSuccess({ url, expiresIn: 900 }, requestId, { headers: authorization.headers });
}
