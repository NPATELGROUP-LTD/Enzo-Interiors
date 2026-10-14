import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { AuthScreen, FormError } from '@/components/layout/AuthScreen';
import { Button, Input } from '@/components/ui';
import { ApiError, api } from '@/lib/api';

/** Step one: ask for a link. The answer is the same whether or not the address has an account. */
export function ForgotPasswordPage() {
  const location = useLocation();
  const [email, setEmail] = useState((location.state as { email?: string } | null)?.email ?? '');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Enter the email address you sign in with.');
      return;
    }
    setPending(true);
    try {
      await api.post('/auth/admin/forgot-password', { email: email.trim() }, { allowUnauthorized: true });
      setSent(true);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not send the link. Try again in a moment.');
    } finally {
      setPending(false);
    }
  };

  if (sent) {
    return (
      <AuthScreen
        title="Check your email"
        lede={`If ${email.trim()} has an Enzo account, a link to choose a new password is on its way. It works for 30 minutes.`}
      >
        <p className="text-sm text-ink-muted">
          Nothing arrived? Check spam, or{' '}
          <button type="button" className="text-link" onClick={() => setSent(false)}>
            send it again
          </button>
          .
        </p>
        <Link to="/login" className="text-link mt-6 inline-block text-sm">
          Back to sign in
        </Link>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen title="Forgot your password?" lede="Enter your email and we will send you a link to choose a new one.">
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <Input
          label="Email address"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <FormError message={error} />
        <Button type="submit" variant="primary" loading={pending} className="w-full">
          Send reset link
        </Button>
        <Link to="/login" className="text-link text-center text-sm">
          Back to sign in
        </Link>
      </form>
    </AuthScreen>
  );
}

/**
 * Step two, from the emailed link. The token rides in the URL fragment, which
 * browsers never send to a server: it stays out of access logs and Referer
 * headers. It is read once into state and the fragment is then removed, so it
 * does not linger in the address bar, history entry or a screenshot.
 */
export function ResetPasswordPage() {
  const navigate = useNavigate();
  const hash = useLocation().hash;
  const [{ token, invite }] = useState(() => {
    const params = new URLSearchParams(hash.slice(1));
    // An invitation is the same link with invite=1: same page, friendlier words.
    return { token: params.get('token') ?? '', invite: params.get('invite') === '1' };
  });
  useEffect(() => {
    // Keep history.state: the router stores its position in it.
    if (window.location.hash) window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
  }, []);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!token) {
    return (
      <AuthScreen title="This link is incomplete" lede="Open the link from the email again, or ask for a new one.">
        <Link to="/forgot-password" className="text-link text-sm">
          Send a new link
        </Link>
      </AuthScreen>
    );
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (password.length < 12) return setError('Use at least 12 characters.');
    if (password !== confirm) return setError('The two passwords do not match.');
    setPending(true);
    try {
      await api.post(
        '/auth/admin/reset-password',
        { token, new_password: password },
        { allowUnauthorized: true },
      );
      navigate('/login', { replace: true, state: { reset: true } });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not reset the password. Try again.');
    } finally {
      setPending(false);
    }
  };

  return (
    <AuthScreen
      title={invite ? 'Welcome to Enzo Interiors' : 'Choose a new password'}
      lede={
        invite
          ? 'Choose a password to finish setting up your account. At least 12 characters.'
          : 'At least 12 characters. This signs you out everywhere else.'
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        {/* Lets a password manager file the new password against the account. */}
        <input type="text" name="username" autoComplete="username" hidden readOnly />
        <Input
          label="New password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          minLength={12}
          required
        />
        <Input
          label="Type it again"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          required
        />
        <FormError message={error} />
        <Button type="submit" variant="primary" loading={pending} className="w-full">
          {invite ? 'Set password' : 'Save new password'}
        </Button>
      </form>
    </AuthScreen>
  );
}
