import clsx from 'clsx';
import { ArrowSquareOut, EnvelopeSimple, Plus, X } from '@phosphor-icons/react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';

import { WEB_URL } from '@/components/cms/MediaPicker';
import { Button, ErrorState, FIELD_BASE, Input, LoadingState, PageHeader } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useQuery } from '@/hooks/useApi';
import { ApiError, api } from '@/lib/api';

interface SiteSettings {
  status: 'live' | 'coming_soon';
  launch_at: string | null;
  notification_emails: string[];
  updated_at: string;
  updated_by: string | null;
}

/** ISO -> the value a datetime-local input shows, in the browser's own zone. */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;
const LONG = new Intl.DateTimeFormat('en-GB', { dateStyle: 'full', timeStyle: 'short' });

const SECTION = 'max-w-2xl border-t border-border pt-7';
const HEADING = 'text-lg font-semibold tracking-tight text-ink';
const HELP = 'mt-1 text-sm leading-relaxed text-ink-muted';

/**
 * General settings: whether the public site is open, and where its enquiries
 * are emailed. Admin only (the API enforces the same).
 */
export function SiteSettingsPage() {
  const toast = useToast();
  const settings = useQuery<SiteSettings>('/settings');
  const [status, setStatus] = useState<SiteSettings['status']>('coming_soon');
  const [launch, setLaunch] = useState('');
  const [emails, setEmails] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  useEffect(() => {
    if (!settings.data) return;
    setStatus(settings.data.status);
    setLaunch(toLocalInput(settings.data.launch_at));
    setEmails(settings.data.notification_emails.length ? settings.data.notification_emails : ['']);
  }, [settings.data]);

  const saved = settings.data;
  const cleanEmails = useMemo(() => emails.map((e) => e.trim()).filter(Boolean), [emails]);
  const launchIso = launch ? new Date(launch).toISOString() : null;
  const dirty =
    !!saved &&
    (status !== saved.status ||
      launchIso !== (saved.launch_at ? new Date(saved.launch_at).toISOString() : null) ||
      cleanEmails.join(',') !== saved.notification_emails.join(','));

  if (settings.error) return <ErrorState message={settings.error} onRetry={settings.refetch} />;
  if (!saved) return <LoadingState label="Loading settings…" />;

  const launchPassed = launchIso !== null && new Date(launchIso).getTime() <= Date.now();
  const state =
    status === 'live' || launchPassed
      ? 'The site is public. Anyone can visit it and search engines can list it.'
      : launchIso
        ? `Visitors see the coming-soon page with a countdown. The site opens by itself on ${LONG.format(new Date(launchIso))}.`
        : 'Visitors see the coming-soon page until you switch the site to Live or set an opening time.';

  const save = async (event?: FormEvent) => {
    event?.preventDefault();
    const bad = cleanEmails.find((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
    if (bad) {
      setEmailError(`"${bad}" is not an email address.`);
      return;
    }
    setEmailError(null);
    setSaving(true);
    try {
      const next = await api.put<SiteSettings>('/settings', {
        status,
        launch_at: launchIso,
        notification_emails: cleanEmails,
      });
      settings.setData(next);
      toast.success('Settings saved. The website updates in a few seconds.');
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not save the settings.');
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    setTesting(true);
    try {
      const { to } = await api.post<{ to: string[] }>('/settings/test-email');
      toast.success(`Test email sent to ${to.join(', ')}.`);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not send the test email.');
    } finally {
      setTesting(false);
    }
  };

  const preview = async () => {
    // Opened first, filled in after, so the browser does not treat it as a pop-up.
    const tab = window.open('about:blank', '_blank');
    setPreviewing(true);
    try {
      const { token } = await api.post<{ token: string }>('/settings/preview-token');
      if (tab) {
        tab.opener = null;
        tab.location.href = `${WEB_URL}/api/preview?token=${encodeURIComponent(token)}`;
      }
    } catch (caught) {
      tab?.close();
      toast.error(caught instanceof ApiError ? caught.message : 'Could not open a preview.');
    } finally {
      setPreviewing(false);
    }
  };

  return (
    <form onSubmit={save} className="px-5 pb-16 pt-6 sm:px-8 lg:pt-8">
      <PageHeader
        title="Settings"
        description="General settings for the Enzo Interiors website."
        actions={
          <Button type="submit" variant="primary" loading={saving} disabled={!dirty}>
            Save changes
          </Button>
        }
      />

      <section aria-labelledby="settings-site" className={SECTION}>
        <h2 id="settings-site" className={HEADING}>
          Website
        </h2>
        <p className={HELP}>Whether visitors see the full website or the coming-soon page.</p>

        <div role="radiogroup" aria-label="Website status" className="mt-5 inline-flex rounded-control bg-ink/[0.06] p-1">
          {(
            [
              ['live', 'Live'],
              ['coming_soon', 'Coming soon'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={status === value}
              onClick={() => setStatus(value)}
              className={clsx(
                'min-h-9 rounded-[7px] px-4 text-sm font-medium transition-colors duration-150 pointer-coarse:min-h-11',
                status === value ? 'bg-surface text-ink shadow-soft' : 'text-ink-muted hover:text-ink',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {status === 'coming_soon' ? (
          <div className="mt-5 flex flex-wrap items-end gap-3">
            <div className="w-full max-w-xs">
              <Input
                label="Opening time"
                type="datetime-local"
                value={launch}
                onChange={(event) => setLaunch(event.target.value)}
                hint={`Your local time (${ZONE}). Leave empty for "opening soon" with no date.`}
              />
            </div>
            {launch ? (
              <Button type="button" variant="ghost" onClick={() => setLaunch('')}>
                Clear
              </Button>
            ) : null}
          </div>
        ) : null}

        <p className="mt-4 flex items-start gap-2 text-sm text-ink">
          <span
            aria-hidden="true"
            className={clsx(
              'mt-1.5 h-2 w-2 shrink-0 rounded-full',
              status === 'live' || launchPassed ? 'bg-success' : 'bg-warning',
            )}
          />
          <span>
            {state}
            {dirty ? <span className="text-ink-muted"> (after you save)</span> : null}
          </span>
        </p>

        <div className="mt-4">
          <Button type="button" icon={<ArrowSquareOut size={16} />} loading={previewing} onClick={preview}>
            Preview the website
          </Button>
          <p className={HELP}>Opens the full site in a new tab for this browser only, even while it is not public.</p>
        </div>
      </section>

      <section aria-labelledby="settings-mail" className={clsx(SECTION, 'mt-10')}>
        <h2 id="settings-mail" className={HEADING}>
          Notifications
        </h2>
        <p className={HELP}>
          Every enquiry, quote request and booking from the website is emailed here. Replying to one
          of those emails replies to the customer. If this is empty they go to the administrator the
          server was set up with.
        </p>

        <ul className="mt-5 flex flex-col gap-2">
          {emails.map((email, index) => (
            <li key={index} className="flex items-center gap-2">
              <input
                aria-label={`Notification address ${index + 1}`}
                type="email"
                autoComplete="off"
                placeholder="hello@enzointeriors.co.uk"
                value={email}
                onChange={(event) =>
                  setEmails(emails.map((value, i) => (i === index ? event.target.value : value)))
                }
                className={clsx(FIELD_BASE, 'w-full max-w-sm')}
              />
              {emails.length > 1 ? (
                <button
                  type="button"
                  aria-label={`Remove ${email || 'this address'}`}
                  onClick={() => setEmails(emails.filter((_, i) => i !== index))}
                  className="flex h-9 w-9 items-center justify-center rounded-control text-ink-muted hover:bg-ink/[0.06] hover:text-ink"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
        {emailError ? (
          <p role="alert" className="mt-2 text-sm text-danger">
            {emailError}
          </p>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-2">
          {emails.length < 10 ? (
            <Button type="button" variant="ghost" icon={<Plus size={16} />} onClick={() => setEmails([...emails, ''])}>
              Add an address
            </Button>
          ) : null}
          <Button
            type="button"
            icon={<EnvelopeSimple size={16} />}
            loading={testing}
            disabled={dirty}
            onClick={sendTest}
            title={dirty ? 'Save first, so the test goes to these addresses.' : undefined}
          >
            Send a test email
          </Button>
        </div>
      </section>

      {saved.updated_by ? (
        <p className="mt-10 max-w-2xl text-xs text-ink-muted">
          Last changed by {saved.updated_by}, {LONG.format(new Date(saved.updated_at))}.
        </p>
      ) : null}
    </form>
  );
}
