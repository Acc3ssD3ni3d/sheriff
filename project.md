# Sheriff — Secure File Storage Service

## 1. Tech Stack

### Frontend
- Next.js
- React
- TypeScript
- Tailwind CSS
- shadcn/ui (optional)

### Backend
- Next.js App Router
- Next.js Route Handlers
- TypeScript
- Zod

### Database
- MongoDB Atlas
- Mongoose

### Authentication
- Auth.js / secure session authentication
- bcrypt or bcryptjs for password hashing

### File Storage
- Cloudflare R2
- S3-compatible API
- Presigned URLs for secure uploads/downloads

### Deployment
- Vercel
- MongoDB Atlas
- Cloudflare R2

### Development Goal
- Keep the project at ₹0 cost
- Stay within Cloudflare R2 free allowance
- Do not use AWS S3
- Do not use Cloudinary
- Do not store large files inside MongoDB

---

# 2. Architecture

```text
Browser
   |
   v
Next.js
   |
   +--------------------+
   |                    |
   v                    v
MongoDB Atlas       Cloudflare R2
   |                    |
Users               Actual files
File metadata       100MB+ files
Permissions
```

### Upload flow

```text
User selects file
        |
        v
Next.js API
        |
        +--> Authenticate user
        |
        +--> Validate file
        |
        +--> Create file metadata
        |
        +--> Generate R2 presigned upload URL
        |
        v
Browser uploads directly to R2
        |
        v
Upload completed
        |
        v
MongoDB metadata updated
```

### Download flow

```text
User requests file
        |
        v
Next.js API
        |
        +--> Authenticate
        |
        +--> Check ownership / public access
        |
        +--> Generate signed R2 download URL
        |
        v
User downloads from R2
```

---

# 3. Project Structure

Keep the number of files as low as practical.

```text
sheriff/
│
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   │   └── page.tsx
│   │   └── register/
│   │       └── page.tsx
│   │
│   ├── dashboard/
│   │   └── page.tsx
│   │
│   ├── share/
│   │   └── [token]/
│   │       └── page.tsx
│   │
│   ├── api/
│   │   ├── auth/
│   │   │   └── [...nextauth]/
│   │   │       └── route.ts
│   │   └── files/
│   │       ├── route.ts
│   │       └── [id]/
│   │           ├── route.ts
│   │           ├── download/
│   │           │   └── route.ts
│   │           └── visibility/
│   │               └── route.ts
│   │
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
│
├── components/
│   ├── dashboard.tsx
│   ├── file-list.tsx
│   ├── upload-dialog.tsx
│   └── ui/
│
├── lib/
│   ├── auth.ts
│   ├── db.ts
│   ├── r2.ts
│   ├── validation.ts
│   └── utils.ts
│
├── models/
│   ├── user.ts
│   └── file.ts
│
├── types/
│   └── index.ts
│
├── .env.local
├── .env.example
├── middleware.ts
├── package.json
├── tsconfig.json
├── next.config.ts
└── README.md
```

### File-count rule

Do not create files just for the sake of abstraction.

Keep:
- Authentication logic in `lib/auth.ts`
- MongoDB connection in `lib/db.ts`
- R2 logic in `lib/r2.ts`
- Validation in `lib/validation.ts`
- Utility functions in `lib/utils.ts`
- User model in `models/user.ts`
- File model in `models/file.ts`

Avoid:
- Separate service folder for every feature
- Separate controller files
- Separate repository layer
- Express server
- Microservices

For a 2-day assignment, this structure is enough.

---

# 4. Environment Variables

```env
MONGODB_URI=
AUTH_SECRET=

R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_ENDPOINT=
```

Never commit `.env.local`.

Commit `.env.example` with empty values.

---

# 5. Authentication

- [ ] Register
- [ ] Login
- [ ] Logout
- [ ] Password hashing
- [ ] Secure session
- [ ] Protected dashboard

---

# 6. User Dashboard

- [ ] Dashboard
- [ ] User profile/basic user info
- [ ] File list
- [ ] Search files
- [ ] Sort files
- [ ] Empty state

---

# 7. File Upload

- [ ] File upload
- [ ] Upload 100MB+ files
- [ ] Upload progress
- [ ] Upload success state
- [ ] Upload failure state
- [ ] Retry failed upload
- [ ] File size validation
- [ ] File type validation
- [ ] Filename validation

Use R2 presigned URLs so large files upload directly from the browser to R2 instead of passing the entire file through the Next.js server.

---

# 8. File Management

- [ ] View file details
- [ ] Download file
- [ ] Rename file
- [ ] Delete file
- [ ] Delete confirmation
- [ ] File metadata

---

# 9. File Privacy

- [ ] Make file public
- [ ] Make file private
- [ ] Private file authorization
- [ ] Owner-only file access

---

# 10. File Sharing

- [ ] Generate share link
- [ ] Secure share token
- [ ] Public share page
- [ ] Download from share page
- [ ] Invalid share-link handling

Example:

```text
/share/secure-random-token
```

Never expose MongoDB `_id` as the public share token.

---

# 11. Security

- [ ] Authentication validation
- [ ] Authorization validation
- [ ] File ownership checks
- [ ] Server-side validation
- [ ] MIME type validation
- [ ] File extension validation
- [ ] File size validation
- [ ] Filename sanitization
- [ ] Secure storage filenames
- [ ] Prevent unauthorized file access
- [ ] Do not expose R2 credentials to browser
- [ ] Use presigned R2 URLs
- [ ] Do not trust client-side validation

---

# 12. API

- [ ] Authentication APIs
- [ ] File upload API
- [ ] Get files API
- [ ] Get file API
- [ ] Download API
- [ ] Rename API
- [ ] Delete API
- [ ] Public/private API
- [ ] Share API
- [ ] Request validation
- [ ] Proper HTTP status codes
- [ ] API error handling

Recommended routes:

```text
/api/auth/*
/api/files
/api/files/[id]
/api/files/[id]/download
/api/files/[id]/visibility
```

The share page can use:

```text
/share/[token]
```

---

# 13. Database

## User model

```text
User
- _id
- name
- email
- passwordHash
- createdAt
- updatedAt
```

## File model

```text
File
- _id
- ownerId
- originalName
- storageKey
- mimeType
- size
- visibility
- shareToken
- status
- createdAt
- updatedAt
```

### File visibility

```text
public
private
```

### File status

```text
uploading
completed
failed
```

---

# 14. Storage

Use Cloudflare R2.

- [ ] R2 bucket
- [ ] Storage service
- [ ] Generate upload URL
- [ ] Upload to R2
- [ ] Generate download URL
- [ ] Read/download from R2
- [ ] Delete from R2
- [ ] Storage error handling

MongoDB stores metadata.

R2 stores actual files.

Never store 100MB+ files directly in MongoDB.

---

# 15. UI/UX

- [ ] Responsive design
- [ ] Loading states
- [ ] Upload progress UI
- [ ] Error messages
- [ ] Success messages
- [ ] Toast notifications
- [ ] Confirmation dialogs
- [ ] Mobile-friendly dashboard

Keep the UI clean and professional.

Do not spend significant time on animations.

---

# 16. Testing

- [ ] Register test
- [ ] Login test
- [ ] Logout test
- [ ] Upload test
- [ ] 100MB+ upload test
- [ ] Download test
- [ ] Rename test
- [ ] Delete test
- [ ] Public file test
- [ ] Private file test
- [ ] Share link test
- [ ] Unauthorized access test
- [ ] Invalid file test
- [ ] Oversized file test
- [ ] Invalid share token test

---

# 17. Final

- [ ] Environment variables
- [ ] Error handling
- [ ] README
- [ ] Setup instructions
- [ ] Architecture documentation
- [ ] API documentation
- [ ] GitHub cleanup
- [ ] Production build test
- [ ] Deployment
- [ ] R2 free-tier usage checked

---

# 18. Priority

## Must Have

- [ ] Register
- [ ] Login
- [ ] Logout
- [ ] Authentication
- [ ] Dashboard
- [ ] File upload
- [ ] 100MB+ upload
- [ ] Upload progress
- [ ] File validation
- [ ] Download
- [ ] Delete
- [ ] Public/private
- [ ] Share link
- [ ] Authorization
- [ ] Security
- [ ] Error handling
- [ ] Cloudflare R2 integration

## Should Have

- [ ] Rename
- [ ] Search
- [ ] Sort
- [ ] Toasts
- [ ] Loading states
- [ ] Responsive UI
- [ ] Retry upload
- [ ] API documentation

## Only If We Finish Early

- [ ] Drag & drop
- [ ] File previews
- [ ] Folders
- [ ] Bulk upload
- [ ] Bulk delete
- [ ] Trash/recycle bin
- [ ] Advanced search
- [ ] Resumable uploads
- [ ] Extensive automated tests

---

# 19. Build Order

1. Project setup
2. MongoDB connection
3. User model
4. File model
5. Authentication
6. R2 setup
7. R2 upload flow
8. File upload UI
9. Dashboard
10. File management
11. Public/private files
12. File sharing
13. Authorization/security
14. Error handling
15. UI polish
16. Testing
17. README
18. Production build
19. Deployment

---

# 20. Two-Day Target

## Day 1

Goal: Complete working application.

- Project setup
- MongoDB
- Authentication
- Dashboard
- R2 connection
- File upload
- 100MB+ upload
- File list
- Download
- Delete
- Rename
- Public/private
- Share link

## Day 2

Goal: Make it production-quality for submission.

- Authorization audit
- Security
- Validation
- Upload progress
- Error handling
- Search
- Sort
- Responsive UI
- Loading states
- Testing
- README
- Documentation
- Production build
- Deployment

---

# 21. Final Stack Summary

```text
Sheriff
│
├── Next.js
├── React
├── TypeScript
├── Tailwind CSS
├── Zod
├── Auth.js
├── bcrypt/bcryptjs
├── MongoDB Atlas
├── Mongoose
├── Cloudflare R2
└── Vercel
```

Core architecture:

```text
Next.js
   |
   +---- MongoDB Atlas
   |       |
   |       +-- Users
   |       +-- File metadata
   |       +-- Permissions
   |
   +---- Cloudflare R2
           |
           +-- Actual files
           +-- 100MB+ files
```

Primary objective:

Build a secure, maintainable, production-style file storage service that directly satisfies Persist Ventures' assignment requirements without unnecessary features.
