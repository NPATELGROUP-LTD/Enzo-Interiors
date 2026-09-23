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
  Query,
} from '@nestjs/common';
import { IsInt, IsObject, IsOptional, IsString, Matches } from 'class-validator';

import { CurrentUser, Public, Roles } from '../../common/decorators';
import { CMS_COLLECTIONS, CmsCollection, CmsEntry } from '../../common/types/domain';
import { AuthPrincipal } from '../../common/types/principal';
import { ActivityLogService } from '../../core/activity-log.service';
import { RevalidateService } from '../../core/revalidate.service';
import { DatabaseService } from '../../data/database.service';
import { MediaModule, MediaService } from '../media/media.module';
import { SiteSettingsModule, SiteSettingsService } from '../site-settings/site-settings.module';
import { CMS_SCHEMAS, CollectionSchema, schemaFor } from './schemas';

/* -------------------------------------------------------------------------- */
/* DTOs                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * The body of a content entry is free-form JSON by design (see schemas.ts), so
 * it is validated as "an object" here and checked structurally in the service.
 * `forbidNonWhitelisted` on the global pipe still applies to the envelope, so
 * nothing can smuggle a `published` or a `published_at` past the DTO.
 */
export class SaveEntryDto {
  @IsObject()
  draft!: Record<string, unknown>;
}

export class CreateEntryDto {
  @IsString()
  // A slug is a route fragment and an object key. Anything outside this set
  // would either break a URL or need escaping somewhere downstream.
  @Matches(/^[a-z0-9][a-z0-9-]{0,62}$/, {
    message: 'Use lowercase letters, numbers and hyphens, starting with a letter or number.',
  })
  slug!: string;

  @IsObject()
  draft!: Record<string, unknown>;

  @IsOptional()
  @IsInt()
  sort_order?: number;
}

/** Link-valued keys: anything named *href / *url, plus the nav's paths. */
const LINK_KEY = /(href|url)$/i;
const LINK_LIST_KEYS = new Set(['pageLinks', 'path']);
/** Where a link on the public site may point. No javascript:, no data:, no //host. */
const SAFE_LINK = /^(https:\/\/|mailto:|tel:|\/(?!\/)|#)/i;
const MAP_EMBED = 'https://www.google.com/maps/embed';

/**
 * Every link in a body must be safe to render as an href or iframe src.
 * Walks the whole tree, so a link nested in a list of cards is checked too.
 */
function assertSafeLinks(value: unknown, key = ''): void {
  if (Array.isArray(value)) {
    for (const item of value) assertSafeLinks(item, key);
    return;
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) assertSafeLinks(v, k);
    return;
  }
  if (typeof value !== 'string' || value === '') return;
  if (key === 'embedUrl') {
    if (!value.startsWith(MAP_EMBED)) {
      throw new BadRequestException(`The map must be a Google Maps embed link (${MAP_EMBED}...).`);
    }
    return;
  }
  if ((LINK_KEY.test(key) || LINK_LIST_KEYS.has(key)) && !SAFE_LINK.test(value)) {
    throw new BadRequestException(
      `"${value.slice(0, 80)}" is not a link the site can use. Start it with https://, /, mailto: or tel:.`,
    );
  }
}

/** A search hit, for the admin's command palette. */
export interface CmsSearchHit {
  collection: CmsCollection;
  slug: string;
  title: string;
  /** The top-level key the match sits under, e.g. a page section. */
  section: string | null;
  snippet: string;
}

/** The text either side of a match, flattened to one line. */
function snippetAround(text: string, index: number, length: number): string {
  const start = Math.max(0, index - 40);
  const end = Math.min(text.length, index + length + 60);
  return (start > 0 ? '…' : '') + text.slice(start, end).replace(/\s+/g, ' ').trim() + (end < text.length ? '…' : '');
}

/** The first string under `value` containing `needle`, or null. */
function findText(value: unknown, needle: string): { text: string; index: number } | null {
  if (typeof value === 'string') {
    const index = value.toLowerCase().indexOf(needle);
    return index === -1 ? null : { text: value, index };
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const hit = findText(item, needle);
      if (hit) return hit;
    }
    return null;
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) {
      const hit = findText(item, needle);
      if (hit) return hit;
    }
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/* Service                                                                    */
/* -------------------------------------------------------------------------- */

/** A row as the admin list needs it — without the bodies, which are large. */
export interface CmsEntrySummary {
  id: string;
  collection: CmsCollection;
  slug: string;
  sort_order: number;
  title: string;
  /** Extra columns named by the collection's schema, already stringified. */
  columns: Record<string, string>;
  /** The first picture on the entry, as a media id, for the list's thumbnail. */
  image: string | null;
  published_at: string | null;
  updated_at: string;
  updated_by: string | null;
  /** Never published at all. */
  isNew: boolean;
  /** Saved since the last publish. Drives the "unpublished changes" badge. */
  isDirty: boolean;
}

function isDirty(entry: CmsEntry): boolean {
  if (entry.published === null) return true;
  // Stable-enough comparison: both sides came out of the same JSONB column, so
  // key order is consistent. A false positive would only ever cost one
  // unnecessary publish, which is harmless.
  return JSON.stringify(entry.draft) !== JSON.stringify(entry.published);
}

/** Best-effort readable value for a list column. */
function columnText(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return `${value.length}`;
  if (typeof value === 'object') return '';
  return String(value);
}

/** The first media id in the keys the schema marks as pictures. */
function firstImage(body: Record<string, unknown>, schema: CollectionSchema): string | null {
  for (const key of [...schema.mediaKeys, ...schema.mediaListKeys]) {
    const value = body[key];
    const id = Array.isArray(value) ? value[0] : value;
    if (typeof id === 'string' && id) return id;
  }
  return null;
}

@Injectable()
export class CmsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly activity: ActivityLogService,
    private readonly revalidate: RevalidateService,
    private readonly media: MediaService,
    private readonly siteSettings: SiteSettingsService,
  ) {}

  private assertCollection(collection: string): CmsCollection {
    const schema = schemaFor(collection);
    if (!schema) throw new NotFoundException(`No content collection called "${collection}"`);
    return schema.collection;
  }

  private async require(collection: string, slug: string): Promise<CmsEntry> {
    const key = this.assertCollection(collection);
    const entry = await this.db.cmsEntries.findOne(
      (row) => row.collection === key && row.slug === slug,
    );
    if (!entry) throw new NotFoundException(`No ${collection} entry called "${slug}"`);
    return entry;
  }

  /* ---- Reads ---- */

  async list(collection: string): Promise<CmsEntrySummary[]> {
    const key = this.assertCollection(collection);
    const schema = schemaFor(key)!;
    const rows = await this.db.cmsEntries.findAll((row) => row.collection === key);

    return rows
      .sort((a, b) => a.sort_order - b.sort_order || a.slug.localeCompare(b.slug))
      .map((entry) => ({
        id: entry.id,
        collection: entry.collection,
        slug: entry.slug,
        sort_order: entry.sort_order,
        title: columnText(entry.draft, schema.titleField) || entry.slug,
        columns: Object.fromEntries(
          schema.listColumns.map((column) => [column, columnText(entry.draft, column)]),
        ),
        image: firstImage(entry.draft, schema),
        published_at: entry.published_at,
        updated_at: entry.updated_at,
        updated_by: entry.updated_by,
        isNew: entry.published === null,
        isDirty: isDirty(entry),
      }));
  }

  async get(collection: string, slug: string): Promise<CmsEntry & { isDirty: boolean }> {
    const entry = await this.require(collection, slug);
    return { ...entry, isDirty: isDirty(entry) };
  }

  /** Everything the admin needs to open the CMS: schemas plus per-collection counts. */
  async overview(): Promise<{
    schemas: typeof CMS_SCHEMAS;
    counts: Record<string, { total: number; dirty: number }>;
  }> {
    const rows = await this.db.cmsEntries.findAll();
    const counts: Record<string, { total: number; dirty: number }> = {};
    for (const collection of CMS_COLLECTIONS) {
      const mine = rows.filter((row) => row.collection === collection);
      counts[collection] = {
        total: mine.length,
        dirty: mine.filter(isDirty).length,
      };
    }
    return { schemas: CMS_SCHEMAS, counts };
  }

  /* ---- Writes ---- */

  async create(
    principal: AuthPrincipal,
    collection: string,
    dto: CreateEntryDto,
  ): Promise<CmsEntry> {
    const key = this.assertCollection(collection);
    const schema = schemaFor(key)!;
    if (schema.fixed) {
      throw new BadRequestException(
        `${schema.label} has a fixed set of entries, because apps/web refers to them by name. Edit an existing one instead.`,
      );
    }

    const clash = await this.db.cmsEntries.findOne(
      (row) => row.collection === key && row.slug === dto.slug,
    );
    if (clash) throw new BadRequestException(`A ${schema.singular} called "${dto.slug}" already exists.`);

    assertSafeLinks(dto.draft);
    const existing = await this.db.cmsEntries.findAll((row) => row.collection === key);
    const created = await this.db.cmsEntries.create({
      collection: key,
      slug: dto.slug,
      sort_order: dto.sort_order ?? existing.length,
      // `id` is carried inside the body too, because apps/web joins rows by it.
      draft: { ...dto.draft, id: dto.slug },
      published: null,
      published_at: null,
      updated_at: new Date().toISOString(),
      updated_by: principal.name,
    });

    await this.activity.record({
      principal,
      action: 'cms_create',
      targetTable: 'cms_entries',
      targetId: created.id,
      details: { collection: key, slug: dto.slug },
    });
    return created;
  }

  async save(
    principal: AuthPrincipal,
    collection: string,
    slug: string,
    dto: SaveEntryDto,
  ): Promise<CmsEntry> {
    const entry = await this.require(collection, slug);
    const schema = schemaFor(entry.collection)!;

    // Readonly keys are enforced here rather than trusted from the client: the
    // id doubles as a route slug and as the join key other collections point
    // at, so a renamed id would silently orphan every reference to it.
    assertSafeLinks(dto.draft);
    const draft = { ...dto.draft };
    for (const key of schema.readonlyKeys) {
      if (key in entry.draft) draft[key] = entry.draft[key];
    }

    const updated = await this.db.cmsEntries.update(entry.id, {
      draft,
      updated_at: new Date().toISOString(),
      updated_by: principal.name,
    });
    if (!updated) throw new NotFoundException('Entry disappeared while saving.');

    await this.activity.record({
      principal,
      action: 'cms_save_draft',
      targetTable: 'cms_entries',
      targetId: entry.id,
      details: { collection: entry.collection, slug },
    });
    return updated;
  }

  async publish(principal: AuthPrincipal, collection: string, slug: string): Promise<CmsEntry> {
    const entry = await this.require(collection, slug);
    const now = new Date().toISOString();
    const updated = await this.db.cmsEntries.update(entry.id, {
      published: entry.draft,
      published_at: now,
      updated_at: now,
      updated_by: principal.name,
    });
    if (!updated) throw new NotFoundException('Entry disappeared while publishing.');

    await this.activity.record({
      principal,
      action: 'cms_publish',
      targetTable: 'cms_entries',
      targetId: entry.id,
      details: { collection: entry.collection, slug },
    });
    await this.revalidate.ping(`${entry.collection}/${slug}`);
    return updated;
  }

  /** Publishes every entry with unpublished changes. The "push it all live" button. */
  async publishAll(principal: AuthPrincipal): Promise<{ published: number }> {
    const rows = (await this.db.cmsEntries.findAll()).filter(isDirty);
    const now = new Date().toISOString();
    for (const entry of rows) {
      await this.db.cmsEntries.update(entry.id, {
        published: entry.draft,
        published_at: now,
        updated_at: now,
        updated_by: principal.name,
      });
    }
    if (rows.length > 0) {
      await this.activity.record({
        principal,
        action: 'cms_publish_all',
        targetTable: 'cms_entries',
        targetId: 'all',
        details: { count: rows.length },
      });
      await this.revalidate.ping(`${rows.length} entries`);
    }
    return { published: rows.length };
  }

  /** Throws away unpublished edits and restores what the site is showing. */
  async revert(principal: AuthPrincipal, collection: string, slug: string): Promise<CmsEntry> {
    const entry = await this.require(collection, slug);
    if (entry.published === null) {
      throw new BadRequestException(
        'This entry has never been published, so there is nothing to go back to. Delete it instead.',
      );
    }
    const updated = await this.db.cmsEntries.update(entry.id, {
      draft: entry.published,
      updated_at: new Date().toISOString(),
      updated_by: principal.name,
    });
    if (!updated) throw new NotFoundException('Entry disappeared while reverting.');

    await this.activity.record({
      principal,
      action: 'cms_revert',
      targetTable: 'cms_entries',
      targetId: entry.id,
      details: { collection: entry.collection, slug },
    });
    return updated;
  }

  async remove(principal: AuthPrincipal, collection: string, slug: string): Promise<void> {
    const entry = await this.require(collection, slug);
    const schema = schemaFor(entry.collection)!;
    if (schema.fixed) {
      throw new BadRequestException(
        `${schema.label} entries cannot be deleted, because apps/web refers to them by name.`,
      );
    }

    // Refuse to orphan a reference rather than let the site render a blank.
    const referencedBy = await this.referencesTo(entry.collection, entry.slug);
    if (referencedBy.length > 0) {
      throw new BadRequestException(
        `Still in use by ${referencedBy.join(', ')}. Point those at something else first.`,
      );
    }

    await this.db.cmsEntries.delete(entry.id);
    await this.activity.record({
      principal,
      action: 'cms_delete',
      targetTable: 'cms_entries',
      targetId: entry.id,
      details: { collection: entry.collection, slug },
    });
    await this.revalidate.ping(`deleted ${entry.collection}/${slug}`);
  }

  /** Human-readable list of entries pointing at this one. */
  private async referencesTo(collection: CmsCollection, slug: string): Promise<string[]> {
    const holders: string[] = [];
    for (const schema of CMS_SCHEMAS) {
      const keys = Object.entries(schema.references)
        .filter(([, target]) => target === collection)
        .map(([key]) => key);
      if (keys.length === 0) continue;

      const rows = await this.db.cmsEntries.findAll((row) => row.collection === schema.collection);
      for (const row of rows) {
        if (keys.some((key) => row.draft[key] === slug)) {
          holders.push(`${schema.singular} "${columnText(row.draft, schema.titleField) || row.slug}"`);
        }
      }
    }
    return holders;
  }

  /**
   * Drafts and media matching `q`, for the admin's search palette.
   *
   * ponytail: an in-memory scan of every draft. Fine for the ~50 entries a
   * site this size has; move to Postgres full-text search past a few thousand.
   */
  async search(q: string): Promise<{ entries: CmsSearchHit[]; media: Array<{ id: string; alt: string }> }> {
    const needle = q.trim().toLowerCase();
    if (needle.length < 2 || needle.length > 100) {
      throw new BadRequestException('Search for 2 to 100 characters.');
    }

    const entries: CmsSearchHit[] = [];
    for (const row of await this.db.cmsEntries.findAll()) {
      const schema = schemaFor(row.collection);
      if (!schema) continue;
      const title = columnText(row.draft, schema.titleField) || row.slug;
      if (title.toLowerCase().includes(needle)) {
        entries.push({ collection: row.collection, slug: row.slug, title, section: null, snippet: title });
        continue;
      }
      for (const [section, value] of Object.entries(row.draft)) {
        const hit = findText(value, needle);
        if (!hit) continue;
        entries.push({
          collection: row.collection,
          slug: row.slug,
          title,
          section: row.collection === 'pages' ? section : null,
          snippet: snippetAround(hit.text, hit.index, needle.length),
        });
        break;
      }
      if (entries.length >= 30) break;
    }

    const media = (await this.db.mediaAssets.findAll())
      .filter((row) => [row.id, row.alt, row.title ?? ''].some((v) => v.toLowerCase().includes(needle)))
      .slice(0, 10)
      .map((row) => ({ id: row.id, alt: row.alt }));

    return { entries, media };
  }

  /* ---- The public bundle ---- */

  /**
   * Everything apps/web renders, in one response.
   *
   * Shaped as the same normalised tables the site already consumes — a service
   * still points at a media id, a project still points at a service — so the
   * content layer in apps/web keeps its joins exactly as written and only its
   * source changes. One call rather than nine because the site fetches this
   * once per revalidation, not once per visitor, and nine round trips to build
   * one page would be nine chances to half-fail.
   *
   * Only published bodies appear. An entry that has never been published is
   * left out entirely rather than shown half-written.
   */
  async publishedBundle(): Promise<Record<string, unknown>> {
    const rows = (await this.db.cmsEntries.findAll()).filter((row) => row.published !== null);
    const sorted = rows.sort((a, b) => a.sort_order - b.sort_order);
    const of = (collection: CmsCollection) =>
      sorted.filter((row) => row.collection === collection).map((row) => row.published!);

    const pages: Record<string, unknown> = {};
    for (const row of sorted.filter((row) => row.collection === 'pages')) {
      pages[row.slug] = row.published;
    }

    return {
      company: of('company')[0] ?? null,
      media: await this.media.publicList(),
      services: of('services'),
      portfolio: of('portfolio'),
      testimonials: of('testimonials'),
      team: of('team'),
      faqs: of('faqs'),
      navigation: of('navigation'),
      pages,
      site: await this.siteSettings.publicStatus(),
      generatedAt: new Date().toISOString(),
    };
  }
}

/* -------------------------------------------------------------------------- */
/* Controllers                                                                */
/* -------------------------------------------------------------------------- */

/**
 * The CMS.
 *
 * Designers may write copy; only an Admin may publish it, add an entry or
 * delete one. Installers have no business here at all. Enforced by the guards,
 * never by a check inside a handler.
 */
@Controller('cms')
@Roles('Admin', 'Designer')
export class CmsController {
  constructor(private readonly cms: CmsService) {}

  @Get('overview')
  overview() {
    return this.cms.overview();
  }

  @Get('search')
  search(@Query('q') q = '') {
    return this.cms.search(q);
  }

  @Get('collections/:collection')
  list(@Param('collection') collection: string) {
    return this.cms.list(collection);
  }

  @Get('collections/:collection/:slug')
  get(@Param('collection') collection: string, @Param('slug') slug: string) {
    return this.cms.get(collection, slug);
  }

  @Post('collections/:collection')
  @Roles('Admin')
  create(
    @CurrentUser() principal: AuthPrincipal,
    @Param('collection') collection: string,
    @Body() dto: CreateEntryDto,
  ) {
    return this.cms.create(principal, collection, dto);
  }

  @Put('collections/:collection/:slug')
  save(
    @CurrentUser() principal: AuthPrincipal,
    @Param('collection') collection: string,
    @Param('slug') slug: string,
    @Body() dto: SaveEntryDto,
  ) {
    return this.cms.save(principal, collection, slug, dto);
  }

  @Post('collections/:collection/:slug/publish')
  @Roles('Admin')
  publish(
    @CurrentUser() principal: AuthPrincipal,
    @Param('collection') collection: string,
    @Param('slug') slug: string,
  ) {
    return this.cms.publish(principal, collection, slug);
  }

  @Post('collections/:collection/:slug/revert')
  revert(
    @CurrentUser() principal: AuthPrincipal,
    @Param('collection') collection: string,
    @Param('slug') slug: string,
  ) {
    return this.cms.revert(principal, collection, slug);
  }

  @Post('publish')
  @Roles('Admin')
  publishAll(@CurrentUser() principal: AuthPrincipal) {
    return this.cms.publishAll(principal);
  }

  @Delete('collections/:collection/:slug')
  @Roles('Admin')
  async remove(
    @CurrentUser() principal: AuthPrincipal,
    @Param('collection') collection: string,
    @Param('slug') slug: string,
  ) {
    await this.cms.remove(principal, collection, slug);
    return { deleted: true };
  }
}

/** What apps/web reads. The only unauthenticated route in this module. */
@Controller('content')
export class PublicSiteController {
  constructor(private readonly cms: CmsService) {}

  @Public()
  @Get('site')
  site() {
    return this.cms.publishedBundle();
  }
}

@Module({
  imports: [MediaModule, SiteSettingsModule],
  controllers: [CmsController, PublicSiteController],
  providers: [CmsService],
  exports: [CmsService],
})
export class CmsModule {}
