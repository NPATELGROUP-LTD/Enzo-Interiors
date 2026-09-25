import {
  Armchair,
  ArrowSquareOut,
  Browsers,
  Buildings,
  Check,
  CloudCheck,
  ImagesSquare,
  ListBullets,
  Question,
  Star,
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
import { Button } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useQuery } from '@/hooks/useApi';
import { ApiError, api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import type { CmsCollection, CmsOverview } from '@/types/cms';

import { Badge, Desktop } from './Desktop';
import { Notifications } from './Notifications';
import { SearchPalette } from './SearchPalette';

/**
 * The Enzo Interiors admin. In this version it manages the public website:
 * its content (the CMS menu below), consultation bookings, and its settings.
 *
 * Each section is one kind of content. Pages hold the words of each page; the
 * rest are the things several pages share — a service appears on the home
 * page, the services page, its own page and the booking form — so each gets
 * its own place rather than being edited inside whichever page shows it.
 *
 * The CRM screens (clients, quotes, projects...) are still in src/pages but
 * are not routed, because the v1 API does not serve them. See App.tsx.
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
}

export function useCmsShell(): CmsShell {
  return useOutletContext<CmsShell>();
}

/**
 * The menu bar's one menu, the way a Mac app's menus work: pointing at "CMS"
 * drops the list of everything that can be edited, clicking it opens the
 * overview. Keyboard: ArrowDown opens it and moves through it, Escape closes.
 * Touch has no hover, so a tap goes straight to the overview, which lists the
 * same things.
 *
 * It is a manual popover rather than a child of the menu bar so it lands in
 * the top layer — see the stacking note in Desktop.tsx.
 */
function CmsMenu({ counts }: { counts: CmsOverview['counts'] }) {
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

  const shared = SECTIONS.filter((section) => section.collection !== 'pages');
  const heading = 'flex items-center px-2 pb-0.5 pt-1.5 text-[11px] font-semibold text-ink-muted';

  return (
    <>
      <NavLink
        ref={trigger}
        to="/cms"
        end
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="cms-menu"
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
        CMS
      </NavLink>

      <div
        ref={menu}
        id="cms-menu"
        role="menu"
        aria-label="CMS"
        popover="manual"
        onPointerEnter={hover(true)}
        onPointerLeave={hover(false)}
        onKeyDown={onKeyDown}
        className="glass fixed inset-auto top-10 m-0 max-h-[calc(100dvh-3rem)] w-72 overflow-y-auto rounded-[10px] border border-glass-border p-1.5 text-[13px] text-ink shadow-window"
      >
        <MenuItem to="/cms" end label="Overview" onChoose={() => setOpen(false)} />
        <Separator />
        <p className={heading} aria-hidden="true">
          Pages
          <Badge count={counts.pages?.dirty ?? 0} />
        </p>
        {Object.entries(PAGES).map(([slug, page]) => (
          <MenuItem
            key={slug}
            to={`/pages/${slug}`}
            label={page.name}
            hint={page.path ?? ''}
            onChoose={() => setOpen(false)}
          />
        ))}
        <Separator />
        <p className={heading} aria-hidden="true">
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
            onChoose={() => setOpen(false)}
          />
        ))}
      </div>
    </>
  );
}

/** A plain menu-bar item that goes straight to a screen, like CMS without its menu. */
function MenuBarLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        clsx(
          'flex h-7 items-center rounded-[6px] px-2.5 transition-colors duration-100 pointer-coarse:h-10',
          isActive ? 'bg-ink/10' : 'text-ink/85 hover:bg-ink/10',
        )
      }
    >
      {children}
    </NavLink>
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
  onChoose,
}: {
  to: string;
  end?: boolean;
  label: string;
  hint?: ReactNode;
  badge?: number;
  Icon?: PhosphorIcon;
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
            {isActive ? <Check size={12} weight="bold" aria-label="Current" /> : null}
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
function useWindowTitle(): { title: string; back: { to: string; label: string } | null } {
  const { pathname } = useLocation();
  if (pathname.startsWith('/settings')) return { title: 'Settings', back: null };
  if (pathname === '/bookings') return { title: 'Bookings', back: null };
  if (pathname === '/account') return { title: 'Account', back: null };
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
  const { isAdmin, logout } = useAuth();
  const { toggle: toggleTheme } = useTheme();
  const overview = useQuery<CmsOverview>('/cms/overview');
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

  const context = useMemo<CmsShell>(
    () => ({ overview: overview.data, error: overview.error, refresh, openSearch }),
    [overview.data, overview.error, refresh, openSearch],
  );

  return (
    <>
    <SearchPalette
      open={searching}
      onClose={() => setSearching(false)}
      actions={{ isAdmin, unpublished, publishAll: () => void publishAll(), toggleTheme, signOut: logout }}
    />
    <Desktop
      appName="Enzo Interiors"
      onSearch={openSearch}
      settingsTo={isAdmin ? '/settings' : '/account'}
      menus={
        <>
          <CmsMenu counts={counts} />
          {isAdmin ? <MenuBarLink to="/bookings">Bookings</MenuBarLink> : null}
          {isAdmin ? <MenuBarLink to="/settings">Settings</MenuBarLink> : null}
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
              className="min-h-8 px-2.5 text-[13px] pointer-fine:min-h-8"
            >
              Publish all ({unpublished})
            </Button>
          ) : null}
        </>
      }
    />
    </>
  );
}
