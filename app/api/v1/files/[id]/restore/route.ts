import { authorizeApiRequest } from "@/lib/api/authorize";
import { apiError, apiSuccess, createRequestId } from "@/lib/api/errors";
import { publicFile } from "@/lib/api/files";
import { restoreOwnedFile } from "@/lib/files/management";
import { writeApiLog } from "@/lib/api/logging";

interface Context { params: Promise<{ id: string }> }

export async function POST(request: Request, context: Context) {
  const authorization = await authorizeApiRequest(request, "files:delete");
  if (!authorization.ok) return authorization.response;
  const requestId = createRequestId();
  try {
    const { id } = await context.params;
    const file = await restoreOwnedFile(authorization.principal.userId, id);
    if (!file) return apiError(404, "file_not_found", "File not found.", { requestId, headers: authorization.headers });
    return apiSuccess(publicFile(file), requestId, { headers: authorization.headers });
  } catch (error) {
    writeApiLog({ requestId, route: "/api/v1/files/:id/restore", status: 500, durationMs: 0, tokenId: authorization.principal.tokenId, errorCode: "internal_error", error });
    return apiError(500, "internal_error", "Unable to restore file.", { requestId, headers: authorization.headers });
  }
}
