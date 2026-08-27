Sheriff

Sheriff is a secure full-stack file storage and sharing application built for the Persist Ventures Full Stack Engineer assignment.

It allows authenticated users to upload, manage, download, and share files while keeping private files protected through server-side authorization.

Features

Authentication

User registration

Login and logout

Password hashing

Secure authentication sessions

Protected dashboard

File Storage

Upload files to Cloudflare R2

Support for 100MB+ files

Upload progress

File size and type validation

Secure generated storage keys

File metadata stored in MongoDB

File Management

View uploaded files

Download files

Rename files

Delete files

Search and sort files

Upload status and error handling

File Sharing

Public/private file visibility

Secure share tokens

Public share pages

Public file downloads

Invalid share-link handling

Security

Server-side validation

Authentication checks

File ownership authorization

MIME type validation

File extension validation

File size validation

Filename sanitization

Secure R2 access using server-generated signed URLs

R2 credentials are never exposed to the client

Tech Stack

Next.js

React

TypeScript

Tailwind CSS

MongoDB Atlas

Mongoose

Auth.js

Zod

Cloudflare R2

Vercel

Architecture

Browser
   |
   v
Next.js
   |
   +----------------------+
   |                      |
   v                      v
MongoDB Atlas         Cloudflare R2
   |                      |
User data             Actual files
File metadata         100MB+ files
Permissions

Large files are uploaded directly to Cloudflare R2 using a secure upload flow instead of sending the complete file through the Next.js application server.

For downloads, the application first authenticates the user and checks the file's visibility/ownership before generating access to the stored object.

Environment Variables

Create a .env.local file in the project root:

# MongoDB
MONGODB_URI=mongodb+srv://...

# Auth.js
AUTH_SECRET=your-secret-here
AUTH_URL=http://localhost:3000

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Cloudflare R2
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key
R2_SECRET_ACCESS_KEY=your-secret-key
R2_BUCKET_NAME=sheriff-files
R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com

Never commit .env.local or real credentials to GitHub.

Getting Started

1. Clone the repository

git clone <your-repository-url>
cd sheriff

2. Install dependencies

npm install

3. Configure environment variables

Create .env.local and add the required MongoDB, Auth.js, Google OAuth, and Cloudflare R2 credentials.

4. Start the development server

npm run dev

Open http://localhost:3000.

Cloudflare R2 Setup

Create an R2 bucket and configure an API token with the minimum required permissions.

Recommended:

Object Read & Write

Restrict access to the Sheriff bucket only

Required values:

R2_ACCOUNT_ID

R2_ACCESS_KEY_ID

R2_SECRET_ACCESS_KEY

R2_BUCKET_NAME

R2_ENDPOINT

Do not expose R2 access keys through client-side environment variables.

Database

MongoDB stores application data and file metadata.

User

_id
name
email
passwordHash
createdAt
updatedAt

File

_id
ownerId
originalName
storageKey
mimeType
size
visibility
shareToken
status
createdAt
updatedAt

Actual file contents are stored in Cloudflare R2, not MongoDB.

Security Model

Every protected file operation follows:

Request
   |
   v
Authenticate user
   |
   v
Find file
   |
   v
Check ownership / public visibility
   |
   v
Allow or reject request

A logged-in user cannot access another user's private file simply by knowing its file ID.

Public files are accessed through secure share tokens rather than exposing internal database identifiers as public links.

API Overview

GET    /api/files
POST   /api/files
GET    /api/files/[id]
PATCH  /api/files/[id]
DELETE /api/files/[id]

GET    /api/files/[id]/download
PATCH  /api/files/[id]/visibility

GET    /share/[token]

Authentication routes are handled through the configured Auth.js setup.

Testing Checklist

Register

Login

Logout

Protected dashboard

Upload a normal file

Upload a 100MB+ file

Upload progress

Invalid file validation

Oversized file validation

Download

Rename

Delete

Public file

Private file

Public share link

Invalid share link

Unauthorized file access

Production build

Development

npm run dev

Production Build

npm run build
npm start

Assignment

Built as a Full Stack Engineer technical assignment for Persist Ventures.

The implementation focuses on secure authentication, authorization, scalable file storage, RESTful API design, MongoDB data modeling, cloud object storage, file validation, error handling, maintainable architecture, and responsive user experience.

License

This project is created for evaluation and portfolio purposes.