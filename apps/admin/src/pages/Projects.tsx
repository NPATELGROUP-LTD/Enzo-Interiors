import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import clsx from 'clsx';
import { Columns3, Eye, EyeOff, List, Plus } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  PageHeader,
  Progress,
  Select,
  StatusTag,
  TableSkeleton,
  TableWrap,
  Td,
  Th,
} from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useQuery } from '@/hooks/useApi';
import { ApiError, api } from '@/lib/api';
import { dateTime } from '@/lib/format';
import { projectTone } from '@/lib/status';
import type { Client, Project, ProjectStage, ServiceType, StaffUser } from '@/types/api';
import { PROJECT_STAGES, SERVICE_LABELS, SERVICE_TYPES } from '@/types/api';

/* -------------------------------------------------------------------------- */
/* Kanban card                                                                */
/* -------------------------------------------------------------------------- */

function ProjectCard({
  project,
  onMove,
  onToggleVisible,
}: {
  project: Project;
  onMove: (project: Project, stage: ProjectStage) => void;
  onToggleVisible: (project: Project) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: project.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined}
      className={clsx(
        'rounded-card border border-border bg-surface p-3',
        isDragging && 'opacity-50 shadow-overlay',
      )}
    >
      {/*
        Only this handle starts a drag. Making the whole card draggable would
        swallow clicks on the links and the Move-to select inside it.
      */}
      <div
        {...listeners}
        {...attributes}
        role="button"
        tabIndex={-1}
        aria-label={`Drag ${project.name}`}
        className="cursor-grab active:cursor-grabbing"
      >
        <p className="font-semibold leading-snug text-ink">{project.name}</p>
        <p className="mt-0.5 text-xs text-ink-muted">
          {project.client_name} · {SERVICE_LABELS[project.type]}
        </p>
      </div>

      <div className="mt-3">
        <Progress value={project.progress_pct} label={`${project.name} progress`} />
      </div>

      <p className="mt-2 text-xs text-ink-muted">
        {project.assigned_designer_name ?? 'Unassigned'}
      </p>

      <div className="mt-3 flex items-center gap-2">
        {/*
          The brief requires a "Move to…" control alongside drag-and-drop, so
          the board is operable by keyboard and by anyone who cannot drag.
        */}
        <select
          value={project.status}
          onChange={(event) => onMove(project, event.target.value as ProjectStage)}
          aria-label={`Move ${project.name} to another stage`}
          className="min-h-11 flex-1 rounded-control border border-border bg-surface px-2 text-xs text-ink focus:border-green-900"
        >
          {PROJECT_STAGES.map((stage) => (
            <option key={stage} value={stage}>
              Move to {stage}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => onToggleVisible(project)}
          aria-label={
            project.client_visible
              ? `Hide ${project.name} from the client portal`
              : `Show ${project.name} in the client portal`
          }
          title={project.client_visible ? 'Visible to client' : 'Hidden from client'}
          className={clsx(
            'flex min-h-11 min-w-11 items-center justify-center rounded-control border border-border transition-colors',
            project.client_visible ? 'text-success' : 'text-ink-muted',
          )}
        >
          {project.client_visible ? (
            <Eye size={14} aria-hidden="true" />
          ) : (
            <EyeOff size={14} aria-hidden="true" />
          )}
        </button>
      </div>

      <Link to={`/projects/${project.id}`} className="text-link mt-2 inline-block text-xs">
        Open project
      </Link>
    </div>
  );
}

function Column({
  stage,
  projects,
  onMove,
  onToggleVisible,
}: {
  stage: ProjectStage;
  projects: Project[];
  onMove: (project: Project, stage: ProjectStage) => void;
  onToggleVisible: (project: Project) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });

  return (
    <div
      ref={setNodeRef}
      className={clsx(
        'flex min-w-64 flex-1 flex-col rounded-card border bg-canvas p-2 transition-colors',
        isOver ? 'border-green-900' : 'border-border',
      )}
    >
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="label-eyebrow">{stage}</h2>
        <span className="tabular text-xs font-semibold text-ink-muted">{projects.length}</span>
      </div>
      <div className="flex flex-col gap-2">
        {projects.length === 0 ? (
          <p className="rounded-card border border-dashed border-border px-3 py-6 text-center text-xs text-ink-muted">
            Nothing at this stage
          </p>
        ) : (
          projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onMove={onMove}
              onToggleVisible={onToggleVisible}
            />
          ))
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export function ProjectsPage() {
  const toast = useToast();
  const projects = useQuery<Project[]>('/projects');
  const clients = useQuery<Client[]>('/clients');
  const staff = useQuery<StaffUser[]>('/staff');

  const [view, setView] = useState<'board' | 'list'>('board');
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({
    client_id: '',
    name: '',
    type: 'Kitchen' as ServiceType,
    assigned_designer_id: '',
    status: 'Consultation' as ProjectStage,
  });

  // A pointer must travel 6px before a drag begins, so a click on the card's
  // links and selects is not misread as the start of a drag.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const byStage = useMemo(() => {
    const grouped: Record<ProjectStage, Project[]> = {
      Consultation: [],
      Design: [],
      Approval: [],
      Installation: [],
      Completed: [],
    };
    for (const project of projects.data ?? []) grouped[project.status].push(project);
    return grouped;
  }, [projects.data]);

  const moveProject = async (project: Project, stage: ProjectStage) => {
    if (project.status === stage) return;

    // Optimistic: the board should feel immediate. Reverted on failure.
    const previous = projects.data ?? [];
    projects.setData(
      previous.map((entry) => (entry.id === project.id ? { ...entry, status: stage } : entry)),
    );

    try {
      await api.patch<Project>(`/projects/${project.id}/stage`, { status: stage });
      toast.success(`${project.name} moved to ${stage}.`);
      await projects.refetch();
    } catch (caught) {
      projects.setData(previous);
      toast.error(caught instanceof ApiError ? caught.message : 'Could not move that project.');
    }
  };

  const toggleVisible = async (project: Project) => {
    const next = !project.client_visible;
    const previous = projects.data ?? [];
    projects.setData(
      previous.map((entry) =>
        entry.id === project.id ? { ...entry, client_visible: next } : entry,
      ),
    );
    try {
      await api.put<Project>(`/projects/${project.id}`, { client_visible: next });
      toast.success(
        next
          ? `${project.name} is now visible in the client portal.`
          : `${project.name} is hidden from the client portal.`,
      );
    } catch (caught) {
      projects.setData(previous);
      toast.error(caught instanceof ApiError ? caught.message : 'Could not change visibility.');
    }
  };

  const onDragEnd = (event: DragEndEvent) => {
    const stage = event.over?.id as ProjectStage | undefined;
    if (!stage) return;
    const project = (projects.data ?? []).find((entry) => entry.id === event.active.id);
    if (project) void moveProject(project, stage);
  };

  const submitNew = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    if (!form.client_id) return setFormError('Choose a client.');
    if (form.name.trim().length < 2) return setFormError('Enter a project name.');

    setSaving(true);
    try {
      await api.post<Project>('/projects', {
        client_id: form.client_id,
        name: form.name.trim(),
        type: form.type,
        status: form.status,
        assigned_designer_id: form.assigned_designer_id || null,
      });
      toast.success(`${form.name.trim()} created.`);
      setCreating(false);
      setForm({ client_id: '', name: '', type: 'Kitchen', assigned_designer_id: '', status: 'Consultation' });
      await projects.refetch();
    } catch (caught) {
      setFormError(caught instanceof ApiError ? caught.message : 'Could not create this project.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Projects"
        description="Five-stage pipeline from consultation through to completion."
        actions={
          <>
            <div className="flex rounded-control border border-border" role="group" aria-label="View mode">
              <button
                type="button"
                onClick={() => setView('board')}
                aria-pressed={view === 'board'}
                className={clsx(
                  'flex min-h-11 items-center gap-1.5 rounded-l-control px-3 text-sm font-semibold transition-colors',
                  view === 'board' ? 'bg-green-100 text-green-900' : 'text-ink-muted hover:text-ink',
                )}
              >
                <Columns3 size={15} aria-hidden="true" />
                Board
              </button>
              <button
                type="button"
                onClick={() => setView('list')}
                aria-pressed={view === 'list'}
                className={clsx(
                  'flex min-h-11 items-center gap-1.5 rounded-r-control border-l border-border px-3 text-sm font-semibold transition-colors',
                  view === 'list' ? 'bg-green-100 text-green-900' : 'text-ink-muted hover:text-ink',
                )}
              >
                <List size={15} aria-hidden="true" />
                List
              </button>
            </div>
            <Button variant="primary" icon={<Plus size={16} aria-hidden="true" />} onClick={() => setCreating(true)}>
              New project
            </Button>
          </>
        }
      />

      {projects.error ? (
        <ErrorState message={projects.error} onRetry={projects.refetch} />
      ) : projects.loading ? (
        <Card className="p-0">
          <TableSkeleton rows={6} columns={5} />
        </Card>
      ) : (projects.data ?? []).length === 0 ? (
        <Card className="p-0">
          <EmptyState
            title="No projects yet"
            message="Create a project to start tracking it through the pipeline."
            action={
              <Button variant="primary" onClick={() => setCreating(true)}>
                New project
              </Button>
            }
          />
        </Card>
      ) : view === 'board' ? (
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          {/* The board scrolls horizontally inside its own container so the
              page body never scrolls sideways on narrow screens. */}
          <div className="flex gap-3 overflow-x-auto pb-2">
            {PROJECT_STAGES.map((stage) => (
              <Column
                key={stage}
                stage={stage}
                projects={byStage[stage]}
                onMove={moveProject}
                onToggleVisible={toggleVisible}
              />
            ))}
          </div>
        </DndContext>
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <Th>Project</Th>
              <Th>Client</Th>
              <Th>Stage</Th>
              <Th>Designer</Th>
              <Th>Progress</Th>
              <Th>Client sees</Th>
              <Th>Updated</Th>
            </tr>
          </thead>
          <tbody>
            {(projects.data ?? []).map((project) => (
              <tr key={project.id} className="hover:bg-surface-muted/40">
                <Td>
                  <Link to={`/projects/${project.id}`} className="text-link">
                    {project.name}
                  </Link>
                  <p className="text-xs text-ink-muted">{SERVICE_LABELS[project.type]}</p>
                </Td>
                <Td className="text-ink">{project.client_name}</Td>
                <Td>
                  <StatusTag tone={projectTone(project.status)}>{project.status}</StatusTag>
                </Td>
                <Td className="text-ink-muted">{project.assigned_designer_name ?? 'Unassigned'}</Td>
                <Td className="min-w-36">
                  <Progress value={project.progress_pct} label={`${project.name} progress`} />
                </Td>
                <Td>
                  <StatusTag tone={project.client_visible ? 'success' : 'neutral'}>
                    {project.client_visible ? 'Visible' : 'Hidden'}
                  </StatusTag>
                </Td>
                <Td className="whitespace-nowrap text-xs text-ink-muted">
                  {dateTime(project.updated_at)}
                </Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="New project"
        description="Projects start at Consultation unless you choose otherwise."
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreating(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" form="project-form" variant="primary" loading={saving}>
              Create project
            </Button>
          </>
        }
      >
        <form id="project-form" onSubmit={submitNew} className="flex flex-col gap-4" noValidate>
          <Select
            label="Client"
            value={form.client_id}
            onChange={(event) => setForm({ ...form, client_id: event.target.value })}
            required
          >
            <option value="">Choose a client…</option>
            {(clients.data ?? []).map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </Select>

          <Input
            label="Project name"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            placeholder="Stoneygate Kitchen Renovation"
            required
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Service type"
              value={form.type}
              onChange={(event) => setForm({ ...form, type: event.target.value as ServiceType })}
            >
              {SERVICE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {SERVICE_LABELS[type]}
                </option>
              ))}
            </Select>
            <Select
              label="Starting stage"
              value={form.status}
              onChange={(event) => setForm({ ...form, status: event.target.value as ProjectStage })}
            >
              {PROJECT_STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {stage}
                </option>
              ))}
            </Select>
          </div>

          <Select
            label="Assign designer"
            value={form.assigned_designer_id}
            onChange={(event) => setForm({ ...form, assigned_designer_id: event.target.value })}
          >
            <option value="">Unassigned</option>
            {(staff.data ?? []).map((member) => (
              <option key={member.id} value={member.id}>
                {member.name} · {member.role}
              </option>
            ))}
          </Select>

          {formError ? (
            <p role="alert" className="rounded-control border border-danger/30 bg-danger-bg px-3 py-2 text-danger">
              {formError}
            </p>
          ) : null}
        </form>
      </Modal>
    </>
  );
}
