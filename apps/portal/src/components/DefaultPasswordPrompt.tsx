import { useState, type FormEvent } from 'react';

import { Button, Input, Modal } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { ApiError, api, tokenStore } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { reauthSocket } from '@/lib/socket';

/**
 * Shown after signing in with the password the studio emailed: choosing their own is recommended,
 * keeping it is fine. Either answer stops the question (the API clears the flag); closing the
 * window only postpones it to the next sign-in.
 */
export function DefaultPasswordPrompt() {
  const toast = useToast();
  const { user, passwordChosen } = useAuth();
  const [open, setOpen] = useState(true);
  const [changing, setChanging] = useState(false);
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!user?.passwordIsDefault) return null;

  const keep = async () => {
    setBusy(true);
    try {
      await api.post('/account/password/keep');
      passwordChosen();
      toast.success('Okay, your password stays as it is. You can change it any time in Settings.');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not save that. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const change = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (form.next.length < 12) return setError('Use at least 12 characters for the new password.');
    if (form.next !== form.confirm) return setError('The new passwords do not match.');
    setBusy(true);
    try {
      // Changing it signs every session out, this one included; the answer is a new one.
      const session = await api.put<{ access_token: string }>('/account/password', {
        current_password: form.current,
        new_password: form.next,
      });
      tokenStore.set(session.access_token);
      reauthSocket();
      passwordChosen();
      toast.success('Password changed.');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not change your password.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => setOpen(false)}
      title="Choose your own password?"
      description="You signed in with the password we emailed you. We recommend changing it to one only you know."
      width="sm"
      footer={
        changing ? (
          <>
            <Button variant="secondary" onClick={() => setChanging(false)} disabled={busy}>
              Back
            </Button>
            <Button type="submit" form="first-password-form" variant="primary" loading={busy}>
              Change password
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={() => void keep()} loading={busy}>
              Keep this password
            </Button>
            <Button variant="primary" onClick={() => setChanging(true)} disabled={busy}>
              Change password
            </Button>
          </>
        )
      }
    >
      {changing ? (
        <form id="first-password-form" onSubmit={change} className="flex flex-col gap-4" noValidate>
          <Input
            label="Current password"
            type="password"
            autoComplete="current-password"
            hint="The one in our email."
            value={form.current}
            onChange={(event) => setForm({ ...form, current: event.target.value })}
            required
          />
          <Input
            label="New password"
            type="password"
            autoComplete="new-password"
            hint="At least 12 characters."
            value={form.next}
            onChange={(event) => setForm({ ...form, next: event.target.value })}
            required
          />
          <Input
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            value={form.confirm}
            onChange={(event) => setForm({ ...form, confirm: event.target.value })}
            required
          />
          {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
        </form>
      ) : (
        <>
          <p className="text-sm text-ink-muted">
            Anyone who sees that email could use the password in it, so a password of your own is safer. If you keep it,
            you can still change it any time under Settings › Security.
          </p>
          {error ? <p role="alert" className="mt-3 text-sm text-danger">{error}</p> : null}
        </>
      )}
    </Modal>
  );
}
