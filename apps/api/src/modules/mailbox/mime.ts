import { randomUUID } from 'node:crypto';

import sanitizeHtml from 'sanitize-html';

import { campaignText, cleanCampaignHtml } from '../newsletter/render';

/**
 * Everything about mail that needs no network: reading Gmail's message JSON,
 * making a message safe to show, and writing one to send. No message content
 * is kept anywhere; these only reshape what is passed in.
 */

/* ---- Limits ---- */

export const MAX_SEND_BYTES = 25 * 1024 * 1024;
export const MAX_RECIPIENTS = 50;
/** What one message may put in a response. Longer is cut and flagged. */
export const MAX_HTML_CHARS = 1_000_000;
export const MAX_TEXT_CHARS = 200_000;

/* ---- Addresses and headers ---- */

export interface Address {
  name: string;
  email: string;
}

const EMAIL = /^[^\s<>()[\]\\,;:"@]+@[^\s<>()[\]\\,;:"@]+\.[^\s<>()[\]\\,;:"@]+$/;

export const isEmail = (value: string): boolean => value.length <= 254 && EMAIL.test(value);

/** Splits a header value at the commas that are not inside quotes or <angle brackets>. */
function splitList(value: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quoted = false;
  let start = 0;
  for (let i = 0; i < value.length; i++) {
    const c = value[i];
    if (c === '\\') i++;
    else if (c === '"') quoted = !quoted;
    else if (!quoted && c === '<') depth++;
    else if (!quoted && c === '>') depth = Math.max(0, depth - 1);
    else if (!quoted && depth === 0 && c === ',') {
      parts.push(value.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(value.slice(start));
  return parts.map((part) => part.trim()).filter(Boolean);
}

/** RFC 2047 "=?UTF-8?B?...?=" words back to text. Anything it cannot decode is left as it was. */
export function decodeWords(value: string): string {
  return value
    .replace(/(=\?[\w-]+\?[BbQq]\?[^?]*\?=)\s+(?==\?[\w-]+\?[BbQq]\?)/g, '$1')
    .replace(/=\?([\w-]+)\?([BbQq])\?([^?]*)\?=/g, (whole, charset: string, mode: string, text: string) => {
      try {
        const bytes =
          mode.toUpperCase() === 'B'
            ? Buffer.from(text, 'base64')
            : Buffer.from(text.replace(/_/g, ' ').replace(/=([0-9A-Fa-f]{2})/g, (_m, hex: string) => String.fromCharCode(parseInt(hex, 16))), 'latin1');
        return new TextDecoder(charset).decode(bytes);
      } catch {
        return whole;
      }
    });
}

/** "Jo Bloggs <jo@x.com>, other@y.com" as addresses. Entries with no usable address are dropped. */
export function parseAddresses(value: string | undefined): Address[] {
  if (!value) return [];
  const out: Address[] = [];
  for (const part of splitList(value)) {
    const angle = /^(.*?)<([^<>]+)>\s*$/.exec(part);
    const email = (angle ? angle[2]! : part).trim();
    if (!isEmail(email)) continue;
    const name = decodeWords(angle ? angle[1]!.trim().replace(/^"(.*)"$/, '$1').replace(/\\(.)/g, '$1') : '').trim();
    out.push({ name: name.slice(0, 200), email });
  }
  return out;
}

/** A header value that cannot carry a second header. */
export function safeHeader(value: string, max = 998): string {
  if (/[\r\n\0]/.test(value) || value.length > max) throw new Error('Not a usable header value');
  return value;
}

/** Non-ASCII text as RFC 2047 words (each under 75 characters), ASCII as it is. */
export function encodeWords(value: string): string {
  if (/^[\x20-\x7e]*$/.test(value)) return value;
  const words: string[] = [];
  let chunk = '';
  for (const char of value) {
    if (Buffer.byteLength(chunk + char) > 42) {
      words.push(chunk);
      chunk = '';
    }
    chunk += char;
  }
  if (chunk) words.push(chunk);
  return words.map((word) => `=?UTF-8?B?${Buffer.from(word).toString('base64')}?=`).join('\r\n ');
}

/* ---- Reading what Gmail sends ---- */

export interface GmailPart {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: Array<{ name: string; value: string }>;
  body?: { size?: number; data?: string; attachmentId?: string };
  parts?: GmailPart[];
}

export interface GmailMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: GmailPart;
}

export const header = (part: GmailPart | undefined, name: string): string | undefined =>
  part?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value;

export interface FoundAttachment {
  part_id: string;
  filename: string;
  mime: string;
  size: number;
  attachment_id: string;
}

export interface Found {
  text: GmailPart | null;
  html: GmailPart | null;
  attachments: FoundAttachment[];
  /** An image shown inside the message by cid: reference; not displayed, so say so. */
  inline_images: boolean;
}

/** Walks the MIME tree: the first plain and HTML bodies, and every named file. */
export function collect(payload: GmailPart | undefined): Found {
  const found: Found = { text: null, html: null, attachments: [], inline_images: false };
  const walk = (part: GmailPart, depth: number) => {
    if (depth > 12) return;
    const mime = (part.mimeType ?? '').toLowerCase();
    if (part.filename && part.body?.attachmentId) {
      found.attachments.push({
        part_id: part.partId ?? '',
        filename: part.filename.slice(0, 255),
        mime: mime || 'application/octet-stream',
        size: part.body.size ?? 0,
        attachment_id: part.body.attachmentId,
      });
      if (/^<.+>$/.test(header(part, 'Content-ID') ?? '') && mime.startsWith('image/')) found.inline_images = true;
    } else if (mime === 'text/plain' && !found.text) found.text = part;
    else if (mime === 'text/html' && !found.html) found.html = part;
    else if (!part.filename && mime.startsWith('image/') && /^<.+>$/.test(header(part, 'Content-ID') ?? '')) found.inline_images = true;
    for (const child of part.parts ?? []) walk(child, depth + 1);
  };
  if (payload) walk(payload, 0);
  return found;
}

export const decodeBody = (data: string | undefined): string => (data ? Buffer.from(data, 'base64url').toString('utf8') : '');

/** Mail from someone else, made safe to put in a sandboxed frame: no script, forms or javascript: links, links open in a new tab. */
export function cleanMailHtml(html: string): string {
  return cleanCampaignHtml(html, {
    transformTags: { a: sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noopener noreferrer nofollow' }) },
  });
}

export interface MailMessage {
  id: string;
  thread_id: string;
  from: Address | null;
  to: Address[];
  cc: Address[];
  reply_to: Address | null;
  subject: string;
  /** ISO time Gmail received it. */
  date: string;
  unread: boolean;
  /** Plain text, or the HTML turned to text when there is no plain part. */
  text: string;
  /** Sanitised; null when the message has no HTML part. */
  html: string | null;
  truncated: boolean;
  inline_images: boolean;
  attachments: Array<Omit<FoundAttachment, 'attachment_id'>>;
}

/** One Gmail message as the Mail page reads it. `bodies` are the decoded text and HTML parts. */
export function toMessage(message: GmailMessage, bodies: { text: string; html: string }, found: Found): MailMessage {
  const p = message.payload;
  const html = bodies.html ? cleanMailHtml(bodies.html.slice(0, MAX_HTML_CHARS)) : null;
  const text = bodies.text || (bodies.html ? campaignText(html ?? '') : '');
  const from = parseAddresses(header(p, 'From'))[0] ?? null;
  const replyTo = parseAddresses(header(p, 'Reply-To'))[0] ?? null;
  return {
    id: message.id,
    thread_id: message.threadId,
    from,
    to: parseAddresses(header(p, 'To')).slice(0, 100),
    cc: parseAddresses(header(p, 'Cc')).slice(0, 100),
    reply_to: replyTo,
    subject: decodeWords(header(p, 'Subject') ?? '').slice(0, 500),
    date: new Date(Number(message.internalDate) || 0).toISOString(),
    unread: message.labelIds?.includes('UNREAD') ?? false,
    text: text.slice(0, MAX_TEXT_CHARS),
    html,
    truncated: bodies.html.length > MAX_HTML_CHARS || bodies.text.length > MAX_TEXT_CHARS,
    inline_images: found.inline_images,
    attachments: found.attachments.map(({ attachment_id: _id, ...rest }) => rest),
  };
}

/* ---- Writing a message ---- */

export interface OutFile {
  filename: string;
  mime: string;
  content: Buffer;
}

export interface OutMessage {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  inReplyTo?: string;
  references?: string;
  attachments?: OutFile[];
}

const wrap64 = (data: Buffer): string => (data.toString('base64').match(/.{1,76}/g) ?? []).join('\r\n');
const MIME_TYPE = /^[A-Za-z0-9][\w.+-]*\/[A-Za-z0-9][\w.+-]*$/;

/** `name` as a quoted header parameter with an RFC 2231 twin for anything outside ASCII. */
export function fileParam(name: string, param = 'filename'): string {
  const clean = name.replace(/[\r\n\0]/g, ' ').replace(/[\\/]/g, '_').slice(0, 200) || 'file';
  const ascii = clean.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `${param}="${ascii}"; ${param}*=UTF-8''${encodeURIComponent(clean).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)}`;
}

/**
 * The RFC 5322 message to hand to Gmail. No From: Gmail writes the signed-in
 * address, so nobody can send as somebody else. Throws on a header that could
 * smuggle another one in; callers turn that into a 400.
 */
export function buildMime(out: OutMessage): Buffer {
  const lines = [
    `To: ${out.to.map((a) => safeHeader(a)).join(', ')}`,
    ...(out.cc?.length ? [`Cc: ${out.cc.map((a) => safeHeader(a)).join(', ')}`] : []),
    ...(out.bcc?.length ? [`Bcc: ${out.bcc.map((a) => safeHeader(a)).join(', ')}`] : []),
    `Subject: ${encodeWords(safeHeader(out.subject, 300))}`,
    ...(out.inReplyTo ? [`In-Reply-To: ${safeHeader(out.inReplyTo)}`] : []),
    ...(out.references ? [`References: ${safeHeader(out.references, 4000)}`] : []),
    'MIME-Version: 1.0',
  ];
  const text = out.body.replace(/\r?\n/g, '\r\n');
  const textPart = ['Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', wrap64(Buffer.from(text, 'utf8'))];
  if (!out.attachments?.length) return Buffer.from([...lines, ...textPart, ''].join('\r\n'), 'utf8');

  const boundary = `=_enzo_${randomUUID()}`;
  const parts: string[] = [`--${boundary}`, ...textPart];
  for (const file of out.attachments) {
    parts.push(
      `--${boundary}`,
      `Content-Type: ${MIME_TYPE.test(file.mime) ? file.mime : 'application/octet-stream'}; ${fileParam(file.filename, 'name')}`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; ${fileParam(file.filename)}`,
      '',
      wrap64(file.content),
    );
  }
  parts.push(`--${boundary}--`, '');
  return Buffer.from([...lines, `Content-Type: multipart/mixed; boundary="${boundary}"`, '', ...parts].join('\r\n'), 'utf8');
}

/** The domain of each address, once, in order: all that is ever logged about who was written to. */
export const domainsOf = (addresses: string[]): string[] => [...new Set(addresses.map((a) => a.slice(a.lastIndexOf('@') + 1).toLowerCase()))].slice(0, 10);
