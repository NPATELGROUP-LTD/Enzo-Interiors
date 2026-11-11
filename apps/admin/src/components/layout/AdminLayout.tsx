import {
  Armchair,
  ArrowSquareOut,
  Browsers,
  Buildings,
  CalendarBlank,
  CalendarPlus,
  ChatCircle,
  Check,
  CloudCheck,
  Envelope,
  FilePlus,
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
  UserPlus,
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
} from 'react';
import { flushSync } from 'react-dom';
import { NavLink, useLocation, useOutletContext } from 'react-router-dom';

import { PAGES } from '@/components/cms/guide';
import { WEB_URL } from '@/components/cms/MediaPicker';
import { Button, Crumbs } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useQuery } from '@/hooks/useApi';
import { ApiError, api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { disconnectSocket } from '@/lib/socket';
import { useTheme } from '@/lib/theme';
import { useUnreadCount } from '@/hooks/useUnreadCount';
import { SETTINGS_SECTIONS, settingsSections } from '@/pages/SiteSettings';
import type { CmsCollection, CmsOverview } from '@/types/cms';

import { Badge, Desktop, type DesktopPage } from './Desktop';
import { InstallPrompt } from '@/components/InstallPrompt';
import { PullToRefresh } from '@/components/PullToRefresh';
import { PushPrompt } from '@/components/PushToggle';
import { Notifications } from './Notifications';
import { SearchPalette } from './SearchPalette';

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
  openSearch: () => void;
  /** Re-reads the new-enquiries count behind the menu bar badge. */
  refreshEnquiries: () => void;
}

export function useCmsShell(): CmsShell {
  return useOutletContext<CmsShell>();
}

/**
 * A menu-bar menu, the way a Mac app's menus work: pointing at the name drops
 * its list, clicking it opens its screen. Keyboard: ArrowDown opens it and
 * moves through it, Escape closes. Touch has no hover, so a tap goes straight
 * to the screen, which lists the same things.
 *
 * It is a manual popover rather than a child of the menu bar so it lands in
 * the top layer — see the stacking note in Desktop.tsx.
 */
function MenuBarMenu({
  id,
  label,
  to,
  end,
  children,
}: {
  id: string;
  label: string;
  to: string;
  end?: boolean;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLAnchorElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const closing = useRef(0);
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

  return (
    <>
      <NavLink
        ref={trigger}
        to={to}
        end={end}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        onPointerEnter={hover(true)}
        onPointerLeave={hover(false)}
        onKeyDown={onKeyDown}
        className={({ isActive }) =>
          clsx(
            'flex h-7 items-center rounded-[6px] px-2.5 transition-colors duration-100 pointer-coarse:h-10',
            open ? 'bg-ink/15 text-ink' : isActive ? 'bg-ink/10' : 'text-ink/85 hover:bg-ink/10',
          )
        }
      >
        {label}
      </NavLink>

      <div
        ref={menu}
        id={id}
        role="menu"
        aria-label={label}
        popover="manual"
        onPointerEnter={hover(true)}
        onPointerLeave={hover(false)}
        onKeyDown={onKeyDown}
        className="glass fixed inset-auto top-10 m-0 max-h-[calc(100dvh-3rem)] w-72 overflow-y-auto rounded-[10px] border border-glass-border p-1.5 text-[13px] text-ink shadow-window"
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

/** CMS: every page and every kind of shared content. */
function CmsMenu({ counts }: { counts: CmsOverview['counts'] }) {
  const shared = SECTIONS.filter((section) => section.collection !== 'pages');
  return (
    <MenuBarMenu id="cms-menu" label="CMS" to="/cms" end>
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

/** The lists on the Bookings screen, addressed as /bookings?view=past. */
export const BOOKING_VIEWS = [
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'past', label: 'Past' },
  { id: 'cancelled', label: 'Cancelled' },
] as const;

/** Bookings: its three lists, the month, and a new booking. */
function BookingsMenu() {
  const { pathname, search } = useLocation();
  const view = pathname === '/bookings' ? (new URLSearchParams(search).get('view') ?? 'upcoming') : null;
  return (
    <MenuBarMenu id="bookings-menu" label="Bookings" to="/bookings">
      {(close) => (
        <>
          {BOOKING_VIEWS.map(({ id, label }) => (
            <MenuItem
              key={id}
              to={id === 'upcoming' ? '/bookings' : `/bookings?view=${id}`}
              label={label}
              active={view === id}
              onChoose={close}
            />
          ))}
          <Separator />
          <MenuItem to="/bookings#month" label="Month at a glance" Icon={CalendarBlank} active={false} onChoose={close} />
          <MenuItem to="/bookings?new=1" label="New booking…" Icon={CalendarPlus} active={false} onChoose={close} />
        </>
      )}
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

/** Clients: its lists, and (Admin) a new client. */
function ClientsMenu({ canAdd }: { canAdd: boolean }) {
  const { pathname, search } = useLocation();
  const view = pathname === '/clients' ? (new URLSearchParams(search).get('view') ?? 'all') : null;
  return (
    <MenuBarMenu id="clients-menu" label="Clients" to="/clients">
      {(close) => (
        <>
          {CLIENT_VIEWS.map(({ id, label }) => (
            <MenuItem
              key={id}
              to={id === 'all' ? '/clients' : `/clients?view=${id}`}
              label={label}
              active={view === id}
              onChoose={close}
            />
          ))}
          {canAdd ? (
            <>
              <Separator />
              <MenuItem to="/clients?new=1" label="Add client…" Icon={UserPlus} active={false} onChoose={close} />
            </>
          ) : null}
        </>
      )}
    </MenuBarMenu>
  );
}

/** The views of the Projects screen, addressed as /projects?view=list. */
export const PROJECT_VIEWS = [
  { id: 'board', label: 'Board' },
  { id: 'list', label: 'List' },
] as const;

/** Projects: the board, the list, and (Admin) a new project. */
function ProjectsMenu({ canAdd }: { canAdd: boolean }) {
  const { pathname, search } = useLocation();
  const view = pathname === '/projects' ? (new URLSearchParams(search).get('view') ?? 'board') : null;
  return (
    <MenuBarMenu id="projects-menu" label="Projects" to="/projects">
      {(close) => (
        <>
          {PROJECT_VIEWS.map(({ id, label }) => (
            <MenuItem
              key={id}
              to={`/projects?view=${id}`}
              label={label}
              active={view === id}
              onChoose={close}
            />
          ))}
          {canAdd ? (
            <>
              <Separator />
              <MenuItem to="/projects?new=1" label="New project…" Icon={Kanban} active={false} onChoose={close} />
            </>
          ) : null}
        </>
      )}
    </MenuBarMenu>
  );
}

/** The lists on the Invoices screen, addressed as /invoices?view=overdue. */
export const INVOICE_VIEWS = [
  { id: 'all', label: 'All invoices' },
  { id: 'draft', label: 'Drafts' },
  { id: 'sent', label: 'Sent' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'paid', label: 'Paid' },
] as const;

/** Invoices (Admin): its lists, and a new invoice. */
function InvoicesMenu() {
  const { pathname, search } = useLocation();
  const view = pathname === '/invoices' ? (new URLSearchParams(search).get('view') ?? 'all') : null;
  return (
    <MenuBarMenu id="invoices-menu" label="Invoices" to="/invoices">
      {(close) => (
        <>
          {INVOICE_VIEWS.map(({ id, label }) => (
            <MenuItem
              key={id}
              to={id === 'all' ? '/invoices' : `/invoices?view=${id}`}
              label={label}
              active={view === id}
              onChoose={close}
            />
          ))}
          <Separator />
          <MenuItem to="/invoices?new=1" label="New invoice…" Icon={FilePlus} active={false} onChoose={close} />
        </>
      )}
    </MenuBarMenu>
  );
}

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

/** The window's title and back button, from where you are. */
function useWindowTitle(): { title: ReactNode; back: { to: string; label: string } | null } {
  const { pathname, search } = useLocation();
  if (pathname.startsWith('/settings')) {
    const pane = SETTINGS_SECTIONS.find(({ id }) => pathname === `/settings/${id}`);
    return {
      title: pane ? <Crumbs items={[{ label: 'Settings', to: '/settings' }, { label: pane.label }]} /> : 'Settings',
      back: null,
    };
  }
  if (pathname === '/bookings') {
    const view = BOOKING_VIEWS.find(({ id }) => id === new URLSearchParams(search).get('view'));
    return {
      title: view ? <Crumbs items={[{ label: 'Bookings', to: '/bookings' }, { label: view.label }]} /> : 'Bookings',
      back: null,
    };
  }
  if (pathname === '/clients') {
    const view = CLIENT_VIEWS.find(({ id }) => id !== 'all' && id === new URLSearchParams(search).get('view'));
    return {
      title: view ? <Crumbs items={[{ label: 'Clients', to: '/clients' }, { label: view.label }]} /> : 'Clients',
      back: null,
    };
  }
  if (pathname.startsWith('/clients/')) return { title: 'Client', back: { to: '/clients', label: 'Clients' } };
  if (pathname === '/projects') {
    const view = PROJECT_VIEWS.find(({ id }) => id !== 'board' && id === new URLSearchParams(search).get('view'));
    return {
      title: view ? <Crumbs items={[{ label: 'Projects', to: '/projects' }, { label: view.label }]} /> : 'Projects',
      back: null,
    };
  }
  if (pathname.startsWith('/projects/')) return { title: 'Project', back: { to: '/projects', label: 'Projects' } };
  if (pathname === '/invoices') {
    const view = INVOICE_VIEWS.find(({ id }) => id !== 'all' && id === new URLSearchParams(search).get('view'));
    return {
      title: view ? <Crumbs items={[{ label: 'Invoices', to: '/invoices' }, { label: view.label }]} /> : 'Invoices',
      back: null,
    };
  }
  if (pathname === '/quotes') return { title: 'Quotes', back: null };
  if (pathname.startsWith('/quotes/')) return { title: 'Quotes', back: { to: '/quotes', label: 'Quotes' } };
  if (pathname === '/enquiries') return { title: 'Enquiries', back: null };
  if (pathname === '/account') return { title: 'Account', back: null };
  if (pathname === '/messages') return { title: 'Messages', back: null };
  if (pathname === '/team') return { title: 'Team', back: null };
  if (pathname === '/mail') return { title: 'Mail', back: null };
  if (pathname === '/') return { title: 'Dashboard', back: null };
  const section = SECTIONS.find(({ to }) => pathname === to || pathname.startsWith(`${to}/`));
  if (!section) return { title: pathname === '/cms' ? 'CMS' : 'Enzo Interiors', back: null };
  const isEntry = pathname !== section.to && section.collection !== 'pages';
  return {
    title: section.label,
    back: isEntry ? { to: section.to, label: section.label } : { to: '/cms', label: 'CMS' },
  };
}

export function AdminLayout() {
  const toast = useToast();
  const { isAdmin, isInfra, logout, can } = useAuth();
  // Settings: an Admin has every pane, an Infra manager the ones that run the platform.
  const canSettings = isAdmin || isInfra;
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
  const [searching, setSearching] = useState(false);
  const openSearch = useCallback(() => setSearching(true), []);

  // Ctrl/⌘ K, from anywhere in the app.
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        // Rendered now rather than on the next frame, for the same reason.
        flushSync(() => setSearching(true));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const { title, back } = useWindowTitle();
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

  // The page menu (below xl): the same pages, in the same order, as the menu bar.
  const at = (to: string) => pathname === to || pathname.startsWith(`${to}/`);
  const pages: DesktopPage[] = [
    ...(canSeeClients ? [{ to: '/', label: 'Dashboard', Icon: SquaresFour, active: pathname === '/' }] : []),
    ...(canCms ? [{ to: '/cms', label: 'CMS', Icon: Browsers, active: at('/cms') || SECTIONS.some(({ to }) => at(to)) }] : []),
    ...(canSeeClients
      ? [
          { to: '/clients', label: 'Clients', Icon: User, active: at('/clients') },
          { to: '/projects', label: 'Projects', Icon: Kanban, active: at('/projects') },
          { to: '/messages', label: 'Messages', Icon: ChatCircle, active: at('/messages'), badge: unreadMessages },
        ]
      : []),
    ...(canTeam ? [{ to: '/team', label: 'Team', Icon: ChatsCircle, active: at('/team'), badge: unreadTeam }] : []),
    ...(mailConfigured ? [{ to: '/mail', label: 'Mail', Icon: Envelope, active: at('/mail') }] : []),
    ...(isAdmin
      ? [
          { to: '/invoices', label: 'Invoices', Icon: Receipt, active: at('/invoices') },
          { to: '/quotes', label: 'Quotes', Icon: FileText, active: at('/quotes') },
          { to: '/enquiries', label: 'Enquiries', Icon: Tray, active: at('/enquiries'), badge: enquiries.data?.new_count ?? 0 },
          { to: '/bookings', label: 'Bookings', Icon: CalendarBlank, active: at('/bookings') },
        ]
      : []),
    ...(canSettings ? [{ to: '/settings', label: 'Settings', Icon: GearSix, active: at('/settings') }] : []),
  ];

  const context = useMemo<CmsShell>(
    () => ({ overview: overview.data, error: overview.error, refresh, openSearch, refreshEnquiries: () => void refreshEnquiries() }),
    [overview.data, overview.error, refresh, openSearch, refreshEnquiries],
  );

  return (
    <>
    <SearchPalette
      open={searching}
      onClose={() => setSearching(false)}
      actions={{ isAdmin, clients: canSeeClients, cms: canCms, unpublished, publishAll: () => void publishAll(), toggleTheme, signOut: logout }}
    />
    <Desktop
      appName="Enzo Interiors"
      pages={pages}
      onSearch={openSearch}
      settingsTo={canSettings ? '/settings' : '/account'}
      menus={
        <>
          {canSeeClients ? <MenuBarLink to="/" label="Dashboard" end /> : null}
          {canCms ? <CmsMenu counts={counts} /> : null}
          {canSeeClients ? <ClientsMenu canAdd={can('Admin', 'Designer')} /> : null}
          {canSeeClients ? <ProjectsMenu canAdd={isAdmin} /> : null}
          {canSeeClients ? <MenuBarLink to="/messages" label="Messages" badge={unreadMessages} /> : null}
          {canTeam ? <MenuBarLink to="/team" label="Team" badge={unreadTeam} /> : null}
          {mailConfigured ? <MenuBarLink to="/mail" label="Mail" /> : null}
          {isAdmin ? <InvoicesMenu /> : null}
          {isAdmin ? <MenuBarLink to="/quotes" label="Quotes" /> : null}
          {isAdmin ? <MenuBarLink to="/enquiries" label="Enquiries" badge={enquiries.data?.new_count ?? 0} /> : null}
          {isAdmin ? <BookingsMenu /> : null}
          {canSettings ? <SettingsMenu /> : null}
        </>
      }
      status={<Notifications onChange={refresh} />}
      title={title}
      back={back}
      context={context}
      windowActions={
        <>
          <a
            href={WEB_URL}
            target="_blank"
            rel="noopener"
            className="hidden min-h-8 items-center gap-1.5 rounded-[7px] px-2 text-[13px] font-semibold text-ink-muted hover:bg-surface-muted hover:text-ink sm:flex"
          >
            <ArrowSquareOut size={15} aria-hidden="true" />
            View website
          </a>
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
