import { NotificationPreference } from '../../common/types/domain';

/** What a client can choose between, and how each can reach them. */
export const NOTIFY_CATEGORIES = ['project', 'invoice', 'document', 'message'] as const;
export const NOTIFY_CHANNELS = ['in_app', 'email', 'push'] as const;
export type NotifyCategory = (typeof NOTIFY_CATEGORIES)[number];
export type NotifyChannel = (typeof NOTIFY_CHANNELS)[number];
export type CategoryChoices = Record<NotifyCategory, Record<NotifyChannel, boolean>>;

/**
 * One rule for "may this reach them this way": an explicit choice for the type
 * wins; otherwise the old all-in-one switches (in-app, email) apply; push
 * defaults on. So rows written before per-type choices behave as they did.
 */
export function allowed(row: NotificationPreference | null | undefined, category: NotifyCategory, channel: NotifyChannel): boolean {
  const chosen = row?.categories?.[category]?.[channel];
  if (typeof chosen === 'boolean') return chosen;
  if (channel === 'in_app') return row?.in_app_enabled !== false;
  if (channel === 'email') return row?.email_enabled !== false;
  return true;
}

/** The full grid, as the portal's Settings screen shows it. */
export function choicesOf(row: NotificationPreference | null | undefined): CategoryChoices {
  return Object.fromEntries(
    NOTIFY_CATEGORIES.map((category) => [
      category,
      Object.fromEntries(NOTIFY_CHANNELS.map((channel) => [channel, allowed(row, category, channel)])),
    ]),
  ) as CategoryChoices;
}
