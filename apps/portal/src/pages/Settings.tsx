import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

import {
  AppearancePicker,
  Button,
  Card,
  Input,
  PageHeader,
  Tabs,
  Toggle,
} from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useQuery } from '@/hooks/useApi';
import { ApiError, api, tokenStore } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import type { NotificationPreference } from '@/types/api';

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
    if (passwordForm.next.length < 6) {
      return setPasswordError('Your new password must be at least 6 characters.');
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

  const savePreference = async (patch: Partial<NotificationPreference>) => {
    try {
      await api.put('/notification-preferences', patch);
      toast.success('Preferences saved.');
      await preferences.refetch();
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
          {preferences.data ? (
            <div className="mt-4 grid gap-3 md:grid-cols-3 [&>div]:rounded-control [&>div]:bg-ink/[0.035] [&>div]:p-3">
              <Toggle
                label="Email"
                description="Project updates and new messages."
                checked={preferences.data.email_enabled}
                onChange={(next) => void savePreference({ email_enabled: next })}
              />
              <Toggle
                label="SMS"
                description="Appointment reminders only."
                checked={preferences.data.sms_enabled}
                onChange={(next) => void savePreference({ sms_enabled: next })}
              />
              <Toggle
                label="In-app"
                description="Notifications inside this portal."
                checked={preferences.data.in_app_enabled}
                onChange={(next) => void savePreference({ in_app_enabled: next })}
              />
            </div>
          ) : null}
          <p className="mt-4 rounded-control bg-surface-muted px-3 py-2 text-xs text-ink-muted">
            Prototype note: these preferences are saved, but no email or SMS is actually sent in
            this build.
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
