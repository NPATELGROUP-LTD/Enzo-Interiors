import { ArrowDown, ArrowUp, CaretRight, Plus, Trash } from '@phosphor-icons/react';
import { useState } from 'react';

import { Button, Input, Select, Textarea, Toggle } from '@/components/ui';
import type { CollectionSchema, MediaAsset } from '@/types/cms';

import { MediaField } from './MediaPicker';
import { blankLike, humanize, removeAt, setIn, type Path } from './paths';

export { humanize, removeAt, setIn, type Path };

/* -------------------------------------------------------------------------- */
/* Field renderer                                                             */
/* -------------------------------------------------------------------------- */

export interface EditorContext {
  schema: CollectionSchema;
  assets: MediaAsset[];
  /** Selectable entries per collection, for the reference dropdowns. */
  options: Record<string, Array<{ slug: string; title: string }>>;
  onChange: (path: Path, value: unknown) => void;
  onRemove: (path: Path) => void;
}

/** A labelled group of nested fields, collapsible so a long page stays navigable. */
function Group({
  label,
  count,
  children,
  defaultOpen,
}: {
  label: string;
  count?: number;
  children: React.ReactNode;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-[10px] border border-border bg-surface-sunken/40">
      <button
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring/35"
      >
        <CaretRight
          size={14}
          aria-hidden="true"
          className={`shrink-0 text-ink-muted transition-transform ${open ? 'rotate-90' : ''}`}
        />
        <span className="text-sm font-semibold text-ink">{label}</span>
        {count !== undefined ? (
          <span className="tabular text-xs text-ink-muted">
            {count} {count === 1 ? 'item' : 'items'}
          </span>
        ) : null}
      </button>
      {open ? <div className="flex flex-col gap-4 border-t border-border px-3 py-3.5">{children}</div> : null}
    </section>
  );
}

export function JsonField({
  keyName,
  value,
  path,
  context,
  depth = 0,
}: {
  keyName: string;
  value: unknown;
  path: Path;
  context: EditorContext;
  depth?: number;
}) {
  const { schema, assets, options, onChange, onRemove } = context;
  const label = humanize(keyName);
  const set = (next: unknown) => onChange(path, next);

  /* ---- Media ---- */
  if (schema.mediaKeys.includes(keyName)) {
    return (
      <MediaField
        label={label}
        value={typeof value === 'string' && value ? [value] : []}
        multiple={false}
        onChange={(next) => set(next[0] ?? '')}
        assets={assets}
      />
    );
  }
  if (schema.mediaListKeys.includes(keyName)) {
    return (
      <MediaField
        label={label}
        hint="The first image is the one used as the cover."
        value={Array.isArray(value) ? (value as string[]) : []}
        multiple
        onChange={set}
        assets={assets}
      />
    );
  }

  /* ---- Reference to another collection ---- */
  const referenceTo = schema.references[keyName];
  if (referenceTo) {
    const choices = options[referenceTo] ?? [];
    return (
      <Select
        label={label}
        value={typeof value === 'string' ? value : ''}
        onChange={(event) => set(event.target.value === '' ? null : event.target.value)}
        hint={
          keyName === 'serviceId'
            ? 'Leave blank to show this on every service page rather than just one.'
            : undefined
        }
      >
        <option value="">None</option>
        {choices.map((choice) => (
          <option key={choice.slug} value={choice.slug}>
            {choice.title}
          </option>
        ))}
      </Select>
    );
  }

  /* ---- Locked ---- */
  if (schema.readonlyKeys.includes(keyName)) {
    return (
      <Input
        label={label}
        value={String(value ?? '')}
        readOnly
        disabled
        hint="Fixed, because the web address and other entries refer to it."
      />
    );
  }

  /* ---- Primitives ---- */
  if (typeof value === 'boolean') {
    return (
      <Toggle
        label={label}
        description={
          schema.publishFlagKey === keyName
            ? 'Off hides this from the public site without deleting it.'
            : undefined
        }
        checked={value}
        onChange={set}
      />
    );
  }

  if (typeof value === 'number') {
    return (
      <Input
        label={label}
        type="number"
        value={String(value)}
        onChange={(event) => {
          const next = event.target.valueAsNumber;
          // An empty box reads as NaN. Keeping the old number beats writing a
          // NaN into the content and rendering "NaN" on the public site.
          set(Number.isNaN(next) ? value : next);
        }}
      />
    );
  }

  if (value === null || typeof value === 'string') {
    const text = value ?? '';
    const long = schema.longTextKeys.includes(keyName) || text.length > 110;
    const Control = long ? Textarea : Input;
    return (
      <Control
        label={label}
        value={text}
        rows={long ? Math.min(10, Math.max(3, Math.ceil(text.length / 70))) : undefined}
        onChange={(event: { target: { value: string } }) => set(event.target.value)}
      />
    );
  }

  /* ---- Lists ---- */
  if (Array.isArray(value)) {
    const sample = value[0];
    const primitiveList = value.length === 0 || typeof sample !== 'object' || sample === null;

    return (
      <Group label={label} count={value.length} defaultOpen={depth < 1}>
        {value.length === 0 ? (
          <p className="text-xs text-ink-muted">Nothing here yet.</p>
        ) : null}

        {value.map((item, index) => (
          <div
            key={index}
            className="flex gap-2 rounded-[8px] border border-border bg-surface p-2.5"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              {primitiveList ? (
                <JsonField
                  keyName={`${keyName} ${index + 1}`}
                  value={item}
                  path={[...path, index]}
                  context={context}
                  depth={depth + 1}
                />
              ) : (
                Object.entries(item as Record<string, unknown>).map(([childKey, childValue]) => (
                  <JsonField
                    key={childKey}
                    keyName={childKey}
                    value={childValue}
                    path={[...path, index, childKey]}
                    context={context}
                    depth={depth + 1}
                  />
                ))
              )}
            </div>

            <div className="flex shrink-0 flex-col gap-1">
              <button
                type="button"
                onClick={() => {
                  if (index === 0) return;
                  const next = [...value];
                  [next[index - 1], next[index]] = [next[index], next[index - 1]];
                  set(next);
                }}
                disabled={index === 0}
                aria-label={`Move ${label} ${index + 1} up`}
                className="rounded-[6px] border border-border p-1.5 text-ink-muted transition hover:text-ink disabled:opacity-35"
              >
                <ArrowUp size={13} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (index === value.length - 1) return;
                  const next = [...value];
                  [next[index], next[index + 1]] = [next[index + 1], next[index]];
                  set(next);
                }}
                disabled={index === value.length - 1}
                aria-label={`Move ${label} ${index + 1} down`}
                className="rounded-[6px] border border-border p-1.5 text-ink-muted transition hover:text-ink disabled:opacity-35"
              >
                <ArrowDown size={13} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => onRemove([...path, index])}
                aria-label={`Remove ${label} ${index + 1}`}
                className="rounded-[6px] border border-border p-1.5 text-ink-muted transition hover:border-danger hover:text-danger"
              >
                <Trash size={13} aria-hidden="true" />
              </button>
            </div>
          </div>
        ))}

        <div>
          <Button
            variant="secondary"
            onClick={() => set([...value, value.length > 0 ? blankLike(sample) : ''])}
            icon={<Plus size={15} />}
          >
            Add
          </Button>
        </div>
      </Group>
    );
  }

  /* ---- Nested object ---- */
  const entries = Object.entries(value as Record<string, unknown>);
  return (
    <Group label={label} defaultOpen={depth < 1}>
      {entries.map(([childKey, childValue]) => (
        <JsonField
          key={childKey}
          keyName={childKey}
          value={childValue}
          path={[...path, childKey]}
          context={context}
          depth={depth + 1}
        />
      ))}
    </Group>
  );
}

/**
 * The whole editor for one content entry.
 *
 * Generated from the content's own shape rather than from a declared schema —
 * see the API's modules/cms/schemas.ts for why. The practical effect is that
 * every field of every page is editable here from day one, and stays editable
 * when a section gains a line of copy, without anyone touching this file.
 */
export function JsonEditor({
  body,
  context,
}: {
  body: Record<string, unknown>;
  context: EditorContext;
}) {
  return (
    <div className="flex flex-col gap-4">
      {Object.entries(body).map(([key, value]) => (
        <JsonField key={key} keyName={key} value={value} path={[key]} context={context} />
      ))}
    </div>
  );
}
