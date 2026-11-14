import clsx from 'clsx';
import { CaretLeft, Plus, Trash, UploadSimple } from '@phosphor-icons/react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  StatusTag,
  TableWrap,
  Tabs,
  Td,
  Th,
  Toggle,
  type StatusTone,
} from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useQuery } from '@/hooks/useApi';
import { useStages } from '@/hooks/useStages';
import { ApiError, api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { date, dateTime, humanise, money, refNo } from '@/lib/format';
import { invoiceTone } from '@/lib/status';
import type { ProjectDetail, ProjectStage, Quote, QuoteStatus } from '@/types/api';
import { SERVICE_LABELS } from '@/types/api';

import { ChangeRequests } from '@/components/ChangeRequests';
import { DocumentsTable, UploadDialog } from '@/components/DocumentsTable';
import { ProjectTeam } from '@/components/ProjectTeam';
import { ProjectThread } from '@/components/TeamThread';

import { useDesigners } from './Projects';

const QUOTE_TONE: Record<QuoteStatus, StatusTone> = { Draft: 'neutral', Sent: 'info', Accepted: 'success', Declined: 'danger' };

/** The icon-only form of a header button on a phone. */
const ICON_ONLY = 'max-sm:w-11 max-sm:gap-0 max-sm:px-0';

/**
 * One project. An Admin or Designer moves its stage (the steps in the header)
 * and keeps its status line up to date (progress follows the stage); an
 * Installer asks an Admin to move it. Only an Admin sets the team (designers,
 * installers and the installers' dates and pay), sends it to the client, sees
 * its money, or deletes it (the API enforces it). Team and the team thread sit
 * in a rail beside the tabs.
 */
export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const navigate = useNavigate();
  const { isAdmin, can } = useAuth();
  const canMove = can('Admin', 'Designer');
  const { stages: stageConfig } = useStages();
  const { data, loading, error, refetch, setData } = useQuery<ProjectDetail>(
    id ? `/projects/${id}/detail` : null,
  );
  const quotes = useQuery<Quote[]>(isAdmin && id ? `/quotes?project_id=${id}` : null);
  const designers = useDesigners(isAdmin);
  const [tab, setTab] = useState('overview');
  const [uploading, setUploading] = useState(false);
  const [asked, setAsked] = useState(0);
  const [askStage, setAskStage] = useState<ProjectStage | ''>('');
  const [asking, setAsking] = useState(false);
  const [moving, setMoving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [removing, setRemoving] = useState(false);

  if (loading) return <LoadingState label="Loading project…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!data) return <ErrorState message="Project not found." />;

  const { project, client, documents, invoices, activity, timeline, awaiting_client_decision, team } =
    data;
  const approvalStages = stageConfig.filter((stage) => stage.approval).map((stage) => stage.name);
  const quoteRows = quotes.data ?? [];

  const patch = async (body: Record<string, unknown>, successMessage: string) => {
    try {
      await api.put(`/projects/${project.id}`, body);
      toast.success(successMessage);
      await refetch();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not update this project.');
    }
  };

  const changeStage = async (stage: ProjectStage) => {
    if (stage === project.status) return;
    setMoving(true);
    try {
      await api.patch(`/projects/${project.id}/stage`, { status: stage });
      toast.success(`Moved to ${stage}.`);
      await refetch();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not change the stage.');
    } finally {
      setMoving(false);
    }
  };

  /** Installer: the Admin moves it, once they approve. */
  const askToMove = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!askStage) return;
    setAsking(true);
    try {
      const note = String(new FormData(event.currentTarget).get('note') ?? '').trim();
      await api.post('/change-requests', {
        kind: 'project_stage',
        project_id: project.id,
        status: askStage,
        note: note || undefined,
      });
      toast.success('Sent to the Admin for approval.');
      setAskStage('');
      setAsked((n) => n + 1);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not send the request.');
    } finally {
      setAsking(false);
    }
  };

  const remove = async (password: string) => {
    setRemoving(true);
    try {
      await api.delete(`/projects/${project.id}`, { password });
      toast.success(`${project.name} deleted.`);
      navigate('/projects', { replace: true });
    } catch (caught) {
      // Stays open: a mistyped password is retyped, not re-clicked from the start.
      toast.error(caught instanceof ApiError ? caught.message : 'Could not delete this project.');
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto px-5 pb-5 pt-3 [mask-image:linear-gradient(to_bottom,transparent,#000_14px)] sm:px-8 lg:overflow-visible lg:[mask-image:none]">
      {/* From lg up the page is one screen: the project scrolls on the left, the team thread stays put on the right. Below that it stacks. */}
      <div className="mt-3 grid w-full grid-cols-1 gap-5 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_24rem] lg:grid-rows-1 2xl:grid-cols-[minmax(0,1fr)_28rem]">
        <div className="min-w-0 lg:-mx-1 lg:min-h-0 lg:overflow-y-auto lg:px-1 lg:pb-1">
          <ChangeRequests key={asked} projectId={project.id} onDecided={() => void refetch()} />

          {awaiting_client_decision ? (
            <Card accent="warning" className="mb-4 pl-5">
              <p className="font-semibold text-ink">Awaiting the client’s decision</p>
              <p className="mt-1 text-ink-muted">
                {client?.name ?? 'The client'} can approve this stage or request changes from their
                portal. Requesting changes sends the project back one stage automatically.
              </p>
            </Card>
          ) : null}

          {/* Back, name, who it is for, whether the client sees it, and where it stands: one card, top to bottom. */}
          <Card className="mb-5">
            <div className="flex items-center justify-between gap-3">
              <Link
                to="/projects"
                className="-ml-2 flex min-h-9 items-center gap-0.5 rounded-[7px] pl-1 pr-2 text-sm font-semibold text-ink-muted hover:bg-surface-muted hover:text-ink pointer-coarse:min-h-11"
              >
                <CaretLeft size={16} aria-hidden="true" />
                Projects
              </Link>
              {isAdmin ? (
                <div className="flex items-center gap-2">
                  <Button variant="secondary" className={ICON_ONLY} icon={<Plus size={16} aria-hidden="true" />} onClick={() => navigate(`/quotes?new=1&client=${project.client_id}&project=${project.id}`)}>
                    <span className="max-sm:sr-only">New quote</span>
                  </Button>
                  <Button variant="destructive" className={ICON_ONLY} icon={<Trash size={16} aria-hidden="true" />} onClick={() => setDeleting(true)}>
                    <span className="max-sm:sr-only">Delete</span>
                  </Button>
                </div>
              ) : null}
            </div>
            <div className="mt-3 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
              <div className="min-w-0">
                <h1 className="text-2xl font-bold tracking-tight text-ink [overflow-wrap:anywhere]">{project.name}</h1>
                <p className="mt-1 text-sm text-ink-muted [overflow-wrap:anywhere]">
                  {client ? (
                    <Link to={`/clients/${client.id}`} className="font-semibold text-green-900 hover:underline">
                      {client.name}
                    </Link>
                  ) : null}
                  {client ? ' · ' : ''}
                  {refNo('PRJ', project.ref_no)} · {SERVICE_LABELS[project.type]}
                  {project.site_address ? ` · ${project.site_address}` : ''}
                </p>
              </div>
              {isAdmin ? (
                <div className="w-full rounded-control bg-ink/[0.04] px-3 py-2 sm:w-64">
                  <Toggle
                    label="Send to client"
                    description={project.client_visible ? 'Visible in the client portal' : 'Hidden from the client portal'}
                    checked={project.client_visible}
                    onChange={(next) =>
                      void patch(
                        { client_visible: next },
                        next ? 'Now visible to the client.' : 'Hidden from the client.',
                      )
                    }
                  />
                </div>
              ) : (
                <StatusTag tone={project.client_visible ? 'success' : 'neutral'}>
                  {project.client_visible ? 'Visible to client' : 'Hidden from client'}
                </StatusTag>
              )}
            </div>

            <div className="mt-5 border-t border-border pt-4">
              <div className="flex items-baseline justify-between gap-3">
                <p className="label-eyebrow">Stage</p>
                <p className="tabular text-xs font-semibold text-ink-muted">{project.progress_pct}% complete</p>
              </div>
            <ol className="mt-2 flex items-start" aria-label="Stages">
              {timeline.map((step, index) => {
                const selected = !canMove && askStage === step.stage;
                return (
                  <li key={step.stage} className="flex min-w-0 flex-1 items-start last:flex-none">
                    <button
                      type="button"
                      disabled={step.current || moving}
                      aria-current={step.current ? 'step' : undefined}
                      aria-label={
                        step.current
                          ? `${step.stage}, current stage`
                          : canMove
                            ? `Move to ${step.stage}`
                            : `Ask to move to ${step.stage}`
                      }
                      title={approvalStages.includes(step.stage) ? `${step.stage} (the client approves)` : step.stage}
                      onClick={() => (canMove ? void changeStage(step.stage) : setAskStage(selected ? '' : step.stage))}
                      className="group flex min-h-11 min-w-11 flex-col items-center gap-1.5 rounded-control px-1 disabled:cursor-default"
                    >
                      <span
                        className={clsx(
                          'flex h-7 w-7 items-center justify-center rounded-control border text-xs font-bold transition-colors',
                          step.current
                            ? 'border-green-900 bg-green-900 text-on-primary'
                            : selected
                              ? 'border-green-900 bg-green-100 text-green-900 ring-2 ring-green-900/30'
                              : step.reached
                                ? 'border-green-900 bg-green-100 text-green-900 group-hover:bg-green-200'
                                : 'border-transparent bg-ink/[0.07] text-ink-muted group-hover:bg-ink/[0.12]',
                        )}
                      >
                        {index + 1}
                      </span>
                      <span
                        className={clsx(
                          'whitespace-nowrap text-[11px] font-semibold',
                          // Phones show only the current stage's name, so the line between steps keeps its room.
                          step.current ? 'text-green-900' : 'text-ink-muted max-sm:sr-only',
                        )}
                      >
                        {step.stage}
                      </span>
                    </button>
                    {index < timeline.length - 1 ? (
                      <span
                        aria-hidden="true"
                        className={clsx(
                          'mx-1 mt-3.5 h-px min-w-3 flex-1',
                          timeline[index + 1]?.reached ? 'bg-green-900' : 'bg-border',
                        )}
                      />
                    ) : null}
                  </li>
                );
              })}
            </ol>

            {!canMove ? (
              askStage ? (
                <form onSubmit={askToMove} className="mt-4 grid items-end gap-3 sm:grid-cols-[1fr_auto_auto]">
                  <Input label={`Note for the Admin about moving to ${askStage} (optional)`} name="note" maxLength={1000} />
                  <Button type="submit" variant="primary" loading={asking}>
                    Send to Admin
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => setAskStage('')}>
                    Cancel
                  </Button>
                </form>
              ) : (
                <p className="mt-3 text-xs text-ink-muted">Pick a stage to ask the Admin to move this project there.</p>
              )
            ) : null}
            </div>
          </Card>

          {/* The Documents tab's Upload sits at the end of the tabs row. */}
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <Tabs
                tabs={[
                  { id: 'overview', label: 'Overview' },
                  { id: 'documents', label: 'Documents', count: documents.length },
                  ...(isAdmin ? [{ id: 'invoices', label: 'Invoices & quotes', count: invoices.length + quoteRows.length }] : []),
                  { id: 'activity', label: 'Activity', count: activity.length },
                ]}
                active={tab}
                onChange={setTab}
              />
            </div>
            {tab === 'documents' ? (
              <Button
                className="shrink-0"
                icon={<UploadSimple size={15} aria-hidden="true" />}
                onClick={() => setUploading(true)}
              >
                Upload
              </Button>
            ) : null}
          </div>

          {tab === 'overview' ? (
            <div className="grid items-start gap-4 xl:grid-cols-2">
              <Card>
                <p className="label-eyebrow">Details</p>
                {isAdmin ? (
                  <div className="mt-3">
                    <Input
                      key={project.site_address ?? ''}
                      label="Site address"
                      hint="Where the work happens. This project’s invoices start from it."
                      defaultValue={project.site_address ?? ''}
                      maxLength={300}
                      onBlur={(event) => {
                        const value = event.target.value.trim();
                        if (value !== (project.site_address ?? '')) void patch({ site_address: value }, 'Site address saved.');
                      }}
                    />
                  </div>
                ) : null}
                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 [&_dd]:mt-0.5 [&_dd]:text-sm [&_dd]:font-medium [&_dd]:leading-snug [&_dd]:text-ink [&_dd]:[overflow-wrap:anywhere] [&_dt]:text-[11px] [&_dt]:font-semibold [&_dt]:uppercase [&_dt]:tracking-wide [&_dt]:text-ink-muted">
                  {!isAdmin ? (
                    <div className="col-span-2">
                      <dt>Site address</dt>
                      <dd>{project.site_address ?? '—'}</dd>
                    </div>
                  ) : null}
                  <div>
                    <dt>Service</dt>
                    <dd>{SERVICE_LABELS[project.type]}</dd>
                  </div>
                  <div>
                    <dt>Created</dt>
                    <dd>{date(project.created_at)}</dd>
                  </div>
                  {project.current_stage ? (
                    <div className="col-span-2">
                      <dt>Status note</dt>
                      <dd>{project.current_stage}</dd>
                    </div>
                  ) : null}
                  <div className="col-span-2">
                    <dt>Last updated</dt>
                    <dd>{dateTime(project.updated_at)}</dd>
                  </div>
                </dl>
              </Card>

              <div className="flex min-w-0 flex-col gap-4">
                <ProjectTeam
                  projectId={project.id}
                  team={team}
                  staff={designers}
                  onChange={(next) => setData((current) => (current ? { ...current, team: next } : current))}
                />

                <Card>
                  <p className="label-eyebrow">Recent activity</p>
                  {activity.length === 0 ? (
                    <p className="py-6 text-center text-ink-muted">Nothing recorded yet.</p>
                  ) : (
                    <ol className="mt-4 flex flex-col gap-4 border-l border-border pl-4">
                      {activity.slice(0, 6).map((entry) => (
                        <li key={entry.id} className="relative">
                          <span aria-hidden="true" className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-green-900 ring-4 ring-surface" />
                          <p className="text-sm font-medium text-ink">{humanise(entry.action)}</p>
                          <p className="text-xs text-ink-muted">
                            {entry.actor_name} · {dateTime(entry.created_at)}
                          </p>
                        </li>
                      ))}
                    </ol>
                  )}
                </Card>
              </div>
            </div>
          ) : null}

          {tab === 'documents' ? (
            <DocumentsTable
              documents={documents}
              onChanged={refetch}
              emptyMessage="Plans, contracts and mood boards for this project appear here."
            />
          ) : null}
          <UploadDialog
            open={uploading}
            target={{ clientId: project.client_id, projectId: project.id }}
            onClose={() => setUploading(false)}
            onUploaded={async () => {
              setUploading(false);
              await refetch();
            }}
          />


          {tab === 'invoices' && isAdmin ? (
            <div className="flex flex-col gap-5">
              <section aria-label="Quotes">
                <h2 className="label-eyebrow mb-2">Quotes ({quoteRows.length})</h2>
                {quoteRows.length === 0 ? (
                  <Card className="p-0">
                    <EmptyState
                      title="No quotes"
                      message="Choose New quote above to write one for this project."
                    />
                  </Card>
                ) : (
                  <TableWrap className="max-sm:min-w-0">
                    <thead>
                      <tr>
                        <Th>Number</Th>
                        <Th>Status</Th>
                        <Th className="max-sm:hidden">Valid until</Th>
                        <Th className="text-right">Amount</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {quoteRows.map((quote) => (
                        <tr
                          key={quote.id}
                          className="cursor-pointer hover:bg-surface-muted/40"
                          onClick={(event) => {
                            if (!(event.target as HTMLElement).closest('a, button')) navigate(`/quotes/${quote.id}`);
                          }}
                        >
                          <Td className="font-medium text-ink">
                            <Link to={`/quotes/${quote.id}`} className="text-link">
                              {quote.number}
                            </Link>
                            {quote.title ? <p className="text-xs font-normal text-ink-muted">{quote.title}</p> : null}
                          </Td>
                          <Td>
                            <StatusTag tone={QUOTE_TONE[quote.status]}>{quote.status}</StatusTag>
                          </Td>
                          <Td className="whitespace-nowrap text-ink-muted max-sm:hidden">{quote.valid_until ? date(quote.valid_until) : '—'}</Td>
                          <Td className="tabular whitespace-nowrap text-right font-semibold text-ink">{money(quote.amount)}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </TableWrap>
                )}
              </section>

              <section aria-label="Invoices">
                <h2 className="label-eyebrow mb-2">Invoices ({invoices.length})</h2>
                {invoices.length === 0 ? (
                  <Card className="p-0">
                    <EmptyState title="No invoices" message="Nothing has been invoiced for this project." />
                  </Card>
                ) : (
                  <TableWrap className="max-sm:min-w-0">
                    <thead>
                      <tr>
                        <Th>Number</Th>
                        <Th>Status</Th>
                        <Th className="max-sm:hidden">Due</Th>
                        <Th className="text-right">Amount</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((invoice) => (
                        <tr
                          key={invoice.id}
                          className="cursor-pointer hover:bg-surface-muted/40"
                          // The number stays the link for keyboards; a click anywhere else on the row opens it too.
                          onClick={(event) => {
                            if (!(event.target as HTMLElement).closest('a, button'))
                              navigate(`/invoices?open=${invoice.id}`);
                          }}
                        >
                          <Td className="font-medium text-ink">
                            <Link to={`/invoices?open=${invoice.id}`} className="text-link">
                              {invoice.number}
                            </Link>
                          </Td>
                          <Td>
                            <StatusTag tone={invoiceTone(invoice.status, invoice.is_overdue)}>
                              {invoice.status}
                            </StatusTag>
                          </Td>
                          <Td className="whitespace-nowrap text-ink-muted max-sm:hidden">{date(invoice.due_date)}</Td>
                          <Td className="tabular whitespace-nowrap text-right font-semibold text-ink">
                            {money(invoice.amount)}
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </TableWrap>
                )}
              </section>
            </div>
          ) : null}

          {tab === 'activity' ? (
            activity.length === 0 ? (
              <Card className="p-0">
                <EmptyState title="No activity" message="Changes to this project appear here." />
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

        <ProjectThread projectId={project.id} documents={documents} />
      </div>

      <ConfirmDialog
        open={deleting}
        title={`Delete ${project.name}?`}
        message="The project is deleted for good. Its documents and invoices stay on the client’s record, no longer linked to it."
        confirmLabel="Delete project"
        password
        pending={removing}
        onConfirm={(password) => void remove(password)}
        onCancel={() => setDeleting(false)}
      />
    </div>
  );
}
