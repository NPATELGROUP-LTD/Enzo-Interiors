import { createHash, randomBytes, randomUUID } from 'node:crypto';

import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { GmailAccount } from '../../common/types/domain';
import { AuthPrincipal } from '../../common/types/principal';
import { ActivityLogService } from '../../core/activity-log.service';
import { CacheService } from '../../core/cache';
import { open, seal } from '../../core/crypto';
import { RateLimitStore } from '../../core/rate-limit';
import { DatabaseService } from '../../data/database.service';
import { NotificationsService } from '../notifications/notifications.module';
import {
  GmailMessage,
  MAX_RECIPIENTS,
  MAX_SEND_BYTES,
  MailMessage,
  OutFile,
  buildMime,
  collect,
  decodeBody,
  decodeWords,
  domainsOf,
  header,
  isEmail,
  parseAddresses,
  toMessage,
} from './mime';

/**
 * Each staff member's own Gmail, read and written live through Google's API.
 *
 * Nothing about a message is stored or logged here: subjects, bodies, names
 * and addresses pass through to the response and are gone. What is stored is
 * the sealed refresh token (gmail_accounts); access tokens live in this
 * process's memory. Every method takes the *staff id* of the signed-in
 * caller and reads only that person's row, so there is no way to name
 * someone else's mailbox.
 */

export const MAIL_ROLES = ['Admin', 'Designer', 'Editor'] as const;
/** A Gmail message or thread id, and a MIME part id ("1.2"): all that is ever put in a Google URL. */
export const GMAIL_ID = /^[A-Za-z0-9_-]{1,64}$/;
export const PART_ID = /^\d{1,4}(\.\d{1,4}){0,8}$/;

const API = 'https://gmail.googleapis.com/gmail/v1/users/me';
const UPLOAD = 'https://gmail.googleapis.com/upload/gmail/v1/users/me/messages/send';
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
/** read, send and mark read/unread: gmail.modify covers all three and nothing more (it cannot delete for good). */
export const SCOPE = 'https://www.googleapis.com/auth/gmail.modify';
/**
 * Per person. A page of 25 threads is 26 calls, so this allows dozens of page loads a minute and still sits
 * well under Google's 250 quota units a second per user; it only stops a bug or a flood.
 */
const CALLS_PER_MINUTE = 1000;
const MAX_THREAD_MESSAGES = 50;
/** Across one thread's response: past this the older messages come without their HTML. */
const THREAD_CHARS = 4_000_000;
const MAX_BODY_FETCH = 2_000_000;

const timeout = (ms = 15_000) => AbortSignal.timeout(ms);

/** What Google returned, waiting for the person who started the link to finish it. The token is sealed even in the cache. */
interface PendingLink {
  staff: string;
  tv: number;
  email: string;
  token: string;
  scope: string;
}
const pendingKey = (handoff: string) => `mailbox-connect:${createHash('sha256').update(handoff).digest('hex')}`;

export interface ThreadRow {
  id: string;
  subject: string;
  from: { name: string; email: string } | null;
  to: Array<{ name: string; email: string }>;
  snippet: string;
  date: string;
  count: number;
  unread: boolean;
}

export interface SendInput {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  /** Plain text. */
  body: string;
  /** A Message-ID header, with the angle brackets. */
  inReplyTo?: string;
  /** The earlier Message-IDs of the conversation, space separated. */
  references?: string;
  threadId?: string;
  attachments?: OutFile[];
}

export interface SendForm {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
  reply_to_id?: string;
  forward_id?: string;
  forward_parts?: string;
}

/** `items` mapped with at most `limit` running at once, in order. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]!);
      }
    }),
  );
  return out;
}

const addressList = (value: string | string[] | undefined): string[] =>
  (Array.isArray(value) ? value : (value ?? '').split(','))
    .map((a) => a.trim())
    .filter(Boolean);

@Injectable()
export class GmailService {
  private readonly logger = new Logger(GmailService.name);
  private readonly adminUrl = (process.env.ADMIN_URL ?? 'http://localhost:5174').replace(/\/+$/, '');
  private readonly tokens = new Map<string, { value: string; expires: number }>();
  private readonly refreshing = new Map<string, Promise<string>>();

  constructor(
    private readonly db: DatabaseService,
    private readonly limits: RateLimitStore,
    private readonly jwt: JwtService,
    private readonly activity: ActivityLogService,
    private readonly notifications: NotificationsService,
    private readonly cache: CacheService,
  ) {}

  /** Mail stays hidden until Google's keys, this redirect address and the key that seals tokens are set. */
  configured(): boolean {
    return Boolean(
      process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_GMAIL_REDIRECT_URI && process.env.APP_ENCRYPTION_KEY,
    );
  }

  async status(staffId: string) {
    const row = await this.db.gmailAccounts.findFirstWhere({ staff_id: staffId });
    return {
      configured: this.configured(),
      connected: Boolean(row),
      email: row?.google_email ?? null,
      needs_reconnect: row?.needs_reconnect ?? false,
    };
  }

  /* ---- Connecting ---- */

  async connectUrl(principal: AuthPrincipal): Promise<{ url: string }> {
    if (!this.configured()) throw new BadRequestException('Mail is not set up on this server.');
    const staff = await this.db.staffUsers.findById(principal.id);
    // The nonce is spent once in callback; the token version voids the link if the password changes meanwhile.
    const state = await this.jwt.signAsync({ purpose: 'mailbox', staff: principal.id, tv: staff?.token_version, nonce: randomUUID() }, { expiresIn: '10m' });
    return {
      url:
        `${AUTH_URL}?` +
        new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID!,
          redirect_uri: process.env.GOOGLE_GMAIL_REDIRECT_URI!,
          response_type: 'code',
          scope: `${SCOPE} openid email`,
          access_type: 'offline',
          // Without this Google only sends a refresh token the first time ever.
          prompt: 'consent select_account',
          state,
        }),
    };
  }

  /**
   * Google sends the browser back here with no Enzo session, so this cannot say whose browser it is: anyone
   * could be holding a link that someone else started. It therefore links nothing. It checks what Google
   * sent and parks it, sealed, under a one-time code that goes to the admin in the address; `complete` links
   * it only for the signed-in person who started the flow. Returns the code, or null on any failure.
   */
  async callback(code: string, state: string): Promise<string | null> {
    try {
      const claims = await this.jwt.verifyAsync<{ purpose?: string; staff?: string; tv?: number; nonce?: string }>(state);
      if (claims.purpose !== 'mailbox' || !claims.staff || !claims.nonce) throw new Error('Not a mailbox state');
      if ((await this.limits.hit(`mailbox:state:${claims.nonce}`, 10 * 60_000)) > 1) throw new Error('State already used');
      const staff = await this.db.staffUsers.findById(claims.staff);
      if (!staff || !(MAIL_ROLES as readonly string[]).includes(staff.role) || staff.token_version !== claims.tv || !this.configured()) {
        throw new Error('Not someone who may connect a mailbox');
      }

      const res = await fetch(TOKEN_URL, {
        method: 'POST',
        signal: timeout(),
        body: new URLSearchParams({
          code,
          client_id: process.env.GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
          redirect_uri: process.env.GOOGLE_GMAIL_REDIRECT_URI!,
          grant_type: 'authorization_code',
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { refresh_token?: string; id_token?: string; scope?: string };
      if (!res.ok || !body.refresh_token || !body.id_token) throw new Error(`Google refused the code (${res.status})`);
      // Google lets people untick what they grant.
      if (!body.scope?.split(' ').includes(SCOPE)) throw new Error('Gmail access was not granted');

      // Straight from Google over TLS, so the claims are read, not the signature.
      const id = JSON.parse(Buffer.from(body.id_token.split('.')[1] ?? '', 'base64url').toString()) as {
        aud?: string; iss?: string; exp?: number; email?: string; email_verified?: boolean;
      };
      if (
        id.aud !== process.env.GOOGLE_CLIENT_ID ||
        !['https://accounts.google.com', 'accounts.google.com'].includes(id.iss ?? '') ||
        (id.exp ?? 0) * 1000 < Date.now() ||
        id.email_verified !== true ||
        !id.email
      ) {
        throw new Error('Google sent an ID token that does not check out');
      }

      const handoff = randomBytes(32).toString('base64url');
      const pending: PendingLink = { staff: staff.id, tv: staff.token_version, email: id.email, token: seal(body.refresh_token), scope: body.scope };
      await this.cache.set(pendingKey(handoff), pending, 5 * 60_000);
      return handoff;
    } catch (error) {
      this.logger.warn(`Gmail connect failed: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  /** The signed-in person finishes a link they started (POST /mailbox/connect/complete). Single use; anyone else's attempt burns it. */
  async complete(principal: AuthPrincipal, handoff: string): Promise<void> {
    const key = pendingKey(handoff);
    const expired = new BadRequestException('That connection has expired. Connect your Gmail again.');
    const pending = await this.cache.get<PendingLink>(key);
    if (!pending) throw expired;
    // hit() is atomic in Redis: of two requests racing with one code, only one sees 1.
    if ((await this.limits.hit(key, 5 * 60_000)) !== 1) throw expired;
    await this.cache.del(key);
    if (pending.staff !== principal.id) throw new ForbiddenException('That link was started by someone else, so nothing was connected.');
    const staff = await this.db.staffUsers.findById(principal.id);
    if (!staff || !(MAIL_ROLES as readonly string[]).includes(staff.role) || staff.token_version !== pending.tv || !this.configured()) throw expired;

    const now = new Date().toISOString();
    const data = { google_email: pending.email, refresh_token_enc: pending.token, scopes: pending.scope, connected_at: now, needs_reconnect: false, updated_at: now };
    const existing = await this.db.gmailAccounts.findFirstWhere({ staff_id: staff.id });
    if (existing) await this.db.gmailAccounts.update(existing.id, data);
    else {
      // Two tabs finishing at once: the unique index on staff_id lets one create, the other updates it.
      await this.db.gmailAccounts.create({ staff_id: staff.id, created_at: now, ...data }).catch(async (error) => {
        const won = await this.db.gmailAccounts.findFirstWhere({ staff_id: staff.id });
        if (!won) throw error;
        await this.db.gmailAccounts.update(won.id, data);
      });
    }
    this.tokens.delete(staff.id);
    await this.activity.record({ principal, action: 'mail_connect', targetTable: 'gmail_accounts', targetId: staff.id, details: { email: pending.email } });
  }

  async disconnect(principal: AuthPrincipal): Promise<void> {
    const row = await this.db.gmailAccounts.findFirstWhere({ staff_id: principal.id });
    if (!row) return;
    try {
      await fetch('https://oauth2.googleapis.com/revoke', { method: 'POST', signal: timeout(), body: new URLSearchParams({ token: open(row.refresh_token_enc) }) });
    } catch (error) {
      // Still disconnect: it can also be removed in their Google account.
      this.logger.warn(`Could not revoke Google's access: ${error instanceof Error ? error.message : String(error)}`);
    }
    await this.db.gmailAccounts.delete(row.id);
    this.tokens.delete(principal.id);
    await this.activity.record({ principal, action: 'mail_disconnect', targetTable: 'gmail_accounts', targetId: principal.id, details: { email: row.google_email } });
  }

  /* ---- Reading ---- */

  async list(staffId: string, query: { folder?: 'inbox' | 'sent'; q?: string; with?: string; page?: string; limit?: number }) {
    const acct = await this.account(staffId);
    const params = new URLSearchParams({ maxResults: String(query.limit ?? 25) });
    // A search covers all mail; Inbox and Sent are the two folders.
    if (query.folder) params.append('labelIds', query.folder === 'sent' ? 'SENT' : 'INBOX');
    const search = [query.q?.trim(), query.with && `(from:${query.with} OR to:${query.with} OR cc:${query.with} OR bcc:${query.with})`].filter(Boolean).join(' ');
    if (search) params.set('q', search);
    if (query.page) params.set('pageToken', query.page);

    const found = (await (await this.call(acct, 'GET', `${API}/threads`, { query: params })).json()) as {
      threads?: Array<{ id: string; snippet?: string }>;
      nextPageToken?: string;
    };
    const label = query.folder === 'sent' ? 'SENT' : query.folder === 'inbox' ? 'INBOX' : undefined;
    const rows = await mapLimit(found.threads ?? [], 6, (thread) => this.row(acct, thread, label));
    return { items: rows.filter((row): row is ThreadRow => row !== null), next_page: found.nextPageToken ?? null };
  }

  /** One list row. In a folder it shows the latest message that is in that folder (a thread can hold both sides). */
  private async row(acct: GmailAccount, thread: { id: string; snippet?: string }, label?: string): Promise<ThreadRow | null> {
    const params = new URLSearchParams({ format: 'metadata', fields: 'id,messages(id,labelIds,internalDate,payload/headers)' });
    for (const name of ['From', 'To', 'Subject']) params.append('metadataHeaders', name);
    try {
      const body = (await (await this.call(acct, 'GET', `${API}/threads/${thread.id}`, { query: params })).json()) as { messages?: GmailMessage[] };
      const messages = body.messages ?? [];
      const first = messages[0];
      const last = messages[messages.length - 1];
      if (!first || !last) return null;
      const shown = (label && [...messages].reverse().find((m) => m.labelIds?.includes(label))) || last;
      return {
        id: thread.id,
        subject: decodeWords(header(first.payload, 'Subject') ?? '').slice(0, 300),
        from: parseAddresses(header(shown.payload, 'From'))[0] ?? null,
        to: parseAddresses(header(shown.payload, 'To')).slice(0, 3),
        snippet: (thread.snippet ?? '').slice(0, 200),
        date: new Date(Number(shown.internalDate) || 0).toISOString(),
        count: messages.length,
        unread: messages.some((m) => m.labelIds?.includes('UNREAD')),
      };
    } catch (error) {
      // Gone since the list was made: leave the row out rather than fail the page.
      if (error instanceof NotFoundException) return null;
      throw error;
    }
  }

  async thread(staffId: string, threadId: string): Promise<{ id: string; subject: string; messages: MailMessage[] }> {
    const acct = await this.account(staffId);
    const body = (await (await this.call(acct, 'GET', `${API}/threads/${threadId}`, { query: new URLSearchParams({ format: 'full' }) })).json()) as {
      id: string;
      messages?: GmailMessage[];
    };
    const messages = await mapLimit((body.messages ?? []).slice(-MAX_THREAD_MESSAGES), 4, (message) => this.message(acct, message));
    // Newest first: when the thread is huge, it is the old messages that lose their HTML.
    let budget = THREAD_CHARS;
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i]!;
      const size = (m.html?.length ?? 0) + m.text.length;
      if (size > budget) Object.assign(m, { html: null, text: m.text.slice(0, Math.max(0, budget)), truncated: true });
      budget = Math.max(0, budget - size);
    }
    return { id: body.id, subject: messages[0]?.subject ?? '', messages };
  }

  private async message(acct: GmailAccount, message: GmailMessage): Promise<MailMessage> {
    const found = collect(message.payload);
    const [text, html] = await Promise.all([this.partText(acct, message.id, found.text), this.partText(acct, message.id, found.html)]);
    const out = toMessage(message, { text: text.value, html: html.value }, found);
    if (text.cut || html.cut) out.truncated = true;
    return out;
  }

  /** A body part's text; a long one comes as an attachment, fetched unless it is huge. */
  private async partText(acct: GmailAccount, messageId: string, part: { body?: { size?: number; data?: string; attachmentId?: string } } | null): Promise<{ value: string; cut: boolean }> {
    if (!part?.body) return { value: '', cut: false };
    if (part.body.data) return { value: decodeBody(part.body.data), cut: false };
    if (!part.body.attachmentId) return { value: '', cut: false };
    if ((part.body.size ?? 0) > MAX_BODY_FETCH) return { value: '', cut: true };
    const data = (await (await this.call(acct, 'GET', `${API}/messages/${messageId}/attachments/${part.body.attachmentId}`)).json()) as { data?: string };
    return { value: decodeBody(data.data), cut: false };
  }

  async setRead(staffId: string, threadId: string, read: boolean): Promise<void> {
    const acct = await this.account(staffId);
    await this.call(acct, 'POST', `${API}/threads/${threadId}/modify`, {
      body: Buffer.from(JSON.stringify(read ? { removeLabelIds: ['UNREAD'] } : { addLabelIds: ['UNREAD'] })),
      contentType: 'application/json',
    });
  }

  /** One attachment's bytes. Refuses before downloading when the file is over the 25 MB limit. */
  async attachment(staffId: string, messageId: string, partId: string): Promise<OutFile> {
    return this.attachmentOf(await this.account(staffId), messageId, partId);
  }

  private async attachmentOf(acct: GmailAccount, messageId: string, partId: string): Promise<OutFile> {
    const message = (await (await this.call(acct, 'GET', `${API}/messages/${messageId}`, { query: new URLSearchParams({ format: 'full' }) })).json()) as GmailMessage;
    const file = collect(message.payload).attachments.find((a) => a.part_id === partId);
    if (!file) throw new NotFoundException('That attachment is no longer on the message.');
    if (file.size > MAX_SEND_BYTES) throw new PayloadTooLargeException('That attachment is over 25 MB. Open it in Gmail.');
    const data = (await (await this.call(acct, 'GET', `${API}/messages/${messageId}/attachments/${file.attachment_id}`)).json()) as { data?: string };
    const content = Buffer.from(data.data ?? '', 'base64url');
    if (content.length > MAX_SEND_BYTES) throw new PayloadTooLargeException('That attachment is over 25 MB. Open it in Gmail.');
    return { filename: file.filename, mime: file.mime, content };
  }

  /* ---- Sending ---- */

  /**
   * The route's send: works out the reply's threading and the forward's
   * attachments from Gmail itself (never from what the browser claims), then
   * sends through sendAs.
   */
  async send(staffId: string, form: SendForm, uploads: OutFile[]): Promise<{ id: string; threadId: string }> {
    const acct = await this.account(staffId);
    const input: SendInput = { to: form.to, cc: form.cc, bcc: form.bcc, subject: form.subject, body: form.body, attachments: [...uploads] };
    if (form.reply_to_id) {
      const params = new URLSearchParams({ format: 'metadata', fields: 'id,threadId,payload/headers' });
      for (const name of ['Message-ID', 'References']) params.append('metadataHeaders', name);
      const original = (await (await this.call(acct, 'GET', `${API}/messages/${form.reply_to_id}`, { query: params })).json()) as GmailMessage;
      const messageId = header(original.payload, 'Message-ID')?.trim();
      if (messageId) {
        input.inReplyTo = messageId;
        // Only well-formed <id> tokens: old clients write bare ids, which would make the reply fail validation.
        input.references = `${header(original.payload, 'References') ?? ''} ${messageId}`
          .split(/\s+/)
          .filter((id) => /^<[^<>\s]{1,300}>$/.test(id))
          .slice(-20)
          .join(' ');
      }
      input.threadId = original.threadId;
    }
    if (form.forward_id) {
      for (const part of (form.forward_parts ?? '').split(',').map((p) => p.trim()).filter(Boolean).slice(0, 20)) {
        if (!PART_ID.test(part)) throw new BadRequestException('Not a valid attachment.');
        input.attachments!.push(await this.attachmentOf(acct, form.forward_id, part));
      }
    }
    return this.sendAs(staffId, input);
  }

  /**
   * The one way anything in the platform sends mail as a person (the Mail page
   * today, enquiry replies later). Sent from that person's own linked Gmail,
   * so it lands in their Sent folder and threads with the rest of the
   * conversation. Records that mail went out and to which domains; never the
   * subject, body or addresses.
   */
  async sendAs(staffId: string, input: SendInput): Promise<{ id: string; threadId: string }> {
    const acct = await this.account(staffId);
    const to = addressList(input.to);
    const cc = addressList(input.cc);
    const bcc = addressList(input.bcc);
    const everyone = [...to, ...cc, ...bcc];
    if (to.length === 0) throw new BadRequestException('Add at least one recipient.');
    if (everyone.length > MAX_RECIPIENTS) throw new BadRequestException(`Send to at most ${MAX_RECIPIENTS} people at once.`);
    const bad = everyone.find((a) => !isEmail(a));
    if (bad !== undefined) throw new BadRequestException('One of the addresses is not a valid email address.');
    if (input.threadId && !GMAIL_ID.test(input.threadId)) throw new BadRequestException('Not a valid conversation.');
    if (input.inReplyTo && !/^<[^<>\s]{1,300}>$/.test(input.inReplyTo)) throw new BadRequestException('Not a valid reply.');
    if (input.references && !/^(<[^<>\s]{1,300}>\s?){1,20}$/.test(input.references)) throw new BadRequestException('Not a valid reply.');
    if (input.body.length > 1_000_000) throw new PayloadTooLargeException('That message is too long.');
    const files = input.attachments ?? [];
    if (files.reduce((sum, f) => sum + f.content.length, 0) > MAX_SEND_BYTES) throw new PayloadTooLargeException('Attachments can be 25 MB in all.');

    let mime: Buffer;
    try {
      mime = buildMime({ to, cc, bcc, subject: input.subject, body: input.body, inReplyTo: input.inReplyTo, references: input.references, attachments: files });
    } catch {
      throw new BadRequestException('The subject or an address has characters email cannot carry.');
    }
    // threadId can only ride in the JSON half of a multipart upload.
    const boundary = `enzo_${randomUUID()}`;
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(input.threadId ? { threadId: input.threadId } : {})}\r\n--${boundary}\r\nContent-Type: message/rfc822\r\n\r\n`),
      mime,
      Buffer.from(`\r\n--${boundary}--`),
    ]);
    const sent = (await (await this.call(acct, 'POST', UPLOAD, { query: new URLSearchParams({ uploadType: 'multipart' }), body, contentType: `multipart/related; boundary=${boundary}`, timeoutMs: 60_000 })).json()) as {
      id: string;
      threadId: string;
    };

    const staff = await this.db.staffUsers.findById(staffId);
    if (staff) {
      await this.activity.record({
        principal: { id: staff.id, kind: 'Staff', role: staff.role, name: staff.name, email: staff.email },
        action: 'mail_send',
        targetTable: 'gmail_accounts',
        targetId: acct.id,
        details: { to_domains: domainsOf(everyone), recipients: everyone.length, attachments: files.length },
      });
    }
    return { id: sent.id, threadId: sent.threadId };
  }

  /* ---- Talking to Google ---- */

  /** This person's linked mailbox, if they may have one and it still works. */
  private async account(staffId: string): Promise<GmailAccount> {
    if (!this.configured()) throw new BadRequestException('Mail is not set up on this server.');
    const staff = await this.db.staffUsers.findById(staffId);
    if (!staff || !(MAIL_ROLES as readonly string[]).includes(staff.role)) throw new ForbiddenException('Your account does not have access to this.');
    const row = await this.db.gmailAccounts.findFirstWhere({ staff_id: staffId });
    if (!row) throw new ConflictException('Connect your Gmail first.');
    if (row.needs_reconnect) throw new ConflictException('Reconnect your Gmail to use Mail again.');
    return row;
  }

  private async call(
    acct: GmailAccount,
    method: 'GET' | 'POST',
    url: string,
    options: { query?: URLSearchParams; body?: Buffer; contentType?: string; timeoutMs?: number } = {},
  ): Promise<Response> {
    if ((await this.limits.hit(`gmail:${acct.staff_id}`, 60_000)) > CALLS_PER_MINUTE) {
      throw new HttpException('Mail is being used too fast. Wait a minute and try again.', 429);
    }
    const target = options.query ? `${url}?${options.query}` : url;
    for (let attempt = 0; attempt < 2; attempt++) {
      let res: Response;
      try {
        res = await fetch(target, {
          method,
          signal: timeout(options.timeoutMs),
          headers: { authorization: `Bearer ${await this.accessToken(acct)}`, ...(options.contentType ? { 'content-type': options.contentType } : {}) },
          body: options.body,
        });
      } catch (error) {
        if (error instanceof HttpException) throw error;
        this.logger.warn(`Gmail did not answer ${method}: ${error instanceof Error ? error.name : 'error'}`);
        throw new BadGatewayException('Gmail did not answer in time. Try again in a moment.');
      }
      if (res.ok) return res;
      if (res.status === 401) {
        this.tokens.delete(acct.staff_id);
        if (attempt === 0) continue;
        await this.revoked(acct);
        throw new ConflictException('Reconnect your Gmail to use Mail again.');
      }
      // Status only: a Google error body can echo what was asked for.
      this.logger.warn(`Gmail answered ${res.status} to ${method} ${url.replace(API, '').replace(/\/[A-Za-z0-9_-]{12,}/g, '/:id')}`);
      if (res.status === 404) throw new NotFoundException('That message is no longer in your mailbox.');
      if (res.status === 429) throw new HttpException('Gmail is busy. Wait a minute and try again.', 429);
      if (res.status === 413) throw new PayloadTooLargeException('Gmail refused that message as too large.');
      if (res.status === 400) throw new BadRequestException('Gmail did not accept that.');
      throw new BadGatewayException('Gmail refused the request. Try again in a moment.');
    }
    throw new BadGatewayException('Gmail did not answer. Try again in a moment.');
  }

  private accessToken(acct: GmailAccount): Promise<string> {
    const hit = this.tokens.get(acct.staff_id);
    if (hit && hit.expires - 60_000 > Date.now()) return Promise.resolve(hit.value);
    let pending = this.refreshing.get(acct.staff_id);
    if (!pending) {
      pending = this.refresh(acct).finally(() => this.refreshing.delete(acct.staff_id));
      this.refreshing.set(acct.staff_id, pending);
    }
    return pending;
  }

  private async refresh(acct: GmailAccount): Promise<string> {
    let refreshToken: string;
    try {
      refreshToken = open(acct.refresh_token_enc);
    } catch {
      // Sealed with a key we no longer have: the same as revoked.
      await this.revoked(acct);
      throw new ConflictException('Reconnect your Gmail to use Mail again.');
    }
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      signal: timeout(),
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    }).catch(() => null);
    const body = (await res?.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string } | undefined;
    if (body?.error === 'invalid_grant') {
      await this.revoked(acct);
      throw new ConflictException('Reconnect your Gmail to use Mail again.');
    }
    if (!res?.ok || !body?.access_token) throw new BadGatewayException('Gmail did not answer. Try again in a moment.');
    this.tokens.set(acct.staff_id, { value: body.access_token, expires: Date.now() + (body.expires_in ?? 3600) * 1000 });
    return body.access_token;
  }

  /** Google no longer accepts the token (revoked, or the password changed). Said once, then Mail waits for a reconnect. */
  private async revoked(acct: GmailAccount): Promise<void> {
    this.tokens.delete(acct.staff_id);
    const flipped = await this.db.gmailAccounts.updateWhere({ id: acct.id, needs_reconnect: false }, { needs_reconnect: true, updated_at: new Date().toISOString() });
    if (flipped > 0) {
      await this.notifications.notify(acct.staff_id, {
        kind: 'message',
        title: 'Gmail needs reconnecting',
        body: 'Mail is paused until you connect your Gmail again.',
        link: '/mail',
      });
    }
  }
}
