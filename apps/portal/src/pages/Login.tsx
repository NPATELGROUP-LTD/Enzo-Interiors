import { useState, type FormEvent } from 'react';

import { Button, Input } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';

/**
 * Seeded demo clients, surfaced so a reviewer can sign in instantly.
 *
 * PROTOTYPE AFFORDANCE — delete this panel before any real deployment. Working
 * credentials printed on a login page is exactly what you never ship.
 */
const DEMO_ACCOUNTS = [
  { name: 'Sarah Jones', email: 'sarah.jones@example.com', note: 'Kitchen in installation, wardrobe in design' },
  { name: 'David Okafor', email: 'david.okafor@example.com', note: 'Media wall awaiting your approval' },
  { name: 'Raj Patel', email: 'raj.patel@example.com', note: 'Wardrobe nearly complete' },
  { name: 'Amelia Hart', email: 'amelia.hart@example.com', note: 'Completed project, invoice paid' },
  { name: 'Eleanor Shaw', email: 'eleanor.shaw@example.com', note: 'Bedroom in design, quote to review' },
];

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError('Enter your email address and password.');
      return;
    }

    setPending(true);
    try {
      await login(email.trim(), password);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Could not sign in. Check that the Enzo API is running.',
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="grid min-h-dvh bg-surface lg:grid-cols-[minmax(28rem,36rem)_1fr]">
      <main className="flex flex-col px-6 py-8 sm:px-12">
        <div className="flex items-center gap-2.5">
          <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-control bg-green-900 text-sm font-bold text-on-primary">
            E
          </span>
          <div>
            <p className="text-base font-bold tracking-tight text-ink">Enzo Interiors</p>
            <p className="text-xs text-ink-muted">Client Portal</p>
          </div>
        </div>

        <div className="mx-auto my-auto w-full max-w-sm py-10">
          <h1 className="text-[28px] font-bold leading-tight tracking-tight text-ink">Welcome back</h1>
          <p className="mt-1.5 text-ink-muted">Track your project, approve designs and view your documents.</p>

          <form onSubmit={submit} className="mt-7 flex flex-col gap-4" noValidate>
            <Input
              label="Email address"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
            />
            <Input
              label="Password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />

            {error ? (
              <p role="alert" className="rounded-control bg-danger-bg px-3 py-2 text-danger">
                {error}
              </p>
            ) : null}

            <Button type="submit" variant="primary" loading={pending} className="mt-1 w-full">
              Sign in
            </Button>
          </form>

          <div className="mt-8 rounded-card bg-ink/[0.035] p-3">
            <p className="px-1 text-xs font-semibold text-ink-muted">
              Demo clients (prototype only). Every account uses{' '}
              <code className="rounded-[4px] bg-surface px-1 py-0.5 font-semibold text-ink">client123</code>.
            </p>
            <ul className="mt-2 flex flex-col gap-1">
              {DEMO_ACCOUNTS.map((account) => (
                <li key={account.email}>
                  <button
                    type="button"
                    onClick={() => {
                      setEmail(account.email);
                      setPassword('client123');
                      setError(null);
                    }}
                    className="flex min-h-11 w-full flex-col items-start justify-center rounded-control px-2 py-1.5 text-left transition-colors duration-[160ms] hover:bg-surface hover:shadow-soft"
                  >
                    <span className="text-sm font-semibold text-ink">{account.name}</span>
                    <span className="max-w-full truncate text-xs text-ink-muted">{account.note}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="text-xs text-ink-muted">Enzo staff sign in at the Admin CRM on port 5174, not here.</p>
      </main>

      {/* Photo half, as on a Microsoft organisation sign-in. Decorative, so empty alt. */}
      <aside className="relative hidden overflow-hidden bg-green-900 lg:sticky lg:top-0 lg:block lg:h-dvh">
        <img src="/login.jpeg" alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/5 to-transparent" />
        <p className="absolute inset-x-0 bottom-0 max-w-xl p-10 text-2xl font-semibold leading-snug tracking-tight text-white">
          Your kitchen, wardrobe or media wall, from first sketch to final fitting.
        </p>
      </aside>
    </div>
  );
}
