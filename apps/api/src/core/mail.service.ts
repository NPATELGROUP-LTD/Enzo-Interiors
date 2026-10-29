import { Injectable, Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';

/** One outgoing message, already rendered. */
export interface Mail {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  /** Sender, when not the default MAIL_FROM (alerts come from ALERT_FROM). */
  from?: string;
  /** Extra headers, e.g. List-Unsubscribe on a newsletter. */
  headers?: Record<string, string>;
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
  /** Told when a send fails; the alert service sets it. Never called for an alert's own mail. */
  onFailure?: (mail: Mail, message: string) => void;

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
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Could not send "${mail.subject}": ${message}`);
      if (!mail.from) this.onFailure?.(mail, message);
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
function layout(title: string, body: string, footer = 'Enzo Interiors · Bespoke fitted furniture, Leicester'): string {
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
<tr><td style="padding:20px 32px;border-top:1px solid #ECE9E2;font:12px/1.5 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:${SAGE}">${footer}</td></tr>
</table></td></tr></table></body></html>`;
}

function button(href: string, label: string): string {
  return `<p style="margin:28px 0"><a href="${escapeHtml(href)}" style="display:inline-block;background:${FOREST};color:${CREAM};text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600">${escapeHtml(label)}</a></p>`;
}

type Rendered = Pick<Mail, 'subject' | 'html' | 'text'>;

function detailRows(rows: Array<[string, string]>): string {
  return rows
    .map(
      ([key, value]) =>
        `<tr><td style="padding:6px 16px 6px 0;color:#6B6B6B;vertical-align:top;white-space:nowrap">${escapeHtml(key)}</td><td style="padding:6px 0">${escapeHtml(value)}</td></tr>`,
    )
    .join('');
}

function table(rows: Array<[string, string]>): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="font-size:15px;margin:0 0 20px">${detailRows(rows)}</table>`;
}

function heading(eyebrow: string, title: string): string {
  return `<p style="margin:0 0 4px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:${SAGE}">${escapeHtml(eyebrow)}</p>
<h1 style="margin:0 0 20px;font:600 22px/1.3 Georgia,serif;color:${FOREST}">${escapeHtml(title)}</h1>`;
}

const para = (text: string) => `<p style="margin:0 0 16px">${escapeHtml(text)}</p>`;
/** Blank lines make paragraphs, single ones <br>: Outlook for Windows ignores white-space:pre-wrap. */
const replyParagraphs = (text: string) =>
  text
    .trim()
    .split(/\r?\n[ \t]*\r?\n/)
    .map((block) => para(block).replace(/\r?\n/g, '<br>'))
    .join('\n');
const plain = (rows: Array<[string, string]>) => rows.map(([k, v]) => `${k}: ${v}`).join('\n');

/** A consultation as the emails describe it. `when` is already in studio time. */
export interface BookingMail {
  reference: string;
  name: string;
  email: string;
  phone: string | null;
  service: string;
  when: string;
  address: string | null;
  postcode: string | null;
  notes: string | null;
  details: Record<string, string> | null;
}

function bookingRows(b: BookingMail, full: boolean): Array<[string, string]> {
  const rows: Array<[string, string]> = [
    ['When', b.when],
    ['Consultation', b.service],
    ['Reference', b.reference],
  ];
  if (!full) return rows;
  const optional: Array<[string, string | null]> = [
    ['Name', b.name],
    ['Email', b.email],
    ['Phone', b.phone],
    ['Address', b.address],
    ['Postcode', b.postcode],
    ...Object.entries(b.details ?? {}),
    ['Notes', b.notes],
  ];
  return [...rows, ...(optional.filter(([, v]) => v) as Array<[string, string]>)];
}

export const templates = {
  /** To the people who run the platform: something broke, or someone should look. Plain on purpose. */
  alert(subject: string, rows: Array<[string, string]>): Rendered {
    return {
      subject,
      html: layout(subject, `${heading('Alert', subject.replace(/^(\[[^\]]*\])+\s*/, ''))}${table(rows)}`, 'Sent by the Enzo Interiors platform. Change who receives these under Settings › Alerts.'),
      text: `${subject}

${plain(rows)}`,
    };
  },

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

  /** The code is in the body only: subjects show on lock screens. */
  loginCode(name: string, code: string): Rendered {
    const subject = 'Your Enzo sign-in code';
    return {
      subject,
      html: layout(
        subject,
        `<p style="margin:0 0 16px">Hi ${escapeHtml(name)},</p>
${para('Enter this code to finish signing in to Enzo Interiors. It expires in 10 minutes.')}
<p style="margin:0 0 20px;font:600 30px/1.2 Menlo,Consolas,monospace;letter-spacing:.2em;color:${FOREST}">${escapeHtml(code)}</p>
<p style="margin:0;color:#6B6B6B;font-size:14px">If you weren't signing in, someone has your password: change it now.</p>`,
      ),
      text: `Hi ${name},\n\nYour Enzo Interiors sign-in code is ${code}. It expires in 10 minutes.\n\nIf you weren't signing in, someone has your password: change it now.`,
    };
  },

  /** Something changed how the account signs in (Google linked, app added, codes guessed). */
  securityNotice(name: string, subject: string, message: string, forgotUrl: string): Rendered {
    return {
      subject,
      html: layout(
        subject,
        `<p style="margin:0 0 16px">Hi ${escapeHtml(name)},</p>
${para(message)}
${para("If this wasn't you, reset your password now and tell whoever runs the account.")}
${button(forgotUrl, 'Reset my password')}`,
      ),
      text: `Hi ${name},\n\n${message}\n\nIf this wasn't you, reset your password now: ${forgotUrl}`,
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
    const table = detailRows(rows);
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

  /**
   * To whoever sent the contact form. Generic on purpose: it never repeats what they typed,
   * so the form cannot be used to mail someone else a message of the sender's choosing.
   */
  enquiryReceived(contact: string): Rendered {
    const subject = 'We have your enquiry';
    return {
      subject,
      html: layout(
        subject,
        `${heading('Enquiry received', 'Thank you')}
${para('We read every enquiry ourselves. You will hear from us the same working day.')}
${para(`If it is urgent, reply to this email or ${contact}.`)}`,
      ),
      text: `Thank you.\n\nWe read every enquiry ourselves. You will hear from us the same working day.\n\nIf it is urgent, reply to this email or ${contact}.`,
    };
  },

  /** To an enquirer, from the inbox: the Admin's own words, as plain text. */
  enquiryReply(name: string, body: string): Rendered {
    const subject = 'Re: your enquiry to Enzo Interiors';
    return {
      subject,
      html: layout(
        subject,
        `<p style="margin:0 0 16px">Hi ${escapeHtml(name.split(' ')[0] ?? name)},</p>
${replyParagraphs(body)}
<p style="margin:0;color:#6B6B6B;font-size:14px">Just reply to this email to carry on the conversation.</p>`,
      ),
      text: `Hi ${name.split(' ')[0]},\n\n${body}\n\nJust reply to this email to carry on the conversation.`,
    };
  },

  /** To the customer. */
  bookingConfirmed(b: BookingMail, contact: string): Rendered {
    const subject = `Your consultation is booked: ${b.when}`;
    const rows = bookingRows(b, false);
    return {
      subject,
      html: layout(
        subject,
        `${heading('Consultation booked', 'See you soon')}
${para('Thank you for booking a free home consultation with Enzo Interiors. Here are the details:')}
${table(rows)}
${para(`Need to change or cancel? Reply to this email or ${contact}, and quote your reference.`)}`,
      ),
      text: `Thank you for booking a free home consultation with Enzo Interiors.

${plain(rows)}

Need to change or cancel? Reply to this email or ${contact}, and quote your reference.`,
    };
  },

  /** To the studio. */
  bookingReceived(b: BookingMail, link: string): Rendered {
    const subject = `New consultation: ${b.name}, ${b.when}`;
    const rows = bookingRows(b, true);
    return {
      subject,
      html: layout(
        subject,
        `${heading('New consultation', b.name)}
${table(rows)}
${button(link, 'Open in Enzo Interiors')}
<p style="margin:0;color:#6B6B6B;font-size:14px">Reply to this email to answer ${escapeHtml(b.name)} directly.</p>`,
      ),
      text: `New consultation

${plain(rows)}

${link}`,
    };
  },

  /** To the customer, after staff move it. */
  bookingMoved(b: BookingMail, contact: string): Rendered {
    const subject = `Your consultation has moved to ${b.when}`;
    const rows = bookingRows(b, false);
    return {
      subject,
      html: layout(
        subject,
        `${heading('Consultation moved', b.when)}
${para(`Hi ${b.name.split(' ')[0]}, your consultation with Enzo Interiors is now at the time below.`)}
${table(rows)}
${para(`If that does not suit, reply to this email or ${contact}.`)}`,
      ),
      text: `Your consultation with Enzo Interiors has moved.

${plain(rows)}

If that does not suit, reply to this email or ${contact}.`,
    };
  },

  /** To the customer, after staff cancel it. */
  bookingCancelled(b: BookingMail, contact: string): Rendered {
    const subject = `Your consultation on ${b.when} is cancelled`;
    const rows = bookingRows(b, false);
    return {
      subject,
      html: layout(
        subject,
        `${heading('Consultation cancelled', b.when)}
${para(`Hi ${b.name.split(' ')[0]}, your consultation with Enzo Interiors has been cancelled.`)}
${table(rows)}
${para(`To book another time, reply to this email or ${contact}.`)}`,
      ),
      text: `Your consultation with Enzo Interiors has been cancelled.

${plain(rows)}

To book another time, reply to this email or ${contact}.`,
    };
  },

  invite(name: string, inviter: string, role: string, link: string): Rendered {
    const subject = `${inviter} invited you to Enzo Interiors`;
    return {
      subject,
      html: layout(
        subject,
        `<p style="margin:0 0 16px">Hi ${escapeHtml(name)},</p>
${para(`${inviter} has invited you to the Enzo Interiors admin as ${role === 'Designer' ? 'a Designer' : role === 'Admin' ? 'an Admin' : 'an Editor'}. Choose a password to get started. The link works once and expires in 7 days.`)}
${button(link, 'Choose your password')}`,
      ),
      text: `Hi ${name},

${inviter} has invited you to the Enzo Interiors admin. Choose a password here (expires in 7 days):
${link}`,
    };
  },

  /**
   * The portal invitation: the sign-in address and a generated password, by the owner's choice
   * (the portal asks them to change it on first sign-in). Nothing else carries the password.
   */
  portalInvite(name: string, inviter: string, signInUrl: string, password: string): Rendered {
    const subject = 'Your Enzo Interiors client portal';
    return {
      subject,
      html: layout(
        subject,
        `<p style="margin:0 0 16px">Hi ${escapeHtml(name)},</p>
${para(`${inviter} has set up your Enzo Interiors client portal, where you can follow your project, see documents and invoices, and message the team. Sign in with this email address and the password below.`)}
<p style="margin:0 0 16px;padding:14px 18px;background:${CREAM};border-radius:8px;font:600 18px/1.4 Consolas,Menlo,monospace;letter-spacing:.04em;color:${FOREST}">${escapeHtml(password)}</p>
${para('We recommend changing this password the first time you sign in. It stops working after 7 days unless you change it or choose to keep it. If you did not expect this email, you can ignore it.')}
${button(signInUrl, 'Sign in to your portal')}`,
      ),
      text: `Hi ${name},

${inviter} has set up your Enzo Interiors client portal. Sign in at ${signInUrl} with this email address and this password:

${password}

We recommend changing it the first time you sign in. It stops working after 7 days unless you change it or choose to keep it. If you did not expect this email, you can ignore it.`,
    };
  },

  /**
   * A message is waiting and nobody on that side was online. Deliberately no
   * message text: the conversation lives behind a sign-in, not in inboxes.
   */
  newMessage(from: string, where: string, link: string): Rendered {
    const subject = `New message from ${from}`;
    return {
      subject,
      html: layout(
        subject,
        `${heading('Messages', subject)}
${para(`You have a new message waiting in ${where}. Sign in to read it and reply.`)}
${button(link, 'Open messages')}`,
      ),
      text: `You have a new message from ${from} waiting in ${where}. Sign in to read it and reply:
${link}`,
    };
  },

  /** One template for every in-portal update a client chose to also get by email. */
  notice(name: string, title: string, body: string | null, link: string): Rendered {
    return {
      subject: title,
      html: layout(
        title,
        `${heading('Update', title)}
${para(body ?? 'Sign in to your client portal to see the details.')}
${button(link, 'Open your portal')}`,
      ),
      text: `Hi ${name},

${title}${body ? `
${body}` : ''}

Open your portal: ${link}`,
    };
  },

  /** To a staff member: something in the admin that needs them (the bell's twin by email). */
  staffNotice(name: string, title: string, body: string | null, link: string): Rendered {
    return {
      subject: title,
      html: layout(
        title,
        `${heading('Update', title)}
${para(body ?? 'Sign in to the Enzo Interiors admin to see the details.')}
${button(link, 'Open the admin')}`,
      ),
      text: `Hi ${name},

${title}${body ? `
${body}` : ''}

Open the admin: ${link}`,
    };
  },

  /** To an Infra manager: something about who can sign in, which they decide. */
  staffRequest(name: string, title: string, body: string, link: string): Rendered {
    return {
      subject: title,
      html: layout(
        title,
        `${heading('Security', title)}
<div style="padding:16px 18px;background:${CREAM};border-radius:8px;white-space:pre-wrap;margin:0 0 16px">${escapeHtml(body)}</div>
${button(link, 'Review in Users')}`,
      ),
      text: `Hi ${name},

${title}

${body}

Review it in Settings › Users: ${link}`,
    };
  },

  reviewRequested(editor: string, page: string, note: string | null, link: string): Rendered {
    const subject = `${editor} sent ${page} for review`;
    return {
      subject,
      html: layout(
        subject,
        `${heading('Ready for review', page)}
${para(`${editor} has changes ready to publish.`)}
${note ? `<div style="padding:16px 18px;background:${CREAM};border-radius:8px;white-space:pre-wrap;margin:0 0 16px">${escapeHtml(note)}</div>` : ''}
${button(link, 'Review the changes')}`,
      ),
      text: `${editor} sent ${page} for review.${note ? `

${note}` : ''}

${link}`,
    };
  },

  newsletterConfirm(link: string): Rendered {
    const subject = 'Confirm your Enzo Interiors newsletter';
    return {
      subject,
      html: layout(
        subject,
        `${heading('One more step', 'Confirm your email')}
${para('Thanks for signing up. Click below to confirm it was you, and we will send the occasional note about new rooms, the workshop and when the new website opens.')}
${button(link, 'Confirm my email')}
${para('If this was not you, ignore this email and you will not hear from us again.')}`,
      ),
      text: `Thanks for signing up to the Enzo Interiors newsletter. Confirm it was you:
${link}

If this was not you, ignore this email and you will not hear from us again.`,
    };
  },

  /** A campaign: the admin's (already sanitised) HTML in the branded shell, with the way out. */
  newsletter(subject: string, body: string, text: string, unsubscribe: string): Rendered {
    const footer = `Enzo Interiors · Bespoke fitted furniture, Leicester<br>You are getting this because you signed up on our website. <a href="${escapeHtml(unsubscribe)}" style="color:${SAGE}">Unsubscribe</a>`;
    return {
      subject,
      html: layout(subject, body, footer),
      text: `${text}

--
Enzo Interiors · Bespoke fitted furniture, Leicester
Unsubscribe: ${unsubscribe}`,
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
