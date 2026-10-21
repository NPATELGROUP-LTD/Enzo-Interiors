import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { AuthScreen, FormError } from '@/components/layout/AuthScreen';
import { Button, Input, LoadingState } from '@/components/ui';
import { ApiError, api } from '@/lib/api';

/** Ask for a reset link. The answer is the same whether or not the address has an account. */
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
      await api.post('/auth/portal/forgot', { email: email.trim() }, { allowUnauthorized: true });
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
        lede={`If ${email.trim()} has a portal account, a link to choose a new password is on its way. It works for 30 minutes.`}
      >
        <p className="text-sm text-ink-muted">
          Nothing arrived? Check your spam folder, or{' '}
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
 * Read once, then wiped from the address bar so it never lands in history,
 * a screenshot or a shared link. The API emails it in the fragment (which a
 * browser never sends to a server); a query string works too.
 */
let fromLink = { token: '', invite: false };
function takeLinkParams(): { token: string; invite: boolean } {
  const params = new URLSearchParams(window.location.hash.slice(1) || window.location.search);
  // Kept in memory, because React may run this twice and the address is wiped after the first.
  if (params.get('token')) fromLink = { token: params.get('token') ?? '', invite: params.get('invite') === '1' };
  if (window.location.hash || window.location.search) {
    window.history.replaceState(window.history.state, '', window.location.pathname);
  }
  return fromLink;
}

/** The invitation and the reset link both land here: same form, different words. */
export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [{ token, invite }] = useState(takeLinkParams);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  /** Null while the link is being checked; false once it is known to be used or expired. */
  const [live, setLive] = useState<boolean | null>(null);

  useEffect(() => {
    if (!token) return;
    let current = true;
    api
      .post<{ valid: boolean }>('/auth/portal/reset/check', { token }, { allowUnauthorized: true })
      .then((result) => current && setLive(result.valid))
      // Cannot tell (offline, throttled): show the form, the API decides on submit.
      .catch(() => current && setLive(true));
    return () => {
      current = false;
    };
  }, [token]);

  if (!token) {
    return (
      <AuthScreen title="This link is incomplete" lede="Open the link from your email again, or ask for a new one.">
        <Link to="/forgot-password" className="text-link text-sm">
          Send a new link
        </Link>
      </AuthScreen>
    );
  }

  if (live === null) {
    return (
      <AuthScreen title="One moment" lede="Checking your link.">
        <LoadingState label="Checking your link…" />
      </AuthScreen>
    );
  }

  if (!live) {
    return (
      <AuthScreen
        title="This link has already been used or has expired"
        lede={
          invite
            ? 'Ask Enzo Interiors to send you a new invitation.'
            : 'For your security each link works once. Ask for a new one and it will arrive in a moment.'
        }
      >
        {invite ? (
          <Link to="/login" className="text-link text-sm">
            Go to sign in
          </Link>
        ) : (
          <Link to="/forgot-password" className="text-link text-sm">
            Send a new link
          </Link>
        )}
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
      await api.post('/auth/portal/reset', { token, new_password: password }, { allowUnauthorized: true });
      fromLink = { token: '', invite: false };
      navigate('/login', { replace: true, state: { reset: true } });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not set the password. Try again.');
    } finally {
      setPending(false);
    }
  };

  return (
    <AuthScreen
      title={invite ? 'Welcome to your portal' : 'Choose a new password'}
      lede={
        invite
          ? 'Choose a password to finish setting up your account. At least 12 characters.'
          : 'At least 12 characters. This signs you out on every other device.'
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
        {invite ? null : (
          <Link to="/forgot-password" className="text-link text-center text-sm">
            Link expired? Send a new one
          </Link>
        )}
      </form>
    </AuthScreen>
  );
}
