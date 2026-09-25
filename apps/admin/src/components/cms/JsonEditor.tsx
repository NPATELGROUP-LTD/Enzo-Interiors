import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CaretDown,
  CaretRight,
  LinkSimple,
  Plus,
  Trash,
} from '@phosphor-icons/react';
import clsx from 'clsx';
import { useId, useState, type CSSProperties, type ReactNode } from 'react';

import { Toggle } from '@/components/ui';
import type { CollectionSchema, MediaAsset } from '@/types/cms';

import { fieldLabel, isTechnical } from './guide';
import { MediaField } from './MediaPicker';
import {
  blankLike,
  buttonPairs,
  compactColumns,
  describe,
  humanize,
  isLinkKey,
  isSentenceList,
  orderKeys,
  removeAt,
  setIn,
  summarize,
  type Path,
} from './paths';

export { humanize, removeAt, setIn, type Path };

/**
 * The form for one piece of content, generated from the content's own shape.
 *
 * See the API's modules/cms/schemas.ts for why there is no field-by-field
 * schema: every field of every page is editable from day one, and a paragraph
 * added to a page appears here without anyone touching this file.
 *
 * The form is drawn to look like what it edits, so an editor recognises the
 * page rather than decoding a data structure: a heading is typed at heading
 * size, a button is a green pill with its link beside it, a line with a
 * highlighted word shows that word in green, and a short list (opening hours,
 * figures, footer links) is a table. Longer things — process steps, clauses —
 * are rows named by their own words that open in place.
 *
 * Visual rule: structure is shown with type and space, never with outlines.
 * Fields are soft fills with a hairline under them; nothing is boxed.
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

const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

const TOKEN = /\{\w+\}/;
const TOKEN_HINT =
  'Words in {curly brackets} are filled in by the website. Keep them exactly as they are.';

/* -------------------------------------------------------------------------- */
/* The field look                                                             */
/* -------------------------------------------------------------------------- */

// No width here: most fields fill their column, a heading line's parts size to their words.
const SOFT =
  'rounded-[9px] bg-ink/[0.045] px-3 text-ink shadow-[inset_0_-1px_0_var(--border)] outline-none ' +
  'transition-[background-color,box-shadow] duration-150 placeholder:text-ink-muted/70 ' +
  'hover:bg-ink/[0.07] focus:bg-surface focus:ring-2 focus:ring-focus-ring/70 disabled:opacity-60';

/** Text is typed at the size it is read at on the site, roughly. */
type Role = 'title' | 'text' | 'small';
const ROLE: Record<Role, string> = {
  title: 'min-h-11 py-2 text-[17px] font-semibold tracking-[-0.01em]',
  text: 'min-h-10 py-2 text-[14px]',
  small: 'min-h-9 py-1.5 text-[13px]',
};
const TITLE_KEY =
  /^(title|heading|headline|name|clientName|q|headingLead|headingAccent|lines|headingLines)$|(Heading|Title)$/;
const SMALL_KEY = /^(eyebrow|datum|cue|suffix)$/;
const roleOf = (key: string): Role =>
  TITLE_KEY.test(key) ? 'title' : SMALL_KEY.test(key) ? 'small' : 'text';

const LABEL = 'text-[13px] font-medium text-ink-muted';
const PART_HEADING = 'flex items-baseline gap-2 text-[15px] font-semibold text-ink';

function Count({ n }: { n: number }) {
  return <span className="tabular text-xs font-medium text-ink-muted">{n}</span>;
}

function Hint({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} className="text-xs leading-relaxed text-ink-muted">
      {children}
    </p>
  );
}

/** A web address: a link icon in front, so it never reads as a sentence. */
function LinkBox({
  id,
  value,
  onChange,
  ariaLabel,
  placeholder = '/page or https://…',
}: {
  id?: string;
  value: string;
  onChange: (next: string) => void;
  ariaLabel?: string;
  placeholder?: string;
}) {
  return (
    <span className="relative flex min-w-0 flex-1 items-center">
      <LinkSimple
        size={15}
        aria-hidden="true"
        className="pointer-events-none absolute left-3 text-ink-muted"
      />
      <input
        id={id}
        aria-label={ariaLabel}
        value={value}
        spellCheck={false}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={clsx(SOFT, 'w-full', ROLE.small, 'pl-9')}
      />
    </span>
  );
}

function TextField({
  keyName,
  value,
  long,
  onChange,
}: {
  keyName: string;
  value: string;
  long: boolean;
  onChange: (next: string) => void;
}) {
  const id = useId();
  const hint = TOKEN.test(value) ? TOKEN_HINT : undefined;
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={LABEL}>
        {label(keyName)}
      </label>
      {isLinkKey(keyName) ? (
        <LinkBox id={id} value={value} onChange={onChange} />
      ) : long ? (
        <textarea
          id={id}
          value={value}
          aria-describedby={hintId}
          // field-sizing grows the box with its words; rows is the fallback.
          rows={Math.min(8, Math.max(3, Math.ceil(value.length / 90)))}
          onChange={(event) => onChange(event.target.value)}
          className={clsx(SOFT, 'w-full', 'min-h-18 resize-y py-2.5 text-[14px] leading-relaxed [field-sizing:content]')}
        />
      ) : (
        <input
          id={id}
          value={value}
          aria-describedby={hintId}
          onChange={(event) => onChange(event.target.value)}
          className={clsx(SOFT, 'w-full', ROLE[roleOf(keyName)])}
        />
      )}
      {hint ? <Hint id={hintId}>{hint}</Hint> : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Row controls                                                               */
/* -------------------------------------------------------------------------- */

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
  children: ReactNode;
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

/**
 * Move up, move down, remove. Out of sight until the row is pointed at or
 * focused, so a list reads as its content; always shown on touch, which has
 * no hover.
 */
function RowControls({
  name,
  index,
  count,
  onMove,
  onRemove,
  className = 'flex opacity-0 group-focus-within/row:opacity-100 group-hover/row:opacity-100 pointer-coarse:opacity-100',
}: {
  name: string;
  index: number;
  count: number;
  onMove: (to: number) => void;
  onRemove: () => void;
  className?: string;
}) {
  return (
    <div className={clsx('shrink-0 items-center transition-opacity duration-150', className)}>
      <IconButton label={`Move ${name} ${index + 1} up`} disabled={index === 0} onClick={() => onMove(index - 1)}>
        <ArrowUp size={14} aria-hidden="true" />
      </IconButton>
      <IconButton
        label={`Move ${name} ${index + 1} down`}
        disabled={index === count - 1}
        onClick={() => onMove(index + 1)}
      >
        <ArrowDown size={14} aria-hidden="true" />
      </IconButton>
      <IconButton label={`Remove ${name} ${index + 1}`} danger onClick={onRemove}>
        <Trash size={14} aria-hidden="true" />
      </IconButton>
    </div>
  );
}

function AddButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-9 items-center gap-1.5 self-start rounded-[7px] px-2 text-sm font-semibold text-green-900 transition-colors hover:bg-green-100 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring/35 pointer-coarse:min-h-11"
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
/* Buttons                                                                    */
/* -------------------------------------------------------------------------- */

/** A button's words and where it goes, shown as the button itself. */
function ButtonPair({
  prefix,
  text,
  href,
  onText,
  onHref,
}: {
  prefix: string;
  text: string;
  href: string;
  onText: (next: string) => void;
  onHref: (next: string) => void;
}) {
  const kind = prefix === '' ? 'Link' : /cta|button/i.test(prefix) ? 'Button' : `${label(prefix)} button`;
  const isButton = kind !== 'Link';
  return (
    <fieldset className="flex min-w-0 flex-col gap-1.5">
      <legend className={clsx(LABEL, 'mb-1.5')}>{kind}</legend>
      <div className="flex flex-wrap items-center gap-2">
        <input
          aria-label={`${kind} text`}
          value={text}
          placeholder={isButton ? 'Button text' : 'Link text'}
          onChange={(event) => onText(event.target.value)}
          className={
            isButton
              ? 'min-h-10 w-auto min-w-36 max-w-full rounded-full bg-green-900 px-4 text-[14px] font-semibold text-on-primary outline-none transition-shadow [field-sizing:content] placeholder:text-on-primary/60 focus:ring-2 focus:ring-focus-ring focus:ring-offset-2 focus:ring-offset-surface'
              : clsx(SOFT, 'w-full', ROLE.text, 'sm:w-64 sm:flex-none')
          }
        />
        <ArrowRight size={15} aria-hidden="true" className="shrink-0 text-ink-muted" />
        <span className="flex min-w-48 flex-1">
          <LinkBox ariaLabel={`${kind} link`} value={href} onChange={onHref} />
        </span>
      </div>
    </fieldset>
  );
}

/* -------------------------------------------------------------------------- */
/* Lists                                                                      */
/* -------------------------------------------------------------------------- */

/** Lines of a heading with one highlighted word each, as the heading reads. */
function SentenceList({
  keyName,
  value,
  path,
  context,
}: {
  keyName: string;
  value: Array<Record<string, unknown>>;
  path: Path;
  context: EditorContext;
}) {
  const name = label(keyName);
  const set = (next: unknown) => context.onChange(path, next);
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className={clsx(PART_HEADING, 'mb-2')}>{name}</legend>
      {value.map((line, index) => (
        <div key={index} className="group/row flex items-center gap-1">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
            {(['lead', 'accent', 'tail'] as const).map((part) => (
              <input
                key={part}
                aria-label={`${name} ${index + 1}, ${label(part).toLowerCase()}`}
                title={label(part)}
                value={String(line[part] ?? '')}
                onChange={(event) => context.onChange([...path, index, part], event.target.value)}
                className={clsx(
                  SOFT,
                  ROLE.title,
                  'min-w-14 [field-sizing:content]',
                  part === 'accent' && 'italic text-green-900',
                )}
              />
            ))}
          </div>
          <RowControls
            name="line"
            index={index}
            count={value.length}
            onMove={(to) => set(move(value, index, to))}
            onRemove={() => context.onRemove([...path, index])}
          />
        </div>
      ))}
      <AddButton onClick={() => set([...value, { lead: '', accent: '', tail: '' }])}>Add line</AddButton>
      <Hint>Each line has three parts. The middle one, in italics, is the word the website highlights.</Hint>
    </fieldset>
  );
}

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
      <legend className={clsx(PART_HEADING, 'mb-2')}>{name}</legend>
      {value.map((item, index) => (
        <div key={index} className="group/row flex items-center gap-1">
          {isLinkKey(keyName) ? (
            <LinkBox
              ariaLabel={`${name} ${index + 1}`}
              value={String(item ?? '')}
              onChange={(next) => context.onChange([...path, index], next)}
            />
          ) : (
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
              className={clsx(SOFT, 'w-full', ROLE[roleOf(keyName)])}
            />
          )}
          <RowControls
            name={name}
            index={index}
            count={value.length}
            onMove={(to) => set(move(value, index, to))}
            onRemove={() => context.onRemove([...path, index])}
          />
        </div>
      ))}
      <AddButton onClick={() => set([...value, numeric ? 0 : ''])}>Add {singular(name)}</AddButton>
    </fieldset>
  );
}

/**
 * A short list of short things — opening hours, figures, links — as a table:
 * one row per item, one column per field, the labels said once at the top.
 */
function RowList({
  keyName,
  value,
  columns,
  path,
  context,
}: {
  keyName: string;
  value: Array<Record<string, unknown>>;
  columns: string[];
  path: Path;
  context: EditorContext;
}) {
  const name = label(keyName);
  const one = singular(name);
  const set = (next: unknown) => context.onChange(path, next);
  const numeric = new Set(columns.filter((column) => value.some((item) => typeof item[column] === 'number')));
  const grid = { gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` };

  return (
    <section className="flex flex-col gap-1.5">
      <h4 className={PART_HEADING}>
        {name}
        <Count n={value.length} />
      </h4>
      {/* The column labels. Phones stack the cells, so each says its own. */}
      <div aria-hidden="true" className="hidden items-center gap-1 sm:flex">
        <div className="grid flex-1 gap-1.5" style={grid}>
          {columns.map((column) => (
            <span key={column} className={clsx(LABEL, 'px-1')}>
              {label(column)}
            </span>
          ))}
        </div>
        <span className="w-24 shrink-0" />
      </div>
      {value.map((item, index) => (
        <div key={index} className="group/row flex items-center gap-1">
          <div className="grid flex-1 grid-cols-1 gap-1.5 sm:[grid-template-columns:var(--cols)]" style={{ '--cols': grid.gridTemplateColumns } as CSSProperties}>
            {columns.map((column) => {
              const aria = `${label(column)}, ${one} ${index + 1}`;
              const cell = item[column];
              return isLinkKey(column) ? (
                <LinkBox
                  key={column}
                  ariaLabel={aria}
                  placeholder={label(column)}
                  value={String(cell ?? '')}
                  onChange={(next) => context.onChange([...path, index, column], next)}
                />
              ) : (
                <input
                  key={column}
                  aria-label={aria}
                  placeholder={label(column)}
                  type={numeric.has(column) ? 'number' : 'text'}
                  value={String(cell ?? '')}
                  onChange={(event) => {
                    const next = numeric.has(column) ? event.target.valueAsNumber : event.target.value;
                    // An emptied number box reads as NaN; keep the old number.
                    context.onChange(
                      [...path, index, column],
                      typeof next === 'number' && Number.isNaN(next) ? cell : next,
                    );
                  }}
                  className={clsx(SOFT, 'w-full', ROLE.text)}
                />
              );
            })}
          </div>
          <RowControls
            name={one}
            index={index}
            count={value.length}
            onMove={(to) => set(move(value, index, to))}
            onRemove={() => context.onRemove([...path, index])}
          />
        </div>
      ))}
      <AddButton onClick={() => set([...value, blankLike(value[0] ?? {})])}>Add {one}</AddButton>
    </section>
  );
}

/** The first picture on a list item, for its row. */
function thumbnail(item: unknown, context: EditorContext): string | null {
  if (!item || typeof item !== 'object') return null;
  const record = item as Record<string, unknown>;
  const ids = [
    ...context.schema.mediaKeys.map((key) => record[key]),
    ...context.schema.mediaListKeys.map((key) => (Array.isArray(record[key]) ? record[key][0] : null)),
  ];
  for (const id of ids) {
    if (typeof id !== 'string' || !id) continue;
    const asset = context.assets.find((row) => row.id === id);
    if (asset && asset.mime_type !== 'application/pdf') return asset.src_resolved;
  }
  return null;
}

/**
 * A list of bigger things — process steps, price tiers, clauses — as rows
 * named by their own words that open in place, so a long list reads like a
 * table of contents rather than a wall of forms.
 */
function CardList({
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
  const controls = (index: number) => ({
    name: one,
    index,
    count: value.length,
    onMove: (to: number) => shift(index, to),
    onRemove: () => {
      setOpen(null);
      context.onRemove([...path, index]);
    },
  });

  return (
    <section className="flex flex-col gap-1.5">
      <h4 className={PART_HEADING}>
        {name}
        <Count n={value.length} />
      </h4>

      <ol className="flex flex-col gap-1.5">
        {value.map((item, index) => {
          const expanded = open === index;
          const title = summarize(item) || `${capital(one)} ${index + 1}`;
          const detail = describe(item, title);
          const picture = thumbnail(item, context);
          return (
            <li
              key={index}
              className={clsx(
                'group/row rounded-[12px] transition-colors',
                expanded ? 'bg-ink/[0.035]' : 'bg-ink/[0.02] hover:bg-ink/[0.045]',
              )}
            >
              <div className="flex items-center gap-1 pr-1.5">
                <button
                  type="button"
                  onClick={() => setOpen(expanded ? null : index)}
                  aria-expanded={expanded}
                  className="flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-[12px] px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring/35"
                >
                  {picture ? (
                    <img src={picture} alt="" className="h-10 w-14 shrink-0 rounded-[6px] object-cover" />
                  ) : (
                    <span className="tabular flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink/[0.06] text-xs font-semibold text-ink-muted">
                      {index + 1}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold text-ink">{title}</span>
                    {detail && !expanded ? (
                      <span className="block truncate text-[13px] text-ink-muted">{detail}</span>
                    ) : null}
                  </span>
                  <CaretDown
                    size={14}
                    aria-hidden="true"
                    className={clsx('shrink-0 text-ink-muted transition-transform', expanded && 'rotate-180')}
                  />
                </button>
                {/* Phones need the width for the title; there the controls
                    sit inside the opened row instead. */}
                <RowControls {...controls(index)} className="hidden opacity-0 group-focus-within/row:opacity-100 group-hover/row:opacity-100 pointer-coarse:opacity-100 sm:flex" />
              </div>
              {expanded ? (
                <div className="px-4 pb-5 pt-2 sm:pl-[3.25rem] sm:pr-6">
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
                  <div className="-ml-2 mt-4 sm:hidden">
                    <RowControls {...controls(index)} className="flex" />
                  </div>
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
    const everywhere = schema.collection === 'faqs' && keyName === 'serviceId';
    return (
      <SoftSelect
        label={name}
        value={typeof value === 'string' ? value : ''}
        onChange={(next) => set(next === '' ? null : next)}
        hint={everywhere ? 'Leave as "Every service page" to show this question on all four.' : undefined}
      >
        <option value="">{everywhere ? 'Every service page' : 'None'}</option>
        {choices.map((choice) => (
          <option key={choice.slug} value={choice.slug}>
            {choice.title}
          </option>
        ))}
      </SoftSelect>
    );
  }

  /* ---- Locked ---- */
  if (schema.readonlyKeys.includes(keyName)) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className={LABEL}>{name}</span>
        <input aria-label={name} value={String(value ?? '')} readOnly disabled className={clsx(SOFT, 'w-full', ROLE.small)} />
        <Hint>Fixed, because the web address and other content refer to it.</Hint>
      </div>
    );
  }

  /* ---- Single values ---- */
  if (typeof value === 'boolean') {
    return (
      <Toggle
        label={name}
        description={
          schema.publishFlagKey === keyName ? 'Off hides this from the website without deleting it.' : undefined
        }
        checked={value}
        onChange={set}
      />
    );
  }

  if (typeof value === 'number') {
    return <NumberField label={name} value={value} onChange={set} />;
  }

  if (value === null || typeof value === 'string') {
    const text = value ?? '';
    return (
      <TextField
        keyName={keyName}
        value={text}
        long={schema.longTextKeys.includes(keyName) || text.length > 90}
        onChange={set}
      />
    );
  }

  /* ---- Lists ---- */
  if (Array.isArray(value)) {
    if (isSentenceList(value)) {
      return (
        <SentenceList
          keyName={keyName}
          value={value as Array<Record<string, unknown>>}
          path={path}
          context={context}
        />
      );
    }
    if (!value.some((item) => item !== null && typeof item === 'object')) {
      return <TextList keyName={keyName} value={value} path={path} context={context} />;
    }
    const columns = compactColumns(
      value,
      (key) => context.showTechnical || !isTechnical(key),
      (key) =>
        ![...schema.mediaKeys, ...schema.mediaListKeys, ...schema.readonlyKeys].includes(key) &&
        !(key in schema.references),
    );
    return columns ? (
      <RowList
        keyName={keyName}
        value={value as Array<Record<string, unknown>>}
        columns={columns}
        path={path}
        context={context}
      />
    ) : (
      <CardList keyName={keyName} value={value} path={path} context={context} depth={depth} />
    );
  }

  /* ---- A group of fields ---- */
  return (
    <section className="flex flex-col gap-4">
      <h4 className={depth === 0 ? PART_HEADING : 'text-[13px] font-semibold text-ink'}>{name}</h4>
      <Fields body={value as Record<string, unknown>} path={path} context={context} depth={depth + 1} />
    </section>
  );
}

function NumberField({
  label: text,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={LABEL}>
        {text}
      </label>
      <input
        id={id}
        type="number"
        value={String(value)}
        onChange={(event) => {
          const next = event.target.valueAsNumber;
          // An empty box reads as NaN. Keeping the old number beats writing a
          // NaN into the content and rendering "NaN" on the public site.
          onChange(Number.isNaN(next) ? value : next);
        }}
        className={clsx(SOFT, 'w-full', ROLE.text, 'sm:max-w-48')}
      />
    </div>
  );
}

function SoftSelect({
  label: text,
  value,
  onChange,
  hint,
  children,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  hint?: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={LABEL}>
        {text}
      </label>
      <span className="relative flex sm:max-w-sm">
        <select
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={clsx(SOFT, 'w-full', ROLE.text, 'appearance-none pr-9')}
        >
          {children}
        </select>
        <CaretRight
          size={14}
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rotate-90 text-ink-muted"
        />
      </span>
      {hint ? <Hint>{hint}</Hint> : null}
    </div>
  );
}

/** A list or a group: a part of a section, which the outline can jump to. */
const isPart = (value: unknown) => value !== null && typeof value === 'object';

/**
 * The fields of one object, in reading order, without the technical ones
 * unless they were asked for.
 *
 * `path` is where `body` sits inside the entry being edited: every `onChange`
 * path has to address the entry root, even when only one section is shown.
 * `anchors` gives each part an id (`part-<key>`) for the outline to scroll to.
 */
export function Fields({
  body,
  path = [],
  context,
  depth = 0,
  anchors = false,
}: {
  body: Record<string, unknown>;
  path?: Path;
  context: EditorContext;
  depth?: number;
  anchors?: boolean;
}) {
  const media = [...context.schema.mediaKeys, ...context.schema.mediaListKeys];
  const keys = orderKeys(body, media).filter((key) => context.showTechnical || !isTechnical(key));

  // A button's words and its link are one thing on the site, so one here.
  const text = (value: unknown) => value === null || typeof value === 'string';
  const pairOf = new Map<string, [string, string]>();
  for (const pair of buttonPairs(keys)) {
    if (text(body[pair[0]]) && text(body[pair[1]])) {
      pairOf.set(pair[0], pair);
      pairOf.set(pair[1], pair);
    }
  }
  const drawn = new Set<string>();

  if (keys.length === 0) {
    return <Hint>Nothing to edit here unless technical fields are shown.</Hint>;
  }
  return (
    <div className={clsx('flex flex-col', depth === 0 ? 'gap-8' : 'gap-5')}>
      {keys.map((key) => {
        const pair = pairOf.get(key);
        if (pair) {
          if (drawn.has(pair[0])) return null;
          drawn.add(pair[0]);
          const [textKey, hrefKey] = pair;
          return (
            <ButtonPair
              key={key}
              prefix={textKey === 'label' ? '' : textKey.slice(0, -5)}
              text={String(body[textKey] ?? '')}
              href={String(body[hrefKey] ?? '')}
              onText={(next) => context.onChange([...path, textKey], next)}
              onHref={(next) => context.onChange([...path, hrefKey], next)}
            />
          );
        }
        return (
          <div
            key={key}
            id={anchors && isPart(body[key]) ? `part-${key}` : undefined}
            className={clsx(anchors && 'scroll-mt-6', depth === 0 && isPart(body[key]) && 'pt-2')}
          >
            <JsonField keyName={key} value={body[key]} path={[...path, key]} context={context} depth={depth} />
          </div>
        );
      })}
    </div>
  );
}
