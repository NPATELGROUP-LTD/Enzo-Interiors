import type { AlertKind, AlertSource } from '../common/types/domain';
import { PrismaService } from './prisma.service';

export interface AlertRecord {
  id: string;
  kind: AlertKind;
  source: AlertSource;
  title: string;
  route: string | null;
  location: string | null;
  status: number | null;
  release: string | null;
}

const KEEP_DAYS = 30;

/** The one alert write that must be atomic: counting a repeat without losing one to a race. */
export class AlertStore {
  constructor(private readonly prisma: PrismaService) {}

  /** First time: a row. Every time after: count + 1 and a new last_at. */
  async record(alert: AlertRecord): Promise<void> {
    const { id, ...fields } = alert;
    await this.prisma.alertEvent.upsert({
      where: { id },
      create: { id, ...fields },
      update: { count: { increment: 1 }, last_at: new Date(), title: fields.title, status: fields.status, release: fields.release },
    });
  }

  /** Rows nobody has seen for 30 days. */
  async prune(): Promise<number> {
    const { count } = await this.prisma.alertEvent.deleteMany({
      where: { last_at: { lt: new Date(Date.now() - KEEP_DAYS * 86_400_000) } },
    });
    return count;
  }
}
