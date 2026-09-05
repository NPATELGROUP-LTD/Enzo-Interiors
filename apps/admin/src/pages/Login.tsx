import { useState, type FormEvent } from 'react';

import { Button, Card, Input } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';

/**
 * Demo accounts, surfaced on the login screen so a reviewer can sign in
 * instantly. These are seeded by `npm run seed` in apps/api.
 *
 * This panel is a PROTOTYPE AFFORDANCE and must be deleted before any real
 * deployment — printing working credentials on a login page is exactly the
 * thing you never ship.
 */
const DEMO_ACCOUNTS = [
  { role: 'Admin', email: 'admin@enzointeriors.co.uk', password: 'admin123', note: 'Full access' },
  { role: 'Designer', email: 'designer@enzointeriors.co.uk', password: 'designer123', note: 'Assigned work only' },
  { role: 'Installer', email: 'installer@enzointeriors.co.uk', password: 'installer123', note: 'Assigned work only' },
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

  const useAccount = (account: (typeof DEMO_ACCOUNTS)[number]) => {
    setEmail(account.email);
    setPassword(account.password);
    setError(null);
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="flex h-9 w-9 items-center justify-center rounded-control bg-green-900 text-sm font-bold text-on-primary"
          >
            E
          </span>
          <div>
            <p className="text-base font-bold tracking-tight text-ink">Enzo Interiors</p>
            <p className="text-xs text-ink-muted">Staff &amp; Admin CRM</p>
          </div>
        </div>

        <Card className="p-5">
          <h1 className="text-xl font-bold tracking-tight text-ink">Sign in</h1>
          <p className="mt-1 text-ink-muted">Use your Enzo staff account.</p>

          <form onSubmit={submit} className="mt-5 flex flex-col gap-4" noValidate>
            <Input
              label="Email address"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@enzointeriors.co.uk"
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
              <p role="alert" className="rounded-control border border-danger/30 bg-danger-bg px-3 py-2 text-danger">
                {error}
              </p>
            ) : null}

            <Button type="submit" variant="primary" loading={pending} className="w-full">
              Sign in
            </Button>
          </form>
        </Card>

        <Card className="mt-4 p-5">
          <p className="label-eyebrow">Demo accounts</p>
          <p className="mt-1.5 text-ink-muted">
            Prototype only. Select an account to fill the form, then sign in.
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {DEMO_ACCOUNTS.map((account) => (
              <li key={account.email}>
                <button
                  type="button"
                  onClick={() => useAccount(account)}
                  className="flex w-full min-h-11 items-center justify-between gap-3 rounded-control border border-border bg-surface px-3 py-2 text-left transition-colors duration-[160ms] hover:border-green-900"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-ink">{account.role}</span>
                    <span className="block truncate text-xs text-ink-muted">{account.email}</span>
                  </span>
                  <span className="shrink-0 text-xs text-ink-muted">{account.note}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-ink-muted">
            Clients sign in at the Client Portal on port 5175, not here.
          </p>
        </Card>
      </div>
    </div>
  );
}
