import { Link } from 'react-router-dom';

import { EmptyState } from '@/components/ui';

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
