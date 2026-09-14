import { z } from "zod";
import { API_SCOPES } from "@/lib/api/tokens";

export const registerSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be at most 100 characters")
    .trim(),
  email: z
    .string()
    .email("Please enter a valid email address")
    .toLowerCase()
    .trim(),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(100, "Password must be at most 100 characters"),
});

export const loginSchema = z.object({
  email: z
    .string()
    .email("Please enter a valid email address")
    .toLowerCase()
    .trim(),
  password: z.string().min(1, "Password is required"),
});

export const fileInitUploadSchema = z.object({
  originalName: z.string().min(1, "Filename is required").max(255),
  mimeType: z.string().min(1, "MIME type is required"),
  size: z.number().positive("File size must be greater than 0"),
});

export const renameFileSchema = z.object({
  name: z.string().min(1, "Filename cannot be empty").max(255).trim(),
});

export const visibilitySchema = z.object({
  visibility: z.enum(["public", "private"]),
});

export const createApiTokenSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    scopes: z.array(z.enum(API_SCOPES)).min(1).transform((items) => [...new Set(items)]),
    expiresInDays: z.union([z.literal(30), z.literal(90), z.literal(365), z.null()]),
  })
  .strict();

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
