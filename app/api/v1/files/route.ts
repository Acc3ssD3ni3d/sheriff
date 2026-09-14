import { ZodError } from "zod";
import { authorizeApiRequest } from "@/lib/api/authorize";
import { apiError, apiSuccess, createRequestId } from "@/lib/api/errors";
import { publicFile, uploadErrorResponse } from "@/lib/api/files";
import { parseListQuery } from "@/lib/api/pagination";
import { listOwnedFiles } from "@/lib/files/management";
import { createMongoUploadDependencies } from "@/lib/files/mongo-upload";
import { initializeUpload, UploadServiceError } from "@/lib/files/service";
import { apiUploadSchema } from "@/lib/validation";

function addHeaders(response: Response, headers: Headers): Response {
  headers.forEach((value, key) => response.headers.set(key, value));
  return response;
}

export async function GET(request: Request) {
  const authorization = await authorizeApiRequest(request, "files:read");
  if (!authorization.ok) return authorization.response;
  const requestId = createRequestId();
  try {
    const query = parseListQuery(new URL(request.url).searchParams);
    const result = await listOwnedFiles(authorization.principal.userId, query);
    return apiSuccess(
      {
        files: result.files.map(publicFile),
        nextCursor: result.nextCursor,
      },
      requestId,
      { headers: authorization.headers },
    );
  } catch (error) {
    if (error instanceof ZodError || (error instanceof Error && error.message === "Invalid pagination cursor.")) {
      return apiError(400, "invalid_request", "Invalid list query.", {
        requestId,
        headers: authorization.headers,
      });
    }
    console.error("API file list failed", { requestId, error });
    return apiError(500, "internal_error", "Unable to list files.", {
      requestId,
      headers: authorization.headers,
    });
  }
}

export async function POST(request: Request) {
  const authorization = await authorizeApiRequest(request, "files:write", "upload");
  if (!authorization.ok) return authorization.response;
  const requestId = createRequestId();
  try {
    const parsed = apiUploadSchema.safeParse(await request.json());
    if (!parsed.success) {
      return apiError(400, "invalid_request", "Invalid upload metadata.", {
        requestId,
        details: parsed.error.flatten(),
        headers: authorization.headers,
      });
    }
    const idempotencyKey = request.headers.get("idempotency-key");
    if (idempotencyKey && idempotencyKey.length > 200) {
      return apiError(400, "invalid_request", "Idempotency-Key must be at most 200 characters.", {
        requestId,
        headers: authorization.headers,
      });
    }
    const upload = await initializeUpload(
      createMongoUploadDependencies(),
      authorization.principal.userId,
      parsed.data,
      idempotencyKey,
    );
    return apiSuccess(upload, requestId, {
      status: 201,
      headers: authorization.headers,
    });
  } catch (error) {
    if (error instanceof UploadServiceError) {
      return addHeaders(uploadErrorResponse(error, requestId), authorization.headers);
    }
    if (error instanceof SyntaxError) {
      return apiError(400, "invalid_json", "Request body must be valid JSON.", {
        requestId,
        headers: authorization.headers,
      });
    }
    console.error("API upload initialization failed", { requestId, error });
    return apiError(500, "internal_error", "Unable to initialize upload.", {
      requestId,
      headers: authorization.headers,
    });
  }
}
