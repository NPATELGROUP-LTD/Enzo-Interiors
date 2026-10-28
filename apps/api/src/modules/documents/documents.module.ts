import { randomUUID } from 'node:crypto';
import * as path from 'node:path';

import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

import { AccessService } from '../../common/access/access.service';
import { CurrentUser, Roles } from '../../common/decorators';
import { DOCUMENT_TYPES, DocumentRecord, DocumentType } from '../../common/types/domain';
import { AuthPrincipal } from '../../common/types/principal';
import { ActivityLogService } from '../../core/activity-log.service';
import { DOWNLOAD_TTL_SECONDS, inlineType, previewOf, PrivateStorage } from '../../core/storage';
import { DatabaseService } from '../../data/database.service';
import { NotificationsModule, NotificationsService } from '../notifications/notifications.module';

/** 25 MB: a full plan set or a signed contract scan, not a video. */
export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;

/**
 * What may be uploaded, by declared type, each checked against the file's
 * first bytes too: the declared type is the browser's (or an attacker's) word.
 */
const starts = (bytes: Buffer, hex: string, at = 0) => bytes.subarray(at, at + hex.length / 2).toString('hex') === hex;
const ZIP = (b: Buffer) => starts(b, '504b0304'); // .docx/.xlsx/.pptx are zip files
const OLE = (b: Buffer) => starts(b, 'd0cf11e0a1b11ae1'); // .doc/.xls
const FILE_TYPES: Record<string, { ext: string; matches: (bytes: Buffer) => boolean }> = {
  'application/pdf': { ext: '.pdf', matches: (b) => starts(b, '255044462d') },
  'image/jpeg': { ext: '.jpg', matches: (b) => starts(b, 'ffd8ff') },
  'image/png': { ext: '.png', matches: (b) => starts(b, '89504e470d0a1a0a') },
  'image/webp': { ext: '.webp', matches: (b) => starts(b, '52494646') && starts(b, '57454250', 8) },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { ext: '.docx', matches: ZIP },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { ext: '.xlsx', matches: ZIP },
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': { ext: '.pptx', matches: ZIP },
  'application/msword': { ext: '.doc', matches: OLE },
  'application/vnd.ms-excel': { ext: '.xls', matches: OLE },
};
const TYPES_MESSAGE = 'Upload a PDF, JPG, PNG, WebP, Word, Excel or PowerPoint file.';

/**
 * What the file is, by its own first bytes. The type the browser declares is only a tiebreak
 * (Word, Excel and PowerPoint share a header): Windows machines often declare a .png as
 * image/x-png, application/octet-stream or nothing, and that used to be refused as "not a PNG".
 * Returns the matching table entry, with its canonical type, or undefined.
 */
function identify(file: { buffer: Buffer; mimetype: string; originalname: string }) {
  const found = Object.entries(FILE_TYPES).filter(([, kind]) => kind.matches(file.buffer));
  const ext = path.extname(file.originalname).toLowerCase().replace('.jpeg', '.jpg');
  const hit = found.find(([type]) => type === file.mimetype) ?? found.find(([, kind]) => kind.ext === ext) ?? (found.length === 1 ? found[0] : undefined);
  return hit && { type: hit[0], ...hit[1] };
}

/** The part of a multer file this module reads (memory storage). */
interface UploadedDocument {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

/**
 * Multipart fields alongside `file`. New staff files are internal unless
 * `share` is "true" (a file sent in a chat goes to the client with it).
 */
export class UploadDocumentDto {
  @IsString() client_id!: string;
  @IsString() project_id!: string;

  @IsIn(DOCUMENT_TYPES, { message: `Type must be one of: ${DOCUMENT_TYPES.join(', ')}` })
  type!: DocumentType;

  /** Defaults to the file's own name. */
  @IsOptional() @IsString() @MinLength(1) @MaxLength(160) name?: string;

  @IsOptional() @IsIn(['true']) share?: 'true';
}

export class UpdateDocumentDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(160) name?: string;
  @IsOptional() @IsIn(DOCUMENT_TYPES) type?: DocumentType;
  /** Another project of the SAME client, within the caller's scope. */
  @IsOptional() @IsString() project_id?: string;
}

export class DocumentVisibilityDto {
  @IsBoolean() client_visible!: boolean;
}

/** A document as any screen sees it. Where it is stored is never sent. */
export type DocumentView = Omit<DocumentRecord, 'storage_url'> & {
  client_name: string;
  project_name: string | null;
  /** Whether the portal can show it in the page. */
  preview: 'pdf' | 'image' | null;
};

/**
 * Client documents, on the PRIVATE bucket (core/storage.ts).
 *
 * Who reaches which row is AccessService.documentScope: Admin all; a Designer
 * the documents of projects assigned to them; a client their own shared ones.
 * Out of scope is a 404 for everyone. `storage_url` holds the object key and
 * never leaves this service; a download is a fresh five-minute link per request.
 */
@Injectable()
export class DocumentsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly access: AccessService,
    private readonly activity: ActivityLogService,
    private readonly storage: PrivateStorage,
    private readonly notifications: NotificationsService,
  ) {}

  async list(principal: AuthPrincipal): Promise<DocumentView[]> {
    const rows = await this.db.documents.findWhere(await this.access.documentScope(principal), {
      orderBy: { upload_date: 'desc' },
    });
    return this.decorate(rows);
  }

  async findOne(principal: AuthPrincipal, id: string): Promise<DocumentView> {
    const [view] = await this.decorate([await this.require(principal, id)]);
    return view!;
  }

  /** `inline` = a link the browser shows rather than saves; ignored for types it cannot show. */
  async downloadUrl(principal: AuthPrincipal, id: string, inline = false): Promise<{ url: string; expires_in: number }> {
    const document = await this.require(principal, id);
    const url = await this.storage.downloadUrl(
      document.storage_url,
      document.name,
      inline ? inlineType(document.storage_url) : undefined,
    );
    await this.activity.record({
      principal,
      action: 'document_download',
      targetTable: 'documents',
      targetId: id,
      details: { name: document.name },
    });
    return { url, expires_in: DOWNLOAD_TTL_SECONDS };
  }

  async upload(
    principal: AuthPrincipal,
    dto: UploadDocumentDto,
    file: UploadedDocument | undefined,
  ): Promise<DocumentView> {
    if (!file) throw new BadRequestException('Choose a file to upload.');
    const kind = identify(file);
    if (!kind) throw new BadRequestException(`${TYPES_MESSAGE} "${file.originalname.slice(0, 80)}" is not one of them.`);

    // A client reaches only their own shared projects (requireProject), and
    // what they upload is theirs to see; a chat file is shared on purpose.
    const fromClient = this.access.isClient(principal);
    const share = fromClient || dto.share === 'true';
    const project = await this.access.requireProject(principal, dto.project_id);
    if (project.client_id !== dto.client_id) {
      throw new BadRequestException('That project belongs to a different client');
    }
    if (share && !project.client_visible) {
      throw new BadRequestException('Send this project to the client before sharing files on it.');
    }

    const name = (dto.name ?? file.originalname).trim().slice(0, 160) || `document${kind.ext}`;
    const stem = path
      .basename(name, path.extname(name))
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
    // Generated here, never taken from the request, so it cannot traverse or overwrite.
    const key = `clients/${project.client_id}/projects/${project.id}/${randomUUID()}-${stem || 'document'}${kind.ext}`;

    await this.storage.put(key, file.buffer, kind.type);
    let created: DocumentRecord;
    try {
      created = await this.db.documents.create({
        client_id: project.client_id,
        project_id: project.id,
        name,
        // A client cannot pass their file off as one of ours (a contract, an invoice).
        type: fromClient ? 'Other' : dto.type,
        size_bytes: file.size,
        upload_date: new Date().toISOString(),
        // Closed by default: an Admin sends a file to the client on purpose.
        client_visible: share,
        storage_url: key,
      });
    } catch (error) {
      await this.storage.remove(key);
      throw error;
    }

    await this.activity.record({
      principal,
      action: 'document_upload',
      targetTable: 'documents',
      targetId: created.id,
      details: { name: created.name, type: created.type, project_id: project.id },
    });
    return this.findOne(principal, created.id);
  }

  async update(principal: AuthPrincipal, id: string, dto: UpdateDocumentDto): Promise<DocumentView> {
    const document = await this.require(principal, id);

    const patch: Partial<DocumentRecord> = {};
    if (dto.name !== undefined) patch.name = dto.name.trim();
    if (dto.type !== undefined) patch.type = dto.type;
    if (dto.project_id !== undefined) {
      const project = await this.access.requireProject(principal, dto.project_id);
      if (project.client_id !== document.client_id) {
        throw new BadRequestException('A document can only move to another project of the same client');
      }
      patch.project_id = project.id;
    }

    await this.db.documents.update(id, patch);
    await this.activity.record({
      principal,
      action: 'document_update',
      targetTable: 'documents',
      targetId: id,
      details: { fields: Object.keys(patch), name: document.name },
    });
    return this.findOne(principal, id);
  }

  /** "Send to client" and back. Admin only (controller). */
  async setVisibility(principal: AuthPrincipal, id: string, dto: DocumentVisibilityDto): Promise<DocumentView> {
    const document = await this.require(principal, id);
    await this.db.documents.update(id, { client_visible: dto.client_visible });
    if (document.client_visible !== dto.client_visible) {
      await this.activity.record({
        principal,
        action: 'document_visibility_change',
        targetTable: 'documents',
        targetId: id,
        details: { from: document.client_visible, to: dto.client_visible, name: document.name },
      });
      if (dto.client_visible) await this.tellClient(document);
    }
    return this.findOne(principal, id);
  }

  /** The client's bell (and devices), if they can now open it: its project must be shared too. */
  private async tellClient(document: DocumentRecord): Promise<void> {
    const project = document.project_id ? await this.db.projects.findById(document.project_id) : null;
    if (!project?.client_visible || project.client_id !== document.client_id) return;
    await this.notifications.notifyClient(document.client_id, {
      kind: 'document',
      title: `New file: ${document.name}`,
      body: project.name,
      link: '/documents',
    });
  }

  async remove(principal: AuthPrincipal, id: string): Promise<{ id: string; deleted: true }> {
    const document = await this.require(principal, id);
    await this.db.documents.delete(id);
    await this.storage.remove(document.storage_url);
    await this.activity.record({
      principal,
      action: 'document_delete',
      targetTable: 'documents',
      targetId: id,
      details: { name: document.name },
    });
    return { id, deleted: true };
  }

  /* ------------------------------------------------------------------ */

  /** The row, if this principal may reach it; 404 otherwise, for staff too. */
  private async require(principal: AuthPrincipal, id: string): Promise<DocumentRecord> {
    const document = await this.db.documents.findFirstWhere({ id, ...(await this.access.documentScope(principal)) });
    if (!document) throw new NotFoundException('Document not found');
    return document;
  }

  private async decorate(rows: DocumentRecord[]): Promise<DocumentView[]> {
    const [clients, projects] = await Promise.all([
      this.db.clients.findWhere({ id: { in: [...new Set(rows.map((row) => row.client_id))] } }),
      this.db.projects.findWhere({
        id: { in: [...new Set(rows.map((row) => row.project_id).filter((id): id is string => Boolean(id)))] },
      }),
    ]);
    const clientName = new Map(clients.map((c) => [c.id, c.name]));
    const projectName = new Map(projects.map((p) => [p.id, p.name]));
    return rows.map(({ storage_url: key, ...document }) => ({
      ...document,
      preview: previewOf(key),
      client_name: clientName.get(document.client_id) ?? 'Unknown client',
      project_name: document.project_id ? (projectName.get(document.project_id) ?? null) : null,
    }));
  }
}

/**
 * Every route names its roles. Editors never get in. Clients: the list and
 * the download, the two calls the portal makes.
 */
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get()
  @Roles('Admin', 'Designer', 'Installer', 'Client')
  list(@CurrentUser() principal: AuthPrincipal) {
    return this.documents.list(principal);
  }

  @Get(':id')
  @Roles('Admin', 'Designer', 'Installer')
  findOne(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string) {
    return this.documents.findOne(principal, id);
  }

  /** A fresh short-lived link per call; the response itself must not be cached either. */
  @Get(':id/download')
  @Roles('Admin', 'Designer', 'Installer', 'Client')
  @Header('Cache-Control', 'no-store')
  download(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string, @Query('inline') inline?: string) {
    return this.documents.downloadUrl(principal, id, inline === '1');
  }

  /** multipart/form-data: `file` plus the UploadDocumentDto fields. Clients upload from the chat. */
  @Post('upload')
  @Roles('Admin', 'Designer', 'Installer', 'Client')
  @Throttle({ default: { limit: 60, ttl: 15 * 60_000 } })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_DOCUMENT_BYTES, files: 1, fields: 10 } }))
  upload(
    @CurrentUser() principal: AuthPrincipal,
    @Body() dto: UploadDocumentDto,
    @UploadedFile() file: UploadedDocument | undefined,
  ) {
    return this.documents.upload(principal, dto, file);
  }

  @Put(':id')
  @Roles('Admin', 'Designer', 'Installer')
  update(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string, @Body() dto: UpdateDocumentDto) {
    return this.documents.update(principal, id, dto);
  }

  @Patch(':id/visibility')
  @Roles('Admin')
  setVisibility(
    @CurrentUser() principal: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: DocumentVisibilityDto,
  ) {
    return this.documents.setVisibility(principal, id, dto);
  }

  @Delete(':id')
  @Roles('Admin', 'Designer', 'Installer')
  remove(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string) {
    return this.documents.remove(principal, id);
  }
}

@Module({
  imports: [NotificationsModule],
  controllers: [DocumentsController],
  providers: [DocumentsService],
})
export class DocumentsModule {}
