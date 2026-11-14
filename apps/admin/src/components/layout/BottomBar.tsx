import clsx from 'clsx';
import { DotsThree, type Icon as PhosphorIcon } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { barSplit } from '@/lib/bar';

/** One page of the app: where it goes, and whether you are there. */
export interface BarPage {
  to: string;
  label: string;
  Icon: PhosphorIcon;
  active: boolean;
  /** Count shown on it (unread messages, new enquiries). */
  badge?: number;
}

function Count({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="tabular absolute -right-2.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-badge px-1 text-[10px] font-bold text-white">
      {count > 99 ? '99+' : count}
    </span>
  );
}

const SLOT =
  'relative flex h-14 w-full flex-col items-center justify-center gap-0.5 text-[10.5px] font-semibold leading-none focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-focus-ring/35';

/**
 * The bottom bar, below lg: the first pages as icons and the rest under More.
 * How many icons depends on the width (lib/bar.ts). It is part of the page's
 * column, not fixed over it, so nothing is ever hidden behind it, and it pads
 * itself for the iPhone's home indicator. apps/admin and apps/portal keep
 * identical copies.
 */
export function BottomBar({ pages }: { pages: BarPage[] }) {
  const [width, setWidth] = useState(() => window.innerWidth);
  useEffect(() => {
    const update = () => setWidth(window.innerWidth);
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // One page is not a choice: nothing to switch between.
  if (pages.length < 2) return null;
  const { shown, more } = barSplit(pages, width);
  const close = () => {
    const el = document.getElementById('page-menu');
    if (el?.matches(':popover-open')) el.hidePopover();
  };

  return (
    <>
      <nav aria-label="Pages" className="no-print shrink-0 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden">
        {/* Capped so a tablet's icons stay within reach of each other. */}
        <ul className="mx-auto flex" style={{ maxWidth: (shown.length + (more.length ? 1 : 0)) * 96 }}>
          {shown.map(({ to, label, Icon, active, badge }) => (
            <li key={to} className="min-w-0 flex-1">
              <Link to={to} aria-current={active ? 'page' : undefined} className={clsx(SLOT, active ? 'text-green-900' : 'text-ink-muted')}>
                <span className="relative">
                  <Icon size={22} aria-hidden="true" weight={active ? 'fill' : 'regular'} />
                  <Count count={badge ?? 0} />
                </span>
                <span className="max-w-full truncate px-1">{label}</span>
              </Link>
            </li>
          ))}
          {more.length ? (
            <li className="min-w-0 flex-1">
              <button
                type="button"
                popoverTarget="page-menu"
                className={clsx(SLOT, more.some((page) => page.active) ? 'text-green-900' : 'text-ink-muted')}
              >
                <span className="relative">
                  <DotsThree size={22} aria-hidden="true" />
                  <Count count={more.reduce((sum, page) => sum + (page.badge ?? 0), 0)} />
                </span>
                More
              </button>
            </li>
          ) : null}
        </ul>
      </nav>

      {/* More: native popover, so light-dismiss and Escape come free. */}
      <div
        id="page-menu"
        popover="auto"
        className="glass fixed inset-auto bottom-[calc(env(safe-area-inset-bottom)+4rem)] right-2 m-0 max-h-[calc(100dvh-8rem)] w-64 overflow-y-auto rounded-[12px] border border-glass-border p-1.5 text-sm text-ink shadow-window"
      >
        <nav aria-label="More pages">
          <ul>
            {more.map(({ to, label, Icon, active, badge }) => (
              <li key={to}>
                <Link
                  to={to}
                  aria-current={active ? 'page' : undefined}
                  onClick={close}
                  className={clsx(
                    'flex min-h-11 w-full items-center gap-2.5 rounded-[7px] px-2',
                    active ? 'bg-green-900 font-semibold text-on-primary' : 'hover:bg-ink/[0.08]',
                  )}
                >
                  <Icon size={17} aria-hidden="true" weight={active ? 'fill' : 'regular'} />
                  <span className="flex-1">{label}</span>
                  {badge ? <span className="tabular text-xs font-bold">{badge > 99 ? '99+' : badge}</span> : null}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </>
  );
}
