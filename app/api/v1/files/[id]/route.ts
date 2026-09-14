import { authorizeApiRequest } from "@/lib/api/authorize";
import { apiError, apiSuccess, createRequestId } from "@/lib/api/errors";
import { publicFile } from "@/lib/api/files";
import {
  getOwnedFile,
  softDeleteOwnedFile,
  updateOwnedFile,
} from "@/lib/files/management";
import { apiFileUpdateSchema } from "@/lib/validation";

interface Context { params: Promise<{ id: string }> }

export async function GET(request: Request, context: Context) {
  const authorization = await authorizeApiRequest(request, "files:read");
  if (!authorization.ok) return authorization.response;
  const requestId = createRequestId();
  const { id } = await context.params;
  const file = await getOwnedFile(authorization.principal.userId, id);
  if (!file) return apiError(404, "file_not_found", "File not found.", { requestId, headers: authorization.headers });
  return apiSuccess(publicFile(file), requestId, { headers: authorization.headers });
}

export async function PATCH(request: Request, context: Context) {
  const authorization = await authorizeApiRequest(request, "files:write");
  if (!authorization.ok) return authorization.response;
  const requestId = createRequestId();
  try {
    const parsed = apiFileUpdateSchema.safeParse(await request.json());
    if (!parsed.success) return apiError(400, "invalid_request", "Invalid file update.", { requestId, details: parsed.error.flatten(), headers: authorization.headers });
    const { id } = await context.params;
    const file = await updateOwnedFile(authorization.principal.userId, id, parsed.data);
    if (!file) return apiError(404, "file_not_found", "File not found.", { requestId, headers: authorization.headers });
    return apiSuccess(publicFile(file), requestId, { headers: authorization.headers });
  } catch (error) {
    if (error instanceof SyntaxError) return apiError(400, "invalid_json", "Request body must be valid JSON.", { requestId, headers: authorization.headers });
    if (error instanceof Error && error.message === "invalid_filename") return apiError(400, "invalid_filename", "Filename is invalid.", { requestId, headers: authorization.headers });
    console.error("API file update failed", { requestId, error });
    return apiError(500, "internal_error", "Unable to update file.", { requestId, headers: authorization.headers });
  }
}

export async function DELETE(request: Request, context: Context) {
  const authorization = await authorizeApiRequest(request, "files:delete");
  if (!authorization.ok) return authorization.response;
  const requestId = createRequestId();
  const { id } = await context.params;
  const file = await softDeleteOwnedFile(authorization.principal.userId, id);
  if (!file) return apiError(404, "file_not_found", "File not found.", { requestId, headers: authorization.headers });
  return apiSuccess(publicFile(file), requestId, { headers: authorization.headers });
}
