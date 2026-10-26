import { PrismaService } from './prisma.service';

const n = (value: unknown): number => Number(value ?? 0);

export interface DatabaseUse {
  ping_ms: number;
  bytes: number;
  connections: number;
  max_connections: number;
  tables: Array<{ name: string; bytes: number; rows: number }>;
}

export interface Traffic {
  hours: Array<{ hour: string; errors: number; refused: number }>;
  errors: number;
  refused: number;
  failed_signins: number;
  failed_signin_addresses: number;
  top_error_routes: Array<{ route: string; count: number }>;
}

/**
 * The platform's own numbers for the Infra page and the daily summary: sizes from
 * PostgreSQL's catalogue and counts over the access log. Nothing here reads a
 * client's content; the only business figures are row counts.
 */
export class InfraStore {
  constructor(private readonly prisma: PrismaService) {}

  async database(): Promise<DatabaseUse> {
    const started = Date.now();
    await this.prisma.$queryRaw`SELECT 1`;
    const ping_ms = Date.now() - started;
    const [size] = await this.prisma.$queryRaw<Array<{ bytes: bigint; connections: bigint; max: string }>>`
      SELECT pg_database_size(current_database()) AS bytes,
             (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()) AS connections,
             current_setting('max_connections') AS max`;
    const tables = await this.prisma.$queryRaw<Array<{ name: string; bytes: bigint; rows: bigint }>>`
      SELECT relname AS name, pg_total_relation_size(relid) AS bytes, n_live_tup AS rows
      FROM pg_stat_user_tables ORDER BY bytes DESC LIMIT 8`;
    return {
      ping_ms,
      bytes: n(size?.bytes),
      connections: n(size?.connections),
      max_connections: n(size?.max),
      tables: tables.map((row) => ({ name: row.name, bytes: n(row.bytes), rows: n(row.rows) })),
    };
  }

  /** The last 24 hours of failures. Every failure is logged (access-log.service), so these are complete counts; successful reads are not logged, so there is no request total. */
  async traffic(): Promise<Traffic> {
    const [hours, routes, signins] = await Promise.all([
      this.prisma.$queryRaw<Array<{ hour: Date; errors: bigint; refused: bigint }>>`
        SELECT date_trunc('hour', at) AS hour,
               count(*) FILTER (WHERE status >= 500) AS errors,
               count(*) FILTER (WHERE status >= 400 AND status < 500) AS refused
        FROM access_events
        WHERE kind = 'request' AND at > now() - interval '24 hours'
        GROUP BY 1 ORDER BY 1`,
      this.prisma.$queryRaw<Array<{ route: string; count: bigint }>>`
        SELECT route, count(*) AS count FROM access_events
        WHERE status >= 500 AND at > now() - interval '24 hours'
        GROUP BY route ORDER BY count DESC LIMIT 5`,
      this.prisma.$queryRaw<Array<{ n: bigint; addresses: bigint }>>`
        SELECT count(*) AS n, count(DISTINCT ip) AS addresses FROM access_events
        WHERE status >= 400 AND route LIKE '%/login' AND at > now() - interval '24 hours'`,
    ]);
    const byHour = new Map(hours.map((row) => [row.hour.toISOString(), row]));
    const top = new Date();
    top.setUTCMinutes(0, 0, 0);
    const series = Array.from({ length: 24 }, (_, i) => {
      const hour = new Date(top.getTime() - (23 - i) * 3_600_000).toISOString();
      const row = byHour.get(hour);
      return { hour, errors: n(row?.errors), refused: n(row?.refused) };
    });
    return {
      hours: series,
      errors: series.reduce((sum, row) => sum + row.errors, 0),
      refused: series.reduce((sum, row) => sum + row.refused, 0),
      failed_signins: n(signins[0]?.n),
      failed_signin_addresses: n(signins[0]?.addresses),
      top_error_routes: routes.map((row) => ({ route: row.route, count: n(row.count) })),
    };
  }

  /** Addresses with at least `limit` failed sign-ins ('login') or refusals ('refused') in the last `minutes`. */
  async busyAddresses(kind: 'login' | 'refused', minutes: number, limit: number): Promise<Array<{ ip: string; n: number }>> {
    const rows =
      kind === 'login'
        ? await this.prisma.$queryRaw<Array<{ ip: string; n: bigint }>>`
            SELECT ip, count(*) AS n FROM access_events
            WHERE ip IS NOT NULL AND status >= 400 AND route LIKE '%/login' AND at > now() - make_interval(mins => ${minutes}::int)
            GROUP BY ip HAVING count(*) >= ${limit}::int ORDER BY n DESC LIMIT 5`
        : await this.prisma.$queryRaw<Array<{ ip: string; n: bigint }>>`
            SELECT ip, count(*) AS n FROM access_events
            WHERE ip IS NOT NULL AND status IN (401, 403, 404, 429) AND at > now() - make_interval(mins => ${minutes}::int)
            GROUP BY ip HAVING count(*) >= ${limit}::int ORDER BY n DESC LIMIT 5`;
    return rows.map((row) => ({ ip: row.ip, n: n(row.n) }));
  }

  /** Problems reported in the last `hours`, by kind (alert_events keeps 30 days). */
  async problems(hours: number): Promise<Record<'urgent' | 'error' | 'security', number>> {
    const rows = await this.prisma.alertEvent.groupBy({
      by: ['kind'],
      where: { last_at: { gt: new Date(Date.now() - hours * 3_600_000) } },
      _sum: { count: true },
    });
    const out = { urgent: 0, error: 0, security: 0 };
    for (const row of rows) if (row.kind in out) out[row.kind as keyof typeof out] = row._sum.count ?? 0;
    return out;
  }

  /** Row counts only: no names, no money. */
  async totals(): Promise<{ clients: number; projects: number; staff: number }> {
    const [clients, projects, staff] = await Promise.all([this.prisma.client.count(), this.prisma.project.count(), this.prisma.staffUser.count()]);
    return { clients, projects, staff };
  }

  /** True for exactly one caller per London day, so a restart or a second instance cannot send the summary twice. */
  async claimDigest(day: string): Promise<boolean> {
    await this.prisma.alertSettings.upsert({ where: { id: 'alerts' }, create: { id: 'alerts' }, update: {} });
    const { count } = await this.prisma.alertSettings.updateMany({
      where: { id: 'alerts', digest_on: true, OR: [{ digest_day: null }, { digest_day: { not: day } }] },
      data: { digest_day: day },
    });
    return count === 1;
  }
}
