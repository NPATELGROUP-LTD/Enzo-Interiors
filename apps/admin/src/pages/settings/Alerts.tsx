import { Plus, X } from '@phosphor-icons/react';
import clsx from 'clsx';
import { useEffect, useMemo, useState } from 'react';

import {
  Button,
  EmptyState,
  ErrorState,
  FIELD_BASE,
  LoadingState,
  PaneHeader,
  SettingsGroup,
  SettingsRow,
  StatusTag,
  Toggle,
  type StatusTone,
} from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useQuery } from '@/hooks/useApi';
import { ApiError, api } from '@/lib/api';

/* The shapes apps/api/src/modules/alerts serves. */
type Kind = 'urgent' | 'error' | 'security';
interface AlertEvent {
  id: string;
  kind: Kind;
  source: string;
  title: string;
  route: string | null;
  location: string | null;
  status: number | null;
  count: number;
  last_at: string;
}
interface AlertsView {
  recipients: string[];
  errors_on: boolean;
  digest_on: boolean;
  updated_at: string | null;
  updated_by: string | null;
  /** How many addresses the server's ALERT_TO supplies when none are saved here. */
  fallback_recipients: number;
  from: string;
  mail_enabled: boolean;
  recent: AlertEvent[];
}

const KIND_TONE: Record<Kind, StatusTone> = { urgent: 'danger', error: 'warning', security: 'info' };
const WHEN = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

/** Settings › Alerts (Infra manager): who is emailed when something breaks, and what has. */
export function Alerts() {
  const toast = useToast();
  const alerts = useQuery<AlertsView>('/alerts');
  const [recipients, setRecipients] = useState<string[]>(['']);
  const [errorsOn, setErrorsOn] = useState(true);
  const [digestOn, setDigestOn] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<Kind | 'digest' | null>(null);

  const saved = alerts.data;
  useEffect(() => {
    if (!saved) return;
    setRecipients(saved.recipients.length ? saved.recipients : ['']);
    setErrorsOn(saved.errors_on);
    setDigestOn(saved.digest_on);
  }, [saved]);

  const clean = useMemo(() => recipients.map((address) => address.trim().toLowerCase()).filter(Boolean), [recipients]);
  const dirty = !!saved && (errorsOn !== saved.errors_on || digestOn !== saved.digest_on || clean.join(',') !== saved.recipients.join(','));

  if (alerts.error) return <ErrorState message={alerts.error} onRetry={alerts.refetch} />;
  if (!saved) return <LoadingState label="Loading alerts…" />;

  const save = async () => {
    const bad = clean.find((address) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address));
    if (bad) return setError(`"${bad}" is not an email address.`);
    setError(null);
    setSaving(true);
    try {
      alerts.setData(await api.put<AlertsView>('/alerts', { recipients: clean, errors_on: errorsOn, digest_on: digestOn }));
      toast.success('Alert settings saved.');
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not save the alert settings.');
    } finally {
      setSaving(false);
    }
  };

  const test = async (kind: Kind) => {
    setTesting(kind);
    try {
      const { to } = await api.post<{ to: string[] }>('/alerts/test', { kind });
      toast.success(`Test sent to ${to.join(', ')}.`);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not send the test.');
    } finally {
      setTesting(null);
    }
  };

  const sendDigest = async () => {
    setTesting('digest');
    try {
      const { sent } = await api.post<{ sent: boolean }>('/infra/digest');
      if (sent) toast.success('The daily summary is on its way.');
      else toast.error('Not sent. Check that email is set up and that someone is listed to receive alerts.');
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not send the daily summary.');
    } finally {
      setTesting(null);
    }
  };

  return (
    <div className="max-w-3xl">
      <PaneHeader
        title="Alerts"
        help={
          <>
            Emails to the people who run the platform when something breaks. They come from{' '}
            <span className="break-all font-medium text-ink">{saved.from}</span> and carry the route, the status and the first line of
            the error: no customer details.
          </>
        }
        action={
          <Button variant="primary" loading={saving} disabled={!dirty} onClick={() => void save()}>
            Save changes
          </Button>
        }
      />

      {!saved.mail_enabled ? (
        <p role="alert" className="mt-4 text-sm text-danger">
          Email is not set up on this server (SMTP_HOST), so nothing can be sent yet.
        </p>
      ) : null}

      <SettingsGroup title="Who is emailed">
        <div className="px-4 py-3">
          <ul className="flex flex-col gap-2">
            {recipients.map((address, index) => (
              <li key={index} className="flex items-center gap-2">
                <input
                  aria-label={`Alert address ${index + 1}`}
                  type="email"
                  autoComplete="off"
                  placeholder="alerts@yourcompany.com"
                  value={address}
                  onChange={(event) => setRecipients(recipients.map((value, i) => (i === index ? event.target.value : value)))}
                  className={clsx(FIELD_BASE, 'w-full max-w-sm')}
                />
                {recipients.length > 1 ? (
                  <button
                    type="button"
                    aria-label={`Remove ${address || 'this address'}`}
                    onClick={() => setRecipients(recipients.filter((_, i) => i !== index))}
                    className="flex h-9 w-9 items-center justify-center rounded-control text-ink-muted hover:bg-ink/[0.06] hover:text-ink"
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
          {error ? (
            <p role="alert" className="mt-2 text-sm text-danger">
              {error}
            </p>
          ) : null}
          {recipients.length < 10 ? (
            <Button type="button" variant="ghost" className="mt-2" icon={<Plus size={16} />} onClick={() => setRecipients([...recipients, ''])}>
              Add an address
            </Button>
          ) : null}
          <p className="mt-3 text-[13px] leading-relaxed text-ink-muted">
            {clean.length
              ? 'Use addresses outside the mailbox the platform sends from, so an alert still reaches you if that mailbox is the problem.'
              : saved.fallback_recipients
                ? `Empty, so alerts go to the ${saved.fallback_recipients} address${saved.fallback_recipients === 1 ? '' : 'es'} set on the server (ALERT_TO).`
                : 'Nobody receives alerts yet. Add an address.'}
          </p>
        </div>
      </SettingsGroup>

      <SettingsGroup title="What is emailed">
        <div className="px-4 py-3">
          <Toggle
            label="Errors"
            description="Server faults, website and browser errors, emails that could not be sent. Each problem is emailed once every 15 minutes, with a count."
            checked={errorsOn}
            onChange={setErrorsOn}
          />
        </div>
        <div className="px-4 py-3">
          <Toggle
            label="Daily summary"
            description="One email at 08:00 UK time: errors, refused requests, failed sign-ins, sizes, and anything that needs attention. If it stops arriving, something is wrong."
            checked={digestOn}
            onChange={setDigestOn}
          />
        </div>
        <SettingsRow label="Urgent and security alerts" help="Downtime and sign-in or account events always go out. They cannot be switched off." />
      </SettingsGroup>

      <SettingsGroup title="Check it works">
        <SettingsRow
          label="Send a test email"
          help={dirty ? 'Save first, so the test goes to these addresses.' : 'One email with that tag in its subject, to check the sender and your mail folders.'}
        >
          {(['urgent', 'error', 'security'] as const).map((kind) => (
            <Button key={kind} loading={testing === kind} disabled={dirty || testing !== null} onClick={() => void test(kind)}>
              {kind[0]!.toUpperCase() + kind.slice(1)}
            </Button>
          ))}
        </SettingsRow>
        <SettingsRow label="Send the daily summary now" help={dirty ? 'Save first, so it goes to these addresses.' : 'The numbers as they are now, to check it arrives. It does not use up the 08:00 one.'}>
          <Button loading={testing === 'digest'} disabled={dirty || testing !== null} onClick={() => void sendDigest()}>
            Send
          </Button>
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title="Recent (kept 30 days)">
        {saved.recent.length ? (
          saved.recent.map((event) => (
            <div key={event.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <StatusTag tone={KIND_TONE[event.kind]}>{event.kind}</StatusTag>
                <span className="text-xs text-ink-muted">
                  {event.source} · {event.count} time{event.count === 1 ? '' : 's'} · last {WHEN.format(new Date(event.last_at))}
                </span>
              </div>
              <p className="mt-1 break-words text-sm text-ink">{event.title}</p>
              {event.route || event.location ? (
                <p className="mt-0.5 break-all text-xs text-ink-muted">{[event.route, event.location].filter(Boolean).join(' · ')}</p>
              ) : null}
            </div>
          ))
        ) : (
          <EmptyState title="Nothing has gone wrong" message="Errors and alerts appear here as they happen." />
        )}
      </SettingsGroup>

      {saved.updated_by && saved.updated_at ? (
        <p className="mt-10 text-xs text-ink-muted">
          Last changed by {saved.updated_by}, {WHEN.format(new Date(saved.updated_at))}.
        </p>
      ) : null}
    </div>
  );
}
