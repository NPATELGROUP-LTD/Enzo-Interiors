import { Bell, EnvelopeSimple, GoogleLogo, Key, PaintBrush, ShieldCheck, UserCircle } from '@phosphor-icons/react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { ConnectButton } from '@/components/mail/ConnectButton';
import { PushToggle } from '@/components/PushToggle';
import {
  AppearancePicker,
  Button,
  FIELD_BASE,
  Input,
  Modal,
  PaneHeader,
  SettingsGroup,
  SettingsRow,
  SettingsShell,
  type SettingsSection,
} from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useQuery } from '@/hooks/useApi';
import { ApiError, api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { dateTime, initials, roleLabel } from '@/lib/format';
import { useTheme } from '@/lib/theme';
import type { LoginResponse, Me, Principal, TrustedDevice } from '@/types/api';
import type { MailStatus } from '@/types/mail';

const GOOGLE_ERRORS: Record<string, string> = {
  taken: 'That Google account is already linked to another person.',
  expired: 'That Google sign-in took too long. Try again.',
  cancelled: 'Linking Google was cancelled.',
};

/**
 * Your own account: your name, your password, how you sign in, how the app
 * looks. Everyone has one. Laid out like Settings, one pane per `?section=`.
 */
export function AccountPage() {
  const toast = useToast();
  const { user, adopt, update, can } = useAuth();
  const { theme, set } = useTheme();
  const [params, setParams] = useSearchParams();
  const [name, setName] = useState(user?.name ?? '');
  const [savingName, setSavingName] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  const me = useQuery<Me>('/auth/me');
  const devices = useQuery<TrustedDevice[]>('/auth/devices');
  const [googleOn, setGoogleOn] = useState(false);
  const mail = useQuery<MailStatus>(can('Admin', 'Designer', 'Editor') ? '/mailbox/status' : null);
  const [linking, setLinking] = useState(false);
  const [linkPassword, setLinkPassword] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkPending, setLinkPending] = useState(false);

  useEffect(() => {
    api.get<{ enabled: boolean }>('/auth/google/enabled').then((r) => setGoogleOn(r.enabled), () => undefined);
    // Back from Google: say how it went, then swap the query for the Google pane.
    const result = params.get('google');
    if (!result) return;
    const reason = params.get('reason');
    setParams({ section: 'google' }, { replace: true });
    if (result === 'linked') {
      toast.success('Google account linked.');
      void me.refetch();
    } else {
      toast.error(GOOGLE_ERRORS[reason ?? ''] ?? 'Could not link Google. Try again.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!user) return null;
  const role = roleLabel(user.role);

  const saveName = async (event: FormEvent) => {
    event.preventDefault();
    setSavingName(true);
    try {
      update(await api.put<Principal>('/auth/profile', { name: name.trim() }));
      toast.success('Name saved.');
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not save your name.');
    } finally {
      setSavingName(false);
    }
  };

  const savePassword = async (event: FormEvent) => {
    event.preventDefault();
    if (next.length < 12) return setPasswordError('Use at least 12 characters for the new password.');
    if (next !== again) return setPasswordError('The two new passwords do not match.');
    setPasswordError(null);
    setSavingPassword(true);
    try {
      // The change signs out every other session; this one carries on with
      // the fresh token the API hands back.
      adopt(await api.put<LoginResponse>('/auth/password', { current_password: current, new_password: next }));
      setCurrent('');
      setNext('');
      setAgain('');
      toast.success('Password changed. You have been signed out everywhere else.');
    } catch (caught) {
      setPasswordError(caught instanceof ApiError ? caught.message : 'That did not work. Try again.');
    } finally {
      setSavingPassword(false);
    }
  };

  const revoke = async (id: string) => {
    try {
      await api.delete(`/auth/devices/${id}`);
      devices.setData((list) => (list ?? []).filter((row) => row.id !== id));
      toast.success('That device will ask for a code next time.');
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not forget that device.');
    }
  };

  const googleLink = async (event: FormEvent) => {
    event.preventDefault();
    setLinkError(null);
    setLinkPending(true);
    try {
      window.location.assign((await api.post<{ url: string }>('/auth/google/link', { password: linkPassword })).url);
    } catch (caught) {
      setLinkError(caught instanceof ApiError ? caught.message : 'Could not start linking Google.');
      setLinkPending(false);
    }
  };

  const mailDisconnect = async () => {
    try {
      await api.delete('/mailbox');
      void mail.refetch();
      toast.success('Gmail disconnected.');
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not disconnect Gmail.');
    }
  };

  const googleUnlink = async () => {
    try {
      await api.delete('/auth/google');
      void me.refetch();
      toast.success('Google account unlinked.');
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not unlink Google.');
    }
  };

  const method = me.data?.twoFactorMethod;
  const sections: SettingsSection[] = [
    { id: 'profile', label: 'Profile', Icon: UserCircle },
    { id: 'password', label: 'Password', Icon: Key },
    { id: 'sign-in', label: 'Two-step sign-in', Icon: ShieldCheck },
    ...(googleOn || me.data?.googleLinked ? [{ id: 'google', label: 'Google', Icon: GoogleLogo }] : []),
    ...(mail.data?.configured ? [{ id: 'mail', label: 'Mail', Icon: EnvelopeSimple }] : []),
    { id: 'notifications', label: 'Notifications', Icon: Bell },
    { id: 'appearance', label: 'Appearance', Icon: PaintBrush },
  ];
  const active = sections.find(({ id }) => id === params.get('section'))?.id ?? 'profile';

  return (
    <SettingsShell label="Account" sections={sections} active={active} to={(id) => `/account?section=${id}`}>
      {active === 'profile' ? (
        <>
          <div className="flex max-w-2xl items-center gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-green-900 text-lg font-bold text-on-primary">
              {initials(user.name)}
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold tracking-tight text-ink">{user.name}</h1>
              <p className="truncate text-ink-muted">
                {user.email} · {role}
              </p>
            </div>
          </div>
          <SettingsGroup>
            <form onSubmit={saveName}>
              <SettingsRow label="Name" help="How you appear to the rest of the team, and on changes you make.">
                <div className="w-56 max-w-full">
                  <input
                    aria-label="Name"
                    autoComplete="name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className={FIELD_BASE}
                  />
                </div>
                <Button type="submit" loading={savingName} disabled={name.trim().length < 2 || name.trim() === user.name}>
                  Save
                </Button>
              </SettingsRow>
            </form>
            <SettingsRow label="Email" help="You sign in with it. To change it, ask an Admin.">
              <span className="truncate text-sm text-ink">{user.email}</span>
            </SettingsRow>
            <SettingsRow label="Role" help="Only an Admin can change it.">
              <span className="text-sm text-ink">{role}</span>
            </SettingsRow>
          </SettingsGroup>
        </>
      ) : null}

      {active === 'password' ? (
        <>
          <PaneHeader title="Password" help="Changing it signs you out on every other device." />
          <SettingsGroup>
            <form onSubmit={savePassword} className="flex max-w-md flex-col gap-4 p-4" noValidate>
              <input type="text" name="username" autoComplete="username" value={user.email} hidden readOnly />
              <Input label="Current password" type="password" autoComplete="current-password" value={current} onChange={(event) => setCurrent(event.target.value)} />
              <Input label="New password" type="password" autoComplete="new-password" hint="At least 12 characters." value={next} onChange={(event) => setNext(event.target.value)} />
              <Input label="New password again" type="password" autoComplete="new-password" value={again} onChange={(event) => setAgain(event.target.value)} />
              {passwordError ? (
                <p role="alert" className="rounded-control bg-danger-bg px-3 py-2 text-sm text-danger">
                  {passwordError}
                </p>
              ) : null}
              <div>
                <Button type="submit" variant="primary" loading={savingPassword} disabled={!current || !next}>
                  Change password
                </Button>
              </div>
            </form>
          </SettingsGroup>
        </>
      ) : null}

      {active === 'sign-in' ? (
        <>
          <PaneHeader title="Two-step sign-in" help="After your password, a code proves it is you. Only an Admin can reset it." />
          <SettingsGroup>
            <SettingsRow
              label="Method"
              help={
                method === 'email'
                  ? `A code is emailed to ${user.email} each time you sign in.`
                  : method === 'totp'
                    ? 'You enter a code from your authenticator app each time you sign in.'
                    : 'Not set up yet. You will choose a method the next time you sign in.'
              }
            >
              <span className="text-sm text-ink">
                {method === 'email' ? 'Email code' : method === 'totp' ? 'Authenticator app' : 'Not set up'}
              </span>
            </SettingsRow>
          </SettingsGroup>
          <SettingsGroup title="Remembered devices">
            {devices.data?.length === 0 ? <SettingsRow label="No devices are remembered." /> : null}
            {(devices.data ?? []).map((row) => (
              <SettingsRow
                key={row.id}
                label={row.label}
                help={`${row.last_used_at ? `Last used ${dateTime(row.last_used_at)}` : 'Not used since'} · expires ${dateTime(row.expires_at)}`}
              >
                <Button variant="ghost" className="text-danger" onClick={() => void revoke(row.id)}>
                  Revoke
                </Button>
              </SettingsRow>
            ))}
          </SettingsGroup>
          <p className="mt-2 max-w-2xl px-1 text-[13px] text-ink-muted">
            These skip the code until they expire. A password change forgets them all.
          </p>
        </>
      ) : null}

      {active === 'mail' ? (
        <>
          <PaneHeader title="Mail" help="Your own Gmail inside the admin. Only you can open your mailbox, and Enzo keeps no copy of your messages." />
          <SettingsGroup>
            <SettingsRow
              label="Gmail"
              help={
                !mail.data?.connected
                  ? 'Not connected.'
                  : mail.data.needs_reconnect
                    ? `Google stopped accepting the link to ${mail.data.email}. Connect again to use Mail.`
                    : `Connected as ${mail.data.email}.`
              }
            >
              {mail.data?.connected && !mail.data.needs_reconnect ? (
                <div className="flex gap-2">
                  <Link to="/mail">
                    <Button>Open Mail</Button>
                  </Link>
                  <Button onClick={() => void mailDisconnect()}>Disconnect</Button>
                </div>
              ) : (
                <ConnectButton label={mail.data?.connected ? 'Reconnect Gmail' : 'Connect your Gmail'} variant="secondary" />
              )}
            </SettingsRow>
          </SettingsGroup>
        </>
      ) : null}

      {active === 'google' ? (
        <>
          <PaneHeader
            title="Google"
            help="Sign in with your Google account instead of a password. Changing your password also unlinks it."
          />
          <SettingsGroup>
            <SettingsRow label="Google account" help={me.data?.googleLinked ? `Linked to ${me.data.googleEmail}.` : 'Not linked.'}>
              {me.data?.googleLinked ? (
                <Button onClick={() => void googleUnlink()}>Unlink</Button>
              ) : (
                <Button onClick={() => setLinking(true)}>Link Google account</Button>
              )}
            </SettingsRow>
          </SettingsGroup>
          <Modal
            open={linking}
            onClose={() => {
              setLinking(false);
              setLinkPassword('');
              setLinkError(null);
            }}
            title="Link your Google account"
            width="sm"
          >
            <form onSubmit={googleLink} className="flex flex-col gap-4" noValidate>
              <input type="text" name="username" autoComplete="username" value={user.email} hidden readOnly />
              <Input
                label="Your password"
                type="password"
                autoComplete="current-password"
                autoFocus
                hint="Confirm it's you before linking."
                value={linkPassword}
                onChange={(event) => setLinkPassword(event.target.value)}
              />
              {linkError ? (
                <p role="alert" className="rounded-control bg-danger-bg px-3 py-2 text-sm text-danger">
                  {linkError}
                </p>
              ) : null}
              <div className="flex justify-end">
                <Button type="submit" variant="primary" loading={linkPending} disabled={!linkPassword}>
                  Continue to Google
                </Button>
              </div>
            </form>
          </Modal>
        </>
      ) : null}

      {active === 'notifications' ? (
        <>
          <PaneHeader
            title="Notifications"
            help="What rings your bell, on this device too. Each phone or computer is turned on separately."
          />
          <SettingsGroup>
            <div className="px-4 py-3">
              <PushToggle />
            </div>
          </SettingsGroup>
        </>
      ) : null}

      {active === 'appearance' ? (
        <>
          <PaneHeader title="Appearance" help="Only on this device." />
          <SettingsGroup>
            <div className="p-4">
              <AppearancePicker value={theme} onChange={set} />
            </div>
          </SettingsGroup>
        </>
      ) : null}
    </SettingsShell>
  );
}
