/**
 * Enzo Interiors — import the public site's content into the CMS.
 *
 *     npm run cms:import            # import anything missing, leave edits alone
 *     npm run cms:import -- --force # wipe the CMS and re-import from the JSON
 *
 * apps/web/src/data holds the content the site was built with: nine normalised
 * tables and ten page-copy documents, all of it already authored and proofread.
 * Starting the client off with empty forms and asking them to retype it would
 * be absurd, so this lifts that content into cms_entries as-is and publishes
 * it, which means the site keeps rendering exactly what it rendered before and
 * the CMS opens onto real copy from the first login.
 *
 * It is idempotent by default and runs on every deploy (the compose `seed`
 * service). An entry nobody has touched in the admin is brought up to date
 * with the shipped copy; one a person has saved, published or reverted is
 * theirs and only ever gains missing keys (pages and company). --force is the
 * deliberate escape hatch for a rebuild, and says so.
 *
 * Once this has run, apps/web/src/data is no longer the source of truth. It is
 * kept in the repo as the seed for a fresh environment and as the fallback the
 * site renders if the API is unreachable at build time.
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { isDeepStrictEqual } from 'node:util';

import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

import { CmsCollection, CmsEntry } from '../src/common/types/domain';
import { DatabaseService } from '../src/data/database.service';
import { PrismaService } from '../src/data/prisma.service';

/** apps/web/src/data, resolved from this file rather than from cwd. */
const DATA_DIR = path.resolve(__dirname, '..', '..', 'web', 'src', 'data');

/** The site's own images: shipped photos, logos, hero frames, placeholders. */
const SEED_MEDIA_DIR = path.resolve(__dirname, '..', 'seed-media');

const FORCE = process.argv.includes('--force');

/** `updated_by` on what this script writes. Every admin write stamps a person's name instead. */
const IMPORTER = 'content import';

const CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

/** Every file under seed-media, as paths relative to it with forward slashes. */
async function seedFiles(dir = SEED_MEDIA_DIR): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await seedFiles(full)));
    else out.push(path.relative(SEED_MEDIA_DIR, full).split(path.sep).join('/'));
  }
  return out;
}

/**
 * Puts every seed-media file into the public bucket under site/, skipping
 * objects that are already there, so a re-run uploads nothing. Keys are
 * immutable (a replaced image gets a new key through the CMS), which is what
 * makes the year-long cache header safe.
 */
async function uploadSeedMedia(): Promise<{ uploaded: number; present: number }> {
  const endpoint = process.env.S3_ENDPOINT;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error('S3_ENDPOINT, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY must be set to seed images.');
  }
  const bucket = process.env.S3_PUBLIC_BUCKET ?? 'enzo-public';
  const s3 = new S3Client({
    endpoint,
    region: process.env.S3_REGION ?? 'us-east-1',
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });

  const files = await seedFiles();
  let uploaded = 0;
  // A few at a time: 460 files one by one is slow, all at once floods MinIO.
  for (let i = 0; i < files.length; i += 16) {
    await Promise.all(
      files.slice(i, i + 16).map(async (file) => {
        const Key = `site/${file}`;
        const exists = await s3
          .send(new HeadObjectCommand({ Bucket: bucket, Key }))
          .then(() => true)
          .catch(() => false);
        if (exists) return;
        await s3.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key,
            Body: await fs.readFile(path.join(SEED_MEDIA_DIR, file)),
            ContentType: CONTENT_TYPES[path.extname(file)] ?? 'application/octet-stream',
            CacheControl: 'public, max-age=31536000, immutable',
          }),
        );
        uploaded += 1;
      }),
    );
  }
  return { uploaded, present: files.length - uploaded };
}

async function readJson<T>(...segments: string[]): Promise<T> {
  const file = path.join(DATA_DIR, ...segments);
  return JSON.parse(await fs.readFile(file, 'utf-8')) as T;
}

/** "What we make" -> "what-we-make". For the rows that carry no id of their own. */
function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'item'
  );
}

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Copies keys `source` has and `target` lacks, recursing into objects but
 * never into arrays. Returns a new object, or null if nothing was missing.
 *
 * This is how a new field or section in src/data reaches a database that was
 * imported before it existed. It only ever adds: a key the client has, even
 * one set to "", is theirs and is left alone.
 */
export function addMissing(target: Json, source: Json): Json | null {
  let changed = false;
  const out: Json = { ...target };
  for (const [key, value] of Object.entries(source)) {
    if (!(key in target)) {
      out[key] = value;
      changed = true;
    } else if (isObject(target[key]) && isObject(value)) {
      const nested = addMissing(target[key] as Json, value);
      if (nested) {
        out[key] = nested;
        changed = true;
      }
    }
  }
  return changed ? out : null;
}

/**
 * Imported and never touched since. Every admin write to an entry (save,
 * publish, publish all, revert, create) sets updated_by to the person, and
 * this script never does, so `updated_by` still being the importer means no
 * person has changed it. The other two checks are belt and braces: unsaved
 * differences or a pending review both mean someone is mid-edit.
 * isDeepStrictEqual, not JSON.stringify: JSONB comes back with its keys
 * reordered.
 */
export function untouched(entry: Pick<CmsEntry, 'updated_by' | 'draft' | 'published' | 'review_at'>): boolean {
  return entry.updated_by === IMPORTER && entry.review_at === null && isDeepStrictEqual(entry.draft, entry.published);
}

/** "collection/slug" for each `cms_delete` log. One missing either is skipped, not keyed "undefined/…". */
export function deletedKeys(logs: Array<{ details: Record<string, unknown> | null }>): Set<string> {
  const keys = new Set<string>();
  for (const { details } of logs) {
    const { collection, slug } = (details ?? {}) as { collection?: string; slug?: string };
    if (collection && slug) keys.add(`${collection}/${slug}`);
  }
  return keys;
}

interface Row {
  slug: string;
  body: Record<string, unknown>;
}

/** An array of rows that already carry an `id`. */
function byId(rows: Array<Record<string, unknown>>): Row[] {
  return rows.map((body, index) => ({
    slug: typeof body.id === 'string' ? body.id : `item-${index + 1}`,
    body,
  }));
}

async function main(): Promise<void> {
  const prisma = new PrismaService();
  const db = new DatabaseService(prisma);
  await prisma.$connect();

  if (FORCE) {
    console.log('--force: clearing cms_entries and media_assets first.\n');
    await db.cmsEntries.deleteMany(() => true);
    await db.mediaAssets.deleteMany(() => true);
  }

  /* ---- Media ------------------------------------------------------------ */
  const files = await uploadSeedMedia();
  console.log(`Seed images: ${files.uploaded} uploaded, ${files.present} already in the bucket.
`);

  const mediaRows = await readJson<
    Array<{ id: string; key: string; alt: string; title?: string; source: string }>
  >('media.json');

  let mediaAdded = 0;
  let mediaMoved = 0;
  for (const row of mediaRows) {
    const existing = await db.mediaAssets.findById(row.id);
    // A shipped image re-pointed to a new file. Keys under site/ only ever come
    // from here (uploads live under media/, and the admin cannot change a
    // key); the words follow too unless someone has edited them.
    if (existing && existing.storage_key !== row.key && existing.storage_key.startsWith('site/')) {
      const words = existing.updated_at === existing.created_at ? { alt: row.alt, title: row.title ?? null, source: row.source } : {};
      await db.mediaAssets.update(row.id, { storage_key: row.key, ...words });
      mediaMoved += 1;
    }
    if (existing) continue;
    const now = new Date().toISOString();
    await db.mediaAssets.create({
      id: row.id,
      storage_key: row.key,
      alt: row.alt,
      title: row.title ?? null,
      source: row.source,
      width: null,
      height: null,
      byte_size: null,
      mime_type: null,
      created_at: now,
      updated_at: now,
    });
    mediaAdded += 1;
  }

  /* ---- Collections ------------------------------------------------------ */
  const company = await readJson<Record<string, unknown>>('company.json');
  const navigation = await readJson<Array<Record<string, unknown>>>('navigation.json');

  const collections: Array<{ collection: CmsCollection; rows: Row[] }> = [
    { collection: 'company', rows: [{ slug: 'company', body: company }] },
    { collection: 'services', rows: byId(await readJson('services.json')) },
    { collection: 'portfolio', rows: byId(await readJson('portfolio.json')) },
    { collection: 'testimonials', rows: byId(await readJson('testimonials.json')) },
    { collection: 'team', rows: byId(await readJson('team.json')) },
    { collection: 'faqs', rows: byId(await readJson('faqs.json')) },
    {
      collection: 'navigation',
      // Nav rows have no id in the JSON — their identity is their label, which
      // is also what a human looking at the menu would call them.
      rows: navigation.map((body) => ({
        slug: slugify(String(body.label ?? '')),
        body,
      })),
    },
  ];

  /* ---- Pages ------------------------------------------------------------ */
  const pageFiles = (await fs.readdir(path.join(DATA_DIR, 'pages')))
    .filter((name) => name.endsWith('.json'))
    .sort();

  collections.push({
    collection: 'pages',
    rows: await Promise.all(
      pageFiles.map(async (name) => ({
        slug: path.basename(name, '.json'),
        body: await readJson<Record<string, unknown>>('pages', name),
      })),
    ),
  });

  /* ---- Write ------------------------------------------------------------ */
  const now = new Date().toISOString();
  const summary: Array<[string, number, number]> = [];
  let backfilled = 0;
  let refreshed = 0;

  // Entries a person deleted in the CMS stay deleted: this runs on every
  // deploy, so without this they would be re-created from the shipped copy.
  const deleted = deletedKeys(await db.activityLogs.findWhere({ action: 'cms_delete' }));

  for (const { collection, rows } of collections) {
    let added = 0;
    let skipped = 0;

    for (const [index, row] of rows.entries()) {
      const existing = await db.cmsEntries.findOne(
        (entry) => entry.collection === collection && entry.slug === row.slug,
      );
      if (existing) {
        skipped += 1;
        // Never touched by a person: follow the shipped copy, so new photos and
        // copy reach production on deploy without anyone re-publishing.
        if (untouched(existing)) {
          if (!isDeepStrictEqual(existing.published, row.body)) {
            await db.cmsEntries.update(existing.id, { draft: row.body, published: row.body, published_at: now, updated_at: now });
            refreshed += 1;
          }
          continue;
        }
        // Pages and company are fixed documents, so new sections in the shipped
        // copy are added to them. Collections of rows are left as they are.
        if (collection === 'pages' || collection === 'company') {
          const draft = addMissing(existing.draft, row.body);
          const published = existing.published && addMissing(existing.published, row.body);
          if (draft || published) {
            await db.cmsEntries.update(existing.id, {
              ...(draft ? { draft } : {}),
              ...(published ? { published } : {}),
            });
            backfilled += 1;
          }
        }
        continue;
      }
      if (!FORCE && deleted.has(`${collection}/${row.slug}`)) {
        skipped += 1;
        continue;
      }
      await db.cmsEntries.create({
        collection,
        slug: row.slug,
        sort_order: index,
        draft: row.body,
        // Published straight away and identical to the draft: this content is
        // already live on the site today, so importing it must not take it
        // down or mark the whole CMS as having unpublished changes.
        published: row.body,
        published_at: now,
        updated_at: now,
        updated_by: IMPORTER,
        review_by: null,
        review_at: null,
        review_note: null,
      });
      added += 1;
    }
    summary.push([collection, added, skipped]);
  }

  console.log(`Imported from ${DATA_DIR}\n`);
  console.log(`  ${'collection'.padEnd(16)} ${'added'.padStart(6)} ${'kept'.padStart(6)}`);
  for (const [collection, added, skipped] of summary) {
    console.log(`  ${collection.padEnd(16)} ${String(added).padStart(6)} ${String(skipped).padStart(6)}`);
  }
  console.log(`  ${'media'.padEnd(16)} ${String(mediaAdded).padStart(6)} ${String(mediaRows.length - mediaAdded).padStart(6)}`);
  if (mediaMoved > 0) console.log(`\nPointed ${mediaMoved} shipped images at their new files.`);
  if (refreshed > 0) console.log(`\nUpdated ${refreshed} entries nobody had edited to the shipped copy.`);
  if (backfilled > 0) {
    console.log(`\nAdded new fields from src/data to ${backfilled} existing entries (nothing overwritten).`);
  }

  const kept = summary.reduce((total, [, , skipped]) => total + skipped, 0);
  if (kept > 0 && !FORCE) {
    console.log(
      `\n${kept} entries already existed; edited ones were kept. Re-run with --force to replace them all.`,
    );
  }

  await prisma.$disconnect();
}

// Only when run, not when a test imports the helpers above.
if (require.main === module) {
  main().catch(async (error) => {
    console.error('\nContent import failed:\n', error);
    process.exit(1);
  });
}
