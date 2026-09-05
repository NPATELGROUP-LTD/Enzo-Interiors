import clsx from 'clsx';
import {
  FileText,
  FolderOpen,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Moon,
  MoreHorizontal,
  ReceiptText,
  Settings,
  Sun,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';

import { useUnreadCount } from '@/hooks/useUnreadCount';
import { useAuth } from '@/lib/auth';
import { initials } from '@/lib/format';
import { useTheme } from '@/lib/theme';

/**
 * Client Portal shell.
 *
 * The UI/UX brief specifies a bottom dock on mobile with exactly these five
 * entries — "Dashboard, Projects, Messages, Invoices and More" — so the primary
 * dock is fixed at five and the remaining destinations live behind More. On
 * desktop the same destinations become a sidebar, since a bottom dock on a
 * 1440px screen wastes the space and reads as a phone app in a browser.
 */

interface NavEntry {
  to: string;
  label: string;
  Icon: typeof LayoutDashboard;
  /** Shows the unread-message count. Only the Messages entry carries one. */
  badge?: boolean;
}

const PRIMARY: NavEntry[] = [
  { to: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { to: '/projects', label: 'Projects', Icon: FolderOpen },
  { to: '/messages', label: 'Messages', Icon: MessageSquare, badge: true },
  { to: '/invoices', label: 'Invoices', Icon: ReceiptText },
];

const SECONDARY: NavEntry[] = [
  { to: '/quotes', label: 'My Quotes', Icon: FileText },
  { to: '/documents', label: 'Documents', Icon: FolderOpen },
  { to: '/settings', label: 'Settings', Icon: Settings },
];

function ConnectionBanner() {
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  if (!offline) return null;
  return (
    <div role="status" className="bg-warning-bg px-4 py-2 text-center text-warning">
      You are offline — showing the last information loaded. Reconnecting…
    </div>
  );
}

export function PortalLayout() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const unread = useUnreadCount();
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    clsx(
      'flex min-h-11 items-center gap-3 rounded-control px-3 text-sm font-semibold transition-colors duration-[160ms]',
      isActive ? 'bg-green-100 text-green-900' : 'text-ink-muted hover:bg-surface-muted hover:text-ink',
    );

  return (
    <div className="flex min-h-dvh flex-col bg-canvas lg:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface lg:flex">
        <div className="flex h-14 items-center gap-2.5 border-b border-border px-4">
          <span
            aria-hidden="true"
            className="flex h-7 w-7 items-center justify-center rounded-[4px] bg-green-900 text-xs font-bold text-on-primary"
          >
            E
          </span>
          <span className="text-sm font-bold tracking-tight text-ink">Enzo Interiors</span>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 p-2" aria-label="Main">
          {[...PRIMARY, ...SECONDARY].map(({ to, label, Icon, badge }) => (
            <NavLink key={to} to={to} className={navLinkClass}>
              <Icon size={18} aria-hidden="true" className="shrink-0" />
              <span className="flex-1">{label}</span>
              {badge && unread > 0 ? (
                <span className="tabular rounded-control bg-green-900 px-1.5 py-0.5 text-xs font-bold text-on-primary">
                  {unread}
                </span>
              ) : null}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-border p-3">
          <div className="mb-2 flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-green-100 text-xs font-bold text-green-900"
            >
              {user ? initials(user.name) : '—'}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">{user?.name}</p>
              <p className="truncate text-xs text-ink-muted">{user?.email}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={toggle}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-control border border-border text-sm font-semibold text-ink-muted hover:text-ink"
            >
              {theme === 'dark' ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
              {theme === 'dark' ? 'Light' : 'Dark'}
            </button>
            <button
              type="button"
              onClick={logout}
              className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-control border border-border text-sm font-semibold text-ink-muted hover:text-danger"
            >
              <LogOut size={16} aria-hidden="true" />
              Sign out
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <ConnectionBanner />

        {/* Mobile top bar */}
        <header className="flex h-14 items-center gap-2.5 border-b border-border bg-surface px-4 lg:hidden">
          <span
            aria-hidden="true"
            className="flex h-7 w-7 items-center justify-center rounded-[4px] bg-green-900 text-xs font-bold text-on-primary"
          >
            E
          </span>
          <span className="flex-1 text-sm font-bold tracking-tight text-ink">Enzo Interiors</span>
          <button
            type="button"
            onClick={toggle}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-control text-ink-muted"
          >
            {theme === 'dark' ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
          </button>
        </header>

        {/* pb-24 on mobile keeps content clear of the fixed dock. */}
        <main className="min-w-0 flex-1 p-4 pb-24 sm:p-6 sm:pb-24 lg:pb-6">
          <Outlet />
        </main>
      </div>

      {/* Mobile "More" sheet */}
      {moreOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setMoreOpen(false)} aria-hidden="true" />
          <div className="absolute inset-x-0 bottom-0 rounded-t-card border-t border-border bg-surface p-3 pb-6">
            <p className="label-eyebrow px-2 pb-2">More</p>
            <nav className="flex flex-col gap-0.5" aria-label="More destinations">
              {SECONDARY.map(({ to, label, Icon }) => (
                <NavLink key={to} to={to} className={navLinkClass}>
                  <Icon size={18} aria-hidden="true" />
                  {label}
                </NavLink>
              ))}
              <button
                type="button"
                onClick={logout}
                className="flex min-h-11 items-center gap-3 rounded-control px-3 text-sm font-semibold text-danger"
              >
                <LogOut size={18} aria-hidden="true" />
                Sign out
              </button>
            </nav>
          </div>
        </div>
      ) : null}

      {/* Mobile bottom dock */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-surface lg:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {PRIMARY.map(({ to, label, Icon, badge }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              clsx(
                'relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors',
                isActive ? 'text-green-900' : 'text-ink-muted',
              )
            }
          >
            <Icon size={20} aria-hidden="true" />
            {label}
            {badge && unread > 0 ? (
              <span className="tabular absolute right-1/4 top-1.5 rounded-control bg-green-900 px-1 text-[10px] font-bold text-on-primary">
                {unread}
              </span>
            ) : null}
          </NavLink>
        ))}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-label="More destinations"
          aria-expanded={moreOpen}
          className="flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold text-ink-muted"
        >
          <MoreHorizontal size={20} aria-hidden="true" />
          More
        </button>
      </nav>
    </div>
  );
}
