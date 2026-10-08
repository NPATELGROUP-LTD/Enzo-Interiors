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
import { Eye, EyeSlash, Plus } from '@phosphor-icons/react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { PROJECT_VIEWS } from '@/components/layout/AdminLayout';
import {
  Button,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  Progress,
  Select,
  StatusTag,
  TableSkeleton,
  TableWrap,
  Tabs,
  Td,
  Th,
} from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useQuery } from '@/hooks/useApi';
import { ApiError, api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { dateTime } from '@/lib/format';
import { projectTone } from '@/lib/status';
import type { Client, Project, ProjectStage, ServiceType } from '@/types/api';
import { PROJECT_STAGES, SERVICE_LABELS, SERVICE_TYPES } from '@/types/api';

type View = (typeof PROJECT_VIEWS)[number]['id'];

/** Who works on a project, as the card and the list show it. */
function crew(project: Project): string {
  const names = [
    project.assigned_designer_name,
    project.assigned_installer_name && project.assigned_installer_name !== project.assigned_designer_name
      ? `${project.assigned_installer_name} (installer)`
      : null,
  ].filter(Boolean);
  return names.length > 0 ? names.join(', ') : 'Unassigned';
}

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
  /** Admin only; absent for Designers. */
  onToggleVisible?: (project: Project) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: project.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined}
      className={clsx(
        'rounded-[12px] bg-surface p-3 shadow-soft',
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

      <p className="mt-2 text-xs text-ink-muted">{crew(project)}</p>

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
        {onToggleVisible ? (
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
              'flex min-h-11 min-w-11 items-center justify-center rounded-control bg-ink/[0.05] transition-colors hover:bg-ink/[0.09]',
              project.client_visible ? 'text-success' : 'text-ink-muted',
            )}
          >
            {project.client_visible ? (
              <Eye size={14} aria-hidden="true" />
            ) : (
              <EyeSlash size={14} aria-hidden="true" />
            )}
          </button>
        ) : null}
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
  onToggleVisible?: (project: Project) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });

  return (
    <div
      ref={setNodeRef}
      className={clsx(
        'flex min-w-64 flex-1 flex-col rounded-card p-2 transition-colors',
        isOver ? 'bg-green-100' : 'bg-ink/[0.035]',
      )}
    >
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="label-eyebrow">{stage}</h2>
        <span className="tabular text-xs font-semibold text-ink-muted">{projects.length}</span>
      </div>
      <div className="flex flex-col gap-2">
        {projects.length === 0 ? (
          <p className="rounded-[12px] px-3 py-6 text-center text-xs text-ink-muted">
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
/* New project (Admin)                                                        */
/* -------------------------------------------------------------------------- */

/** Staff as Settings › Users lists them; only Designers are assigned to projects. */
export interface StaffOption {
  id: string;
  name: string;
  role: string;
}

/**
 * The New project dialog: on the Projects screen (choose the client) and on a
 * client's page (client fixed). Projects start at Consultation, hidden from
 * the client portal until an Admin sends them.
 */
export function NewProjectDialog({
  open,
  onClose,
  client,
  clients = [],
  designers = [],
}: {
  open: boolean;
  onClose: () => void;
  /** Fixed client (from their page); otherwise the dialog asks. */
  client?: { id: string; name: string };
  clients?: Client[];
  designers?: StaffOption[];
}) {
  const toast = useToast();
  const navigate = useNavigate();
  const empty = { client_id: '', name: '', type: 'Kitchen' as ServiceType, assigned_designer_id: '', assigned_installer_id: '' };
  const [form, setForm] = useState(empty);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(empty);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const clientId = client?.id ?? form.client_id;
    if (!clientId) return setError('Choose a client.');
    if (form.name.trim().length < 2) return setError('Enter a project name.');

    setSaving(true);
    try {
      const created = await api.post<Project>('/projects', {
        client_id: clientId,
        name: form.name.trim(),
        type: form.type,
        assigned_designer_id: form.assigned_designer_id || null,
        assigned_installer_id: form.assigned_installer_id || null,
      });
      toast.success(`${created.name} created at Consultation.`);
      onClose();
      navigate(`/projects/${created.id}`);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not create this project.');
    } finally {
      setSaving(false);
    }
  };

  const assign = (field: 'assigned_designer_id' | 'assigned_installer_id', label: string) => (
    <Select label={label} value={form[field]} onChange={(event) => setForm({ ...form, [field]: event.target.value })}>
      <option value="">Unassigned</option>
      {designers.map((member) => (
        <option key={member.id} value={member.id}>
          {member.name}
        </option>
      ))}
    </Select>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={client ? `New project for ${client.name}` : 'New project'}
      description="It starts at Consultation, hidden from the client portal until you send it."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="project-form" variant="primary" loading={saving}>
            Create project
          </Button>
        </>
      }
    >
      <form id="project-form" onSubmit={submit} className="flex flex-col gap-4" noValidate>
        {client ? null : (
          <Select
            label="Client"
            value={form.client_id}
            onChange={(event) => setForm({ ...form, client_id: event.target.value })}
            required
          >
            <option value="">Choose a client…</option>
            {clients.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </Select>
        )}

        <Input
          label="Project name"
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
          placeholder="Stoneygate Kitchen Renovation"
          required
        />

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

        <div className="grid gap-4 sm:grid-cols-2">
          {assign('assigned_designer_id', 'Designer')}
          {assign('assigned_installer_id', 'Installer')}
        </div>

        {error ? (
          <p role="alert" className="rounded-control border border-danger/30 bg-danger-bg px-3 py-2 text-danger">
            {error}
          </p>
        ) : null}
      </form>
    </Modal>
  );
}

/** Settings › Users, cut down to the people a project can be assigned to. Admin only. */
export function useDesigners(enabled: boolean): StaffOption[] {
  const staff = useQuery<StaffOption[]>(enabled ? '/users' : null);
  return useMemo(() => (staff.data ?? []).filter((member) => member.role === 'Designer'), [staff.data]);
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * The five-stage board. An Admin sees every project, creates them and sends
 * them to the client; a Designer sees the projects they design or install and
 * moves them between stages (the API enforces both).
 */
export function ProjectsPage() {
  const toast = useToast();
  const { isAdmin } = useAuth();
  const projects = useQuery<Project[]>('/projects');
  const clients = useQuery<Client[]>(isAdmin ? '/clients' : null);
  const designers = useDesigners(isAdmin);

  const [params, setParams] = useSearchParams();
  const view: View = PROJECT_VIEWS.find(({ id }) => id === params.get('view'))?.id ?? 'board';
  const creating = isAdmin && params.get('new') === '1';
  /** Changes some of the address's parameters and keeps the rest (see Clients). */
  const update = (changes: Record<string, string | null>, replace = false) =>
    setParams(
      () => {
        const next = new URLSearchParams(window.location.search);
        for (const [key, value] of Object.entries(changes)) {
          if (value === null) next.delete(key);
          else next.set(key, value);
        }
        return next;
      },
      { replace },
    );
  const openCreate = () => update({ new: '1' });

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

  const rows = projects.data ?? [];

  return (
    <div className="px-5 pb-16 pt-6 sm:px-8 lg:pt-8">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <Tabs
          tabs={PROJECT_VIEWS.map(({ id, label }) => ({ id, label }))}
          active={view}
          onChange={(id) => update({ view: id === 'board' ? null : id })}
        />
        {isAdmin ? (
          <div className="mb-4">
            <Button variant="primary" icon={<Plus size={16} aria-hidden="true" />} onClick={openCreate}>
              New project
            </Button>
          </div>
        ) : null}
      </div>

      {projects.error ? (
        <ErrorState message={projects.error} onRetry={projects.refetch} />
      ) : projects.loading ? (
        <TableSkeleton rows={6} columns={5} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No projects yet"
          message={
            isAdmin
              ? 'Start one here, or from a client’s page, to track it from consultation to completed.'
              : 'Projects appear here once you are assigned to one as designer or installer.'
          }
          action={
            isAdmin ? (
              <Button variant="primary" onClick={openCreate}>
                New project
              </Button>
            ) : null
          }
        />
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
                onToggleVisible={isAdmin ? toggleVisible : undefined}
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
              <Th>Team</Th>
              <Th>Progress</Th>
              <Th>Client sees</Th>
              <Th>Updated</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((project) => (
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
                <Td className="text-ink-muted">{crew(project)}</Td>
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

      <NewProjectDialog
        open={creating}
        onClose={() => update({ new: null }, true)}
        clients={clients.data ?? []}
        designers={designers}
      />
    </div>
  );
}
