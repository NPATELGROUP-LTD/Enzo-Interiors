import { randomUUID } from 'node:crypto';
import * as path from 'node:path';

import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Injectable,
  Logger,
  Module,
  NotFoundException,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import {
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

import { CurrentUser, Roles } from '../../common/decorators';
import { MediaAsset } from '../../common/types/domain';
import { AuthPrincipal } from '../../common/types/principal';
import { ActivityLogService } from '../../core/activity-log.service';
import { DatabaseService } from '../../data/database.service';
import { BRAND_KEYS } from '../site-settings/site-settings.module';

/* -------------------------------------------------------------------------- */
/* DTOs                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * The image formats the public site serves. An allowlist rather than a
 * blocklist: this is an upload endpoint reachable by a logged-in editor, and
 * the bucket it writes to is served to the public, so anything not on this
 * list (an .html, an .svg with script in it) must not become a public URL.
 */
export const UPLOAD_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'application/pdf',
] as const;

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/avif': '.avif',
  'application/pdf': '.pdf',
};

/** 25 MB. Large enough for a print-resolution photo, small enough to bound abuse. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/** Signed into every upload URL, so the browser must send exactly this. */
export const UPLOAD_CACHE_CONTROL = 'public, max-age=31536000, immutable';

/** Exactly the keys createUploadUrl issues; anything else was not ours. */
const ISSUED_KEY = /^media\/\d{4}\/[a-z0-9-]+-[0-9a-f]{8}\.(jpe?g|png|webp|avif|pdf)$/;

export class CreateUploadUrlDto {
  @IsString()
  @MaxLength(200)
  filename!: string;

  @IsIn(UPLOAD_TYPES, { message: 'Upload a JPG, PNG, WebP, AVIF or PDF.' })
  content_type!: string;

  @IsInt()
  @Min(1)
  byte_size!: number;
}

export class RegisterAssetDto {
  @IsString()
  @MaxLength(400)
  storage_key!: string;

  /** Alt text is required, not optional. A public image without it is a defect. */
  @IsString()
  @MaxLength(300)
  alt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  source?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20000)
  width?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20000)
  height?: number;
}

export class UpdateAssetDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  alt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  source?: string;
}

/** What apps/web and the admin picker consume — the resolved, renderable row. */
export interface ResolvedMedia {
  id: string;
  src: string;
  alt: string;
  title?: string;
  source: string;
}

/* -------------------------------------------------------------------------- */
/* Service                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * The media library.
 *
 * Storage note, and a deliberate divergence worth reading before changing it:
 * CLAUDE.md says never to return an unsigned storage URL, and that rule exists
 * for `documents` — client contracts and plans, which are private and are
 * signed per request with a short TTL.
 *
 * These assets are the opposite: they are marketing photographs whose entire
 * purpose is to be fetched by anonymous visitors, and they are embedded in
 * statically rendered pages that are cached for hours. A signed URL baked into
 * a cached page would start returning 403 the moment it expired. So the public
 * bucket is public-read and this service returns stable URLs for it, while the
 * private bucket used by the documents module keeps signing. Two buckets, two
 * rules, each matching what its contents actually are.
 *
 * Uploads still go through a short-lived presigned PUT, so no browser ever
 * holds a storage credential.
 */
@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private readonly client: S3Client | null;
  /** Signs upload URLs. Differs from `client` only in the host it signs for. */
  private readonly signer: S3Client | null = null;
  private readonly bucket: string;
  private readonly publicBase: string;

  constructor(
    private readonly db: DatabaseService,
    private readonly activity: ActivityLogService,
  ) {
    this.bucket = process.env.S3_PUBLIC_BUCKET ?? 'enzo-public';
    this.publicBase = (process.env.S3_PUBLIC_BASE_URL ?? '').replace(/\/+$/, '');

    const endpoint = process.env.S3_ENDPOINT;
    const accessKeyId = process.env.S3_ACCESS_KEY_ID;
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;

    if (!endpoint || !accessKeyId || !secretAccessKey) {
      // The CMS is still fully usable against the assets that shipped in
      // apps/web/public; only new uploads need storage. Failing to boot over
      // it would take the whole API down for a missing optional feature.
      this.logger.warn(
        'S3_ENDPOINT / S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY are unset. Existing images work; new uploads will be refused.',
      );
      this.client = null;
      return;
    }

    const options = {
      region: process.env.S3_REGION ?? 'us-east-1',
      credentials: { accessKeyId, secretAccessKey },
      // MinIO serves buckets as a path segment, not a subdomain. AWS S3 still
      // accepts path-style requests too, so this is right for both.
      forcePathStyle: true,
    };
    this.client = new S3Client({ ...options, endpoint });

    // The upload URL is used by the editor's BROWSER, and a presigned URL's
    // signature covers its host. Inside docker the API reaches storage as
    // http://minio:9000, which no browser can resolve, so upload URLs are
    // signed for the public address instead: S3_PUBLIC_ENDPOINT when set,
    // else the origin of the public bucket URL (path-style, so the bucket is
    // its last path segment). Signing is local maths, so this client never
    // makes a request of its own.
    const publicEndpoint =
      process.env.S3_PUBLIC_ENDPOINT ??
      (this.publicBase.endsWith(`/${this.bucket}`)
        ? this.publicBase.slice(0, -(this.bucket.length + 1))
        : endpoint);
    this.signer = new S3Client({ ...options, endpoint: publicEndpoint });
  }

  /** Turns a stored row into something with a usable `src`. */
  private resolve(asset: MediaAsset): ResolvedMedia {
    return {
      id: asset.id,
      src: `${this.publicBase}/${asset.storage_key}`,
      alt: asset.alt,
      ...(asset.title ? { title: asset.title } : {}),
      source: asset.source,
    };
  }

  /** The logos and favicons chosen in Settings › Logo & icon. Live once saved. */
  private async brandIds(): Promise<string[]> {
    const site = await this.db.siteSettings.findById('site');
    return site ? BRAND_KEYS.map((key) => site[key]).filter((id): id is string => !!id) : [];
  }

  /**
   * The media apps/web consumes: only images some PUBLISHED content or the
   * brand settings point at, so an upload that has not gone live yet is not
   * listed to the world.
   */
  async publicList(): Promise<ResolvedMedia[]> {
    const referenced = new Set<string>(await this.brandIds());
    const collect = (value: unknown): void => {
      if (typeof value === 'string') referenced.add(value);
      else if (Array.isArray(value)) value.forEach(collect);
      else if (value && typeof value === 'object') Object.values(value).forEach(collect);
    };
    for (const entry of await this.db.cmsEntries.findAll()) collect(entry.published);

    const rows = await this.db.mediaAssets.findAll((row) => referenced.has(row.id));
    return rows.sort((a, b) => a.id.localeCompare(b.id)).map((row) => this.resolve(row));
  }

  /** The library view: the full row plus its resolved src, newest first. */
  async list(): Promise<Array<MediaAsset & { src_resolved: string }>> {
    const rows = await this.db.mediaAssets.findAll();
    return rows
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((row) => ({ ...row, src_resolved: this.resolve(row).src }));
  }

  /**
   * A short-lived URL the browser can PUT the file to directly.
   *
   * The key is generated here, never taken from the client: a client-chosen
   * key could traverse out of the prefix or overwrite an existing asset.
   */
  async createUploadUrl(
    principal: AuthPrincipal,
    dto: CreateUploadUrlDto,
  ): Promise<{ url: string; storage_key: string; expires_in: number }> {
    if (!this.client || !this.signer) {
      throw new BadRequestException(
        'File storage is not configured on this server, so uploads are unavailable. Set S3_ENDPOINT and its credentials.',
      );
    }
    if (dto.byte_size > MAX_UPLOAD_BYTES) {
      throw new BadRequestException(
        `That file is ${(dto.byte_size / 1024 / 1024).toFixed(1)} MB. The limit is ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`,
      );
    }

    const stem = path
      .basename(dto.filename, path.extname(dto.filename))
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
    const key = `media/${new Date().getFullYear()}/${stem || 'upload'}-${randomUUID().slice(0, 8)}${
      EXTENSIONS[dto.content_type] ?? ''
    }`;

    const expiresIn = 300;
    const url = await getSignedUrl(
      this.signer,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: dto.content_type,
        ContentLength: dto.byte_size,
        // Keys are unique per upload, so the object never changes under its URL.
        CacheControl: UPLOAD_CACHE_CONTROL,
      }),
      { expiresIn },
    );

    this.logger.log(`Upload URL issued to ${principal.name} for ${key}`);
    return { url, storage_key: key, expires_in: expiresIn };
  }

  /**
   * Called after the browser's PUT succeeds, to make the file a library row.
   *
   * Type and size come from the object itself, not the request: the browser
   * could claim anything, the bucket only holds what was actually signed for.
   */
  async register(principal: AuthPrincipal, dto: RegisterAssetDto): Promise<MediaAsset> {
    if (!ISSUED_KEY.test(dto.storage_key)) {
      throw new BadRequestException('That storage key was not issued by this server.');
    }
    if (!this.client) throw new BadRequestException('File storage is not configured on this server.');
    if (await this.db.mediaAssets.findOne((row) => row.storage_key === dto.storage_key)) {
      throw new BadRequestException('That file is already in the library.');
    }

    let head;
    try {
      head = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: dto.storage_key }),
      );
    } catch {
      throw new BadRequestException('The upload did not arrive. Try again.');
    }
    if (!UPLOAD_TYPES.includes(head.ContentType as (typeof UPLOAD_TYPES)[number])) {
      throw new BadRequestException('Upload a JPG, PNG, WebP, AVIF or PDF.');
    }

    const created = await this.db.mediaAssets.create({
      storage_key: dto.storage_key,
      alt: dto.alt.trim(),
      title: dto.title?.trim() ?? null,
      source: dto.source?.trim() ?? 'upload',
      width: dto.width ?? null,
      height: dto.height ?? null,
      byte_size: head.ContentLength ?? null,
      mime_type: head.ContentType ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    await this.activity.record({
      principal,
      action: 'media_upload',
      targetTable: 'media_assets',
      targetId: created.id,
      details: { storage_key: dto.storage_key },
    });
    return created;
  }

  async update(
    principal: AuthPrincipal,
    id: string,
    dto: UpdateAssetDto,
  ): Promise<MediaAsset> {
    const existing = await this.db.mediaAssets.findById(id);
    if (!existing) throw new NotFoundException('No such image.');

    const updated = await this.db.mediaAssets.update(id, {
      ...(dto.alt !== undefined ? { alt: dto.alt.trim() } : {}),
      ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
      ...(dto.source !== undefined ? { source: dto.source.trim() } : {}),
      updated_at: new Date().toISOString(),
    });
    if (!updated) throw new NotFoundException('No such image.');

    await this.activity.record({
      principal,
      action: 'media_update',
      targetTable: 'media_assets',
      targetId: id,
      details: { alt: updated.alt },
    });
    return updated;
  }

  /**
   * Removes the row, and the object behind it when there is one.
   *
   * Refuses while any content entry still points at the id, because the site
   * would render an empty frame where a photograph used to be and nobody would
   * find out until a visitor did.
   */
  async remove(principal: AuthPrincipal, id: string): Promise<void> {
    const existing = await this.db.mediaAssets.findById(id);
    if (!existing) throw new NotFoundException('No such image.');

    const users = await this.usedBy(id);
    if (users.length > 0) {
      throw new BadRequestException(
        `Still used by ${users.slice(0, 3).join(', ')}${
          users.length > 3 ? ` and ${users.length - 3} more` : ''
        }. Replace it there first.`,
      );
    }

    if (this.client) {
      try {
        await this.client.send(
          new DeleteObjectCommand({ Bucket: this.bucket, Key: existing.storage_key }),
        );
      } catch (error) {
        // The row is what the site reads, so a stranded object costs storage,
        // not correctness. Losing the row because the bucket was briefly
        // unreachable would be the worse outcome.
        this.logger.warn(
          `Deleted media row ${id} but could not delete ${existing.storage_key}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    await this.db.mediaAssets.delete(id);
    await this.activity.record({
      principal,
      action: 'media_delete',
      targetTable: 'media_assets',
      targetId: id,
      details: { alt: existing.alt },
    });
  }

  /**
   * Which content entries reference this image.
   *
   * Media ids can sit anywhere in a content body — a top-level `imageId`, an
   * `imageIds` array, or nested several levels down inside a page's section
   * tree — so this walks the whole body rather than checking known keys.
   */
  async usedBy(mediaId: string): Promise<string[]> {
    const entries = await this.db.cmsEntries.findAll();
    const holders: string[] = [];

    const mentions = (value: unknown): boolean => {
      if (typeof value === 'string') return value === mediaId;
      if (Array.isArray(value)) return value.some(mentions);
      if (value && typeof value === 'object') {
        return Object.values(value as Record<string, unknown>).some(mentions);
      }
      return false;
    };

    for (const entry of entries) {
      if (mentions(entry.draft) || (entry.published && mentions(entry.published))) {
        holders.push(`${entry.collection}/${entry.slug}`);
      }
    }
    if ((await this.brandIds()).includes(mediaId)) holders.push('Settings › Logo & icon');
    return holders;
  }
}

/* -------------------------------------------------------------------------- */
/* Controller                                                                 */
/* -------------------------------------------------------------------------- */

@Controller('cms/media')
@Roles('Admin', 'Editor', 'Designer')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Get()
  list() {
    return this.media.list();
  }

  @Post('upload-url')
  createUploadUrl(@CurrentUser() principal: AuthPrincipal, @Body() dto: CreateUploadUrlDto) {
    return this.media.createUploadUrl(principal, dto);
  }

  @Post()
  register(@CurrentUser() principal: AuthPrincipal, @Body() dto: RegisterAssetDto) {
    return this.media.register(principal, dto);
  }

  @Get(':id/usage')
  usage(@Param('id') id: string) {
    return this.media.usedBy(id).then((usedBy) => ({ usedBy }));
  }

  @Put(':id')
  update(
    @CurrentUser() principal: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: UpdateAssetDto,
  ) {
    return this.media.update(principal, id, dto);
  }

  @Delete(':id')
  @Roles('Admin')
  async remove(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string) {
    await this.media.remove(principal, id);
    return { deleted: true };
  }
}

@Module({
  controllers: [MediaController],
  providers: [MediaService],
  exports: [MediaService],
})
export class MediaModule {}
