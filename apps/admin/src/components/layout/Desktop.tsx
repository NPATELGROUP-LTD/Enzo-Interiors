import clsx from 'clsx';
import {
  ArrowSquareOut,
  CaretLeft,
  MagnifyingGlass,
  Moon,
  SignOut,
  Sun,
  UserCircle,
  WifiSlash,
} from '@phosphor-icons/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';

import { BottomBar, type BarPage } from './BottomBar';
import { LegalLinks } from './LegalLinks';
import { MODIFIER } from './SearchPalette';

import { useAuth } from '@/lib/auth';
import { initials, roleLabel } from '@/lib/format';
import { useTheme } from '@/lib/theme';
import { WEB_URL } from '@/components/cms/MediaPicker';
import { RouteBoundary } from '@/components/ui/ErrorBoundary';

/**
 * The app shell: a glass menu bar on top, the page's heading under it, and the
 * page itself straight on the page background (cards float on it; there is no
 * window around them). The menu bar starts with the app's name (plain text) and
 * the app's menus (AdminLayout's Dashboard, Work, Inbox, Website, Settings); on
 * the right are search, the bell and your own account menu. Below lg there is
 * no room for the menus, so the pages move to a bottom bar of icons with the
 * rest under More (BottomBar.tsx).
 *
 * The heading row names the page top left (with a way back where there is one)
 * and holds its buttons top right. A page that knows a better name or has
 * buttons of its own puts them there through <PageHeader> (components/ui),
 * which fills the two slots below. The row does not scroll with the page, so
 * full-height pages (Messages, Mail, the CMS editor) keep their own layout.
 *
 * apps/portal has its own copy of this shell (its pages inline, no menus); the
 * two share the look, not the code.
 *
 * Stacking note: the page area is deliberately NOT positioned, transformed or
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
  /** Every page this person may open, in the bottom bar's order (below lg). */
  pages: BarPage[];
  /** The app's menus, after its name in the menu bar (lg and up). */
  menus?: ReactNode;
  /** The page's heading, unless the page gives its own through <PageHeader>. */
  title: string;
  /** Where the heading's back link goes, when there is somewhere to go back to. */
  back?: { to: string; label: string } | null;
  /** Handed to the pages through useOutletContext. */
  context?: unknown;
  /** Shell-wide buttons at the right of the heading row (Publish all). */
  windowActions?: ReactNode;
  /** Opens the search palette; shows the menu-bar magnifier when set. */
  onSearch?: (seed?: string) => void;
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

  // A new page starts at the top, and open menus get out of the way.
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
    <div className="flex h-dvh flex-col overflow-hidden bg-canvas text-ink">
      {/* ---------------------------------------------------------- Menu bar */}
      <header className="glass relative z-40 flex h-10 shrink-0 items-center gap-0.5 border-b border-glass-border px-2 text-[13px] font-semibold pointer-coarse:h-12">
        {/* The app's name where a Mac keeps it (just a name: nothing to click), then its menus. */}
        <span className="shrink-0 cursor-default select-none whitespace-nowrap px-2 font-bold">{appName}</span>
        <div className="hidden lg:contents">{menus}</div>

        {/* The search bar sits in the middle and takes what room the menus and the right-hand cluster leave. */}
        <div className="flex min-w-0 flex-1 justify-center px-2">
          {onSearch ? (
            <button
              type="button"
              onClick={() => onSearch()}
              // Typing straight onto the bar opens the results with those letters already in.
              onKeyDown={(event) => {
                if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey && event.key !== ' ') {
                  event.preventDefault();
                  onSearch(event.key);
                }
              }}
              aria-label={`Search (${MODIFIER} K)`}
              title={`Search (${MODIFIER} K)`}
              className="flex h-7 w-full max-w-md min-w-8 items-center justify-center gap-2 rounded-[8px] border border-glass-border bg-ink/[0.04] px-2.5 font-normal text-ink-muted transition-colors hover:bg-ink/10 hover:text-ink md:justify-start pointer-coarse:h-10"
            >
              <MagnifyingGlass size={14} weight="bold" aria-hidden="true" className="shrink-0" />
              <span className="hidden min-w-0 flex-1 truncate text-left md:inline">Search clients, projects, pages…</span>
              <kbd className="hidden shrink-0 rounded-[5px] border border-border px-1.5 text-[11px] xl:block">{MODIFIER} K</kbd>
            </button>
          ) : null}
        </div>

        <span className="flex shrink-0 items-center gap-1">
          {windowActions}
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
        <a href={WEB_URL} target="_blank" rel="noopener" className={clsx(menuItem, 'hover:bg-green-900 hover:text-on-primary')}>
          <ArrowSquareOut size={15} aria-hidden="true" />
          View website
        </a>
        <button type="button" onClick={toggle} className={clsx(menuItem, 'hover:bg-green-900 hover:text-on-primary')}>
          {theme === 'dark' ? <Sun size={15} aria-hidden="true" /> : <Moon size={15} aria-hidden="true" />}
          {themeLabel}
        </button>
        <div className="my-1 h-px bg-border" />
        <button type="button" onClick={logout} className={clsx(menuItem, 'hover:bg-danger hover:text-white')}>
          <SignOut size={15} aria-hidden="true" />
          Sign out
        </button>
        <LegalLinks className="px-2 pt-2 text-[11.5px] text-ink-muted" />
        <p className="px-2 pb-1 text-[11.5px] text-ink-muted">
          Made by{' '}
          <a href="https://www.npatelgroup.ltd" target="_blank" rel="noopener" className="font-semibold hover:text-ink hover:underline">
            NPATEL GROUP LTD
          </a>
        </p>
      </div>

      {/* ------------------------------------------------------- Page heading */}
      {/* A row only when it has something to hold (a way back, a heading the page gave, buttons); pb-3 keeps scrolled cards off the text. */}
      <div className="page-head flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 pb-3 pt-4 sm:px-8">
        <div className="flex min-w-0 items-center gap-2">
          {back ? (
            <Link
              to={back.to}
              aria-label={`Back to ${back.label}`}
              className="-ml-1.5 flex min-h-9 shrink-0 items-center gap-0.5 rounded-[7px] pl-1 pr-2 text-sm font-semibold text-ink-muted hover:bg-surface-muted hover:text-ink pointer-coarse:min-h-11"
            >
              <CaretLeft size={16} aria-hidden="true" className="shrink-0" />
              <span className="hidden sm:inline">{back.label}</span>
            </Link>
          ) : null}
          {/* <PageHeader> puts the page's own heading here; until it does, the section's name shows. */}
          <div id="page-title" className="min-w-0" />
          {/* The section's name stays for screen readers only: the menu bar already shows where you are. */}
          <h1 className="sr-only [#page-title:not(:empty)+&]:hidden">{title}</h1>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div id="page-actions" className="contents" />
        </div>
      </div>

      {/* --------------------------------------------------------------- Page */}
      <main ref={scrollRef} className="relative min-h-0 flex-1 overflow-y-auto">
        <RouteBoundary><Outlet context={context} /></RouteBoundary>
      </main>

      <BottomBar pages={pages} />
    </div>
  );
}
