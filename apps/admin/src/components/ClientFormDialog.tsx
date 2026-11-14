import { useEffect, useState, type FormEvent } from 'react';

import { Button, Input, Modal, Select, Textarea } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useQuery } from '@/hooks/useApi';
import { ApiError, api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
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

/**
 * Add a client (`client` null) or edit one. An Admin sets every field; a Designer adds with every
 * field but, editing, can only ask for a new phone, address or notes, which an Admin approves
 * (the API enforces both). A new client's form takes name, email and phone from the address
 * (the Enquiries inbox's "Add as client").
 */
export function ClientFormDialog({
  open,
  client,
  onClose,
  onSaved,
}: {
  open: boolean;
  client: Client | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { isAdmin } = useAuth();
  const toast = useToast();
  // Who can look after an account: the admin's own people. Admin-only on the API.
  const staff = useQuery<Array<{ id: string; name: string }>>(isAdmin && open ? '/users' : null);
  const [form, setForm] = useState<ClientForm>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Every field for an Admin, or for a Designer adding a client.
  const fullForm = isAdmin || !client;

  useEffect(() => {
    if (!open) return;
    const query = new URLSearchParams(window.location.search);
    setForm(
      client
        ? {
            name: client.name,
            email: client.email,
            phone: client.phone ?? '',
            address: client.address ?? '',
            status: client.status,
            assigned_staff_id: client.assigned_staff_id ?? '',
            notes: client.notes ?? '',
          }
        : { ...EMPTY_FORM, name: query.get('name') ?? '', email: query.get('email') ?? '', phone: query.get('phone') ?? '' },
    );
    setFormError(null);
  }, [open, client]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);

    const contact = {
      phone: form.phone.trim() || null,
      address: form.address.trim() || null,
      notes: form.notes.trim() || null,
    };
    let payload: Record<string, unknown> = contact;
    if (fullForm) {
      if (form.name.trim().length < 2) return setFormError('Enter the client’s name.');
      // Optional on a new client and on one that has none yet; an address once set can't be blanked.
      const email = form.email.trim();
      if ((email || client?.email) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return setFormError('Enter a valid email address.');
      }
      payload = { ...contact, name: form.name.trim(), ...(email ? { email } : {}) };
      if (isAdmin) Object.assign(payload, { status: form.status, assigned_staff_id: form.assigned_staff_id || null });
    }

    setSaving(true);
    try {
      if (client && !isAdmin) {
        await api.post('/change-requests', {
          kind: 'client_details',
          client_id: client.id,
          phone: contact.phone ?? '',
          address: contact.address ?? '',
          notes: contact.notes ?? '',
        });
        toast.success('Sent to the Admin for approval.');
      } else if (client) {
        await api.put<Client>(`/clients/${client.id}`, payload);
        toast.success(`${client.name} updated.`);
      } else {
        await api.post<Client>('/clients', payload);
        toast.success(`${form.name.trim()} added. Invite them to the portal from their page.`);
      }
      onSaved();
    } catch (caught) {
      setFormError(caught instanceof ApiError ? caught.message : 'Could not save this client.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={client ? `Edit ${client.name}` : 'Add client'}
      description={
        client
          ? isAdmin
            ? 'Update this client’s details.'
            : 'Suggest a new phone, address or notes. An Admin approves it before it changes.'
          : 'Create a client record. Invite them to the portal from their page when you are ready.'
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="client-form" variant="primary" loading={saving}>
            {client ? (isAdmin ? 'Save changes' : 'Send to Admin') : 'Add client'}
          </Button>
        </>
      }
    >
      <form id="client-form" onSubmit={submit} className="flex flex-col gap-4" noValidate>
        {fullForm ? (
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
              hint={
                client?.has_portal_access
                  ? 'Also how they sign in to the portal.'
                  : client?.email
                    ? undefined
                    : 'Optional for now. Needed before they can be invited to the portal.'
              }
              required={Boolean(client?.email)}
            />
            <Input
              label="Phone"
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
              placeholder="07700 900000"
            />
            {isAdmin ? (
              <Select
                label="Status"
                value={form.status}
                onChange={(event) => setForm({ ...form, status: event.target.value as 'Active' | 'Inactive' })}
                hint="Inactive clients cannot sign in to the portal."
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </Select>
            ) : null}
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
    </Modal>
  );
}
