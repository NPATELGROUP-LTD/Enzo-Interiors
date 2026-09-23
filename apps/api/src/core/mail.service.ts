import { Injectable, Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';

/** One outgoing message, already rendered. */
export interface Mail {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

/**
 * Outgoing email over SMTP.
 *
 * Any SMTP provider works (Postmark, SES, Resend, a Google Workspace relay);
 * dev points at the Mailpit container. With SMTP_HOST unset nothing is sent
 * and the API still boots: email is a feature, not a dependency of signing in.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transport: Transporter | null;
  private readonly from = process.env.MAIL_FROM ?? 'Enzo Interiors <no-reply@localhost>';

  constructor() {
    const host = process.env.SMTP_HOST;
    if (!host) {
      this.logger.warn('SMTP_HOST is unset, so no email will be sent (password resets, enquiries).');
      this.transport = null;
      return;
    }
    const user = process.env.SMTP_USER;
    this.transport = createTransport({
      host,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === 'true',
      ...(user ? { auth: { user, pass: process.env.SMTP_PASS ?? '' } } : {}),
    });
  }

  get enabled(): boolean {
    return this.transport !== null;
  }

  /** Sends, or logs why it could not. Never throws: callers have already done their real work. */
  async send(mail: Mail): Promise<boolean> {
    if (!this.transport) return false;
    try {
      await this.transport.sendMail({ from: this.from, ...mail });
      return true;
    } catch (error) {
      this.logger.error(
        `Could not send "${mail.subject}": ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Templates                                                                  */
/* -------------------------------------------------------------------------- */

const FOREST = '#102E2D';
const CREAM = '#F2F0EB';
const CHARCOAL = '#2C2C2C';
const SAGE = '#8A9E8C';

/** Every value that came from a person goes through this before it touches HTML. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** The branded shell: forest header with the white logo, cream body. Tables, because email. */
function layout(title: string, body: string): string {
  const base = (process.env.S3_PUBLIC_BASE_URL ?? '').replace(/\/+$/, '');
  const logo = base
    ? `<img src="${base}/site/logo-white.png" width="120" alt="Enzo Interiors" style="display:block;border:0;height:auto">`
    : `<span style="font:600 22px Georgia,serif;color:${CREAM}">Enzo Interiors</span>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:${CREAM}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM}"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden">
<tr><td style="background:${FOREST};padding:28px 32px">${logo}</td></tr>
<tr><td style="padding:32px;font:16px/1.6 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:${CHARCOAL}">${body}</td></tr>
<tr><td style="padding:20px 32px;border-top:1px solid #ECE9E2;font:12px/1.5 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:${SAGE}">Enzo Interiors · Bespoke fitted furniture, Leicester</td></tr>
</table></td></tr></table></body></html>`;
}

function button(href: string, label: string): string {
  return `<p style="margin:28px 0"><a href="${escapeHtml(href)}" style="display:inline-block;background:${FOREST};color:${CREAM};text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600">${escapeHtml(label)}</a></p>`;
}

type Rendered = Pick<Mail, 'subject' | 'html' | 'text'>;

export const templates = {
  passwordReset(name: string, link: string): Rendered {
    const subject = 'Reset your Enzo Interiors password';
    return {
      subject,
      html: layout(
        subject,
        `<p style="margin:0 0 16px">Hi ${escapeHtml(name)},</p>
<p style="margin:0 0 16px">Someone asked to reset the password for your Enzo Interiors account. If it was you, choose a new one below. The link works once and expires in 30 minutes.</p>
${button(link, 'Choose a new password')}
<p style="margin:0;color:#6B6B6B;font-size:14px">If you didn't ask for this, ignore this email. Your password stays as it is.</p>`,
      ),
      text: `Hi ${name},\n\nReset your Enzo Interiors password here (works once, expires in 30 minutes):\n${link}\n\nIf you didn't ask for this, ignore this email.`,
    };
  },

  passwordChanged(name: string, forgotUrl: string): Rendered {
    const subject = 'Your Enzo Interiors password was changed';
    return {
      subject,
      html: layout(
        subject,
        `<p style="margin:0 0 16px">Hi ${escapeHtml(name)},</p>
<p style="margin:0 0 16px">The password for your Enzo Interiors account was just changed, and every other device was signed out.</p>
<p style="margin:0 0 16px">If this wasn't you, reset it now and tell whoever runs the account.</p>
${button(forgotUrl, 'Reset my password')}`,
      ),
      text: `Hi ${name},\n\nThe password for your Enzo Interiors account was just changed and every other device was signed out.\n\nIf this wasn't you, reset it now: ${forgotUrl}`,
    };
  },

  enquiry(input: {
    kind: string;
    name: string;
    email: string;
    phone: string | null;
    message: string;
    details: Record<string, string> | null;
  }): Rendered {
    const label = { contact: 'Enquiry', quote: 'Quote request', booking: 'Consultation request' }[
      input.kind
    ] ?? 'Enquiry';
    const subject = `${label} from ${input.name}`;
    const rows: Array<[string, string]> = [
      ['Name', input.name],
      ['Email', input.email],
      ...(input.phone ? ([['Phone', input.phone]] as Array<[string, string]>) : []),
      ...Object.entries(input.details ?? {}),
    ];
    const table = rows
      .map(
        ([key, value]) =>
          `<tr><td style="padding:6px 16px 6px 0;color:#6B6B6B;vertical-align:top;white-space:nowrap">${escapeHtml(key)}</td><td style="padding:6px 0">${escapeHtml(value)}</td></tr>`,
      )
      .join('');
    return {
      subject,
      html: layout(
        subject,
        `<p style="margin:0 0 4px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:${SAGE}">${escapeHtml(label)}</p>
<h1 style="margin:0 0 20px;font:600 22px/1.3 Georgia,serif;color:${FOREST}">${escapeHtml(input.name)}</h1>
<table role="presentation" cellpadding="0" cellspacing="0" style="font-size:15px;margin:0 0 20px">${table}</table>
<div style="padding:16px 18px;background:${CREAM};border-radius:8px;white-space:pre-wrap">${escapeHtml(input.message)}</div>
<p style="margin:20px 0 0;color:#6B6B6B;font-size:14px">Reply to this email to answer ${escapeHtml(input.name)} directly.</p>`,
      ),
      text: `${label}\n\n${rows.map(([k, v]) => `${k}: ${v}`).join('\n')}\n\n${input.message}\n\nReply to this email to answer directly.`,
    };
  },

  test(): Rendered {
    const subject = 'Test email from Enzo Interiors';
    return {
      subject,
      html: layout(
        subject,
        `<p style="margin:0">This is a test. Enquiry notifications from the website will arrive at this address.</p>`,
      ),
      text: 'This is a test. Enquiry notifications from the website will arrive at this address.',
    };
  },
};
