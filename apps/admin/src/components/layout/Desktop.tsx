import clsx from 'clsx';
import {
  CaretLeft,
  Gear,
  Key,
  MagnifyingGlass,
  Moon,
  SignOut,
  Sun,
  WifiSlash,
} from '@phosphor-icons/react';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';

import { EnzoMark } from './AuthScreen';
import { MODIFIER } from './SearchPalette';

import { Button, Input, Modal } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { ApiError, api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { initials } from '@/lib/format';
import type { LoginResponse } from '@/types/api';
import { useTheme } from '@/lib/theme';

/**
 * macOS-style app shell: a glass menu bar on top and one window below it,
 * inset with rounded corners the way a Mac app window sits on the desktop.
 * The Enzo mark opens the app menu (Settings, search, account); the app's
 * other menus (AdminLayout's CMS menu) follow it. The window's title bar
 * carries the traffic lights, a back button, the title and its own actions.
 *
 * apps/portal has an older copy of this file, with its pages listed inline in
 * the menu bar. It is not part of v1 and was left as it was.
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

/** Your own password. The API checks the current one and hashes the new one. */
function ChangePassword({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const { adopt } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const close = () => {
    setCurrent('');
    setNext('');
    setAgain('');
    setError(null);
    onClose();
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (next.length < 12) return setError('Use at least 12 characters for the new password.');
    if (next !== again) return setError('The two new passwords do not match.');
    setPending(true);
    try {
      // The change signs out every other session; this one carries on with
      // the fresh token the API hands back.
      adopt(await api.put<LoginResponse>('/auth/password', { current_password: current, new_password: next }));
      toast.success('Password changed. You have been signed out everywhere else.');
      close();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'That did not work. Try again.');
    } finally {
      setPending(false);
    }
  };

  return (
    <Modal open={open} onClose={close} title="Change password" width="sm">
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <Input label="Current password" type="password" autoComplete="current-password" value={current} onChange={(event) => setCurrent(event.target.value)} />
        <Input label="New password" type="password" autoComplete="new-password" hint="At least 12 characters." value={next} onChange={(event) => setNext(event.target.value)} />
        <Input label="New password again" type="password" autoComplete="new-password" value={again} onChange={(event) => setAgain(event.target.value)} />
        {error ? (
          <p role="alert" className="rounded-control bg-danger-bg px-3 py-2 text-sm text-danger">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={pending}>
            Change password
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function Desktop({
  appName,
  menus,
  title,
  back,
  context,
  windowActions,
  onSearch,
  settingsTo,
}: {
  appName: string;
  /** The app's menus, after its name in the menu bar. */
  menus?: ReactNode;
  /** The window's title. */
  title: string;
  /** Where the title bar's back button goes, when there is somewhere to go back to. */
  back?: { to: string; label: string } | null;
  /** Handed to the pages through useOutletContext. */
  context?: unknown;
  /** Controls in the right of the window's title bar. */
  windowActions?: ReactNode;
  /** Opens the search palette; shows the menu-bar magnifier when set. */
  onSearch?: () => void;
  /** Where Settings… goes. Omitted for accounts that cannot change settings. */
  settingsTo?: string;
}) {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const online = useOnline();
  const [changingPassword, setChangingPassword] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLElement>(null);

  // A new page starts at the top of the window, and open menus get out of the way.
  useEffect(() => {
    // A section link (#hero) scrolls itself; anything else starts at the top.
    if (!window.location.hash) scrollRef.current?.scrollTo({ top: 0 });
    hidePopover('user-menu');
    hidePopover('app-menu');
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
        {/* The app menu, where a Mac app keeps its name: settings, account, sign out. */}
        <button
          type="button"
          popoverTarget="app-menu"
          aria-label={`${appName} menu`}
          className="flex h-7 shrink-0 items-center gap-2 rounded-[6px] px-2 hover:bg-ink/10 pointer-coarse:h-10"
        >
          <EnzoMark className="h-[18px] w-[36px] text-green-900 dark:text-ink" />
          <span className="hidden whitespace-nowrap font-bold sm:inline">{appName}</span>
        </button>
        {menus}

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

      {/* App menu. */}
      <div
        id="app-menu"
        popover="auto"
        className="glass fixed inset-auto left-2 top-11 m-0 w-64 rounded-[12px] border border-glass-border p-1.5 text-sm text-ink shadow-window pointer-coarse:top-[3.25rem]"
      >
        <div className="flex items-center gap-2.5 px-2 py-2">
          <span className="flex h-9 w-12 shrink-0 items-center justify-center rounded-[9px] bg-green-900 text-on-primary">
            <EnzoMark className="h-4 w-8" />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-semibold">{appName}</span>
            <span className="block truncate text-xs text-ink-muted">Signed in as {user?.name}</span>
          </span>
        </div>
        <div className="my-1 h-px bg-border" />
        {settingsTo ? (
          <Link
            to={settingsTo}
            onClick={() => hidePopover('app-menu')}
            className={clsx(menuItem, 'hover:bg-green-900 hover:text-on-primary')}
          >
            <Gear size={15} aria-hidden="true" />
            <span className="flex-1">Settings…</span>
            <kbd className="font-sans text-xs opacity-70">{MODIFIER} ,</kbd>
          </Link>
        ) : null}
        {onSearch ? (
          <button
            type="button"
            onClick={() => {
              hidePopover('app-menu');
              onSearch();
            }}
            className={clsx(menuItem, 'hover:bg-green-900 hover:text-on-primary')}
          >
            <MagnifyingGlass size={15} aria-hidden="true" />
            <span className="flex-1">Search…</span>
            <kbd className="font-sans text-xs opacity-70">{MODIFIER} K</kbd>
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => {
            hidePopover('app-menu');
            setChangingPassword(true);
          }}
          className={clsx(menuItem, 'hover:bg-green-900 hover:text-on-primary')}
        >
          <Key size={15} aria-hidden="true" />
          Change password
        </button>
        <div className="my-1 h-px bg-border" />
        <button type="button" onClick={logout} className={clsx(menuItem, 'hover:bg-danger hover:text-white')}>
          <SignOut size={15} aria-hidden="true" />
          Sign out
        </button>
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
        <button type="button" onClick={toggle} className={clsx(menuItem, 'hover:bg-green-900 hover:text-on-primary')}>
          {theme === 'dark' ? <Sun size={15} aria-hidden="true" /> : <Moon size={15} aria-hidden="true" />}
          {themeLabel}
        </button>
        <button
          type="button"
          onClick={() => {
            hidePopover('user-menu');
            setChangingPassword(true);
          }}
          className={clsx(menuItem, 'hover:bg-green-900 hover:text-on-primary')}
        >
          <Key size={15} aria-hidden="true" />
          Change password
        </button>
        <button type="button" onClick={logout} className={clsx(menuItem, 'hover:bg-danger hover:text-white')}>
          <SignOut size={15} aria-hidden="true" />
          Sign out
        </button>
      </div>

      {/* ------------------------------------------------------------ Window */}
      {/* One window on the desktop, inset from the menu bar and the screen's
          edges with rounded corners, the way a Mac app window sits. Each page
          still lays itself out across the window's full width. */}
      <div className="flex min-h-0 flex-1 flex-col p-2 sm:p-3">
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
          <p className="truncate text-center text-[13px] font-semibold text-ink">{title}</p>
          <div className="flex items-center justify-end gap-1.5">{windowActions}</div>
        </div>

        <main ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
          <Outlet context={context} />
        </main>
      </section>
      </div>

      <ChangePassword open={changingPassword} onClose={() => setChangingPassword(false)} />
    </div>
  );
}
