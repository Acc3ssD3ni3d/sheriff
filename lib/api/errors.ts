import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

type ResponseInitLike = Omit<ResponseInit, "headers"> & {
  headers?: HeadersInit;
};

interface ApiErrorOptions extends ResponseInitLike {
  requestId?: string;
  details?: unknown;
}

export function createRequestId(): string {
  return `req_${randomUUID()}`;
}

function responseHeaders(requestId: string, headers?: HeadersInit): Headers {
  const result = new Headers(headers);
  result.set("X-Request-Id", requestId);
  return result;
}

export function apiSuccess<T>(
  data: T,
  requestId = createRequestId(),
  init: ResponseInitLike = {},
): NextResponse {
  return NextResponse.json(
    { data, requestId },
    {
      ...init,
      headers: responseHeaders(requestId, init.headers),
    },
  );
}

export function apiError(
  status: number,
  code: string,
  message: string,
  options: ApiErrorOptions = {},
): NextResponse {
  const requestId = options.requestId ?? createRequestId();
  const { details, ...init } = options;

  return NextResponse.json(
    {
      error: {
        code,
        message,
        requestId,
        ...(details === undefined ? {} : { details }),
      },
    },
    {
      ...init,
      status,
      headers: responseHeaders(requestId, init.headers),
    },
  );
}
