import { Link } from 'react-router-dom';

import { MetricCard, PageHeader } from '@/components/ui';
import { useQuery } from '@/hooks/useApi';

import { Cluster } from './settings/Cluster';

/* The few figures the cards show, from the same /infra/stats the Health pane reads. */
interface Stats {
  checks: Array<{ ok: boolean }>;
  database: { bytes: number; connections: number; max_connections: number } | null;
  traffic: { errors: number; failed_signins: number };
  problems_7d: { urgent: number; error: number; security: number };
}

const mb = (bytes: number) => (bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(1)} GB` : `${Math.round(bytes / 1024 ** 2)} MB`);

/* Each pane has its own page under Settings; the dashboard only points at them. */
const PAGES = [
  ['health', 'Health'],
  ['alerts', 'Alerts'],
  ['website', 'Website'],
  ['pages', 'Pages'],
  ['users', 'Users'],
  ['security', 'Security'],
] as const;

/** The Infra manager's landing page: the platform's figures and the live cluster. Everything else is its own Settings page. */
export function InfraDashboard() {
  const stats = useQuery<Stats>('/infra/stats').data;
  const failing = stats ? stats.checks.filter((check) => !check.ok).length : 0;
  const problems = stats ? stats.problems_7d.urgent + stats.problems_7d.error + stats.problems_7d.security : 0;

  return (
    <div className="px-5 pb-16 pt-1 sm:px-8">
      <PageHeader title="Dashboard" description="How the platform is doing, and everything that runs it." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          eyebrow="Checks needing attention"
          value={stats ? failing : '–'}
          context={failing ? 'A switch or service is not set up.' : 'Every check is passing.'}
          accent={failing ? 'warning' : 'success'}
        />
        <MetricCard
          eyebrow="Problems emailed (7 days)"
          value={stats ? problems : '–'}
          context={stats ? `${stats.problems_7d.urgent} urgent · ${stats.problems_7d.error} errors · ${stats.problems_7d.security} security` : undefined}
          accent={problems ? 'danger' : 'success'}
        />
        <MetricCard
          eyebrow="Errors, last 24 hours"
          value={stats ? stats.traffic.errors : '–'}
          context={stats ? `${stats.traffic.failed_signins} failed sign-ins` : undefined}
          accent={stats && stats.traffic.errors ? 'warning' : 'primary'}
        />
        <MetricCard
          eyebrow="Database"
          value={stats?.database ? mb(stats.database.bytes) : '–'}
          context={stats?.database ? `${stats.database.connections} of ${stats.database.max_connections} connections` : 'Did not answer.'}
        />
      </div>

      <nav aria-label="Platform pages" className="mt-5 flex flex-wrap gap-2">
        {PAGES.map(([id, label]) => (
          <Link key={id} to={`/settings/${id}`} className="rounded-full border border-border bg-surface px-3.5 py-1.5 text-[13px] font-medium text-ink transition-colors hover:bg-surface-muted">
            {label}
          </Link>
        ))}
      </nav>

      <section aria-label="Cluster" className="mt-5 rounded-card bg-surface p-5 shadow-soft sm:p-6">
        <Cluster compact />
      </section>
    </div>
  );
}
