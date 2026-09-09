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
import { useAuth } from '@/lib/auth';
import { dateTime, moneyCompact, padCount, relative } from '@/lib/format';
import { bookingTone, projectTone } from '@/lib/status';
import type { AdminDashboard, Project } from '@/types/api';
import { PROJECT_STAGES, SERVICE_LABELS } from '@/types/api';

/**
 * Simple bar chart for the monthly bookings figure.
 *
 * Hand-drawn SVG rather than a charting dependency: the brief's restraint rules
 * rule out most of what a chart library brings, and a 12-bar chart does not
 * justify the bundle. Values are labelled in text as well as height so the
 * chart is not the only way to read them.
 */
function BarChart({
  data,
  formatValue,
}: {
  data: Array<{ month: string; label: string; value: number }>;
  formatValue?: (value: number) => string;
}) {
  const max = Math.max(1, ...data.map((point) => point.value));

  return (
    <div className="flex h-40 items-end gap-1.5" role="img" aria-label="Monthly totals">
      {data.map((point) => {
        const height = (point.value / max) * 100;
        return (
          <div key={point.month} className="flex flex-1 flex-col items-center gap-1.5">
            <span className="tabular text-[10px] font-semibold text-ink-muted">
              {point.value > 0 ? (formatValue ? formatValue(point.value) : point.value) : ''}
            </span>
            <div
              className="w-full rounded-t-[3px] bg-green-900"
              // A zero month still shows a hairline so the axis reads as continuous.
              style={{ height: `${Math.max(height, point.value > 0 ? 4 : 1)}%` }}
            />
            <span className="text-[10px] text-ink-muted">{point.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const { data, loading, error, refetch } = useQuery<AdminDashboard>('/dashboard/admin');
  const projects = useQuery<Project[]>('/projects');

  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const needingAttention = (projects.data ?? [])
    .filter((project) => project.status === 'Approval')
    .slice(0, 4);

  return (
    <>
      <PageHeader
        title={`Good day, ${user?.name.split(' ')[0] ?? 'there'}`}
        description="Everything that needs you today, in one place."
      />

      {loading || !data ? (
        <Card className="p-0">
          <TableSkeleton rows={6} columns={3} />
        </Card>
      ) : (
        <>
          {/* Bento grid. Card order follows the brief's content-rules table. */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <MetricCard
              eyebrow="Today’s bookings"
              value={padCount(data.bookings.today)}
              accent="primary"
              context={
                data.bookings.next
                  ? `Next appointment ${relative(data.bookings.next.date_time)} with ${data.bookings.next.client_name}.`
                  : 'No appointments booked for today.'
              }
              bottom={
                data.bookings.awaiting_confirmation > 0 ? (
                  <StatusTag tone="warning">
                    {data.bookings.awaiting_confirmation} awaiting confirmation
                  </StatusTag>
                ) : (
                  <Link to="/bookings" className="text-link">
                    Open calendar
                  </Link>
                )
              }
            />

            <MetricCard
              eyebrow="Active projects"
              value={padCount(data.projects.active)}
              accent="primary"
              context={`${data.projects.active - data.projects.awaiting_decision} on track; ${data.projects.awaiting_decision} need a client decision.`}
              bottom={
                <Link to="/projects" className="text-link">
                  View projects
                </Link>
              }
            />

            <MetricCard
              eyebrow="Outstanding invoices"
              value={moneyCompact(data.invoices.outstanding_total)}
              accent={data.invoices.overdue_count > 0 ? 'danger' : 'warning'}
              context={`${moneyCompact(data.invoices.due_this_week_total)} due this week.`}
              bottom={
                data.invoices.overdue_count > 0 ? (
                  <StatusTag tone="danger">
                    {data.invoices.overdue_count} overdue
                  </StatusTag>
                ) : (
                  <Link to="/invoices" className="text-link">
                    View invoices
                  </Link>
                )
              }
            />

            <MetricCard
              eyebrow="Unread messages"
              value={padCount(data.messages.unread)}
              accent={data.messages.unread > 0 ? 'warning' : 'primary'}
              context={
                data.messages.conversations_needing_reply > 0
                  ? `${data.messages.conversations_needing_reply} conversation${
                      data.messages.conversations_needing_reply === 1 ? ' requires' : 's require'
                    } a reply today.`
                  : 'Everything has been answered.'
              }
              bottom={
                <Link to="/messages" className="text-link">
                  Open inbox
                </Link>
              }
            />

            <MetricCard
              eyebrow="New enquiries"
              value={padCount(data.enquiries.new)}
              accent="primary"
              context={`${data.enquiries.since_yesterday} received since yesterday.`}
              bottom={
                <Link to="/content" className="text-link">
                  Review leads
                </Link>
              }
            />

            <MetricCard
              eyebrow="Quotes"
              value={padCount(data.quotes.sent)}
              accent="primary"
              context={`${data.quotes.draft} in draft; ${data.quotes.accepted_awaiting_invoice} accepted and ready to invoice.`}
              bottom={
                <Link to="/quotes" className="text-link">
                  Open quote builder
                </Link>
              }
            />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <p className="label-eyebrow">Bookings by month</p>
              <p className="mt-1 text-ink-muted">
                Consultations booked over the last 12 months.
              </p>
              <div className="mt-4">
                <BarChart data={data.bookings_chart} />
              </div>
            </Card>

            <Card>
              <p className="label-eyebrow">Pipeline</p>
              <ul className="mt-3 flex flex-col gap-2.5">
                {PROJECT_STAGES.map((stage) => {
                  const count = data.projects.by_stage[stage] ?? 0;
                  const total = Math.max(
                    1,
                    Object.values(data.projects.by_stage).reduce((sum, value) => sum + value, 0),
                  );
                  return (
                    <li key={stage}>
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-sm text-ink">{stage}</span>
                        <span className="tabular text-sm font-semibold text-ink">{count}</span>
                      </div>
                      <Progress value={(count / total) * 100} label={`${stage} share`} />
                    </li>
                  );
                })}
              </ul>
            </Card>
          </div>

          <Card className="mt-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="label-eyebrow">Awaiting a client decision</p>
                <p className="mt-1 text-ink-muted">
                  Designs sitting with the client for approval.
                </p>
              </div>
              <Link to="/projects" className="text-link shrink-0">
                View board
              </Link>
            </div>

            {projects.loading ? (
              <TableSkeleton rows={3} columns={3} />
            ) : needingAttention.length === 0 ? (
              <p className="py-6 text-center text-ink-muted">
                Nothing is waiting on a client right now.
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {needingAttention.map((project) => (
                  <li
                    key={project.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <Link
                        to={`/projects/${project.id}`}
                        className="text-link block truncate"
                      >
                        {project.name}
                      </Link>
                      <p className="truncate text-xs text-ink-muted">
                        {project.client_name} · {SERVICE_LABELS[project.type]} · updated{' '}
                        {dateTime(project.updated_at)}
                      </p>
                    </div>
                    <StatusTag tone={projectTone(project.status)}>{project.status}</StatusTag>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {data.bookings.next ? (
            <Card className="mt-4" accent="primary">
              <p className="label-eyebrow">Next appointment</p>
              <p className="mt-2 text-base font-semibold text-ink">
                {data.bookings.next.client_name} ·{' '}
                {SERVICE_LABELS[data.bookings.next.service_type]}
              </p>
              <p className="mt-0.5 text-ink-muted">
                {dateTime(data.bookings.next.date_time)} ({relative(data.bookings.next.date_time)})
              </p>
              <div className="mt-3">
                <StatusTag tone={bookingTone(data.bookings.next.status)}>
                  {data.bookings.next.status}
                </StatusTag>
              </div>
            </Card>
          ) : null}
        </>
      )}
    </>
  );
}
