import { MagnifyingGlass, PencilSimple, Plus, Trash } from '@phosphor-icons/react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { CLIENT_VIEWS } from '@/components/layout/AdminLayout';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  Select,
  StatusTag,
  TableSkeleton,
  TableWrap,
  Tabs,
  Td,
  Textarea,
  Th,
} from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useQuery } from '@/hooks/useApi';
import { ApiError, api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { date, money } from '@/lib/format';
import type { Client } from '@/types/api';

interface ClientForm {
  name: string;
  email: string;
  phone: string;
  address: string;
  status: 'Active' | 'Inactive';
  assigned_staff_id: string;
  notes: string;
}

const EMPTY_FORM: ClientForm = {
  name: '',
  email: '',
  phone: '',
  address: '',
  status: 'Active',
  assigned_staff_id: '',
  notes: '',
};

type View = (typeof CLIENT_VIEWS)[number]['id'];

/**
 * The client book. An Admin sees and edits every client; a Designer sees the
 * clients of their projects and may change only phone, address and notes (the
 * API enforces both). Portal access is an invitation, sent from a client's
 * page; nobody types a password for them here.
 */
export function ClientsPage() {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const clients = useQuery<Client[]>('/clients');
  // Who can look after an account: the admin's own people. Admin-only on the API.
  const staff = useQuery<Array<{ id: string; name: string }>>(isAdmin ? '/users' : null);

  const [params, setParams] = useSearchParams();
  const view: View = CLIENT_VIEWS.find(({ id }) => id === params.get('view'))?.id ?? 'all';
  const creating = isAdmin && params.get('new') === '1';
  /** Changes some of the address's parameters and keeps the rest (see Appointments). */
  const update = (changes: Record<string, string | null>, replace = false) =>
    setParams(
      () => {
        const next = new URLSearchParams(window.location.search);
        for (const [key, value] of Object.entries(changes)) {
          if (value === null) next.delete(key);
          else next.set(key, value);
        }
        return next;
      },
      { replace },
    );

  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState<ClientForm>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleting, setDeleting] = useState<Client | null>(null);
  const [deletePending, setDeletePending] = useState(false);

  const counts = useMemo(() => {
    const rows = clients.data ?? [];
    const active = rows.filter((client) => client.status === 'Active').length;
    return { all: rows.length, active, inactive: rows.length - active };
  }, [clients.data]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (clients.data ?? []).filter((client) => {
      if (view === 'active' && client.status !== 'Active') return false;
      if (view === 'inactive' && client.status !== 'Inactive') return false;
      if (!term) return true;
      return [client.name, client.email, client.phone ?? '', client.address ?? ''].some((value) =>
        value.toLowerCase().includes(term),
      );
    });
  }, [clients.data, search, view]);

  // Opened from the button or the menu bar's "Add client…": a blank form either way.
  useEffect(() => {
    if (!creating) return;
    // The Enquiries inbox hands over the sender's details in the address.
    const query = new URLSearchParams(window.location.search);
    setForm({
      ...EMPTY_FORM,
      name: query.get('name') ?? '',
      email: query.get('email') ?? '',
      phone: query.get('phone') ?? '',
    });
    setFormError(null);
  }, [creating]);
  const openCreate = () => update({ new: '1' });

  const openEdit = (client: Client) => {
    setForm({
      name: client.name,
      email: client.email,
      phone: client.phone ?? '',
      address: client.address ?? '',
      status: client.status,
      assigned_staff_id: client.assigned_staff_id ?? '',
      notes: client.notes ?? '',
    });
    setFormError(null);
    setEditing(client);
  };

  const closeForm = () => {
    if (creating) update({ new: null, name: null, email: null, phone: null }, true);
    setEditing(null);
    setFormError(null);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);

    const contact = {
      phone: form.phone.trim() || null,
      address: form.address.trim() || null,
      notes: form.notes.trim() || null,
    };
    let payload: Record<string, unknown> = contact;
    if (isAdmin) {
      if (form.name.trim().length < 2) return setFormError('Enter the client’s name.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
        return setFormError('Enter a valid email address.');
      }
      payload = {
        ...contact,
        name: form.name.trim(),
        email: form.email.trim(),
        status: form.status,
        assigned_staff_id: form.assigned_staff_id || null,
      };
    }

    setSaving(true);
    try {
      if (editing) {
        await api.put<Client>(`/clients/${editing.id}`, payload);
        toast.success(`${editing.name} updated.`);
      } else {
        await api.post<Client>('/clients', payload);
        toast.success(`${form.name.trim()} added. Invite them to the portal from their page.`);
      }
      closeForm();
      await clients.refetch();
    } catch (caught) {
      setFormError(caught instanceof ApiError ? caught.message : 'Could not save this client.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async (password: string) => {
    if (!deleting) return;
    setDeletePending(true);
    try {
      await api.delete(`/clients/${deleting.id}`, { password });
      toast.success(`${deleting.name} deleted.`);
      setDeleting(null);
      await clients.refetch();
    } catch (caught) {
      // Stays open: a mistyped password is retyped, not re-clicked from the start.
      toast.error(caught instanceof ApiError ? caught.message : 'Could not delete this client.');
    } finally {
      setDeletePending(false);
    }
  };

  const formFields = (
    <form id="client-form" onSubmit={submit} className="flex flex-col gap-4" noValidate>
      {isAdmin ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Full name"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            required
          />
          <Input
            label="Email address"
            type="email"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
            hint={editing?.has_portal_access ? 'Also how they sign in to the portal.' : undefined}
            required
          />
          <Input
            label="Phone"
            value={form.phone}
            onChange={(event) => setForm({ ...form, phone: event.target.value })}
            placeholder="07700 900000"
          />
          <Select
            label="Status"
            value={form.status}
            onChange={(event) => setForm({ ...form, status: event.target.value as 'Active' | 'Inactive' })}
            hint="Inactive clients cannot sign in to the portal."
          >
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </Select>
        </div>
      ) : (
        <Input
          label="Phone"
          value={form.phone}
          onChange={(event) => setForm({ ...form, phone: event.target.value })}
          placeholder="07700 900000"
        />
      )}

      <Input
        label="Address"
        value={form.address}
        onChange={(event) => setForm({ ...form, address: event.target.value })}
        placeholder="42 Elms Road, Stoneygate, Leicester, LE2 3JD"
      />

      {isAdmin ? (
        <Select
          label="Looked after by"
          value={form.assigned_staff_id}
          onChange={(event) => setForm({ ...form, assigned_staff_id: event.target.value })}
          hint="For your records. Designers see a client through the projects assigned to them."
        >
          <option value="">Nobody in particular</option>
          {(staff.data ?? []).map((member) => (
            <option key={member.id} value={member.id}>
              {member.name}
            </option>
          ))}
        </Select>
      ) : null}

      <Textarea
        label="Notes"
        value={form.notes}
        onChange={(event) => setForm({ ...form, notes: event.target.value })}
        placeholder="Preferences, site constraints, anything the team should know."
      />

      {formError ? (
        <p role="alert" className="rounded-control border border-danger/30 bg-danger-bg px-3 py-2 text-danger">
          {formError}
        </p>
      ) : null}
    </form>
  );

  return (
    <div className="px-5 pb-16 pt-6 sm:px-8 lg:pt-8">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <Tabs
          tabs={CLIENT_VIEWS.map(({ id, label }) => ({ id, label, count: clients.data ? counts[id] : undefined }))}
          active={view}
          onChange={(id) => update({ view: id === 'all' ? null : id })}
        />
        <div className="mb-4 flex flex-1 flex-wrap justify-end gap-3">
          <div className="relative min-w-56 max-w-sm flex-1">
            <MagnifyingGlass
              size={16}
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
            />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, email, phone or address"
              aria-label="Search clients"
              className="min-h-11 w-full rounded-control border border-border bg-surface pl-9 pr-3 text-ink placeholder:text-ink-muted/70 focus:border-green-900"
            />
          </div>
          {isAdmin ? (
            <Button variant="primary" icon={<Plus size={16} aria-hidden="true" />} onClick={openCreate}>
              Add client
            </Button>
          ) : null}
        </div>
      </div>

      {clients.error ? (
        <ErrorState message={clients.error} onRetry={clients.refetch} />
      ) : clients.loading ? (
        <TableSkeleton rows={6} columns={5} />
      ) : visible.length === 0 ? (
        <EmptyState
          title={clients.data?.length ? 'No matching clients' : 'No clients yet'}
          message={
            clients.data?.length
              ? 'Try a different search, or look under All clients.'
              : isAdmin
                ? 'Add your first client to start tracking projects and invoices.'
                : 'Clients appear here once a project of theirs is assigned to you.'
          }
          action={
            clients.data?.length ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setSearch('');
                  update({ view: null });
                }}
              >
                Show all clients
              </Button>
            ) : isAdmin ? (
              <Button variant="primary" onClick={openCreate}>
                Add client
              </Button>
            ) : null
          }
        />
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <Th>Client</Th>
              <Th>Contact</Th>
              <Th>Joined</Th>
              {isAdmin ? <Th className="text-right">Total spent</Th> : null}
              <Th className="text-right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {visible.map((client) => (
              <tr key={client.id} className="hover:bg-surface-muted/40">
                <Td>
                  <Link to={`/clients/${client.id}`} className="text-link">
                    {client.name}
                  </Link>
                  {client.status === 'Inactive' ? (
                    <span className="ml-2">
                      <StatusTag tone="neutral">Inactive</StatusTag>
                    </span>
                  ) : null}
                  {client.address ? (
                    <p className="mt-0.5 max-w-xs truncate text-xs text-ink-muted">{client.address}</p>
                  ) : null}
                </Td>
                <Td>
                  <p className="text-ink">{client.email}</p>
                  <p className="text-xs text-ink-muted">{client.phone ?? 'No phone'}</p>
                </Td>
                <Td className="whitespace-nowrap text-ink-muted">{date(client.joined_date)}</Td>
                {isAdmin ? (
                  <Td className="tabular whitespace-nowrap text-right font-semibold text-ink">
                    {money(client.total_spent ?? 0)}
                  </Td>
                ) : null}
                <Td>
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => openEdit(client)}
                      aria-label={`Edit ${client.name}`}
                      className="flex min-h-11 min-w-11 items-center justify-center rounded-control text-ink-muted transition-colors hover:text-green-900"
                    >
                      <PencilSimple size={16} aria-hidden="true" />
                    </button>
                    {isAdmin ? (
                      <button
                        type="button"
                        onClick={() => setDeleting(client)}
                        aria-label={`Delete ${client.name}`}
                        className="flex min-h-11 min-w-11 items-center justify-center rounded-control text-ink-muted transition-colors hover:text-danger"
                      >
                        <Trash size={16} aria-hidden="true" />
                      </button>
                    ) : null}
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}

      <Modal
        open={creating || editing !== null}
        onClose={closeForm}
        title={editing ? `Edit ${editing.name}` : 'Add client'}
        description={
          editing
            ? isAdmin
              ? 'Update this client’s details.'
              : 'You can update their phone, address and notes.'
            : 'Create a client record. Invite them to the portal from their page when you are ready.'
        }
        footer={
          <>
            <Button variant="secondary" onClick={closeForm} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" form="client-form" variant="primary" loading={saving}>
              {editing ? 'Save changes' : 'Add client'}
            </Button>
          </>
        }
      >
        {formFields}
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title={`Delete ${deleting?.name ?? 'client'}?`}
        message={
          <>
            <p>
              This permanently deletes the client and everything that belongs to them: their projects, invoices
              (paid ones too), documents and messages. Their portal sign-in stops working.
            </p>
            <p className="mt-2 text-ink-muted">It cannot be undone. To keep their history, set them to Inactive instead.</p>
          </>
        }
        confirmLabel="Delete client"
        password
        pending={deletePending}
        onConfirm={(password) => void confirmDelete(password)}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
