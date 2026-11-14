import { MagnifyingGlass, Plus } from '@phosphor-icons/react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { ClientFormDialog } from '@/components/ClientFormDialog';
import { CLIENT_VIEWS } from '@/components/layout/AdminLayout';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  PageHeader,
  StatusTag,
  TableSkeleton,
  TableWrap,
  Tabs,
  Td,
  Th,
} from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useQuery } from '@/hooks/useApi';
import { useSort } from '@/hooks/useSort';
import { ApiError, api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { money } from '@/lib/format';
import type { Client } from '@/types/api';

type View = (typeof CLIENT_VIEWS)[number]['id'];

/**
 * The client book. An Admin sees every client and the money owed; a Designer sees the clients of
 * their projects, with no money (the API enforces both). A row opens the client, whose page
 * edits, deletes and invites them to the portal.
 */
export function ClientsPage() {
  const { isAdmin, can } = useAuth();
  // Installers read clients only; a Designer's edit goes to an Admin.
  const canAdd = can('Admin', 'Designer');
  const toast = useToast();
  const clients = useQuery<Client[]>('/clients');

  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const view: View = CLIENT_VIEWS.find(({ id }) => id === params.get('view'))?.id ?? 'all';
  const creating = canAdd && params.get('new') === '1';
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
  const [askingAll, setAskingAll] = useState(false);
  const [askAllPending, setAskAllPending] = useState(false);

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
  const { rows: sortedClients, header } = useSort(visible, {
    name: (client) => client.name,
    phone: (client) => client.phone ?? '',
    email: (client) => client.email,
    active: (client) => client.active_projects ?? 0,
    outstanding: (client) => client.outstanding ?? 0,
  });

  const closeForm = () => update({ new: null, name: null, email: null, phone: null }, true);

  const askAll = async () => {
    setAskAllPending(true);
    try {
      const { asked } = await api.post<{ asked: number }>('/clients/terms/reset');
      toast.success(
        asked === 1 ? '1 client will be asked again.' : `${asked} clients will be asked again.`,
      );
      setAskingAll(false);
      await clients.refetch();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not ask for the terms.');
    } finally {
      setAskAllPending(false);
    }
  };

  // The search box and buttons stand as tall as the filter tabs (their pill is 4px taller than a
  // button with a touch screen).
  const tall = 'pointer-coarse:min-h-12';

  return (
    <div className="flex h-full flex-col px-5 pb-5 pt-3 sm:px-8">
      {/* The shell's section name is not needed here; an empty heading keeps it from showing. */}
      <PageHeader title="" />

      {/* Stays on top; only the table below scrolls (inside its own rounded box). */}
      <div className="mb-4 flex shrink-0 flex-wrap items-center gap-3">
        <div className="[&>div]:mb-0">
          <Tabs
            tabs={CLIENT_VIEWS.map(({ id, label }) => ({
              id,
              label,
              count: clients.data ? counts[id] : undefined,
            }))}
            active={view}
            onChange={(id) => update({ view: id === 'all' ? null : id })}
          />
        </div>
        <div className="relative min-w-0 basis-full sm:flex-1 sm:basis-0">
          <div className="relative mx-auto w-full sm:max-w-sm">
            <MagnifyingGlass
              size={16}
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
            />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search clients"
              aria-label="Search clients"
              className={`min-h-11 w-full rounded-control border border-border bg-surface pl-9 pr-3 text-ink placeholder:text-ink-muted/70 focus:border-green-900 pointer-fine:min-h-9 ${tall}`}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 max-sm:w-full">
          {isAdmin ? (
            <Button variant="secondary" className={tall} onClick={() => setAskingAll(true)}>
              Ask all to accept terms
            </Button>
          ) : null}
          {canAdd ? (
            <Button
              variant="primary"
              className={tall}
              icon={<Plus size={16} aria-hidden="true" />}
              onClick={() => update({ new: '1' })}
            >
              Add client
            </Button>
          ) : null}
        </div>
      </div>

      {clients.error ? (
        <ErrorState message={clients.error} onRetry={clients.refetch} />
      ) : clients.loading ? (
        <TableSkeleton rows={6} columns={isAdmin ? 5 : 4} />
      ) : visible.length === 0 ? (
        <EmptyState
          title={clients.data?.length ? 'No matching clients' : 'No clients yet'}
          message={
            clients.data?.length
              ? 'Try a different search, or look under All clients.'
              : canAdd
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
            ) : canAdd ? (
              <Button variant="primary" onClick={() => update({ new: '1' })}>
                Add client
              </Button>
            ) : null
          }
        />
      ) : (
        <TableWrap className="max-md:min-w-0" wrapClassName="min-h-0 overflow-y-auto">
          <thead>
            <tr>
              <Th sort={header('name')}>Name</Th>
              <Th col="md" sort={header('phone')}>
                Phone
              </Th>
              <Th col="lg" sort={header('email')}>
                Email
              </Th>
              <Th className="text-right" sort={header('active')}>
                <span className="max-sm:hidden">Active projects</span>
                <span className="sm:hidden">Active</span>
              </Th>
              {isAdmin ? (
                <Th className="text-right" sort={header('outstanding')}>
                  <span className="max-sm:hidden">Outstanding</span>
                  <span className="sm:hidden">Owed</span>
                </Th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {sortedClients.map((client) => (
              <tr
                key={client.id}
                className="cursor-pointer hover:bg-surface-muted/40"
                onClick={(event) => {
                  if (!(event.target as HTMLElement).closest('a, button'))
                    navigate(`/clients/${client.id}`);
                }}
              >
                <Td>
                  <Link to={`/clients/${client.id}`} className="text-link [overflow-wrap:anywhere]">
                    {client.name}
                  </Link>
                  {client.status === 'Inactive' ? (
                    <span className="ml-2">
                      <StatusTag tone="neutral">Inactive</StatusTag>
                    </span>
                  ) : null}
                  {client.phone ? (
                    <p className="mt-0.5 text-xs text-ink-muted md:hidden">{client.phone}</p>
                  ) : null}
                </Td>
                <Td col="md" className="whitespace-nowrap text-ink-muted">
                  {client.phone ?? '—'}
                </Td>
                <Td col="lg" className="max-w-64 text-ink-muted [overflow-wrap:anywhere]">
                  {client.email || '—'}
                </Td>
                <Td className="tabular text-right text-ink">{client.active_projects ?? 0}</Td>
                {isAdmin ? (
                  <Td
                    className={`tabular whitespace-nowrap text-right font-semibold ${client.outstanding ? 'text-ink' : 'text-ink-muted'}`}
                  >
                    {money(client.outstanding ?? 0)}
                  </Td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}

      <ClientFormDialog
        open={creating}
        client={null}
        onClose={closeForm}
        onSaved={() => {
          closeForm();
          void clients.refetch();
        }}
      />

      <ConfirmDialog
        open={askingAll}
        title="Ask every client to accept the terms again?"
        message="Each client sees the terms window the next time they open the portal and cannot carry on until they accept. What they already accepted stays on record."
        confirmLabel="Ask everyone"
        pending={askAllPending}
        onCancel={() => setAskingAll(false)}
        onConfirm={() => void askAll()}
      />
    </div>
  );
}
