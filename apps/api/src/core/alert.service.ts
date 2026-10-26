import { Injectable, Logger } from '@nestjs/common';

import type { AlertKind, AlertSettings, AlertSource } from '../common/types/domain';
import { DatabaseService } from '../data/database.service';
import { clean, fingerprint } from './alert-scrub';
import { MailService, templates } from './mail.service';

export interface Alert {
  kind: AlertKind;
  source: AlertSource;
  /** What happened. Cleaned here (first line, no addresses or tokens), so an error message can be passed as it is. */
  title: string;
  route?: string;
  location?: string;
  status?: number;
}

const SITE = process.env.ALERT_SITE ?? 'Enzo';
const RELEASE = (process.env.RELEASE ?? '').slice(0, 12) || null;
const SETTINGS_ID = 'alerts';
const LONDON = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'medium', timeZone: 'Europe/London' });

/** The same problem is emailed once per window, with a count of what it skipped. */
const WINDOW_MS = 15 * 60_000;
const HOUR_MS = 60 * 60_000;
/**
 * Emails per hour, per bucket, so one noisy source cannot hide the rest. The
 * browser buckets are small: that route is public and anyone can post to it.
 */
const CAPS: Record<string, number> = { priority: 20, api: 20, system: 20, web: 10, admin: 5, portal: 5 };
const REMEMBER = 500;

/**
 * Tells the people who run the platform that something is wrong, by email,
 * from ALERT_FROM. Never throws and never waits: a broken alert must not break
 * the request that raised it.
 *
 * Every report is counted in `alert_events` (30 days). Whether it is also
 * emailed is decided in memory: a problem seen in the last 15 minutes is
 * counted, not mailed again, and a bucket stops at its hourly cap with one
 * "limit reached" email. ponytail: the API runs as one instance, so memory is
 * enough; a restart at worst repeats one email.
 */
@Injectable()
export class AlertService {
  private readonly logger = new Logger(AlertService.name);
  private readonly from = process.env.ALERT_FROM || undefined;
  private readonly sent = new Map<string, { at: number; skipped: number }>();
  private readonly buckets = new Map<string, { start: number; sent: number; capped: boolean }>();
  private settingsCache: { at: number; value: Pick<AlertSettings, 'recipients' | 'errors_on'> } | null = null;
  private pruned = 0;
  private warned = false;
  /** Overridable so a test can move time. */
  now = (): number => Date.now();

  constructor(
    private readonly mail: MailService,
    private readonly db: DatabaseService,
  ) {
    // A failed customer email is itself a problem worth hearing about.
    mail.onFailure = (_mail, message) =>
      this.report({ kind: 'error', source: 'system', title: `An email could not be sent: ${message}` });
  }

  report(alert: Alert): void {
    void this.handle(alert).catch((error: unknown) =>
      this.logger.error(`Could not handle an alert: ${error instanceof Error ? error.message : String(error)}`),
    );
  }

  /** Settings › Alerts changed. */
  forgetSettings(): void {
    this.settingsCache = null;
  }

  get sender(): string {
    return this.from ?? process.env.MAIL_FROM ?? 'Enzo Interiors <no-reply@localhost>';
  }

  /** Who is emailed: the saved list, else ALERT_TO. */
  async recipients(): Promise<string[]> {
    const { recipients } = await this.settings();
    return recipients.length ? recipients : envRecipients();
  }

  async settings(): Promise<Pick<AlertSettings, 'recipients' | 'errors_on'>> {
    if (this.settingsCache && this.now() - this.settingsCache.at < 60_000) return this.settingsCache.value;
    const row = await this.db.alertSettings.findById(SETTINGS_ID);
    const value = { recipients: row?.recipients ?? [], errors_on: row?.errors_on ?? true };
    this.settingsCache = { at: this.now(), value };
    return value;
  }

  /** From Settings › Alerts: goes out at once, past the windows and caps, so the sender and the folder rules can be checked. */
  async sendTest(kind: AlertKind): Promise<{ sent: boolean; to: string[] }> {
    const to = await this.recipients();
    if (!to.length) return { sent: false, to };
    const sent = await this.deliver(to, `[${SITE}][${kind.toUpperCase()}] Test alert`, [
      ['What', 'A test from Settings › Alerts. Nothing is wrong.'],
      ['Sent from', this.sender],
      ['When', LONDON.format(new Date(this.now()))],
    ]);
    return { sent, to };
  }

  /** The morning summary, to the same people as the alerts. Not counted against the caps: it is one email a day. */
  async sendDigest(rows: Array<[string, string]>): Promise<boolean> {
    const to = await this.recipients();
    return to.length ? this.deliver(to, `[${SITE}][DAILY] Overnight summary`, rows) : false;
  }

  private async handle(raw: Alert): Promise<void> {
    const alert = {
      ...raw,
      title: clean(raw.title) || 'Unknown error',
      route: clean(raw.route, 120) || undefined,
      location: clean(raw.location, 80) || undefined,
    };
    const id = fingerprint([alert.kind, alert.source, alert.route, alert.location, alert.title]);

    try {
      await this.db.alertStore.record({
        id,
        kind: alert.kind,
        source: alert.source,
        title: alert.title,
        route: alert.route ?? null,
        location: alert.location ?? null,
        status: alert.status ?? null,
        release: RELEASE,
      });
      if (this.now() - this.pruned > HOUR_MS) {
        this.pruned = this.now();
        await this.db.alertStore.prune();
      }
    } catch (error) {
      // The history is a nicety; the email is the point. Carry on.
      this.logger.error(`Could not record an alert: ${error instanceof Error ? error.message : String(error)}`);
    }

    const settings = await this.settings();
    if (alert.kind === 'error' && !settings.errors_on) return;
    const to = settings.recipients.length ? settings.recipients : envRecipients();
    if (!to.length) {
      if (!this.warned) this.logger.warn('An alert was raised but nobody receives alerts: set recipients in Settings › Alerts or ALERT_TO.');
      this.warned = true;
      return;
    }

    // Everything from here to the send is synchronous, so two reports of the
    // same problem cannot both pass the check.
    const now = this.now();
    const seen = this.sent.get(id);
    if (seen && now - seen.at < WINDOW_MS) {
      seen.skipped += 1;
      return;
    }
    const name = alert.kind === 'error' ? alert.source : 'priority';
    const cap = CAPS[name] ?? 20;
    let bucket = this.buckets.get(name);
    if (!bucket || now - bucket.start >= HOUR_MS) this.buckets.set(name, (bucket = { start: now, sent: 0, capped: false }));
    if (bucket.sent >= cap) {
      if (bucket.capped) return;
      bucket.capped = true;
      await this.deliver(to, `[${SITE}][${alert.kind.toUpperCase()}] Alert limit reached`, [
        ['What', `More than ${cap} ${name} alerts this hour. The rest are recorded, and not emailed until the hour is up.`],
        ['When', LONDON.format(new Date(now))],
      ]);
      return;
    }
    bucket.sent += 1;
    this.sent.delete(id);
    this.sent.set(id, { at: now, skipped: 0 });
    if (this.sent.size > REMEMBER) this.sent.delete(this.sent.keys().next().value as string);

    const rows: Array<[string, string]> = [['What', alert.title]];
    if (alert.route) rows.push(['Where', alert.route]);
    if (alert.location) rows.push(['In', alert.location]);
    if (alert.status) rows.push(['Status', String(alert.status)]);
    rows.push(['From', alert.source]);
    if (RELEASE) rows.push(['Release', RELEASE]);
    if (seen?.skipped) rows.push(['Since the last email', `${seen.skipped} more time${seen.skipped === 1 ? '' : 's'}`]);
    rows.push(['When', LONDON.format(new Date(now))]);
    await this.deliver(to, `[${SITE}][${alert.kind.toUpperCase()}] ${alert.title}`, rows);
  }

  private deliver(to: string[], subject: string, rows: Array<[string, string]>): Promise<boolean> {
    return this.mail.send({ to, from: this.sender, ...templates.alert(subject, rows) });
  }
}

const envRecipients = (): string[] =>
  (process.env.ALERT_TO ?? '')
    .split(',')
    .map((address) => address.trim())
    .filter(Boolean);
