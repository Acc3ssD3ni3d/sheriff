# Sheriff Personal API Access Design

## Status

Approved in conversation on 2026-09-14.

## Objective

Add secure personal API access to Sheriff. Authenticated users will create and revoke personal access tokens from their profile and use those tokens to manage only their own files through a stable, versioned API. The browser dashboard will continue to use Auth.js sessions, while external scripts and CLI tools will use bearer tokens.

Third-party delegated authorization and OAuth client applications are out of scope.

## Principles

- API tokens never grant access to another user's resources.
- The full token is shown exactly once and is never stored in plaintext.
- Every endpoint requires the narrowest relevant scope.
- Existing dashboard routes remain separate from the public API contract.
- File bytes move directly between the client and Cloudflare R2.
- Upload completion is verified by the server against R2 rather than trusted from the client.
- Browser and API uploads use the same validation, quota, and finalization service.
- API errors and pagination remain stable throughout version 1.

## System Architecture

```text
Authenticated browser session
  -> /profile
  -> session-only token management routes
  -> create/list/revoke token records in MongoDB

Personal script or CLI
  -> Authorization: Bearer shf_pat_<public-id>_<secret>
  -> /api/v1/*
  -> token authentication, scope check, and rate limit
  -> shared file application services
  -> MongoDB metadata and Cloudflare R2

Dashboard
  -> existing session-authenticated routes
  -> shared file application services
  -> MongoDB metadata and Cloudflare R2
```

The API authentication layer will return an authenticated principal containing the user ID, token ID, and scopes. Route handlers will not parse or validate tokens independently.

## Personal Access Token Model

Create an `ApiToken` collection with these fields:

| Field | Type | Rules |
|---|---|---|
| `ownerId` | ObjectId | Required; indexed |
| `name` | string | Trimmed; 1-80 characters |
| `publicId` | string | Unique random lookup identifier |
| `tokenHash` | string | HMAC-SHA-256 digest of the complete token using the server pepper; never returned |
| `prefix` | string | Safe display prefix, such as `shf_pat_ab12...` |
| `scopes` | string[] | Nonempty subset of supported scopes |
| `expiresAt` | Date or null | `null` means explicitly non-expiring |
| `lastUsedAt` | Date or null | Updated at most once every five minutes |
| `revokedAt` | Date or null | Non-null tokens are unusable |
| `createdAt` | Date | Mongoose timestamp |
| `updatedAt` | Date | Mongoose timestamp |

Indexes:

- Unique index on `publicId`
- Index on `{ ownerId: 1, createdAt: -1 }`
- Index on `{ ownerId: 1, revokedAt: 1 }`

Supported scopes are:

- `files:read`: list files, read metadata, and request downloads
- `files:write`: initialize and finalize uploads, rename files, and change visibility
- `files:delete`: move files to trash, permanently delete them, and restore them

A user may have at most ten tokens where `revokedAt` is null and `expiresAt` is either null or in the future. Expired and revoked records remain available for display and audit.

## Token Format and Storage

The token format is:

```text
shf_pat_<public-id>_<secret>
```

- `public-id` is a URL-safe random identifier used for indexed lookup.
- `secret` contains 32 cryptographically random bytes encoded with base64url.
- The server stores an HMAC-SHA-256 digest of the complete token using `API_TOKEN_HASH_PEPPER`.
- The complete token is returned only by the successful creation response.
- Token list responses contain the prefix, never `tokenHash` or the secret.

The public ID enables one indexed database lookup. After lookup, the server hashes the presented complete token and compares the stored and presented hashes using a timing-safe comparison. Random 256-bit token entropy makes offline brute-force attacks impractical; the server-only pepper adds defense in depth.

## Token Management

Token management is available only through an Auth.js browser session. API tokens cannot create, rotate, or revoke tokens.

Routes:

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/settings/tokens` | List the current user's tokens without secrets |
| `POST` | `/api/settings/tokens` | Create a token and reveal it once |
| `DELETE` | `/api/settings/tokens/:id` | Revoke a token owned by the current user |

Creation accepts:

```json
{
  "name": "Backup script",
  "scopes": ["files:read", "files:write"],
  "expiresInDays": 90
}
```

`expiresInDays` accepts `30`, `90`, `365`, or `null`. `null` is an explicit non-expiring selection. Duplicate token names are allowed because names are labels, not identifiers.

Revocation sets `revokedAt` atomically and is idempotent for the owner. A token belonging to another user is reported as not found.

## API Authentication

All `/api/v1/*` file endpoints require:

```http
Authorization: Bearer <personal-access-token>
```

Authentication rejects:

- Missing authorization header
- A scheme other than Bearer
- Malformed tokens
- Unknown public IDs
- Hash mismatches
- Revoked tokens
- Expired tokens

Authentication failures return the same external error to avoid token enumeration:

```json
{
  "error": {
    "code": "invalid_token",
    "message": "The API token is missing or invalid.",
    "requestId": "req_..."
  }
}
```

The response status is `401` and includes `WWW-Authenticate: Bearer`. A valid token without the required scope receives `403` and `insufficient_scope`.

No token value or authorization header may be logged. Errors must pass through a redaction helper before structured logging.

## Version 1 File API

### Endpoints

| Method | Endpoint | Scope | Purpose |
|---|---|---|---|
| `GET` | `/api/v1/files` | `files:read` | Cursor-paginated file list |
| `GET` | `/api/v1/files/:id` | `files:read` | Completed file metadata |
| `POST` | `/api/v1/files` | `files:write` | Reserve quota and initialize an upload |
| `POST` | `/api/v1/files/:id/complete` | `files:write` | Verify the R2 object and finalize upload |
| `GET` | `/api/v1/files/:id/download` | `files:read` | Return a short-lived download URL |
| `PATCH` | `/api/v1/files/:id` | `files:write` | Rename or change visibility |
| `DELETE` | `/api/v1/files/:id` | `files:delete` | Soft-delete, or permanently delete with `?permanent=true` |
| `POST` | `/api/v1/files/:id/restore` | `files:delete` | Restore a soft-deleted file |

Every database query includes `ownerId` from the authenticated principal. Knowing a file ID never bypasses ownership.

### Stable Response Shape

Successful single-resource response:

```json
{
  "data": {},
  "requestId": "req_..."
}
```

Error response:

```json
{
  "error": {
    "code": "machine_readable_code",
    "message": "Human-readable explanation.",
    "requestId": "req_...",
    "details": []
  }
}
```

`details` is optional and used for validation errors. Internal exception messages, storage keys, hashes, and credentials are never returned.

### Status Codes

- `200`: successful read, update, finalization, restoration, or idempotent revocation
- `201`: token or upload reservation created
- `400`: malformed JSON, invalid ObjectId, invalid cursor, or validation error
- `401`: invalid API token
- `403`: insufficient scope
- `404`: resource absent or owned by another user
- `409`: invalid state transition, quota exhaustion, idempotency conflict, or storage verification mismatch
- `413`: file exceeds the configured maximum size
- `429`: token or upload rate limit exceeded
- `500`: unexpected internal error
- `502`: R2 is unavailable during an operation that requires it

## Listing and Pagination

`GET /api/v1/files` accepts:

- `limit`: integer from 1 through 100, default 25
- `cursor`: opaque base64url cursor returned by the prior page
- `search`: literal case-insensitive filename search, escaped before constructing a regular expression
- `sort`: `createdAt`, `originalName`, or `size`, default `createdAt`
- `order`: `asc` or `desc`, default `desc`
- `include`: `active` or `trash`, default `active`

The cursor encodes the last sort value and `_id` so pages have deterministic ordering. It is validated and treated as opaque by clients.

List responses include `data`, `page.nextCursor`, and `page.hasMore`. Storage keys and share-token hashes are not exposed.

## Upload Initialization

`POST /api/v1/files` accepts:

```json
{
  "filename": "report.pdf",
  "contentType": "application/pdf",
  "size": 1048576
}
```

Validation includes:

- Filename length and sanitization
- Positive integer byte length
- Configured maximum object size
- Allowed MIME type and extension policy
- Consistency between filename extension and content type where a mapping exists
- Available per-user quota, including active upload reservations

On success, the server creates an `uploading` file record with `uploadExpiresAt` set 15 minutes in the future and returns:

```json
{
  "data": {
    "fileId": "...",
    "uploadUrl": "https://...",
    "method": "PUT",
    "headers": {
      "Content-Type": "application/pdf"
    },
    "expiresAt": "..."
  },
  "requestId": "req_..."
}
```

The presigned command binds the object key, content type, and declared content length where supported. Server-side completion verification remains authoritative.

### Idempotency

Upload initialization accepts an optional `Idempotency-Key` header of 1-128 visible ASCII characters. The server stores a SHA-256 hash of the key, scoped to the owner, plus a hash of the validated request payload.

- Repeating the same key and payload returns the original active reservation.
- Reusing the key with a different payload returns `409 idempotency_conflict`.
- Idempotency records expire after 24 hours.

## Upload Completion

`POST /api/v1/files/:id/complete` is valid only for an unexpired `uploading` record owned by the caller.

The server sends `HeadObject` to R2 and verifies:

- The object exists at the server-generated storage key
- Actual byte length equals the reserved byte length
- Stored content type matches the accepted content type

Only the server can transition the record to `completed`. A repeated completion request for an already completed matching object succeeds idempotently. A verification mismatch marks the record failed, attempts storage cleanup, and returns `409 upload_verification_failed`.

Expired reservations cannot be finalized. They are marked failed and their objects are deleted if found.

The existing dashboard upload flow will call the same initialization and completion services. The generic dashboard `PATCH status` operation will be removed so the browser cannot assert completion. The session-backed completion route is `POST /api/files/:id/complete`; it applies the same R2 verification as the versioned API endpoint.

## Quotas and Reservation Cleanup

Quota usage is the sum of:

- Completed file sizes, including files in trash because their R2 objects still consume storage
- Unexpired `uploading` reservations

The initial per-user quota remains 10 GiB and is represented by one server-side configuration constant used by both UI and API. The configured maximum size of one object is 5 GiB.

Quota reservation uses an atomic MongoDB conditional update on a per-user storage-usage record. This prevents simultaneous requests from oversubscribing capacity. Finalization converts reserved bytes to used bytes. Failure, cancellation, expiry, and successful permanent deletion release the appropriate counter exactly once. Soft deletion does not release used bytes.

A cleanup function marks expired uploads failed, releases reservations, and attempts R2 cleanup. It is callable from `POST /api/internal/cleanup/uploads`, protected by `CLEANUP_SECRET`, and also opportunistically processes the current user's stale reservations before new upload initialization. The deployment guide will document scheduling the cleanup route.

## Downloads

Download requests require ownership, `files:read`, `status: completed`, and `deletedAt: null`. They return an attachment-oriented presigned R2 URL valid for 15 minutes.

Changing visibility or revoking an API token prevents new URLs from being issued but cannot invalidate a signed R2 URL already issued. Documentation will state this bounded revocation delay.

Public share-page downloads remain separate and require the valid share token as well as `visibility: public`, `status: completed`, and `deletedAt: null`.

## Mutation Semantics

Rename and visibility changes validate a discriminated request body. Empty updates and unknown fields are rejected. Rename changes display metadata without moving the R2 object.

Soft deletion sets `deletedAt`, makes the file private, and revokes its share token atomically. Soft-deleted files no longer produce download or preview URLs.

Permanent deletion first attempts R2 deletion. MongoDB metadata is retained in a `deletion_failed` state when R2 cannot be deleted so cleanup can retry; it is removed only after storage deletion succeeds. Restoration is available only for soft-deleted records whose R2 object still exists.

## Rate Limiting

Rate limiting uses MongoDB so behavior is shared across serverless instances. A rate-limit collection contains a unique `{ key, windowStart }` record with an atomic counter and TTL index.

- General API limit: 120 requests per token per fixed one-minute bucket
- Upload initialization limit: 20 requests per token per one-minute bucket
- Token creation limit: 10 attempts per user per hour

Responses include:

- `RateLimit-Limit`
- `RateLimit-Remaining`
- `RateLimit-Reset`
- `Retry-After` on `429`

R2 PUT and GET traffic occurs outside the Next.js server and is not counted after a URL is issued.

## Profile User Interface

Add `/profile`, protected by both the server component and `proxy.ts`. Add a Profile link to the dashboard sidebar.

The API Tokens panel contains:

- Explanation that tokens are intended for trusted scripts and CLI tools
- Create-token action
- Token list showing name, prefix, scopes, created date, expiration, last use, and active/expired/revoked state
- Revoke action with confirmation
- Link to API documentation

The creation dialog requires a name, at least one scope, and an expiration selection. The success state displays the complete token once, provides a copy button, and warns that it cannot be recovered. Closing the state permanently removes the plaintext token from React state.

The UI never stores tokens in local storage, session storage, cookies, URLs, or analytics.

## CORS and Browser Use

Version 1 is intended for server-side scripts and CLI tools. The API does not emit permissive CORS headers. This discourages embedding durable bearer tokens in browser applications.

The R2 bucket must allow PUT requests from the Sheriff's own deployed origins for dashboard uploads. CLI uploads do not depend on browser CORS.

## Logging and Observability

Each API request receives a random `requestId`, returned in the body and `X-Request-Id` header. Structured logs include request ID, route, status, duration, user ID, token ID, and error code, but never authorization headers, complete tokens, presigned URLs, storage credentials, or raw request bodies.

Token `lastUsedAt` is updated asynchronously only when the stored value is more than five minutes old. Failure to update usage metadata does not fail an otherwise authorized request.

Metrics to derive from logs include authentication failures, scope failures, rate-limit rejections, upload initialization/finalization failures, verification mismatches, cleanup failures, and R2 latency.

## Documentation

Add:

- `public/openapi.yaml`: OpenAPI 3.1 contract for token-authenticated version 1 endpoints
- `docs/api.md`: authentication, scope, upload, download, pagination, error, rate-limit, security, and revocation guide
- Curl examples for the complete upload lifecycle and every endpoint
- Environment-variable and R2 CORS guidance
- Scheduled-cleanup deployment instructions

The API is versioned in the path. Backward-incompatible changes require `/api/v2`; additive response fields may be introduced in version 1.

## Testing Strategy

Introduce Vitest with TypeScript path-alias support. Tests follow red-green-refactor development.

### Unit tests

- Token generation has the required format and entropy-bearing segments
- Stored records never contain the plaintext token
- Parsing rejects malformed tokens
- Hash comparison accepts only the original token
- Expiration and revocation are enforced
- Every scope is independently enforced
- Validation rejects unknown scopes and unsupported expiry choices
- Cursor encoding/decoding is deterministic and rejects malformed cursors
- Search escapes regular-expression characters
- API errors have stable shapes and request IDs

### Service tests

- Token creation enforces ten active tokens
- Users can list and revoke only their own tokens
- Rate limits use atomic counters and return correct headers
- Upload initialization reserves quota atomically
- Repeated idempotency keys return the same reservation
- Conflicting idempotency payloads return 409
- Upload completion checks R2 length and content type
- Failed and expired uploads release quota once
- Permanent deletion preserves retryable metadata after R2 failure
- Every file operation is scoped to its owner

### Route tests

- Missing, invalid, expired, and revoked tokens return indistinguishable 401 responses
- Missing scopes return 403
- Invalid IDs return 400
- Cross-user IDs return 404
- List pagination and filtering remain stable
- Downloads reject uploading, failed, deleted, and foreign files
- API responses never expose storage keys, hashes, or secrets

External MongoDB and R2 boundaries may be replaced with narrow fakes in unit and route tests. A documented manual smoke test will verify a real MongoDB/R2 environment without committing credentials.

### Release verification

- Unit and route test suites pass
- ESLint passes
- TypeScript passes without emit
- Next.js production build passes
- Manual token create/copy/revoke flow passes
- Manual curl upload, completion, list, and download flow passes
- Browser dashboard upload still works through the shared verified service

## Migration and Compatibility

Existing User and File records remain valid. File records gain optional fields for upload expiry, quota reservation state, idempotency metadata, and deletion retry state. New indexes are additive.

Existing session-backed dashboard URLs remain available. Their internals will move to shared services, and insecure client-controlled upload completion will be removed. The share page remains compatible, but download authorization will require its share token and reject deleted files.

No existing API is advertised as a stable public contract; only `/api/v1/*` receives compatibility guarantees.

## Required Configuration

Existing MongoDB, Auth.js, Google, and R2 variables remain required. Add:

- `API_TOKEN_HASH_PEPPER`: server secret mixed into token hashes for defense in depth
- `CLEANUP_SECRET`: bearer secret for the scheduled cleanup route
- `MAX_FILE_SIZE_BYTES`: optional override, default 5 GiB
- `USER_STORAGE_LIMIT_BYTES`: optional override, default 10 GiB

Startup validation must fail with a clear server-side message when required production secrets are missing. Secret values must never appear in client bundles or documentation examples.

## Explicit Non-Goals

- Third-party OAuth applications
- Service accounts shared by multiple Sheriff users
- Organization-level tokens or shared storage
- Token-based access to profile or token-management APIs
- Resumable or multipart uploads in version 1
- Webhooks
- Public browser SDK
- Billing or paid quota enforcement

## Acceptance Criteria

The feature is complete when a signed-in user can create a scoped expiring token, see its plaintext exactly once, use it from curl to upload and verify a file directly through R2, list and download only their own active files, and immediately prevent new access by revoking the token. Scope, ownership, quota, rate-limit, deletion, and malformed-input failures must produce the documented status codes and stable error format. The dashboard must continue to work using session authentication through the same secure upload-finalization rules.
