import { useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { AuthScreen, FormError } from '@/components/layout/AuthScreen';
import { Button, Input } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export function LoginPage() {
  const { login } = useAuth();
  // Set by the reset page once a new password is saved.
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
      setError(caught instanceof ApiError ? caught.message : 'Could not sign in. Try again in a moment.');
    } finally {
      setPending(false);
    }
  };

  return (
    <AuthScreen title="Sign in" lede="Follow your project, approve designs and find your documents and invoices.">
      {justReset ? (
        <p role="status" className="mb-4 rounded-control bg-success-bg px-3 py-2 text-success">
          Your password is set. Sign in with it now.
        </p>
      ) : null}
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <Input
          label="Email address"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
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
        <FormError message={error} />
        <Button type="submit" variant="primary" loading={pending} className="mt-1 w-full">
          Sign in
        </Button>
        <Link to="/forgot-password" state={{ email: email.trim() }} className="text-link text-center text-sm">
          Forgot your password?
        </Link>
      </form>
      <p className="mt-8 text-xs text-ink-muted">
        New to the portal? Use the link in your invitation email to set a password.
      </p>
    </AuthScreen>
  );
}
