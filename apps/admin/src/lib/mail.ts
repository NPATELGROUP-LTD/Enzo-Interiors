import type { Draft, MailAddress, MailMessage } from '../types/mail.ts';
import { dateTime } from './format.ts';

export const who = (a: MailAddress | null | undefined): string => (a ? (a.name ? `${a.name} <${a.email}>` : a.email) : 'Unknown sender');
export const shortWho = (a: MailAddress | null | undefined): string => a?.name || a?.email || 'Unknown sender';

/** Email addresses in whatever was typed or pasted ("Jo <jo@x.com>; kim@y.org"), as the bare list the API takes. */
export const addressesIn = (text: string): string[] => [...new Set(text.match(/[^\s<>,;"']+@[^\s<>,;"']+\.[^\s<>,;"']+/g) ?? [])];

const quoted = (text: string) => text.split('\n').map((line) => `> ${line}`).join('\n');
const prefixed = (prefix: 'Re' | 'Fwd', subject: string) => (new RegExp(`^${prefix}:`, 'i').test(subject.trim()) ? subject.trim() : `${prefix}: ${subject.trim()}`.trim());

/** A reply, reply-all or forward of `m`, for `me` (the signed-in Gmail address). Everything stays editable. */
export function draftFor(mode: 'reply' | 'reply_all' | 'forward', m: MailMessage, me: string): Draft {
  if (mode === 'forward') {
    const head = ['---------- Forwarded message ---------', `From: ${who(m.from)}`, `Date: ${dateTime(m.date)}`, `Subject: ${m.subject}`, `To: ${m.to.map(who).join(', ')}`];
    return { to: '', cc: '', bcc: '', subject: prefixed('Fwd', m.subject), body: `\n\n${head.join('\n')}\n\n${m.text}`, forwardId: m.id, forwardFiles: m.attachments };
  }
  const mine = (a: MailAddress) => a.email.toLowerCase() === me.toLowerCase();
  // Answering something you sent goes to the people you sent it to.
  const back = m.from && mine(m.from) ? m.to : [m.reply_to ?? m.from].filter((a): a is MailAddress => a !== null);
  const cc = mode === 'reply_all' ? [...m.to, ...m.cc].filter((a) => !mine(a) && !back.some((b) => b.email.toLowerCase() === a.email.toLowerCase())) : [];
  return {
    to: back.map((a) => a.email).join(', '),
    cc: cc.map((a) => a.email).join(', '),
    bcc: '',
    subject: prefixed('Re', m.subject),
    body: `\n\nOn ${dateTime(m.date)}, ${who(m.from)} wrote:\n${quoted(m.text)}`,
    replyToId: m.id,
  };
}

/** Remote pictures in a message: what "Load images" is about. */
export const hasRemoteImages = (html: string): boolean => /<img\b[^>]*\bsrc\s*=\s*["']?https?:/i.test(html) || /url\(\s*["']?https?:/i.test(html);

const BASE_CSS =
  'body{margin:0;padding:2px;font:14px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif;color:#1d1d1f;background:#fff;overflow-wrap:anywhere}' +
  'img{max-width:100%;height:auto}table{max-width:100%}blockquote{margin:0 0 0 4px;padding-left:12px;border-left:3px solid #d0d0d0;color:#555}a{color:#0b57d0}pre{white-space:pre-wrap}';

/**
 * The page inside the message frame. The frame is sandboxed with no scripts; this
 * policy says the same again, and lets pictures in only once the person asks.
 */
export function srcDoc(html: string, images: boolean): string {
  const policy = `default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src data:${images ? ' https: http:' : ''}`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${policy}"><base target="_blank"><style>${BASE_CSS}</style></head><body>${html}</body></html>`;
}
