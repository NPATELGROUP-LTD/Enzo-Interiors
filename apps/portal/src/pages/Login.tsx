import { useState, type FormEvent } from 'react';

import { Button, Card, Input } from '@/components/ui';
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
            <p className="text-xs text-ink-muted">Client Portal</p>
          </div>
        </div>

        <Card className="p-5">
          <h1 className="text-xl font-bold tracking-tight text-ink">Welcome back</h1>
          <p className="mt-1 text-ink-muted">
            Track your project, approve designs and view your documents.
          </p>

          <form onSubmit={submit} className="mt-5 flex flex-col gap-4" noValidate>
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
            Prototype only. Every account uses the password{' '}
            <code className="rounded-[4px] bg-surface-muted px-1 py-0.5 font-semibold">client123</code>.
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {DEMO_ACCOUNTS.map((account) => (
              <li key={account.email}>
                <button
                  type="button"
                  onClick={() => {
                    setEmail(account.email);
                    setPassword('client123');
                    setError(null);
                  }}
                  className="flex min-h-11 w-full flex-col items-start gap-0.5 rounded-control border border-border bg-surface px-3 py-2 text-left transition-colors duration-[160ms] hover:border-green-900"
                >
                  <span className="text-sm font-semibold text-ink">{account.name}</span>
                  <span className="truncate text-xs text-ink-muted">{account.note}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-ink-muted">
            Enzo staff sign in at the Admin CRM on port 5174, not here.
          </p>
        </Card>
      </div>
    </div>
  );
}
