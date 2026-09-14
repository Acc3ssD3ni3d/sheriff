# Sheriff

Sheriff is a private file-storage and sharing application built with Next.js 16, React 19, Auth.js, MongoDB, and Cloudflare R2. Signed-in users can manage files in the dashboard or create scoped personal access tokens for automation.

## Features

- Credentials and Google authentication with protected dashboard/profile pages.
- Direct-to-R2 uploads with progress, server-generated object keys, quota reservation, and server-side size/content-type verification.
- Owner-scoped list, download, rename, visibility, trash, restore, and permanent deletion operations.
- Public share links protected by unguessable share tokens; making a file private or deleting it revokes the link.
- `/api/v1` personal API with HMAC-hashed tokens, least-privilege scopes, expiry/revocation, rate limits, request IDs, cursor pagination, and idempotent uploads.
- Stale-upload cleanup that releases reserved quota and attempts R2 object cleanup.

## Local setup

Requirements: Node.js 20+, MongoDB (transactions require a replica set/Atlas), and a private Cloudflare R2 bucket.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. Fill every required value in `.env.local`; never commit credentials.

### Environment

| Variable | Purpose |
| --- | --- |
| `MONGODB_URI` | MongoDB connection string |
| `AUTH_SECRET`, `AUTH_URL` | Auth.js secret and application URL |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Optional Google provider credentials |
| `API_TOKEN_HASH_PEPPER` | Independent long random secret used to HMAC personal tokens |
| `CLEANUP_SECRET` | Independent bearer secret for the internal cleanup job |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` | R2 access and bucket |
| `R2_ENDPOINT` | Optional explicit S3-compatible endpoint |
| `MAX_FILE_SIZE_BYTES` | Optional per-object limit; defaults to 5 GiB |
| `USER_STORAGE_LIMIT_BYTES` | Optional per-user limit; defaults to 10 GiB; trash counts |

Generate separate high-entropy values for `AUTH_SECRET`, `API_TOKEN_HASH_PEPPER`, and `CLEANUP_SECRET`. Production validation reports missing variable names without printing secret values.

## Personal API

After signing in, open `/profile` to generate a token. The plaintext appears once. Available scopes are:

- `files:read`: metadata, lists, and temporary download URLs.
- `files:write`: upload initialization/completion, rename, and visibility.
- `files:delete`: trash, restore, and permanent deletion.

See [the curl guide](docs/api.md) and [OpenAPI 3.1 contract](public/openapi.yaml). The app also serves a concise authenticated guide at `/docs/api` and the contract at `/openapi.yaml`.

The API is intended for server, CLI, and trusted native clients. It deliberately does not enable permissive cross-origin browser access. Personal tokens can access only resources whose `ownerId` matches the token owner.

## Cleanup scheduling

Call this endpoint regularly (for example every five minutes) from a trusted scheduler:

```bash
curl -X POST https://your-host/api/internal/cleanup/uploads \
  -H "Authorization: Bearer $CLEANUP_SECRET"
```

It processes up to 100 expired 15-minute upload reservations per invocation. Repeated calls are safe because reservation release is conditional and transactional.

## Verification

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

Actual bytes live in R2. MongoDB stores users, file metadata, quota counters, token digests, and rate-limit buckets. Presigned URLs last 15 minutes and must be treated as temporary secrets.
