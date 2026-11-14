import type { AlertKind, AlertSource } from '../common/types/domain';

/**
 * One of every alert the platform can raise, with believable but invented
 * details. Settings › Alerts lists them so the Infra manager can send any one
 * of them to the alert recipients and see exactly what a real one carries. The
 * text is shaped like the real titles (see where each is raised); no sample
 * holds a real address, name or id.
 */
export interface AlertSample {
  id: string;
  /** What the Infra manager sees on the button. */
  label: string;
  /** When a real one goes out. */
  when: string;
  kind: AlertKind;
  source: AlertSource;
  title: string;
  route?: string;
  location?: string;
  status?: number;
}

export const ALERT_SAMPLES: AlertSample[] = [
  {
    id: 'downtime',
    label: 'Site or API down',
    when: 'The platform stops answering its health check.',
    kind: 'urgent',
    source: 'system',
    title: 'The API could not reach the database',
    route: 'GET /health',
    status: 503,
  },
  {
    id: 'api-error',
    label: 'Server error (500)',
    when: 'Any API request fails with a 5xx, except a deliberate 503.',
    kind: 'error',
    source: 'api',
    title: 'P2022 The column `design_id` does not exist in the current database.',
    route: 'POST /quotes/:id/invoice',
    location: 'quotes.service.ts:214',
    status: 500,
  },
  {
    id: 'web-error',
    label: 'Website page failed',
    when: 'A page on the public website throws while rendering.',
    kind: 'error',
    source: 'web',
    title: 'Cannot read properties of undefined (reading "title")',
    route: '/services/[slug]',
  },
  {
    id: 'admin-error',
    label: 'Admin app error',
    when: 'The admin throws in someone’s browser (production builds only).',
    kind: 'error',
    source: 'admin',
    title: 'TypeError: Cannot read properties of null (reading "id")',
    location: 'index-3f9a2c.js:1204',
  },
  {
    id: 'portal-error',
    label: 'Client portal error',
    when: 'The client portal throws in a client’s browser (production builds only).',
    kind: 'error',
    source: 'portal',
    title: 'ChunkLoadError: Loading chunk 18 failed',
    location: 'index-81be40.js:12',
  },
  {
    id: 'mail-failed',
    label: 'Email could not be sent',
    when: 'The mail server refuses a customer or staff email.',
    kind: 'error',
    source: 'system',
    title: 'An email could not be sent: 535 Authentication credentials invalid',
  },
  {
    id: 'calendar',
    label: 'Google Calendar disconnected',
    when: 'Google stops accepting the studio calendar’s link.',
    kind: 'error',
    source: 'system',
    title: 'Google Calendar needs reconnecting',
  },
  {
    id: 'newsletter',
    label: 'Newsletter stopped',
    when: 'A newsletter send is interrupted part-way.',
    kind: 'error',
    source: 'system',
    title: 'A newsletter stopped sending: 421 Too many connections from this address',
  },
  {
    id: 'limit',
    label: 'Alert limit reached',
    when: 'One source passes its hourly email cap; the rest are recorded, not emailed.',
    kind: 'error',
    source: 'api',
    title: 'Alert limit reached: more than 20 api alerts this hour',
  },
  {
    id: 'lockout',
    label: 'Sign-in locked out',
    when: 'A sign-in route answers 429: too many attempts, or the rate limit.',
    kind: 'security',
    source: 'api',
    title: 'A sign-in was refused after repeated failures. See Settings › Security.',
    route: 'POST /auth/admin/login',
    status: 429,
  },
  {
    id: 'new-device',
    label: 'Staff sign-in from somewhere new',
    when: 'A staff member signs in from a country or device not seen in 90 days.',
    kind: 'security',
    source: 'api',
    title: 'Dev Designer signed in from a new country and device: Germany, Firefox · macOS. See Settings › Security.',
    route: 'POST /auth/admin/login',
  },
  {
    id: 'failed-signins',
    label: 'Failed sign-ins from one address',
    when: '10 or more failed sign-ins from one address within 10 minutes.',
    kind: 'security',
    source: 'api',
    title: '14 failed sign-ins from 203.0.113.7 in 10 minutes. See Settings › Security.',
    route: '/sign-in',
  },
  {
    id: 'refusals',
    label: 'Burst of refused requests',
    when: '100 or more refusals (401, 403, 404, 429) within 5 minutes.',
    kind: 'security',
    source: 'api',
    title: '132 refused requests in 5 minutes. See Settings › Security.',
  },
  {
    id: 'staff-change',
    label: 'Staff or access change',
    when: 'Someone is invited, promoted, removed, or has two-step reset; or a client, project or invoice is deleted.',
    kind: 'security',
    source: 'api',
    title: 'A staff member was invited by Maya Admin. See Settings › Security.',
    route: 'POST /users/invite',
  },
];

export const SAMPLE_IDS = ALERT_SAMPLES.map((sample) => sample.id);

/**
 * What a kind and source mean for the reader, and where to look first. Shared by
 * real alerts and the samples, so a test shows exactly what an alert will say.
 */
export function guidance(kind: AlertKind, source: AlertSource): { impact: string; next: string; pane: 'alerts' | 'health' | 'security' } {
  if (kind === 'urgent') {
    return {
      impact: 'The platform may be down or unusable for visitors and staff.',
      next: 'Open Health, then check the API and database in Coolify. Restart the failing service if it is stuck.',
      pane: 'health',
    };
  }
  if (kind === 'security') {
    return {
      impact: 'An account or access event that someone should confirm. Nothing has been blocked automatically.',
      next: 'Open the access log and check the address, country and device. If it was not expected, block the address in Cloudflare and reset that person’s sign-in.',
      pane: 'security',
    };
  }
  const bySource: Record<AlertSource, { impact: string; next: string }> = {
    api: {
      impact: 'A request failed on the server. Whoever made it saw an error.',
      next: 'Find the route in the list below, then read the API log in Coolify around the time shown. “In” gives the file and line.',
    },
    web: {
      impact: 'A page on the public website failed to render for a visitor.',
      next: 'Open that page on the website. If it still fails, check the website’s log in Coolify and the content behind it in the CMS.',
    },
    admin: {
      impact: 'The admin threw an error in someone’s browser. They may have seen a broken screen.',
      next: 'Try the same screen. If it repeats, the location points at the built file; match it to the release.',
    },
    portal: {
      impact: 'The client portal threw an error in a client’s browser. They may have seen a broken screen.',
      next: 'Try the same screen as a test client. A chunk-load error after a deploy usually clears on reload.',
    },
    system: {
      impact: 'A background job or an outgoing email did not complete.',
      next: 'Check the matching settings (mail, Google, newsletter) and the API log in Coolify for the reason.',
    },
  };
  return { ...bySource[source], pane: 'alerts' };
}
