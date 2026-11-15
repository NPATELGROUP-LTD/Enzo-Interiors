import { EnvelopeSimple, Plus } from '@phosphor-icons/react';
import clsx from 'clsx';
import { useState, type FormEvent } from 'react';

import { Button, ConfirmDialog, ErrorState, Input, Listbox, LoadingState, Modal, Select, Textarea } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useQuery } from '@/hooks/useApi';
import { ApiError, api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { THEIR_SPAM_HINT, initials } from '@/lib/format';

type Role = 'Admin' | 'Infra' | 'Editor' | 'Designer' | 'Installer';

const ROLES: Role[] = ['Editor', 'Designer', 'Installer', 'Admin', 'Infra'];
/** Admin and Infra accounts are the Infra manager's to manage; an Admin manages the rest. */
const isPrivileged = (role: Role) => role === 'Admin' || role === 'Infra';
const LABEL: Record<Role, string> = { Admin: 'Admin', Infra: 'Infra manager', Editor: 'Editor', Designer: 'Designer', Installer: 'Installer' };
const ARTICLE: Record<Role, string> = { Admin: 'an Admin', Infra: 'an Infra manager', Editor: 'an Editor', Designer: 'a Designer', Installer: 'an Installer' };

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

interface Removal {
  id: string;
  target_id: string;
  target_name: string;
  requested_name: string;
  reason: string;
  status: 'Pending' | 'Approved' | 'Declined';
  created_at: string;
}

const ROLE_HELP: Record<Role, string> = {
  Admin: 'Runs the business: publishes, bookings, clients, invoices and projects.',
  Infra: 'Runs the platform: users, website status and alerts. Sees no client, project, invoice, message or booking.',
  Editor: 'Edits the website and sends changes to an Admin to publish.',
  Designer: 'Works the projects they are assigned to and moves their stages. Asks an Admin to change client details.',
  Installer: 'Sees the projects they are assigned to. Asks an Admin to move a stage.',
};

function InviteDialog({
  open,
  roles,
  onClose,
  onInvited,
}: {
  open: boolean;
  roles: Role[];
  onClose: () => void;
  onInvited: (user: User) => void;
}) {
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
          ? `Invitation sent to ${user.email}. The link lasts 7 days. ${THEIR_SPAM_HINT}`
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
          {roles.map((option) => (
            <option key={option} value={option}>
              {LABEL[option]}
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

/** A few words for the person who decides: why an Admin should go, or why a request is declined. */
function NoteDialog({
  open,
  title,
  label,
  hint,
  confirmLabel,
  minLength,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  label: string;
  hint?: string;
  confirmLabel: string;
  minLength: number;
  onClose: () => void;
  onSubmit: (note: string) => Promise<void>;
}) {
  const [note, setNote] = useState('');
  const [pending, setPending] = useState(false);
  const close = () => {
    setNote('');
    onClose();
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    try {
      await onSubmit(note.trim());
      close();
    } catch {
      // The caller has already said what went wrong; the words stay for another go.
    } finally {
      setPending(false);
    }
  };
  return (
    <Modal open={open} onClose={close} title={title} width="sm">
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <Textarea label={label} hint={hint} rows={3} maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} autoFocus />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={pending} disabled={note.trim().length < minLength}>
            {confirmLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** Settings › Users: who can sign in, and as what. */
export function UsersSection() {
  const toast = useToast();
  const { user: me, isInfra } = useAuth();
  const users = useQuery<User[]>('/users');
  const removals = useQuery<Removal[]>('/users/removal-requests');
  const [inviting, setInviting] = useState(false);
  const [removing, setRemoving] = useState<User | null>(null);
  const [asking, setAsking] = useState<User | null>(null);
  const [approving, setApproving] = useState<Removal | null>(null);
  const [declining, setDeclining] = useState<Removal | null>(null);
  const [resetting, setResetting] = useState<User | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  if (users.error) return <ErrorState message={users.error} onRetry={users.refetch} />;
  if (!users.data) return <LoadingState label="Loading users…" />;

  // Infra manages every role; an Admin hands out and changes the three below Admin.
  const roles = isInfra ? ROLES : ROLES.filter((role) => !isPrivileged(role));
  const mayManage = (row: User) => isInfra || !isPrivileged(row.role);
  const pending = (removals.data ?? []).filter((row) => row.status === 'Pending');
  const requestFor = (row: User) => pending.find((request) => request.target_id === row.id);

  const replace = (next: User) => users.setData((list) => (list ?? []).map((row) => (row.id === next.id ? next : row)));

  const setRole = async (row: User, role: Role) => {
    setBusy(row.id);
    try {
      replace(await api.put<User>(`/users/${row.id}`, { role }));
      toast.success(`${row.name} is now ${ARTICLE[role]}.`);
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
      if (emailed) toast.success(`A new invitation is on its way to ${row.email}. ${THEIR_SPAM_HINT}`);
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

  /** An Editor, Designer or Installer needs no password; an Admin or Infra manager does. */
  const remove = async (password: string) => {
    const row = removing;
    if (!row) return;
    setWorking(true);
    try {
      await api.delete(`/users/${row.id}`, isPrivileged(row.role) ? { password } : undefined);
      users.setData((list) => (list ?? []).filter((item) => item.id !== row.id));
      void removals.refetch();
      setRemoving(null);
      toast.success(`${row.name} can no longer sign in.`);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not remove them.');
    } finally {
      setWorking(false);
    }
  };

  const askToRemove = async (reason: string) => {
    const row = asking;
    if (!row) return;
    try {
      await api.post(`/users/${row.id}/removal-request`, { reason });
      void removals.refetch();
      toast.success(`An Infra manager has been asked to remove ${row.name}. You'll be told what they decide.`);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not send the request.');
      throw caught;
    }
  };

  const approve = async (password: string) => {
    const request = approving;
    if (!request) return;
    setWorking(true);
    try {
      await api.post(`/users/removal-requests/${request.id}/approve`, { password });
      users.setData((list) => (list ?? []).filter((item) => item.id !== request.target_id));
      void removals.refetch();
      setApproving(null);
      toast.success(`${request.target_name} can no longer sign in.`);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not remove them.');
    } finally {
      setWorking(false);
    }
  };

  const decline = async (note: string) => {
    const request = declining;
    if (!request) return;
    try {
      await api.post(`/users/removal-requests/${request.id}/decline`, { note });
      void removals.refetch();
      toast.success(`${request.target_name} stays. ${request.requested_name} will be told.`);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not decline the request.');
      throw caught;
    }
  };

  return (
    <div>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-ink">Users</h2>
          <p className="mt-1 max-w-[60ch] text-sm leading-relaxed text-ink-muted">
            {isInfra
              ? 'Infra managers look after who can sign in. Admins run the business and ask you to remove another Admin. Editors change the website and Designers work the projects assigned to them.'
              : 'Admins run the business. Editors change the website and send their changes to an Admin, who publishes them or sends them back. Designers work the projects assigned to them. To remove another Admin, ask an Infra manager.'}
          </p>
        </div>
        <Button variant="primary" icon={<Plus size={16} />} onClick={() => setInviting(true)}>
          Invite someone
        </Button>
      </header>

      {isInfra && pending.length > 0 ? (
        <section aria-label="Waiting for you" className="mt-6 rounded-card border border-warning/40 bg-warning-bg/50 p-4">
          <h3 className="text-sm font-semibold text-ink">Waiting for you</h3>
          <ul className="mt-2 flex flex-col divide-y divide-border/70">
            {pending.map((request) => (
              <li key={request.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3 first:pt-1 last:pb-0">
                <span className="min-w-[14rem] flex-1 text-sm">
                  <span className="block font-semibold text-ink">
                    {request.requested_name} asks to remove {request.target_name}
                  </span>
                  <span className="block whitespace-pre-wrap break-words text-ink-muted">{request.reason}</span>
                </span>
                <span className="flex items-center gap-2">
                  <Button variant="ghost" onClick={() => setDeclining(request)}>
                    Decline
                  </Button>
                  <Button variant="destructive" onClick={() => setApproving(request)}>
                    Remove {request.target_name.split(' ')[0]}
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <ul className="mt-6 flex flex-col">
        {users.data.map((row, index) => {
          const self = row.id === me?.id;
          const manage = mayManage(row);
          const asked = requestFor(row);
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
                {row.status === 'Invited' && manage ? (
                  <Button variant="ghost" icon={<EnvelopeSimple size={15} />} loading={busy === row.id} onClick={() => void resend(row)}>
                    Resend
                  </Button>
                ) : null}
                {self || !manage ? (
                  <span className="order-last w-32 px-2 text-sm text-ink-muted">{LABEL[row.role]}</span>
                ) : (
                  <Listbox
                    aria-label={`Role for ${row.name}`}
                    value={row.role}
                    disabled={busy === row.id}
                    onChange={(event) => void setRole(row, event.target.value as Role)}
                    className="order-last w-32 text-sm"
                  >
                    {roles.map((option) => (
                      <option key={option} value={option}>
                        {LABEL[option]}
                      </option>
                    ))}
                  </Listbox>
                )}
                {row.twoFactorMethod && manage ? (
                  <Button variant="ghost" onClick={() => setResetting(row)}>
                    Reset two-step sign-in
                  </Button>
                ) : null}
                {self ? null : manage ? (
                  <Button variant="ghost" className="text-danger" onClick={() => setRemoving(row)}>
                    Remove
                  </Button>
                ) : row.role === 'Admin' ? (
                  asked ? (
                    <span className="px-2 text-sm text-ink-muted">Removal requested</span>
                  ) : (
                    <Button variant="ghost" className="text-danger" onClick={() => setAsking(row)}>
                      Request removal
                    </Button>
                  )
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>

      <InviteDialog
        open={inviting}
        roles={roles}
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
        password={removing !== null && isPrivileged(removing.role)}
        pending={working}
        onConfirm={(password) => void remove(password)}
        onCancel={() => setRemoving(null)}
      />
      <NoteDialog
        open={asking !== null}
        title={`Ask to remove ${asking?.name ?? ''}`}
        label="Why should they go?"
        hint="An Infra manager reads this before they decide."
        confirmLabel="Send request"
        minLength={5}
        onClose={() => setAsking(null)}
        onSubmit={askToRemove}
      />
      <ConfirmDialog
        open={approving !== null}
        title={`Remove ${approving?.target_name ?? ''}?`}
        message={
          <>
            <p>
              {approving?.requested_name} asked for this. They are signed out at once and can no longer sign in.
            </p>
            <p className="mt-2 whitespace-pre-wrap break-words text-ink-muted">{approving?.reason}</p>
          </>
        }
        confirmLabel="Remove"
        password
        pending={working}
        onConfirm={(password) => void approve(password)}
        onCancel={() => setApproving(null)}
      />
      <NoteDialog
        open={declining !== null}
        title={`Keep ${declining?.target_name ?? ''}?`}
        label="A word for the person who asked (optional)"
        confirmLabel="Decline request"
        minLength={0}
        onClose={() => setDeclining(null)}
        onSubmit={decline}
      />
    </div>
  );
}
