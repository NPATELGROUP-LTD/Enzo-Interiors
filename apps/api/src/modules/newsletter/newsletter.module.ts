import { randomBytes } from 'node:crypto';

import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Injectable,
  Logger,
  Module,
  NotFoundException,
  OnApplicationBootstrap,
  Param,
  Post,
  Put,
  Query,
  Res,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsEmail, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import type { Response } from 'express';

import { CurrentUser, Public, Roles } from '../../common/decorators';
import { NewsletterCampaign, NewsletterSubscriber } from '../../common/types/domain';
import { AuthPrincipal } from '../../common/types/principal';
import { ActivityLogService } from '../../core/activity-log.service';
import { MailService, templates } from '../../core/mail.service';
import { DatabaseService } from '../../data/database.service';
import { campaignText, cleanCampaignHtml, csvCell } from './render';

const WEB_URL = (process.env.WEB_PUBLIC_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
const API_URL = (process.env.API_PUBLIC_URL ?? 'http://localhost:4000').replace(/\/+$/, '');
/** A confirmation email per address at most this often, so the form cannot mail-bomb anyone. */
const RESEND_MS = 10 * 60_000;
/** Sending pace: this many, then a pause. Well inside what an SMTP relay allows. */
const BATCH = 20;
const PAUSE_MS = 1_000;
const TOKEN = /^[A-Za-z0-9_-]{20,64}$/;

export const SOURCES = ['coming_soon', 'footer'] as const;

export class SubscribeDto {
  @IsEmail({}, { message: 'Enter a valid email address' })
  @MaxLength(254)
  email!: string;

  @IsOptional()
  @IsIn(SOURCES)
  source?: (typeof SOURCES)[number];

  /** Honeypot. Hidden from people; a bot that fills it is told it worked. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  website?: string;
}

export class TokenDto {
  @Matches(TOKEN, { message: 'That link is not valid.' })
  token!: string;
}

export class CampaignDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  subject!: string;

  @IsString()
  @MaxLength(200_000)
  html!: string;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const newToken = () => randomBytes(24).toString('base64url');

/**
 * The newsletter: double opt-in sign-ups from the website, and HTML campaigns
 * sent from the admin to confirmed subscribers only, each with its own
 * unsubscribe link and the one-click List-Unsubscribe headers mail providers
 * now expect.
 *
 * ponytail: sending runs in this process, in batches, recording how far it got
 * after each one so a restart resumes rather than starts over (at worst one
 * batch goes twice). One API container, one sender; move it to a queue if the
 * API is ever scaled out, and to a mailing provider past a few thousand
 * subscribers, where plain SMTP stops being the right tool.
 */
@Injectable()
export class NewsletterService implements OnApplicationBootstrap {
  private readonly logger = new Logger(NewsletterService.name);
  private readonly sending = new Set<string>();

  constructor(
    private readonly db: DatabaseService,
    private readonly mail: MailService,
    private readonly activity: ActivityLogService,
  ) {}

  /* ---- Public ---- */

  /**
   * Always answers the same way, whether the address is new, pending or
   * already confirmed, so the form cannot be used to find out who subscribes.
   */
  async subscribe(dto: SubscribeDto): Promise<void> {
    const email = dto.email.trim().toLowerCase();
    const now = new Date();
    const existing = await this.db.newsletterSubscribers.findFirstWhere({ email });
    if (existing?.status === 'confirmed') return;
    if (existing?.confirm_sent_at && now.getTime() - Date.parse(existing.confirm_sent_at) < RESEND_MS) return;

    const row = existing
      ? await this.db.newsletterSubscribers.update(existing.id, {
          status: 'pending',
          confirm_sent_at: now.toISOString(),
        })
      : await this.db.newsletterSubscribers.create({
          email,
          status: 'pending',
          token: newToken(),
          source: dto.source ?? null,
          created_at: now.toISOString(),
          confirm_sent_at: now.toISOString(),
          confirmed_at: null,
          unsubscribed_at: null,
        });
    if (!row) return;
    const link = `${WEB_URL}/newsletter/confirm?token=${row.token}`;
    const sent = await this.mail.send({ to: email, ...templates.newsletterConfirm(link) });
    if (!sent) this.logger.warn(`Newsletter sign-up ${row.id} saved, but its confirmation email did not go.`);
  }

  async confirm(token: string): Promise<{ status: 'confirmed' | 'unsubscribed' }> {
    const row = await this.byToken(token);
    // An old link from before they unsubscribed does not sign them back up.
    if (row.status === 'unsubscribed') return { status: 'unsubscribed' };
    if (row.status === 'pending') {
      await this.db.newsletterSubscribers.update(row.id, {
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
      });
    }
    return { status: 'confirmed' };
  }

  async unsubscribe(token: string): Promise<void> {
    const row = await this.byToken(token);
    if (row.status === 'unsubscribed') return;
    await this.db.newsletterSubscribers.update(row.id, {
      status: 'unsubscribed',
      unsubscribed_at: new Date().toISOString(),
    });
  }

  private async byToken(token: string): Promise<NewsletterSubscriber> {
    const row = TOKEN.test(token) ? await this.db.newsletterSubscribers.findFirstWhere({ token }) : null;
    if (!row) throw new NotFoundException('That link is not valid any more.');
    return row;
  }

  /* ---- Subscribers (admin) ---- */

  async subscribers(): Promise<Array<Omit<NewsletterSubscriber, 'token'>>> {
    const rows = await this.db.newsletterSubscribers.findAll();
    return rows
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map(({ token: _token, ...row }) => row);
  }

  async remove(principal: AuthPrincipal, id: string): Promise<void> {
    const row = await this.db.newsletterSubscribers.findById(id);
    if (!row) throw new NotFoundException('That subscriber is already gone.');
    await this.db.newsletterSubscribers.delete(id);
    await this.activity.record({
      principal,
      action: 'newsletter_subscriber_remove',
      targetTable: 'newsletter_subscribers',
      targetId: id,
    });
  }

  async csv(): Promise<string> {
    const rows = await this.subscribers();
    const lines = rows.map((row) =>
      [row.email, row.status, row.source, row.created_at, row.confirmed_at, row.unsubscribed_at].map(csvCell).join(','),
    );
    return ['email,status,source,signed_up,confirmed,unsubscribed', ...lines].join('\r\n') + '\r\n';
  }

  /* ---- Campaigns (admin) ---- */

  async campaigns(): Promise<NewsletterCampaign[]> {
    return (await this.db.newsletterCampaigns.findAll()).sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  async campaign(id: string): Promise<NewsletterCampaign> {
    const row = await this.db.newsletterCampaigns.findById(id);
    if (!row) throw new NotFoundException('That newsletter no longer exists.');
    return row;
  }

  async create(principal: AuthPrincipal, dto: CampaignDto): Promise<NewsletterCampaign> {
    const now = new Date().toISOString();
    return this.db.newsletterCampaigns.create({
      subject: dto.subject.trim(),
      html: cleanCampaignHtml(dto.html),
      status: 'draft',
      recipients: 0,
      sent_count: 0,
      failed_count: 0,
      cursor: null,
      created_by: principal.name,
      created_at: now,
      updated_at: now,
      sent_at: null,
    });
  }

  async update(id: string, dto: CampaignDto): Promise<NewsletterCampaign> {
    await this.draft(id);
    return (await this.db.newsletterCampaigns.update(id, {
      subject: dto.subject.trim(),
      html: cleanCampaignHtml(dto.html),
      updated_at: new Date().toISOString(),
    }))!;
  }

  async delete(id: string): Promise<void> {
    await this.draft(id);
    await this.db.newsletterCampaigns.delete(id);
  }

  /** Sends one copy to whoever is signed in, with a dummy unsubscribe link. */
  async sendTest(principal: AuthPrincipal, id: string): Promise<{ to: string }> {
    this.assertMail();
    const campaign = await this.campaign(id);
    const sent = await this.mail.send({
      to: principal.email,
      ...templates.newsletter(`[Test] ${campaign.subject}`, campaign.html, campaignText(campaign.html), `${WEB_URL}/newsletter/unsubscribe`),
    });
    if (!sent) throw new ServiceUnavailableException('The mail server refused the message. Check the API logs.');
    return { to: principal.email };
  }

  async send(principal: AuthPrincipal, id: string): Promise<NewsletterCampaign> {
    this.assertMail();
    const campaign = await this.draft(id);
    const recipients = await this.db.newsletterSubscribers.countWhere({ status: 'confirmed' });
    if (!recipients) throw new BadRequestException('Nobody has confirmed their subscription yet.');
    const updated = (await this.db.newsletterCampaigns.update(id, {
      status: 'sending',
      recipients,
      cursor: null,
      updated_at: new Date().toISOString(),
    }))!;
    await this.activity.record({
      principal,
      action: 'newsletter_send',
      targetTable: 'newsletter_campaigns',
      targetId: id,
      details: { subject: campaign.subject, recipients },
    });
    void this.run(id);
    return updated;
  }

  /** A campaign that was mid-send when the API stopped carries on. */
  async onApplicationBootstrap(): Promise<void> {
    // Never fatal: a newsletter that cannot resume must not keep the API down.
    try {
      const unfinished = await this.db.newsletterCampaigns.findWhere({ status: 'sending' });
      for (const row of unfinished) void this.run(row.id);
    } catch (error) {
      this.logger.error(`Could not resume newsletters: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async draft(id: string): Promise<NewsletterCampaign> {
    const row = await this.campaign(id);
    if (row.status !== 'draft') throw new BadRequestException('This newsletter has been sent, so it can no longer change.');
    return row;
  }

  private assertMail(): void {
    if (!this.mail.enabled) throw new ServiceUnavailableException('Email is not configured on the server (SMTP_HOST).');
  }

  private async run(id: string): Promise<void> {
    if (this.sending.has(id)) return;
    this.sending.add(id);
    try {
      for (;;) {
        const campaign = await this.db.newsletterCampaigns.findById(id);
        if (!campaign || campaign.status !== 'sending') return;
        // The next batch after the cursor, in id order: a stable place to
        // resume from, read through the (status, id) index.
        const batch = await this.db.newsletterSubscribers.findWhere(
          { status: 'confirmed', ...(campaign.cursor ? { id: { gt: campaign.cursor } } : {}) },
          { orderBy: { id: 'asc' }, take: BATCH },
        );
        if (!batch.length) {
          await this.db.newsletterCampaigns.update(id, {
            status: 'sent',
            sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          this.logger.log(`Newsletter "${campaign.subject}" sent: ${campaign.sent_count} delivered, ${campaign.failed_count} failed.`);
          return;
        }
        const text = campaignText(campaign.html);
        let sent = 0;
        for (const subscriber of batch) {
          const unsubscribe = `${WEB_URL}/newsletter/unsubscribe?token=${subscriber.token}`;
          const ok = await this.mail.send({
            to: subscriber.email,
            ...templates.newsletter(campaign.subject, campaign.html, text, unsubscribe),
            headers: {
              'List-Unsubscribe': `<${API_URL}/newsletter/unsubscribe?token=${subscriber.token}>`,
              'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
            },
          });
          if (ok) sent += 1;
        }
        await this.db.newsletterCampaigns.update(id, {
          cursor: batch[batch.length - 1]!.id,
          sent_count: campaign.sent_count + sent,
          failed_count: campaign.failed_count + batch.length - sent,
          updated_at: new Date().toISOString(),
        });
        await sleep(PAUSE_MS);
      }
    } catch (error) {
      this.logger.error(`Newsletter ${id} stopped: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.sending.delete(id);
    }
  }
}

/** Sign-up, confirm and unsubscribe: open to anyone, rate limited. */
@Controller('newsletter')
export class NewsletterPublicController {
  constructor(private readonly newsletter: NewsletterService) {}

  @Public()
  @Post()
  @HttpCode(202)
  @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
  async subscribe(@Body() dto: SubscribeDto) {
    if (!dto.website) await this.newsletter.subscribe(dto);
    return { ok: true };
  }

  @Public()
  @Post('confirm')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 15 * 60_000 } })
  confirm(@Body() dto: TokenDto) {
    return this.newsletter.confirm(dto.token);
  }

  /**
   * The website's unsubscribe page posts the token in the body; a mail
   * client's one-click button (RFC 8058) posts to the List-Unsubscribe URL,
   * so the token is in the query there.
   */
  @Public()
  @Post('unsubscribe')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 15 * 60_000 } })
  async unsubscribe(@Query('token') query: string | undefined, @Body() body: { token?: unknown } | undefined) {
    const token = typeof body?.token === 'string' ? body.token : (query ?? '');
    await this.newsletter.unsubscribe(token);
    return { ok: true };
  }
}

/** Settings › Newsletter. Admin only. */
@Controller('newsletter')
@Roles('Admin')
export class NewsletterAdminController {
  constructor(private readonly newsletter: NewsletterService) {}

  @Get('subscribers')
  subscribers() {
    return this.newsletter.subscribers();
  }

  @Get('subscribers.csv')
  @Header('content-type', 'text/csv; charset=utf-8')
  async csv(@Res({ passthrough: true }) res: Response) {
    res.setHeader('content-disposition', `attachment; filename="newsletter-subscribers-${new Date().toISOString().slice(0, 10)}.csv"`);
    return this.newsletter.csv();
  }

  @Delete('subscribers/:id')
  @HttpCode(204)
  remove(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string) {
    return this.newsletter.remove(principal, id);
  }

  @Get('campaigns')
  campaigns() {
    return this.newsletter.campaigns();
  }

  @Post('campaigns')
  create(@CurrentUser() principal: AuthPrincipal, @Body() dto: CampaignDto) {
    return this.newsletter.create(principal, dto);
  }

  @Get('campaigns/:id')
  campaign(@Param('id') id: string) {
    return this.newsletter.campaign(id);
  }

  @Put('campaigns/:id')
  update(@Param('id') id: string, @Body() dto: CampaignDto) {
    return this.newsletter.update(id, dto);
  }

  @Delete('campaigns/:id')
  @HttpCode(204)
  delete(@Param('id') id: string) {
    return this.newsletter.delete(id);
  }

  @Post('campaigns/:id/test')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 15 * 60_000 } })
  test(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string) {
    return this.newsletter.sendTest(principal, id);
  }

  @Post('campaigns/:id/send')
  @HttpCode(200)
  send(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string) {
    return this.newsletter.send(principal, id);
  }
}

@Module({
  controllers: [NewsletterPublicController, NewsletterAdminController],
  providers: [NewsletterService],
})
export class NewsletterModule {}
