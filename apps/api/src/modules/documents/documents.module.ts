import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

import { AccessService } from '../../common/access/access.service';
import { CurrentUser, Roles } from '../../common/decorators';
import { DOCUMENT_TYPES, DocumentRecord, DocumentType } from '../../common/types/domain';
import { AuthPrincipal } from '../../common/types/principal';
import { ActivityLogService } from '../../core/activity-log.service';
import { DatabaseService } from '../../data/database.service';

/**
 * POST /documents/upload — METADATA ONLY.
 *
 * There is no object storage in this phase (prompt section 9), so no bytes are
 * transferred and `storage_url` is a descriptive placeholder rather than an S3
 * key. When MinIO/S3 lands, this endpoint gains a real multipart body and the
 * API issues a signed URL; the record shape does not change.
 */
export class UploadDocumentDto {
  @IsString() client_id!: string;
  @IsOptional() @IsString() project_id?: string | null;

  @IsString() @MinLength(1, { message: 'A file name is required' }) @MaxLength(160)
  name!: string;

  @IsIn(DOCUMENT_TYPES, { message: `Type must be one of: ${DOCUMENT_TYPES.join(', ')}` })
  type!: DocumentType;

  @Type(() => Number)
  @IsInt({ message: 'File size must be a whole number of bytes' })
  @Min(0)
  size_bytes!: number;

  /** Defaults to visible — most documents are for the client by definition. */
  @IsOptional() @IsBoolean() client_visible?: boolean;
}

export class UpdateDocumentDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(160) name?: string;
  @IsOptional() @IsIn(DOCUMENT_TYPES) type?: DocumentType;
  @IsOptional() @IsBoolean() client_visible?: boolean;
  @IsOptional() @IsString() project_id?: string | null;
}

export interface DocumentView extends DocumentRecord {
  client_name: string;
  project_name: string | null;
  /**
   * Where a real download would come from. In this phase it resolves to the
   * placeholder locator; the portal's Download button surfaces that this is a
   * prototype rather than silently failing.
   */
  download_url: string;
}

@Injectable()
export class DocumentsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly access: AccessService,
    private readonly activity: ActivityLogService,
  ) {}

  async list(principal: AuthPrincipal): Promise<DocumentView[]> {
    const all = await this.db.documents.findAll();
    const scoped = await this.access.scopeToVisibleClients(principal, all, (row) => row.client_id);

    // The client_visible flag is the admin's control over what reaches the
    // portal. Staff see everything within their scope; a client sees only what
    // has been shared.
    const visible =
      principal.kind === 'Client' ? scoped.filter((document) => document.client_visible) : scoped;

    const [clients, projects] = await Promise.all([
      this.db.clients.findAll(),
      this.db.projects.findAll(),
    ]);
    const clientName = new Map(clients.map((c) => [c.id, c.name]));
    const projectName = new Map(projects.map((p) => [p.id, p.name]));

    return visible
      .sort((a, b) => b.upload_date.localeCompare(a.upload_date))
      .map((document) => ({
        ...document,
        client_name: clientName.get(document.client_id) ?? 'Unknown client',
        project_name: document.project_id ? (projectName.get(document.project_id) ?? null) : null,
        download_url: document.storage_url,
      }));
  }

  async findOne(principal: AuthPrincipal, id: string): Promise<DocumentView> {
    const all = await this.list(principal);
    const found = all.find((document) => document.id === id);
    if (!found) throw new NotFoundException('Document not found');
    return found;
  }

  async upload(principal: AuthPrincipal, dto: UploadDocumentDto): Promise<DocumentView> {
    await this.access.assertClientAccess(principal, dto.client_id);
    const client = await this.db.clients.findById(dto.client_id);
    if (!client) throw new BadRequestException('Client does not exist');

    if (dto.project_id) {
      const project = await this.db.projects.findById(dto.project_id);
      if (!project) throw new BadRequestException('Project does not exist');
      if (project.client_id !== dto.client_id) {
        throw new BadRequestException('That project belongs to a different client');
      }
    }

    // A stable, descriptive locator standing in for a real S3 key.
    const slug = dto.name.toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/^-|-$/g, '');
    const created = await this.db.documents.create({
      client_id: dto.client_id,
      project_id: dto.project_id ?? null,
      name: dto.name.trim(),
      type: dto.type,
      size_bytes: dto.size_bytes,
      upload_date: new Date().toISOString(),
      client_visible: dto.client_visible ?? true,
      storage_url: `placeholder://documents/${dto.client_id}/${slug}`,
    });

    await this.activity.record({
      principal,
      action: 'document_upload',
      targetTable: 'documents',
      targetId: created.id,
      details: { name: created.name, type: created.type, client_visible: created.client_visible },
    });
    return this.findOne(principal, created.id);
  }

  async update(principal: AuthPrincipal, id: string, dto: UpdateDocumentDto): Promise<DocumentView> {
    const document = await this.db.documents.findById(id);
    if (!document) throw new NotFoundException('Document not found');
    await this.access.assertClientAccess(principal, document.client_id);

    const patch: Partial<DocumentRecord> = {};
    if (dto.name !== undefined) patch.name = dto.name.trim();
    if (dto.type !== undefined) patch.type = dto.type;
    if (dto.client_visible !== undefined) patch.client_visible = dto.client_visible;
    if (dto.project_id !== undefined) patch.project_id = dto.project_id;

    await this.db.documents.update(id, patch);
    await this.activity.record({
      principal,
      action: 'document_update',
      targetTable: 'documents',
      targetId: id,
      details: { fields: Object.keys(dto), name: document.name },
    });
    return this.findOne(principal, id);
  }

  async remove(principal: AuthPrincipal, id: string): Promise<{ id: string; deleted: true }> {
    const document = await this.db.documents.findById(id);
    if (!document) throw new NotFoundException('Document not found');
    await this.access.assertClientAccess(principal, document.client_id);

    await this.db.documents.delete(id);
    await this.activity.record({
      principal,
      action: 'document_delete',
      targetTable: 'documents',
      targetId: id,
      details: { name: document.name },
    });
    return { id, deleted: true };
  }
}

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get()
  list(@CurrentUser() principal: AuthPrincipal) {
    return this.documents.list(principal);
  }

  @Get(':id')
  findOne(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string) {
    return this.documents.findOne(principal, id);
  }

  /** Metadata-only upload — see UploadDocumentDto. */
  @Post('upload')
  @Roles('Admin', 'Designer', 'Installer')
  upload(@CurrentUser() principal: AuthPrincipal, @Body() dto: UploadDocumentDto) {
    return this.documents.upload(principal, dto);
  }

  @Put(':id')
  @Roles('Admin', 'Designer', 'Installer')
  update(
    @CurrentUser() principal: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: UpdateDocumentDto,
  ) {
    return this.documents.update(principal, id, dto);
  }

  @Delete(':id')
  @Roles('Admin', 'Designer')
  remove(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string) {
    return this.documents.remove(principal, id);
  }
}

@Module({
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
