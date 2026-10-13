import clsx from 'clsx';
import {
  CaretDown,
  CaretLeft,
  MagnifyingGlass,
  Moon,
  SignOut,
  Sun,
  UserCircle,
  WifiSlash,
  type Icon as PhosphorIcon,
} from '@phosphor-icons/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';

import { MODIFIER } from './SearchPalette';

import { useAuth } from '@/lib/auth';
import { initials, roleLabel } from '@/lib/format';
import { useTheme } from '@/lib/theme';

/**
 * macOS-style app shell: a glass menu bar on top and one window below it,
 * inset with rounded corners the way a Mac app window sits on the desktop.
 * The menu bar starts with the app's name (plain text, not a menu) and the
 * app's menus (AdminLayout's CMS, Bookings, Settings); on the right are
 * search, the bell and your own account menu. Below xl there is no room for the
 * menus, so the name and the current page become one button that opens every
 * page as a list (the same page menu as apps/portal). The window's title bar carries
 * the traffic lights, a back button, the title and its own actions.
 *
 * apps/portal has its own copy of this shell (its pages inline, no menus); the
 * two share the look, not the code.
 *
 * Stacking note: the window is deliberately NOT positioned, transformed or
 * blurred. Any of those would trap the pages' `fixed` modals inside it. Only
 * the menu bar uses backdrop blur, which is also why a menu that drops out of
 * it is a top-layer popover rather than its child: a blurred parent stops its
 * children from blurring what is behind them.
 */

function useOnline() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return online;
}

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 15_000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <time dateTime={now.toISOString()} className="tabular whitespace-nowrap">
      <span className="hidden 2xl:inline">
        {now.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
        &nbsp;&nbsp;
      </span>
      {now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
    </time>
  );
}

function hidePopover(id: string) {
  const el = document.getElementById(id);
  if (el?.matches(':popover-open')) el.hidePopover();
}

export function Badge({ count, inverted = false }: { count: number; inverted?: boolean }) {
  if (count <= 0) return null;
  return (
    <span
      className={clsx(
        'tabular ml-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold',
        inverted ? 'bg-on-primary text-green-900' : 'bg-badge text-white',
      )}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

/** One entry of the page menu (below xl): where it goes, and whether you are there. */
export interface DesktopPage {
  to: string;
  label: string;
  Icon: PhosphorIcon;
  active: boolean;
  /** Count shown beside the label (unread messages, new enquiries). */
  badge?: number;
}

export function Desktop({
  appName,
  pages,
  menus,
  title,
  back,
  context,
  windowActions,
  onSearch,
  settingsTo,
  status,
}: {
  appName: string;
  /** Every page, listed by the page menu below xl. */
  pages: DesktopPage[];
  /** The app's menus, after its name in the menu bar (xl and up). */
  menus?: ReactNode;
  /** The window's title: a name, or a breadcrumb trail. */
  title: ReactNode;
  /** Where the title bar's back button goes, when there is somewhere to go back to. */
  back?: { to: string; label: string } | null;
  /** Handed to the pages through useOutletContext. */
  context?: unknown;
  /** Controls in the right of the window's title bar. */
  windowActions?: ReactNode;
  /** Opens the search palette; shows the menu-bar magnifier when set. */
  onSearch?: () => void;
  /** Where Ctrl/⌘ , goes. Omitted for accounts that cannot change settings. */
  settingsTo?: string;
  /** Menu-bar extras left of the account menu (the notification bell). */
  status?: ReactNode;
}) {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const online = useOnline();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLElement>(null);
  const current = pages.find((page) => page.active);
  // Pending counts on the pages you are not on, so the closed button still tells you.
  const pending = pages.reduce((sum, page) => sum + (page.active ? 0 : (page.badge ?? 0)), 0);

  // A new page starts at the top of the window, and open menus get out of the way.
  useEffect(() => {
    // A section link (#hero) scrolls itself; anything else starts at the top.
    if (!window.location.hash) scrollRef.current?.scrollTo({ top: 0 });
    hidePopover('page-menu');
    hidePopover('user-menu');
    hidePopover('notifications-menu');
  }, [pathname]);

  // Ctrl/⌘ , opens Settings, as it does in every Mac app.
  useEffect(() => {
    if (!settingsTo) return;
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === ',') {
        event.preventDefault();
        navigate(settingsTo);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [settingsTo, navigate]);

  const themeLabel = theme === 'dark' ? 'Light appearance' : 'Dark appearance';
  const menuItem = 'flex min-h-9 w-full items-center gap-2.5 rounded-[7px] px-2 text-left pointer-coarse:min-h-11';

  return (
    <div className="wallpaper flex h-dvh flex-col overflow-hidden text-ink">
      {/* ---------------------------------------------------------- Menu bar */}
      <header className="glass relative z-40 flex h-10 shrink-0 items-center gap-0.5 border-b border-glass-border px-2 text-[13px] font-semibold pointer-coarse:h-12">
        {/* Below xl the name and the current page are the page menu. */}
        <button
          type="button"
          popoverTarget="page-menu"
          className="flex h-8 min-w-0 items-center gap-1 rounded-[6px] px-2 font-bold hover:bg-ink/10 pointer-coarse:h-10 xl:hidden"
        >
          <span className="shrink-0 whitespace-nowrap">{appName}</span>
          {current ? <span className="hidden min-w-0 truncate font-medium text-ink-muted min-[380px]:inline">· {current.label}</span> : null}
          <CaretDown size={12} aria-hidden="true" className="shrink-0 text-ink-muted" />
          <Badge count={pending} />
        </button>
        {/* From xl up, the app's name where a Mac keeps it (just a name: nothing to click), then its menus. */}
        <span className="hidden shrink-0 cursor-default select-none whitespace-nowrap px-2 font-bold xl:inline">
          {appName}
        </span>
        <div className="hidden xl:contents">{menus}</div>

        <span className="ml-auto flex shrink-0 items-center gap-1">
          {onSearch ? (
            <button
              type="button"
              onClick={onSearch}
              aria-label={`Search (${MODIFIER} K)`}
              title={`Search (${MODIFIER} K)`}
              className="flex h-7 w-8 items-center justify-center rounded-[6px] hover:bg-ink/10 pointer-coarse:h-10 pointer-coarse:w-10"
            >
              <MagnifyingGlass size={15} weight="bold" aria-hidden="true" />
            </button>
          ) : null}
          {online ? null : (
            <span role="status" className="flex items-center gap-1.5 rounded-full bg-warning-bg px-2 py-0.5 text-xs text-warning">
              <WifiSlash size={13} aria-hidden="true" />
              Offline<span className="hidden 2xl:inline"> — showing last data, reconnecting…</span>
            </span>
          )}
          <button
            type="button"
            onClick={toggle}
            aria-label={themeLabel}
            title={themeLabel}
            className="hidden h-7 w-8 items-center justify-center rounded-[6px] hover:bg-ink/10 sm:flex"
          >
            {theme === 'dark' ? <Sun size={15} aria-hidden="true" /> : <Moon size={15} aria-hidden="true" />}
          </button>
          <span className="hidden px-1.5 sm:inline">
            <Clock />
          </span>
          {status}
          <button
            type="button"
            popoverTarget="user-menu"
            aria-label="Account menu"
            className="flex h-8 items-center gap-2 rounded-[6px] px-1.5 hover:bg-ink/10 pointer-coarse:h-10"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-900 text-[10px] font-bold text-on-primary">
              {user ? initials(user.name) : '—'}
            </span>
            <span className="hidden max-w-40 truncate 2xl:inline">{user?.name}</span>
          </button>
        </span>
      </header>

      {/* Page menu (below xl): native popover, so light-dismiss and Escape come free. */}
      <div
        id="page-menu"
        popover="auto"
        className="glass fixed inset-auto left-2 top-11 m-0 max-h-[calc(100dvh-4rem)] w-64 overflow-y-auto rounded-[12px] border border-glass-border p-1.5 text-sm text-ink shadow-window pointer-coarse:top-[3.25rem]"
      >
        <nav aria-label="Pages">
          <ul>
            {pages.map(({ to, label, Icon, active, badge }) => (
              <li key={to}>
                <Link
                  to={to}
                  aria-current={active ? 'page' : undefined}
                  // Same page, new query: the path is unchanged, so close it here too.
                  onClick={() => hidePopover('page-menu')}
                  className={clsx(menuItem, active ? 'bg-green-900 font-semibold text-on-primary' : 'hover:bg-ink/[0.08]')}
                >
                  <Icon size={17} aria-hidden="true" weight={active ? 'fill' : 'regular'} />
                  <span className="flex-1">{label}</span>
                  <Badge count={badge ?? 0} inverted={active} />
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      {/* Account menu. */}
      <div
        id="user-menu"
        popover="auto"
        className="glass fixed inset-auto right-2 top-11 m-0 w-64 rounded-[12px] border border-glass-border p-1.5 text-sm text-ink shadow-window pointer-coarse:top-[3.25rem]"
      >
        <div className="flex items-center gap-2.5 px-2 py-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-900 text-xs font-bold text-on-primary">
            {user ? initials(user.name) : '—'}
          </span>
          <span className="min-w-0">
            <span className="flex items-baseline gap-1.5">
              <span className="truncate font-semibold">{user?.name}</span>
              <span className="shrink-0 text-xs text-ink-muted">{roleLabel(user?.role)}</span>
            </span>
            <span className="block truncate text-xs text-ink-muted">{user?.email}</span>
          </span>
        </div>
        <div className="my-1 h-px bg-border" />
        <Link
          to="/account"
          onClick={() => hidePopover('user-menu')}
          className={clsx(menuItem, 'hover:bg-green-900 hover:text-on-primary')}
        >
          <UserCircle size={15} aria-hidden="true" />
          Account settings…
        </Link>
        <button type="button" onClick={toggle} className={clsx(menuItem, 'hover:bg-green-900 hover:text-on-primary')}>
          {theme === 'dark' ? <Sun size={15} aria-hidden="true" /> : <Moon size={15} aria-hidden="true" />}
          {themeLabel}
        </button>
        <div className="my-1 h-px bg-border" />
        <button type="button" onClick={logout} className={clsx(menuItem, 'hover:bg-danger hover:text-white')}>
          <SignOut size={15} aria-hidden="true" />
          Sign out
        </button>
        <p className="px-2 pb-1 pt-2 text-[11.5px] text-ink-muted">
          Made by{' '}
          <a href="https://www.npatelgroup.ltd" target="_blank" rel="noopener" className="font-semibold hover:text-ink hover:underline">
            NPATEL GROUP LTD
          </a>
        </p>
      </div>

      {/* ------------------------------------------------------------ Window */}
      {/* One window on the desktop, inset from the menu bar and the screen's
          edges with rounded corners, the way a Mac app window sits. Each page
          still lays itself out across the window's full width. */}
      <div className="flex min-h-0 flex-1 flex-col px-1.5 pb-[calc(env(safe-area-inset-bottom)+0.375rem)] pt-1.5 sm:p-3">
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[14px] bg-canvas shadow-window">
        <div className="grid h-11 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-border bg-surface px-3">
          <div className="flex min-w-0 items-center gap-3">
            <span aria-hidden="true" className="hidden gap-2 sm:flex">
              <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
              <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
              <span className="h-3 w-3 rounded-full bg-[#28c840]" />
            </span>
            {back ? (
              <Link
                to={back.to}
                className="flex min-h-9 min-w-0 items-center gap-0.5 rounded-[7px] pl-1 pr-2 text-sm font-semibold text-ink-muted hover:bg-surface-muted hover:text-ink pointer-coarse:min-h-11"
              >
                <CaretLeft size={16} aria-hidden="true" className="shrink-0" />
                <span className="truncate">{back.label}</span>
              </Link>
            ) : null}
          </div>
          <div className="flex min-w-0 justify-center truncate text-center text-[13px] font-semibold text-ink">{title}</div>
          <div className="flex items-center justify-end gap-1.5">{windowActions}</div>
        </div>

        <main ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
          <Outlet context={context} />
        </main>
      </section>
      </div>

    </div>
  );
}
