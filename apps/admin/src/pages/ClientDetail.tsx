import {
  ArrowLeft,
} from '@phosphor-icons/react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import {
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Progress,
  StatusTag,
  TableWrap,
  Tabs,
  Td,
  Th,
} from '@/components/ui';
import { useQuery } from '@/hooks/useApi';
import { date, dateTime, fileSize, humanise, money, relative } from '@/lib/format';
import { clientTone, invoiceTone, projectTone, quoteTone } from '@/lib/status';
import type { ClientDetail as ClientDetailPayload } from '@/types/api';
import { SERVICE_LABELS } from '@/types/api';

/**
 * Client Detail with the six tabs named in websitemap.md 3.4:
 * Overview, Projects, Invoices, Documents, Notes, Activity Log.
 */
const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'projects', label: 'Projects' },
  { id: 'invoices', label: 'Invoices' },
  { id: 'documents', label: 'Documents' },
  { id: 'notes', label: 'Notes' },
  { id: 'activity', label: 'Activity log' },
];

export function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, loading, error, refetch } = useQuery<ClientDetailPayload>(
    id ? `/clients/${id}/detail` : null,
  );
  const [tab, setTab] = useState('overview');

  if (loading) return <LoadingState label="Loading client…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!data) return <ErrorState message="Client not found." />;

  const { client, assigned_staff, projects, invoices, documents, quotes, bookings, activity, stats } =
    data;

  const tabsWithCounts = TABS.map((entry) => ({
    ...entry,
    count:
      entry.id === 'projects'
        ? projects.length
        : entry.id === 'invoices'
          ? invoices.length
          : entry.id === 'documents'
            ? documents.length
            : entry.id === 'activity'
              ? activity.length
              : undefined,
  }));

  return (
    <>
      <Link to="/clients" className="text-link mb-4 inline-flex items-center gap-1.5">
        <ArrowLeft size={14} aria-hidden="true" />
        All clients
      </Link>

      <PageHeader
        title={client.name}
        description={[client.email, client.phone].filter(Boolean).join(' · ')}
        actions={<StatusTag tone={clientTone(client.status)}>{client.status}</StatusTag>}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card accent="success" className="pl-4">
          <p className="label-eyebrow">Lifetime value</p>
          <p className="tabular mt-1.5 text-2xl font-bold text-green-900">
            {money(stats.lifetime_value)}
          </p>
          <p className="mt-1 text-xs text-ink-muted">From invoices marked paid</p>
        </Card>
        <Card accent={stats.outstanding > 0 ? 'warning' : 'none'} className="pl-4">
          <p className="label-eyebrow">Outstanding</p>
          <p className="tabular mt-1.5 text-2xl font-bold text-green-900">
            {money(stats.outstanding)}
          </p>
          <p className="mt-1 text-xs text-ink-muted">Unpaid and overdue</p>
        </Card>
        <Card className="pl-4">
          <p className="label-eyebrow">Active projects</p>
          <p className="tabular mt-1.5 text-2xl font-bold text-green-900">
            {stats.active_projects}
          </p>
          <p className="mt-1 text-xs text-ink-muted">of {stats.total_projects} total</p>
        </Card>
        <Card className="pl-4">
          <p className="label-eyebrow">Client since</p>
          <p className="mt-1.5 text-lg font-bold text-green-900">{date(client.joined_date)}</p>
          <p className="mt-1 text-xs text-ink-muted">
            {assigned_staff ? `Looked after by ${assigned_staff.name}` : 'Unassigned'}
          </p>
        </Card>
      </div>

      <Tabs tabs={tabsWithCounts} active={tab} onChange={setTab} />

      {tab === 'overview' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <p className="label-eyebrow">Contact details</p>
            <dl className="mt-3 rows">
              {[
                ['Email', client.email],
                ['Phone', client.phone ?? '—'],
                ['Address', client.address ?? '—'],
                ['Portal access', client.has_portal_access ? 'Enabled' : 'Not set up'],
                ['Assigned to', assigned_staff ? `${assigned_staff.name} (${assigned_staff.role})` : 'Unassigned'],
              ].map(([label, value]) => (
                <div key={label} className="flex flex-wrap justify-between gap-2">
                  <dt className="text-ink-muted">{label}</dt>
                  <dd className="text-right font-medium text-ink">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card>
            <p className="label-eyebrow">Quotes</p>
            {quotes.length === 0 ? (
              <p className="py-6 text-center text-ink-muted">No quotes raised yet.</p>
            ) : (
              <ul className="mt-3 rows">
                {quotes.slice(0, 5).map((quote) => (
                  <li key={quote.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0">
                    <div className="min-w-0">
                      <p className="truncate text-ink">
                        {SERVICE_LABELS[quote.service_id]} · {quote.type}
                      </p>
                      <p className="text-xs text-ink-muted">{date(quote.created_at)}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="tabular font-semibold text-ink">{money(quote.total)}</span>
                      <StatusTag tone={quoteTone(quote.status)}>{quote.status}</StatusTag>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="lg:col-span-2">
            <p className="label-eyebrow">Bookings</p>
            {bookings.length === 0 ? (
              <p className="py-6 text-center text-ink-muted">No consultations booked.</p>
            ) : (
              <ul className="mt-3 rows">
                {bookings.slice(-6).reverse().map((booking) => (
                  <li key={booking.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0">
                    <div>
                      <p className="text-ink">{SERVICE_LABELS[booking.service_type]} consultation</p>
                      <p className="text-xs text-ink-muted">
                        {dateTime(booking.date_time)} · {relative(booking.date_time)}
                      </p>
                    </div>
                    <StatusTag tone={booking.status === 'Confirmed' ? 'success' : booking.status === 'Pending' ? 'warning' : 'neutral'}>
                      {booking.status}
                    </StatusTag>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      ) : null}

      {tab === 'projects' ? (
        projects.length === 0 ? (
          <Card className="p-0">
            <EmptyState title="No projects" message="This client has no projects yet." />
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {projects.map((project) => (
              <Card key={project.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link to={`/projects/${project.id}`} className="text-link block truncate">
                      {project.name}
                    </Link>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      {SERVICE_LABELS[project.type]}
                      {project.assigned_designer_name ? ` · ${project.assigned_designer_name}` : ''}
                    </p>
                  </div>
                  <StatusTag tone={projectTone(project.status)}>{project.status}</StatusTag>
                </div>
                <div className="mt-3">
                  <Progress value={project.progress_pct} label={`${project.name} progress`} />
                </div>
                {project.current_stage ? (
                  <p className="mt-2 text-xs text-ink-muted">{project.current_stage}</p>
                ) : null}
                {!project.client_visible ? (
                  <p className="mt-2 text-xs text-warning">Hidden from the client portal</p>
                ) : null}
              </Card>
            ))}
          </div>
        )
      ) : null}

      {tab === 'invoices' ? (
        invoices.length === 0 ? (
          <Card className="p-0">
            <EmptyState title="No invoices" message="Nothing has been invoiced to this client." />
          </Card>
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Number</Th>
                <Th>Status</Th>
                <Th>Due</Th>
                <Th className="text-right">Amount</Th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <Td className="font-medium text-ink">{invoice.number}</Td>
                  <Td>
                    <StatusTag tone={invoiceTone(invoice.status, invoice.is_overdue)}>
                      {invoice.is_overdue && invoice.status !== 'Overdue'
                        ? `${invoice.status} · overdue`
                        : invoice.status}
                    </StatusTag>
                  </Td>
                  <Td className="whitespace-nowrap text-ink-muted">{date(invoice.due_date)}</Td>
                  <Td className="tabular whitespace-nowrap text-right font-semibold text-ink">
                    {money(invoice.amount)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )
      ) : null}

      {tab === 'documents' ? (
        documents.length === 0 ? (
          <Card className="p-0">
            <EmptyState title="No documents" message="Nothing has been uploaded for this client." />
          </Card>
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Type</Th>
                <Th>Uploaded</Th>
                <Th>Size</Th>
                <Th>Client can see</Th>
              </tr>
            </thead>
            <tbody>
              {documents.map((document) => (
                <tr key={document.id}>
                  <Td className="font-medium text-ink">{document.name}</Td>
                  <Td>
                    <StatusTag tone="info">{document.type}</StatusTag>
                  </Td>
                  <Td className="whitespace-nowrap text-ink-muted">{date(document.upload_date)}</Td>
                  <Td className="tabular whitespace-nowrap text-ink-muted">
                    {fileSize(document.size_bytes)}
                  </Td>
                  <Td>
                    <StatusTag tone={document.client_visible ? 'success' : 'neutral'}>
                      {document.client_visible ? 'Visible' : 'Internal only'}
                    </StatusTag>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )
      ) : null}

      {tab === 'notes' ? (
        <Card>
          <p className="label-eyebrow">Internal notes</p>
          {client.notes ? (
            <p className="mt-3 whitespace-pre-wrap leading-relaxed text-ink">{client.notes}</p>
          ) : (
            <p className="py-6 text-center text-ink-muted">
              No notes recorded. Edit the client from the Clients list to add some.
            </p>
          )}
        </Card>
      ) : null}

      {tab === 'activity' ? (
        activity.length === 0 ? (
          <Card className="p-0">
            <EmptyState
              title="No activity yet"
              message="Changes to this client will be recorded here."
            />
          </Card>
        ) : (
          <Card>
            <ul className="rows">
              {activity.map((entry) => (
                <li key={entry.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-medium text-ink">{humanise(entry.action)}</p>
                    <p className="text-xs text-ink-muted">{dateTime(entry.created_at)}</p>
                  </div>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    by {entry.actor_name} ({entry.actor_type})
                  </p>
                  {entry.details ? (
                    <p className="mt-1 text-xs text-ink-muted">
                      {Object.entries(entry.details)
                        .map(([key, value]) => `${humanise(key)}: ${String(value)}`)
                        .join(' · ')}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </Card>
        )
      ) : null}
    </>
  );
}
