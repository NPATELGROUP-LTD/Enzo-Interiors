import {
  PencilSimple,
  Plus,
  Trash,
} from '@phosphor-icons/react';
import { useEffect, useState, type FormEvent } from 'react';

import {
  AppearancePicker,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  PageHeader,
  Select,
  StatusTag,
  TableSkeleton,
  TableWrap,
  Tabs,
  Td,
  Textarea,
  Th,
  Toggle,
} from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useQuery } from '@/hooks/useApi';
import { ApiError, api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { dateTime, humanise } from '@/lib/format';
import { useTheme } from '@/lib/theme';
import type {
  ActivityLog,
  BusinessSettings,
  NotificationPreference,
  SavedReply,
  StaffRole,
  StaffUser,
} from '@/types/api';
import { STAFF_ROLES } from '@/types/api';

export function SettingsPage() {
  const { user, isAdmin } = useAuth();
  const { theme, set: setTheme } = useTheme();
  const toast = useToast();

  const settings = useQuery<BusinessSettings>('/business-settings');
  const staff = useQuery<StaffUser[]>('/staff');
  const savedReplies = useQuery<SavedReply[]>('/saved-replies');
  const preferences = useQuery<NotificationPreference>('/notification-preferences');
  // The audit log is Admin-only server-side, so do not even request it otherwise.
  const logs = useQuery<ActivityLog[]>(isAdmin ? '/activity-logs?limit=200' : null);

  const [tab, setTab] = useState('business');

  /* ---- Business profile ---- */
  const [business, setBusiness] = useState({
    business_name: '',
    vat_rate: 20,
    brand_primary_color: '#173C30',
    email_from_address: '',
  });
  const [businessSaving, setBusinessSaving] = useState(false);

  useEffect(() => {
    if (settings.data) {
      setBusiness({
        business_name: settings.data.business_name,
        vat_rate: settings.data.vat_rate,
        brand_primary_color: settings.data.brand_primary_color,
        email_from_address: settings.data.email_from_address ?? '',
      });
    }
  }, [settings.data]);

  const saveBusiness = async (event: FormEvent) => {
    event.preventDefault();
    setBusinessSaving(true);
    try {
      await api.put('/business-settings', {
        business_name: business.business_name.trim(),
        vat_rate: business.vat_rate,
        brand_primary_color: business.brand_primary_color,
        email_from_address: business.email_from_address.trim() || null,
      });
      toast.success('Business profile saved.');
      await settings.refetch();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not save these settings.');
    } finally {
      setBusinessSaving(false);
    }
  };

  /* ---- Team ---- */
  const [staffModal, setStaffModal] = useState<StaffUser | 'new' | null>(null);
  const [staffForm, setStaffForm] = useState({
    name: '',
    email: '',
    role: 'Designer' as StaffRole,
    password: '',
  });
  const [staffError, setStaffError] = useState<string | null>(null);
  const [staffSaving, setStaffSaving] = useState(false);
  const [deletingStaff, setDeletingStaff] = useState<StaffUser | null>(null);

  const openStaff = (member: StaffUser | 'new') => {
    setStaffForm(
      member === 'new'
        ? { name: '', email: '', role: 'Designer', password: '' }
        : { name: member.name, email: member.email, role: member.role, password: '' },
    );
    setStaffError(null);
    setStaffModal(member);
  };

  const submitStaff = async (event: FormEvent) => {
    event.preventDefault();
    setStaffError(null);
    if (staffForm.name.trim().length < 2) return setStaffError('Enter a name.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(staffForm.email.trim())) {
      return setStaffError('Enter a valid email address.');
    }
    if (staffModal === 'new' && staffForm.password.length < 6) {
      return setStaffError('Password must be at least 6 characters.');
    }

    setStaffSaving(true);
    try {
      if (staffModal === 'new') {
        await api.post('/staff', {
          name: staffForm.name.trim(),
          email: staffForm.email.trim(),
          role: staffForm.role,
          password: staffForm.password,
        });
        toast.success('Team member added.');
      } else if (staffModal) {
        const payload: Record<string, unknown> = {
          name: staffForm.name.trim(),
          email: staffForm.email.trim(),
          role: staffForm.role,
        };
        if (staffForm.password) payload.password = staffForm.password;
        await api.put(`/staff/${staffModal.id}`, payload);
        toast.success('Team member updated.');
      }
      setStaffModal(null);
      await staff.refetch();
    } catch (caught) {
      setStaffError(caught instanceof ApiError ? caught.message : 'Could not save this account.');
    } finally {
      setStaffSaving(false);
    }
  };

  /* ---- Password ---- */
  const [passwordForm, setPasswordForm] = useState({ current: '', next: '', confirm: '' });
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaving, setPasswordSaving] = useState(false);

  const changePassword = async (event: FormEvent) => {
    event.preventDefault();
    setPasswordError(null);
    if (passwordForm.next.length < 6) return setPasswordError('New password must be at least 6 characters.');
    if (passwordForm.next !== passwordForm.confirm) return setPasswordError('The new passwords do not match.');

    setPasswordSaving(true);
    try {
      await api.put('/account/password', {
        current_password: passwordForm.current,
        new_password: passwordForm.next,
      });
      toast.success('Password changed.');
      setPasswordForm({ current: '', next: '', confirm: '' });
    } catch (caught) {
      setPasswordError(caught instanceof ApiError ? caught.message : 'Could not change your password.');
    } finally {
      setPasswordSaving(false);
    }
  };

  /* ---- Saved replies ---- */
  const [replyModal, setReplyModal] = useState<SavedReply | 'new' | null>(null);
  const [replyForm, setReplyForm] = useState({ title: '', body: '', is_shared: false });
  const [replyError, setReplyError] = useState<string | null>(null);

  const openReply = (reply: SavedReply | 'new') => {
    setReplyForm(
      reply === 'new'
        ? { title: '', body: '', is_shared: false }
        : { title: reply.title, body: reply.body, is_shared: reply.staff_id === null },
    );
    setReplyError(null);
    setReplyModal(reply);
  };

  const submitReply = async (event: FormEvent) => {
    event.preventDefault();
    setReplyError(null);
    if (replyForm.title.trim().length < 2) return setReplyError('Enter a title.');
    if (replyForm.body.trim().length < 2) return setReplyError('Enter the reply text.');

    try {
      const payload = {
        title: replyForm.title.trim(),
        body: replyForm.body.trim(),
        is_shared: replyForm.is_shared,
      };
      if (replyModal === 'new') {
        await api.post('/saved-replies', payload);
        toast.success('Saved reply created.');
      } else if (replyModal) {
        await api.put(`/saved-replies/${replyModal.id}`, payload);
        toast.success('Saved reply updated.');
      }
      setReplyModal(null);
      await savedReplies.refetch();
    } catch (caught) {
      setReplyError(caught instanceof ApiError ? caught.message : 'Could not save this template.');
    }
  };

  const savePreference = async (patch: Partial<NotificationPreference>) => {
    try {
      await api.put('/notification-preferences', patch);
      toast.success('Notification preferences saved.');
      await preferences.refetch();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not save preferences.');
    }
  };

  return (
    <>
      <PageHeader title="Settings" description="Business profile, team, templates and the audit log." />

      <div className="grid items-start gap-5 lg:grid-cols-[13rem_minmax(0,1fr)]">
      <Tabs
        vertical
        tabs={[
          { id: 'business', label: 'Business profile' },
          { id: 'team', label: 'Team', count: staff.data?.length },
          { id: 'replies', label: 'Saved replies', count: savedReplies.data?.length },
          { id: 'account', label: 'My account' },
          ...(isAdmin ? [{ id: 'audit', label: 'Audit log', count: logs.data?.length }] : []),
        ]}
        active={tab}
        onChange={setTab}
      />

      <div className="min-w-0">
      {tab === 'business' ? (
        settings.loading ? (
          <Card className="p-0">
            <TableSkeleton rows={4} columns={2} />
          </Card>
        ) : (
          <Card className="p-5">
            <form onSubmit={saveBusiness} className="grid gap-x-6 gap-y-4 lg:grid-cols-2" noValidate>
              <Input
                label="Business name"
                value={business.business_name}
                onChange={(event) => setBusiness({ ...business, business_name: event.target.value })}
                disabled={!isAdmin}
                required
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="VAT rate (%)"
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={business.vat_rate}
                  onChange={(event) =>
                    setBusiness({ ...business, vat_rate: Number(event.target.value) })
                  }
                  disabled={!isAdmin}
                  hint="Applied to new invoices."
                />
                <Input
                  label="Brand colour"
                  value={business.brand_primary_color}
                  onChange={(event) =>
                    setBusiness({ ...business, brand_primary_color: event.target.value })
                  }
                  disabled={!isAdmin}
                  hint="Hex value, e.g. #173C30"
                />
              </div>
              <Input
                label="Sending email address"
                type="email"
                value={business.email_from_address}
                onChange={(event) =>
                  setBusiness({ ...business, email_from_address: event.target.value })
                }
                disabled={!isAdmin}
                hint="Recorded for reference. No email is sent in this prototype."
              />
              {isAdmin ? (
                <div className="lg:col-span-2">
                  <Button type="submit" variant="primary" loading={businessSaving}>
                    Save profile
                  </Button>
                </div>
              ) : (
                <p className="text-ink-muted lg:col-span-2">Only an Admin can change the business profile.</p>
              )}
            </form>
          </Card>
        )
      ) : null}

      {tab === 'team' ? (
        <>
          {isAdmin ? (
            <div className="mb-3 flex justify-end">
              <Button
                variant="primary"
                icon={<Plus size={16} aria-hidden="true" />}
                onClick={() => openStaff('new')}
              >
                Add team member
              </Button>
            </div>
          ) : null}

          {staff.loading ? (
            <Card className="p-0">
              <TableSkeleton rows={4} columns={3} />
            </Card>
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <Th>Name</Th>
                  <Th>Email</Th>
                  <Th>Role</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {(staff.data ?? []).map((member) => (
                  <tr key={member.id} className="hover:bg-surface-muted/40">
                    <Td className="font-medium text-ink">
                      {member.name}
                      {member.id === user?.id ? (
                        <span className="ml-1.5 text-xs text-ink-muted">(you)</span>
                      ) : null}
                    </Td>
                    <Td className="text-ink-muted">{member.email}</Td>
                    <Td>
                      <StatusTag tone={member.role === 'Admin' ? 'info' : 'neutral'}>
                        {member.role}
                      </StatusTag>
                    </Td>
                    <Td>
                      <div className="flex justify-end gap-1">
                        {isAdmin ? (
                          <>
                            <button
                              type="button"
                              onClick={() => openStaff(member)}
                              aria-label={`Edit ${member.name}`}
                              className="flex min-h-11 min-w-11 items-center justify-center rounded-control text-ink-muted hover:text-green-900"
                            >
                              <PencilSimple size={16} aria-hidden="true" />
                            </button>
                            {member.id !== user?.id ? (
                              <button
                                type="button"
                                onClick={() => setDeletingStaff(member)}
                                aria-label={`Remove ${member.name}`}
                                className="flex min-h-11 min-w-11 items-center justify-center rounded-control text-ink-muted hover:text-danger"
                              >
                                <Trash size={16} aria-hidden="true" />
                              </button>
                            ) : null}
                          </>
                        ) : (
                          <span className="text-xs text-ink-muted">Admin only</span>
                        )}
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </>
      ) : null}

      {tab === 'replies' ? (
        <>
          <div className="mb-3 flex justify-end">
            <Button
              variant="primary"
              icon={<Plus size={16} aria-hidden="true" />}
              onClick={() => openReply('new')}
            >
              New template
            </Button>
          </div>
          {savedReplies.loading ? (
            <Card className="p-0">
              <TableSkeleton rows={4} columns={2} />
            </Card>
          ) : (savedReplies.data ?? []).length === 0 ? (
            <Card className="p-0">
              <EmptyState
                title="No saved replies"
                message="Create templates for the replies you send most often."
              />
            </Card>
          ) : (
            <div className="grid gap-3 xl:grid-cols-2">
              {(savedReplies.data ?? []).map((reply) => (
                <Card key={reply.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-ink">{reply.title}</p>
                      <StatusTag tone={reply.staff_id === null ? 'info' : 'neutral'}>
                        {reply.staff_id === null ? 'Shared with the team' : 'Personal'}
                      </StatusTag>
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => openReply(reply)}
                        aria-label={`Edit ${reply.title}`}
                        className="flex min-h-11 min-w-11 items-center justify-center rounded-control text-ink-muted hover:text-green-900"
                      >
                        <PencilSimple size={16} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await api.delete(`/saved-replies/${reply.id}`);
                            toast.success('Template deleted.');
                            await savedReplies.refetch();
                          } catch (caught) {
                            toast.error(
                              caught instanceof ApiError ? caught.message : 'Could not delete.',
                            );
                          }
                        }}
                        aria-label={`Delete ${reply.title}`}
                        className="flex min-h-11 min-w-11 items-center justify-center rounded-control text-ink-muted hover:text-danger"
                      >
                        <Trash size={16} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap leading-relaxed text-ink-muted">
                    {reply.body}
                  </p>
                </Card>
              ))}
            </div>
          )}
        </>
      ) : null}

      {tab === 'account' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <p className="label-eyebrow">Appearance</p>
            <p className="mt-1 text-ink-muted">Applies to this browser only.</p>
            <div className="mt-3">
              <AppearancePicker value={theme} onChange={setTheme} />
            </div>
          </Card>

          <Card>
            <p className="label-eyebrow">Notifications</p>
            <p className="mt-1 text-ink-muted">
              Preferences are stored, but nothing is sent in this prototype.
            </p>
            {preferences.data ? (
              <div className="mt-3 flex flex-col gap-1">
                <Toggle
                  label="Email"
                  checked={preferences.data.email_enabled}
                  onChange={(next) => void savePreference({ email_enabled: next })}
                />
                <Toggle
                  label="SMS"
                  checked={preferences.data.sms_enabled}
                  onChange={(next) => void savePreference({ sms_enabled: next })}
                />
                <Toggle
                  label="In-app"
                  checked={preferences.data.in_app_enabled}
                  onChange={(next) => void savePreference({ in_app_enabled: next })}
                />
              </div>
            ) : null}
          </Card>

          <Card className="lg:col-span-2">
            <p className="label-eyebrow">Change password</p>
            <form onSubmit={changePassword} className="mt-3 grid gap-4 md:grid-cols-3" noValidate>
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
                <p role="alert" className="rounded-control bg-danger-bg px-3 py-2 text-danger md:col-span-3">
                  {passwordError}
                </p>
              ) : null}
              <div className="md:col-span-3">
                <Button type="submit" variant="primary" loading={passwordSaving}>
                  Change password
                </Button>
              </div>
            </form>
          </Card>
        </div>
      ) : null}

      {tab === 'audit' && isAdmin ? (
        logs.error ? (
          <ErrorState message={logs.error} onRetry={logs.refetch} />
        ) : logs.loading ? (
          <Card className="p-0">
            <TableSkeleton rows={8} columns={4} />
          </Card>
        ) : (logs.data ?? []).length === 0 ? (
          <Card className="p-0">
            <EmptyState title="No activity yet" message="Staff and client actions are recorded here." />
          </Card>
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>When</Th>
                <Th>Who</Th>
                <Th>Action</Th>
                <Th>Target</Th>
                <Th>Details</Th>
              </tr>
            </thead>
            <tbody>
              {(logs.data ?? []).map((entry) => (
                <tr key={entry.id} className="hover:bg-surface-muted/40">
                  <Td className="whitespace-nowrap text-ink-muted">{dateTime(entry.created_at)}</Td>
                  <Td>
                    <p className="text-ink">{entry.actor_name}</p>
                    <p className="text-xs text-ink-muted">{entry.actor_type}</p>
                  </Td>
                  <Td className="font-medium text-ink">{humanise(entry.action)}</Td>
                  <Td className="text-xs text-ink-muted">
                    {entry.target_table}
                    <br />
                    {entry.target_id}
                  </Td>
                  <Td className="max-w-sm text-xs text-ink-muted">
                    {entry.details
                      ? Object.entries(entry.details)
                          .map(([key, value]) => `${humanise(key)}: ${JSON.stringify(value)}`)
                          .join(' · ')
                      : '—'}
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )
      ) : null}

      {/* ---- Modals ---- */}
      <Modal
        open={staffModal !== null}
        onClose={() => setStaffModal(null)}
        title={staffModal === 'new' ? 'Add team member' : 'Edit team member'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setStaffModal(null)} disabled={staffSaving}>
              Cancel
            </Button>
            <Button type="submit" form="staff-form" variant="primary" loading={staffSaving}>
              Save
            </Button>
          </>
        }
      >
        <form id="staff-form" onSubmit={submitStaff} className="flex flex-col gap-4" noValidate>
          <Input
            label="Name"
            value={staffForm.name}
            onChange={(event) => setStaffForm({ ...staffForm, name: event.target.value })}
            required
          />
          <Input
            label="Email"
            type="email"
            value={staffForm.email}
            onChange={(event) => setStaffForm({ ...staffForm, email: event.target.value })}
            required
          />
          <Select
            label="Role"
            value={staffForm.role}
            onChange={(event) => setStaffForm({ ...staffForm, role: event.target.value as StaffRole })}
            hint="Designers and Installers only see clients and projects assigned to them."
          >
            {STAFF_ROLES.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </Select>
          <Input
            label={staffModal === 'new' ? 'Password' : 'Reset password'}
            type="password"
            value={staffForm.password}
            onChange={(event) => setStaffForm({ ...staffForm, password: event.target.value })}
            hint={staffModal === 'new' ? undefined : 'Leave blank to keep the current password.'}
          />
          {staffError ? (
            <p role="alert" className="rounded-control border border-danger/30 bg-danger-bg px-3 py-2 text-danger">
              {staffError}
            </p>
          ) : null}
        </form>
      </Modal>

      <Modal
        open={replyModal !== null}
        onClose={() => setReplyModal(null)}
        title={replyModal === 'new' ? 'New saved reply' : 'Edit saved reply'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setReplyModal(null)}>
              Cancel
            </Button>
            <Button type="submit" form="reply-form" variant="primary">
              Save template
            </Button>
          </>
        }
      >
        <form id="reply-form" onSubmit={submitReply} className="flex flex-col gap-4" noValidate>
          <Input
            label="Title"
            value={replyForm.title}
            onChange={(event) => setReplyForm({ ...replyForm, title: event.target.value })}
            placeholder="Consultation confirmed"
            required
          />
          <Textarea
            label="Reply text"
            value={replyForm.body}
            onChange={(event) => setReplyForm({ ...replyForm, body: event.target.value })}
            required
          />
          {isAdmin ? (
            <Toggle
              label="Share with the whole team"
              description="Shared templates are available to every staff member."
              checked={replyForm.is_shared}
              onChange={(next) => setReplyForm({ ...replyForm, is_shared: next })}
            />
          ) : null}
          {replyError ? (
            <p role="alert" className="rounded-control border border-danger/30 bg-danger-bg px-3 py-2 text-danger">
              {replyError}
            </p>
          ) : null}
        </form>
      </Modal>

      <ConfirmDialog
        open={deletingStaff !== null}
        title={`Remove ${deletingStaff?.name ?? 'team member'}?`}
        message="If they are still assigned to clients or projects the removal will be refused — reassign that work first."
        confirmLabel="Remove account"
        onConfirm={async () => {
          if (!deletingStaff) return;
          try {
            await api.delete(`/staff/${deletingStaff.id}`);
            toast.success('Team member removed.');
            await staff.refetch();
          } catch (caught) {
            toast.error(caught instanceof ApiError ? caught.message : 'Could not remove.');
          }
          setDeletingStaff(null);
        }}
        onCancel={() => setDeletingStaff(null)}
      />
      </div>
      </div>
    </>
  );
}
