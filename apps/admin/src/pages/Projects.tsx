import {
  DndContext,
  DragOverlay,
  MouseSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { DotsThree, MagnifyingGlass, Plus } from '@phosphor-icons/react';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { PROJECT_VIEWS } from '@/components/layout/AdminLayout';
import {
  Button,
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
  Tabs,
  Td,
  Th,
} from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useQuery } from '@/hooks/useApi';
import { useSort } from '@/hooks/useSort';
import { useStages } from '@/hooks/useStages';
import { ApiError, api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { dateTime, initials, refNo } from '@/lib/format';
import { projectTone } from '@/lib/status';
import type { Client, Project, ProjectStage, ServiceType } from '@/types/api';
import { SERVICE_LABELS, SERVICE_TYPES } from '@/types/api';

type View = (typeof PROJECT_VIEWS)[number]['id'];

/** The people on a project as the card and the list show them: the designer, then the installer. */
function crewNames(project: Project): string[] {
  return [project.assigned_designer_name, project.assigned_installer_name].filter(
    (name, index, all): name is string => Boolean(name) && all.indexOf(name) === index,
  );
}

/** Who works on a project, in words (the list). */
function crew(project: Project): string {
  const names = crewNames(project);
  return names.length > 0 ? names.join(', ') : 'Unassigned';
}

/* -------------------------------------------------------------------------- */
/* Kanban card                                                                */
/* -------------------------------------------------------------------------- */

/** Overlapping initials; the names are the label for a screen reader and the hover. */
function Crew({ project }: { project: Project }) {
  const names = crewNames(project);
  if (names.length === 0) return <span className="text-[11px] text-ink-muted">Unassigned</span>;
  return (
    <span role="img" aria-label={`Team: ${names.join(', ')}`} title={names.join(', ')} className="flex -space-x-1.5">
      {names.map((name) => (
        <span
          key={name}
          aria-hidden="true"
          className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-[10px] font-bold text-green-900 ring-2 ring-surface"
        >
          {initials(name)}
        </span>
      ))}
    </span>
  );
}

/** Title, client, service tag, team initials and a thin progress line. */
function CardBody({ project }: { project: Project }) {
  return (
    <>
      <p className="pr-7 font-semibold leading-snug text-ink pointer-coarse:pr-10">
        <Link to={`/projects/${project.id}`} className="hover:underline">
          {project.name}
        </Link>
      </p>
      <p className="mt-0.5 truncate text-xs text-ink-muted">{project.client_name}</p>
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <span className="rounded-full bg-ink/[0.06] px-2 py-0.5 text-[11px] font-semibold text-ink-muted">
          {SERVICE_LABELS[project.type]}
        </span>
        <Crew project={project} />
      </div>
      <div
        role="progressbar"
        aria-valuenow={project.progress_pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${project.name} progress`}
        className="mt-3 h-0.5 overflow-hidden rounded-full bg-ink/10"
      >
        <div className="h-full bg-green-900" style={{ width: `${project.progress_pct}%` }} />
      </div>
    </>
  );
}

/**
 * The card's ⋯ menu: open the project, or (Admin, Designer) "Move to…" a stage.
 * That is how a phone moves a card, since nothing is dragged there. The list is
 * drawn above the page, so the board's scroll box cannot clip it.
 */
function CardMenu({
  project,
  stages,
  onMove,
}: {
  project: Project;
  stages: ProjectStage[];
  onMove?: (project: Project, stage: ProjectStage) => void;
}) {
  const navigate = useNavigate();
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);
  const [moving, setMoving] = useState(false);

  useEffect(() => {
    if (!at) return;
    const close = () => {
      setAt(null);
      setMoving(false);
    };
    const away = (event: PointerEvent) => {
      if (!(event.target as Element).closest('[data-card-menu]')) close();
    };
    const escape = (event: KeyboardEvent) => event.key === 'Escape' && close();
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', escape);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', escape);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [at]);

  const item =
    'flex min-h-11 w-full items-center rounded-[8px] px-3 text-left text-sm text-ink hover:bg-ink/[0.06] pointer-fine:min-h-8';

  return (
    <>
      <button
        type="button"
        data-card-menu
        aria-label={`Actions for ${project.name}`}
        aria-haspopup="menu"
        aria-expanded={at !== null}
        // Not the start of a drag, and not a click on the card.
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          if (at) return setAt(null);
          const box = event.currentTarget.getBoundingClientRect();
          setAt({ top: box.bottom + 4, left: Math.max(8, Math.min(box.right - 208, window.innerWidth - 216)) });
        }}
        className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-control text-ink-muted hover:bg-ink/[0.07] hover:text-ink pointer-coarse:h-10 pointer-coarse:w-10"
      >
        <DotsThree size={20} weight="bold" aria-hidden="true" />
      </button>
      {at
        ? createPortal(
            <div
              data-card-menu
              role="menu"
              style={{ top: at.top, left: at.left }}
              onMouseDown={(event) => event.stopPropagation()}
              className="fixed z-50 max-h-[70vh] w-52 overflow-y-auto rounded-card bg-surface p-1.5 shadow-overlay ring-1 ring-border"
            >
              {moving ? (
                <>
                  <p className="label-eyebrow px-3 pb-1 pt-1.5">Move to…</p>
                  {stages.map((stage) => (
                    <button
                      key={stage}
                      type="button"
                      role="menuitem"
                      disabled={stage === project.status}
                      onClick={() => {
                        setAt(null);
                        setMoving(false);
                        onMove?.(project, stage);
                      }}
                      className={clsx(item, 'disabled:font-semibold disabled:text-ink-muted disabled:hover:bg-transparent')}
                    >
                      {stage}
                      {stage === project.status ? <span className="ml-auto text-xs font-normal">now</span> : null}
                    </button>
                  ))}
                </>
              ) : (
                <>
                  <button type="button" role="menuitem" className={item} onClick={() => navigate(`/projects/${project.id}`)}>
                    Open project
                  </button>
                  {onMove ? (
                    <button type="button" role="menuitem" className={item} onClick={() => setMoving(true)}>
                      Move to…
                    </button>
                  ) : null}
                </>
              )}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function ProjectCard({
  project,
  stages,
  onMove,
}: {
  project: Project;
  stages: ProjectStage[];
  /** Admin and Designer; absent for an Installer, who asks on the project page. */
  onMove?: (project: Project, stage: ProjectStage) => void;
}) {
  const navigate = useNavigate();
  // The card itself never moves: DragOverlay draws the moving copy above the
  // page, so the board's scroll box cannot clip it. This one stays as the slot.
  const { listeners, setNodeRef, isDragging } = useDraggable({ id: project.id, disabled: !onMove });
  const dragged = useRef(false);
  useEffect(() => {
    if (isDragging) dragged.current = true;
  }, [isDragging]);

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      // A drag starts anywhere on the card (after 6px, so a click still opens it).
      onMouseDown={(event) => {
        dragged.current = false;
        listeners?.onMouseDown?.(event);
      }}
      onClick={(event) => {
        if (dragged.current) return void (dragged.current = false);
        if (!(event.target as HTMLElement).closest('a, button')) navigate(`/projects/${project.id}`);
      }}
      className={clsx(
        'relative rounded-[12px] bg-surface p-3 shadow-soft transition-shadow hover:shadow-md',
        onMove ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
        isDragging && 'opacity-40',
      )}
    >
      <CardBody project={project} />
      <CardMenu project={project} stages={stages} onMove={onMove} />
    </div>
  );
}

function Column({
  stage,
  stages,
  projects,
  onMove,
}: {
  stage: ProjectStage;
  stages: ProjectStage[];
  projects: Project[];
  onMove?: (project: Project, stage: ProjectStage) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });

  return (
    <div
      ref={setNodeRef}
      className={clsx(
        'flex min-h-0 w-72 shrink-0 flex-col rounded-card p-2 transition-colors sm:w-auto sm:min-w-56 sm:flex-1',
        isOver ? 'bg-green-100' : 'bg-ink/[0.035]',
      )}
    >
      <div className="mb-2 flex shrink-0 items-center justify-between px-1">
        <h2 className="label-eyebrow">{stage}</h2>
        <span className="tabular text-xs font-semibold text-ink-muted">{projects.length}</span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
        {projects.length === 0 ? (
          <p className="rounded-[12px] px-3 py-6 text-center text-xs text-ink-muted">Nothing at this stage</p>
        ) : (
          projects.map((project) => <ProjectCard key={project.id} project={project} stages={stages} onMove={onMove} />)
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
  client?: { id: string; name: string; address?: string | null };
  clients?: Client[];
  designers?: StaffOption[];
}) {
  const toast = useToast();
  const navigate = useNavigate();
  // site_address null = not typed yet: the field shows the client's own address, which is what the API stores.
  const empty = { client_id: '', name: '', type: 'Kitchen' as ServiceType, assigned_designer_id: '', assigned_installer_id: '', site_address: null as string | null };
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
        ...(form.site_address !== null && { site_address: form.site_address }),
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

  const clientAddress = (client ?? clients.find((row) => row.id === form.client_id))?.address;

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

        <Input
          label="Site address"
          hint="Starts as the client’s address; change it if the work is somewhere else."
          value={form.site_address ?? clientAddress ?? ''}
          onChange={(event) => setForm({ ...form, site_address: event.target.value })}
          maxLength={300}
        />

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
 * The board of stages, and the same projects as a list. An Admin sees every
 * project, creates them and sends them to the client; a Designer sees the
 * projects they design or install and moves them between stages (the API
 * enforces both).
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
  const [search, setSearch] = useState('');

  // A mouse must travel 6px before a drag begins, so a click on a card still
  // opens it. Touch has no drag: a card's menu has "Move to…" for phones.
  const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 6 } }));
  const [dragging, setDragging] = useState<Project | null>(null);

  // ?stage=Design,Approval narrows the projects (the dashboard's pipeline links here).
  const stageFilter = (params.get('stage') ?? '').split(',').filter((name) => stages.includes(name));
  const all = projects.data ?? [];
  const rows = (() => {
    const term = search.trim().toLowerCase();
    return (projects.data ?? []).filter((project) => {
      if (stageFilter.length && !stageFilter.includes(project.status)) return false;
      if (!term) return true;
      return [project.name, project.client_name ?? '', refNo('PRJ', project.ref_no), SERVICE_LABELS[project.type], crew(project)]
        .join(' ')
        .toLowerCase()
        .includes(term);
    });
  })();

  const byStage = (() => {
    const grouped: Record<ProjectStage, Project[]> = Object.fromEntries(stages.map((stage) => [stage, []]));
    for (const project of rows) grouped[project.status]?.push(project);
    return grouped;
  })();

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

  const onDragEnd = (event: DragEndEvent) => {
    setDragging(null);
    const stage = event.over?.id as ProjectStage | undefined;
    if (!stage) return;
    const project = (projects.data ?? []).find((entry) => entry.id === event.active.id);
    if (project) void moveProject(project, stage);
  };

  const { rows: sortedRows, header } = useSort(rows, {
    name: (project) => project.name,
    client: (project) => project.client_name,
    stage: (project) => project.current_stage ?? project.status,
    progress: (project) => project.progress_pct,
    updated: (project) => project.updated_at,
  });

  const tall = 'pointer-coarse:min-h-12';

  return (
    <div className="mx-auto flex h-full max-w-[100rem] flex-col px-5 pb-5 pt-3 sm:px-8">
      {/* The shell's section name is not needed here; an empty heading keeps it from showing. */}
      <PageHeader title="" />

      <div className="mb-4 flex shrink-0 flex-wrap items-center gap-3">
        <div className="[&>div]:mb-0">
          <Tabs
            tabs={PROJECT_VIEWS.map(({ id, label }) => ({ id, label }))}
            active={view}
            onChange={(id) => update({ view: id })}
          />
        </div>
        <div className="relative min-w-0 basis-full sm:flex-1 sm:basis-0">
          <div className="relative mx-auto w-full sm:max-w-sm">
            <MagnifyingGlass
              size={16}
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
            />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search projects"
              aria-label="Search projects"
              className={`min-h-11 w-full rounded-control border border-border bg-surface pl-9 pr-3 text-ink placeholder:text-ink-muted/70 focus:border-green-900 pointer-fine:min-h-9 ${tall}`}
            />
          </div>
        </div>
        {isAdmin ? (
          <Button
            variant="primary"
            className={clsx(tall, 'max-sm:w-full')}
            icon={<Plus size={16} aria-hidden="true" />}
            onClick={openCreate}
          >
            New project
          </Button>
        ) : null}
      </div>

      {stageFilter.length ? (
        <p className="mb-3 shrink-0 text-sm text-ink-muted">
          Showing {stageFilter.join(' and ')} ({rows.length}).{' '}
          <button type="button" className="text-link" onClick={() => update({ stage: null })}>
            Show all
          </button>
        </p>
      ) : null}

      {projects.error ? (
        <ErrorState message={projects.error} onRetry={projects.refetch} />
      ) : projects.loading ? (
        <TableSkeleton rows={6} columns={5} />
      ) : all.length === 0 ? (
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
      ) : rows.length === 0 ? (
        <EmptyState
          title="No matching projects"
          message="Try a different search."
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setSearch('');
                update({ stage: null });
              }}
            >
              Show all projects
            </Button>
          }
        />
      ) : view === 'board' ? (
        <DndContext
          sensors={sensors}
          onDragStart={(event) => setDragging(rows.find((entry) => entry.id === event.active.id) ?? null)}
          onDragEnd={onDragEnd}
          onDragCancel={() => setDragging(null)}
        >
          {/* The board scrolls sideways inside its own box, and each column scrolls on its own,
              so the page body never moves on narrow screens. */}
          <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto pb-1">
            {stages.map((stage) => (
              <Column
                key={stage}
                stage={stage}
                stages={stages}
                projects={byStage[stage] ?? []}
                onMove={can('Admin', 'Designer') ? moveProject : undefined}
              />
            ))}
          </div>
          {createPortal(
            <DragOverlay>
              {dragging ? (
                <div className="relative w-60 cursor-grabbing rounded-[12px] bg-surface p-3 shadow-overlay">
                  <CardBody project={dragging} />
                </div>
              ) : null}
            </DragOverlay>,
            document.body,
          )}
        </DndContext>
      ) : (
        <TableWrap className="max-sm:min-w-0" wrapClassName="min-h-0 overflow-y-auto">
          <thead>
            <tr>
              <Th sort={header('name')}>Project</Th>
              <Th className="max-sm:hidden" sort={header('client')}>Client</Th>
              <Th sort={header('stage')}>Stage</Th>
              <Th className="max-sm:hidden">Team</Th>
              <Th className="max-sm:hidden" sort={header('progress')}>Progress</Th>
              <Th className="max-sm:hidden">Client sees</Th>
              <Th className="max-sm:hidden" sort={header('updated')}>Updated</Th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((project) => (
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
                    {refNo('PRJ', project.ref_no)} · {SERVICE_LABELS[project.type]}
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
