/**
 * Display formatting. UK conventions throughout — this is a Leicester business.
 */

/** A staff role as people see it: Installer is a legacy name for Designer; Infra is the Infra manager. */
export const roleLabel = (role: string | undefined): string =>
  role === 'Installer' ? 'Designer' : role === 'Infra' ? 'Infra manager' : (role ?? '');

const GBP = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const GBP_COMPACT = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  maximumFractionDigits: 0,
});

/** £13,831.20 */
export const money = (value: number): string => GBP.format(value);

/**
 * £8.4k — for dashboard tiles, where the brief's example content shows
 * abbreviated figures ("Outstanding invoices £8.4k").
 */
export const moneyCompact = (value: number): string => {
  if (Math.abs(value) >= 1000) {
    const thousands = value / 1000;
    // One decimal, but drop a trailing .0 so £8,000 reads "£8k" not "£8.0k".
    const text = thousands.toFixed(1).replace(/\.0$/, '');
    return `£${text}k`;
  }
  return GBP_COMPACT.format(value);
};

/** 14 Aug 2026 */
export const date = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) return '—';
  return value.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

/** 14 Aug 2026, 09:30 */
export const dateTime = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) return '—';
  return `${date(iso)}, ${value.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
};

/** 09:30 */
export const time = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) return '—';
  return value.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
};

/** "3 days ago", "in 2 days", "Today" — for activity feeds and due dates. */
export const relative = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return '—';

  const diffMs = target - Date.now();
  const diffDays = Math.round(diffMs / 86_400_000);

  if (diffDays === 0) {
    const diffHours = Math.round(diffMs / 3_600_000);
    if (Math.abs(diffHours) < 1) return 'Just now';
    return diffHours > 0 ? `In ${diffHours}h` : `${Math.abs(diffHours)}h ago`;
  }
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  return diffDays > 0 ? `In ${diffDays} days` : `${Math.abs(diffDays)} days ago`;
};

/** 1.4 MB */
export const fileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/** "02" — the brief's dashboard cards show zero-padded counts. */
export const padCount = (value: number): string => String(value).padStart(2, '0');

/**
 * Turn an audit action slug into readable text: 'invoice_mark_paid' ->
 * 'Invoice mark paid'. Keeps the log honest without a lookup table that would
 * drift from the API's action names.
 */
export const humanise = (slug: string): string => {
  const spaced = slug.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

/** Initials for an avatar chip. */
export const initials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

/** Said wherever we email someone: mail filters often catch these. */
export const SPAM_HINT = 'Not there? Check your spam or junk folder.';
/** The same, for an email sent to someone else. */
export const THEIR_SPAM_HINT = 'If it does not arrive, ask them to check their spam or junk folder.';
