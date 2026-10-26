import clsx from 'clsx';
import { Link } from 'react-router-dom';

const LINKS = [
  ['/privacy', 'Privacy'],
  ['/terms', 'Terms'],
  ['/cookies', 'Cookies'],
] as const;

/** Privacy · Terms · Cookies. Takes its colour from where it sits. */
export function LegalLinks({ className }: { className?: string }) {
  return (
    <nav aria-label="Legal" className={clsx('flex flex-wrap gap-x-4', className)}>
      {LINKS.map(([to, label]) => (
        <Link
          key={to}
          to={to}
          className="inline-flex min-h-6 items-center hover:text-ink hover:underline pointer-coarse:min-h-11"
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
