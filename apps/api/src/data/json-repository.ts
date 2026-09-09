import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';

import { BaseRecord } from '../common/types/domain';

/**
 * A single JSON file on disk, presented with the method surface we would get
 * from a Prisma model delegate.
 *
 * The point of this class is that it is the ONLY thing that has to change when
 * the prototype swaps to real PostgreSQL: `findAll` / `findById` / `create` /
 * `update` / `delete` mirror the Prisma signatures, so services call the same
 * methods before and after the migration and none of them learn that the data
 * lives in a file. Nothing outside src/data/ may touch `fs`.
 *
 * Concurrency: Node is single-threaded per process, but `await` yields, so two
 * overlapping requests could interleave a read-modify-write and lose an edit.
 * Every mutation is therefore funnelled through `enqueue`, a per-file promise
 * chain that serialises writes, and the file is replaced atomically (write to
 * a temp file, then rename) so a crash mid-write cannot truncate the dataset.
 */
export class JsonRepository<T extends BaseRecord> {
  private readonly filePath: string;

  /**
   * Serialises mutations against this file. Each queued operation chains onto
   * the previous one, so a read-modify-write can never interleave with another.
   */
  private queue: Promise<unknown> = Promise.resolve();

  /**
   * In-memory copy of the file, kept so reads do not hit the disk on every
   * request. Writes always update this and the file together, and this process
   * is the only writer, so the two cannot drift. `null` means "not loaded yet".
   */
  private cache: T[] | null = null;

  constructor(
    dataDir: string,
    /** Table name, matching the schema doc. Also the filename stem. */
    public readonly table: string,
  ) {
    this.filePath = path.join(dataDir, `${table}.json`);
  }

  /* ---------------------------------------------------------------------- */
  /* Reads                                                                  */
  /* ---------------------------------------------------------------------- */

  /**
   * All rows, optionally filtered by an equality-style predicate.
   * Returns deep copies so a caller mutating a result cannot corrupt the cache.
   */
  async findAll(predicate?: (row: T) => boolean): Promise<T[]> {
    const rows = await this.load();
    const matched = predicate ? rows.filter(predicate) : rows;
    return matched.map((row) => structuredClone(row));
  }

  /** One row by primary key, or null. */
  async findById(id: string): Promise<T | null> {
    const rows = await this.load();
    const found = rows.find((row) => row.id === id);
    return found ? structuredClone(found) : null;
  }

  /** First row matching the predicate, or null. */
  async findOne(predicate: (row: T) => boolean): Promise<T | null> {
    const rows = await this.load();
    const found = rows.find(predicate);
    return found ? structuredClone(found) : null;
  }

  /** Row count, optionally filtered. */
  async count(predicate?: (row: T) => boolean): Promise<number> {
    const rows = await this.load();
    return predicate ? rows.filter(predicate).length : rows.length;
  }

  /* ---------------------------------------------------------------------- */
  /* Writes — every one of these persists to disk before resolving           */
  /* ---------------------------------------------------------------------- */

  /**
   * Insert a row. `id` is generated when the caller does not supply one, so
   * the seed can pin readable ids while the API generates opaque ones.
   */
  async create(data: Omit<T, 'id'> & { id?: string }): Promise<T> {
    return this.enqueue(async () => {
      const rows = await this.load();
      const row = { ...data, id: data.id ?? `${this.table}_${randomUUID()}` } as T;
      if (rows.some((existing) => existing.id === row.id)) {
        throw new Error(`Duplicate id "${row.id}" in ${this.table}`);
      }
      rows.push(row);
      await this.persist(rows);
      return structuredClone(row);
    });
  }

  /** Insert many rows in one write. Used by the seed. */
  async createMany(items: Array<Omit<T, 'id'> & { id?: string }>): Promise<T[]> {
    return this.enqueue(async () => {
      const rows = await this.load();
      const created = items.map(
        (item) => ({ ...item, id: item.id ?? `${this.table}_${randomUUID()}` }) as T,
      );
      rows.push(...created);
      await this.persist(rows);
      return created.map((row) => structuredClone(row));
    });
  }

  /**
   * Partially update a row by id. Returns null when the row does not exist so
   * callers can raise a 404 rather than this layer knowing about HTTP.
   *
   * `id` is stripped from the patch: a primary key is never reassignable.
   */
  async update(id: string, patch: Partial<Omit<T, 'id'>>): Promise<T | null> {
    return this.enqueue(async () => {
      const rows = await this.load();
      const index = rows.findIndex((row) => row.id === id);
      if (index === -1) return null;

      const { id: _ignored, ...safePatch } = patch as Partial<T>;
      const updated = { ...rows[index], ...safePatch, id } as T;
      rows[index] = updated;
      await this.persist(rows);
      return structuredClone(updated);
    });
  }

  /** Delete one row by id. Returns false when it did not exist. */
  async delete(id: string): Promise<boolean> {
    return this.enqueue(async () => {
      const rows = await this.load();
      const index = rows.findIndex((row) => row.id === id);
      if (index === -1) return false;
      rows.splice(index, 1);
      await this.persist(rows);
      return true;
    });
  }

  /**
   * Delete every row matching a predicate. Returns the number removed.
   *
   * This is how the tightly-scoped cascades in the schema doc are expressed:
   * deleting a quote calls this on quote_line_items for that quote_id, and
   * never touches clients, invoices or components.
   */
  async deleteMany(predicate: (row: T) => boolean): Promise<number> {
    return this.enqueue(async () => {
      const rows = await this.load();
      const keep = rows.filter((row) => !predicate(row));
      const removed = rows.length - keep.length;
      if (removed > 0) await this.persist(keep);
      return removed;
    });
  }

  /** Replace the entire table. Used only by the seed script. */
  async replaceAll(items: T[]): Promise<void> {
    return this.enqueue(async () => {
      await this.persist(structuredClone(items));
    });
  }

  /* ---------------------------------------------------------------------- */
  /* Disk                                                                   */
  /* ---------------------------------------------------------------------- */

  private async load(): Promise<T[]> {
    if (this.cache) return this.cache;
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        throw new Error(`${this.filePath} does not contain a JSON array`);
      }
      this.cache = parsed as T[];
    } catch (error) {
      // A missing file is the normal state before the first seed run, and an
      // empty table is the correct reading of it. Anything else (unparseable
      // JSON, a permissions problem) is a real fault and must surface.
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        this.cache = [];
      } else {
        throw error;
      }
    }
    return this.cache;
  }

  /**
   * Write-through: the file on disk is updated before any mutation resolves,
   * so a restart of the API or a reload of either frontend shows the change.
   * Writes to a sibling temp file and renames, which is atomic on the same
   * filesystem, so an interrupted write cannot leave a half-written table.
   */
  private async persist(rows: T[]): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const tempPath = `${this.filePath}.${process.pid}.tmp`;
    await fs.writeFile(tempPath, `${JSON.stringify(rows, null, 2)}\n`, 'utf8');
    await fs.rename(tempPath, this.filePath);
    this.cache = rows;
  }

  /** Chain an operation onto this file's write queue. */
  private enqueue<R>(operation: () => Promise<R>): Promise<R> {
    const result = this.queue.then(operation, operation);
    // Keep the chain alive after a rejection, and do not leave the swallowed
    // rejection unhandled — the real error still reaches the caller via
    // `result`.
    this.queue = result.catch(() => undefined);
    return result;
  }
}
