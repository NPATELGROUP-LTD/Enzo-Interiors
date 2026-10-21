import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

import {
  AppearancePicker,
  Button,
  Card,
  ErrorState,
  Input,
  LoadingState,
  PageHeader,
  Tabs,
  Toggle,
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

export function SettingsPage() {
  const { user, logout } = useAuth();
  const { theme, set: setTheme } = useTheme();
  const toast = useToast();
  const preferences = useQuery<NotificationPreference>('/notification-preferences');

  const [tab, setTab] = useState('profile');
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
      <PageHeader title="Settings" description="Your details, notifications and security." />

      <div className="grid items-start gap-5 lg:grid-cols-[13rem_minmax(0,1fr)]">
      <Tabs
        vertical
        tabs={[
          { id: 'profile', label: 'Profile' },
          { id: 'notifications', label: 'Notifications' },
          { id: 'security', label: 'Security' },
          { id: 'appearance', label: 'Appearance' },
        ]}
        active={tab}
        onChange={setTab}
      />

      <div className="min-w-0">
      {tab === 'profile' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-5">
            <p className="label-eyebrow">Your details</p>
            <dl className="mt-3 rows">
              <div className="flex justify-between gap-3">
                <dt className="text-ink-muted">Name</dt>
                <dd className="font-medium text-ink">{user?.name}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-muted">Email</dt>
                <dd className="truncate font-medium text-ink">{user?.email}</dd>
              </div>
            </dl>
          </Card>
          <Card accent="success" className="flex flex-col p-5">
            <p className="label-eyebrow">Something out of date?</p>
            <p className="mt-2 text-ink">
              To update your name, address or phone number, message the Enzo team and we will change
              it for you.
            </p>
            <div className="mt-auto pt-4">
              <Link to="/messages" className="text-link">
                Message the team
              </Link>
            </div>
          </Card>
        </div>
      ) : null}

      {tab === 'notifications' ? (
        <Card className="p-5">
          <p className="label-eyebrow">How we contact you</p>
          <p className="mt-1 text-ink-muted">
            Choose how you would like to hear about project updates, messages and invoices.
          </p>
          {preferences.error ? (
            <div className="mt-4">
              <ErrorState message={preferences.error} onRetry={preferences.refetch} />
            </div>
          ) : preferences.loading || !preferences.data ? (
            <div className="mt-4">
              <LoadingState label="Loading your preferences…" />
            </div>
          ) : (
            <div className="mt-4 grid gap-3">
              {CATEGORIES.map(({ id, label, description }) => (
                <div key={id} className="rounded-control bg-ink/[0.035] p-3">
                  <p className="text-sm font-semibold text-ink">{label}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">{description}</p>
                  <div className="mt-2 grid gap-x-4 sm:grid-cols-3">
                    {CHANNELS.map((channel) => (
                      <Toggle
                        key={channel.id}
                        label={channel.label}
                        checked={preferences.data!.categories[id][channel.id]}
                        onChange={(next) => void saveChoice(id, channel.id, next)}
                      />
                    ))}
                  </div>
                </div>
              ))}
              <div className="rounded-control bg-ink/[0.035] p-3">
                <PushToggle />
              </div>
            </div>
          )}
          <p className="mt-4 text-xs text-ink-muted">
            “Phone & browser” only reaches devices where you turned notifications on, below. Security emails, like a password change, are always sent.
          </p>
        </Card>
      ) : null}

      {tab === 'security' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <p className="label-eyebrow">Change password</p>
            <form onSubmit={changePassword} className="mt-3 flex flex-col gap-4" noValidate>
              <Input
                label="Current password"
                type="password"
                autoComplete="current-password"
                value={passwordForm.current}
                onChange={(event) =>
                  setPasswordForm({ ...passwordForm, current: event.target.value })
                }
                required
              />
              <Input
                label="New password"
                type="password"
                autoComplete="new-password"
                value={passwordForm.next}
                onChange={(event) => setPasswordForm({ ...passwordForm, next: event.target.value })}
                required
              />
              <Input
                label="Confirm new password"
                type="password"
                autoComplete="new-password"
                value={passwordForm.confirm}
                onChange={(event) =>
                  setPasswordForm({ ...passwordForm, confirm: event.target.value })
                }
                required
              />
              {passwordError ? (
                <p
                  role="alert"
                  className="rounded-control border border-danger/30 bg-danger-bg px-3 py-2 text-danger"
                >
                  {passwordError}
                </p>
              ) : null}
              <div>
                <Button type="submit" variant="primary" loading={passwordSaving}>
                  Change password
                </Button>
              </div>
            </form>
          </Card>

          <Card>
            <p className="label-eyebrow">Session</p>
            <p className="mt-2 text-ink-muted">
              You are signed in as {user?.email}. Signing out ends this session on this device.
            </p>
            <div className="mt-4">
              <Button variant="destructive" onClick={logout}>
                Sign out
              </Button>
            </div>
          </Card>
        </div>
      ) : null}

      {tab === 'appearance' ? (
        <Card className="p-5">
          <p className="label-eyebrow">Theme</p>
          <p className="mt-1 text-ink-muted">Applies to this browser only.</p>
          <div className="mt-4">
            <AppearancePicker value={theme} onChange={setTheme} />
          </div>
        </Card>
      ) : null}
      </div>
      </div>
    </>
  );
}
