import { randomUUID } from 'node:crypto';

import { BaseRecord } from '../common/types/domain';

/**
 * A single PostgreSQL table, presented with the exact method surface
 * JsonRepository had.
 *
 * That is the whole point of this class. JsonRepository documented itself as
 * "the ONLY thing that has to change when the prototype swaps to real
 * PostgreSQL", and this is the other side of that promise: findAll / findById /
 * findOne / create / update / delete keep their signatures, so every service
 * calls the same methods before and after the migration and none of them learn
 * where the rows actually live. Nothing outside src/data/ may touch Prisma.
 *
 * Two translations happen here and nowhere else:
 *
 *   - `timestamptz` columns come back as `Date` but the domain types in
 *     common/types/domain.ts declare ISO-8601 strings, which is also what goes
 *     over the wire to apps/admin. Date fields are named per table below and
 *     converted both ways.
 *   - `decimal` columns come back as Prisma `Decimal` objects. Money must never
 *     be a float in the database, but the services and the JSON responses want
 *     plain numbers, so they are narrowed on read. Writes pass the number
 *     straight through; Prisma widens it back to an exact decimal.
 */

/** The subset of a Prisma model delegate this class uses. */
interface Delegate {
  findMany(args?: unknown): Promise<unknown[]>;
  findUnique(args: unknown): Promise<unknown>;
  count(args?: unknown): Promise<number>;
  create(args: unknown): Promise<unknown>;
  update(args: unknown): Promise<unknown>;
  delete(args: unknown): Promise<unknown>;
  deleteMany(args?: unknown): Promise<{ count: number }>;
  createMany(args: unknown): Promise<{ count: number }>;
}

/** Which columns need converting, per table. Everything else passes through. */
export interface FieldTypes {
  /** timestamptz columns: Date in the row, ISO-8601 string in the domain type. */
  dates?: readonly string[];
  /** decimal columns: Prisma Decimal in the row, number in the domain type. */
  decimals?: readonly string[];
}

/** Anything with a `toNumber` — Prisma Decimal, without importing its type. */
function isDecimal(value: unknown): value is { toNumber(): number } {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { toNumber?: unknown }).toNumber === 'function'
  );
}

export class PrismaRepository<T extends BaseRecord> {
  private readonly dates: readonly string[];
  private readonly decimals: readonly string[];

  constructor(
    /**
     * The Prisma delegate for this table, e.g. `prisma.client`. Passed in
     * rather than looked up by name so a typo is a compile error.
     */
    private readonly delegate: Delegate,
    /** Table name, matching the schema doc. Used in error messages only. */
    private readonly tableName: string,
    fields: FieldTypes = {},
  ) {
    this.dates = fields.dates ?? [];
    this.decimals = fields.decimals ?? [];
  }

  /**
   * Row as it comes out of Postgres -> row as the domain types declare it.
   * Only ever called with a row that a caller has already found, so there is
   * no null case to handle here.
   */
  private fromDb(row: unknown): T {
    const out: Record<string, unknown> = { ...(row as Record<string, unknown>) };

    for (const field of this.dates) {
      const value = out[field];
      if (value instanceof Date) out[field] = value.toISOString();
    }
    for (const field of this.decimals) {
      const value = out[field];
      if (isDecimal(value)) out[field] = value.toNumber();
    }
    return out as T;
  }

  /** Row as a service wrote it -> row as Prisma wants it. */
  private toDb(patch: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = { ...patch };
    for (const field of this.dates) {
      const value = out[field];
      // Only strings need lifting; a caller that already passed a Date, or a
      // null for a nullable column, is left exactly as it is.
      if (typeof value === 'string') out[field] = new Date(value);
    }
    return out;
  }

  /**
   * Every row, optionally filtered.
   *
   * ponytail: the predicate is a JavaScript function, so it is applied in the
   * process after the table is read rather than pushed into a SQL WHERE. That
   * is what keeps the signature identical to JsonRepository and the services
   * untouched, and at single-company volumes (hundreds of rows, not millions)
   * it costs nothing measurable. If a table ever grows past what is comfortable
   * to hold in memory, give that table a purpose-built query method on its
   * service rather than making this one clever.
   */
  async findAll(predicate?: (row: T) => boolean): Promise<T[]> {
    const rows = (await this.delegate.findMany()).map((row) => this.fromDb(row));
    return predicate ? rows.filter(predicate) : rows;
  }

  async findById(id: string): Promise<T | null> {
    const row = await this.delegate.findUnique({ where: { id } });
    return row ? this.fromDb(row) : null;
  }

  async findOne(predicate: (row: T) => boolean): Promise<T | null> {
    const rows = await this.findAll();
    return rows.find(predicate) ?? null;
  }

  async count(predicate?: (row: T) => boolean): Promise<number> {
    if (!predicate) return this.delegate.count();
    return (await this.findAll(predicate)).length;
  }

  async create(data: Omit<T, 'id'> & { id?: string }): Promise<T> {
    const { id, ...rest } = data as { id?: string } & Record<string, unknown>;
    const row = await this.delegate.create({
      data: { ...this.toDb(rest), id: id ?? randomUUID() },
    });
    return this.fromDb(row);
  }

  async createMany(items: Array<Omit<T, 'id'> & { id?: string }>): Promise<T[]> {
    // Prisma's createMany does not return the rows, and callers expect them.
    // Sequential creates keep the return contract and stay inside one
    // statement each; the batches here are seed-sized, not request-sized.
    const created: T[] = [];
    for (const item of items) created.push(await this.create(item));
    return created;
  }

  /** Returns null rather than throwing when the row is gone, as before. */
  async update(id: string, patch: Partial<Omit<T, 'id'>>): Promise<T | null> {
    const existing = await this.delegate.findUnique({ where: { id } });
    if (!existing) return null;
    const row = await this.delegate.update({
      where: { id },
      data: this.toDb(patch as Record<string, unknown>),
    });
    return this.fromDb(row);
  }

  /** False rather than throwing when there was nothing to delete. */
  async delete(id: string): Promise<boolean> {
    const existing = await this.delegate.findUnique({ where: { id } });
    if (!existing) return false;
    await this.delegate.delete({ where: { id } });
    return true;
  }

  async deleteMany(predicate: (row: T) => boolean): Promise<number> {
    const doomed = await this.findAll(predicate);
    if (doomed.length === 0) return 0;
    const { count } = await this.delegate.deleteMany({
      where: { id: { in: doomed.map((row) => row.id) } },
    });
    return count;
  }

  /**
   * Replace the table wholesale. Used by the seed and the JSON import, never
   * by a request path. Wrapped by the caller in a transaction where the whole
   * import must succeed or fail together.
   */
  async replaceAll(items: T[]): Promise<void> {
    await this.delegate.deleteMany();
    for (const item of items) {
      const { id, ...rest } = item as { id: string } & Record<string, unknown>;
      await this.delegate.create({ data: { ...this.toDb(rest), id } });
    }
  }

  /** Surfaced for error messages and the import script log. */
  get table(): string {
    return this.tableName;
  }
}
