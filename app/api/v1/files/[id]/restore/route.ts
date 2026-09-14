import { authorizeApiRequest } from "@/lib/api/authorize";
import { apiError, apiSuccess, createRequestId } from "@/lib/api/errors";
import { publicFile } from "@/lib/api/files";
import { restoreOwnedFile } from "@/lib/files/management";

interface Context { params: Promise<{ id: string }> }

export async function POST(request: Request, context: Context) {
  const authorization = await authorizeApiRequest(request, "files:delete");
  if (!authorization.ok) return authorization.response;
  const requestId = createRequestId();
  const { id } = await context.params;
  const file = await restoreOwnedFile(authorization.principal.userId, id);
  if (!file) return apiError(404, "file_not_found", "File not found.", { requestId, headers: authorization.headers });
  return apiSuccess(publicFile(file), requestId, { headers: authorization.headers });
}
