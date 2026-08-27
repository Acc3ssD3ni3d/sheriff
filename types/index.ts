export interface IUser {
  _id: string;
  name: string;
  email: string;
  passwordHash?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type FileVisibility = "public" | "private";
export type FileStatus = "uploading" | "completed" | "failed";

export interface IFile {
  _id: string;
  ownerId: string;
  originalName: string;
  storageKey: string;
  mimeType: string;
  size: number;
  visibility: FileVisibility;
  shareToken: string | null;
  status: FileStatus;
  deletedAt: Date | null; // <--- Added this for the Trash feature
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PresignedUploadResponse {
  uploadUrl: string;
  fileId: string;
  storageKey: string;
}
