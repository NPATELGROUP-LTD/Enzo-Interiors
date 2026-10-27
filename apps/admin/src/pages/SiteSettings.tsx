import clsx from 'clsx';
import {
  ArrowSquareOut,
  CalendarBlank,
  Clock,
  EnvelopeSimple,
  Files,
  FolderSimple,
  BellRinging,
  Globe,
  Kanban,
  Newspaper,
  PaintBrush,
  Plus,
  Pulse,
  ShieldCheck,
  UsersThree,
  X,
  type Icon as PhosphorIcon,
} from '@phosphor-icons/react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Navigate, useParams } from 'react-router-dom';

import { MediaField, WEB_URL } from '@/components/cms/MediaPicker';
import { Button, ErrorState, FIELD_BASE, Input, LoadingState, PaneHeader, SettingsShell, Toggle } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useQuery } from '@/hooks/useApi';
import { ApiError, api } from '@/lib/api';
import type { MediaAsset } from '@/types/cms';

import { Alerts } from './settings/Alerts';
import { BookingSchedule } from './settings/BookingSchedule';
import { DocumentCategories } from './settings/DocumentCategories';
import { Health } from './settings/Health';
import { Newsletter } from './settings/Newsletter';
import { Security } from './settings/Security';
import { OpeningHours } from './settings/OpeningHours';
import { ProjectStages } from './settings/ProjectStages';
import { useAuth } from '@/lib/auth';
import { UsersSection } from './settings/Users';

interface SiteSettings {
  status: 'live' | 'coming_soon';
  launch_at: string | null;
  notification_emails: string[];
  logo_light_id: string | null;
  logo_dark_id: string | null;
  favicon_id: string | null;
  favicon_dark_id: string | null;
  /** Every switchable page, filled in by the API (home is always on). */
  pages: Record<PageKey, boolean>;
  updated_at: string;
  updated_by: string | null;
}

type PageKey = 'about' | 'services' | 'portfolio' | 'booking' | 'contact' | 'privacy' | 'terms' | 'cookies';

/** Settings › Pages, in the order the site's menu has them. */
const PAGES: Array<[PageKey, string]> = [
  ['about', 'About'],
  ['services', 'Services'],
  ['portfolio', 'Portfolio'],
  ['booking', 'Booking'],
  ['contact', 'Contact'],
  ['privacy', 'Privacy policy'],
  ['terms', 'Terms'],
  ['cookies', 'Cookie policy'],
];

/** The settings panes, in the sidebar's order. */
export const SETTINGS_SECTIONS: Array<{ id: string; label: string; detail: string; Icon: PhosphorIcon }> = [
  { id: 'health', label: 'Health', detail: 'Storage, database, cache and errors', Icon: Pulse },
  { id: 'website', label: 'Website', detail: 'Live or coming soon, opening time', Icon: Globe },
  { id: 'pages', label: 'Pages', detail: 'Switch pages of the website on or off', Icon: Files },
  { id: 'brand', label: 'Logo & icon', detail: 'Logos and the browser-tab icon', Icon: PaintBrush },
  { id: 'hours', label: 'Opening hours', detail: 'When the studio is open, with notes', Icon: Clock },
  { id: 'emails', label: 'Emails', detail: 'Where enquiries and bookings go', Icon: EnvelopeSimple },
  { id: 'booking', label: 'Booking', detail: 'Hours, breaks and the booking form', Icon: CalendarBlank },
  { id: 'stages', label: 'Project stages', detail: 'The stages a project moves through', Icon: Kanban },
  { id: 'documents', label: 'Document categories', detail: 'What a file can be filed under', Icon: FolderSimple },
  { id: 'newsletter', label: 'Newsletter', detail: 'Subscribers and newsletters', Icon: Newspaper },
  { id: 'users', label: 'Users', detail: 'Invite people and choose their role', Icon: UsersThree },
  { id: 'alerts', label: 'Alerts', detail: 'Who is emailed when something breaks', Icon: BellRinging },
  { id: 'security', label: 'Security', detail: 'Who signed in and what changed, from where', Icon: ShieldCheck },
];

/** What an Infra manager can open: the platform's switches and who can sign in. The business's own panes stay the Admin's. */
const INFRA_SECTIONS = new Set(['health', 'website', 'pages', 'users', 'alerts', 'security']);

export const settingsSections = (isInfra: boolean) =>
  SETTINGS_SECTIONS.filter(({ id }) => (isInfra ? INFRA_SECTIONS.has(id) : id !== 'health' && id !== 'alerts' && id !== 'security'));

/** ISO -> the value a datetime-local input shows, in the browser's own zone. */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;
const LONG = new Intl.DateTimeFormat('en-GB', { dateStyle: 'full', timeStyle: 'short' });

const HELP = 'mt-1 text-sm leading-relaxed text-ink-muted';

/**
 * The website, logo, email and booking settings, and who can sign in. Admin
 * only (the API enforces the same). Laid out like System Settings: the panes
 * down the left, the open one on the right.
 */
export function SiteSettingsPage() {
  const { section = '' } = useParams();
  const { isInfra } = useAuth();
  const sections = settingsSections(isInfra);
  if (!sections.some((row) => row.id === section)) return <Navigate to={isInfra ? '/settings/health' : '/settings/website'} replace />;

  let pane: ReactNode;
  if (section === 'health') pane = <Health />;
  else if (section === 'booking') pane = <BookingSchedule />;
  else if (section === 'hours') pane = <OpeningHours />;
  else if (section === 'stages') pane = <ProjectStages />;
  else if (section === 'documents') pane = <DocumentCategories />;
  else if (section === 'newsletter') pane = <Newsletter />;
  else if (section === 'users') pane = <UsersSection />;
  else if (section === 'alerts') pane = <Alerts />;
  else if (section === 'security') pane = <Security />;
  else pane = <GeneralPane section={section as 'website' | 'pages' | 'brand' | 'emails'} />;

  return (
    <SettingsShell label="Settings" sections={sections} active={section} to={(id) => `/settings/${id}`}>
      {pane}
    </SettingsShell>
  );
}

/** Website, Pages, Logo & icon and Emails: four views of the one site_settings row. */
function GeneralPane({ section }: { section: 'website' | 'pages' | 'brand' | 'emails' }) {
  const toast = useToast();
  const settings = useQuery<SiteSettings>('/settings');
  const assets = useQuery<MediaAsset[]>(section === 'brand' ? '/cms/media' : null);
  const [status, setStatus] = useState<SiteSettings['status']>('coming_soon');
  const [launch, setLaunch] = useState('');
  const [emails, setEmails] = useState<string[]>([]);
  const [brand, setBrand] = useState<
    Pick<SiteSettings, 'logo_light_id' | 'logo_dark_id' | 'favicon_id' | 'favicon_dark_id'>
  >({
    logo_light_id: null,
    logo_dark_id: null,
    favicon_id: null,
    favicon_dark_id: null,
  });
  const [pages, setPages] = useState<SiteSettings['pages'] | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  useEffect(() => {
    if (!settings.data) return;
    setStatus(settings.data.status);
    setLaunch(toLocalInput(settings.data.launch_at));
    setEmails(settings.data.notification_emails.length ? settings.data.notification_emails : ['']);
    setBrand({
      logo_light_id: settings.data.logo_light_id,
      logo_dark_id: settings.data.logo_dark_id,
      favicon_id: settings.data.favicon_id,
      favicon_dark_id: settings.data.favicon_dark_id,
    });
    setPages(settings.data.pages);
  }, [settings.data]);

  const saved = settings.data;
  const cleanEmails = useMemo(() => emails.map((e) => e.trim()).filter(Boolean), [emails]);
  const launchIso = launch ? new Date(launch).toISOString() : null;
  const dirty =
    !!saved &&
    (status !== saved.status ||
      launchIso !== (saved.launch_at ? new Date(saved.launch_at).toISOString() : null) ||
      cleanEmails.join(',') !== saved.notification_emails.join(',') ||
      brand.logo_light_id !== saved.logo_light_id ||
      brand.logo_dark_id !== saved.logo_dark_id ||
      brand.favicon_id !== saved.favicon_id ||
      brand.favicon_dark_id !== saved.favicon_dark_id ||
      PAGES.some(([key]) => pages?.[key] !== saved.pages[key]));

  if (settings.error) return <ErrorState message={settings.error} onRetry={settings.refetch} />;
  if (!saved) return <LoadingState label="Loading settings…" />;

  const launchPassed = launchIso !== null && new Date(launchIso).getTime() <= Date.now();
  const state =
    status === 'live' || launchPassed
      ? 'The site is public. Anyone can visit it and search engines can list it.'
      : launchIso
        ? `Visitors see the coming-soon page with a countdown. The site opens by itself on ${LONG.format(new Date(launchIso))}.`
        : 'Visitors see the coming-soon page until you switch the site to Live or set an opening time.';

  const save = async () => {
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
        ...brand,
        ...(pages ? { pages } : {}),
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

  const saveButton = (
    <Button variant="primary" loading={saving} disabled={!dirty} onClick={() => void save()}>
      Save changes
    </Button>
  );

  const pick = (key: keyof typeof brand) => (ids: string[]) => setBrand({ ...brand, [key]: ids[ids.length - 1] ?? null });

  return (
    <div className="max-w-3xl">
      {section === 'website' ? (
        <>
          <PaneHeader title="Website" help="Whether visitors see the full website or the coming-soon page." action={saveButton} />

          <div role="radiogroup" aria-label="Website status" className="mt-6 inline-flex rounded-control bg-ink/[0.06] p-1">
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

          <p className="mt-5 text-sm text-ink">
            {state}
            {dirty ? <span className="text-ink-muted"> (after you save)</span> : null}
          </p>

          <div className="mt-8 border-t border-border pt-7">
            <Button type="button" icon={<ArrowSquareOut size={16} />} loading={previewing} onClick={preview}>
              Preview the website
            </Button>
            <p className={HELP}>Opens the full site in a new tab for this browser only, even while it is not public.</p>
          </div>
        </>
      ) : null}

      {section === 'pages' && pages ? (
        <>
          <PaneHeader
            title="Pages"
            help="The home page is always on. A page that is off shows an “updated soon” page with the newsletter sign-up instead."
            action={saveButton}
          />
          <ul className="mt-6 flex flex-col">
            {PAGES.map(([key, label], index) => (
              <li key={key} className={clsx('py-3', index > 0 && 'border-t border-border/70')}>
                <Toggle label={label} checked={pages[key]} onChange={(on) => setPages({ ...pages, [key]: on })} />
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {section === 'brand' ? (
        <>
          <PaneHeader
            title="Logo & icon"
            help="The logos in the header, footer, booking page and coming-soon page, and the small icon on the browser tab."
            action={saveButton}
          />
          {assets.error ? <ErrorState message={assets.error} onRetry={assets.refetch} /> : null}
          <div className="mt-7 flex flex-col gap-8">
            <MediaField
              label="Logo on light backgrounds"
              hint="The header and anywhere on cream or white. A dark logo with a transparent background (PNG or SVG)."
              value={brand.logo_light_id ? [brand.logo_light_id] : []}
              logo="light"
              multiple={false}
              onChange={pick('logo_light_id')}
              assets={assets.data ?? []}
              onAssetsChanged={() => void assets.refetch()}
            />
            <MediaField
              label="Logo on dark backgrounds"
              hint="The footer, the booking page and the coming-soon page. A white or light logo."
              value={brand.logo_dark_id ? [brand.logo_dark_id] : []}
              logo="dark"
              multiple={false}
              onChange={pick('logo_dark_id')}
              assets={assets.data ?? []}
              onAssetsChanged={() => void assets.refetch()}
            />
            <div className="flex flex-col gap-2">
              <MediaField
                label="Browser-tab icon (favicon)"
                hint="A square image, at least 512 × 512 pixels. Also used when someone saves the site to their phone's home screen."
                value={brand.favicon_id ? [brand.favicon_id] : []}
                logo="light"
                multiple={false}
                onChange={pick('favicon_id')}
                assets={assets.data ?? []}
                onAssetsChanged={() => void assets.refetch()}
              />
              {brand.favicon_id ? null : (
                <p className="flex items-center gap-2 text-[13px] text-ink-muted">
                  <img src={`${WEB_URL}/icon.png`} alt="" className="h-6 w-6 rounded-[5px]" />
                  Using the website's built-in icon.
                </p>
              )}
            </div>
            <MediaField
              label="Browser-tab icon in dark mode (optional)"
              hint="Shown instead when someone's browser or computer is set to dark mode, where a dark icon can disappear against a dark tab. Leave empty to use the icon above everywhere."
              value={brand.favicon_dark_id ? [brand.favicon_dark_id] : []}
              logo="dark"
              multiple={false}
              onChange={pick('favicon_dark_id')}
              assets={assets.data ?? []}
              onAssetsChanged={() => void assets.refetch()}
            />
          </div>
        </>
      ) : null}

      {section === 'emails' ? (
        <>
          <PaneHeader
            title="Emails"
            help="Every enquiry, quote request and booking from the website is emailed here. Replying to one of those emails replies to the customer. If this is empty they go to the administrator the server was set up with."
            action={saveButton}
          />
          <ul className="mt-6 flex flex-col gap-2">
            {emails.map((email, index) => (
              <li key={index} className="flex items-center gap-2">
                <input
                  aria-label={`Notification address ${index + 1}`}
                  type="email"
                  autoComplete="off"
                  placeholder="hello@enzointeriors.co.uk"
                  value={email}
                  onChange={(event) => setEmails(emails.map((value, i) => (i === index ? event.target.value : value)))}
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
          <p className={clsx(HELP, 'mt-6')}>
            New bookings and review requests also appear under the bell in the menu bar, for every Admin.
          </p>
        </>
      ) : null}

      {saved.updated_by ? (
        <p className="mt-10 text-xs text-ink-muted">
          Last changed by {saved.updated_by}, {LONG.format(new Date(saved.updated_at))}.
        </p>
      ) : null}
    </div>
  );
}
