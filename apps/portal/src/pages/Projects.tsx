import { Link } from 'react-router-dom';

import {
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  Progress,
  StatusTag,
  TableSkeleton,
} from '@/components/ui';
import { useQuery } from '@/hooks/useApi';
import { date, relative } from '@/lib/format';
import { projectTone } from '@/lib/status';
import type { Project } from '@/types/api';
import { SERVICE_LABELS, STAGE_DESCRIPTIONS } from '@/types/api';

export function ProjectsPage() {
  const { data, loading, error, refetch } = useQuery<Project[]>('/projects');

  return (
    <>
      <PageHeader
        title="My Projects"
        description="Everything Enzo Interiors is building for you."
      />

      {error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : loading ? (
        <Card className="p-0">
          <TableSkeleton rows={4} columns={3} />
        </Card>
      ) : (data ?? []).length === 0 ? (
        <Card className="p-0">
          <EmptyState
            title="No projects yet"
            message="Once your project is under way it will appear here with its full timeline."
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {(data ?? []).map((project) => (
            <Card
              key={project.id}
              accent={project.status === 'Approval' ? 'warning' : 'none'}
              className={project.status === 'Approval' ? 'pl-5' : undefined}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link to={`/projects/${project.id}`} className="text-link block">
                    {project.name}
                  </Link>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {SERVICE_LABELS[project.type]} · started {date(project.created_at)}
                  </p>
                </div>
                <StatusTag tone={projectTone(project.status)}>{project.status}</StatusTag>
              </div>

              <div className="mt-4">
                <Progress value={project.progress_pct} label={`${project.name} progress`} />
              </div>

              <p className="mt-3 text-ink-muted">{STAGE_DESCRIPTIONS[project.status]}</p>

              {project.current_stage ? (
                <p className="mt-2 rounded-control bg-surface-muted px-2.5 py-1.5 text-xs text-ink">
                  {project.current_stage}
                </p>
              ) : null}

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-ink-muted">
                  {project.assigned_designer_name
                    ? `Your designer: ${project.assigned_designer_name}`
                    : 'Designer to be assigned'}
                  {' · updated '}
                  {relative(project.updated_at)}
                </p>
                {project.status === 'Approval' ? (
                  <Link to={`/projects/${project.id}`} className="text-link">
                    Review design
                  </Link>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
