import { Link } from 'react-router-dom';

import { EmptyState } from '@/components/ui';

export function NotFoundPage() {
  return (
    <EmptyState
      title="Page not found"
      message="That screen does not exist in the Enzo CRM."
      action={
        <Link to="/dashboard" className="text-link">
          Back to dashboard
        </Link>
      }
    />
  );
}
