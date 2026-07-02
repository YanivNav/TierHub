import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const R2 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT!, // https://<account-id>.r2.cloudflarestorage.com
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.R2_BUCKET_NAME!;

export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn = 3600
) {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(R2, command, { expiresIn });
}

export async function getPresignedDownloadUrl(key: string, expiresIn = 3600) {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(R2, command, { expiresIn });
}

export async function deleteObject(key: string) {
  await R2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

export function getPublicUrl(key: string) {
  return `${process.env.R2_PUBLIC_URL}/${key}`;
}

export function buildItemKey(userId: string, tierListId: string, filename: string) {
  return `items/${userId}/${tierListId}/${Date.now()}-${filename}`;
}

export function buildAvatarKey(userId: string, filename: string) {
  return `avatars/${userId}/${Date.now()}-${filename}`;
}

// Content-type allowlists for presigned uploads. Deliberately excludes
// image/svg+xml (SVG can embed scripts) and anything not a plain image/video.
export const AVATAR_CONTENT_TYPES = ["image/png", "image/jpeg", "image/webp"];
export const ITEM_CONTENT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
];
