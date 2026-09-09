import clsx from 'clsx';
import {
  CalendarDays,
  FileText,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Menu,
  Moon,
  Newspaper,
  ReceiptText,
  Settings,
  Sun,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from '@/lib/auth';
import { initials } from '@/lib/format';
import { useTheme } from '@/lib/theme';
import { useUnreadCount } from '@/hooks/useUnreadCount';

/**
 * Admin shell: persistent sidebar on desktop, slide-over on mobile.
 *
 * The nav order is fixed by the UI/UX brief ("Desktop sidebar: Dashboard,
 * Clients, Bookings, Quotes & Pricing, Projects, Invoices, Messages, Content
 * and Settings") and by websitemap.md §3. Do not reorder it for taste.
 */

const NAV = [
  { to: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { to: '/clients', label: 'Clients', Icon: Users },
  { to: '/bookings', label: 'Bookings', Icon: CalendarDays },
  { to: '/quotes', label: 'Quotes & Pricing', Icon: FileText },
  { to: '/projects', label: 'Projects', Icon: FolderKanban },
  { to: '/invoices', label: 'Invoices', Icon: ReceiptText },
  { to: '/messages', label: 'Messages', Icon: MessageSquare, badge: 'unread' as const },
  { to: '/content', label: 'Content', Icon: Newspaper },
  { to: '/settings', label: 'Settings', Icon: Settings },
];

/** Offline banner. The brief requires a clear reconnection message, not a break. */
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
      You are offline — showing the last data loaded. Reconnecting…
    </div>
  );
}

export function AdminLayout() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const unread = useUnreadCount();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  // Close the mobile drawer whenever the route changes, so tapping a link
  // does not leave the overlay covering the page it just opened.
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const nav = (
    <nav className="flex flex-1 flex-col gap-0.5 p-2" aria-label="Main">
      {NAV.map(({ to, label, Icon, badge }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            clsx(
              'flex min-h-11 items-center gap-3 rounded-control px-3 text-sm font-semibold transition-colors duration-[160ms]',
              isActive
                ? 'bg-green-100 text-green-900'
                : 'text-ink-muted hover:bg-surface-muted hover:text-ink',
            )
          }
        >
          <Icon size={18} aria-hidden="true" className="shrink-0" />
          <span className="flex-1">{label}</span>
          {badge === 'unread' && unread > 0 ? (
            <span className="tabular rounded-control bg-green-900 px-1.5 py-0.5 text-xs font-bold text-on-primary">
              {unread}
            </span>
          ) : null}
        </NavLink>
      ))}
    </nav>
  );

  const footer = (
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
          <p className="truncate text-xs text-ink-muted">{user?.role}</p>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={toggle}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-control border border-border text-sm font-semibold text-ink-muted transition-colors hover:text-ink"
        >
          {theme === 'dark' ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
          {theme === 'dark' ? 'Light' : 'Dark'}
        </button>
        <button
          type="button"
          onClick={logout}
          className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-control border border-border text-sm font-semibold text-ink-muted transition-colors hover:text-danger"
        >
          <LogOut size={16} aria-hidden="true" />
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-dvh bg-canvas">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface lg:flex">
        <div className="flex h-14 items-center gap-2.5 border-b border-border px-4">
          <span
            aria-hidden="true"
            className="flex h-7 w-7 items-center justify-center rounded-[4px] bg-green-900 text-xs font-bold text-on-primary"
          >
            E
          </span>
          <span className="text-sm font-bold tracking-tight text-ink">Enzo Admin</span>
        </div>
        {nav}
        {footer}
      </aside>

      {/* Mobile slide-over */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-ink/40"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative flex h-full w-72 max-w-[85vw] flex-col border-r border-border bg-surface">
            <div className="flex h-14 items-center justify-between border-b border-border px-4">
              <span className="text-sm font-bold tracking-tight text-ink">Enzo Admin</span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
                className="flex min-h-11 min-w-11 items-center justify-center rounded-control text-ink-muted hover:text-ink"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            {nav}
            {footer}
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <ConnectionBanner />
        {/* Mobile top bar */}
        <header className="flex h-14 items-center gap-3 border-b border-border bg-surface px-3 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            className="flex min-h-11 min-w-11 items-center justify-center rounded-control text-ink"
          >
            <Menu size={20} aria-hidden="true" />
          </button>
          <span className="text-sm font-bold tracking-tight text-ink">Enzo Admin</span>
        </header>

        <main className="min-w-0 flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
