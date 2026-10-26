import { Gear, House, MagnifyingGlass, SquaresFour } from '@phosphor-icons/react';
import { Link, Navigate, useLocation, useOutletContext } from 'react-router-dom';

import { CLIENT_ROLES, CMS_ROLES, type CmsShell } from '@/components/layout/AdminLayout';
import { AuthScreen } from '@/components/layout/AuthScreen';
import { MODIFIER } from '@/components/layout/SearchPalette';
import { useAuth } from '@/lib/auth';

/**
 * Signed out at an address that is not a screen: a real screen's address goes
 * on to sign-in (and back), anything else is told it does not exist.
 */
export function SignedOutNotFound({ known }: { known: (path: string) => boolean }) {
  const { pathname } = useLocation();
  if (known(pathname)) return <Navigate to="/login" replace />;
  return (
    <AuthScreen title="Page not found" lede="There is nothing at this address.">
      <Link to="/login" className="text-link text-sm">
        Go to sign in
      </Link>
    </AuthScreen>
  );
}

/**
 * An address that is not a screen. Quiet, and three ways on from it: search,
 * the overview, and Settings — the three places anyone was usually going.
 */
export function NotFoundPage() {
  const { pathname } = useLocation();
  const { isAdmin, isInfra, can } = useAuth();
  const { openSearch } = useOutletContext<CmsShell>();
  const option =
    'flex min-h-11 items-center gap-3 rounded-control px-3 text-left text-ink transition-colors hover:bg-ink/[0.05] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring/40';

  return (
    <div className="flex min-h-full items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <p aria-hidden="true" className="tabular text-[88px] font-bold leading-none tracking-[-0.04em] text-ink/10">
          404
        </p>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-ink">There is nothing at this address</h1>
        <p className="mt-2 break-all text-sm text-ink-muted">
          <code className="rounded bg-ink/[0.06] px-1.5 py-0.5 text-[13px]">{pathname}</code>
        </p>

        <div className="mt-8 flex flex-col gap-1 border-t border-border pt-4">
          <button type="button" onClick={openSearch} className={option}>
            <MagnifyingGlass size={18} aria-hidden="true" className="text-ink-muted" />
            <span className="flex-1">Search for it</span>
            <kbd className="tabular text-xs text-ink-muted pointer-coarse:hidden">{MODIFIER} K</kbd>
          </button>
          {can(...CLIENT_ROLES) ? (
            <Link to="/" className={option}>
              <House size={18} aria-hidden="true" className="text-ink-muted" />
              <span className="flex-1">Go to the dashboard</span>
            </Link>
          ) : null}
          {can(...CMS_ROLES) ? (
            <Link to="/cms" className={option}>
              <SquaresFour size={18} aria-hidden="true" className="text-ink-muted" />
              <span className="flex-1">Go to the CMS overview</span>
            </Link>
          ) : null}
          {isAdmin || isInfra ? (
            <Link to="/settings" className={option}>
              <Gear size={18} aria-hidden="true" className="text-ink-muted" />
              <span className="flex-1">Open Settings</span>
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
