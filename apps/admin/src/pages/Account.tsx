import { useState, type FormEvent } from 'react';

import { AppearancePicker, Button, Input } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { ApiError, api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { initials } from '@/lib/format';
import { useTheme } from '@/lib/theme';
import type { LoginResponse, Principal } from '@/types/api';

export const SECTION = 'max-w-2xl border-t border-border pt-7';
export const HEADING = 'text-lg font-semibold tracking-tight text-ink';
export const HELP = 'mt-1 text-sm leading-relaxed text-ink-muted';

/** Your own account: your name, your password, how the app looks. Everyone has one. */
export function AccountPage() {
  const toast = useToast();
  const { user, adopt, update } = useAuth();
  const { theme, set } = useTheme();
  const [name, setName] = useState(user?.name ?? '');
  const [savingName, setSavingName] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  if (!user) return null;
  const role = user.role === 'Admin' ? 'Admin' : 'Editor';

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

  return (
    <div className="px-5 pb-16 pt-6 sm:px-8 lg:pt-8">
      <header className="mb-8 flex items-center gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-green-900 text-lg font-bold text-on-primary">
          {initials(user.name)}
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight text-ink sm:text-[28px]">{user.name}</h1>
          <p className="truncate text-ink-muted">
            {user.email} · {role}
          </p>
        </div>
      </header>

      <section aria-labelledby="account-name" className={SECTION}>
        <h2 id="account-name" className={HEADING}>
          Your name
        </h2>
        <p className={HELP}>How you appear to the rest of the team, and on changes you make.</p>
        <form onSubmit={saveName} className="mt-5 flex max-w-md flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1">
            <Input label="Name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <Button type="submit" loading={savingName} disabled={name.trim().length < 2 || name.trim() === user.name}>
            Save
          </Button>
        </form>
        <p className="mt-3 text-sm text-ink-muted">
          You sign in with {user.email}. To change it, ask an Admin.
        </p>
      </section>

      <section aria-labelledby="account-password" className={`${SECTION} mt-10`}>
        <h2 id="account-password" className={HEADING}>
          Password
        </h2>
        <p className={HELP}>Changing it signs you out on every other device.</p>
        <form onSubmit={savePassword} className="mt-5 flex max-w-md flex-col gap-4" noValidate>
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
      </section>

      <section aria-labelledby="account-look" className={`${SECTION} mt-10`}>
        <h2 id="account-look" className={HEADING}>
          Appearance
        </h2>
        <p className={HELP}>Only on this device.</p>
        <div className="mt-5 max-w-md">
          <AppearancePicker value={theme} onChange={set} />
        </div>
      </section>
    </div>
  );
}
