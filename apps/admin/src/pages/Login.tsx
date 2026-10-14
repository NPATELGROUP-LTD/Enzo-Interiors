import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { AuthScreen, FormError } from '@/components/layout/AuthScreen';
import { Button, Checkbox, Input } from '@/components/ui';
import { ApiError, api, deviceStore } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { LoginResponse, LoginStart } from '@/types/api';

const AUTH = '/auth/admin';
const GOOGLE_ERRORS: Record<string, string> = {
  expired: 'That Google sign-in took too long. Try again.',
  cancelled: 'Google sign-in was cancelled.',
};

type Step =
  | { kind: 'password' }
  | { kind: 'enrol'; challenge: string }
  | {
      kind: 'code';
      challenge: string;
      method: 'email' | 'totp';
      /** The endpoint that checks the code: sign-in, or the end of enrolment. */
      path: string;
      enrolling: boolean;
      hint?: string;
      /** Where "send a new code" goes, for email steps. */
      resend?: string;
      qr?: { secret: string; url: string };
    }
  | { kind: 'recovery'; session: LoginResponse };

const grouped = (secret: string) => secret.replace(/(.{4})(?=.)/g, '$1 ');
const copy = (text: string) => void navigator.clipboard?.writeText(text).catch(() => undefined);

export function LoginPage() {
  const { adopt } = useAuth();
  const justReset = (useLocation().state as { reset?: boolean } | null)?.reset === true;
  const [step, setStep] = useState<Step>({ kind: 'password' });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [googleOn, setGoogleOn] = useState(false);
  const handled = useRef(false);

  const fail = (caught: unknown, fallback: string) => {
    const message = caught instanceof ApiError ? caught.message : fallback;
    // An expired or dead challenge cannot be retried: start again.
    if (caught instanceof ApiError && caught.status === 401) setStep({ kind: 'password' });
    setError(message);
  };

  /** Run a request with the shared pending/error handling. */
  const run = async (action: () => Promise<void>, fallback: string) => {
    setError(null);
    setPending(true);
    try {
      await action();
    } catch (caught) {
      fail(caught, fallback);
    } finally {
      setPending(false);
    }
  };

  useEffect(() => {
    api
      .get<{ enabled: boolean }>('/auth/google/enabled')
      .then((result) => setGoogleOn(result.enabled))
      .catch(() => undefined);

    // Back from Google: the query says how it went. Strict mode runs this twice; the code works once.
    if (handled.current) return;
    handled.current = true;
    const query = new URLSearchParams(window.location.search);
    const code = query.get('google_code');
    const google = query.get('google');
    if (!code && !google) return;
    window.history.replaceState(null, '', window.location.pathname);
    if (code) {
      void run(
        async () => adopt(await api.post<LoginResponse>('/auth/google/exchange', { code }, { allowUnauthorized: true })),
        'Could not sign in with Google. Try again.',
      );
    } else if (google === 'not_linked') {
      setError("This Google account isn't linked to an Enzo account. Sign in with your password, then link Google from Account.");
    } else {
      setError(GOOGLE_ERRORS[query.get('reason') ?? ''] ?? 'Google sign-in did not work. Try again, or use your password.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signIn = (event: FormEvent) => {
    event.preventDefault();
    if (!email.trim() || !password) return setError('Enter your email address and password.');
    void run(async () => {
      const result = await api.post<LoginStart>(
        `${AUTH}/login`,
        { email: email.trim(), password, deviceToken: deviceStore.get() ?? undefined },
        { allowUnauthorized: true },
      );
      if (!('twoFactor' in result)) return adopt(result);
      if (result.twoFactor === 'enrol') return setStep({ kind: 'enrol', challenge: result.challenge });
      setStep({
        kind: 'code',
        challenge: result.challenge,
        method: result.twoFactor,
        path: `${AUTH}/verify-code`,
        enrolling: false,
        hint: 'emailHint' in result ? result.emailHint : undefined,
        resend: `${AUTH}/resend-code`,
      });
    }, 'Could not sign in. Check your connection and try again.');
  };

  const google = () =>
    void run(async () => {
      window.location.assign((await api.get<{ url: string }>('/auth/google/start')).url);
    }, 'Could not start Google sign-in.');

  const enrol = (challenge: string, method: 'email' | 'totp') =>
    void run(async () => {
      const base = `${AUTH}/enrol/${method}`;
      const started = await api.post<{ emailHint: string }>(`${base}/start`, { challenge }, { allowUnauthorized: true });
      // An authenticator app first proves the mailbox: the emailed code unlocks the QR code.
      setStep({
        kind: 'code',
        challenge,
        method: 'email',
        path: method === 'totp' ? `${base}/secret` : `${base}/confirm`,
        enrolling: true,
        hint: started.emailHint,
        resend: `${base}/start`,
      });
    }, 'Could not start that. Try again.');

  const finish = (result: LoginResponse | { secret: string; otpauthUrl: string }) => {
    if ('secret' in result && step.kind === 'code') {
      return setStep({
        kind: 'code',
        challenge: step.challenge,
        method: 'totp',
        path: `${AUTH}/enrol/totp/confirm`,
        enrolling: true,
        qr: { secret: result.secret, url: result.otpauthUrl },
      });
    }
    const session = result as LoginResponse;
    if (session.recoveryCodes) setStep({ kind: 'recovery', session });
    else adopt(session);
  };

  if (step.kind === 'recovery') {
    return <RecoveryStep codes={step.session.recoveryCodes ?? []} onDone={() => adopt(step.session)} />;
  }

  if (step.kind === 'enrol') {
    return (
      <AuthScreen
        title="Set up two-step sign-in"
        lede="Choose how you'll confirm it's you each time you sign in. You can't change this later yourself — an admin can reset it."
      >
        <div className="flex flex-col gap-3">
          <Button variant="secondary" loading={pending} onClick={() => enrol(step.challenge, 'email')} className="w-full">
            Email code
          </Button>
          <Button variant="secondary" loading={pending} onClick={() => enrol(step.challenge, 'totp')} className="w-full">
            Authenticator app
          </Button>
          <FormError message={error} />
          <button type="button" className="text-link text-center text-sm" onClick={() => setStep({ kind: 'password' })}>
            Back to sign in
          </button>
        </div>
      </AuthScreen>
    );
  }

  if (step.kind === 'code') {
    return (
      <CodeStep
        key={step.path}
        step={step}
        error={error}
        pending={pending}
        run={run}
        onSession={finish}
        onBack={() => {
          setError(null);
          setStep({ kind: 'password' });
        }}
        onHint={(hint) => setStep({ ...step, hint })}
      />
    );
  }

  return (
    <AuthScreen title="Sign in" lede="Welcome back. Sign in with your Enzo account.">
      <form onSubmit={signIn} className="flex flex-col gap-4" noValidate>
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
        {googleOn ? (
          <Button type="button" variant="secondary" disabled={pending} onClick={google} className="w-full">
            Sign in with Google
          </Button>
        ) : null}
      </form>
    </AuthScreen>
  );
}

/** The six-digit step: signing in, or the last step of setting up. */
function CodeStep({
  step,
  error,
  pending,
  run,
  onSession,
  onBack,
  onHint,
}: {
  step: Extract<Step, { kind: 'code' }>;
  error: string | null;
  pending: boolean;
  run: (action: () => Promise<void>, fallback: string) => Promise<void>;
  onSession: (result: LoginResponse | { secret: string; otpauthUrl: string }) => void;
  onBack: () => void;
  onHint: (hint: string) => void;
}) {
  const [code, setCode] = useState('');
  const [remember, setRemember] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [sent, setSent] = useState(false);
  const { challenge, method, qr } = step;
  /** First half of authenticator-app setup: the emailed code only unlocks the QR code. */
  const mailbox = step.path.endsWith('/secret');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!code.trim()) return;
    void run(
      async () =>
        onSession(
          await api.post<LoginResponse>(
            step.path,
            { challenge, code: code.trim(), remember: mailbox ? undefined : remember },
            { allowUnauthorized: true },
          ),
        ),
      'Could not check that code. Try again.',
    );
  };

  const resend = () =>
    void run(async () => {
      onHint((await api.post<{ emailHint: string }>(step.resend ?? '', { challenge }, { allowUnauthorized: true })).emailHint);
      setSent(true);
    }, 'Could not send a new code.');

  const lede =
    mailbox
      ? `To set up an authenticator app, first enter the code we emailed to ${step.hint ?? 'you'}.`
      : method === 'email'
      ? `We emailed a code to ${step.hint ?? 'you'}.`
      : qr
        ? 'Scan the code with your authenticator app, then enter the code it shows.'
        : recovery
          ? 'Enter one of the recovery codes you saved. Each works once.'
          : 'Enter the code from your authenticator app.';

  return (
    <AuthScreen title={qr ? 'Add to your authenticator app' : step.enrolling ? 'Confirm your code' : 'Two-step sign-in'} lede={lede}>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        {qr ? (
          <div className="flex flex-col items-start gap-3">
            <QRCodeSVG value={qr.url} size={168} marginSize={2} title="Authenticator app setup code" className="rounded-control bg-white" />
            <p className="text-sm text-ink-muted">
              Or type this key in: <span className="tabular font-semibold text-ink">{grouped(qr.secret)}</span>{' '}
              <button type="button" className="text-link" onClick={() => copy(qr.secret)}>
                Copy
              </button>
            </p>
          </div>
        ) : null}
        <Input
          label={recovery ? 'Recovery code' : 'Code'}
          autoFocus
          inputMode={recovery ? 'text' : 'numeric'}
          autoComplete="one-time-code"
          maxLength={recovery ? 20 : 6}
          placeholder={recovery ? 'abcd-efgh' : '123456'}
          value={code}
          onChange={(event) => setCode(event.target.value)}
        />
        {mailbox ? null : <Checkbox label="Remember this device for 30 days" checked={remember} onChange={setRemember} />}
        {sent && !error ? (
          <p role="status" className="text-sm text-ink-muted">
            A new code is on its way to {step.hint}.
          </p>
        ) : null}
        <FormError message={error} />
        <Button type="submit" variant="primary" loading={pending} disabled={!code.trim()} className="w-full">
          {mailbox ? 'Continue' : step.enrolling ? 'Confirm' : 'Sign in'}
        </Button>
        <div className="flex flex-wrap justify-between gap-3 text-sm">
          {method === 'email' ? (
            <button type="button" className="text-link" disabled={pending} onClick={resend}>
              Send a new code
            </button>
          ) : !qr ? (
            <button
              type="button"
              className="text-link"
              onClick={() => {
                setRecovery(!recovery);
                setCode('');
              }}
            >
              {recovery ? 'Use the app code instead' : 'Use a recovery code instead'}
            </button>
          ) : (
            <span />
          )}
          <button type="button" className="text-link" onClick={onBack}>
            Back to sign in
          </button>
        </div>
      </form>
    </AuthScreen>
  );
}

/** Shown once, right after the authenticator app is confirmed. Signing in waits for "Continue". */
function RecoveryStep({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const [saved, setSaved] = useState(false);
  const text = codes.join('\n');

  return (
    <AuthScreen
      title="Save your recovery codes"
      lede="If you lose your authenticator app, each of these signs you in once. They won't be shown again."
    >
      <ul className="tabular grid grid-cols-2 gap-x-4 gap-y-1 rounded-control border border-border bg-surface-muted px-4 py-3 font-semibold text-ink">
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
      <div className="mt-3 flex gap-4 text-sm">
        <button type="button" className="text-link" onClick={() => copy(text)}>
          Copy all
        </button>
        <a
          className="text-link"
          download="enzo-recovery-codes.txt"
          href={`data:text/plain;charset=utf-8,${encodeURIComponent(text + '\n')}`}
        >
          Download .txt
        </a>
      </div>
      <div className="mt-4 flex flex-col gap-4">
        <Checkbox label="I've saved these codes" checked={saved} onChange={setSaved} />
        <Button variant="primary" disabled={!saved} onClick={onDone} className="w-full">
          Continue
        </Button>
      </div>
    </AuthScreen>
  );
}
