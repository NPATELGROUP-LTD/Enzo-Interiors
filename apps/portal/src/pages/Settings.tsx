import { useState, type FormEvent } from 'react';

import {
  Button,
  Card,
  Input,
  PageHeader,
  Select,
  Tabs,
  Toggle,
} from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useQuery } from '@/hooks/useApi';
import { ApiError, api } from '@/lib/api';
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
      await api.put('/account/password', {
        current_password: passwordForm.current,
        new_password: passwordForm.next,
      });
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

      <Tabs
        tabs={[
          { id: 'profile', label: 'Profile' },
          { id: 'notifications', label: 'Notifications' },
          { id: 'security', label: 'Security' },
          { id: 'appearance', label: 'Appearance' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'profile' ? (
        <Card className="max-w-xl">
          <p className="label-eyebrow">Your details</p>
          <dl className="mt-3 flex flex-col gap-2.5">
            <div className="flex justify-between gap-3 border-b border-border pb-2">
              <dt className="text-ink-muted">Name</dt>
              <dd className="font-medium text-ink">{user?.name}</dd>
            </div>
            <div className="flex justify-between gap-3 border-b border-border pb-2">
              <dt className="text-ink-muted">Email</dt>
              <dd className="font-medium text-ink">{user?.email}</dd>
            </div>
          </dl>
          <p className="mt-4 text-ink-muted">
            To update your name, address or phone number, message the Enzo team and we will change
            it for you.
          </p>
        </Card>
      ) : null}

      {tab === 'notifications' ? (
        <Card className="max-w-xl">
          <p className="label-eyebrow">How we contact you</p>
          <p className="mt-1 text-ink-muted">
            Choose how you would like to hear about project updates, messages and invoices.
          </p>
          {preferences.data ? (
            <div className="mt-4 flex flex-col gap-1">
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
          <p className="mt-4 rounded-control border border-border bg-surface-muted px-3 py-2 text-xs text-ink-muted">
            Prototype note: these preferences are saved, but no email or SMS is actually sent in
            this build.
          </p>
        </Card>
      ) : null}

      {tab === 'security' ? (
        <div className="grid max-w-3xl gap-4 lg:grid-cols-2">
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
        <Card className="max-w-xl">
          <p className="label-eyebrow">Theme</p>
          <p className="mt-1 text-ink-muted">Applies to this browser only.</p>
          <div className="mt-3 max-w-xs">
            <Select
              label="Appearance"
              value={theme}
              onChange={(event) => setTheme(event.target.value as 'light' | 'dark')}
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </Select>
          </div>
        </Card>
      ) : null}
    </>
  );
}
