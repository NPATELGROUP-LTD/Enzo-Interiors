import { ArrowDown, ArrowUp, Plus, Trash } from '@phosphor-icons/react';
import clsx from 'clsx';
import { useEffect, useState } from 'react';

import { Button, ErrorState, FIELD_BASE, LoadingState } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useStages } from '@/hooks/useStages';
import { ApiError, api } from '@/lib/api';
import type { ProjectStageConfig } from '@/types/api';

/** A row being edited. `was` = the saved name it started as, so a rename moves its projects. */
type Row = ProjectStageConfig & { was?: string; key: number };

const INLINE_FIELD = FIELD_BASE.replace('w-full ', '');
const HELP = 'mt-1 text-sm leading-relaxed text-ink-muted';
const ICON_BUTTON =
  'flex h-9 w-9 items-center justify-center rounded-control text-ink-muted hover:bg-surface-muted hover:text-ink disabled:opacity-30';
let nextKey = 0;

/**
 * Settings › Project stages: the columns of the Projects board, in order.
 * Renaming a stage moves its projects with it; a stage that still holds
 * projects cannot be removed (the API says how many).
 */
export function ProjectStages() {
  const toast = useToast();
  const saved = useStages();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (saved.data) setRows(saved.data.map((stage) => ({ ...stage, was: stage.name, key: nextKey++ })));
  }, [saved.data]);

  if (saved.error) return <ErrorState message={saved.error} onRetry={saved.refetch} />;
  if (!rows || !saved.data) return <LoadingState label="Loading project stages…" />;

  const dirty = JSON.stringify(rows.map(({ name, progress, approval }) => ({ name, progress, approval }))) !== JSON.stringify(saved.data);
  // The first and last stage cannot ask, nor can one right after another that does (changes go back one stage).
  const mayApprove = (index: number) => index > 0 && index < rows.length - 1 && !rows[index - 1]!.approval && !rows[index + 1]!.approval;
  const set = (index: number, patch: Partial<Row>) => setRows(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const move = (index: number, by: number) => {
    const next = [...rows];
    [next[index], next[index + by]] = [next[index + by]!, next[index]!];
    setRows(next);
  };

  const save = async () => {
    setSaving(true);
    try {
      const stages = rows.map(({ name, progress, approval, was }) => ({ name, progress, approval, ...(was && { was }) }));
      saved.setData(await api.put<ProjectStageConfig[]>('/projects/stages', { stages }));
      toast.success('Project stages saved.');
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not save the stages.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-ink">Project stages</h2>
          <p className={clsx(HELP, 'max-w-[60ch]')}>
            The stages a project moves through, in order: the columns of the Projects board and the client’s
            timeline. The last stage is “done”. Renaming a stage moves its projects; a stage with projects in it
            cannot be removed.
          </p>
        </div>
        <Button variant="primary" onClick={save} loading={saving} disabled={!dirty}>
          Save changes
        </Button>
      </header>

      <ul className="mt-6 flex flex-col gap-2">
        {rows.map((row, index) => (
          <li key={row.key} className="flex flex-wrap items-center gap-2 rounded-[10px] bg-surface-muted/50 px-3 py-2">
            <span className="tabular w-5 text-sm text-ink-muted">{index + 1}</span>
            <input
              aria-label={`Stage ${index + 1} name`}
              value={row.name}
              maxLength={40}
              onChange={(event) => set(index, { name: event.target.value })}
              className={clsx(INLINE_FIELD, 'min-w-40 flex-1')}
            />
            <label className="flex items-center gap-1.5 text-sm text-ink-muted">
              <input
                type="number"
                min={0}
                max={100}
                aria-label={`${row.name || 'Stage'} progress`}
                value={row.progress}
                onChange={(event) => set(index, { progress: Math.round(Number(event.target.value)) })}
                className={clsx(INLINE_FIELD, 'tabular w-20')}
              />
              %
            </label>
            <label className="flex items-center gap-1.5 text-sm text-ink">
              <input
                type="checkbox"
                checked={row.approval}
                disabled={!row.approval && !mayApprove(index)}
                onChange={(event) => set(index, { approval: event.target.checked })}
              />
              Client approves
            </label>
            <div className="ml-auto flex items-center">
              <button type="button" className={ICON_BUTTON} disabled={index === 0} onClick={() => move(index, -1)} aria-label={`Move ${row.name} up`}>
                <ArrowUp size={16} aria-hidden="true" />
              </button>
              <button type="button" className={ICON_BUTTON} disabled={index === rows.length - 1} onClick={() => move(index, 1)} aria-label={`Move ${row.name} down`}>
                <ArrowDown size={16} aria-hidden="true" />
              </button>
              <button type="button" className={ICON_BUTTON} disabled={rows.length === 1} onClick={() => setRows(rows.filter((_, i) => i !== index))} aria-label={`Remove ${row.name}`}>
                <Trash size={16} aria-hidden="true" />
              </button>
            </div>
          </li>
        ))}
      </ul>

      <Button
        className="mt-4"
        icon={<Plus size={16} aria-hidden="true" />}
        disabled={rows.length >= 20}
        onClick={() => {
          // New stages go before the last ("done") one.
          const at = Math.max(0, rows.length - 1);
          setRows([...rows.slice(0, at), { name: '', progress: rows[at - 1]?.progress ?? 0, approval: false, key: nextKey++ }, ...rows.slice(at)]);
        }}
      >
        Add stage
      </Button>
      <p className={HELP}>
        Switch on “Client approves” for every stage where the client must decide: they approve (the project moves to the
        next stage) or ask for changes (it goes back one stage), so two such stages cannot sit next to each other. The % is
        the progress a project shows on entering the stage.
      </p>
    </div>
  );
}
