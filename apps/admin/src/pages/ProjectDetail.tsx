import clsx from 'clsx';
import {
  ArrowLeft,
  UploadSimple,
} from '@phosphor-icons/react';
import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';

import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Modal,
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
import { ApiError, api } from '@/lib/api';
import { date, dateTime, fileSize, humanise, money } from '@/lib/format';
import { invoiceTone, projectTone } from '@/lib/status';
import type { DocumentType, ProjectDetail, ProjectStage, StaffUser } from '@/types/api';
import { DOCUMENT_TYPES, PROJECT_STAGES, SERVICE_LABELS } from '@/types/api';

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const { data, loading, error, refetch } = useQuery<ProjectDetail>(
    id ? `/projects/${id}/detail` : null,
  );
  const staff = useQuery<StaffUser[]>('/staff');
  const [tab, setTab] = useState('timeline');
  const [uploading, setUploading] = useState(false);
  const [uploadPending, setUploadPending] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadForm, setUploadForm] = useState({
    name: '',
    type: 'Plan' as DocumentType,
    size_bytes: 250_000,
    client_visible: true,
  });

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

  const submitUpload = async (event: FormEvent) => {
    event.preventDefault();
    setUploadError(null);
    if (uploadForm.name.trim().length < 1) return setUploadError('Enter a file name.');
    if (!client) return setUploadError('This project has no client attached.');

    setUploadPending(true);
    try {
      await api.post('/documents/upload', {
        client_id: client.id,
        project_id: project.id,
        name: uploadForm.name.trim(),
        type: uploadForm.type,
        size_bytes: uploadForm.size_bytes,
        client_visible: uploadForm.client_visible,
      });
      toast.success(`${uploadForm.name.trim()} added.`);
      setUploading(false);
      setUploadForm({ name: '', type: 'Plan', size_bytes: 250_000, client_visible: true });
      await refetch();
    } catch (caught) {
      setUploadError(caught instanceof ApiError ? caught.message : 'Could not add this document.');
    } finally {
      setUploadPending(false);
    }
  };

  return (
    <>
      <Link to="/projects" className="text-link mb-4 inline-flex items-center gap-1.5">
        <ArrowLeft size={14} aria-hidden="true" />
        All projects
      </Link>

      <PageHeader
        title={project.name}
        description={`${client?.name ?? 'Unknown client'} · ${SERVICE_LABELS[project.type]}`}
        actions={<StatusTag tone={projectTone(project.status)}>{project.status}</StatusTag>}
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
          {/* Horizontal 5-stage timeline. */}
          <ol className="mt-4 flex items-center">
            {timeline.map((step, index) => (
              <li key={step.stage} className="flex flex-1 items-center last:flex-none">
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
                      step.current ? 'text-green-900' : 'text-ink-muted',
                    )}
                  >
                    {step.stage}
                  </span>
                </div>
                {index < timeline.length - 1 ? (
                  <span
                    aria-hidden="true"
                    className={clsx(
                      'mx-1 mb-5 h-px flex-1',
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
          {project.current_stage ? (
            <p className="mt-2 text-ink-muted">{project.current_stage}</p>
          ) : null}
        </Card>

        <Card>
          <p className="label-eyebrow">Controls</p>
          <div className="mt-3 flex flex-col gap-4">
            <Select
              label="Move to stage"
              value={project.status}
              onChange={(event) => void changeStage(event.target.value as ProjectStage)}
            >
              {PROJECT_STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {stage}
                </option>
              ))}
            </Select>

            <Select
              label="Assigned designer"
              value={project.assigned_designer_id ?? ''}
              onChange={(event) =>
                void patch(
                  { assigned_designer_id: event.target.value || null },
                  'Designer updated.',
                )
              }
            >
              <option value="">Unassigned</option>
              {(staff.data ?? []).map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name} · {member.role}
                </option>
              ))}
            </Select>

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
          </div>
        </Card>
      </div>

      <Tabs
        tabs={[
          { id: 'timeline', label: 'Overview' },
          { id: 'documents', label: 'Documents & mood boards', count: documents.length },
          { id: 'invoices', label: 'Invoices', count: invoices.length },
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
                ['Client', client?.name ?? '—'],
                ['Service', SERVICE_LABELS[project.type]],
                ['Stage', project.status],
                ['Progress', `${project.progress_pct}%`],
                ['Designer', project.assigned_designer_name ?? 'Unassigned'],
                ['Visible to client', project.client_visible ? 'Yes' : 'No'],
                ['Created', date(project.created_at)],
                ['Last updated', dateTime(project.updated_at)],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3">
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
        <>
          <div className="mb-3 flex justify-end">
            <Button
              variant="primary"
              icon={<UploadSimple size={16} aria-hidden="true" />}
              onClick={() => setUploading(true)}
            >
              Add document
            </Button>
          </div>
          {documents.length === 0 ? (
            <Card className="p-0">
              <EmptyState
                title="No documents"
                message="Add plans, contracts or mood boards for this project."
                action={
                  <Button variant="primary" onClick={() => setUploading(true)}>
                    Add document
                  </Button>
                }
              />
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
          )}
        </>
      ) : null}

      {tab === 'invoices' ? (
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
                <tr key={invoice.id}>
                  <Td className="font-medium text-ink">{invoice.number}</Td>
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

      <Modal
        open={uploading}
        onClose={() => setUploading(false)}
        title="Add document"
        description="Prototype phase: file metadata is recorded, no file is transferred."
        footer={
          <>
            <Button variant="secondary" onClick={() => setUploading(false)} disabled={uploadPending}>
              Cancel
            </Button>
            <Button type="submit" form="upload-form" variant="primary" loading={uploadPending}>
              Add document
            </Button>
          </>
        }
      >
        <form id="upload-form" onSubmit={submitUpload} className="flex flex-col gap-4" noValidate>
          <Input
            label="File name"
            value={uploadForm.name}
            onChange={(event) => setUploadForm({ ...uploadForm, name: event.target.value })}
            placeholder="Kitchen Plan — Rev D.pdf"
            required
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Type"
              value={uploadForm.type}
              onChange={(event) =>
                setUploadForm({ ...uploadForm, type: event.target.value as DocumentType })
              }
            >
              {DOCUMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </Select>
            <Input
              label="Size (bytes)"
              type="number"
              min={0}
              value={uploadForm.size_bytes}
              onChange={(event) =>
                setUploadForm({ ...uploadForm, size_bytes: Number(event.target.value) })
              }
            />
          </div>
          <Toggle
            label="Visible to the client"
            description="Internal documents stay out of the client portal."
            checked={uploadForm.client_visible}
            onChange={(next) => setUploadForm({ ...uploadForm, client_visible: next })}
          />
          {uploadError ? (
            <p role="alert" className="rounded-control border border-danger/30 bg-danger-bg px-3 py-2 text-danger">
              {uploadError}
            </p>
          ) : null}
        </form>
      </Modal>
    </>
  );
}
