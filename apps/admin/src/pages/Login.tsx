import { useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { AuthScreen, FormError } from '@/components/layout/AuthScreen';
import { Button, Input } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export function LoginPage() {
  const { login } = useAuth();
  const justReset = (useLocation().state as { reset?: boolean } | null)?.reset === true;
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
          : 'Could not sign in. Check your connection and try again.',
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <AuthScreen title="Sign in" lede="Welcome back. Sign in with your Enzo account.">
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <Input
          label="Email address"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@enzointeriors.co.uk"
          required
        />
        <div className="flex flex-col gap-1.5">
          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <Link to="/forgot-password" state={{ email }} className="text-link self-end text-sm">
            Forgot password?
          </Link>
        </div>

        {justReset && !error ? (
          <p role="status" className="rounded-control bg-success-bg px-3 py-2 text-sm text-success">
            Password changed. Sign in with your new password.
          </p>
        ) : null}
        <FormError message={error} />

        <Button type="submit" variant="primary" loading={pending} className="mt-1 w-full">
          Sign in
        </Button>
      </form>
    </AuthScreen>
  );
}
