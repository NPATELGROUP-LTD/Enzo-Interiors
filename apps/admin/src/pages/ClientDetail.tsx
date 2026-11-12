import {
  ArrowsClockwise,
  ChatsCircle,
  EnvelopeSimple,
  PencilSimple,
  Plus,
  Trash,
} from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import {
  Button,
  Card,
  ConfirmDialog,
  ErrorState,
  LoadingState,
  PageHeader,
  Progress,
  StatusTag,
} from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useQuery } from '@/hooks/useApi';
import { useStages } from '@/hooks/useStages';
import { ApiError, api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { THEIR_SPAM_HINT, date, dateTime, humanise, money } from '@/lib/format';
import { invoiceTone, projectTone } from '@/lib/status';
import type { ClientDetail as ClientDetailPayload } from '@/types/api';
import { SERVICE_LABELS } from '@/types/api';

import { ChangeRequests } from '@/components/ChangeRequests';
import { ClientChat } from '@/components/ClientChat';
import { ClientFormDialog } from '@/components/ClientFormDialog';
import { DocumentsTable } from '@/components/DocumentsTable';

import { NewProjectDialog, useDesigners } from './Projects';

/** The client page: contact and portal in a floating bar on the left; every section as a card beside it. */
const LINK = 'text-green-900 hover:text-green-700 [overflow-wrap:anywhere]';

export function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { stages } = useStages();
  const { data, loading, error, refetch } = useQuery<ClientDetailPayload>(
    id ? `/clients/${id}/detail` : null,
  );
  const { isAdmin, can } = useAuth();
  // A Designer's edit is a request an Admin approves; an Installer only reads.
  const canEdit = can('Admin', 'Designer');
  const toast = useToast();
  const [inviting, setInviting] = useState(false);
  const [asking, setAsking] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const designers = useDesigners(isAdmin);

  // Only mounted where it has its own column, so a hidden chat never opens a thread.
  const [wide, setWide] = useState(() => window.matchMedia('(min-width: 1536px)').matches);
  useEffect(() => {
    const query = window.matchMedia('(min-width: 1536px)');
    const onChange = () => setWide(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  if (loading) return <LoadingState label="Loading client…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!data) return <ErrorState message="Client not found." />;

  const { client, assigned_staff, projects, invoices, documents, activity, stats } = data;
  // No invitation table: the activity log already records every one sent.
  const invited = activity.some((entry) => entry.action === 'client_portal_invite');
  // They have the emailed password and have not yet changed or kept it: sending again replaces it.
  const onEmailedPassword = Boolean(client.password_is_default);

  const invite = async () => {
    setInviting(true);
    try {
      const { emailed } = await api.post<{ emailed: boolean }>(`/clients/${client.id}/invite`);
      if (emailed)
        toast.success(`Invitation sent to ${client.email} with a new password. ${THEIR_SPAM_HINT}`);
      else
        toast.error(
          'The invitation could not be emailed. Check Settings › Emails, then send it again.',
        );
      await refetch();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not send the invitation.');
    } finally {
      setInviting(false);
    }
  };

  // The portal shows the terms window on their next open; every earlier acceptance stays on record.
  const askTerms = async () => {
    setAsking(true);
    try {
      await api.post(`/clients/${client.id}/terms/reset`);
      toast.success(
        `${client.name} will be asked to accept the terms again the next time they open the portal.`,
      );
      await refetch();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not ask for the terms.');
    } finally {
      setAsking(false);
    }
  };

  const confirmDelete = async (password: string) => {
    setDeletePending(true);
    try {
      await api.delete(`/clients/${client.id}`, { password });
      toast.success(`${client.name} deleted.`);
      navigate('/clients', { replace: true });
    } catch (caught) {
      // Stays open: a mistyped password is retyped, not re-clicked from the start.
      toast.error(caught instanceof ApiError ? caught.message : 'Could not delete this client.');
      setDeletePending(false);
    }
  };

  const chat = client.status === 'Active' && client.has_portal_access;
  const portalStatus =
    client.has_portal_access && !onEmailedPassword
      ? 'Signed up'
      : invited
        ? 'Invited, still on the emailed password'
        : 'Not invited';

  return (
    <div className="flex h-full flex-col overflow-y-auto px-5 pb-5 pt-3 [mask-image:linear-gradient(to_bottom,transparent,#000_14px)] sm:px-8 lg:overflow-visible lg:[mask-image:none]">
      <PageHeader
        title={client.name}
        actions={
          <>
            {/* A client who cannot sign in to the portal would never see a message. */}
            <Button
              variant="secondary"
              className="max-sm:w-11 max-sm:gap-0 max-sm:px-0"
              icon={<ChatsCircle size={16} aria-hidden="true" />}
              disabled={client.status !== 'Active' || !client.has_portal_access}
              title={
                client.status !== 'Active'
                  ? 'Inactive clients cannot sign in to read messages'
                  : client.has_portal_access
                    ? undefined
                    : 'Invite them to the portal first'
              }
              onClick={() => navigate(`/messages?client=${encodeURIComponent(client.id)}`)}
            >
              <span className="max-sm:sr-only">
                {client.status === 'Active' && !client.has_portal_access
                  ? 'Message (invite first)'
                  : 'Message'}
              </span>
            </Button>
            {isAdmin ? (
              <Button
                variant="secondary"
                className="max-sm:w-11 max-sm:gap-0 max-sm:px-0"
                icon={<Plus size={16} aria-hidden="true" />}
                onClick={() => setCreatingProject(true)}
              >
                <span className="max-sm:sr-only">New project</span>
              </Button>
            ) : null}
            {canEdit ? (
              <Button
                variant="secondary"
                className="max-sm:w-11 max-sm:gap-0 max-sm:px-0"
                icon={<PencilSimple size={16} aria-hidden="true" />}
                onClick={() => setEditing(true)}
              >
                <span className="max-sm:sr-only">Edit</span>
              </Button>
            ) : null}
            {isAdmin ? (
              <Button
                variant="destructive"
                className="max-sm:w-11 max-sm:gap-0 max-sm:px-0"
                icon={<Trash size={16} aria-hidden="true" />}
                onClick={() => setDeleting(true)}
              >
                <span className="max-sm:sr-only">Delete</span>
              </Button>
            ) : null}
          </>
        }
      />

      <ChangeRequests clientId={client.id} onDecided={() => void refetch()} />

      {/* From xl up the page is one screen: details left, sections right (each scrolls in its own box). Below that it stacks and the page scrolls. */}
      <div
        className={`mx-auto mt-3 grid w-full grid-cols-1 max-w-[100rem] gap-5 lg:min-h-0 lg:flex-1 lg:grid-rows-1 lg:grid-cols-[19rem_minmax(0,1fr)] ${chat ? '2xl:grid-cols-[19rem_minmax(0,1fr)_24rem]' : ''}`}
      >
        <div className="flex min-w-0 flex-col gap-5 lg:min-h-0">
        <Card className="shrink-0">
          {client.status === 'Inactive' ? (
            <div className="mb-3">
              <StatusTag tone="neutral">Inactive</StatusTag>
            </div>
          ) : null}
          <p className="label-eyebrow">Contact</p>
          <dl className="mt-3 flex flex-col gap-3.5 [&_dt]:text-[11px] [&_dt]:font-semibold [&_dt]:uppercase [&_dt]:tracking-wide [&_dt]:text-ink-muted [&_dd]:mt-0.5 [&_dd]:text-sm [&_dd]:font-medium [&_dd]:leading-snug [&_dd]:text-ink [&_dd]:[overflow-wrap:anywhere]">
            <div>
              <dt className="text-xs text-ink-muted">Phone</dt>
              <dd className="text-sm font-medium text-ink">
                {client.phone ? (
                  <a href={`tel:${client.phone.replace(/[^\d+]/g, '')}`} className={LINK}>
                    {client.phone}
                  </a>
                ) : (
                  '—'
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">Email</dt>
              <dd className="text-sm font-medium text-ink">
                {client.email ? (
                  <a href={`mailto:${client.email}`} className={LINK}>
                    {client.email}
                  </a>
                ) : (
                  '—'
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">Address</dt>
              <dd className="text-sm font-medium leading-snug text-ink [overflow-wrap:anywhere]">
                {client.address
                  ? client.address
                      .split(',')
                      .map((part) => part.trim())
                      .filter(Boolean)
                      .map((part, i) => (
                        <span key={i} className="block">
                          {part}
                        </span>
                      ))
                  : '—'}
              </dd>
            </div>
          </dl>

          <div className="mt-4 border-t border-border pt-4">
            <p className="label-eyebrow">Portal</p>
            <dl className="mt-3 flex flex-col gap-2.5 text-sm [&>div]:flex [&>div]:items-start [&>div]:justify-between [&>div]:gap-3 [&_dt]:shrink-0 [&_dt]:text-xs [&_dt]:text-ink-muted [&_dd]:text-right [&_dd]:font-medium">
              <div>
                <dt>Status</dt>
                <dd className={client.has_portal_access && !onEmailedPassword ? 'text-success' : 'text-ink'}>
                  {portalStatus}
                </dd>
              </div>
              {client.has_portal_access ? (
                <div>
                  <dt>Terms</dt>
                  <dd className={client.terms_accepted ? 'text-success' : 'text-warning'}>
                    {client.terms_accepted ? 'Accepted' : 'Not accepted yet'}
                    {client.terms_accepted && client.terms_accepted_at ? (
                      <span className="block text-xs font-normal text-ink-muted">
                        {dateTime(client.terms_accepted_at)}
                      </span>
                    ) : null}
                  </dd>
                </div>
              ) : null}
            </dl>
            {isAdmin &&
            client.email &&
            client.status === 'Active' &&
            (!client.has_portal_access || onEmailedPassword) ? (
              <Button
                className="mt-3"
                variant={invited ? 'secondary' : 'primary'}
                icon={<EnvelopeSimple size={16} aria-hidden="true" />}
                loading={inviting}
                onClick={invite}
                title={
                  onEmailedPassword
                    ? 'Emails a new password; the one they have stops working'
                    : undefined
                }
              >
                {invited ? 'Resend invite' : 'Invite to portal'}
              </Button>
            ) : null}
            {isAdmin && client.has_portal_access ? (
              <Button
                className="mt-3 w-full"
                variant="secondary"
                icon={<ArrowsClockwise size={16} aria-hidden="true" />}
                loading={asking}
                onClick={askTerms}
                title="Shows them the terms window again on their next open, for example after testing"
              >
                {client.terms_accepted ? 'Ask to accept terms again' : 'Ask to accept terms'}
              </Button>
            ) : null}
          </div>

          <div className="mt-4 border-t border-border pt-4">
            <dl className="flex flex-col gap-2.5 text-sm [&>div]:flex [&>div]:items-center [&>div]:justify-between [&>div]:gap-3 [&_dt]:text-ink-muted [&_dd]:text-right [&_dd]:font-medium [&_dd]:text-ink">
              <div>
                <dt className="text-xs text-ink-muted">Looked after by</dt>
                <dd className="font-medium">
                  {assigned_staff ? assigned_staff.name : 'Nobody in particular'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-muted">Client since</dt>
                <dd className="font-medium">{date(client.joined_date)}</dd>
              </div>
            </dl>
          </div>
        </Card>

        <Card className="min-h-40 lg:min-h-0 lg:flex-1 max-h-80 overflow-y-auto lg:max-h-none">
          <p className="label-eyebrow">Internal notes</p>
          {client.notes ? (
            <p className="mt-3 whitespace-pre-wrap leading-relaxed text-ink">{client.notes}</p>
          ) : (
            <p className="py-4 text-center text-ink-muted">
              No notes yet.{canEdit ? ' Add some with Edit.' : ''}
            </p>
          )}
        </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-5 lg:min-h-0">
          {/* One slim strip. Money is the Admin's: a Designer sees the project count only. */}
          <Card className="!p-0 shrink-0">
            <dl className="grid grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] divide-border max-sm:divide-y sm:divide-x">
              {isAdmin ? (
                <>
                  <div className="px-4 py-3">
                    <dt className="text-xs text-ink-muted">Lifetime value</dt>
                    <dd className="tabular text-lg font-bold text-green-900">
                      {money(stats.lifetime_value ?? 0)}
                    </dd>
                  </div>
                  <div className="px-4 py-3">
                    <dt className="text-xs text-ink-muted">Outstanding</dt>
                    <dd
                      className={`tabular text-lg font-bold ${(stats.outstanding ?? 0) > 0 ? 'text-warning' : 'text-green-900'}`}
                    >
                      {money(stats.outstanding ?? 0)}
                    </dd>
                  </div>
                </>
              ) : null}
              <div className="px-4 py-3">
                <dt className="text-xs text-ink-muted">Active projects</dt>
                <dd className="tabular text-lg font-bold text-green-900">
                  {stats.active_projects}{' '}
                  <span className="text-sm font-normal text-ink-muted">
                    of {stats.total_projects}
                  </span>
                </dd>
              </div>
            </dl>
          </Card>

          <div className="grid grid-cols-1 gap-5 lg:min-h-0 lg:flex-1 lg:auto-rows-[minmax(0,1fr)] lg:grid-cols-2">
            <section
              aria-label="Projects"
              className={`flex min-h-0 min-w-0 flex-col ${isAdmin ? '' : 'lg:col-span-2'}`}
            >
              <h2 className="label-eyebrow mb-2 shrink-0">Projects ({projects.length})</h2>
              <Card className="lg:min-h-0 lg:flex-1 max-h-80 overflow-y-auto lg:max-h-none">
                {projects.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 py-4 text-center">
                    <p className="text-ink-muted">This client has no projects yet.</p>
                    {isAdmin ? (
                      <Button variant="primary" onClick={() => setCreatingProject(true)}>
                        New project
                      </Button>
                    ) : null}
                  </div>
                ) : (
                  <ul className="rows">
                    {projects.map((project) => (
                      <li key={project.id} className="py-3 first:pt-0 last:pb-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <Link
                              to={`/projects/${project.id}`}
                              className="text-link block truncate font-medium"
                            >
                              {project.name}
                            </Link>
                            <p className="mt-0.5 text-xs text-ink-muted">
                              {SERVICE_LABELS[project.type]}
                              {project.assigned_designer_name
                                ? ` · ${project.assigned_designer_name}`
                                : ''}
                              {project.current_stage ? ` · ${project.current_stage}` : ''}
                            </p>
                          </div>
                          <StatusTag tone={projectTone(project.status, stages)}>
                            {project.status}
                          </StatusTag>
                        </div>
                        <div className="mt-2">
                          <Progress
                            value={project.progress_pct}
                            label={`${project.name} progress`}
                          />
                        </div>
                        {!project.client_visible ? (
                          <p className="mt-1 text-xs text-warning">Hidden from the client portal</p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </section>

            {isAdmin ? (
              <section aria-label="Invoices" className="flex min-h-0 min-w-0 flex-col">
                <h2 className="label-eyebrow mb-2 shrink-0">Invoices ({invoices.length})</h2>
                {invoices.length === 0 ? (
                  <Card className="max-h-80 lg:max-h-none lg:min-h-0 lg:flex-1">
                    <p className="py-4 text-center text-ink-muted">
                      Nothing has been invoiced to this client.
                    </p>
                  </Card>
                ) : (
                  <Card className="max-h-80 overflow-y-auto lg:min-h-0 lg:max-h-none lg:flex-1">
                    <ul className="rows">
                      {invoices.map((invoice) => (
                        <li key={invoice.id} className="py-3 first:pt-0 last:pb-0">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <Link
                                to={`/invoices?open=${invoice.id}`}
                                className="block truncate font-medium text-green-900 no-underline hover:underline"
                              >
                                {invoice.number}
                              </Link>
                              <p className="mt-0.5 text-xs text-ink-muted">Due {date(invoice.due_date)}</p>
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-1">
                              <span className="tabular font-semibold text-ink">{money(invoice.amount)}</span>
                              <StatusTag tone={invoiceTone(invoice.status, invoice.is_overdue)}>
                                {invoice.is_overdue && invoice.status !== 'Overdue'
                                  ? `${invoice.status} · overdue`
                                  : invoice.status}
                              </StatusTag>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </Card>
                )}
              </section>
            ) : null}

            <section aria-label="Documents" className="flex min-h-0 min-w-0 flex-col">
              <h2 className="label-eyebrow mb-2 shrink-0">Documents ({documents.length})</h2>
              <DocumentsTable
                list
                documents={documents}
                onChanged={refetch}
                emptyMessage="Nothing has been uploaded for this client. Upload files from one of their projects."
                wrapClassName="lg:min-h-0 lg:flex-1 max-h-80 overflow-y-auto lg:max-h-none"
              />
            </section>

            <section aria-label="Activity log" className="flex min-h-0 min-w-0 flex-col">
              <h2 className="label-eyebrow mb-2 shrink-0">Activity log ({activity.length})</h2>
              <Card className="lg:min-h-0 lg:flex-1 max-h-80 overflow-y-auto lg:max-h-none">
                {activity.length === 0 ? (
                  <p className="py-4 text-center text-ink-muted">
                    Changes to this client will be recorded here.
                  </p>
                ) : (
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
                )}
              </Card>
            </section>
          </div>
        </div>

        {chat && wide ? (
          <ClientChat
            clientId={client.id}
            clientName={client.name}
            projects={projects.filter((p) => p.client_visible).map((p) => ({ id: p.id, name: p.name }))}
            className="lg:min-h-0"
          />
        ) : null}
      </div>

      <NewProjectDialog
        open={creatingProject}
        onClose={() => setCreatingProject(false)}
        client={client}
        designers={designers}
      />

      <ClientFormDialog
        open={editing}
        client={client}
        onClose={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          void refetch();
        }}
      />

      <ConfirmDialog
        open={deleting}
        title={`Delete ${client.name}?`}
        message={
          <>
            <p>
              This permanently deletes the client and everything that belongs to them: their
              projects, invoices (paid ones too), documents and messages. Their portal sign-in stops
              working.
            </p>
            <p className="mt-2 text-ink-muted">
              It cannot be undone. To keep their history, set them to Inactive instead.
            </p>
          </>
        }
        confirmLabel="Delete client"
        password
        pending={deletePending}
        onConfirm={(password) => void confirmDelete(password)}
        onCancel={() => setDeleting(false)}
      />
    </div>
  );
}
