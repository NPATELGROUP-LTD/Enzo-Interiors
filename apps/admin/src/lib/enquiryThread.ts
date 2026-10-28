import type { EnquiryMessage } from '@/types/api';

/**
 * The thread after a reply is sent. A reply that lands once another enquiry
 * is open belongs to the enquiry it was sent from, so it must not be shown
 * in this one.
 */
export function appendIfOpen(
  thread: EnquiryMessage[],
  sent: EnquiryMessage,
  openId: string | null,
): EnquiryMessage[] {
  return sent.enquiry_id === openId ? [...thread, sent] : thread;
}
