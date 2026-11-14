import clsx from 'clsx';
import {
  ArrowSquareOut,
  Bank,
  CaretRight,
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
  Percent,
  Plus,
  Pulse,
  ShieldCheck,
  UsersThree,
  X,
  type Icon as PhosphorIcon,
} from '@phosphor-icons/react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';

import { MediaField, WEB_URL } from '@/components/cms/MediaPicker';
import { Button, ErrorState, FIELD_BASE, Input, LoadingState, PageHeader, PaneHeader, SettingsShell, Toggle, type SettingsNavGroup } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useQuery } from '@/hooks/useApi';
import { ApiError, api } from '@/lib/api';
import type { MediaAsset } from '@/types/cms';

import { Alerts } from './settings/Alerts';
import { BankDetailsSettings } from './settings/BankDetailsSettings';
import { BookingSchedule } from './settings/BookingSchedule';
import { DocumentCategories } from './settings/DocumentCategories';
import { Health } from './settings/Health';
import { Newsletter } from './settings/Newsletter';
import { Security } from './settings/Security';
import { OpeningHours } from './settings/OpeningHours';
import { ProjectStages } from './settings/ProjectStages';
import { useAuth } from '@/lib/auth';
import { UsersSection } from './settings/Users';
import { VatSettings } from './settings/VatSettings';

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

type PageKey = 'about' | 'services' | 'portfolio' | 'booking' | 'quote' | 'contact' | 'privacy' | 'terms' | 'cookies';

/** Settings › Pages, in the order the site's menu has them. */
const PAGES: Array<[PageKey, string]> = [
  ['about', 'About'],
  ['services', 'Services'],
  ['portfolio', 'Portfolio'],
  ['booking', 'Booking'],
  ['quote', 'Design & price (quote maker)'],
  ['contact', 'Contact'],
  ['privacy', 'Privacy policy'],
  ['terms', 'Terms'],
  ['cookies', 'Cookie policy'],
];

/** The panes, and the group each belongs to. Their ids are the addresses (/settings/hours), so they stay as they are. */
const PANES: Record<string, { label: string; detail: string; Icon: PhosphorIcon }> = {
  website: { label: 'Website', detail: 'Live or coming soon, opening time', Icon: Globe },
  pages: { label: 'Pages', detail: 'Switch pages of the website on or off', Icon: Files },
  brand: { label: 'Logo & icon', detail: 'Logos and the browser-tab icon', Icon: PaintBrush },
  health: { label: 'Health', detail: 'Storage, database, cache and errors', Icon: Pulse },
  hours: { label: 'Opening hours', detail: 'When the studio is open, with notes', Icon: Clock },
  booking: { label: 'Booking', detail: 'Hours, breaks and the booking form', Icon: CalendarBlank },
  stages: { label: 'Project stages', detail: 'The stages a project moves through', Icon: Kanban },
  documents: { label: 'Document categories', detail: 'What a file can be filed under', Icon: FolderSimple },
  bank: { label: 'Bank details', detail: 'Where clients pay, printed on invoices', Icon: Bank },
  vat: { label: 'VAT', detail: 'The rate new quotes and invoices start with', Icon: Percent },
  emails: { label: 'Emails', detail: 'Where enquiries and bookings go', Icon: EnvelopeSimple },
  newsletter: { label: 'Newsletter', detail: 'Subscribers and newsletters', Icon: Newspaper },
  alerts: { label: 'Alerts', detail: 'Who is emailed when something breaks', Icon: BellRinging },
  users: { label: 'Users', detail: 'Invite people and choose their role', Icon: UsersThree },
  security: { label: 'Security', detail: 'Who signed in and what changed, from where', Icon: ShieldCheck },
};

const GROUPS: Array<{ id: string; label: string; detail: string; panes: string[] }> = [
  { id: 'website', label: 'Website', detail: 'What visitors see, and whether the site is open to them.', panes: ['website', 'pages', 'brand', 'health'] },
  { id: 'bookings', label: 'Bookings', detail: 'When the studio is open and when people can book a consultation.', panes: ['hours', 'booking'] },
  { id: 'business', label: 'Business', detail: 'How projects, files, quotes and invoices are set up.', panes: ['stages', 'documents', 'bank', 'vat'] },
  { id: 'communication', label: 'Communication', detail: 'Where enquiries are emailed, and the newsletter you send out.', panes: ['emails', 'newsletter', 'alerts'] },
  { id: 'people', label: 'People', detail: 'Who can sign in, with which role, and what they have done.', panes: ['users', 'security'] },
];

/** The settings panes, flat and in group order. */
export const SETTINGS_SECTIONS: Array<{ id: string; label: string; detail: string; Icon: PhosphorIcon }> = GROUPS.flatMap((group) =>
  group.panes.map((id) => ({ id, ...PANES[id]! })),
);

/** What an Infra manager can open: the platform's switches and who can sign in. The business's own panes stay the Admin's. */
const INFRA_SECTIONS = new Set(['health', 'website', 'pages', 'users', 'alerts', 'security']);
const ADMIN_NEVER = new Set(['health', 'alerts', 'security']);

const mayOpen = (id: string, isInfra: boolean) => (isInfra ? INFRA_SECTIONS.has(id) : !ADMIN_NEVER.has(id));

export const settingsSections = (isInfra: boolean) => SETTINGS_SECTIONS.filter(({ id }) => mayOpen(id, isInfra));

/** The groups with only the panes this person may open; a group left empty is dropped. */
export const settingsGroups = (isInfra: boolean): SettingsNavGroup[] =>
  GROUPS.map((group) => ({
    id: group.id,
    label: group.label,
    detail: group.detail,
    sections: group.panes.filter((id) => mayOpen(id, isInfra)).map((id) => ({ id, ...PANES[id]! })),
  })).filter((group) => group.sections.length > 0);

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
 * only (the API enforces the same). `/settings` lists the groups; a pane opens
 * beside them.
 */
export function SiteSettingsPage() {
  const { section = '' } = useParams();
  const { isInfra } = useAuth();
  const groups = settingsGroups(isInfra);
  if (!section) return <SettingsIndex groups={groups} />;
  if (!settingsSections(isInfra).some((row) => row.id === section)) return <Navigate to="/settings" replace />;

  let pane: ReactNode;
  if (section === 'health') pane = <Health />;
  else if (section === 'booking') pane = <BookingSchedule />;
  else if (section === 'hours') pane = <OpeningHours />;
  else if (section === 'stages') pane = <ProjectStages />;
  else if (section === 'documents') pane = <DocumentCategories />;
  else if (section === 'bank') pane = <BankDetailsSettings />;
  else if (section === 'vat') pane = <VatSettings />;
  else if (section === 'newsletter') pane = <Newsletter />;
  else if (section === 'users') pane = <UsersSection />;
  else if (section === 'alerts') pane = <Alerts />;
  else if (section === 'security') pane = <Security />;
  else pane = <GeneralPane section={section as 'website' | 'pages' | 'brand' | 'emails'} />;

  return (
    <SettingsShell label="Settings" groups={groups} active={section} to={(id) => `/settings/${id}`}>
      {pane}
    </SettingsShell>
  );
}

/** `/settings`: every group as a card, each pane a row with its one plain line. */
function SettingsIndex({ groups }: { groups: SettingsNavGroup[] }) {
  return (
    <div className="px-5 pb-16 pt-3 sm:px-8">
      <PageHeader title="Settings" description="Everything that can be set up, by what it is for." />
      <div className="grid gap-5 lg:grid-cols-2">
        {groups.map((group) => (
          <section key={group.id} aria-labelledby={`settings-${group.id}`} className="rounded-card bg-surface p-2 shadow-soft">
            <div className="px-3 pb-2 pt-3">
              <h2 id={`settings-${group.id}`} className="text-base font-semibold tracking-tight text-ink">
                {group.label}
              </h2>
              <p className={HELP}>{group.detail}</p>
            </div>
            <ul>
              {group.sections.map(({ id, label, detail, Icon }) => (
                <li key={id}>
                  <Link
                    to={`/settings/${id}`}
                    className="flex items-center gap-3 rounded-[10px] px-3 py-2.5 transition-colors hover:bg-ink/[0.04] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring/40 pointer-coarse:min-h-14"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-green-900/[0.08] text-green-900">
                      <Icon size={18} aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-ink">{label}</span>
                      <span className="block text-[13px] leading-snug text-ink-muted">{detail}</span>
                    </span>
                    <CaretRight size={14} aria-hidden="true" className="shrink-0 text-ink-muted" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
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
