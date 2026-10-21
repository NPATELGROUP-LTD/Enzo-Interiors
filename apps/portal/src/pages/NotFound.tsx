import { Link, Navigate, useLocation } from 'react-router-dom';

import { AuthScreen } from '@/components/layout/AuthScreen';
import { EmptyState } from '@/components/ui';

/**
 * Signed out at an address that is not a screen: a real screen's address goes
 * on to sign-in, anything else is told it does not exist.
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

export function NotFoundPage() {
  return (
    <EmptyState
      title="Page not found"
      message="That page does not exist in your portal."
      action={
        <Link to="/dashboard" className="text-link">
          Back to dashboard
        </Link>
      }
    />
  );
}
