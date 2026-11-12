import { Plus } from '@phosphor-icons/react';
import clsx from 'clsx';
import { useState, type PointerEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import {
  Button,
  Card,
  ErrorState,
  PageHeader,
  Progress,
  StatusTag,
  TableSkeleton,
} from '@/components/ui';
import { useQuery } from '@/hooks/useApi';
import { useStages } from '@/hooks/useStages';
import { useAuth } from '@/lib/auth';
import { money, moneyCompact, padCount, relative } from '@/lib/format';
import { projectTone } from '@/lib/status';
import type { AdminDashboard, ChangeRequest, DashboardProjects, DesignerDashboard } from '@/types/api';
import { SERVICE_LABELS } from '@/types/api';

type Month = AdminDashboard['appointments_chart'][number];

const TONE_TEXT = { primary: 'text-green-900', success: 'text-success', warning: 'text-warning', danger: 'text-danger' };
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Where the projects list opens for these stages (the list view is the one that can be narrowed). */
const stageLink = (stages: string[]) =>
  stages.length ? `/projects?view=list&stage=${encodeURIComponent(stages.join(','))}` : '/projects?view=list';

/** "Up 12% on last month (£1.1k)": this month against last, from a 12-month series. */
function versus(data: Month[], format: (n: number) => string): string {
  const now = data.at(-1)?.value ?? 0;
  const before = data.at(-2)?.value ?? 0;
  if (before === 0) return `${format(0)} last month`;
  const pct = Math.round(((now - before) / before) * 100);
  return `${pct >= 0 ? 'Up' : 'Down'} ${Math.abs(pct)}% on last month (${format(before)})`;
}

/**
 * Twelve months as a small line. Hover (or drag, on touch) reads one month in the
 * fixed-height line above it; a click opens the list the figure comes from.
 * Hand-drawn SVG: the stretch (non-scaling stroke) keeps one line weight at any width.
 */
function Spark({ data, format, to }: { data: Month[]; format: (n: number) => string; to: string }) {
  const navigate = useNavigate();
  const [at, setAt] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((point) => point.value));
  const last = data.length - 1;
  const x = (i: number) => 2 + (i / last) * 96;
  const y = (value: number) => 94 - (value / max) * 88;
  const shown = data[at ?? last]!;
  const pick = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    setAt(Math.min(last, Math.max(0, Math.round(((event.clientX - box.left) / box.width) * last))));
  };

  return (
    <div className="relative z-10 mt-4" aria-hidden="true">
      <p className="tabular h-4 text-xs text-ink-muted">
        {shown.label} {shown.month.slice(0, 4)} · {format(shown.value)}
      </p>
      <div
        className="relative mt-2 h-12 cursor-pointer touch-pan-y"
        onPointerMove={pick}
        onPointerLeave={() => setAt(null)}
        onClick={() => navigate(to)}
      >
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full text-green-900">
          <polyline
            points={data.map((point, i) => `${x(i)},${y(point.value)}`).join(' ')}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <span
          className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-green-900"
          style={{ left: `${x(at ?? last)}%`, top: `${y(shown.value)}%` }}
        />
      </div>
    </div>
  );
}

/**
 * One figure. The whole card opens `to` (the number is a stretched link, so
 * keyboard users get one stop); links inside `children` sit above it.
 */
function Tile({
  title,
  value,
  to,
  tone = 'primary',
  className,
  children,
}: {
  title: string;
  value: ReactNode;
  to: string;
  tone?: keyof typeof TONE_TEXT;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <Card accent={tone} interactive className={clsx('flex flex-col p-5', className)}>
      <p className="label-eyebrow">{title}</p>
      <Link
        to={to}
        className={clsx(
          'tabular mt-3 w-fit text-[40px] font-bold leading-none tracking-tight focus-visible:outline-none',
          'after:absolute after:inset-0 after:rounded-card after:content-[""] focus-visible:after:ring-[3px] focus-visible:after:ring-focus-ring/40',
          TONE_TEXT[tone],
        )}
      >
        {value}
      </Link>
      {children}
    </Card>
  );
}

const SUB = 'mt-2 line-clamp-2 text-ink-muted';

/** Where the projects are, stage by stage; each stage opens its projects. */
function Pipeline({ projects, className }: { projects: DashboardProjects; className?: string }) {
  const total = Math.max(1, Object.values(projects.by_stage).reduce((sum, value) => sum + value, 0));
  return (
    <Card className={className}>
      <p className="label-eyebrow">Pipeline</p>
      <ul className="-mx-2 mt-2 flex flex-col">
        {projects.stages.map((stage) => {
          const count = projects.by_stage[stage] ?? 0;
          return (
            <li key={stage}>
              <Link
                to={stageLink([stage])}
                className="block rounded-control px-2 py-2 hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring/40"
              >
                <span className="mb-1 flex items-center justify-between">
                  <span className="text-sm text-ink">{stage}</span>
                  <span className="tabular text-sm font-semibold text-ink">{padCount(count)}</span>
                </span>
                <Progress value={Math.round((count / total) * 100)} label={`${stage} share`} />
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/** "Good morning, Neel" and, when there is one, what today holds. */
function Heading({ line, actions }: { line?: string; actions?: ReactNode }) {
  const { user } = useAuth();
  const hour = new Date().getHours();
  const hello = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  return <PageHeader title={`${hello}, ${user?.name.split(' ')[0] ?? 'there'}`} description={line} actions={actions} />;
}

/** The "New …" buttons this role may use. */
function Shortcuts() {
  const navigate = useNavigate();
  const { can, isAdmin } = useAuth();
  const items: Array<[string, string, string]> = [
    ...(can('Admin', 'Designer') ? [['New client', 'Client', '/clients?new=1'] as [string, string, string]] : []),
    ...(isAdmin
      ? ([
          ['New project', 'Project', '/projects?new=1'],
          ['New quote', 'Quote', '/quote-maker/new'],
          ['New invoice', 'Invoice', '/invoices?new=1'],
          ['New booking', 'Booking', '/bookings?new=1'],
        ] as Array<[string, string, string]>)
      : []),
  ];
  return (
    <>
      {items.map(([long, short, to]) => (
        <Button key={to} icon={<Plus size={14} weight="bold" aria-hidden="true" />} onClick={() => navigate(to)}>
          <span className="sm:hidden">{short}</span>
          <span className="max-sm:hidden">{long}</span>
        </Button>
      ))}
    </>
  );
}

function AdminView() {
  const { data, loading, error, refetch } = useQuery<AdminDashboard>('/dashboard/admin');
  const requests = useQuery<ChangeRequest[]>('/change-requests?status=Pending');
  const { approvals } = useStages();

  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (loading || !data) {
    return (
      <>
        <Heading actions={<Shortcuts />} />
        <Card className="p-0">
          <TableSkeleton rows={6} columns={3} />
        </Card>
      </>
    );
  }

  const { appointments, projects, invoices, enquiries, quotes } = data;
  const today = [
    appointments.today ? `${plural(appointments.today, 'consultation')} today` : '',
    enquiries.new ? `${plural(enquiries.new, 'new enquiry', 'new enquiries')}` : '',
  ].filter(Boolean);
  const decisions = projects.awaiting_decision + quotes.sent;

  return (
    <>
      <Heading line={today.length ? today.join(', ') : 'Nothing urgent today.'} actions={<Shortcuts />} />

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

      {/* Bento: two columns from sm, four from xl (2+1+1 over 1+2+1); one column on a phone. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile title="Today’s consultations" value={padCount(appointments.today)} to="/bookings" className="xl:col-span-2">
          <p className={SUB}>
            {appointments.next
              ? `Next up: ${appointments.next.name}, ${relative(appointments.next.starts_at).toLowerCase()}.`
              : 'Nothing booked ahead.'}
          </p>
          <p className="text-sm text-ink-muted">
            {data.appointments_chart.at(-1)?.value ?? 0} this month · {versus(data.appointments_chart, String)}
          </p>
          <Spark data={data.appointments_chart} format={(n) => plural(n, 'consultation')} to="/bookings" />
        </Tile>

        <Tile title="New enquiries" value={padCount(enquiries.new)} to="/enquiries?view=New">
          <p className={SUB}>{enquiries.since_yesterday} received since yesterday.</p>
        </Tile>

        <Tile
          title="Outstanding invoices"
          value={moneyCompact(invoices.outstanding_total)}
          to="/invoices?view=sent"
          tone={invoices.overdue_count > 0 ? 'danger' : 'warning'}
        >
          <p className={SUB}>{moneyCompact(invoices.due_this_week_total)} due this week.</p>
          {invoices.overdue_count > 0 ? (
            <Link to="/invoices?view=overdue" className="relative z-10 mt-3 w-fit">
              <StatusTag tone="danger">{invoices.overdue_count} overdue</StatusTag>
            </Link>
          ) : null}
        </Tile>

        <Tile title="Awaiting client decision" value={padCount(decisions)} to={decisions && !projects.awaiting_decision ? '/quotes?view=Sent' : stageLink(approvals)} tone={decisions ? 'warning' : 'primary'}>
          <p className={clsx(SUB, 'relative z-10')}>
            <Link to={stageLink(approvals)} className="text-link">
              {plural(projects.awaiting_decision, 'project')}
            </Link>{' '}
            at approval ·{' '}
            <Link to="/quotes?view=Sent" className="text-link">
              {plural(quotes.sent, 'quote')}
            </Link>{' '}
            sent
          </p>
        </Tile>

        <Pipeline projects={projects} className="xl:col-span-2" />

        <Tile title="Paid this month" value={moneyCompact(invoices.paid_this_month)} to="/invoices?view=paid" tone="success">
          <p className={SUB}>{versus(data.revenue_chart, moneyCompact)}</p>
          <Spark data={data.revenue_chart} format={money} to="/invoices?view=paid" />
        </Tile>
      </div>
    </>
  );
}

function DesignerView() {
  const { data, loading, error, refetch } = useQuery<DesignerDashboard>('/dashboard/designer');
  const { stages, approvals } = useStages();

  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (loading || !data) {
    return (
      <>
        <Heading actions={<Shortcuts />} />
        <Card className="p-0">
          <TableSkeleton rows={6} columns={3} />
        </Card>
      </>
    );
  }

  const { projects, tasks } = data;
  const beforeDone = projects.stages.at(-2) ?? 'work';

  return (
    <>
      <Heading
        line={`${plural(projects.active, 'active project')}, ${projects.awaiting_decision} with the client.`}
        actions={<Shortcuts />}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Tile title="Your active projects" value={padCount(projects.active)} to="/projects?view=list">
          <p className={SUB}>{projects.completed} completed.</p>
        </Tile>
        <Tile
          title="With the client"
          value={padCount(projects.awaiting_decision)}
          to={stageLink(approvals)}
          tone={projects.awaiting_decision > 0 ? 'warning' : 'primary'}
        >
          <p className={SUB}>Designs waiting for a client decision.</p>
        </Tile>
        <Tile title={`At ${beforeDone}`} value={padCount(projects.by_stage[beforeDone] ?? 0)} to={stageLink([beforeDone])}>
          <p className={SUB}>The last stage before done.</p>
        </Tile>
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
  const { isAdmin } = useAuth();

  return <div className="px-5 pb-16 pt-6 sm:px-8 lg:pt-8">{isAdmin ? <AdminView /> : <DesignerView />}</div>;
}
