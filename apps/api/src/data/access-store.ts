import { randomUUID } from 'node:crypto';

import { PrismaService } from './prisma.service';

export interface AccessRecord {
  kind: 'signin' | 'request';
  actor_id: string | null;
  actor_kind: string | null;
  actor_name: string | null;
  actor_role: string | null;
  method: string;
  route: string;
  target_id: string | null;
  status: number;
  ip: string | null;
  country: string | null;
  device: string | null;
}

export interface AccessEvent extends AccessRecord {
  id: string;
  at: string;
}

export type AccessFilter = 'all' | 'signins' | 'failures' | 'changes';

const KEEP_DAYS = 90;

/** The access log's table. Its own small class, like AlertStore: rows only ever go in, get read newest first, and age out. */
export class AccessStore {
  constructor(private readonly prisma: PrismaService) {}

  async add(row: AccessRecord): Promise<void> {
    await this.prisma.accessEvent.create({ data: { id: randomUUID(), ...row } });
  }

  /** Newest first. `before` is the `at` of the last row of the page before. */
  async list(opts: { filter: AccessFilter; q?: string; before?: string; take: number }): Promise<AccessEvent[]> {
    const { filter, q, before } = opts;
    const rows = await this.prisma.accessEvent.findMany({
      where: {
        ...(filter === 'signins' ? { kind: 'signin' } : {}),
        ...(filter === 'failures' ? { status: { gte: 400 } } : {}),
        ...(filter === 'changes' ? { kind: 'request', method: { not: 'GET' } } : {}),
        ...(before ? { at: { lt: new Date(before) } } : {}),
        ...(q ? { OR: [{ actor_name: { contains: q, mode: 'insensitive' } }, { ip: q }] } : {}),
      },
      orderBy: { at: 'desc' },
      take: opts.take,
    });
    return rows.map((row) => ({ ...row, kind: row.kind as AccessEvent['kind'], at: row.at.toISOString() }));
  }

  /** What this person's earlier sign-ins look like: how many, and how many from this country and this device. */
  async seen(actorId: string, country: string | null, device: string | null): Promise<{ total: number; country: number; device: number }> {
    const where = { actor_id: actorId, kind: 'signin' };
    const [total, sameCountry, sameDevice] = await Promise.all([
      this.prisma.accessEvent.count({ where }),
      country ? this.prisma.accessEvent.count({ where: { ...where, country } }) : 0,
      device ? this.prisma.accessEvent.count({ where: { ...where, device } }) : 0,
    ]);
    return { total, country: sameCountry, device: sameDevice };
  }

  /** The IP goes with the row: after 90 days neither is kept. */
  async prune(): Promise<number> {
    const { count } = await this.prisma.accessEvent.deleteMany({
      where: { at: { lt: new Date(Date.now() - KEEP_DAYS * 86_400_000) } },
    });
    return count;
  }
}
