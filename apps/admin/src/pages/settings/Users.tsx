import { EnvelopeSimple, Plus } from '@phosphor-icons/react';
import clsx from 'clsx';
import { useState, type FormEvent } from 'react';

import { Button, ConfirmDialog, ErrorState, Input, LoadingState, Modal, Select } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useQuery } from '@/hooks/useApi';
import { ApiError, api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { initials } from '@/lib/format';

type Role = 'Admin' | 'Editor' | 'Designer';

const ROLES: Role[] = ['Editor', 'Designer', 'Admin'];
const article = (role: Role) => (role === 'Admin' ? 'an Admin' : role === 'Editor' ? 'an Editor' : 'a Designer');

interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: 'Active' | 'Invited';
  inviteExpired: boolean;
  twoFactorMethod: 'email' | 'totp' | null;
  created_at: string;
}

const ROLE_HELP: Record<Role, string> = {
  Admin: 'Everything: publishes, bookings, settings and users.',
  Editor: 'Edits the website and sends changes to an Admin to publish.',
  Designer: 'Works the projects they are assigned to, and their clients. Can edit the website like an Editor.',
};

function InviteDialog({ open, onClose, onInvited }: { open: boolean; onClose: () => void; onInvited: (user: User) => void }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('Editor');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const close = () => {
    setName('');
    setEmail('');
    setRole('Editor');
    setError(null);
    onClose();
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const user = await api.post<User & { emailed: boolean }>('/users', { name: name.trim(), email: email.trim(), role });
      onInvited(user);
      toast.success(
        user.emailed
          ? `Invitation sent to ${user.email}. The link lasts 7 days.`
          : `${user.name} was added, but the email could not be sent. Check the mail settings, then resend it.`,
      );
      close();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not send the invitation.');
    } finally {
      setPending(false);
    }
  };

  return (
    <Modal open={open} onClose={close} title="Invite someone" width="sm">
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <Input label="Name" autoComplete="off" value={name} onChange={(event) => setName(event.target.value)} />
        <Input label="Email" type="email" autoComplete="off" value={email} onChange={(event) => setEmail(event.target.value)} />
        <Select label="Role" value={role} hint={ROLE_HELP[role]} onChange={(event) => setRole(event.target.value as Role)}>
          {ROLES.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Select>
        {error ? (
          <p role="alert" className="rounded-control bg-danger-bg px-3 py-2 text-sm text-danger">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={pending} disabled={name.trim().length < 2 || !email.includes('@')}>
            Send invitation
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** Settings › Users: who can sign in, and as what. */
export function UsersSection() {
  const toast = useToast();
  const { user: me } = useAuth();
  const users = useQuery<User[]>('/users');
  const [inviting, setInviting] = useState(false);
  const [removing, setRemoving] = useState<User | null>(null);
  const [resetting, setResetting] = useState<User | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  if (users.error) return <ErrorState message={users.error} onRetry={users.refetch} />;
  if (!users.data) return <LoadingState label="Loading users…" />;

  const replace = (next: User) => users.setData((list) => (list ?? []).map((row) => (row.id === next.id ? next : row)));

  const setRole = async (row: User, role: Role) => {
    setBusy(row.id);
    try {
      replace(await api.put<User>(`/users/${row.id}`, { role }));
      toast.success(`${row.name} is now ${article(role)}.`);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not change the role.');
    } finally {
      setBusy(null);
    }
  };

  const resend = async (row: User) => {
    setBusy(row.id);
    try {
      const { emailed } = await api.post<{ emailed: boolean }>(`/users/${row.id}/invite`);
      if (emailed) toast.success(`A new invitation is on its way to ${row.email}.`);
      else toast.error('The email could not be sent. Check the mail settings.');
      void users.refetch();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not resend the invitation.');
    } finally {
      setBusy(null);
    }
  };

  const reset2fa = async () => {
    const row = resetting;
    setResetting(null);
    if (!row) return;
    try {
      await api.post(`/users/${row.id}/reset-2fa`);
      replace({ ...row, twoFactorMethod: null });
      toast.success(`${row.name} will set up two-step sign-in again next time they sign in.`);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not reset two-step sign-in.');
    }
  };

  const remove = async () => {
    const row = removing;
    setRemoving(null);
    if (!row) return;
    try {
      await api.delete(`/users/${row.id}`);
      users.setData((list) => (list ?? []).filter((item) => item.id !== row.id));
      toast.success(`${row.name} can no longer sign in.`);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not remove them.');
    }
  };

  return (
    <div className="max-w-3xl">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-ink">Users</h2>
          <p className="mt-1 max-w-[60ch] text-sm leading-relaxed text-ink-muted">
            Admins can do everything. Editors change the website and send their changes to an Admin, who
            publishes them or sends them back. Designers work the projects assigned to them.
          </p>
        </div>
        <Button variant="primary" icon={<Plus size={16} />} onClick={() => setInviting(true)}>
          Invite someone
        </Button>
      </header>

      <ul className="mt-6 flex flex-col">
        {users.data.map((row, index) => {
          const self = row.id === me?.id;
          return (
            <li
              key={row.id}
              className={clsx('flex flex-wrap items-center gap-x-4 gap-y-3 py-4', index > 0 && 'border-t border-border/70')}
            >
              <span
                className={clsx(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                  row.status === 'Invited' ? 'bg-ink/[0.07] text-ink-muted' : 'bg-green-900 text-on-primary',
                )}
              >
                {initials(row.name)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-ink">
                  {row.name}
                  {self ? <span className="font-normal text-ink-muted"> (you)</span> : null}
                </span>
                <span className="block truncate text-[13px] text-ink-muted">
                  {row.email}
                  {row.status === 'Invited' ? (
                    <span className={row.inviteExpired ? 'text-warning' : ''}>
                      {' · '}
                      {row.inviteExpired ? 'Invitation expired' : 'Invited, not joined yet'}
                    </span>
                  ) : null}
                  {' · '}
                  {row.twoFactorMethod === 'email'
                    ? 'Email code'
                    : row.twoFactorMethod === 'totp'
                      ? 'Authenticator app'
                      : 'No two-step yet'}
                </span>
              </span>
              <span className="flex flex-wrap items-center gap-2">
                {row.status === 'Invited' ? (
                  <Button variant="ghost" icon={<EnvelopeSimple size={15} />} loading={busy === row.id} onClick={() => void resend(row)}>
                    Resend
                  </Button>
                ) : null}
                {self ? (
                  <span className="px-2 text-sm text-ink-muted">{row.role}</span>
                ) : (
                  <select
                    aria-label={`Role for ${row.name}`}
                    value={row.role}
                    disabled={busy === row.id}
                    onChange={(event) => void setRole(row, event.target.value as Role)}
                    className="min-h-9 rounded-control border border-border bg-surface px-2.5 text-sm text-ink"
                  >
                    {ROLES.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                )}
                {row.twoFactorMethod ? (
                  <Button variant="ghost" onClick={() => setResetting(row)}>
                    Reset two-step sign-in
                  </Button>
                ) : null}
                {self ? null : (
                  <Button variant="ghost" className="text-danger" onClick={() => setRemoving(row)}>
                    Remove
                  </Button>
                )}
              </span>
            </li>
          );
        })}
      </ul>

      <InviteDialog
        open={inviting}
        onClose={() => setInviting(false)}
        onInvited={(user) => users.setData((list) => [...(list ?? []), user])}
      />
      <ConfirmDialog
        open={resetting !== null}
        title={`Reset two-step sign-in for ${resetting?.name ?? ''}?`}
        message="This removes their two-step sign-in, remembered devices and Google sign-in. They'll set it up again next time they sign in."
        confirmLabel="Reset"
        onConfirm={() => void reset2fa()}
        onCancel={() => setResetting(null)}
      />
      <ConfirmDialog
        open={removing !== null}
        title={`Remove ${removing?.name ?? ''}?`}
        message="They are signed out at once and can no longer sign in. Their past changes stay as they are."
        confirmLabel="Remove"
        onConfirm={() => void remove()}
        onCancel={() => setRemoving(null)}
      />
    </div>
  );
}
