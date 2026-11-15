import {
  Armchair,
  Browsers,
  Buildings,
  CalendarBlank,
  CaretDown,
  ChatCircle,
  Check,
  CloudCheck,
  Envelope,
  GearSix,
  ImagesSquare,
  Kanban,
  ListBullets,
  Question,
  ChatsCircle,
  FileText,
  Receipt,
  SquaresFour,
  Star,
  Tray,
  User,
  UsersThree,
  type Icon as PhosphorIcon,
} from '@phosphor-icons/react';
import clsx from 'clsx';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { NavLink, useLocation, useOutletContext } from 'react-router-dom';

import { PAGES } from '@/components/cms/guide';
import { Button } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useQuery } from '@/hooks/useApi';
import { ApiError, api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { disconnectSocket } from '@/lib/socket';
import { useTheme } from '@/lib/theme';
import { useUnreadCount } from '@/hooks/useUnreadCount';
import { SETTINGS_SECTIONS, settingsSections } from '@/pages/SiteSettings';
import type { CmsCollection, CmsOverview } from '@/types/cms';

import type { BarPage } from './BottomBar';
import { Badge, Desktop } from './Desktop';
import { InstallPrompt } from '@/components/InstallPrompt';
import { PullToRefresh } from '@/components/PullToRefresh';
import { PushPrompt } from '@/components/PushToggle';
import { Notifications } from './Notifications';
import { SearchPalette, focusSearch } from './SearchPalette';

/**
 * The Enzo Interiors admin. In this version it manages the public website:
 * its content (the CMS menu below), consultation bookings, and its settings;
 * and the CRM: the client book and the projects board (Admin, and Designers
 * for the projects assigned to them and those projects' clients), and invoices
 * (Admin only).
 *
 * Each section is one kind of content. Pages hold the words of each page; the
 * rest are the things several pages share — a service appears on the home
 * page, the services page, its own page and the booking form — so each gets
 * its own place rather than being edited inside whichever page shows it.
 *
 * Invoices (Admin only) are routed too, and Messages (Admin, and Designers
 * for the clients of their projects).
 */
export const SECTIONS: Array<{
  to: string;
  label: string;
  collection: CmsCollection;
  Icon: PhosphorIcon;
}> = [
  { to: '/pages', label: 'Pages', collection: 'pages', Icon: Browsers },
  { to: '/services', label: 'Services', collection: 'services', Icon: Armchair },
  { to: '/recent-work', label: 'Recent work', collection: 'portfolio', Icon: ImagesSquare },
  { to: '/testimonials', label: 'Testimonials', collection: 'testimonials', Icon: Star },
  { to: '/team', label: 'Team', collection: 'team', Icon: UsersThree },
  { to: '/faqs', label: 'FAQs', collection: 'faqs', Icon: Question },
  { to: '/menu', label: 'Menu', collection: 'navigation', Icon: ListBullets },
  { to: '/company', label: 'Company', collection: 'company', Icon: Buildings },
];

/** What every CMS screen gets from the shell. */
export interface CmsShell {
  /** Null until the first load, or when it failed (see `error`). */
  overview: CmsOverview | null;
  error: string | null;
  /** Re-reads the unpublished-change counts after a save, publish or delete. */
  refresh: () => void;
  /** Opens the search palette. */
  openSearch: (seed?: string) => void;
  /** Re-reads the new-enquiries count behind the menu bar badge. */
  refreshEnquiries: () => void;
}

export function useCmsShell(): CmsShell {
  return useOutletContext<CmsShell>();
}

/**
 * A menu-bar menu: pointing at the name drops its list. A name with a screen
 * of its own (Website, Settings) opens it on a click; a group (Work, Inbox)
 * has none, so a click, a tap or Enter opens and closes the list instead.
 * Keyboard: ArrowDown opens it and moves through it, Escape closes.
 *
 * It is a manual popover rather than a child of the menu bar so it lands in
 * the top layer — see the stacking note in Desktop.tsx.
 */
function MenuBarMenu({
  id,
  label,
  to,
  end,
  active = false,
  badge = 0,
  children,
}: {
  id: string;
  label: string;
  /** The menu's own screen. Without one the name only opens the list. */
  to?: string;
  end?: boolean;
  /** Also lit on these screens (the path match only covers `to`). */
  active?: boolean;
  /** What is waiting inside, added up. */
  badge?: number;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const closing = useRef(0);
  const touched = useRef(false);
  const { pathname } = useLocation();

  useEffect(() => {
    const el = menu.current;
    if (!el) return;
    if (open) {
      el.style.left = `${trigger.current?.getBoundingClientRect().left ?? 8}px`;
      if (!el.matches(':popover-open')) el.showPopover();
    } else if (el.matches(':popover-open')) {
      el.hidePopover();
    }
  }, [open]);

  // Choosing something closes the menu, as it does on a Mac.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => () => window.clearTimeout(closing.current), []);

  // A manual popover has no light dismiss: a press anywhere else closes it.
  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menu.current?.contains(target) && !trigger.current?.contains(target)) setOpen(false);
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);

  // A short grace period, so crossing the gap between the title and the menu
  // (or overshooting its edge) does not snap it shut.
  const hover = (next: boolean) => (event: { pointerType: string }) => {
    if (event.pointerType !== 'mouse') return;
    window.clearTimeout(closing.current);
    if (next) setOpen(true);
    else closing.current = window.setTimeout(() => setOpen(false), 180);
  };

  const items = () => Array.from(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
  const onKeyDown = (event: KeyboardEvent) => {
    const list = items();
    const at = list.indexOf(document.activeElement as HTMLElement);
    const focus = (index: number) => list[(index + list.length) % list.length]?.focus();
    if (event.key === 'Escape') {
      setOpen(false);
      trigger.current?.focus();
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) setOpen(true);
      // The popover has to be showing before anything in it can take focus.
      requestAnimationFrame(() => focus(event.key === 'ArrowDown' ? at + 1 : at < 0 ? -1 : at - 1));
    } else if (event.key === 'Home' || event.key === 'End') {
      if (at < 0) return;
      event.preventDefault();
      focus(event.key === 'Home' ? 0 : -1);
    } else if (event.key === 'Tab' && open) {
      setOpen(false);
    }
  };

  const shared = {
    'aria-haspopup': 'menu' as const,
    'aria-expanded': open,
    'aria-controls': id,
    onPointerEnter: hover(true),
    onPointerLeave: hover(false),
    onKeyDown,
  };
  const look = (isActive: boolean) =>
    clsx(
      'flex h-7 items-center gap-1 rounded-[6px] px-2.5 transition-colors duration-100 pointer-coarse:h-10',
      open ? 'bg-ink/15 text-ink' : isActive || active ? 'bg-ink/10' : 'text-ink/85 hover:bg-ink/10',
    );
  const name = (
    <>
      {label}
      <Badge count={badge} />
      <CaretDown size={10} aria-hidden="true" className="text-ink-muted" />
    </>
  );

  return (
    <>
      {to ? (
        <NavLink ref={trigger as RefObject<HTMLAnchorElement>} to={to} end={end} {...shared} className={({ isActive }) => look(isActive)}>
          {name}
        </NavLink>
      ) : (
        <button
          ref={trigger as RefObject<HTMLButtonElement>}
          type="button"
          {...shared}
          onPointerDown={(event) => {
            touched.current = event.pointerType !== 'mouse';
          }}
          // The mouse has already opened it by pointing; touch and the keyboard (detail 0) toggle.
          onClick={(event) => setOpen((was) => (touched.current || event.detail === 0 ? !was : true))}
          className={look(false)}
        >
          {name}
        </button>
      )}

      <div
        ref={menu}
        id={id}
        role="menu"
        aria-label={label}
        popover="manual"
        onPointerEnter={hover(true)}
        onPointerLeave={hover(false)}
        onKeyDown={onKeyDown}
        className="glass fixed inset-auto top-10 m-0 max-h-[calc(100dvh-3rem)] w-72 overflow-y-auto rounded-[10px] border border-glass-border p-1.5 text-[13px] text-ink shadow-window pointer-coarse:top-12"
      >
        {children(() => setOpen(false))}
      </div>
    </>
  );
}

const MENU_HEADING = 'flex items-center px-2 pb-0.5 pt-1.5 text-[11px] font-semibold text-ink-muted';

/** A menu-bar title that is just a link, for a screen with no menu of its own. */
function MenuBarLink({ to, label, end, badge = 0 }: { to: string; label: string; end?: boolean; badge?: number }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        clsx(
          'flex h-7 items-center rounded-[6px] px-2.5 transition-colors duration-100 pointer-coarse:h-10',
          isActive ? 'bg-ink/10' : 'text-ink/85 hover:bg-ink/10',
        )
      }
    >
      {label}
      <Badge count={badge} />
    </NavLink>
  );
}

/** Website: the CMS overview, every page and every kind of shared content. */
function CmsMenu({ counts, active }: { counts: CmsOverview['counts']; active: boolean }) {
  const shared = SECTIONS.filter((section) => section.collection !== 'pages');
  return (
    <MenuBarMenu id="cms-menu" label="Website" to="/cms" end active={active}>
      {(close) => (
        <>
          <MenuItem to="/cms" end label="Overview" onChoose={close} />
          <Separator />
          <p className={MENU_HEADING} aria-hidden="true">
            Pages
            <Badge count={counts.pages?.dirty ?? 0} />
          </p>
          {Object.entries(PAGES).map(([slug, page]) => (
            <MenuItem key={slug} to={`/pages/${slug}`} label={page.name} hint={page.path ?? ''} onChoose={close} />
          ))}
          <Separator />
          <p className={MENU_HEADING} aria-hidden="true">
            Shared content
          </p>
          {shared.map(({ to, label, collection, Icon }) => (
            <MenuItem
              key={to}
              to={to}
              label={label}
              Icon={Icon}
              hint={collection === 'company' ? '' : String(counts[collection]?.total ?? '')}
              badge={counts[collection]?.dirty ?? 0}
              onChoose={close}
            />
          ))}
        </>
      )}
    </MenuBarMenu>
  );
}

/** Work and Inbox: a group of screens under one name, each with what is waiting on it. */
function GroupMenu({ id, label, pages }: { id: string; label: string; pages: BarPage[] }) {
  if (pages.length === 0) return null;
  return (
    <MenuBarMenu
      id={id}
      label={label}
      active={pages.some((page) => page.active)}
      badge={pages.reduce((sum, page) => sum + (page.badge ?? 0), 0)}
    >
      {(close) =>
        pages.map((page) => (
          <MenuItem key={page.to} to={page.to} label={page.label} Icon={page.Icon} active={page.active} badge={page.badge} onChoose={close} />
        ))
      }
    </MenuBarMenu>
  );
}

/** Who reaches the CRM (clients, projects): Admin, and Designers for their assigned work. Never Editors. */
export const CLIENT_ROLES = ['Admin', 'Designer', 'Installer'] as const;
/** Who edits the website: Admin and Editor. Never Designers or Installers. */
export const CMS_ROLES = ['Admin', 'Editor'] as const;
/** Who links their own Gmail and uses Mail: Admin, Designer and Editor. Never Installers or Infra. */
/** Who uses staff chat: the whole studio team. Never Infra or clients. */
export const TEAM_ROLES = ['Admin', 'Designer', 'Installer', 'Editor'] as const;
export const MAIL_ROLES = ['Admin', 'Designer', 'Editor'] as const;

/** The lists on the Clients screen, addressed as /clients?view=inactive. */
export const CLIENT_VIEWS = [
  { id: 'all', label: 'All clients' },
  { id: 'active', label: 'Active' },
  { id: 'inactive', label: 'Inactive' },
] as const;

/** The views of the Projects screen, addressed as /projects?view=list. */
export const PROJECT_VIEWS = [
  { id: 'board', label: 'Board' },
  { id: 'list', label: 'List' },
] as const;

/** The lists on the Invoices screen, addressed as /invoices?view=overdue. */
export const INVOICE_VIEWS = [
  { id: 'all', label: 'All invoices' },
  { id: 'draft', label: 'Drafts' },
  { id: 'sent', label: 'Sent' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'paid', label: 'Paid' },
] as const;

/** Settings: each pane, as in its sidebar. */
function SettingsMenu() {
  const { isInfra } = useAuth();
  return (
    <MenuBarMenu id="settings-menu" label="Settings" to="/settings">
      {(close) =>
        settingsSections(isInfra).map(({ id, label, Icon }) => (
          <MenuItem key={id} to={`/settings/${id}`} label={label} Icon={Icon} onChoose={close} />
        ))
      }
    </MenuBarMenu>
  );
}

function Separator() {
  return <div role="separator" className="mx-2 my-1 h-px bg-ink/10" />;
}

/** A menu row: tick for where you are, label, and a muted hint where a Mac shows the shortcut. */
function MenuItem({
  to,
  end,
  label,
  hint,
  badge = 0,
  Icon,
  active,
  onChoose,
}: {
  to: string;
  end?: boolean;
  label: string;
  hint?: ReactNode;
  badge?: number;
  Icon?: PhosphorIcon;
  /** Overrides the path match, for items that differ only by their query. */
  active?: boolean;
  onChoose: () => void;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      role="menuitem"
      tabIndex={-1}
      onClick={onChoose}
      className="group flex min-h-7 items-center gap-1.5 rounded-[6px] px-1.5 outline-none hover:bg-green-900 hover:text-on-primary focus-visible:bg-green-900 focus-visible:text-on-primary pointer-coarse:min-h-11"
    >
      {({ isActive }) => (
        <>
          <span className="flex w-4 shrink-0 justify-center">
            {(active ?? isActive) ? <Check size={12} weight="bold" aria-label="Current" /> : null}
          </span>
          {Icon ? <Icon size={15} aria-hidden="true" className="shrink-0 opacity-80" /> : null}
          <span className="min-w-0 flex-1 truncate">{label}</span>
          <Badge count={badge} />
          {hint ? (
            <span className="tabular shrink-0 pl-3 text-[12px] text-ink-muted group-hover:text-on-primary/75 group-focus-visible:text-on-primary/75">
              {hint}
            </span>
          ) : null}
        </>
      )}
    </NavLink>
  );
}

/** Screens whose heading is just their name. */
const TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/cms': 'CMS',
  '/clients': 'Clients',
  '/projects': 'Projects',
  '/quotes': 'Quotes',
  '/invoices': 'Invoices',
  '/enquiries': 'Enquiries',
  '/bookings': 'Bookings',
  '/messages': 'Messages',
  '/team': 'Team',
  '/mail': 'Mail',
  '/settings': 'Settings',
  '/account': 'Account',
};

/** The heading the shell shows for where you are (a page's own <PageHeader> replaces it), and the way back. */
function usePageTitle(): { title: string; back: { to: string; label: string } | null } {
  const { pathname } = useLocation();
  const known = TITLES[pathname];
  if (known) return { title: known, back: null };
  if (pathname.startsWith('/settings/')) {
    const pane = SETTINGS_SECTIONS.find(({ id }) => pathname === `/settings/${id}`);
    return { title: pane?.label ?? 'Settings', back: null };
  }
  // A client's and a project's own page carry their way back inside their header card.
  if (pathname.startsWith('/clients/')) return { title: 'Client', back: null };
  if (pathname.startsWith('/projects/')) return { title: 'Project', back: null };
  // A quote's top bar carries its own way back.
  if (pathname.startsWith('/quotes/')) return { title: 'Quote', back: null };
  const section = SECTIONS.find(({ to }) => pathname === to || pathname.startsWith(`${to}/`));
  if (!section) return { title: 'Enzo Interiors', back: null };
  // An editor (a page, an entry, the company record) carries its own way back in its save bar.
  const editing = pathname !== section.to || section.collection === 'company' || section.collection === 'pages';
  return { title: section.label, back: editing ? null : { to: '/cms', label: 'CMS' } };
}

export function AdminLayout() {
  const toast = useToast();
  const { isAdmin, isInfra, logout, can } = useAuth();
  // Settings: an Admin has every pane, an Infra manager the ones that run the platform.
  const canSettings = isAdmin;
  const canSeeClients = can(...CLIENT_ROLES);
  const canCms = can(...CMS_ROLES);
  // Mail is in the menu only once the server has Google's keys for it.
  const mailConfigured = useQuery<{ configured: boolean }>(can(...MAIL_ROLES) ? '/mailbox/status' : null).data?.configured === true;
  const unreadMessages = useUnreadCount(canSeeClients);
  const canTeam = can(...TEAM_ROLES);
  const unreadTeam = useUnreadCount(canTeam, '/team/unread-count', ['team:message', 'data:changed']);
  // The shell only exists while signed in: leaving it (sign-out) closes the socket.
  useEffect(() => () => disconnectSocket(), []);
  const { toggle: toggleTheme } = useTheme();
  const overview = useQuery<CmsOverview>(canCms ? '/cms/overview' : null);
  const enquiries = useQuery<{ new_count: number }>(isAdmin ? '/enquiries?limit=1' : null);
  const refreshEnquiries = enquiries.refetch;
  const [publishing, setPublishing] = useState(false);
  const openSearch = focusSearch;
  const { title, back } = usePageTitle();
  const { pathname } = useLocation();

  // Keyed on refetch, which is stable per path; `overview` itself is a new
  // object every render and would re-render every screen below on each one.
  const { refetch } = overview;
  const refresh = useCallback(() => void refetch(), [refetch]);
  const counts = overview.data?.counts ?? {};
  const unpublished = Object.values(counts).reduce((total, count) => total + count.dirty, 0);

  const publishAll = async () => {
    setPublishing(true);
    try {
      const result = await api.post<{ published: number }>('/cms/publish');
      refresh();
      toast.success(
        result.published === 0
          ? 'Everything was already live.'
          : `Published ${result.published} ${result.published === 1 ? 'change' : 'changes'}. The website is updating now.`,
      );
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'That did not publish.');
    } finally {
      setPublishing(false);
    }
  };

  // Every screen this person may open, in the menu bar's groups.
  const at = (to: string) => pathname === to || pathname.startsWith(`${to}/`);
  const page = (to: string, label: string, Icon: PhosphorIcon, badge = 0): BarPage => ({ to, label, Icon, active: at(to), badge });
  const home = canSeeClients || isInfra ? [page('/', 'Dashboard', SquaresFour)] : [];
  const work = [
    ...(canSeeClients ? [page('/clients', 'Clients', User), page('/projects', 'Projects', Kanban)] : []),
    ...(isAdmin
      ? [page('/quotes', 'Quotes', FileText), page('/invoices', 'Invoices', Receipt)]
      : []),
  ];
  const inbox = [
    ...(isAdmin ? [page('/enquiries', 'Enquiries', Tray, enquiries.data?.new_count ?? 0), page('/bookings', 'Bookings', CalendarBlank)] : []),
    ...(canSeeClients ? [page('/messages', 'Messages', ChatCircle, unreadMessages)] : []),
    ...(canTeam ? [page('/team', 'Team', ChatsCircle, unreadTeam)] : []),
    ...(mailConfigured ? [page('/mail', 'Mail', Envelope)] : []),
  ];
  // /team itself is staff chat (it wins the route); /team/<slug> is the CMS's team entry.
  const onWebsite = at('/cms') || SECTIONS.some(({ to }) => at(to) && pathname !== '/team');
  const website = canCms ? [{ ...page('/cms', 'Website', Browsers), active: onWebsite }] : [];
  const settings = canSettings ? [page('/settings', 'Settings', GearSix)] : [];
  // The bottom bar (below lg) leads with the four reached for most on a phone; the rest follow in menu order.
  const all = [...home, ...inbox, ...work, ...website, ...settings];
  const first = ['/', '/projects', '/clients', '/bookings'];
  const pages = [...first.flatMap((to) => all.filter((entry) => entry.to === to)), ...all.filter((entry) => !first.includes(entry.to))];

  const context = useMemo<CmsShell>(
    () => ({ overview: overview.data, error: overview.error, refresh, openSearch, refreshEnquiries: () => void refreshEnquiries() }),
    [overview.data, overview.error, refresh, openSearch, refreshEnquiries],
  );

  return (
    <>
    <Desktop
      appName="Enzo Interiors"
      pages={pages}
      search={<SearchPalette actions={{ isAdmin, clients: canSeeClients, cms: canCms, unpublished, publishAll: () => void publishAll(), toggleTheme, signOut: logout }} />}
      settingsTo={canSettings ? '/settings' : '/account'}
      menus={
        <>
          {canSeeClients || isInfra ? <MenuBarLink to="/" label="Dashboard" end /> : null}
          <GroupMenu id="work-menu" label="Work" pages={work} />
          <GroupMenu id="inbox-menu" label="Inbox" pages={inbox} />
          {canCms ? <CmsMenu counts={counts} active={onWebsite} /> : null}
          {canSettings ? <SettingsMenu /> : null}
        </>
      }
      status={<Notifications onChange={refresh} />}
      title={title}
      back={back}
      context={context}
      windowActions={
        <>
          {isAdmin && unpublished > 0 ? (
            <Button
              variant="primary"
              onClick={publishAll}
              loading={publishing}
              icon={<CloudCheck size={16} />}
              className="min-h-8 whitespace-nowrap px-2.5 text-[13px] pointer-fine:min-h-8"
            >
              Publish<span className="hidden sm:inline">&nbsp;all</span>&nbsp;({unpublished})
            </Button>
          ) : null}
        </>
      }
    />
    <InstallPrompt appName="Enzo Interiors" />
    <PullToRefresh />
    <PushPrompt detail="Messages from clients, new bookings and anything waiting on you, even when the app is closed." />
    </>
  );
}
