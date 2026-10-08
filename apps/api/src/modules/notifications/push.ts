import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Injectable, Logger, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Prisma } from '@prisma/client';
import { IsString, Matches, MaxLength } from 'class-validator';
import * as webpush from 'web-push';

import { CurrentUser, Roles } from '../../common/decorators';
import { STAFF_ROLES } from '../../common/types/domain';
import { AuthPrincipal } from '../../common/types/principal';
import { DatabaseService } from '../../data/database.service';

/**
 * Web Push (VAPID) for the admin and portal PWAs: a notification on the phone's
 * lock screen while the app is closed. Every bell notification is also pushed
 * (NotificationsService calls send()), so there is one hook, not one per feature.
 *
 * VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT unset = push is off,
 * said once at boot; the bell, email and everything else carry on.
 * `npm run push:keys` prints a fresh key pair.
 */

export type PushOwner = 'staff' | 'client';
export interface PushMessage {
  title: string;
  body?: string | null;
  /** A path in the receiving app, e.g. /projects/123. The service worker opens it. */
  link?: string | null;
}

/** Devices per person. A new one past this drops their oldest. */
const MAX_PER_OWNER = 10;

/**
 * The browsers' push services. The API POSTs to whatever endpoint a browser
 * hands it, so anything else is refused: otherwise a signed-in user could make
 * this server send requests to any https host (SSRF).
 */
const PUSH_HOSTS = ['fcm.googleapis.com', 'android.googleapis.com', 'push.services.mozilla.com', 'push.apple.com', 'notify.windows.com'];

export function isPushEndpoint(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || url.port !== '' || url.username || url.password) return false;
  const host = url.hostname.toLowerCase();
  return PUSH_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

const base64url = /^[A-Za-z0-9_-]+={0,2}$/;

/** PushSubscription.toJSON(), flattened: { endpoint, keys: { p256dh, auth } }. */
export class SubscribeDto {
  @IsString() @MaxLength(2048) endpoint!: string;
  @IsString() @MaxLength(200) @Matches(base64url) p256dh!: string;
  @IsString() @MaxLength(100) @Matches(base64url) auth!: string;
}

export class UnsubscribeDto {
  @IsString() @MaxLength(2048) endpoint!: string;
}

const ownerOf = (principal: AuthPrincipal): PushOwner => (principal.kind === 'Client' ? 'client' : 'staff');

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  readonly publicKey: string | null = null;

  constructor(private readonly db: DatabaseService) {
    const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
    const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
    const subject = process.env.VAPID_SUBJECT?.trim();
    if (!publicKey || !privateKey || !subject) {
      this.logger.log('Push notifications are off: set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT (npm run push:keys).');
      return;
    }
    try {
      webpush.setVapidDetails(subject, publicKey, privateKey);
      this.publicKey = publicKey;
    } catch (error) {
      this.logger.error(`Push notifications are off: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Store this browser for the caller. One row per endpoint: the same browser
   * subscribing again (or after someone else signed out of it) replaces the row.
   */
  async subscribe(principal: AuthPrincipal, dto: SubscribeDto, userAgent?: string): Promise<void> {
    if (!isPushEndpoint(dto.endpoint)) throw new BadRequestException('That is not a browser push address.');
    const owner = { owner_type: ownerOf(principal), owner_id: principal.id };
    await this.db.pushSubscriptions.deleteWhere({ endpoint: dto.endpoint });
    try {
      await this.db.pushSubscriptions.create({
        ...owner,
        endpoint: dto.endpoint,
        p256dh: dto.p256dh,
        auth: dto.auth,
        user_agent: userAgent?.slice(0, 300) ?? null,
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      // Two subscribes from one browser at once: the other request stored it.
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error;
    }
    const mine = await this.db.pushSubscriptions.findWhere(owner, { orderBy: { created_at: 'desc' } });
    const extra = mine.slice(MAX_PER_OWNER).map((row) => row.id);
    if (extra.length > 0) await this.db.pushSubscriptions.deleteWhere({ id: { in: extra } });
  }

  /** Only the caller's own row: an endpoint someone else registered is left alone. */
  async unsubscribe(principal: AuthPrincipal, endpoint: string): Promise<void> {
    await this.db.pushSubscriptions.deleteWhere({ endpoint, owner_type: ownerOf(principal), owner_id: principal.id });
  }

  /** Fire and forget: never slows down or fails the request that caused it. */
  send(owner: PushOwner, ownerId: string, message: PushMessage): void {
    if (!this.publicKey) return;
    this.deliver(owner, ownerId, message).catch((error: unknown) => {
      this.logger.error(`Push failed: ${error instanceof Error ? error.message : String(error)}`);
    });
  }

  private async deliver(owner: PushOwner, ownerId: string, message: PushMessage): Promise<void> {
    const rows = await this.db.pushSubscriptions.findWhere({ owner_type: owner, owner_id: ownerId });
    if (rows.length === 0) return;
    const payload = JSON.stringify({ title: message.title, body: message.body ?? '', url: message.link ?? '/' });
    await Promise.all(
      rows.map(async (row) => {
        try {
          await webpush.sendNotification({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }, payload, {
            TTL: 24 * 60 * 60,
            timeout: 10_000,
          });
        } catch (error) {
          const status = error instanceof webpush.WebPushError ? error.statusCode : undefined;
          // Gone: the browser unsubscribed or the app was removed. Forget it.
          if (status === 404 || status === 410) {
            await this.db.pushSubscriptions.delete(row.id);
            return;
          }
          // The endpoint is a bearer capability: log its host, never the URL.
          this.logger.warn(`Push to ${new URL(row.endpoint).host} failed (${status ?? (error instanceof Error ? error.message : 'error')})`);
        }
      }),
    );
  }
}

@Controller('push')
@Roles(...STAFF_ROLES, 'Client')
export class PushController {
  constructor(private readonly push: PushService) {}

  /** The VAPID public key the browser subscribes with; null = push is off. */
  @Get('public-key')
  publicKey() {
    return { key: this.push.publicKey };
  }

  @Post('subscribe')
  @HttpCode(204)
  @Throttle({ default: { limit: 20, ttl: 15 * 60_000 } })
  async subscribe(
    @CurrentUser() principal: AuthPrincipal,
    @Body() dto: SubscribeDto,
    @Req() req: { headers: Record<string, string | string[] | undefined> },
  ) {
    const ua = req.headers['user-agent'];
    await this.push.subscribe(principal, dto, typeof ua === 'string' ? ua : undefined);
  }

  @Delete('subscribe')
  @HttpCode(204)
  async unsubscribe(@CurrentUser() principal: AuthPrincipal, @Body() dto: UnsubscribeDto) {
    await this.push.unsubscribe(principal, dto.endpoint);
  }
}
