import * as path from 'node:path';

import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * The S3 clients both buckets use, or null when storage is not configured.
 *
 * `client` talks to storage from the API (inside docker that is
 * http://minio:9000). `signer` only signs URLs that a BROWSER will use, and a
 * presigned URL's signature covers its host, so it signs for the public
 * address instead: S3_PUBLIC_ENDPOINT when set, else the origin of the public
 * bucket URL (path-style, so the bucket is its last path segment). Signing is
 * local maths, so `signer` never makes a request of its own.
 */
export function s3Clients(): { client: S3Client; signer: S3Client } | null {
  const endpoint = process.env.S3_ENDPOINT;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  if (!endpoint || !accessKeyId || !secretAccessKey) return null;

  const options = {
    region: process.env.S3_REGION ?? 'us-east-1',
    credentials: { accessKeyId, secretAccessKey },
    // MinIO serves buckets as a path segment, not a subdomain. AWS S3 still
    // accepts path-style requests too, so this is right for both.
    forcePathStyle: true,
  };
  const publicBucket = process.env.S3_PUBLIC_BUCKET ?? 'enzo-public';
  const publicBase = (process.env.S3_PUBLIC_BASE_URL ?? '').replace(/\/+$/, '');
  const publicEndpoint =
    process.env.S3_PUBLIC_ENDPOINT ??
    (publicBase.endsWith(`/${publicBucket}`) ? publicBase.slice(0, -(publicBucket.length + 1)) : endpoint);

  return {
    client: new S3Client({ ...options, endpoint }),
    signer: new S3Client({ ...options, endpoint: publicEndpoint }),
  };
}

/** How long a download link works. Short: it is a bearer credential for the file. */
export const DOWNLOAD_TTL_SECONDS = 300;

/**
 * What the portal may show in the page rather than download. Read from the key's
 * extension, which the API set from the sniffed type at upload, never from the name.
 */
const INLINE_TYPES: Record<string, 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp'> = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};
export const inlineType = (key: string) => INLINE_TYPES[path.extname(key).toLowerCase()];
export const previewOf = (key: string) => {
  const type = inlineType(key);
  return type ? (type === 'application/pdf' ? 'pdf' : 'image') : null;
};

/**
 * The PRIVATE bucket (S3_PRIVATE_BUCKET): client documents. Nothing in it is
 * public; the database holds object keys only, and every read is a presigned
 * GET made per request after an access check, never stored or cached.
 */
@Injectable()
export class PrivateStorage {
  private readonly logger = new Logger(PrivateStorage.name);
  private readonly s3 = s3Clients();
  private readonly bucket = process.env.S3_PRIVATE_BUCKET ?? 'enzo-private';

  private require(): { client: S3Client; signer: S3Client } {
    if (!this.s3) {
      throw new BadRequestException('File storage is not configured on this server. Set S3_ENDPOINT and its credentials.');
    }
    return this.s3;
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.require().client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }),
    );
  }

  /** The object's bytes, for the API to copy it (a chat attachment made from a project document). */
  async get(key: string): Promise<Buffer> {
    const out = await this.require().client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    return Buffer.from(await out.Body!.transformToByteArray());
  }

  /**
   * A GET link for `key` that downloads as `filename` and dies in five minutes.
   * Given `inlineType`, the browser shows it as that type instead (the portal's viewer).
   */
  async downloadUrl(key: string, filename: string, inlineType?: string): Promise<string> {
    // Header-safe ASCII fallback, plus the exact name for browsers that read filename*.
    const ascii = filename.replace(/[^\w.\- ()]+/g, '_').slice(0, 150) || 'document';
    return getSignedUrl(
      this.require().signer,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ResponseContentDisposition: `${inlineType ? 'inline' : 'attachment'}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        ResponseCacheControl: 'private, no-store',
        ...(inlineType ? { ResponseContentType: inlineType } : {}),
      }),
      { expiresIn: DOWNLOAD_TTL_SECONDS },
    );
  }

  /**
   * Best effort: the row is what the app reads, so a stranded object costs
   * storage, not correctness. Logged so it can be swept by hand.
   */
  async remove(key: string): Promise<void> {
    if (!this.s3) return;
    try {
      await this.s3.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch (error) {
      this.logger.warn(
        `Could not delete private object ${key}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
