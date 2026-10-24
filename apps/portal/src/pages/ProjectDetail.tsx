import clsx from 'clsx';
import { ArrowLeft, CaretRight } from '@phosphor-icons/react';
import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';

import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  Modal,
  PageHeader,
  Progress,
  StatusTag,
  Tabs,
  Textarea,
} from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { DocumentActions } from '@/components/DownloadButton';
import { useQuery } from '@/hooks/useApi';
import { useStages } from '@/hooks/useStages';
import { ApiError, api } from '@/lib/api';
import { date, dateTime, fileSize, money } from '@/lib/format';
import { invoiceLabel, invoiceTone, projectTone } from '@/lib/status';
import type { ProjectDetail } from '@/types/api';
import { DOCUMENT_LABELS, SERVICE_LABELS, STAGE_DESCRIPTIONS } from '@/types/api';

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const { stages } = useStages();
  const { data, loading, error, refetch } = useQuery<ProjectDetail>(
    id ? `/projects/${encodeURIComponent(id)}/detail` : null,
  );

  const [tab, setTab] = useState('timeline');
  const [approving, setApproving] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (loading) return <LoadingState label="Loading your project…" />;
  if (error || !data) {
    return (
      <>
        <ErrorState message={error ?? 'Project not found.'} onRetry={error ? refetch : undefined} />
        <p className="text-center">
          <Link to="/projects" className="text-link">
            Back to projects
          </Link>
        </p>
      </>
    );
  }

  const { project, documents, invoices, timeline, awaiting_client_decision } = data;

  // Mood boards and plans are the "Designs" the approval decision is about.
  const designs = documents.filter(
    (document) => document.type === 'MoodBoard' || document.type === 'Plan',
  );

  const approve = async () => {
    setPending(true);
    try {
      await api.post(`/projects/${project.id}/approve`, { note: note.trim() || undefined });
      toast.success('Design approved — we will schedule your installation.');
      setApproving(false);
      setNote('');
      await refetch();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not approve this design.');
    } finally {
      setPending(false);
    }
  };

  const requestChanges = async (event: FormEvent) => {
    event.preventDefault();
    setNoteError(null);
    if (note.trim().length < 5) {
      setNoteError('Please tell us what you would like changed.');
      return;
    }
    setPending(true);
    try {
      await api.post(`/projects/${project.id}/request-changes`, { note: note.trim() });
      toast.success('Thanks — your designer will revise the design.');
      setRequesting(false);
      setNote('');
      await refetch();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not send your request.');
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <Link to="/projects" className="text-link mb-4 inline-flex items-center gap-1.5">
        <ArrowLeft size={14} aria-hidden="true" />
        My projects
      </Link>

      <PageHeader
        title={project.name}
        actions={<StatusTag tone={projectTone(project.status, stages)}>{project.status}</StatusTag>}
      />

      {/*
        The design-approval loop. The brief requires Approve and Request Changes
        to read as clear, equally understandable outcomes — so both are full
        buttons of equal weight, with plain-English consequences spelled out.
      */}
      {awaiting_client_decision ? (
        <Card accent="warning" className="mb-5 pl-5">
          <p className="label-eyebrow">Your decision needed</p>
          <p className="mt-2 text-base font-semibold text-ink">
            Your design is ready to review
          </p>
          <p className="mt-1 text-ink-muted">
            Have a look through the designs below. If you are happy, approve it and we will book
            your installation. If something is not right, tell us what to change and your designer
            will revise it — there is no limit on revisions.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <Button
              variant="primary"
              onClick={() => {
                setNote('');
                setApproving(true);
              }}
            >
              Approve design
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setNote('');
                setNoteError(null);
                setRequesting(true);
              }}
            >
              Request changes
            </Button>
          </div>
        </Card>
      ) : null}

      <Card className="mb-5">
        <p className="label-eyebrow">Where your project is up to</p>

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

        <p className="mt-3 text-ink">{STAGE_DESCRIPTIONS[project.status]}</p>
        {project.current_stage ? (
          <p className="mt-2 rounded-control bg-surface-muted px-2.5 py-2 text-ink">
            {project.current_stage}
          </p>
        ) : null}
      </Card>

      <Tabs
        tabs={[
          { id: 'timeline', label: 'Overview' },
          { id: 'designs', label: 'Designs', count: designs.length },
          { id: 'documents', label: 'Documents', count: documents.length },
          { id: 'invoices', label: 'Invoices', count: invoices.length },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'timeline' ? (
        <div className="max-w-2xl">
          <Card>
            <p className="label-eyebrow">Project details</p>
            <dl className="mt-3 rows">
              {[
                ['Service', SERVICE_LABELS[project.type]],
                ['Current stage', project.status],
                ['Progress', `${project.progress_pct}%`],
                ['Your designer', project.assigned_designer_name ?? 'To be assigned'],
                ['Started', date(project.created_at)],
                ['Last update', dateTime(project.updated_at)],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex justify-between gap-3"
                >
                  <dt className="text-ink-muted">{label}</dt>
                  <dd className="text-right font-medium text-ink">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>

        </div>
      ) : null}

      {tab === 'designs' ? (
        designs.length === 0 ? (
          <Card className="p-0">
            <EmptyState
              title="No designs yet"
              message="Your designer will share mood boards and plans here as they are ready."
            />
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {designs.map((document) => (
              <Card key={document.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">{document.name}</p>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      {DOCUMENT_LABELS[document.type]} · {date(document.upload_date)} ·{' '}
                      {fileSize(document.size_bytes)}
                    </p>
                  </div>
                  <StatusTag tone="info">{DOCUMENT_LABELS[document.type]}</StatusTag>
                </div>
                <div className="mt-3">
                  <DocumentActions document={document} />
                </div>
              </Card>
            ))}
          </div>
        )
      ) : null}

      {tab === 'documents' ? (
        documents.length === 0 ? (
          <Card className="p-0">
            <EmptyState
              title="No documents"
              message="Contracts, plans and mood boards will appear here."
            />
          </Card>
        ) : (
          <Card>
            <ul className="rows">
              {documents.map((document) => (
                <li
                  key={document.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">{document.name}</p>
                    <p className="text-xs text-ink-muted">
                      {DOCUMENT_LABELS[document.type]} · {date(document.upload_date)} ·{' '}
                      {fileSize(document.size_bytes)}
                    </p>
                  </div>
                  <DocumentActions document={document} />
                </li>
              ))}
            </ul>
          </Card>
        )
      ) : null}

      {tab === 'invoices' ? (
        invoices.length === 0 ? (
          <Card className="p-0">
            <EmptyState title="No invoices" message="Nothing has been invoiced for this project." />
          </Card>
        ) : (
          <Card>
            <ul className="rows">
              {invoices.map((invoice) => (
                <li key={invoice.id}>
                  <Link
                    to={`/invoices/${invoice.id}`}
                    className="-mx-3 -my-2.5 flex flex-wrap items-center justify-between gap-3 rounded-[8px] px-3 py-2.5 hover:bg-surface-muted/60"
                  >
                    <div>
                      <p className="font-medium text-ink">{invoice.number}</p>
                      <p className="text-xs text-ink-muted">Due {date(invoice.due_date)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="tabular font-semibold text-ink">{money(invoice.amount)}</span>
                      <StatusTag tone={invoiceTone(invoice.status, invoice.is_overdue)}>
                        {invoiceLabel(invoice.status, invoice.is_overdue)}
                      </StatusTag>
                      <CaretRight size={14} aria-hidden="true" className="text-ink-muted" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )
      ) : null}

      {/* ---- Approve ---- */}
      <Modal
        open={approving}
        onClose={() => setApproving(false)}
        title="Approve this design?"
        description="We will move your project to installation and be in touch to book dates."
        width="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setApproving(false)} disabled={pending}>
              Not yet
            </Button>
            <Button variant="primary" onClick={approve} loading={pending}>
              Yes, approve
            </Button>
          </>
        }
      >
        <Textarea
          label="Anything to add? (optional)"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Any final notes for your designer."
        />
      </Modal>

      {/* ---- Request changes ---- */}
      <Modal
        open={requesting}
        onClose={() => setRequesting(false)}
        title="Request changes"
        description="Your project goes back to the design stage and your designer revises it."
        width="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRequesting(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" form="changes-form" variant="primary" loading={pending}>
              Send request
            </Button>
          </>
        }
      >
        <form id="changes-form" onSubmit={requestChanges} noValidate>
          <Textarea
            label="What would you like changed?"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            error={noteError ?? undefined}
            placeholder="For example: please slim the flue box by another 20mm."
            required
          />
        </form>
      </Modal>
    </>
  );
}
