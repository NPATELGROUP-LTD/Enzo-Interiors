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
 * It is idempotent by default: an entry that already exists is left alone, so
 * running this after the client has started editing cannot overwrite their
 * work. --force is the deliberate escape hatch for a rebuild, and says so.
 *
 * Once this has run, apps/web/src/data is no longer the source of truth. It is
 * kept in the repo as the seed for a fresh environment and as the fallback the
 * site renders if the API is unreachable at build time.
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';

import { CmsCollection } from '../src/common/types/domain';
import { DatabaseService } from '../src/data/database.service';
import { PrismaService } from '../src/data/prisma.service';

/** apps/web/src/data, resolved from this file rather than from cwd. */
const DATA_DIR = path.resolve(__dirname, '..', '..', 'web', 'src', 'data');

const FORCE = process.argv.includes('--force');

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
  // These shipped inside apps/web/public and were never uploaded anywhere, so
  // they keep their static `src` and have no storage key. Anything the client
  // uploads later gets a key instead; MediaService resolves both the same way.
  const mediaRows = await readJson<
    Array<{ id: string; src: string; alt: string; title?: string; source: string }>
  >('media.json');

  let mediaAdded = 0;
  for (const row of mediaRows) {
    if (await db.mediaAssets.findById(row.id)) continue;
    const now = new Date().toISOString();
    await db.mediaAssets.create({
      id: row.id,
      storage_key: null,
      src: row.src,
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

  for (const { collection, rows } of collections) {
    let added = 0;
    let skipped = 0;

    for (const [index, row] of rows.entries()) {
      const existing = await db.cmsEntries.findOne(
        (entry) => entry.collection === collection && entry.slug === row.slug,
      );
      if (existing) {
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
        updated_by: 'content import',
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

  const kept = summary.reduce((total, [, , skipped]) => total + skipped, 0);
  if (kept > 0 && !FORCE) {
    console.log(
      `\n${kept} entries already existed and were left untouched. Re-run with --force to replace them.`,
    );
  }

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error('\nContent import failed:\n', error);
  process.exit(1);
});
