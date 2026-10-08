import clsx from 'clsx';
import {
  CaretDown,
  CaretLeft,
  GearSix,
  Moon,
  SignOut,
  Sun,
  WifiSlash,
  type Icon as PhosphorIcon,
} from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';

import { useUnreadCount } from '@/hooks/useUnreadCount';
import { useAuth } from '@/lib/auth';
import { initials } from '@/lib/format';
import { useTheme } from '@/lib/theme';

/**
 * macOS-style desktop shell: a glass menu bar on top and one window that fills
 * everything below it. The pages sit in the menu bar the way a Mac app's menus
 * do. From xl up they are listed inline; below that the app name opens them as
 * a dropdown menu.
 *
 * apps/admin has its own, newer copy of this shell (menus instead of a page
 * list); the two share the look, not the code.
 *
 * Stacking note: the window is deliberately NOT positioned, transformed or
 * blurred. Any of those would trap the pages' `fixed` modals inside it. Only
 * the menu bar uses backdrop blur.
 */

export interface DesktopApp {
  to: string;
  label: string;
  Icon: PhosphorIcon;
  /** Shows the unread-message count. */
  badge?: boolean;
}

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

function Badge({ count, inverted = false }: { count: number; inverted?: boolean }) {
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

export function Desktop({ appName, apps }: { appName: string; apps: DesktopApp[] }) {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const unread = useUnreadCount();
  const online = useOnline();
  const { pathname } = useLocation();
  const scrollRef = useRef<HTMLElement>(null);

  // Prefix match, so /clients/42 still lights up Clients.
  const current = apps.find((app) => pathname === app.to || pathname.startsWith(`${app.to}/`));
  const isDetail = current ? pathname !== current.to : false;

  // A new page starts at the top of the window, and open menus get out of the way.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
    hidePopover('page-menu');
    hidePopover('user-menu');
  }, [pathname]);

  const themeLabel = theme === 'dark' ? 'Light appearance' : 'Dark appearance';
  const menuItem = 'flex min-h-9 w-full items-center gap-2.5 rounded-[7px] px-2 text-left pointer-coarse:min-h-11';

  return (
    <div className="wallpaper flex h-dvh flex-col overflow-hidden text-ink">
      {/* ---------------------------------------------------------- Menu bar */}
      <header className="glass relative z-40 flex h-10 shrink-0 items-center gap-1 border-b border-glass-border px-2 text-[13px] font-semibold pointer-coarse:h-12">
        {/* Below xl the app name is the page menu. */}
        <button
          type="button"
          popoverTarget="page-menu"
          className="flex h-8 items-center gap-1 rounded-[6px] px-2 font-bold hover:bg-ink/10 pointer-coarse:h-10 xl:hidden"
        >
          {appName}
          <span className="hidden font-medium text-ink-muted min-[380px]:inline">· {current?.label}</span>
          <CaretDown size={12} aria-hidden="true" className="text-ink-muted" />
          {unread > 0 && current?.badge !== true ? <Badge count={unread} /> : null}
        </button>
        <span className="hidden px-2 font-bold xl:inline">{appName}</span>

        <nav aria-label="Pages" className="hidden xl:block">
          <ul className="flex items-center gap-0.5">
            {apps.map((app) => (
              <li key={app.to}>
                <NavLink
                  to={app.to}
                  className={({ isActive }) =>
                    clsx(
                      'flex h-7 items-center whitespace-nowrap rounded-[6px] px-2.5 transition-colors duration-[120ms]',
                      isActive ? 'bg-green-900 text-on-primary' : 'font-medium text-ink/80 hover:bg-ink/10 hover:text-ink',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {app.label}
                      {app.badge ? <Badge count={unread} inverted={isActive} /> : null}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <span className="ml-auto flex shrink-0 items-center gap-1">
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
        className="glass fixed inset-auto left-2 top-11 m-0 w-64 rounded-[12px] border border-glass-border p-1.5 text-sm text-ink shadow-window pointer-coarse:top-[3.25rem]"
      >
        <nav aria-label="Pages">
          <ul>
            {apps.map((app) => (
              <li key={app.to}>
                <NavLink
                  to={app.to}
                  className={({ isActive }) =>
                    clsx(menuItem, isActive ? 'bg-green-900 font-semibold text-on-primary' : 'hover:bg-ink/[0.08]')
                  }
                >
                  {({ isActive }) => (
                    <>
                      <app.Icon size={17} aria-hidden="true" weight={isActive ? 'fill' : 'regular'} />
                      <span className="flex-1">{app.label}</span>
                      {app.badge ? <Badge count={unread} inverted={isActive} /> : null}
                    </>
                  )}
                </NavLink>
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
            <span className="block truncate font-semibold">{user?.name}</span>
            <span className="block truncate text-xs text-ink-muted">{user?.kind === 'Staff' ? user.role : user?.email}</span>
          </span>
        </div>
        <div className="my-1 h-px bg-border" />
        <Link to="/settings" className={clsx(menuItem, 'hover:bg-green-900 hover:text-on-primary')}>
          <GearSix size={15} aria-hidden="true" />
          Settings
        </Link>
        <button type="button" onClick={toggle} className={clsx(menuItem, 'hover:bg-green-900 hover:text-on-primary')}>
          {theme === 'dark' ? <Sun size={15} aria-hidden="true" /> : <Moon size={15} aria-hidden="true" />}
          {themeLabel}
        </button>
        <button type="button" onClick={logout} className={clsx(menuItem, 'hover:bg-danger hover:text-white')}>
          <SignOut size={15} aria-hidden="true" />
          Sign out
        </button>
        <div className="my-1 h-px bg-border" />
        <a
          href="https://www.npatelgroup.ltd"
          target="_blank"
          rel="noopener"
          className="block rounded-[7px] px-2 py-1.5 text-xs text-ink-muted hover:text-ink"
        >
          Made by NPATEL GROUP LTD
        </a>
      </div>

      {/* ------------------------------------------------------------ Window */}
      <div className="flex min-h-0 flex-1 flex-col px-1.5 pb-[calc(env(safe-area-inset-bottom)+0.375rem)] pt-1.5 sm:px-3 sm:pb-3 sm:pt-2.5">
        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[14px] bg-canvas shadow-window">
          <div className="window-titlebar grid h-11 shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b border-border bg-surface px-3">
            <div className="flex items-center gap-3">
              <span aria-hidden="true" className="hidden gap-2 sm:flex">
                <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
                <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
                <span className="h-3 w-3 rounded-full bg-[#28c840]" />
              </span>
              {isDetail && current ? (
                <Link
                  to={current.to}
                  className="flex min-h-9 items-center gap-0.5 rounded-[7px] pl-1 pr-2 text-sm font-semibold text-ink-muted hover:bg-surface-muted hover:text-ink pointer-coarse:min-h-11"
                >
                  <CaretLeft size={16} aria-hidden="true" />
                  {current.label}
                </Link>
              ) : null}
            </div>
            <p className="truncate text-center text-[13px] font-semibold text-ink">{current?.label ?? appName}</p>
            <span />
          </div>

          <main ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6">
            <Outlet />
          </main>
        </section>
      </div>
    </div>
  );
}
