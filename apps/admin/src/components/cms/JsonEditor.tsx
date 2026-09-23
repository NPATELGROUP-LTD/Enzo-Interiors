import { ArrowDown, ArrowUp, CaretRight, Plus, Trash } from '@phosphor-icons/react';
import clsx from 'clsx';
import { useState } from 'react';

import { FIELD_BASE, Input, Select, Textarea, Toggle } from '@/components/ui';
import type { CollectionSchema, MediaAsset } from '@/types/cms';

import { fieldLabel, isTechnical } from './guide';
import { MediaField } from './MediaPicker';
import { blankLike, humanize, orderKeys, removeAt, setIn, summarize, type Path } from './paths';

export { humanize, removeAt, setIn, type Path };

/**
 * The form for one piece of content, generated from the content's own shape.
 *
 * See the API's modules/cms/schemas.ts for why there is no field-by-field
 * schema: every field of every page is editable from day one, and a paragraph
 * added to a page appears here without anyone touching this file.
 *
 * Visual rule: structure is shown with type and space, never with outlines.
 * A group is a heading over its fields; a list of things is a column of rows
 * that open in place. The only bordered shapes on screen are the inputs.
 */

export interface EditorContext {
  schema: CollectionSchema;
  assets: MediaAsset[];
  /** Selectable entries per collection, for the reference dropdowns. */
  options: Record<string, Array<{ slug: string; title: string }>>;
  showTechnical: boolean;
  onChange: (path: Path, value: unknown) => void;
  onRemove: (path: Path) => void;
  /** Re-reads the image library after an upload. */
  onAssetsChanged: () => void;
}

const label = (key: string) => fieldLabel(key, humanize);

/** "Heading lines" -> "heading line", for the Add button. */
function singular(text: string): string {
  const lower = text.toLowerCase();
  return lower.endsWith('s') && !lower.endsWith('ss') ? lower.slice(0, -1) : lower;
}

const TOKEN = /\{\w+\}/;

function IconButton({
  onClick,
  disabled,
  label: text,
  danger,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={text}
      title={text}
      className={clsx(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-[7px] text-ink-muted transition-colors',
        'hover:bg-ink/[0.07] hover:text-ink disabled:pointer-events-none disabled:opacity-30',
        'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring/35',
        danger && 'hover:bg-danger-bg hover:text-danger',
      )}
    >
      {children}
    </button>
  );
}

function AddButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-9 items-center gap-1.5 self-start rounded-[7px] px-2 text-sm font-semibold text-green-900 transition-colors hover:bg-green-100 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring/35"
    >
      <Plus size={14} aria-hidden="true" />
      {children}
    </button>
  );
}

function move<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item as T);
  return next;
}

/* -------------------------------------------------------------------------- */
/* Lists                                                                      */
/* -------------------------------------------------------------------------- */

/** A list of plain values — heading lines, features — as a column of inputs. */
function TextList({
  keyName,
  value,
  path,
  context,
}: {
  keyName: string;
  value: unknown[];
  path: Path;
  context: EditorContext;
}) {
  const name = label(keyName);
  const set = (next: unknown) => context.onChange(path, next);
  const numeric = typeof value[0] === 'number';

  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-sm font-semibold text-ink">{name}</legend>
      {value.map((item, index) => (
        <div key={index} className="group flex items-center gap-1">
          <input
            aria-label={`${name} ${index + 1}`}
            type={numeric ? 'number' : 'text'}
            value={String(item ?? '')}
            onChange={(event) =>
              context.onChange(
                [...path, index],
                numeric ? event.target.valueAsNumber || 0 : event.target.value,
              )
            }
            className={FIELD_BASE}
          />
          <IconButton
            label={`Move ${name} ${index + 1} up`}
            disabled={index === 0}
            onClick={() => set(move(value, index, index - 1))}
          >
            <ArrowUp size={14} aria-hidden="true" />
          </IconButton>
          <IconButton
            label={`Move ${name} ${index + 1} down`}
            disabled={index === value.length - 1}
            onClick={() => set(move(value, index, index + 1))}
          >
            <ArrowDown size={14} aria-hidden="true" />
          </IconButton>
          <IconButton
            label={`Remove ${name} ${index + 1}`}
            danger
            onClick={() => context.onRemove([...path, index])}
          >
            <Trash size={14} aria-hidden="true" />
          </IconButton>
        </div>
      ))}
      <AddButton onClick={() => set([...value, numeric ? 0 : ''])}>Add {singular(name)}</AddButton>
    </fieldset>
  );
}

/**
 * A list of things — process steps, price tiers, clauses — as rows that open
 * in place. Closed, each row is one line of its own words, so a long list
 * reads like a table of contents rather than a wall of forms.
 */
function ItemList({
  keyName,
  value,
  path,
  context,
  depth,
}: {
  keyName: string;
  value: unknown[];
  path: Path;
  context: EditorContext;
  depth: number;
}) {
  const name = label(keyName);
  const one = singular(name);
  const set = (next: unknown) => context.onChange(path, next);
  const [open, setOpen] = useState<number | null>(null);

  const shift = (from: number, to: number) => {
    set(move(value, from, to));
    if (open === from) setOpen(to);
    else if (open === to) setOpen(from);
  };

  return (
    <section className="flex flex-col gap-1.5">
      <h4 className="flex items-baseline gap-2 text-sm font-semibold text-ink">
        {name}
        <span className="tabular text-xs font-medium text-ink-muted">{value.length}</span>
      </h4>

      <ol className="flex flex-col gap-1">
        {value.map((item, index) => {
          const expanded = open === index;
          const title =
            summarize(item) || `${one.charAt(0).toUpperCase()}${one.slice(1)} ${index + 1}`;
          return (
            <li
              key={index}
              className={clsx(
                'rounded-[10px] transition-colors',
                expanded ? 'bg-ink/[0.035]' : 'hover:bg-ink/[0.035]',
              )}
            >
              <div className="flex items-center gap-1 pr-1">
                <button
                  type="button"
                  onClick={() => setOpen(expanded ? null : index)}
                  aria-expanded={expanded}
                  className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-[10px] px-2.5 text-left focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring/35 pointer-fine:min-h-10"
                >
                  <CaretRight
                    size={13}
                    aria-hidden="true"
                    className={clsx(
                      'shrink-0 text-ink-muted transition-transform',
                      expanded && 'rotate-90',
                    )}
                  />
                  <span className="tabular w-5 shrink-0 text-xs text-ink-muted">{index + 1}</span>
                  <span className="truncate text-sm text-ink">{title}</span>
                </button>
                <IconButton
                  label={`Move ${one} ${index + 1} up`}
                  disabled={index === 0}
                  onClick={() => shift(index, index - 1)}
                >
                  <ArrowUp size={14} aria-hidden="true" />
                </IconButton>
                <IconButton
                  label={`Move ${one} ${index + 1} down`}
                  disabled={index === value.length - 1}
                  onClick={() => shift(index, index + 1)}
                >
                  <ArrowDown size={14} aria-hidden="true" />
                </IconButton>
                <IconButton
                  label={`Remove ${one} ${index + 1}`}
                  danger
                  onClick={() => {
                    setOpen(null);
                    context.onRemove([...path, index]);
                  }}
                >
                  <Trash size={14} aria-hidden="true" />
                </IconButton>
              </div>
              {expanded ? (
                <div className="px-3 pb-4 pt-1 sm:pl-12">
                  {item !== null && typeof item === 'object' && !Array.isArray(item) ? (
                    <Fields
                      body={item as Record<string, unknown>}
                      path={[...path, index]}
                      context={context}
                      depth={depth + 1}
                    />
                  ) : (
                    <JsonField
                      keyName={one}
                      value={item}
                      path={[...path, index]}
                      context={context}
                      depth={depth + 1}
                    />
                  )}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>

      <AddButton
        onClick={() => {
          set([...value, value.length > 0 ? blankLike(value[0]) : '']);
          setOpen(value.length);
        }}
      >
        Add {one}
      </AddButton>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* One field                                                                  */
/* -------------------------------------------------------------------------- */

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
  const { schema, assets, options, onChange } = context;
  const name = label(keyName);
  const set = (next: unknown) => onChange(path, next);

  /* ---- Pictures ---- */
  if (schema.mediaKeys.includes(keyName)) {
    return (
      <MediaField
        label={name}
        value={typeof value === 'string' && value ? [value] : []}
        multiple={false}
        onChange={(next) => set(next[0] ?? '')}
        assets={assets}
        onAssetsChanged={context.onAssetsChanged}
      />
    );
  }
  if (schema.mediaListKeys.includes(keyName)) {
    return (
      <MediaField
        label={name}
        hint="The first picture is the cover. They show in the order you pick them."
        value={Array.isArray(value) ? (value as string[]) : []}
        multiple
        onChange={set}
        assets={assets}
        onAssetsChanged={context.onAssetsChanged}
      />
    );
  }

  /* ---- A pointer at another collection ---- */
  const referenceTo = schema.references[keyName];
  if (referenceTo) {
    const choices = options[referenceTo] ?? [];
    return (
      <Select
        label={name}
        value={typeof value === 'string' ? value : ''}
        onChange={(event) => set(event.target.value === '' ? null : event.target.value)}
        hint={
          schema.collection === 'faqs' && keyName === 'serviceId'
            ? 'Leave as "Every service page" to show this question on all four.'
            : undefined
        }
      >
        <option value="">{schema.collection === 'faqs' ? 'Every service page' : 'None'}</option>
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
        label={name}
        value={String(value ?? '')}
        readOnly
        disabled
        hint="Fixed, because the web address and other content refer to it."
      />
    );
  }

  /* ---- Single values ---- */
  if (typeof value === 'boolean') {
    return (
      <Toggle
        label={name}
        description={
          schema.publishFlagKey === keyName
            ? 'Off hides this from the website without deleting it.'
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
        label={name}
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
    const long = schema.longTextKeys.includes(keyName) || text.length > 90;
    const hint = TOKEN.test(text)
      ? 'Words in {curly brackets} are filled in by the website. Keep them exactly as they are.'
      : undefined;
    return long ? (
      <Textarea
        label={name}
        value={text}
        hint={hint}
        rows={Math.min(10, Math.max(3, Math.ceil(text.length / 80)))}
        onChange={(event) => set(event.target.value)}
      />
    ) : (
      <Input label={name} value={text} hint={hint} onChange={(event) => set(event.target.value)} />
    );
  }

  /* ---- Lists ---- */
  if (Array.isArray(value)) {
    const ofThings = value.some((item) => item !== null && typeof item === 'object');
    return ofThings ? (
      <ItemList keyName={keyName} value={value} path={path} context={context} depth={depth} />
    ) : (
      <TextList keyName={keyName} value={value} path={path} context={context} />
    );
  }

  /* ---- A group of fields ---- */
  return (
    <section className="flex flex-col gap-3 pt-2">
      <h4 className={clsx('font-semibold text-ink', depth === 0 ? 'text-base' : 'text-sm')}>
        {name}
      </h4>
      <div className={clsx(depth > 0 && 'sm:pl-4')}>
        <Fields
          body={value as Record<string, unknown>}
          path={path}
          context={context}
          depth={depth + 1}
        />
      </div>
    </section>
  );
}

/**
 * The fields of one object, in reading order, without the technical ones
 * unless they were asked for.
 *
 * `path` is where `body` sits inside the entry being edited: every `onChange`
 * path has to address the entry root, even when only one section is shown.
 */
export function Fields({
  body,
  path = [],
  context,
  depth = 0,
}: {
  body: Record<string, unknown>;
  path?: Path;
  context: EditorContext;
  depth?: number;
}) {
  const media = [...context.schema.mediaKeys, ...context.schema.mediaListKeys];
  const keys = orderKeys(body, media).filter((key) => context.showTechnical || !isTechnical(key));

  if (keys.length === 0) {
    return (
      <p className="text-sm text-ink-muted">
        Nothing to edit here unless technical fields are shown.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-5">
      {keys.map((key) => (
        <JsonField
          key={key}
          keyName={key}
          value={body[key]}
          path={[...path, key]}
          context={context}
          depth={depth}
        />
      ))}
    </div>
  );
}
