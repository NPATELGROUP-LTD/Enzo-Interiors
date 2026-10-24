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
import { dateTime, moneyCompact, padCount, relative } from '@/lib/format';
import { projectTone } from '@/lib/status';
import type { AdminDashboard, ChangeRequest, DashboardProjects, DesignerDashboard, Project } from '@/types/api';
import { SERVICE_LABELS } from '@/types/api';

/**
 * Simple bar chart for a monthly figure.
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
    <div className="flex h-full min-h-40 gap-1.5" role="img" aria-label="Monthly totals">
      {data.map((point) => {
        const height = (point.value / max) * 100;
        const shown = formatValue ? formatValue(point.value) : String(point.value);
        // basis-0 + min-w-0: every month is the same width whatever its label says.
        // A phone has no room for twelve amounts: there they show only as a hover title.
        return (
          <div key={point.month} title={`${point.label}: ${shown}`} className="flex min-w-0 flex-1 basis-0 flex-col items-center gap-1.5">
            <span className="tabular whitespace-nowrap text-[10px] font-semibold text-ink-muted max-sm:hidden">
              {point.value > 0 ? shown : ''}
            </span>
            {/* flex-1 gives the bar a definite track, so its % height resolves. */}
            <div className="flex w-full flex-1 items-end">
              <div
                className="w-full rounded-t-[4px] bg-green-900"
                // A zero month still shows a hairline so the axis reads as continuous.
                style={{ height: `${Math.max(height, point.value > 0 ? 4 : 1)}%` }}
              />
            </div>
            <span className="text-[10px] text-ink-muted">{point.label}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Where the projects are, stage by stage. */
function Pipeline({ projects }: { projects: DashboardProjects }) {
  const total = Math.max(1, Object.values(projects.by_stage).reduce((sum, value) => sum + value, 0));
  return (
    <Card>
      <p className="label-eyebrow">Pipeline</p>
      <ul className="mt-3 flex flex-col gap-2.5">
        {projects.stages.map((stage) => {
          const count = projects.by_stage[stage] ?? 0;
          return (
            <li key={stage}>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-sm text-ink">{stage}</span>
                <span className="tabular text-sm font-semibold text-ink">{count}</span>
              </div>
              <Progress value={Math.round((count / total) * 100)} label={`${stage} share`} />
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/** Designs sitting with the client for approval (what the API lets this person see). */
function AwaitingDecision() {
  const projects = useQuery<Project[]>('/projects');
  const { approval, stages } = useStages();
  const waiting = (projects.data ?? []).filter((project) => project.status === approval).slice(0, 4);

  return (
    <Card className="mt-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="label-eyebrow">Awaiting a client decision</p>
          <p className="mt-1 text-ink-muted">Designs sitting with the client for approval.</p>
        </div>
        <Link to="/projects" className="text-link shrink-0">
          View board
        </Link>
      </div>

      {projects.loading ? (
        <TableSkeleton rows={3} columns={3} />
      ) : waiting.length === 0 ? (
        <p className="py-6 text-center text-ink-muted">Nothing is waiting on a client right now.</p>
      ) : (
        <ul className="rows">
          {waiting.map((project) => (
            <li
              key={project.id}
              className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div className="min-w-0">
                <Link to={`/projects/${project.id}`} className="text-link block truncate">
                  {project.name}
                </Link>
                <p className="truncate text-xs text-ink-muted">
                  {project.client_name} · {SERVICE_LABELS[project.type]} · updated {dateTime(project.updated_at)}
                </p>
              </div>
              <StatusTag tone={projectTone(project.status, stages)}>{project.status}</StatusTag>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function AdminView() {
  const { data, loading, error, refetch } = useQuery<AdminDashboard>('/dashboard/admin');
  const requests = useQuery<ChangeRequest[]>('/change-requests?status=Pending');

  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (loading || !data) {
    return (
      <Card className="p-0">
        <TableSkeleton rows={6} columns={3} />
      </Card>
    );
  }

  const { appointments, projects, invoices, enquiries, clients } = data;

  return (
    <>
      {requests.data?.length ? (
        <Card accent="warning" className="mb-4 pl-5">
          <p className="font-semibold text-ink">
            {requests.data.length} change request{requests.data.length === 1 ? '' : 's'} waiting for you
          </p>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {requests.data.map((row) => (
              <li key={row.id}>
                <Link to={row.project_id ? `/projects/${row.project_id}` : `/clients/${row.client_id}`} className="text-link">
                  {row.requested_name}: {row.kind === 'project_stage' ? `move to ${row.payload.status}` : `change ${Object.keys(row.payload).join(', ')}`}
                </Link>
                <span className="ml-2 text-xs text-ink-muted">{relative(row.created_at)}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      {/* Bento grid. Card order follows the brief's content-rules table. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          eyebrow="Today’s consultations"
          value={padCount(appointments.today)}
          accent="primary"
          context={
            appointments.next
              ? `Next up: ${appointments.next.name}, ${relative(appointments.next.starts_at).toLowerCase()}.`
              : 'Nothing booked ahead.'
          }
          bottom={
            <Link to="/bookings" className="text-link">
              Open calendar
            </Link>
          }
        />

        <MetricCard
          eyebrow="Active projects"
          value={padCount(projects.active)}
          accent="primary"
          context={`${projects.active - projects.awaiting_decision} on track; ${projects.awaiting_decision} need a client decision.`}
          bottom={
            <Link to="/projects" className="text-link">
              View projects
            </Link>
          }
        />

        <MetricCard
          eyebrow="Outstanding invoices"
          value={moneyCompact(invoices.outstanding_total)}
          accent={invoices.overdue_count > 0 ? 'danger' : 'warning'}
          context={`${moneyCompact(invoices.due_this_week_total)} due this week.`}
          bottom={
            invoices.overdue_count > 0 ? (
              <StatusTag tone="danger">{invoices.overdue_count} overdue</StatusTag>
            ) : (
              <Link to="/invoices" className="text-link">
                View invoices
              </Link>
            )
          }
        />

        <MetricCard
          eyebrow="Paid this month"
          value={moneyCompact(invoices.paid_this_month)}
          accent="success"
          context={`${moneyCompact(invoices.paid_total)} received in all.`}
          bottom={
            <Link to="/invoices?view=paid" className="text-link">
              View paid
            </Link>
          }
        />

        <MetricCard
          eyebrow="New enquiries"
          value={padCount(enquiries.new)}
          accent="primary"
          context={`${enquiries.since_yesterday} received since yesterday.`}
          bottom={
            <Link to="/enquiries?view=New" className="text-link">
              Open inbox
            </Link>
          }
        />

        <MetricCard
          eyebrow="Active clients"
          value={padCount(clients.active)}
          accent="primary"
          context={`${clients.total} client${clients.total === 1 ? '' : 's'} on the books.`}
          bottom={
            <Link to="/clients" className="text-link">
              View clients
            </Link>
          }
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="flex flex-col xl:col-span-2">
          <p className="label-eyebrow">Consultations by month</p>
          <p className="mt-1 text-ink-muted">Consultations over the last 12 months.</p>
          <div className="mt-4 flex-1">
            <BarChart data={data.appointments_chart} />
          </div>
        </Card>
        <Pipeline projects={projects} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="flex flex-col xl:col-span-2">
          <p className="label-eyebrow">Revenue by month</p>
          <p className="mt-1 text-ink-muted">Invoices marked paid over the last 12 months.</p>
          <div className="mt-4 flex-1">
            <BarChart data={data.revenue_chart} formatValue={moneyCompact} />
          </div>
        </Card>

        <Card accent="primary" className="flex flex-col">
          <p className="label-eyebrow">Next consultation</p>
          {appointments.next ? (
            <>
              <p className="mt-2 text-base font-semibold text-ink">{appointments.next.name}</p>
              <p className="mt-0.5 text-ink-muted">{appointments.next.service_label}</p>
              <p className="mt-0.5 text-ink-muted">
                {dateTime(appointments.next.starts_at)} ({relative(appointments.next.starts_at)})
              </p>
              <p className="mt-auto pt-3 text-xs text-ink-muted">
                {appointments.upcoming} upcoming in all ·{' '}
                <Link to="/bookings" className="text-link">
                  Open calendar
                </Link>
              </p>
            </>
          ) : (
            <p className="mt-2 text-ink-muted">No consultations are booked.</p>
          )}
        </Card>
      </div>

      <AwaitingDecision />
    </>
  );
}

function DesignerView() {
  const { data, loading, error, refetch } = useQuery<DesignerDashboard>('/dashboard/designer');
  const { stages } = useStages();

  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (loading || !data) {
    return (
      <Card className="p-0">
        <TableSkeleton rows={6} columns={3} />
      </Card>
    );
  }

  const { projects, tasks } = data;

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard
          eyebrow="Your active projects"
          value={padCount(projects.active)}
          accent="primary"
          context={`${projects.completed} completed.`}
          bottom={
            <Link to="/projects" className="text-link">
              View projects
            </Link>
          }
        />
        <MetricCard
          eyebrow="With the client"
          value={padCount(projects.awaiting_decision)}
          accent={projects.awaiting_decision > 0 ? 'warning' : 'primary'}
          context="Designs waiting for a client decision."
        />
        <MetricCard
          eyebrow={`At ${projects.stages.at(-2) ?? 'work'}`}
          value={padCount(projects.by_stage[projects.stages.at(-2) ?? ''] ?? 0)}
          accent="primary"
          context="The last stage before done."
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <p className="label-eyebrow">Your open work</p>
          <p className="mt-1 text-ink-muted">Projects assigned to you that are not finished, latest first.</p>
          {tasks.length === 0 ? (
            <p className="py-6 text-center text-ink-muted">Nothing is assigned to you right now.</p>
          ) : (
            <ul className="rows mt-3">
              {tasks.map((task) => (
                <li key={task.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link to={`/projects/${task.id}`} className="text-link block truncate">
                        {task.name}
                      </Link>
                      <p className="truncate text-xs text-ink-muted">
                        {task.client_name} · {SERVICE_LABELS[task.type]} · {task.roles.join(' and ')} · updated{' '}
                        {relative(task.updated_at)}
                      </p>
                    </div>
                    <StatusTag tone={projectTone(task.status, stages)}>{task.status}</StatusTag>
                  </div>
                  <div className="mt-2">
                    <Progress value={task.progress_pct} label={`${task.name} progress`} />
                  </div>
                  {task.current_stage ? <p className="mt-1.5 text-xs text-ink-muted">{task.current_stage}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Pipeline projects={projects} />
      </div>
    </>
  );
}

/** The landing page for Admin (everything) and Designers (their own projects). Editors never reach it. */
export function DashboardPage() {
  const { user, isAdmin } = useAuth();

  return (
    <div className="px-5 pb-16 pt-6 sm:px-8 lg:pt-8">
      <PageHeader
        prominent
        title={`Good day, ${user?.name.split(' ')[0] ?? 'there'}`}
        description={isAdmin ? 'Everything that needs you today, in one place.' : 'Where your projects are up to.'}
      />
      {isAdmin ? <AdminView /> : <DesignerView />}
    </div>
  );
}
