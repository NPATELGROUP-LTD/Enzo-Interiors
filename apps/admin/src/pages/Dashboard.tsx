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

/** Where the projects are, stage by stage; each stage opens its projects. Bars are scaled to the busiest stage. */
function Pipeline({ projects, className }: { projects: DashboardProjects; className?: string }) {
  const busiest = Math.max(1, ...projects.stages.map((stage) => projects.by_stage[stage] ?? 0));
  const total = projects.stages.reduce((sum, stage) => sum + (projects.by_stage[stage] ?? 0), 0);
  return (
    <Card className={clsx('flex flex-col', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold text-ink">Pipeline</h2>
        <span className="tabular text-sm text-ink-muted">{plural(total, 'project')}</span>
      </div>
      <ul className="-mx-2 mt-3 flex flex-col">
        {projects.stages.map((stage) => {
          const count = projects.by_stage[stage] ?? 0;
          return (
            <li key={stage}>
              <Link
                to={stageLink([stage])}
                className="grid grid-cols-[minmax(0,7rem)_1fr_2rem] items-center gap-3 rounded-control px-2 py-2.5 hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring/40"
              >
                <span className={clsx('truncate text-sm', count ? 'font-medium text-ink' : 'text-ink-muted')}>{stage}</span>
                <span className="h-2 overflow-hidden rounded-full bg-ink/[0.07]" role="img" aria-label={`${plural(count, 'project')} at ${stage}`}>
                  <span className="block h-full rounded-full bg-green-900" style={{ width: `${(count / busiest) * 100}%` }} />
                </span>
                <span className={clsx('tabular text-right text-sm font-semibold', count ? 'text-ink' : 'text-ink-muted/60')}>{count}</span>
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
          ['New quote', 'Quote', '/quotes?new=1'],
          ['New invoice', 'Invoice', '/invoices?new=1'],
          ['New booking', 'Booking', '/bookings?new=1'],
        ] as Array<[string, string, string]>)
      : []),
  ];
  return (
    <>
      {items.map(([long, short, to]) => (
        <Button key={to} className="max-md:hidden" icon={<Plus size={14} weight="bold" aria-hidden="true" />} onClick={() => navigate(to)}>
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

      {/* Bento: two columns from sm, four from xl (1+1+1+1 over 1+2+1); one column on a phone. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile title="Today’s consultations" value={padCount(appointments.today)} to="/bookings">
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

        <Tile title="Total quoted" value={moneyCompact(quotes.quoted_total)} to="/quotes">
          <p className={SUB}>{moneyCompact(quotes.accepted_total)} accepted.</p>
          {quotes.draft_total > 0 ? <p className="text-sm text-ink-muted">{moneyCompact(quotes.draft_total)} in drafts, not sent yet.</p> : null}
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

/** One figure in a strip: label, a large number that opens its list, one line of context. */
function Stat({ label, value, to, note, tone = 'primary' }: { label: string; value: number; to: string; note: string; tone?: keyof typeof TONE_TEXT }) {
  return (
    <Link to={to} className="group block px-5 py-4 first:rounded-t-card last:rounded-b-card hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-focus-ring/40 sm:first:rounded-l-card sm:first:rounded-tr-none sm:last:rounded-r-card sm:last:rounded-bl-none">
      <span className="label-eyebrow block">{label}</span>
      <span className={clsx('tabular mt-1.5 block text-4xl font-bold leading-none tracking-tight', TONE_TEXT[tone])}>{padCount(value)}</span>
      <span className="mt-2 block text-sm text-ink-muted">{note}</span>
    </Link>
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
      {/* One strip, three figures: the number leads, what it is sits above it, one line of context under. */}
      <Card className="grid grid-cols-1 divide-y divide-border p-0 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <Stat label="Active projects" value={projects.active} to="/projects?view=list" note={`${projects.completed} completed`} />
        <Stat
          label="With the client"
          value={projects.awaiting_decision}
          to={stageLink(approvals)}
          note="Waiting for a decision"
          tone={projects.awaiting_decision > 0 ? 'warning' : 'primary'}
        />
        <Stat label={`At ${beforeDone}`} value={projects.by_stage[beforeDone] ?? 0} to={stageLink([beforeDone])} note="One step from done" />
      </Card>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Card className="p-0">
          <div className="flex items-baseline justify-between gap-3 px-5 pb-2 pt-5">
            <h2 className="text-base font-semibold text-ink">Your open work</h2>
            <span className="tabular text-sm text-ink-muted">{tasks.length}</span>
          </div>
          {tasks.length === 0 ? (
            <p className="px-5 pb-8 pt-4 text-center text-ink-muted">Nothing is assigned to you right now.</p>
          ) : (
            <ul className="px-2 pb-2">
              {tasks.map((task) => (
                <li key={task.id}>
                  <Link
                    to={`/projects/${task.id}`}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 rounded-control px-3 py-3 hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring/40 md:grid-cols-[minmax(0,1fr)_9rem_11rem]"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-ink">{task.name}</span>
                      <span className="block truncate text-xs text-ink-muted">
                        {task.client_name} · {SERVICE_LABELS[task.type]} · {task.roles.join(' and ')} · {relative(task.updated_at)}
                      </span>
                      {task.current_stage ? <span className="mt-0.5 block truncate text-xs text-ink-muted/80">{task.current_stage}</span> : null}
                    </span>
                    <StatusTag tone={projectTone(task.status, stages)}>{task.status}</StatusTag>
                    <span className="col-span-2 md:col-span-1">
                      <Progress value={task.progress_pct} label={`${task.name} progress`} />
                    </span>
                  </Link>
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

  return <div className="px-5 pb-16 pt-2 sm:px-8">{isAdmin ? <AdminView /> : <DesignerView />}</div>;
}
