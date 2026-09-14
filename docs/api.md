# Sheriff Personal File API

The versioned API lets a signed-in Sheriff user automate access to **only their own files**. Create and revoke personal access tokens at `/profile`. A token is displayed once, stored by Sheriff only as an HMAC digest, and may have `files:read`, `files:write`, and/or `files:delete` permissions.

The machine-readable contract is [`/openapi.yaml`](../public/openapi.yaml). There is intentionally no permissive CORS policy; use this API from a server, CLI, or trusted native application rather than exposing a token in browser JavaScript.

## Authentication and limits

Send `Authorization: Bearer shf_pat_...` on every `/api/v1` request. Missing, malformed, expired, revoked, and unknown tokens all receive `401 invalid_token`. A valid token without the required permission receives `403 insufficient_scope`.

- General operations: 120 requests per token per minute.
- Upload initialization and completion: 20 requests per token per minute.
- Token creation in the profile: 10 attempts per user per hour.
- Responses expose `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`, and a correlation `X-Request-Id`. A `429` also includes `Retry-After`.

Keep the token out of shell history where possible. One local approach is to prompt without echoing:

```bash
read -s SHERIFF_API_TOKEN
export SHERIFF_API_TOKEN
export SHERIFF_BASE_URL=http://localhost:3000
```

## Direct upload flow

First reserve quota and request a 15-minute R2 PUT URL. The idempotency key makes retries of the same payload safe for 24 hours.

```bash
curl -sS "$SHERIFF_BASE_URL/api/v1/files" \
  -H "Authorization: Bearer $SHERIFF_API_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: upload-$(date +%s)" \
  --data '{"filename":"hello.txt","contentType":"text/plain","size":12}' \
  > upload.json
```

Read `data.fileId`, `data.uploadUrl`, and the exact `data.headers` from that response. PUT exactly the declared number of bytes and content type to the temporary URL, without sending the Sheriff bearer token to R2:

```bash
UPLOAD_URL=$(jq -r '.data.uploadUrl' upload.json)
FILE_ID=$(jq -r '.data.fileId' upload.json)
curl -X PUT "$UPLOAD_URL" -H "Content-Type: text/plain" --data-binary @hello.txt
curl -X POST "$SHERIFF_BASE_URL/api/v1/files/$FILE_ID/complete" \
  -H "Authorization: Bearer $SHERIFF_API_TOKEN"
```

Completion performs an R2 `HeadObject` check. A missing object, wrong size, wrong content type, expired reservation, or exhausted quota never creates a completed file. Abandoned reservations are released by the authenticated cleanup job after 15 minutes.

## Read, download, and paginate

```bash
curl "$SHERIFF_BASE_URL/api/v1/files?limit=25&sort=createdAt&order=desc&include=active" \
  -H "Authorization: Bearer $SHERIFF_API_TOKEN"

curl "$SHERIFF_BASE_URL/api/v1/files/$FILE_ID" \
  -H "Authorization: Bearer $SHERIFF_API_TOKEN"

curl "$SHERIFF_BASE_URL/api/v1/files/$FILE_ID/download" \
  -H "Authorization: Bearer $SHERIFF_API_TOKEN"
```

Pass the returned `data.nextCursor` as `cursor` for the next page. Download URLs expire after 15 minutes and remain usable until they expire even if the API token is revoked, so treat them as temporary secrets.

## Update, trash, restore, and delete

```bash
curl -X PATCH "$SHERIFF_BASE_URL/api/v1/files/$FILE_ID" \
  -H "Authorization: Bearer $SHERIFF_API_TOKEN" -H "Content-Type: application/json" \
  --data '{"filename":"renamed.txt","visibility":"private"}'

curl -X DELETE "$SHERIFF_BASE_URL/api/v1/files/$FILE_ID" \
  -H "Authorization: Bearer $SHERIFF_API_TOKEN"

curl -X POST "$SHERIFF_BASE_URL/api/v1/files/$FILE_ID/restore" \
  -H "Authorization: Bearer $SHERIFF_API_TOKEN"

curl -X DELETE "$SHERIFF_BASE_URL/api/v1/files/$FILE_ID?permanent=true" \
  -H "Authorization: Bearer $SHERIFF_API_TOKEN"
```

Trash continues to count toward quota. Soft deletion atomically makes a file private and revokes its share token. Permanent deletion is allowed from trash; Sheriff deletes R2 first and retains metadata with a retryable failure state if storage is unavailable.

## Error envelope

Errors use `{ "error": { "code", "message", "requestId", "details"? } }`. Stable codes include `invalid_token`, `insufficient_scope`, `rate_limit_exceeded`, `invalid_request`, `invalid_json`, `invalid_file`, `file_too_large`, `quota_exceeded`, `idempotency_conflict`, `file_not_found`, `invalid_upload_state`, `upload_expired`, `upload_not_found`, `upload_verification_failed`, and `storage_delete_failed`.

## Cleanup operation

Schedule `POST /api/internal/cleanup/uploads` with `Authorization: Bearer <CLEANUP_SECRET>`. Use a secret independent of Auth.js and the API-token pepper. The response contains only processed and failed counts; it never returns storage keys or signed URLs.
