import clsx from 'clsx';
import { Trash } from '@phosphor-icons/react';
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
  PageHeader,
  Progress,
  Select,
  StatusTag,
  TableWrap,
  Tabs,
  Td,
  Th,
  Toggle,
} from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useQuery } from '@/hooks/useApi';
import { useStages } from '@/hooks/useStages';
import { ApiError, api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { date, dateTime, humanise, money } from '@/lib/format';
import { invoiceTone, projectTone } from '@/lib/status';
import type { ProjectDetail, ProjectStage } from '@/types/api';
import { SERVICE_LABELS } from '@/types/api';

import { DocumentsTable } from '@/components/DocumentsTable';

import { useDesigners } from './Projects';

/**
 * One project. Everyone who can open it moves its stage and keeps its
 * progress and status line up to date; only an Admin assigns the designer
 * and installer, sends it to the client, or deletes it (the API enforces it).
 */
export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { stages } = useStages();
  const { data, loading, error, refetch } = useQuery<ProjectDetail>(
    id ? `/projects/${id}/detail` : null,
  );
  const designers = useDesigners(isAdmin);
  const [tab, setTab] = useState('timeline');
  const [savingProgress, setSavingProgress] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [removing, setRemoving] = useState(false);

  if (loading) return <LoadingState label="Loading project…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!data) return <ErrorState message="Project not found." />;

  const { project, client, documents, invoices, activity, timeline, awaiting_client_decision } = data;

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
    try {
      await api.patch(`/projects/${project.id}/stage`, { status: stage });
      toast.success(`Moved to ${stage}.`);
      await refetch();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not change the stage.');
    }
  };

  const saveProgress = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const progress = Number(form.get('progress_pct'));
    if (!Number.isInteger(progress) || progress < 0 || progress > 100) {
      toast.error('Progress is a whole number from 0 to 100.');
      return;
    }
    setSavingProgress(true);
    const note = String(form.get('current_stage') ?? '').trim();
    await patch({ progress_pct: progress, current_stage: note || null }, 'Progress saved.');
    setSavingProgress(false);
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

  const assign = (field: 'assigned_designer_id' | 'assigned_installer_id', label: string) => (
    <Select
      label={label}
      value={project[field] ?? ''}
      onChange={(event) => void patch({ [field]: event.target.value || null }, `${label} updated.`)}
    >
      <option value="">Unassigned</option>
      {/* Someone assigned before they stopped being a Designer still shows. */}
      {project[field] && !designers.some((member) => member.id === project[field]) ? (
        <option value={project[field] ?? ''}>
          {(field === 'assigned_designer_id' ? project.assigned_designer_name : project.assigned_installer_name) ??
            'Someone else'}
        </option>
      ) : null}
      {designers.map((member) => (
        <option key={member.id} value={member.id}>
          {member.name}
        </option>
      ))}
    </Select>
  );

  return (
    <div className="px-5 pb-16 pt-6 sm:px-8 lg:pt-8">
      <PageHeader
        title={project.name}
        description={`${project.client_name ?? client?.name ?? 'Unknown client'} · ${SERVICE_LABELS[project.type]}`}
        actions={
          <>
            <StatusTag tone={projectTone(project.status, stages)}>{project.status}</StatusTag>
            {isAdmin ? (
              <Button variant="ghost" className="text-danger" icon={<Trash size={15} aria-hidden="true" />} onClick={() => setDeleting(true)}>
                Delete
              </Button>
            ) : null}
          </>
        }
      />

      {awaiting_client_decision ? (
        <Card accent="warning" className="mb-4 pl-5">
          <p className="font-semibold text-ink">Awaiting the client’s decision</p>
          <p className="mt-1 text-ink-muted">
            {client?.name ?? 'The client'} can approve this design or request changes from their
            portal. Requesting changes sends the project back to Design automatically.
          </p>
        </Card>
      ) : null}

      <div className="mb-5 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <p className="label-eyebrow">Stage</p>
          {/* Horizontal timeline of the configured stages. */}
          <ol className="mt-4 flex items-start">
            {timeline.map((step, index) => (
              <li key={step.stage} className="flex min-w-0 flex-1 items-start last:flex-none">
                <div className="flex flex-col items-center gap-1.5">
                  <span
                    aria-hidden="true"
                    className={clsx(
                      'flex h-7 w-7 items-center justify-center rounded-control border text-xs font-bold',
                      step.current
                        ? 'border-green-900 bg-green-900 text-on-primary'
                        : step.reached
                          ? 'border-green-900 bg-green-100 text-green-900'
                          : 'border-transparent bg-ink/[0.07] text-ink-muted',
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
                </div>
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
            ))}
          </ol>

          <div className="mt-5">
            <Progress value={project.progress_pct} label="Project progress" />
          </div>

          {/* Keyed on the saved values, so a stage move's new defaults show up. */}
          <form
            key={`${project.progress_pct}-${project.current_stage ?? ''}`}
            onSubmit={saveProgress}
            className="mt-4 grid items-end gap-3 sm:grid-cols-[7rem_1fr_auto]"
          >
            <Input
              label="Progress (%)"
              name="progress_pct"
              type="number"
              min={0}
              max={100}
              step={1}
              defaultValue={project.progress_pct}
            />
            <Input
              label="Where it’s at"
              name="current_stage"
              maxLength={80}
              defaultValue={project.current_stage ?? ''}
              placeholder="Drawings with the client"
            />
            <Button type="submit" variant="secondary" loading={savingProgress}>
              Save
            </Button>
          </form>
        </Card>

        <Card>
          <p className="label-eyebrow">Controls</p>
          <div className="mt-3 flex flex-col gap-4">
            <Select
              label="Move to stage"
              value={project.status}
              onChange={(event) => void changeStage(event.target.value as ProjectStage)}
            >
              {timeline.map(({ stage }) => (
                <option key={stage} value={stage}>
                  {stage}
                </option>
              ))}
            </Select>

            {isAdmin ? (
              <>
                {assign('assigned_designer_id', 'Designer')}
                {assign('assigned_installer_id', 'Installer')}
                <Toggle
                  label="Send to client"
                  description="When off, this project is hidden from the client portal entirely."
                  checked={project.client_visible}
                  onChange={(next) =>
                    void patch(
                      { client_visible: next },
                      next ? 'Now visible to the client.' : 'Hidden from the client.',
                    )
                  }
                />
              </>
            ) : null}
          </div>
        </Card>
      </div>

      <Tabs
        tabs={[
          { id: 'timeline', label: 'Overview' },
          { id: 'documents', label: 'Documents & mood boards', count: documents.length },
          ...(isAdmin ? [{ id: 'invoices', label: 'Invoices', count: invoices.length }] : []),
          { id: 'activity', label: 'Activity log', count: activity.length },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'timeline' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <p className="label-eyebrow">Project details</p>
            <dl className="mt-3 rows">
              {[
                ['Client', client ? <Link key="client" to={`/clients/${client.id}`} className="text-link">{client.name}</Link> : '—'],
                ['Service', SERVICE_LABELS[project.type]],
                ['Stage', project.status],
                ['Progress', `${project.progress_pct}%`],
                ['Designer', project.assigned_designer_name ?? 'Unassigned'],
                ['Installer', project.assigned_installer_name ?? 'Unassigned'],
                ['Visible to client', project.client_visible ? 'Yes' : 'No'],
                ['Created', date(project.created_at)],
                ['Last updated', dateTime(project.updated_at)],
              ].map(([label, value]) => (
                <div key={String(label)} className="flex justify-between gap-3">
                  <dt className="text-ink-muted">{label}</dt>
                  <dd className="text-right font-medium text-ink">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card>
            <p className="label-eyebrow">Recent activity</p>
            {activity.length === 0 ? (
              <p className="py-6 text-center text-ink-muted">Nothing recorded yet.</p>
            ) : (
              <ul className="mt-3 rows">
                {activity.slice(0, 6).map((entry) => (
                  <li key={entry.id} className="py-2.5 first:pt-0">
                    <p className="font-medium text-ink">{humanise(entry.action)}</p>
                    <p className="text-xs text-ink-muted">
                      {entry.actor_name} · {dateTime(entry.created_at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      ) : null}

      {tab === 'documents' ? (
        <DocumentsTable
          documents={documents}
          onChanged={refetch}
          uploadTo={{ clientId: project.client_id, projectId: project.id }}
          emptyMessage="Plans, contracts and mood boards for this project appear here."
        />
      ) : null}

      {tab === 'invoices' && isAdmin ? (
        invoices.length === 0 ? (
          <Card className="p-0">
            <EmptyState title="No invoices" message="Nothing has been invoiced for this project." />
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
                <tr
                  key={invoice.id}
                  className="cursor-pointer"
                  // The number stays the link for keyboards; a click anywhere else on the row opens it too.
                  onClick={(event) => {
                    if (!(event.target as HTMLElement).closest('a, button')) navigate(`/invoices?open=${invoice.id}`);
                  }}
                >
                  <Td className="font-medium text-ink">
                    <Link to={`/invoices?open=${invoice.id}`} className="underline-offset-2 hover:text-green-900 hover:underline">
                      {invoice.number}
                    </Link>
                  </Td>
                  <Td>
                    <StatusTag tone={invoiceTone(invoice.status, invoice.is_overdue)}>
                      {invoice.status}
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
