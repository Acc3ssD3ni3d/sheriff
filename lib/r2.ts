import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getServerEnv } from "@/lib/env";

let cachedClient: S3Client | null = null;

function r2Config() {
  const env = getServerEnv();
  return {
    bucket: env.R2_BUCKET_NAME,
    client:
      cachedClient ??=
        new S3Client({
          region: "auto",
          endpoint:
            env.R2_ENDPOINT ||
            `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
          credentials: {
            accessKeyId: env.R2_ACCESS_KEY_ID,
            secretAccessKey: env.R2_SECRET_ACCESS_KEY,
          },
        }),
  };
}

export async function getPresignedUploadUrl(
  key: string,
  contentType?: string,
  contentLength?: number,
): Promise<string> {
  const { bucket, client } = r2Config();
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ...(contentType ? { ContentType: contentType } : {}),
    ...(contentLength ? { ContentLength: contentLength } : {}),
  });

  return await getSignedUrl(client, command, { expiresIn: 900 });
}

export async function getPresignedDownloadUrl(
  key: string,
  originalName: string,
  disposition: "attachment" | "inline" = "attachment",
): Promise<string> {
  const { bucket, client } = r2Config();
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
    ResponseContentDisposition: `${disposition}; filename="${encodeURIComponent(
      originalName,
    )}"`,
  });

  return await getSignedUrl(client, command, { expiresIn: 900 });
}

export async function deleteFromR2(key: string): Promise<void> {
  const { bucket, client } = r2Config();
  const command = new DeleteObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  await client.send(command);
}

export async function headR2Object(
  key: string,
): Promise<{ size: number; contentType: string } | null> {
  const { bucket, client } = r2Config();
  try {
    const result = await client.send(
      new HeadObjectCommand({ Bucket: bucket, Key: key }),
    );
    if (result.ContentLength === undefined) return null;
    return {
      size: result.ContentLength,
      contentType: result.ContentType ?? "application/octet-stream",
    };
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      ("name" in error && error.name === "NotFound")
    ) {
      return null;
    }
    throw error;
  }
}
