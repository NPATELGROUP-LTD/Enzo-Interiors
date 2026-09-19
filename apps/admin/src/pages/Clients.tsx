import {
  MagnifyingGlass,
  PencilSimple,
  Plus,
  Trash,
} from '@phosphor-icons/react';
import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

import {
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
  Td,
  Textarea,
  Th,
} from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useQuery } from '@/hooks/useApi';
import { ApiError, api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { date, money } from '@/lib/format';
import { clientTone } from '@/lib/status';
import type { Client, StaffUser } from '@/types/api';

interface ClientForm {
  name: string;
  email: string;
  phone: string;
  address: string;
  status: 'Active' | 'Inactive';
  assigned_staff_id: string;
  notes: string;
  password: string;
}

const EMPTY_FORM: ClientForm = {
  name: '',
  email: '',
  phone: '',
  address: '',
  status: 'Active',
  assigned_staff_id: '',
  notes: '',
  password: '',
};

export function ClientsPage() {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const clients = useQuery<Client[]>('/clients');
  const staff = useQuery<StaffUser[]>('/staff');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Active' | 'Inactive'>('all');

  const [editing, setEditing] = useState<Client | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<ClientForm>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleting, setDeleting] = useState<Client | null>(null);
  const [deletePending, setDeletePending] = useState(false);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (clients.data ?? []).filter((client) => {
      if (statusFilter !== 'all' && client.status !== statusFilter) return false;
      if (!term) return true;
      return (
        client.name.toLowerCase().includes(term) ||
        client.email.toLowerCase().includes(term) ||
        (client.phone ?? '').toLowerCase().includes(term) ||
        (client.address ?? '').toLowerCase().includes(term)
      );
    });
  }, [clients.data, search, statusFilter]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormError(null);
    setCreating(true);
  };

  const openEdit = (client: Client) => {
    setForm({
      name: client.name,
      email: client.email,
      phone: client.phone ?? '',
      address: client.address ?? '',
      status: client.status,
      assigned_staff_id: client.assigned_staff_id ?? '',
      notes: client.notes ?? '',
      password: '',
    });
    setFormError(null);
    setEditing(client);
  };

  const closeForm = () => {
    setCreating(false);
    setEditing(null);
    setFormError(null);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);

    if (form.name.trim().length < 2) return setFormError('Enter the client’s name.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      return setFormError('Enter a valid email address.');
    }
    if (creating && form.password && form.password.length < 6) {
      return setFormError('Portal password must be at least 6 characters.');
    }

    // Only send what the user filled in — the API rejects unknown fields and
    // treats an omitted optional as "leave unchanged".
    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || null,
      address: form.address.trim() || null,
      status: form.status,
      assigned_staff_id: form.assigned_staff_id || null,
      notes: form.notes.trim() || null,
    };
    if (form.password) payload.password = form.password;

    setSaving(true);
    try {
      if (editing) {
        await api.put<Client>(`/clients/${editing.id}`, payload);
        toast.success(`${form.name.trim()} updated.`);
      } else {
        await api.post<Client>('/clients', payload);
        toast.success(`${form.name.trim()} added.`);
      }
      closeForm();
      await clients.refetch();
    } catch (caught) {
      setFormError(caught instanceof ApiError ? caught.message : 'Could not save this client.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeletePending(true);
    try {
      await api.delete(`/clients/${deleting.id}`);
      toast.success(`${deleting.name} deleted.`);
      setDeleting(null);
      await clients.refetch();
    } catch (caught) {
      // The API refuses while projects/quotes/invoices still reference the
      // client, and its message names them — surface it verbatim.
      toast.error(caught instanceof ApiError ? caught.message : 'Could not delete this client.');
      setDeleting(null);
    } finally {
      setDeletePending(false);
    }
  };

  const formFields = (
    <form id="client-form" onSubmit={submit} className="flex flex-col gap-4" noValidate>
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
          onChange={(event) =>
            setForm({ ...form, status: event.target.value as 'Active' | 'Inactive' })
          }
        >
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </Select>
      </div>

      <Input
        label="Address"
        value={form.address}
        onChange={(event) => setForm({ ...form, address: event.target.value })}
        placeholder="42 Elms Road, Stoneygate, Leicester, LE2 3JD"
      />

      <Select
        label="Assigned staff member"
        value={form.assigned_staff_id}
        onChange={(event) => setForm({ ...form, assigned_staff_id: event.target.value })}
        hint="Designers and installers only see clients assigned to them."
      >
        <option value="">Unassigned</option>
        {(staff.data ?? []).map((member) => (
          <option key={member.id} value={member.id}>
            {member.name} · {member.role}
          </option>
        ))}
      </Select>

      <Textarea
        label="Notes"
        value={form.notes}
        onChange={(event) => setForm({ ...form, notes: event.target.value })}
        placeholder="Preferences, site constraints, anything the team should know."
      />

      <Input
        label={editing ? 'Reset portal password' : 'Portal password'}
        type="password"
        value={form.password}
        onChange={(event) => setForm({ ...form, password: event.target.value })}
        hint={
          editing
            ? 'Leave blank to keep the current password.'
            : 'Optional. Leave blank to create the record without portal access yet.'
        }
      />

      {formError ? (
        <p role="alert" className="rounded-control border border-danger/30 bg-danger-bg px-3 py-2 text-danger">
          {formError}
        </p>
      ) : null}
    </form>
  );

  return (
    <>
      <PageHeader
        title="Clients"
        description="Every client record, their projects, and what they have spent."
        actions={
          isAdmin ? (
            <Button variant="primary" icon={<Plus size={16} aria-hidden="true" />} onClick={openCreate}>
              Add client
            </Button>
          ) : null
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative min-w-56 flex-1">
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
        <select
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(event.target.value as 'all' | 'Active' | 'Inactive')
          }
          aria-label="Filter by status"
          className="min-h-11 rounded-control border border-border bg-surface px-3 text-ink focus:border-green-900"
        >
          <option value="all">All statuses</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
      </div>

      {clients.error ? (
        <ErrorState message={clients.error} onRetry={clients.refetch} />
      ) : clients.loading ? (
        <Card className="p-0">
          <TableSkeleton rows={6} columns={5} />
        </Card>
      ) : visible.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            title={clients.data?.length ? 'No matching clients' : 'No clients yet'}
            message={
              clients.data?.length
                ? 'Try a different search term or clear the status filter.'
                : 'Add your first client to start tracking projects, quotes and invoices.'
            }
            action={
              clients.data?.length ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSearch('');
                    setStatusFilter('all');
                  }}
                >
                  Clear filters
                </Button>
              ) : isAdmin ? (
                <Button variant="primary" onClick={openCreate}>
                  Add client
                </Button>
              ) : null
            }
          />
        </Card>
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <Th>Client</Th>
              <Th>Contact</Th>
              <Th>Status</Th>
              <Th>Joined</Th>
              <Th className="text-right">Total spent</Th>
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
                  {client.address ? (
                    <p className="mt-0.5 max-w-xs truncate text-xs text-ink-muted">
                      {client.address}
                    </p>
                  ) : null}
                </Td>
                <Td>
                  <p className="text-ink">{client.email}</p>
                  <p className="text-xs text-ink-muted">{client.phone ?? 'No phone'}</p>
                </Td>
                <Td>
                  <StatusTag tone={clientTone(client.status)}>{client.status}</StatusTag>
                </Td>
                <Td className="whitespace-nowrap text-ink-muted">{date(client.joined_date)}</Td>
                <Td className="tabular whitespace-nowrap text-right font-semibold text-ink">
                  {money(client.total_spent)}
                </Td>
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
            ? 'Update this client’s details and portal access.'
            : 'Create a client record. Portal access is optional at this stage.'
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
              This permanently removes the client record along with their conversations,
              documents and bookings.
            </p>
            <p className="mt-2 text-ink-muted">
              If they have projects, quotes or invoices, the deletion will be refused —
              set them to Inactive instead.
            </p>
          </>
        }
        confirmLabel="Delete client"
        pending={deletePending}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}
