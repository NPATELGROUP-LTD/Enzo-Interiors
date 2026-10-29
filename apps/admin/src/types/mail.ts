/** What /mailbox serves. Mirrors apps/api/src/modules/mailbox; nothing here is stored. */

/** One Gmail folder: a system one (Inbox, Sent…) or the person's own label. */
export interface MailFolder {
  id: string;
  name: string;
  system: boolean;
}

export interface MailStatus {
  configured: boolean;
  connected: boolean;
  email: string | null;
  needs_reconnect: boolean;
}

export interface MailAddress {
  name: string;
  email: string;
}

export interface MailRow {
  id: string;
  subject: string;
  from: MailAddress | null;
  to: MailAddress[];
  snippet: string;
  date: string;
  count: number;
  unread: boolean;
}

export interface MailFile {
  part_id: string;
  filename: string;
  mime: string;
  size: number;
}

export interface MailMessage {
  id: string;
  thread_id: string;
  from: MailAddress | null;
  to: MailAddress[];
  cc: MailAddress[];
  reply_to: MailAddress | null;
  subject: string;
  date: string;
  unread: boolean;
  /** Plain text; made from the HTML when the message had no plain part. */
  text: string;
  /** Already sanitised by the API; shown only inside a sandboxed frame. */
  html: string | null;
  truncated: boolean;
  inline_images: boolean;
  attachments: MailFile[];
}

export interface MailThread {
  id: string;
  subject: string;
  messages: MailMessage[];
}

/** A message being written: new, a reply, or a forward. */
export interface Draft {
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  body: string;
  /** The Gmail message answered; the API takes the thread and headers from it. */
  replyToId?: string;
  /** The Gmail message forwarded, and the files of it that may go along. */
  forwardId?: string;
  forwardFiles?: MailFile[];
}
