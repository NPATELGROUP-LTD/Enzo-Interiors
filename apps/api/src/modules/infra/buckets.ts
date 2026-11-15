import { ListObjectsV2Command, type S3Client } from '@aws-sdk/client-s3';

const MAX_PAGES = 50;
/** A stopped node never answers and the SDK has no connect timeout of its own. */
const PAGE_TIMEOUT_MS = 3_000;

export interface BucketUse {
  id: 'public' | 'private';
  files: number;
  bytes: number;
  /** Stopped counting at MAX_PAGES x 1000 files. */
  partial: boolean;
  error: string | null;
}

export async function countBucket(client: S3Client, id: BucketUse['id'], bucket: string): Promise<BucketUse> {
  let files = 0;
  let bytes = 0;
  let token: string | undefined;
  try {
    for (let page = 0; page < MAX_PAGES; page++) {
      const out = await client.send(new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: token }), { abortSignal: AbortSignal.timeout(PAGE_TIMEOUT_MS) });
      for (const object of out.Contents ?? []) {
        files += 1;
        bytes += object.Size ?? 0;
      }
      if (!out.IsTruncated) return { id, files, bytes, partial: false, error: null };
      token = out.NextContinuationToken;
    }
    return { id, files, bytes, partial: true, error: null };
  } catch {
    return { id, files, bytes, partial: false, error: 'Could not read this bucket.' };
  }
}
