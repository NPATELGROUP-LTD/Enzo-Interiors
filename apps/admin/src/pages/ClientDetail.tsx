import { EnvelopeSimple } from '@phosphor-icons/react';
import { useState } from 'react';
import { useParams } from 'react-router-dom';

import {
  Button,
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
import { useToast } from '@/components/ui/Toast';
import { useQuery } from '@/hooks/useApi';
import { ApiError, api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { date, dateTime, fileSize, humanise, money } from '@/lib/format';
import { invoiceTone, projectTone } from '@/lib/status';
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
  const { isAdmin } = useAuth();
  const toast = useToast();
  const [inviting, setInviting] = useState(false);

  if (loading) return <LoadingState label="Loading client…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!data) return <ErrorState message="Client not found." />;

  const { client, assigned_staff, projects, invoices, documents, activity, stats } = data;
  // No invitation table: the activity log already records every one sent.
  const invited = activity.some((entry) => entry.action === 'client_portal_invite');

  const invite = async () => {
    setInviting(true);
    try {
      const { emailed } = await api.post<{ emailed: boolean }>(`/clients/${client.id}/invite`);
      if (emailed) toast.success(`Invitation sent to ${client.email}. The link lasts 7 days.`);
      else toast.error('The invitation could not be emailed. Check Settings › Emails, then send it again.');
      await refetch();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not send the invitation.');
    } finally {
      setInviting(false);
    }
  };

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
    <div className="px-5 pb-16 pt-6 sm:px-8 lg:pt-8">
      <PageHeader
        title={client.name}
        description={[client.email, client.phone].filter(Boolean).join(' · ')}
        actions={
          <>
            {client.status === 'Inactive' ? <StatusTag tone="neutral">Inactive</StatusTag> : null}
            {isAdmin && client.status === 'Active' && !client.has_portal_access ? (
              <Button
                variant={invited ? 'secondary' : 'primary'}
                icon={<EnvelopeSimple size={16} aria-hidden="true" />}
                loading={inviting}
                onClick={invite}
              >
                {invited ? 'Resend invite' : 'Invite to portal'}
              </Button>
            ) : null}
          </>
        }
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
            {assigned_staff ? `Looked after by ${assigned_staff.name}` : ''}
          </p>
        </Card>
      </div>

      <Tabs tabs={tabsWithCounts} active={tab} onChange={setTab} />

      {tab === 'overview' ? (
        <div className="grid max-w-2xl gap-4">
          <Card>
            <p className="label-eyebrow">Contact details</p>
            <dl className="mt-3 rows">
              {[
                ['Email', client.email],
                ['Phone', client.phone ?? '—'],
                ['Address', client.address ?? '—'],
                [
                  'Portal access',
                  client.has_portal_access ? 'Signed up' : invited ? 'Invited, not signed up yet' : 'Not invited',
                ],
                ['Looked after by', assigned_staff ? assigned_staff.name : 'Nobody in particular'],
              ].map(([label, value]) => (
                <div key={label} className="flex flex-wrap justify-between gap-2">
                  <dt className="text-ink-muted">{label}</dt>
                  <dd className="text-right font-medium text-ink">{value}</dd>
                </div>
              ))}
            </dl>
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
                    <p className="truncate font-medium text-ink">{project.name}</p>
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
              No notes yet. Add some with the pencil beside them in the client list.
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
    </div>
  );
}
