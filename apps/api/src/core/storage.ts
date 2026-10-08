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

  /** A GET link for `key` that downloads as `filename` and dies in five minutes. */
  async downloadUrl(key: string, filename: string): Promise<string> {
    // Header-safe ASCII fallback, plus the exact name for browsers that read filename*.
    const ascii = filename.replace(/[^\w.\- ()]+/g, '_').slice(0, 150) || 'document';
    return getSignedUrl(
      this.require().signer,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ResponseContentDisposition: `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        ResponseCacheControl: 'private, no-store',
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
