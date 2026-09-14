# Personal API Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let signed-in Sheriff users create scoped personal access tokens and use them to securely manage only their own files through `/api/v1`, including verified direct-to-R2 uploads.

**Architecture:** Session-only settings routes manage HMAC-hashed personal tokens. Versioned route handlers authenticate bearer tokens into a shared principal, enforce scopes and MongoDB-backed rate limits, and call focused file services that are also used by the dashboard. Uploads reserve quota atomically, transfer directly to R2, and become completed only after server-side `HeadObject` verification.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Auth.js 5, Mongoose 9, Cloudflare R2/AWS SDK, Zod 4, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-14-personal-api-access-design.md`

## Global Constraints

- API tokens are personal credentials and can access only their owner's resources.
- Token format is `shf_pat_<public-id>_<secret>`; return plaintext only once and store only an HMAC-SHA-256 digest using `API_TOKEN_HASH_PEPPER`.
- Supported scopes are exactly `files:read`, `files:write`, and `files:delete`.
- Token expiry choices are exactly 30, 90, 365 days, or explicit non-expiry.
- Keep dashboard session routes separate from the stable `/api/v1` bearer-token contract.
- Bind uploads to server-generated R2 keys and finalize only after `HeadObject` verifies size and content type.
- Default limits are 10 GiB per user and 5 GiB per object.
- General token rate limit is 120 requests per fixed minute; upload initialization is 20 per fixed minute; token creation is 10 per hour.
- Do not add permissive CORS headers or expose tokens, token hashes, presigned URLs, authorization headers, or storage keys in logs.
- Read the applicable bundled Next.js 16 documentation from `node_modules/next/dist/docs/` before editing framework code.
- Use test-first red-green-refactor for every behavior change.

---

## File Structure

### New files

- `vitest.config.ts`: test environment and `@` alias.
- `tests/setup.ts`: deterministic environment defaults.
- `lib/api/errors.ts`: request IDs and stable success/error responses.
- `lib/api/tokens.ts`: token generation, parsing, HMAC hashing, and scope types.
- `lib/api/authenticate.ts`: bearer-token authentication and scope enforcement.
- `lib/api/rate-limit.ts`: MongoDB fixed-window counters and response headers.
- `lib/api/logging.ts`: structured request logging with credential redaction.
- `lib/api/pagination.ts`: literal search escaping and opaque cursors.
- `lib/files/config.ts`: validated file-size and quota constants.
- `lib/files/policy.ts`: filename, content-type, and extension validation.
- `lib/files/service.ts`: owner-scoped listing, metadata, mutations, upload lifecycle, and quota accounting.
- `models/api-token.ts`: personal token schema.
- `models/api-rate-limit.ts`: rate-limit bucket schema with TTL.
- `models/storage-usage.ts`: atomic used/reserved byte counters.
- `app/api/settings/tokens/route.ts`: session-only token list/create.
- `app/api/settings/tokens/[id]/route.ts`: session-only revocation.
- `app/api/v1/files/route.ts`: API list and upload initialization.
- `app/api/v1/files/[id]/route.ts`: API metadata/update/delete.
- `app/api/v1/files/[id]/complete/route.ts`: API finalization.
- `app/api/v1/files/[id]/download/route.ts`: API download URL.
- `app/api/v1/files/[id]/restore/route.ts`: API restore.
- `app/api/files/[id]/complete/route.ts`: dashboard finalization through the shared service.
- `app/api/internal/cleanup/uploads/route.ts`: scheduled stale-upload cleanup.
- `app/profile/page.tsx`: protected profile shell.
- `components/api-token-manager.tsx`: token management UI.
- `public/openapi.yaml`: OpenAPI 3.1 contract.
- `docs/api.md`: human API guide and curl examples.
- `.env.example`: complete empty/default environment template.
- Focused `*.test.ts`/`*.test.tsx` files alongside tests under `tests/`.

### Modified files

- `package.json`, `package-lock.json`: test scripts and Vitest dependency.
- `models/file.ts`: upload expiry, reservation, idempotency, and deletion state.
- `lib/r2.ts`: signed upload constraints, `HeadObject`, and existence helpers.
- `lib/validation.ts`: shared upload and mutation schemas.
- `app/api/files/route.ts`: delegate dashboard initialization/listing to shared services.
- `app/api/files/[id]/route.ts`: remove client-controlled status and delegate mutations/deletion.
- `app/api/files/[id]/download/route.ts`: consistently reject deleted files and enforce share tokens.
- `app/api/files/[id]/visibility/route.ts`, `restore/route.ts`, `trash/route.ts`: delegate shared lifecycle rules.
- `components/upload-dialog.tsx`: call the verified completion endpoint.
- `components/dashboard.tsx`: profile navigation and server-provided quota.
- `proxy.ts`: protect `/profile`.
- `README.md`: setup, API documentation links, and truthful security claims.

---

### Task 1: Test foundation and API response primitives

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `vitest.config.ts`
- Create: `tests/setup.ts`
- Create: `tests/api/errors.test.ts`
- Create: `lib/api/errors.ts`

**Interfaces:**
- Produces: `apiSuccess<T>(data, requestId?, init?)`, `apiError(status, code, message, options?)`, `createRequestId()`.

- [ ] **Step 1: Install dependencies and read the local Next.js guides**

Run:

```powershell
npm install
npm install --save-dev vitest
Get-Content -Raw node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.mdx
Get-Content -Raw node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.mdx
```

Confirm the installed guide paths with `rg --files node_modules/next/dist/docs | rg "route|proxy"` if the names differ.

- [ ] **Step 2: Add test scripts and Vitest configuration**

Add scripts:

```json
"test": "vitest run",
"test:watch": "vitest",
"typecheck": "tsc --noEmit"
```

Configure `environment: "node"`, setup file `tests/setup.ts`, and alias `@` to the repository root.

- [ ] **Step 3: Write failing response-helper tests**

```ts
import { describe, expect, it } from "vitest";
import { apiError, apiSuccess } from "@/lib/api/errors";

describe("API responses", () => {
  it("returns stable success metadata and request header", async () => {
    const response = apiSuccess({ id: "file-1" }, "req_fixed");
    expect(response.headers.get("X-Request-Id")).toBe("req_fixed");
    expect(await response.json()).toEqual({ data: { id: "file-1" }, requestId: "req_fixed" });
  });

  it("returns a stable error envelope", async () => {
    const response = apiError(403, "insufficient_scope", "Missing scope.", { requestId: "req_fixed" });
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: { code: "insufficient_scope", message: "Missing scope.", requestId: "req_fixed" },
    });
  });
});
```

- [ ] **Step 4: Run the tests and verify RED**

Run: `npm test -- tests/api/errors.test.ts`

Expected: FAIL because `@/lib/api/errors` does not exist.

- [ ] **Step 5: Implement the response helpers**

Use `crypto.randomUUID()` for `req_<uuid>`, `NextResponse.json`, optional validation `details`, and merge `X-Request-Id` into supplied headers without dropping existing headers.

- [ ] **Step 6: Run tests and verify GREEN**

Run: `npm test -- tests/api/errors.test.ts`

Expected: both tests PASS.

- [ ] **Step 7: Commit**

```powershell
git add package.json package-lock.json vitest.config.ts tests/setup.ts tests/api/errors.test.ts lib/api/errors.ts
git commit -m "test: add API verification foundation"
```

---

### Task 2: Token cryptography, schema, and session management routes

**Files:**
- Create: `tests/api/tokens.test.ts`
- Create: `tests/api/token-management.test.ts`
- Create: `lib/api/tokens.ts`
- Create: `models/api-token.ts`
- Create: `app/api/settings/tokens/route.ts`
- Create: `app/api/settings/tokens/[id]/route.ts`
- Modify: `lib/validation.ts`

**Interfaces:**
- Produces: `API_SCOPES`, `ApiScope`, `generateApiToken(pepper)`, `parseApiToken(value)`, `digestApiToken(value, pepper)`, `verifyApiToken(value, storedHash, pepper)`.
- Produces: `createApiTokenSchema` accepting `{ name, scopes, expiresInDays }`.

- [ ] **Step 1: Write failing token primitive tests**

Cover exact prefix/segments, different output across calls, parse rejection, deterministic HMAC digest, timing-safe verification, rejection when the pepper is missing, and absence of plaintext from the persistence projection.

```ts
const created = generateApiToken("pepper-for-tests");
expect(created.plaintext).toMatch(/^shf_pat_[A-Za-z0-9_-]+_[A-Za-z0-9_-]+$/);
expect(parseApiToken(created.plaintext)?.publicId).toBe(created.publicId);
expect(verifyApiToken(created.plaintext, created.tokenHash, "pepper-for-tests")).toBe(true);
expect(JSON.stringify(created.record)).not.toContain(created.plaintext);
```

- [ ] **Step 2: Run token tests and verify RED**

Run: `npm test -- tests/api/tokens.test.ts`

Expected: FAIL because token primitives do not exist.

- [ ] **Step 3: Implement token primitives and schema**

Use `randomBytes(12).toString("base64url")` for the public ID, `randomBytes(32)` for the secret, `createHmac("sha256", pepper)`, and `timingSafeEqual` on equal-length buffers. Export exactly the three approved scopes.

- [ ] **Step 4: Run token tests and verify GREEN**

Run: `npm test -- tests/api/tokens.test.ts`

- [ ] **Step 5: Write failing management-service tests**

Test expiry conversion for `30`, `90`, `365`, and `null`; rejection of an empty scope array; concurrency-safe active-token cap at ten; reuse of a released slot after revocation/expiry; owner-only list/revoke; and one-time plaintext response. Use an injected repository interface so authorization and rules use real service code without requiring MongoDB.

- [ ] **Step 6: Run management tests and verify RED**

Run: `npm test -- tests/api/token-management.test.ts`

Expected: FAIL because the model/service/routes are missing.

- [ ] **Step 7: Implement the model and session-only handlers**

Both routes call `auth()` and return `401` without `session.user.id`. The model has an internal `activeSlot` from 0 through 9 with a unique partial `{ ownerId, activeSlot }` index. Creation clears slots from expired tokens, claims a free slot, and retries duplicate-key races; revocation atomically sets `activeSlot: null` with `revokedAt`. GET selects no `tokenHash`. DELETE queries `{ _id, ownerId }` and returns 404 for foreign IDs. Duplicate revocation returns success for the owner.

- [ ] **Step 8: Run focused and full tests**

Run:

```powershell
npm test -- tests/api/tokens.test.ts tests/api/token-management.test.ts
npm test
```

Expected: PASS.

- [ ] **Step 9: Commit**

```powershell
git add lib/api/tokens.ts lib/validation.ts models/api-token.ts app/api/settings/tokens tests/api/tokens.test.ts tests/api/token-management.test.ts
git commit -m "feat: add personal access token lifecycle"
```

---

### Task 3: Bearer authentication and shared rate limiting

**Files:**
- Create: `tests/api/authenticate.test.ts`
- Create: `tests/api/rate-limit.test.ts`
- Create: `tests/api/logging.test.ts`
- Create: `lib/api/authenticate.ts`
- Create: `lib/api/rate-limit.ts`
- Create: `lib/api/logging.ts`
- Create: `models/api-rate-limit.ts`
- Modify: `app/api/settings/tokens/route.ts`
- Modify: `tests/api/token-management.test.ts`

**Interfaces:**
- Produces: `ApiPrincipal { userId: string; tokenId: string; scopes: ApiScope[] }`.
- Produces: `authenticateApiRequest(request, requiredScope)` returning `{ principal, headers }` or a `NextResponse`.
- Produces: `consumeRateLimit({ key, limit, windowMs, now? })` returning limit/remaining/reset metadata.
- Produces: `redactApiLogValue(value)` and `writeApiLog(event)` with allowlisted structured fields.

- [ ] **Step 1: Write failing authentication tests**

Test missing header, wrong scheme, malformed token, unknown ID, wrong digest, expired token, revoked token, missing scope, successful principal, identical external 401 bodies, `WWW-Authenticate`, and five-minute-throttled `lastUsedAt` updates.

- [ ] **Step 2: Verify authentication tests fail for the missing implementation**

Run: `npm test -- tests/api/authenticate.test.ts`

- [ ] **Step 3: Implement bearer authentication**

Parse only a single Bearer credential. Load by `publicId`, verify HMAC using `API_TOKEN_HASH_PEPPER`, check revocation/expiry, check scope, and schedule the conditional `lastUsedAt` update with Next.js `after()` after confirming its bundled documentation. Never include the presented token in thrown errors.

- [ ] **Step 4: Verify authentication tests pass**

Run: `npm test -- tests/api/authenticate.test.ts`

- [ ] **Step 5: Write failing atomic rate-limit tests**

Test the first request, remaining count, rejection above limit, reset at the next bucket, separate upload/general keys, the 10-per-hour session token-creation policy, and the three required headers plus `Retry-After`.

- [ ] **Step 6: Verify rate-limit tests fail**

Run: `npm test -- tests/api/rate-limit.test.ts`

- [ ] **Step 7: Implement the MongoDB bucket model and limiter**

Use an atomic `findOneAndUpdate` with `$inc`, upsert, unique `{ key: 1, windowStart: 1 }`, and TTL `expiresAt`. Convert duplicate-key races into a retry of the same atomic increment. Key API buckets by token ID and policy name, never by plaintext token; key token-creation buckets by user ID. Apply the 10/hour policy in `POST /api/settings/tokens`.

- [ ] **Step 8: Write and pass credential-redaction tests**

Assert that logging an event containing `authorization`, `token`, `tokenHash`, `uploadUrl`, `downloadUrl`, `storageKey`, or nested variants outputs `[REDACTED]`, while request ID, route, status, duration, user ID, token ID, and error code remain present. Implement an allowlisted structured logger and use it from the API error boundary.

- [ ] **Step 9: Run all tests and commit**

```powershell
npm test
git add lib/api/authenticate.ts lib/api/rate-limit.ts lib/api/logging.ts models/api-rate-limit.ts app/api/settings/tokens/route.ts tests/api/authenticate.test.ts tests/api/rate-limit.test.ts tests/api/logging.test.ts tests/api/token-management.test.ts
git commit -m "feat: authenticate and rate limit API tokens"
```

---

### Task 4: File policy, R2 verification, and atomic quota service

**Files:**
- Create: `tests/files/policy.test.ts`
- Create: `tests/files/upload-service.test.ts`
- Create: `tests/env.test.ts`
- Create: `lib/env.ts`
- Create: `lib/files/config.ts`
- Create: `lib/files/policy.ts`
- Create: `lib/files/service.ts`
- Create: `models/storage-usage.ts`
- Modify: `models/file.ts`
- Modify: `lib/db.ts`
- Modify: `lib/r2.ts`
- Modify: `lib/validation.ts`

**Interfaces:**
- Produces: `validateUploadMetadata(input)` returning sanitized metadata or typed policy error.
- Produces: `initializeUpload(principal, input, idempotencyKey?)`.
- Produces: `completeUpload(principal, fileId)`.
- Produces: `headR2Object(key)` returning `{ size, contentType } | null`.
- Produces: `reserveBytes`, `finalizeReservation`, and `releaseReservation`, each idempotent by file ID.

- [ ] **Step 1: Write failing environment and file-policy tests**

Test clear failures for missing API pepper, cleanup secret, MongoDB URI, and R2 credentials in production configuration. Test zero/fractional/oversized lengths; filename sanitization; empty extension; supported MIME/extension pairs; mismatch rejection; and fallback handling for `application/octet-stream`. Assert defaults equal 5 GiB per object and 10 GiB per user.

- [ ] **Step 2: Verify policy tests fail**

Run: `npm test -- tests/env.test.ts tests/files/policy.test.ts`

- [ ] **Step 3: Implement validated server configuration and file policy**

Expose a lazily evaluated `getServerEnv()` so tests and builds can control validation, then migrate API-token, MongoDB, and R2 entry points to it. In production it rejects absent required values with variable names but never secret values. Parse optional byte environment variables as safe positive integers. Define a conservative MIME map for documented preview types plus common archive/document formats. Unknown binary formats may use `application/octet-stream`; contradictory known pairs fail.

- [ ] **Step 4: Verify policy tests pass**

Run: `npm test -- tests/env.test.ts tests/files/policy.test.ts`

- [ ] **Step 5: Write failing upload lifecycle tests**

Use injected file, quota, clock, and R2 ports. Test bootstrapping usage from pre-existing completed files including trash, atomic quota failure, concurrent reservation safety, successful reservation, same idempotency key/payload replay, 24-hour idempotency expiry, idempotency conflict, R2-not-found completion, size mismatch, type mismatch, successful completion, repeated completion, expired upload, and exactly-once quota release.

- [ ] **Step 6: Verify upload tests fail**

Run: `npm test -- tests/files/upload-service.test.ts`

- [ ] **Step 7: Extend models and R2 functions**

Add file fields `uploadExpiresAt`, `reservationState`, `idempotencyKeyHash`, `idempotencyPayloadHash`, `idempotencyExpiresAt`, and `deletionState`. Add partial indexes for owner/idempotency and stale uploads; expired idempotency fields are ignored and cleared by cleanup rather than using a TTL index that would delete file records. Add `HeadObjectCommand`, content type/length constraints to signed PUT creation, and an object-existence helper.

- [ ] **Step 8: Implement the upload and quota services**

Storage usage has unique `ownerId`, `usedBytes`, `reservedBytes`, and a companion reservation ledger keyed by file ID. On first use, reconcile `usedBytes` from all completed file records, including trash, before accepting reservations. Reserve with one conditional update requiring `usedBytes + reservedBytes + requested <= limit`. Finalize and release through conditional state transitions so retries cannot double-adjust counters.

- [ ] **Step 9: Run focused/full tests and commit**

```powershell
npm test -- tests/files/policy.test.ts tests/files/upload-service.test.ts
npm test
git add lib/env.ts lib/files models/storage-usage.ts models/file.ts lib/db.ts lib/r2.ts lib/validation.ts tests/env.test.ts tests/files
git commit -m "feat: verify uploads and reserve storage atomically"
```

---

### Task 5: Versioned read API, pagination, and downloads

**Files:**
- Create: `tests/api/pagination.test.ts`
- Create: `tests/api/v1-read-routes.test.ts`
- Create: `lib/api/pagination.ts`
- Create: `app/api/v1/files/route.ts`
- Create: `app/api/v1/files/[id]/route.ts`
- Create: `app/api/v1/files/[id]/download/route.ts`

**Interfaces:**
- Consumes: `authenticateApiRequest`, `apiSuccess`, `apiError`, and owner-scoped file services.
- Produces: `encodeCursor`, `decodeCursor`, `escapeRegex`, and the documented version 1 GET routes.

- [ ] **Step 1: Write failing pagination tests**

Test cursor round trip for string/number/date values plus `_id`, malformed cursor rejection, deterministic tie-breaking, allowed sort fields, limit bounds, and literal escaping of `.*+?^${}()|[]\\`.

- [ ] **Step 2: Verify pagination tests fail**

Run: `npm test -- tests/api/pagination.test.ts`

- [ ] **Step 3: Implement pagination helpers**

Use base64url-encoded JSON containing a version, sort value, and ID. Reject unknown versions or structurally invalid data. Always append `_id` as the deterministic secondary sort.

- [ ] **Step 4: Verify pagination tests pass**

Run: `npm test -- tests/api/pagination.test.ts`

- [ ] **Step 5: Write failing API read-route tests**

Test bearer authentication, `files:read`, owner filtering, active/trash selection, pagination metadata, malformed IDs, absent/foreign resources as 404, and download rejection for uploading/failed/deleted records. Assert responses omit `storageKey`, `tokenHash`, and API secrets.

- [ ] **Step 6: Verify read-route tests fail**

Run: `npm test -- tests/api/v1-read-routes.test.ts`

- [ ] **Step 7: Implement list, metadata, and download handlers**

Apply the general 120/minute limit after authentication. Validate all query parameters with Zod. Generate 15-minute attachment URLs only after owner/status/deletion checks. Include request and rate-limit headers on success and errors.

- [ ] **Step 8: Run tests and commit**

```powershell
npm test
git add lib/api/pagination.ts app/api/v1/files tests/api/pagination.test.ts tests/api/v1-read-routes.test.ts
git commit -m "feat: add versioned file read API"
```

---

### Task 6: Versioned upload API and dashboard migration

**Files:**
- Create: `tests/api/v1-upload-routes.test.ts`
- Create: `tests/api/dashboard-upload-routes.test.ts`
- Modify: `app/api/v1/files/route.ts`
- Create: `app/api/v1/files/[id]/complete/route.ts`
- Create: `app/api/files/[id]/complete/route.ts`
- Modify: `app/api/files/route.ts`
- Modify: `app/api/files/[id]/route.ts`
- Modify: `components/upload-dialog.tsx`

**Interfaces:**
- Consumes: `initializeUpload` and `completeUpload` from Task 4.
- Produces: bearer and session entry points with identical upload integrity rules.

- [ ] **Step 1: Write failing versioned upload-route tests**

Test `files:write`, 20/minute upload limit, valid metadata, 413 size failures, 409 quota/idempotency failures, returned required PUT headers, owner-only completion, R2 mismatch, and idempotent success.

- [ ] **Step 2: Verify versioned upload tests fail**

Run: `npm test -- tests/api/v1-upload-routes.test.ts`

- [ ] **Step 3: Implement versioned initialization and completion routes**

Read `Idempotency-Key`, validate it, pass it to the shared service, and map typed service errors to the specified status/code. Do not accept a status property from clients.

- [ ] **Step 4: Verify versioned upload tests pass**

Run: `npm test -- tests/api/v1-upload-routes.test.ts`

- [ ] **Step 5: Write failing dashboard regression tests**

Assert session authentication, shared validation/quota behavior, completion via `POST /api/files/:id/complete`, and rejection of `{ status: "completed" }` through the generic PATCH route.

- [ ] **Step 6: Verify dashboard tests fail**

Run: `npm test -- tests/api/dashboard-upload-routes.test.ts`

- [ ] **Step 7: Migrate dashboard handlers and UI**

Delegate initialization/finalization to the shared service. Change the upload dialog confirmation call to the new POST route. When an XHR is cancelled after initialization, call `DELETE /api/files/:id`; the shared delete service recognizes an `uploading` record as cancellation, attempts R2 cleanup, marks it failed, and releases its reservation exactly once. If that request cannot reach the server, the 15-minute expiry cleanup remains the fallback.

- [ ] **Step 8: Run tests and commit**

```powershell
npm test
git add app/api/v1/files app/api/files components/upload-dialog.tsx tests/api/v1-upload-routes.test.ts tests/api/dashboard-upload-routes.test.ts
git commit -m "feat: secure API and dashboard upload completion"
```

---

### Task 7: Mutations, secure deletion, share hardening, and cleanup

**Files:**
- Create: `tests/api/v1-mutation-routes.test.ts`
- Create: `tests/files/cleanup.test.ts`
- Modify: `app/api/v1/files/[id]/route.ts`
- Create: `app/api/v1/files/[id]/restore/route.ts`
- Create: `app/api/internal/cleanup/uploads/route.ts`
- Modify: `app/api/files/[id]/route.ts`
- Modify: `app/api/files/[id]/download/route.ts`
- Modify: `app/api/files/[id]/visibility/route.ts`
- Modify: `app/api/files/[id]/restore/route.ts`
- Modify: `app/api/files/trash/route.ts`
- Modify: `app/api/files/[id]/preview/route.ts`

**Interfaces:**
- Produces: owner-scoped rename/visibility/delete/restore services and `cleanupExpiredUploads(now)`.

- [ ] **Step 1: Write failing mutation tests**

Test required scopes independently, owner isolation, strict request bodies, rename, visibility token creation/revocation, soft-delete privacy/token revocation, trashed download rejection, restore object check, R2 failure preserving `deletion_failed`, and successful permanent deletion releasing used bytes once.

- [ ] **Step 2: Verify mutation tests fail**

Run: `npm test -- tests/api/v1-mutation-routes.test.ts`

- [ ] **Step 3: Implement shared mutation services and handlers**

Use validated ObjectIds and `{ _id, ownerId }` filters everywhere. Return 404 for foreign IDs. Soft delete sets `deletedAt`, `visibility: "private"`, and `shareToken: null` together. Permanent deletion retains retryable metadata until R2 succeeds.

- [ ] **Step 4: Verify mutation tests pass**

Run: `npm test -- tests/api/v1-mutation-routes.test.ts`

- [ ] **Step 5: Write failing cleanup/share tests**

Test expired reservations becoming failed, object cleanup, exactly-once release, cleanup-secret rejection, and public download/preview requiring a valid share token plus non-deleted completed public status.

- [ ] **Step 6: Verify cleanup/share tests fail**

Run: `npm test -- tests/files/cleanup.test.ts`

- [ ] **Step 7: Implement cleanup and harden session/share routes**

The internal route accepts `Authorization: Bearer <CLEANUP_SECRET>`, uses timing-safe secret comparison, and returns processed/failed counts without resource secrets. Existing download and preview routes apply the same share predicate and 15-minute URL lifetime.

- [ ] **Step 8: Run tests and commit**

```powershell
npm test
git add lib/files app/api/v1 app/api/files app/api/internal tests/api/v1-mutation-routes.test.ts tests/files/cleanup.test.ts
git commit -m "feat: enforce secure file lifecycle rules"
```

---

### Task 8: Profile token-management interface

**Files:**
- Create: `tests/components/api-token-manager.test.tsx`
- Create: `app/profile/page.tsx`
- Create: `components/api-token-manager.tsx`
- Modify: `components/dashboard.tsx`
- Modify: `proxy.ts`

**Interfaces:**
- Consumes: session token-management routes from Task 2.
- Produces: protected `/profile` and dashboard navigation.

- [ ] **Step 1: Add the DOM test dependency and write failing UI tests**

Install `@testing-library/react`, `@testing-library/user-event`, and `jsdom`. Test loading/error/empty states, name/scopes/expiry submission, plaintext reveal only after creation, copy action, plaintext removal on close, token metadata rendering, and revoke confirmation.

- [ ] **Step 2: Verify UI tests fail**

Run: `npm test -- tests/components/api-token-manager.test.tsx`

- [ ] **Step 3: Implement the protected page and token manager**

The server page calls `auth()` and redirects to `/login` when absent. Use accessible dialog roles, labels, keyboard focus, and clear scope descriptions. Never persist the returned plaintext outside component state.

- [ ] **Step 4: Add navigation and proxy protection**

Add a Profile sidebar action/link and extend both proxy handling and `authConfig.authorized` to protect `/profile`. Preserve safe relative callback paths.

- [ ] **Step 5: Run UI/full tests and commit**

```powershell
npm test -- tests/components/api-token-manager.test.tsx
npm test
git add package.json package-lock.json app/profile components/api-token-manager.tsx components/dashboard.tsx proxy.ts lib/auth.config.ts tests/components
git commit -m "feat: add API token profile interface"
```

---

### Task 9: Close the login redirect vulnerability and configure secrets

**Files:**
- Create: `tests/auth/safe-callback.test.ts`
- Create: `lib/auth-callback.ts`
- Modify: `app/(auth)/login/page.tsx`
- Create: `.env.example`
- Modify: `README.md`

**Interfaces:**
- Produces: `safeCallbackPath(value, fallback)` returning only same-origin relative application paths.

- [ ] **Step 1: Write failing callback sanitizer tests**

```ts
expect(safeCallbackPath("/dashboard?upload=true", "/dashboard")).toBe("/dashboard?upload=true");
expect(safeCallbackPath("https://evil.example", "/dashboard")).toBe("/dashboard");
expect(safeCallbackPath("//evil.example", "/dashboard")).toBe("/dashboard");
expect(safeCallbackPath("javascript:alert(1)", "/dashboard")).toBe("/dashboard");
```

- [ ] **Step 2: Verify callback tests fail**

Run: `npm test -- tests/auth/safe-callback.test.ts`

- [ ] **Step 3: Implement and use safe callbacks**

Accept only strings beginning with one `/` and not `//`; resolve against a fixed same-origin base and require the resulting origin to match. Use the sanitized path for both credentials and Google sign-in.

- [ ] **Step 4: Add environment template and accurate setup text**

Document all existing variables plus `API_TOKEN_HASH_PEPPER`, `CLEANUP_SECRET`, `MAX_FILE_SIZE_BYTES=5368709120`, and `USER_STORAGE_LIMIT_BYTES=10737418240`. Remove claims for unimplemented automatic cleanup or validation only after the implemented behavior is accurately described.

- [ ] **Step 5: Run tests and commit**

```powershell
npm test
git add lib/auth-callback.ts 'app/(auth)/login/page.tsx' .env.example README.md tests/auth/safe-callback.test.ts
git commit -m "fix: validate auth callbacks and document secrets"
```

---

### Task 10: OpenAPI contract and operator documentation

**Files:**
- Create: `public/openapi.yaml`
- Create: `docs/api.md`
- Create: `tests/docs/openapi.test.ts`
- Modify: `README.md`

**Interfaces:**
- Documents the completed `/api/v1` contract without changing runtime behavior.

- [ ] **Step 1: Add an OpenAPI parser and write a failing contract test**

Install `@readme/openapi-parser` as a dev dependency. The test parses `public/openapi.yaml`, asserts OpenAPI `3.1.x`, bearer security, all eight endpoint/method pairs, component schemas for error/pagination/upload, and documented 401/403/429 responses.

- [ ] **Step 2: Verify the contract test fails**

Run: `npm test -- tests/docs/openapi.test.ts`

Expected: FAIL because the OpenAPI document does not exist.

- [ ] **Step 3: Write the OpenAPI document**

Describe exact query/body constraints, scopes, headers, response envelopes, status codes, idempotency behavior, and examples. Mark `uploadUrl` and `downloadUrl` as URI strings and warn that they are temporary secrets.

- [ ] **Step 4: Write the human API guide**

Include commands that set `SHERIFF_API_TOKEN` locally without echoing it, initialize an upload, extract the returned URL/file ID, PUT exact bytes with required headers, finalize, paginate, download, rename, change visibility, trash, restore, and permanently delete. Cover token revocation delay for already-issued R2 URLs and all error codes.

- [ ] **Step 5: Verify docs and commit**

```powershell
npm test -- tests/docs/openapi.test.ts
git add package.json package-lock.json public/openapi.yaml docs/api.md README.md tests/docs/openapi.test.ts
git commit -m "docs: publish personal file API contract"
```

---

### Task 11: Full verification and release audit

**Files:**
- Modify only files required to fix failures revealed by verification, with a reproducing test first for behavioral defects.

- [ ] **Step 1: Run the complete automated suite**

Run: `npm test`

Expected: all tests pass with no warnings or unhandled rejections.

- [ ] **Step 2: Run static verification**

```powershell
npm run lint
npm run typecheck
```

Expected: both commands exit 0.

- [ ] **Step 3: Run the production build**

Run: `npm run build`

Expected: Next.js production build exits 0. If real environment variables are unavailable, use explicit non-secret test values only where build-time validation permits and never commit them.

- [ ] **Step 4: Audit authorization and secret exposure**

```powershell
rg -n "Authorization|tokenHash|uploadUrl|downloadUrl|storageKey|console\." app lib components
rg -n "findById|findOne|findOneAndUpdate|updateOne|deleteOne" app/api/v1 lib/files
```

Confirm every versioned file query is owner-scoped, every route declares a scope, and logs cannot include credentials or signed URLs.

- [ ] **Step 5: Audit documentation/spec coverage**

Verify all spec endpoints appear in OpenAPI and all configuration variables appear in `.env.example` and README. Confirm no `TBD`, `TODO`, or undocumented status code remains.

- [ ] **Step 6: Check repository state and commit final fixes**

```powershell
git diff --check
git status --short
```

If verification revealed a behavioral defect, first add a failing regression test, make it pass, stage the exact test and production files shown by `git status --short`, and commit them with `git commit -m "fix: resolve API release verification findings"`. Skip the final commit when verification required no changes.

- [ ] **Step 7: Perform the documented real-service smoke test**

With user-provided development credentials outside version control, create a token in `/profile`, upload a small text file using the documented curl flow, confirm/list/download it, revoke the token, and verify a new request receives 401. Record the result in the handoff; do not store the token or signed URLs.
