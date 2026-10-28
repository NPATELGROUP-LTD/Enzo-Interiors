import { ArrowDown, ArrowUp, Plus, Trash } from '@phosphor-icons/react';
import clsx from 'clsx';
import { useEffect, useState } from 'react';

import { Button, ErrorState, FIELD_BASE, LoadingState } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useQuery } from '@/hooks/useApi';
import { ApiError, api } from '@/lib/api';

type Row = { name: string; key: number };

const INLINE_FIELD = FIELD_BASE.replace('w-full ', '');
const HELP = 'mt-1 text-sm leading-relaxed text-ink-muted';
const ICON_BUTTON =
  'flex h-9 w-9 items-center justify-center rounded-control text-ink-muted hover:bg-surface-muted hover:text-ink disabled:opacity-30';
let nextKey = 0;

/**
 * Settings › Document categories: the labels a file is filed under when it is uploaded, and the
 * filter in the admin and the portal. Removing or renaming one changes only the choices on offer:
 * files already filed keep the label they have.
 */
export function DocumentCategories() {
  const toast = useToast();
  const saved = useQuery<string[]>('/documents/categories');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (saved.data) setRows(saved.data.map((name) => ({ name, key: nextKey++ })));
  }, [saved.data]);

  if (saved.error) return <ErrorState message={saved.error} onRetry={saved.refetch} />;
  if (!rows || !saved.data) return <LoadingState label="Loading document categories…" />;

  const names = rows.map((row) => row.name.trim());
  const dirty = JSON.stringify(names) !== JSON.stringify(saved.data);
  const set = (index: number, name: string) => setRows(rows.map((row, i) => (i === index ? { ...row, name } : row)));
  const move = (index: number, by: number) => {
    const next = [...rows];
    [next[index], next[index + by]] = [next[index + by]!, next[index]!];
    setRows(next);
  };

  const save = async () => {
    setSaving(true);
    try {
      saved.setData(await api.put<string[]>('/documents/categories', { categories: names }));
      toast.success('Document categories saved.');
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not save the categories.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-ink">Document categories</h2>
          <p className={clsx(HELP, 'max-w-[60ch]')}>
            What a file is filed under when it is uploaded, and what the Documents lists can be filtered by, here and in the
            client portal. Files already uploaded keep their label, so renaming or removing a category never loses one.
          </p>
        </div>
        <Button variant="primary" onClick={save} loading={saving} disabled={!dirty}>
          Save changes
        </Button>
      </header>

      <ul className="mt-6 flex flex-col gap-2">
        {rows.map((row, index) => (
          <li key={row.key} className="flex items-center gap-2 rounded-[10px] bg-surface-muted/50 px-3 py-2">
            <span className="tabular w-5 text-sm text-ink-muted">{index + 1}</span>
            <input
              aria-label={`Category ${index + 1} name`}
              value={row.name}
              maxLength={40}
              onChange={(event) => set(index, event.target.value)}
              className={clsx(INLINE_FIELD, 'min-w-0 flex-1')}
            />
            <button type="button" className={ICON_BUTTON} disabled={index === 0} onClick={() => move(index, -1)} aria-label={`Move ${row.name} up`}>
              <ArrowUp size={16} aria-hidden="true" />
            </button>
            <button type="button" className={ICON_BUTTON} disabled={index === rows.length - 1} onClick={() => move(index, 1)} aria-label={`Move ${row.name} down`}>
              <ArrowDown size={16} aria-hidden="true" />
            </button>
            <button type="button" className={ICON_BUTTON} disabled={rows.length === 1} onClick={() => setRows(rows.filter((_, i) => i !== index))} aria-label={`Remove ${row.name}`}>
              <Trash size={16} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>

      <Button
        className="mt-4"
        icon={<Plus size={16} aria-hidden="true" />}
        disabled={rows.length >= 30}
        onClick={() => setRows([...rows, { name: '', key: nextKey++ }])}
      >
        Add category
      </Button>
    </div>
  );
}
