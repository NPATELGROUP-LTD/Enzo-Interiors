import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { createPortal } from 'react-dom';
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
  Listbox,
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
import { useStages } from '@/hooks/useStages';
import { ApiError, api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { dateTime } from '@/lib/format';
import { projectTone } from '@/lib/status';
import type { Client, Project, ProjectStage, ServiceType } from '@/types/api';
import { SERVICE_LABELS, SERVICE_TYPES } from '@/types/api';

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
  stages,
  onMove,
  onToggleVisible,
}: {
  project: Project;
  stages: ProjectStage[];
  /** Admin and Designer; absent for an Installer, who asks on the project page. */
  onMove?: (project: Project, stage: ProjectStage) => void;
  /** Admin only; absent for Designers. */
  onToggleVisible?: (project: Project) => void;
}) {
  // The card itself never moves: DragOverlay draws the moving copy above the
  // page, so the board's scroll box cannot clip it. This one stays as the slot.
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: project.id, disabled: !onMove });

  return (
    <div
      ref={setNodeRef}
      className={clsx('rounded-[12px] bg-surface p-3 shadow-soft', isDragging && 'opacity-40')}
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
        className={clsx(onMove && 'cursor-grab touch-manipulation active:cursor-grabbing')}
      >
        <CardTitle project={project} />
      </div>

      <div className="mt-3">
        <Progress value={project.progress_pct} label={`${project.name} progress`} />
      </div>

      <p className="mt-2 text-xs text-ink-muted">{crew(project)}</p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {/*
          The brief requires a "Move to…" control alongside drag-and-drop, so
          the board is operable by keyboard and by anyone who cannot drag.
        */}
        {onMove ? (
          <Listbox
            value={project.status}
            onChange={(event) => onMove(project, event.target.value as ProjectStage)}
            aria-label={`Move ${project.name} to another stage`}
            className="min-w-28 flex-1 text-xs max-sm:basis-full"
          >
            {stages.map((stage) => (
              <option key={stage} value={stage}>
                {stage === project.status ? stage : `Move to ${stage}`}
              </option>
            ))}
          </Listbox>
        ) : null}
        {onToggleVisible ? (
          <button
            type="button"
            onClick={() => onToggleVisible(project)}
            aria-label={
              project.client_visible
                ? `Visible: hide ${project.name} from the client portal`
                : `Hidden: show ${project.name} in the client portal`
            }
            className={clsx(
              'flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-control bg-ink/[0.05] px-3 text-xs font-medium transition-colors hover:bg-ink/[0.09]',
              project.client_visible ? 'text-success' : 'text-ink-muted',
            )}
          >
            {project.client_visible ? (
              <Eye size={14} aria-hidden="true" />
            ) : (
              <EyeSlash size={14} aria-hidden="true" />
            )}
            {project.client_visible ? 'Visible' : 'Hidden'}
          </button>
        ) : null}
      </div>

      <Link to={`/projects/${project.id}`} className="text-link mt-2 inline-block text-xs">
        Open project
      </Link>
    </div>
  );
}

function CardTitle({ project }: { project: Project }) {
  return (
    <>
      <p className="font-semibold leading-snug text-ink">{project.name}</p>
      <p className="mt-0.5 text-xs text-ink-muted">
        {project.client_name} · {SERVICE_LABELS[project.type]}
      </p>
    </>
  );
}

function Column({
  stage,
  stages,
  projects,
  onMove,
  onToggleVisible,
}: {
  stage: ProjectStage;
  stages: ProjectStage[];
  projects: Project[];
  onMove?: (project: Project, stage: ProjectStage) => void;
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
              stages={stages}
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

/** Staff as Settings › Users lists them; Designers and Installers are assigned to projects. */
export interface StaffOption {
  id: string;
  name: string;
  role: string;
}

/**
 * The New project dialog: on the Projects screen (choose the client) and on a
 * client's page (client fixed). Projects start at the first stage, hidden from
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
      toast.success(`${created.name} created at ${created.status}.`);
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
      description="It starts at the first stage, hidden from the client portal until you send it."
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
  return useMemo(() => (staff.data ?? []).filter((member) => member.role === 'Designer' || member.role === 'Installer'), [staff.data]);
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
  const navigate = useNavigate();
  const { isAdmin, can } = useAuth();
  const projects = useQuery<Project[]>('/projects');
  const clients = useQuery<Client[]>(isAdmin ? '/clients' : null);
  const designers = useDesigners(isAdmin);
  const { names: stages, stages: stageList } = useStages();

  const [params, setParams] = useSearchParams();
  // A phone opens the list: the board's wide columns are a long sideways swipe.
  const view: View =
    PROJECT_VIEWS.find(({ id }) => id === params.get('view'))?.id ??
    (window.matchMedia('(max-width: 639px)').matches ? 'list' : 'board');
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

  // A mouse must travel 6px before a drag begins, so a click on the card's
  // links and selects is not misread as the start of a drag. On touch a drag
  // needs a short press, so a swipe still scrolls the board.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
  );
  const [dragging, setDragging] = useState<Project | null>(null);

  const byStage = useMemo(() => {
    const grouped: Record<ProjectStage, Project[]> = Object.fromEntries(stages.map((stage) => [stage, []]));
    for (const project of projects.data ?? []) grouped[project.status]?.push(project);
    return grouped;
  }, [projects.data, stages]);

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
    setDragging(null);
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
          onChange={(id) => update({ view: id })}
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
        <DndContext
          sensors={sensors}
          onDragStart={(event) => setDragging(rows.find((entry) => entry.id === event.active.id) ?? null)}
          onDragEnd={onDragEnd}
          onDragCancel={() => setDragging(null)}
        >
          {/* The board scrolls horizontally inside its own container so the
              page body never scrolls sideways on narrow screens. */}
          <div className="flex gap-3 overflow-x-auto pb-2">
            {stages.map((stage) => (
              <Column
                key={stage}
                stage={stage}
                stages={stages}
                projects={byStage[stage] ?? []}
                onMove={can('Admin', 'Designer') ? moveProject : undefined}
                onToggleVisible={isAdmin ? toggleVisible : undefined}
              />
            ))}
          </div>
          {createPortal(
            <DragOverlay>
              {dragging ? (
                <div className="cursor-grabbing rounded-[12px] bg-surface p-3 shadow-overlay">
                  <CardTitle project={dragging} />
                </div>
              ) : null}
            </DragOverlay>,
            document.body,
          )}
        </DndContext>
      ) : (
        <TableWrap className="max-sm:min-w-0">
          <thead>
            <tr>
              <Th>Project</Th>
              <Th className="max-sm:hidden">Client</Th>
              <Th>Stage</Th>
              <Th className="max-sm:hidden">Team</Th>
              <Th className="max-sm:hidden">Progress</Th>
              <Th className="max-sm:hidden">Client sees</Th>
              <Th className="max-sm:hidden">Updated</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((project) => (
              <tr
                key={project.id}
                className="cursor-pointer hover:bg-surface-muted/40"
                onClick={(event) => {
                  if (!(event.target as HTMLElement).closest('a, button')) navigate(`/projects/${project.id}`);
                }}
              >
                <Td>
                  <Link to={`/projects/${project.id}`} className="text-link">
                    {project.name}
                  </Link>
                  <p className="text-xs text-ink-muted">
                    <span className="sm:hidden">{project.client_name} · </span>
                    {SERVICE_LABELS[project.type]}
                  </p>
                </Td>
                <Td className="text-ink max-sm:hidden">{project.client_name}</Td>
                <Td>
                  <StatusTag tone={projectTone(project.status, stageList)}>{project.status}</StatusTag>
                </Td>
                <Td className="text-ink-muted max-sm:hidden">{crew(project)}</Td>
                <Td className="min-w-36 max-sm:hidden">
                  <Progress value={project.progress_pct} label={`${project.name} progress`} />
                </Td>
                <Td className="max-sm:hidden">
                  <StatusTag tone={project.client_visible ? 'success' : 'neutral'}>
                    {project.client_visible ? 'Visible' : 'Hidden'}
                  </StatusTag>
                </Td>
                <Td className="whitespace-nowrap text-xs text-ink-muted max-sm:hidden">
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
