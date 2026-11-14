import { ListObjectsV2Command, type S3Client } from '@aws-sdk/client-s3';
import { Controller, Get, Injectable, Logger, Module, OnApplicationBootstrap, OnApplicationShutdown, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { CurrentUser, Roles } from '../../common/decorators';
import { AuthPrincipal } from '../../common/types/principal';
import { ActivityLogService } from '../../core/activity-log.service';
import { AlertService } from '../../core/alert.service';
import { CacheService } from '../../core/cache';
import { MailService } from '../../core/mail.service';
import { RateLimitStore } from '../../core/rate-limit';
import { s3Clients } from '../../core/storage';
import { DatabaseService } from '../../data/database.service';
import { londonNow } from './london';

const MAX_PAGES = 50;
const EVERY_MS = 5 * 60_000;
const RELEASE = (process.env.RELEASE ?? '').slice(0, 12) || null;

interface BucketUse {
  id: 'public' | 'private';
  files: number;
  bytes: number;
  /** Stopped counting at MAX_PAGES x 1000 files. */
  partial: boolean;
  error: string | null;
}

async function countBucket(client: S3Client, id: BucketUse['id'], bucket: string): Promise<BucketUse> {
  let files = 0;
  let bytes = 0;
  let token: string | undefined;
  try {
    for (let page = 0; page < MAX_PAGES; page++) {
      const out = await client.send(new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: token }));
      for (const object of out.Contents ?? []) {
        files += 1;
        bytes += object.Size ?? 0;
      }
      if (!out.IsTruncated) return { id, files, bytes, partial: false, error: null };
      token = out.NextContinuationToken;
    }
    return { id, files, bytes, partial: true, error: null };
  } catch {
    return { id, files, bytes, partial: false, error: 'Could not read this bucket.' };
  }
}

const size = (bytes: number): string => {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
};

/**
 * What the platform looks like right now, for the Infra manager: sizes, the
 * cache, the last day's failures and which switches are set. Counts and byte
 * totals only. Never a client, a message or an amount.
 */
@Injectable()
export class InfraService {
  constructor(
    private readonly db: DatabaseService,
    private readonly cache: CacheService,
    private readonly mail: MailService,
    private readonly alerts: AlertService,
  ) {}

  /** A minute old at most: the page is for looking at, not for polling. */
  stats() {
    return this.cache.wrap('infra:stats', 60_000, () => this.collect());
  }

  /** Counting objects walks the bucket, so it is remembered for ten minutes. */
  private storage(): Promise<BucketUse[] | null> {
    return this.cache.wrap('infra:storage', 10 * 60_000, async () => {
      const s3 = s3Clients();
      if (!s3) return null;
      return Promise.all([
        countBucket(s3.client, 'public', process.env.S3_PUBLIC_BUCKET ?? 'enzo-public'),
        countBucket(s3.client, 'private', process.env.S3_PRIVATE_BUCKET ?? 'enzo-private'),
      ]);
    });
  }

  private async collect() {
    const [database, traffic, problems, totals, storage, cache, recipients] = await Promise.all([
      this.db.infraStore.database().catch(() => null),
      this.db.infraStore.traffic(),
      this.db.infraStore.problems(24 * 7),
      this.db.infraStore.totals(),
      this.storage(),
      this.cache.stats(),
      this.alerts.recipients(),
    ]);
    const vapid = !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);
    const checks = [
      { id: 'database', label: 'Database', ok: !!database, hint: 'The API cannot reach PostgreSQL.' },
      { id: 'storage', label: 'File storage', ok: !!storage && storage.every((bucket) => !bucket.error), hint: 'Set S3_ENDPOINT and its keys, or check MinIO.' },
      { id: 'cache', label: 'Shared cache and rate limits', ok: cache.backend === 'redis' && cache.reachable, hint: 'Redis is not set or not answering, so each limit is per process.' },
      { id: 'email', label: 'Email sending', ok: this.mail.enabled, hint: 'SMTP_HOST is not set.' },
      { id: 'recipients', label: 'Alert recipients', ok: recipients.length > 0, hint: 'Add an address in Settings › Alerts.' },
      { id: 'website_reports', label: 'Website error reports', ok: !!process.env.ALERT_SHARED_SECRET, hint: 'ALERT_SHARED_SECRET is not set.' },
      { id: 'country', label: 'Country in the access log', ok: process.env.TRUST_CLOUDFLARE === 'true', hint: 'TRUST_CLOUDFLARE is not true, so new-country alerts cannot fire.' },
      { id: 'push', label: 'Push notifications', ok: vapid, hint: 'The VAPID keys are not set.' },
      { id: 'two_factor', label: 'Two-step sign-in', ok: process.env.DISABLE_2FA !== 'true', hint: 'DISABLE_2FA is on: staff sign in with a password alone.' },
    ];
    return {
      generated_at: new Date().toISOString(),
      release: RELEASE,
      uptime_seconds: Math.round(process.uptime()),
      checks,
      database,
      storage,
      cache,
      traffic,
      problems_7d: problems,
      totals,
    };
  }

  /** The 08:00 email: the same numbers, a line each. */
  async digestRows(): Promise<Array<[string, string]>> {
    const stats = await this.collect();
    const bad = stats.checks.filter((check) => !check.ok).map((check) => check.label);
    const { traffic, database, storage, cache } = stats;
    const day = await this.db.infraStore.problems(24);
    const rows: Array<[string, string]> = [
      ['Server errors, last 24 hours', `${traffic.errors}${traffic.top_error_routes[0] ? ` (most: ${traffic.top_error_routes[0].route})` : ''}`],
      ['Refused requests', String(traffic.refused)],
      ['Failed sign-ins', `${traffic.failed_signins} from ${traffic.failed_signin_addresses} address${traffic.failed_signin_addresses === 1 ? '' : 'es'}`],
      ['Problems emailed', `${day.urgent} urgent, ${day.error} error, ${day.security} security`],
    ];
    if (database) rows.push(['Database', `${size(database.bytes)}, ${database.connections} of ${database.max_connections} connections`]);
    for (const bucket of storage ?? []) {
      rows.push([bucket.id === 'public' ? 'Website images' : 'Client documents', `${size(bucket.bytes)} in ${bucket.files}${bucket.partial ? '+' : ''} files`]);
    }
    const asked = cache.hits + cache.misses;
    rows.push(['Cache', `${cache.backend}, ${cache.keys} keys${asked ? `, ${Math.round((cache.hits / asked) * 100)}% found since the last restart` : ''}`]);
    rows.push(['Needs attention', bad.length ? bad.join(', ') : 'Nothing']);
    return rows;
  }

  async sendDigest(): Promise<boolean> {
    return this.alerts.sendDigest(await this.digestRows());
  }
}

/**
 * Two jobs every five minutes, on a timer, because nobody has to ask for them:
 * tell the Infra team when one address is hammering the sign-in or probing for
 * routes, and send the 08:00 summary. Alerts only, nothing is blocked: behind
 * Cloudflare many people share an address, so blocking is done by hand there.
 * Several API instances: tick() claims each slot once; claimDigest guards the summary too.
 */
@Injectable()
export class InfraWatch implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(InfraWatch.name);
  private timer: NodeJS.Timeout | undefined;

  constructor(
    private readonly db: DatabaseService,
    private readonly alerts: AlertService,
    private readonly infra: InfraService,
    private readonly limits: RateLimitStore,
  ) {}

  onApplicationBootstrap(): void {
    this.timer = setInterval(() => void this.tick(), EVERY_MS);
    this.timer.unref();
  }

  onApplicationShutdown(): void {
    clearInterval(this.timer);
  }

  /**
   * The first API instance to claim this five-minute slot runs it, so several
   * instances don't each send the same attack alert. Redis down = each runs
   * (counters fall back to memory): repeated alerts, nothing missed.
   */
  async tick(now = new Date()): Promise<void> {
    const slot = Math.floor(now.getTime() / EVERY_MS);
    if ((await this.limits.hit(`job:infra-watch:${slot}`, EVERY_MS)) > 1) return;
    await this.attacks().catch((error: unknown) => this.logger.error(`Attack check failed: ${error instanceof Error ? error.message : String(error)}`));
    await this.digest(now).catch((error: unknown) => this.logger.error(`Daily summary failed: ${error instanceof Error ? error.message : String(error)}`));
  }

  async attacks(): Promise<void> {
    for (const hit of await this.db.infraStore.busyAddresses('login', 10, 10)) {
      this.alerts.report({ kind: 'security', source: 'api', title: `${hit.n} failed sign-ins from ${hit.ip} in 10 minutes. See Settings › Security.`, route: '/sign-in' });
    }
    for (const hit of await this.db.infraStore.busyAddresses('refused', 5, 100)) {
      this.alerts.report({
        kind: 'security',
        source: 'api',
        title: `${hit.n} refused requests from ${hit.ip} in 5 minutes: it may be scanning the site. Block it in Cloudflare if it goes on. See Settings › Security.`,
      });
    }
  }

  /** At 08:00 London or the first tick after it, once a day. A failed send is not retried that day: its absence is the signal. */
  async digest(now: Date): Promise<boolean> {
    const { day, hour } = londonNow(now);
    if (hour < 8) return false;
    const row = await this.db.alertSettings.findById('alerts');
    if (row && (!row.digest_on || row.digest_day === day)) return false;
    if (!(await this.alerts.recipients()).length) return false;
    if (!(await this.db.infraStore.claimDigest(day))) return false;
    return this.infra.sendDigest();
  }
}

@Controller('infra')
export class InfraController {
  constructor(
    private readonly infra: InfraService,
    private readonly activity: ActivityLogService,
  ) {}

  @Get('stats')
  @Roles('Infra')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  stats() {
    return this.infra.stats();
  }

  /** From Settings › Alerts: the summary now, to check it arrives. */
  @Post('digest')
  @Roles('Infra')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async sendNow(@CurrentUser() principal: AuthPrincipal) {
    const sent = await this.infra.sendDigest();
    await this.activity.record({ principal, action: 'digest_test', targetTable: 'alert_settings', targetId: 'alerts', details: { sent } });
    return { sent };
  }
}

@Module({
  controllers: [InfraController],
  providers: [InfraService, InfraWatch],
})
export class InfraModule {}
