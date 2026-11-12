import { Link } from 'react-router-dom';

import {
  Card,
  ErrorState,
  MetricCard,
  PageHeader,
  Progress,
  StatusTag,
  TableSkeleton,
} from '@/components/ui';
import { useQuery } from '@/hooks/useApi';
import { useStages } from '@/hooks/useStages';
import { useAuth } from '@/lib/auth';
import { date, dateTime, money, padCount, relative } from '@/lib/format';
import { projectTone } from '@/lib/status';
import type { PortalDashboard } from '@/types/api';
import { SERVICE_LABELS } from '@/types/api';

/**
 * Portal dashboard.
 *
 * Card order follows the UI/UX brief's Client Portal direction exactly:
 * "next appointment, decision awaiting client, timeline, unread messages,
 * invoice summary and documents". The decision card is deliberately loud —
 * it is the one thing only the client can unblock.
 */
export function DashboardPage() {
  const { user } = useAuth();
  const { stages } = useStages();
  const { data, loading, error, refetch } = useQuery<PortalDashboard>('/dashboard/portal');

  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const firstName = user?.name.split(' ')[0] ?? 'there';

  return (
    <>
      <PageHeader
        title={`Hello, ${firstName}`}
        description="Where your project is up to."
      />

      {loading || !data ? (
        <Card className="p-0">
          <TableSkeleton rows={5} columns={3} />
        </Card>
      ) : (
        <>
          {/* The decision awaiting the client, above everything else. */}
          {data.projects.awaiting_your_approval.length > 0 ? (
            <Card accent="warning" className="mb-4">
              <p className="label-eyebrow">Waiting for you</p>
              <p className="mt-2 text-base font-semibold text-ink">
                {data.projects.awaiting_your_approval.length === 1
                  ? 'A design is ready for your approval'
                  : `${data.projects.awaiting_your_approval.length} designs are ready for your approval`}
              </p>
              <ul className="mt-3 flex flex-col gap-2">
                {data.projects.awaiting_your_approval.map((project) => (
                  <li key={project.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-ink">
                      {project.name}{' '}
                      <span className="text-ink-muted">· {SERVICE_LABELS[project.type]}</span>
                    </span>
                    <Link to={`/projects/${project.id}`} className="text-link">
                      Review design
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <MetricCard
              eyebrow="Next appointment"
              value={data.next_appointment ? relative(data.next_appointment.starts_at) : 'None booked'}
              accent="primary"
              context={
                data.next_appointment
                  ? `${data.next_appointment.service_label} · ${dateTime(data.next_appointment.starts_at)}`
                  : 'Get in touch to arrange your next visit.'
              }
            />

            <MetricCard
              eyebrow="Amount due"
              value={money(data.invoices.outstanding_total)}
              accent={data.invoices.next_due?.is_overdue ? 'danger' : data.invoices.outstanding_total > 0 ? 'warning' : 'success'}
              context={
                data.invoices.next_due
                  ? `${data.invoices.next_due.number} due ${date(data.invoices.next_due.due_date)}${
                      data.invoices.next_due.is_overdue ? ` · ${data.invoices.next_due.days_overdue} days overdue` : ''
                    }`
                  : 'Nothing outstanding. Thank you.'
              }
              bottom={
                <Link to="/invoices" className="text-link">
                  View invoices
                </Link>
              }
            />

            <MetricCard
              eyebrow="Your documents"
              value={padCount(data.documents_count)}
              accent="primary"
              context="Contracts, plans, mood boards and invoices."
              bottom={
                <Link to="/documents" className="text-link">
                  View documents
                </Link>
              }
            />
          </div>

          <Card className="mt-4">
            <p className="label-eyebrow">Project timeline</p>
            {data.timeline.length === 0 ? (
              <p className="py-8 text-center text-ink-muted">
                You have no active projects at the moment.
              </p>
            ) : (
              <ul className="mt-3 rows">
                {data.timeline.map((project) => (
                  <li key={project.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link to={`/projects/${project.id}`} className="text-link">
                          {project.name}
                        </Link>
                        <p className="text-xs text-ink-muted">
                          {SERVICE_LABELS[project.type]} · updated {relative(project.updated_at)}
                        </p>
                      </div>
                      <StatusTag tone={projectTone(project.status, stages)}>{project.status}</StatusTag>
                    </div>
                    <div className="mt-2">
                      <Progress value={project.progress_pct} label={`${project.name} progress`} />
                    </div>
                    {project.current_stage ? (
                      <p className="mt-1.5 text-xs text-ink-muted">{project.current_stage}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>

        </>
      )}
    </>
  );
}
