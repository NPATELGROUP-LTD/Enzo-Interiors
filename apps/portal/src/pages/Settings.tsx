import clsx from 'clsx';
import { Fragment, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

import {
  AppearancePicker,
  Button,
  ErrorState,
  Input,
  LoadingState,
  PageHeader,
  PaneHeader,
  SettingsGroup,
  SettingsRow,
  Toggle,
  buttonClass,
} from '@/components/ui';
import { PushToggle } from '@/components/PushToggle';
import { useToast } from '@/components/ui/Toast';
import { useQuery } from '@/hooks/useApi';
import { ApiError, api, tokenStore } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { reauthSocket } from '@/lib/socket';
import { useTheme } from '@/lib/theme';
import type { NotificationPreference, NotifyCategory, NotifyChannel } from '@/types/api';

/** Rows and columns of Settings › Notifications. */
const CATEGORIES: Array<{ id: NotifyCategory; label: string; description: string }> = [
  { id: 'project', label: 'Project updates', description: 'A project shared with you, moving on, or needing your approval.' },
  { id: 'invoice', label: 'Invoices', description: 'A new invoice from the studio.' },
  { id: 'document', label: 'Files', description: 'Drawings, quotes and other files shared with you.' },
  { id: 'message', label: 'Messages', description: 'A reply from the studio while you are away.' },
];
const CHANNELS: Array<{ id: NotifyChannel; label: string }> = [
  { id: 'in_app', label: 'In the portal' },
  { id: 'email', label: 'Email' },
  { id: 'push', label: 'Phone & browser' },
];
/** The notification grid: what it is, then one column per channel (from sm up). */
const GRID = 'sm:grid sm:grid-cols-[minmax(0,1fr)_repeat(3,6.5rem)] sm:items-center sm:gap-x-2';

/** Every section is its own card on one page, two across from xl. */
export function SettingsPage() {
  const { user, logout } = useAuth();
  const { theme, set: setTheme } = useTheme();
  const toast = useToast();
  const preferences = useQuery<NotificationPreference>('/notification-preferences');

  const [passwordForm, setPasswordForm] = useState({ current: '', next: '', confirm: '' });
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaving, setPasswordSaving] = useState(false);

  const changePassword = async (event: FormEvent) => {
    event.preventDefault();
    setPasswordError(null);
    if (passwordForm.next.length < 12) {
      return setPasswordError('Use at least 12 characters for the new password.');
    }
    if (passwordForm.next !== passwordForm.confirm) {
      return setPasswordError('The new passwords do not match.');
    }

    setPasswordSaving(true);
    try {
      // Changing it signs every session out, this one included; the answer is a new one.
      const session = await api.put<{ access_token: string }>('/account/password', {
        current_password: passwordForm.current,
        new_password: passwordForm.next,
      });
      tokenStore.set(session.access_token);
      // The live connection was opened with the old token; reconnect it with the new one.
      reauthSocket();
      toast.success('Password changed.');
      setPasswordForm({ current: '', next: '', confirm: '' });
    } catch (caught) {
      setPasswordError(
        caught instanceof ApiError ? caught.message : 'Could not change your password.',
      );
    } finally {
      setPasswordSaving(false);
    }
  };

  const saveChoice = async (category: NotifyCategory, channel: NotifyChannel, next: boolean) => {
    try {
      preferences.setData(
        await api.put<NotificationPreference>('/notification-preferences', { categories: { [category]: { [channel]: next } } }),
      );
      toast.success('Preferences saved.');
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not save preferences.');
    }
  };

  return (
    <>
      <PageHeader title="" />

      <div className="grid items-start gap-4 xl:grid-cols-2">
          <section className="min-w-0 rounded-card bg-surface p-5 shadow-soft sm:p-6">
            <>
              <PaneHeader title="Profile" help="Your details as the studio has them." />
              <SettingsGroup>
                <SettingsRow label="Name">
                  <span className="text-sm text-ink">{user?.name}</span>
                </SettingsRow>
                <SettingsRow label="Email" help="Where we send updates, and what you sign in with.">
                  <span className="truncate text-sm text-ink">{user?.email}</span>
                </SettingsRow>
              </SettingsGroup>
              <SettingsGroup>
                <SettingsRow
                  label="Something out of date?"
                  help="Message the team to change your name, address or phone number, and we will update it for you."
                >
                  <Link to="/messages" className={buttonClass('secondary')}>
                    Message the team
                  </Link>
                </SettingsRow>
              </SettingsGroup>
            </>
          </section>

          <section className="min-w-0 rounded-card bg-surface p-5 shadow-soft sm:p-6">
            <>
              <PaneHeader
                title="Notifications"
                help="Choose how you would like to hear about project updates, messages and invoices."
              />
              {preferences.error ? (
                <div className="mt-6">
                  <ErrorState message={preferences.error} onRetry={preferences.refetch} />
                </div>
              ) : preferences.loading || !preferences.data ? (
                <div className="mt-6">
                  <LoadingState label="Loading your preferences…" />
                </div>
              ) : (
                <>
                  <SettingsGroup>
                    <div className={clsx(GRID, 'hidden px-4 py-2 text-xs font-semibold text-ink-muted')}>
                      <span>Update</span>
                      {CHANNELS.map((channel) => (
                        <span key={channel.id} className="text-center">
                          {channel.label}
                        </span>
                      ))}
                    </div>
                    {CATEGORIES.map(({ id, label, description }) => (
                      <div key={id} className={clsx(GRID, 'px-4 py-3')}>
                        <div>
                          <p className="text-sm font-medium text-ink">{label}</p>
                          <p className="mt-0.5 text-[13px] text-ink-muted">{description}</p>
                        </div>
                        {CHANNELS.map((channel) => {
                          const toggle = (hideLabel: boolean) => (
                            <Toggle
                              label={hideLabel ? `${label}: ${channel.label}` : channel.label}
                              hideLabel={hideLabel}
                              checked={preferences.data!.categories[id][channel.id]}
                              onChange={(next) => void saveChoice(id, channel.id, next)}
                            />
                          );
                          // A phone lists each switch with its name; from sm up the column header names it.
                          return (
                            <Fragment key={channel.id}>
                              <div className="mt-1 sm:hidden">{toggle(false)}</div>
                              <div className="mx-auto hidden w-fit sm:block">{toggle(true)}</div>
                            </Fragment>
                          );
                        })}
                      </div>
                    ))}
                  </SettingsGroup>
                  <SettingsGroup title="This device">
                    <div className="px-4 py-3">
                      <PushToggle />
                    </div>
                  </SettingsGroup>
                </>
              )}
              <p className="mt-3 px-1 text-[13px] text-ink-muted">
                “Phone & browser” only reaches devices where you turned notifications on. Security emails, like a password change, are always sent.
              </p>
            </>
          </section>

          <section className="min-w-0 rounded-card bg-surface p-5 shadow-soft sm:p-6">
            <>
              <PaneHeader title="Security" help="Your password, and this session." />
              <SettingsGroup title="Password">
                <form onSubmit={changePassword} className="flex max-w-md flex-col gap-4 p-4" noValidate>
                  <input type="text" name="username" autoComplete="username" value={user?.email ?? ''} hidden readOnly />
                  <Input
                    label="Current password"
                    type="password"
                    autoComplete="current-password"
                    value={passwordForm.current}
                    onChange={(event) => setPasswordForm({ ...passwordForm, current: event.target.value })}
                    required
                  />
                  <Input
                    label="New password"
                    type="password"
                    autoComplete="new-password"
                    hint="At least 12 characters. Changing it signs you out everywhere else."
                    value={passwordForm.next}
                    onChange={(event) => setPasswordForm({ ...passwordForm, next: event.target.value })}
                    required
                  />
                  <Input
                    label="Confirm new password"
                    type="password"
                    autoComplete="new-password"
                    value={passwordForm.confirm}
                    onChange={(event) => setPasswordForm({ ...passwordForm, confirm: event.target.value })}
                    required
                  />
                  {passwordError ? (
                    <p role="alert" className="rounded-control border border-danger/30 bg-danger-bg px-3 py-2 text-danger">
                      {passwordError}
                    </p>
                  ) : null}
                  <div>
                    <Button type="submit" variant="primary" loading={passwordSaving}>
                      Change password
                    </Button>
                  </div>
                </form>
              </SettingsGroup>
              <SettingsGroup title="Session">
                <SettingsRow label={`Signed in as ${user?.email ?? ''}`} help="Signing out ends this session on this device.">
                  <Button variant="destructive" onClick={logout}>
                    Sign out
                  </Button>
                </SettingsRow>
              </SettingsGroup>
            </>
          </section>

          <section className="min-w-0 rounded-card bg-surface p-5 shadow-soft sm:p-6">
            <>
              <PaneHeader title="Appearance" help="Applies to this browser only." />
              <SettingsGroup>
                <div className="p-4">
                  <AppearancePicker value={theme} onChange={setTheme} />
                </div>
              </SettingsGroup>
            </>
          </section>
      </div>
    </>
  );
}
