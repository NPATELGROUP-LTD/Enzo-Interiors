import {
  ArrowLeft,
  ArrowRight,
  ArrowSquareOut,
  CaretRight,
  ChatCircleText,
  CheckCircle,
  EyeSlash,
  FileText,
  Image as ImageIcon,
  MagnifyingGlass,
  PaperPlaneTilt,
  Plus,
  Stack,
  WarningCircle,
  type Icon as PhosphorIcon,
} from '@phosphor-icons/react';
import clsx from 'clsx';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, useBlocker, useLocation, useNavigate } from 'react-router-dom';

import {
  Fields,
  humanize,
  removeAt,
  setIn,
  type EditorContext,
  type Path,
} from '@/components/cms/JsonEditor';
import { DETAILS_GUIDE, PAGES, RETIRED, USED_ON, fieldLabel, hideKeys, isTechnical } from '@/components/cms/guide';
import { WEB_URL } from '@/components/cms/MediaPicker';
import { DETAILS_SECTION, blankLike, orderKeys, splitSections } from '@/components/cms/paths';
import { SECTIONS, useCmsShell } from '@/components/layout/AdminLayout';
import {
  Button,
  ConfirmDialog,
  Crumbs,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Modal,
  PageHeader,
  Select,
  Textarea,
  Toggle,
  type Crumb,
} from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useQuery } from '@/hooks/useApi';
import { ApiError, api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { relative } from '@/lib/format';
import type { CmsCollection, CmsEntry, CmsEntrySummary, MediaAsset } from '@/types/cms';

/* -------------------------------------------------------------------------- */
/* Shared bits                                                                */
/* -------------------------------------------------------------------------- */

/** Live / changed since publishing / never published, as a dot and a word. */
function Status({ isNew, isDirty }: { isNew: boolean; isDirty: boolean }) {
  const [dot, text] = isNew
    ? ['bg-ink-muted/60', 'Not on the website yet']
    : isDirty
      ? ['bg-warning', 'Changes not live yet']
      : ['bg-success', 'Live'];
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-ink-muted">
      <span aria-hidden="true" className={clsx('h-2 w-2 rounded-full', dot)} />
      {text}
    </span>
  );
}

/** Where an entry can be seen on the public site, for "View on site". */
function sitePath(collection: CmsCollection, slug: string): string | null {
  switch (collection) {
    case 'pages':
      return PAGES[slug]?.path ?? null;
    case 'services':
      return `/services/${slug}`;
    case 'portfolio':
      return '/portfolio';
    case 'team':
      return '/about';
    case 'faqs':
      return '/services';
    case 'company':
      return '/contact';
    default:
      return '/';
  }
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** The pages in the order a visitor meets them, unknown ones last. */
const PAGE_ORDER = Object.keys(PAGES);
const pageRank = (slug: string) => {
  const at = PAGE_ORDER.indexOf(slug);
  return at === -1 ? PAGE_ORDER.length : at;
};

function useSchema(collection: CmsCollection) {
  const shell = useCmsShell();
  const schema = shell.overview?.schemas.find((row) => row.collection === collection) ?? null;
  return { ...shell, schema };
}


/* -------------------------------------------------------------------------- */
/* List                                                                       */
/* -------------------------------------------------------------------------- */

/** One line under a card's title, from the columns the collection lists. */
function subtitle(row: CmsEntrySummary, collection: CmsCollection, publishFlag?: string): string {
  if (collection === 'faqs')
    return row.columns.serviceId ? humanize(row.columns.serviceId) : 'Every service page';
  if (collection === 'testimonials') {
    const stars = Number(row.columns.rating);
    return stars > 0 ? '★'.repeat(Math.min(5, stars)) : '';
  }
  const values = Object.entries(row.columns)
    .filter(([key, value]) => key !== publishFlag && value)
    .map(([, value]) => value);
  return [...new Set(values)].join(' · ');
}

function EntryCard({
  to,
  title,
  meta,
  summary,
  image,
  pictures,
  hidden,
  row,
}: {
  to: string;
  title: string;
  meta?: string;
  summary?: string;
  image?: string | null;
  /** Whether this collection has pictures at all, so the slot is kept even when empty. */
  pictures: boolean;
  hidden: boolean;
  row: CmsEntrySummary;
}) {
  return (
    <Link
      to={to}
      className="group flex flex-col overflow-hidden rounded-card bg-surface shadow-soft transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-overlay focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring/40"
    >
      {pictures ? (
        <span className="relative flex aspect-[16/10] items-center justify-center overflow-hidden bg-surface-muted">
          {image ? (
            <img
              src={image}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <ImageIcon size={26} aria-hidden="true" className="text-ink-muted/60" />
          )}
          {hidden ? (
            <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-ink/75 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur">
              <EyeSlash size={12} aria-hidden="true" />
              Hidden
            </span>
          ) : null}
        </span>
      ) : null}
      <span className="flex flex-1 flex-col gap-1.5 p-4">
        <span className="flex items-start justify-between gap-3">
          <span className="line-clamp-2 font-semibold leading-snug text-ink">{title}</span>
          <CaretRight
            size={15}
            aria-hidden="true"
            className="mt-0.5 shrink-0 text-ink-muted transition-transform group-hover:translate-x-0.5"
          />
        </span>
        {meta ? <span className="truncate text-xs text-ink-muted">{meta}</span> : null}
        {summary ? (
          <span className="line-clamp-3 text-sm leading-relaxed text-ink-muted">{summary}</span>
        ) : null}
        <span className="mt-auto flex items-center gap-3 pt-2">
          <Status isNew={row.isNew} isDirty={row.isDirty} />
          {hidden && !pictures ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-ink-muted">
              <EyeSlash size={12} aria-hidden="true" /> Hidden
            </span>
          ) : null}
        </span>
      </span>
    </Link>
  );
}

/** Fills whatever width the window has, rather than a fixed column count. */
const GRID = 'grid grid-cols-[repeat(auto-fill,minmax(16.5rem,1fr))] gap-4';
const PANE = 'px-5 pb-[calc(env(safe-area-inset-bottom)+2.5rem)] pt-6 sm:px-8 lg:pt-8';
const GROUP_HEADING = 'mb-3 text-[13px] font-semibold uppercase leading-none tracking-[0.08em] text-ink-muted';
const FOCUS = 'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring/40';

/** One row of the overview's lists: icon, name, a line saying what it is, and where it goes. */
function OverviewRow({
  to,
  Icon,
  name,
  meta,
  line,
  status,
  tone = 'green',
}: {
  to: string;
  Icon: PhosphorIcon;
  name: string;
  meta?: ReactNode;
  line: ReactNode;
  status?: ReactNode;
  tone?: 'green' | 'warning';
}) {
  return (
    <Link
      to={to}
      className={clsx('group flex h-full items-start gap-3 rounded-[10px] px-3 py-3 transition-colors hover:bg-ink/[0.025]', FOCUS)}
    >
      <span
        className={clsx(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px]',
          tone === 'warning' ? 'bg-warning-bg text-warning' : 'bg-green-100 text-green-900',
        )}
      >
        <Icon size={18} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className="font-semibold text-ink">{name}</span>
          {meta ? <span className="tabular truncate text-xs text-ink-muted">{meta}</span> : null}
        </span>
        <span className="mt-0.5 block text-[13px] leading-snug text-ink-muted">{line}</span>
        {status ? <span className="mt-1.5 block">{status}</span> : null}
      </span>
      <CaretRight
        size={14}
        aria-hidden="true"
        className="mt-1 shrink-0 text-ink-muted transition-transform group-hover:translate-x-0.5"
      />
    </Link>
  );
}

/** Where each collection is edited, for the review list's links. */
const EDIT_PATH = Object.fromEntries(SECTIONS.map((row) => [row.collection, row.to])) as Record<CmsCollection, string>;

/**
 * What "CMS" in the menu bar opens: every page of the website in the order a
 * visitor meets them, and next to them the things several pages share, each
 * saying where it shows up. Anything an editor has sent for review sits on
 * top until an admin deals with it.
 */
export function CmsHome() {
  const { overview, error, refresh } = useCmsShell();
  const pages = useQuery<CmsEntrySummary[]>('/cms/collections/pages');
  const rows = useMemo(
    () => [...(pages.data ?? [])].sort((a, b) => pageRank(a.slug) - pageRank(b.slug)),
    [pages.data],
  );

  if (error) return <ErrorState message={error} onRetry={refresh} />;
  if (!overview) return <LoadingState label="Opening the CMS…" />;

  const shared = SECTIONS.filter((section) => section.collection !== 'pages');
  const reviews = overview.reviews ?? [];

  return (
    <div className={PANE}>
      <PageHeader
        title="CMS"
        actions={
          <a
            href={WEB_URL}
            target="_blank"
            rel="noopener"
            className="flex min-h-9 items-center gap-1.5 rounded-control border border-border bg-surface px-3 text-sm font-semibold text-ink shadow-card hover:bg-secondary-hover pointer-coarse:min-h-11"
          >
            <ArrowSquareOut size={15} aria-hidden="true" />
            View website
          </a>
        }
      />
      <div className="grid items-start gap-x-10 gap-y-10 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-10">
          {reviews.length ? (
            <section aria-labelledby="cms-reviews">
              <h2 id="cms-reviews" className={GROUP_HEADING}>
                Waiting for review
              </h2>
              <ul className="rounded-card bg-surface p-1.5 shadow-soft">
                {reviews.map((item) => (
                  <li key={`${item.collection}/${item.slug}`}>
                    <OverviewRow
                      to={item.collection === 'company' ? EDIT_PATH.company : `${EDIT_PATH[item.collection]}/${item.slug}`}
                      Icon={ChatCircleText}
                      tone="warning"
                      name={item.collection === 'pages' ? (PAGES[item.slug]?.name ?? item.title) : item.title}
                      meta={`${item.by}, ${relative(item.at)}`}
                      line={item.note ? `“${item.note}”` : 'No note. Open it to see what changed.'}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section aria-labelledby="cms-pages">
            <h2 id="cms-pages" className={GROUP_HEADING}>
              Pages
            </h2>
            {pages.error ? (
              <ErrorState message={pages.error} onRetry={pages.refetch} />
            ) : !pages.data ? (
              <LoadingState label="Loading pages…" />
            ) : (
              <ol className="grid rounded-card bg-surface p-1.5 shadow-soft lg:grid-cols-2">
                {rows.map((row) => {
                  const guide = PAGES[row.slug];
                  return (
                    <li key={row.id}>
                      <OverviewRow
                        to={`/pages/${row.slug}`}
                        Icon={guide?.path === null ? Stack : FileText}
                        name={guide?.name ?? row.title}
                        meta={guide ? (guide.path ?? 'Every page') : row.slug}
                        line={guide?.summary ?? ''}
                        status={row.isNew || row.isDirty ? <Status isNew={row.isNew} isDirty={row.isDirty} /> : null}
                      />
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </div>

        <section aria-labelledby="cms-shared">
          <h2 id="cms-shared" className={GROUP_HEADING}>
            Shared content
          </h2>
          <ul className="rounded-card bg-surface p-1.5 shadow-soft">
            {shared.map(({ to, label, collection, Icon }) => {
              const schema = overview.schemas.find((row) => row.collection === collection);
              const count = overview.counts[collection];
              return (
                <li key={to}>
                  <OverviewRow
                    to={to}
                    Icon={Icon}
                    name={label}
                    meta={schema && !schema.fixed && count ? count.total : undefined}
                    line={USED_ON[collection]}
                    status={(count?.dirty ?? 0) > 0 ? <Status isNew={false} isDirty /> : null}
                  />
                </li>
              );
            })}
          </ul>
          <p className="mt-3 px-1 text-[13px] text-ink-muted">
            Each is edited once, here, and changes everywhere it appears.
          </p>
        </section>
      </div>
    </div>
  );
}

export function CollectionPage({
  collection,
  basePath,
}: {
  collection: CmsCollection;
  basePath: string;
}) {
  const navigate = useNavigate();
  const toast = useToast();
  const { isAdmin } = useAuth();
  const { schema, error, refresh } = useSchema(collection);
  const entries = useQuery<CmsEntrySummary[]>(`/cms/collections/${collection}`);
  const pictures = !!schema && schema.mediaKeys.length + schema.mediaListKeys.length > 0;
  const assets = useQuery<MediaAsset[]>(pictures ? '/cms/media' : null);

  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [pending, setPending] = useState(false);

  const images = useMemo(
    () => new Map((assets.data ?? []).map((asset) => [asset.id, asset.src_resolved])),
    [assets.data],
  );

  const rows = useMemo(() => {
    const all = entries.data ?? [];
    const needle = search.trim().toLowerCase();
    if (!needle) return all;
    return all.filter((row) =>
      [row.title, row.slug, ...Object.values(row.columns)].some((field) =>
        field.toLowerCase().includes(needle),
      ),
    );
  }, [entries.data, search]);

  if (error) return <ErrorState message={error} onRetry={refresh} />;
  if (!schema) return <LoadingState label="Opening the CMS…" />;

  const slug = slugify(name);

  const create = async () => {
    if (!slug) return;
    setPending(true);
    try {
      // A new entry starts from the collection's blank template, or else as an
      // emptied copy of an existing one, so it has every field the site uses.
      const template = entries.data?.[0];
      let draft: Record<string, unknown> = { ...schema.template };
      if (!schema.template && template) {
        const existing = await api.get<CmsEntry>(`/cms/collections/${collection}/${template.slug}`);
        draft = blankLike(existing.draft) as Record<string, unknown>;
      }
      draft[schema.titleField] = name.trim();
      // A new project or review stays off the site until someone switches it on.
      if (schema.publishFlagKey) draft[schema.publishFlagKey] = false;

      await api.post(`/cms/collections/${collection}`, { slug, draft });
      refresh();
      toast.success(
        `${schema.singular.charAt(0).toUpperCase()}${schema.singular.slice(1)} created. Fill it in, then publish.`,
      );
      navigate(`${basePath}/${slug}`);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'That could not be created.');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className={PANE}>
      <PageHeader
        title={schema.label}
        actions={
          isAdmin && !schema.fixed ? (
            <Button variant="primary" onClick={() => setCreating(true)} icon={<Plus size={16} />}>
              New {schema.singular}
            </Button>
          ) : null
        }
      />

      {(entries.data ?? []).length > 6 ? (
        <label className="relative mb-5 flex max-w-sm items-center">
          <span className="sr-only">Search {schema.label.toLowerCase()}</span>
          <MagnifyingGlass
            size={16}
            aria-hidden="true"
            className="pointer-events-none absolute left-3 text-ink-muted"
          />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search"
            className="min-h-10 w-full rounded-full bg-surface pl-9 pr-4 text-sm text-ink shadow-soft placeholder:text-ink-muted/80 focus:outline-none focus:ring-[3px] focus:ring-focus-ring/35"
          />
        </label>
      ) : null}

      {entries.loading && !entries.data ? (
        <LoadingState label={`Loading ${schema.label.toLowerCase()}…`} />
      ) : entries.error ? (
        <ErrorState message={entries.error} onRetry={entries.refetch} />
      ) : rows.length === 0 ? (
        <EmptyState
          title={search ? 'Nothing matches that' : 'Nothing here yet'}
          message={
            search
              ? `Nothing in ${schema.label.toLowerCase()} mentions “${search.trim()}”.`
              : isAdmin && !schema.fixed
                ? `Add the first ${schema.singular} to get started.`
                : `Nothing has been added yet. An Admin can add the first ${schema.singular}.`
          }
          action={
            !search && isAdmin && !schema.fixed ? (
              <Button variant="primary" onClick={() => setCreating(true)} icon={<Plus size={16} />}>
                New {schema.singular}
              </Button>
            ) : null
          }
        />
      ) : (
        <div className={GRID}>
          {rows.map((row) => (
            <EntryCard
              key={row.id}
              to={`${basePath}/${row.slug}`}
              title={row.title}
              meta={subtitle(row, collection, schema.publishFlagKey)}
              image={row.image ? (images.get(row.image) ?? null) : null}
              pictures={pictures}
              hidden={!!schema.publishFlagKey && row.columns[schema.publishFlagKey] === 'No'}
              row={row}
            />
          ))}
        </div>
      )}

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title={`New ${schema.singular}`}
        width="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={create} loading={pending} disabled={!slug}>
              Create
            </Button>
          </>
        }
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void create();
          }}
        >
          <Input
            label="Name"
            value={name}
            autoFocus
            onChange={(event) => setName(event.target.value)}
            placeholder={collection === 'portfolio' ? 'Walnut kitchen, Oadby' : undefined}
            hint={
              slug
                ? collection === 'services'
                  ? `Its page will be /services/${slug}. That address cannot change later.`
                  : `Saved as “${slug}”.`
                : 'You can change everything else once it is created.'
            }
          />
        </form>
      </Modal>
    </div>
  );
}


/* -------------------------------------------------------------------------- */
/* Editor                                                                     */
/* -------------------------------------------------------------------------- */

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Rows in the window's sidebar, the way a Mac app's source list looks. */
const SIDEBAR_ROW =
  'flex min-h-8 w-full items-center gap-2.5 rounded-[7px] px-2.5 text-left text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring/35 pointer-coarse:min-h-11';
const SIDEBAR_SELECTED = 'bg-green-900 font-semibold text-on-primary';
const SIDEBAR_IDLE = 'text-ink hover:bg-ink/[0.06]';

function ChangedDot({ on }: { on: boolean }) {
  return (
    <span
      className={clsx('h-2 w-2 shrink-0 rounded-full', on ? 'bg-on-primary' : 'bg-warning')}
      title="Changed since it was last published"
      aria-label="changed"
    />
  );
}

interface OutlineItem {
  id: string;
  name: string;
  help: string;
  changed: boolean;
}

/**
 * A page's sections, in the order a visitor scrolls through them. The open
 * one also lists its parts (the rooms, the call to action...), which scroll
 * the form to that part.
 */
function Outline({
  items,
  active,
  parts,
  onSelect,
  onPart,
}: {
  items: OutlineItem[];
  active: string;
  parts: Array<{ key: string; name: string }>;
  onSelect: (id: string) => void;
  onPart: (key: string) => void;
}) {
  return (
    <nav aria-label="Sections of this page">
      <p className="label-eyebrow mb-2 px-2.5">On this page</p>
      <ol className="flex flex-col gap-px">
        {items.map((item, index) => {
          const selected = item.id === active;
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onSelect(item.id)}
                aria-current={selected ? 'step' : undefined}
                className={clsx(SIDEBAR_ROW, selected ? SIDEBAR_SELECTED : SIDEBAR_IDLE)}
              >
                <span
                  className={clsx(
                    'tabular w-4 shrink-0 text-xs',
                    selected ? 'text-on-primary/75' : 'text-ink-muted',
                  )}
                >
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 truncate">{item.name}</span>
                {item.changed ? <ChangedDot on={selected} /> : null}
              </button>
              {selected && parts.length > 1 ? (
                <ul aria-label={`Parts of ${item.name}`} className="mb-1.5 mt-1 flex flex-col">
                  {parts.map((part) => (
                    <li key={part.key}>
                      <button
                        type="button"
                        onClick={() => onPart(part.key)}
                        className="flex min-h-7 w-full items-center rounded-[6px] pl-9 pr-2.5 text-left text-[12.5px] text-ink-muted transition-colors hover:bg-ink/[0.06] hover:text-ink focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring/35 pointer-coarse:min-h-10"
                      >
                        <span className="truncate">{part.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** The other entries of the same kind, so moving between them is one click. */
function Siblings({
  label,
  rows,
  basePath,
}: {
  label: string;
  rows: CmsEntrySummary[];
  basePath: string;
}) {
  return (
    <nav aria-label={label}>
      <p className="label-eyebrow mb-2 px-2.5">{label}</p>
      <ul className="flex flex-col gap-px">
        {rows.map((row) => (
          <li key={row.id}>
            <NavLink
              to={`${basePath}/${row.slug}`}
              className={({ isActive }) =>
                clsx(SIDEBAR_ROW, isActive ? SIDEBAR_SELECTED : SIDEBAR_IDLE)
              }
            >
              {({ isActive }) => (
                <>
                  <span className="min-w-0 flex-1 truncate">{row.title}</span>
                  {row.isDirty || row.isNew ? <ChangedDot on={isActive} /> : null}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** What the toolbar says about saving: quiet when it worked, loud when not. */
function SaveIndicator({
  state,
  pending,
  onRetry,
}: {
  state: 'saved' | 'saving' | 'failed';
  pending: boolean;
  onRetry: () => void;
}) {
  if (state === 'failed') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-danger">
        <WarningCircle size={15} aria-hidden="true" />
        Not saved
        <button type="button" onClick={onRetry} className="text-link text-[13px]">
          Try again
        </button>
      </span>
    );
  }
  return (
    <span aria-live="polite" className="inline-flex items-center gap-1.5 text-[13px] text-ink-muted">
      {pending ? null : <CheckCircle size={15} aria-hidden="true" className="text-success" />}
      {pending ? 'Saving…' : 'Saved'}
    </span>
  );
}

type SaveState = 'saved' | 'saving' | 'failed';

/**
 * One entry's editor.
 *
 * Edits save themselves a moment after typing stops, so the only decision an
 * editor makes is Publish: what is typed is kept, and Publish is what puts it
 * on the website. "Save draft" and the leave-without-saving dialog are gone
 * with that; leaving mid-save waits for the save instead of asking.
 */
export function EntryPage({
  collection,
  slug,
  basePath,
}: {
  collection: CmsCollection;
  slug: string;
  basePath: string;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const { isAdmin } = useAuth();
  const { schema, error: shellError, refresh } = useSchema(collection);
  const entry = useQuery<CmsEntry>(`/cms/collections/${collection}/${slug}`);
  const assets = useQuery<MediaAsset[]>('/cms/media');

  // Only fetch the lists this collection's dropdowns point at.
  const refs = new Set(Object.values(schema?.references ?? {}));
  const list = (target: CmsCollection) => (refs.has(target) ? `/cms/collections/${target}` : null);
  const services = useQuery<CmsEntrySummary[]>(list('services'));
  const portfolio = useQuery<CmsEntrySummary[]>(list('portfolio'));
  const testimonials = useQuery<CmsEntrySummary[]>(list('testimonials'));
  const team = useQuery<CmsEntrySummary[]>(list('team'));
  // The sidebar's list of the same kind of thing. Pages list their sections
  // there instead, and Company is a single record.
  const siblings = useQuery<CmsEntrySummary[]>(
    collection === 'pages' || collection === 'company' ? null : `/cms/collections/${collection}`,
  );

  const [body, setBody] = useState<Record<string, unknown> | null>(null);
  /** The draft as the server last accepted it; autosave compares against it. */
  const [saved, setSaved] = useState<Record<string, unknown> | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [section, setSection] = useState(DETAILS_SECTION);
  const [showTechnical, setShowTechnical] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [confirmRevert, setConfirmRevert] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  /** The note dialog: an editor sending for review, or an admin sending back. */
  const [noteFor, setNoteFor] = useState<'review' | 'send-back' | null>(null);
  const [note, setNote] = useState('');
  const [sendingNote, setSendingNote] = useState(false);
  const leaving = useRef(false);
  const inflight = useRef<Promise<boolean> | null>(null);
  const paneRef = useRef<HTMLDivElement>(null);

  // Adopt the server's draft once per entry, keyed on the row id so moving to
  // another entry never leaves the previous one's words on screen.
  if (entry.data && schema && loadedFor !== entry.data.id) {
    // Fields an older entry never had are filled in blank, so they can be
    // edited. Only on screen: they reach the database with the next real edit.
    const draft = { ...schema.template, ...entry.data.draft };
    setLoadedFor(entry.data.id);
    setBody(draft);
    setSaved(draft);
    // A search result or the overview links straight to a section as /pages/home#process.
    const hash = decodeURIComponent(location.hash.slice(1));
    setSection(hash && hash in entry.data.draft ? hash : DETAILS_SECTION);
  }

  const unsaved = useMemo(() => (body && saved ? !same(body, saved) : false), [body, saved]);
  const pending = unsaved || saveState === 'saving';

  const { setData: setEntry, refetch: refetchEntry } = entry;
  const save = useCallback(async (): Promise<boolean> => {
    // One request at a time, so an older draft can never land after a newer one.
    while (inflight.current) await inflight.current;
    if (!body || same(body, saved)) return true;
    setSaveState('saving');
    const run = api
      .put<CmsEntry>(`/cms/collections/${collection}/${slug}`, { draft: body })
      .then((updated) => {
        setSaved(body);
        setSaveState('saved');
        setEntry((current) =>
          current
            ? {
                ...current,
                ...updated,
                isDirty: updated.published === null || !same(updated.draft, updated.published),
              }
            : current,
        );
        refresh();
        return true;
      })
      .catch((caught: unknown) => {
        setSaveState('failed');
        toast.error(
          caught instanceof ApiError ? caught.message : 'That did not save. Your changes are still on screen.',
        );
        return false;
      });
    inflight.current = run;
    try {
      return await run;
    } finally {
      inflight.current = null;
    }
  }, [body, saved, collection, slug, setEntry, refresh, toast]);

  // Save a moment after typing stops. A failed save waits for the next edit
  // or "Try again", rather than retrying in a loop.
  useEffect(() => {
    if (!unsaved || saveState === 'failed') return undefined;
    const timer = window.setTimeout(() => void save(), 1000);
    return () => window.clearTimeout(timer);
  }, [unsaved, saveState, save]);

  // Leaving by the menu, the sidebar or the back link waits for the save.
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      pending && !leaving.current && currentLocation.pathname !== nextLocation.pathname,
  );
  useEffect(() => {
    if (blocker.state !== 'blocked') return undefined;
    let cancelled = false;
    void save().then((ok) => {
      if (cancelled) return;
      if (ok) blocker.proceed();
      else blocker.reset();
    });
    return () => {
      cancelled = true;
    };
  }, [blocker, save]);

  // A closed tab cannot wait, so it asks.
  useEffect(() => {
    if (!pending) return undefined;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [pending]);

  // Ctrl/Cmd+S saves now, because that is where every editor's hand goes.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void save();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [save]);

  const options = useMemo(() => {
    const pick = (rows: CmsEntrySummary[] | null) =>
      (rows ?? []).map((row) => ({ slug: row.slug, title: row.title }));
    return {
      services: pick(services.data),
      portfolio: pick(portfolio.data),
      testimonials: pick(testimonials.data),
      team: pick(team.data),
    };
  }, [services.data, portfolio.data, testimonials.data, team.data]);

  const { refetch: refetchAssets } = assets;
  const context = useMemo<EditorContext | null>(
    () =>
      schema
        ? {
            schema,
            assets: assets.data ?? [],
            options,
            showTechnical,
            onChange: (path: Path, value: unknown) =>
              setBody((current) =>
                current ? (setIn(current, path, value) as Record<string, unknown>) : current,
              ),
            onRemove: (path: Path) =>
              setBody((current) =>
                current ? (removeAt(current, path) as Record<string, unknown>) : current,
              ),
            onAssetsChanged: () => void refetchAssets(),
          }
        : null,
    [schema, assets.data, options, showTechnical, refetchAssets],
  );

  if (shellError) return <ErrorState message={shellError} onRetry={refresh} />;
  if (entry.error) return <ErrorState message={entry.error} onRetry={entry.refetch} />;
  if (!schema || !context || !entry.data || !body) return <LoadingState label="Opening…" />;

  const published = entry.data.published;
  const notLive = published === null || entry.data.isDirty || unsaved;
  const review = entry.data.review;
  const guide = collection === 'pages' ? PAGES[slug] : undefined;
  const title = guide?.name ?? (String(body[schema.titleField] ?? '') || slug);
  const path = sitePath(collection, slug);
  // Keys something else now controls (guide.ts RETIRED): kept, not shown.
  const retired = new Set(RETIRED[collection] ?? []);
  const shown = retired.size ? hideKeys(body, [...retired]) : body;

  // Send for review (editors) and send back (admins) both carry a note.
  const sendNote = async () => {
    if (noteFor === 'review' && !(await save())) return;
    setSendingNote(true);
    try {
      await api.post(`/cms/collections/${collection}/${slug}/${noteFor}`, { note: note.trim() || undefined });
      await refetchEntry();
      refresh();
      toast.success(
        noteFor === 'review'
          ? 'Sent. The Admins have been told, and you will hear back under the bell.'
          : 'Sent back. They have been told, with your note.',
      );
      setNoteFor(null);
      setNote('');
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'That did not send.');
    } finally {
      setSendingNote(false);
    }
  };

  const publish = async () => {
    // Publishing what is on screen is what the button promises, so a save
    // still waiting to happen goes first.
    if (!(await save())) return;
    setPublishing(true);
    try {
      await api.post(`/cms/collections/${collection}/${slug}/publish`);
      await refetchEntry();
      refresh();
      toast.success('Published. The website is updating now.');
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'That did not publish.');
    } finally {
      setPublishing(false);
    }
  };

  // Back to what the website shows is just one more edit: it saves like any
  // other, and then the draft equals what is live again.
  const revert = () => {
    setConfirmRevert(false);
    if (published) setBody(published);
    toast.success('Back to exactly what the website is showing.');
  };

  const remove = async () => {
    setConfirmDelete(false);
    // Go on to the next one in the list (or the one before, if this was the
    // last), the way deleting a mail moves to the next rather than the inbox.
    const rows = siblings.data ?? [];
    const at = rows.findIndex((row) => row.slug === slug);
    const next = rows[at + 1] ?? rows[at - 1];
    try {
      await api.delete(`/cms/collections/${collection}/${slug}`);
      refresh();
      toast.success('Deleted.');
      leaving.current = true;
      navigate(next && at !== -1 ? `${basePath}/${next.slug}` : basePath);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'That could not be deleted.');
    }
  };

  const technicalToggle = (
    <Toggle
      label="Show technical fields"
      description="Ids, screen-reader labels and 3D camera settings. Rarely needed."
      checked={showTechnical}
      onChange={setShowTechnical}
    />
  );

  /* ---- Pages step through their sections; everything else is one form ---- */
  let navigation: ReactNode = null;
  let crumbs: Crumb[] = schema.fixed
    ? [{ label: 'CMS', to: '/cms' }, { label: schema.label }]
    : [{ label: 'CMS', to: '/cms' }, { label: schema.label, to: basePath }, { label: title }];
  let content: ReactNode;
  if (collection === 'pages') {
    const { scalars, sections } = splitSections(
      shown,
      guide?.sections.map(([key]) => key),
    );
    const visibleScalars = scalars.filter((key) => showTechnical || !['id', 'index'].includes(key));
    const named = new Map(guide?.sections.map(([key, name, help]) => [key, { name, help }]));
    const items: OutlineItem[] = [
      ...(visibleScalars.length > 0 ? [{ id: DETAILS_SECTION, ...DETAILS_GUIDE }] : []),
      ...sections.map((key) => ({
        id: key,
        name: named.get(key)?.name ?? fieldLabel(key, humanize),
        help: named.get(key)?.help ?? '',
      })),
    ].map((item) => ({
      ...item,
      changed:
        published !== null &&
        (item.id === DETAILS_SECTION
          ? scalars.some((key) => !same(body[key], published[key]))
          : !same(body[item.id], published[item.id])),
    }));

    const at = Math.max(
      0,
      items.findIndex((item) => item.id === section),
    );
    const current = items[at];
    const select = (id: string) => {
      setSection(id);
      paneRef.current?.scrollTo({ top: 0 });
    };
    // The lists and groups inside the open section, for the outline.
    const value = current ? body[current.id] : null;
    const parts =
      value && typeof value === 'object' && !Array.isArray(value)
        ? orderKeys(value as Record<string, unknown>, [...schema.mediaKeys, ...schema.mediaListKeys])
            .filter((key) => {
              const part = (value as Record<string, unknown>)[key];
              return part !== null && typeof part === 'object' && (showTechnical || !isTechnical(key));
            })
            .map((key) => ({ key, name: fieldLabel(key, humanize) }))
        : [];

    if (current) {
      crumbs = [
        { label: 'CMS', to: '/cms' },
        { label: title, onClick: () => select(items[0]!.id) },
        { label: current.name },
      ];
      navigation = (
        <Outline
          items={items}
          active={current.id}
          parts={parts}
          onSelect={select}
          onPart={(key) =>
            document.getElementById(`part-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }
        />
      );
    }
    content = current ? (
      <section aria-labelledby="section-title">
        {/* No sidebar on small screens: a native dropdown takes one line. */}
        <div className="mb-7 lg:hidden">
          <Select label="Section" value={current.id} onChange={(event) => select(event.target.value)}>
            {items.map((item, index) => (
              <option key={item.id} value={item.id}>
                {index + 1}. {item.name}
                {item.changed ? ' (changed)' : ''}
              </option>
            ))}
          </Select>
        </div>

        <header className="mb-9">
          <h2 id="section-title" className="text-[26px] font-bold leading-tight tracking-tight text-ink">
            {current.name}
          </h2>
          {current.help ? (
            <p className="mt-2 max-w-[62ch] text-[14px] leading-relaxed text-ink-muted">{current.help}</p>
          ) : null}
        </header>

        {current.id === DETAILS_SECTION ? (
          <Fields
            body={Object.fromEntries(scalars.map((key) => [key, body[key]]))}
            context={context}
          />
        ) : Array.isArray(body[current.id]) ? (
          // A section that is itself a list: wrap it so it gets its list UI.
          <Fields body={{ [current.id]: body[current.id] }} context={context} />
        ) : (
          <Fields
            body={body[current.id] as Record<string, unknown>}
            path={[current.id]}
            context={context}
            anchors
          />
        )}

        <footer className="mt-14 flex flex-wrap justify-between gap-3">
          {at > 0 ? (
            <Button
              variant="ghost"
              icon={<ArrowLeft size={15} />}
              onClick={() => select(items[at - 1]!.id)}
            >
              {items[at - 1]!.name}
            </Button>
          ) : (
            <span />
          )}
          {at < items.length - 1 ? (
            <Button variant="secondary" onClick={() => select(items[at + 1]!.id)}>
              Next: {items[at + 1]!.name}
              <ArrowRight size={15} aria-hidden="true" />
            </Button>
          ) : null}
        </footer>
      </section>
    ) : (
      <EmptyState title="Nothing to edit" message="This page has no content yet." />
    );
  } else {
    if ((siblings.data?.length ?? 0) > 1)
      navigation = <Siblings label={schema.label} rows={siblings.data!} basePath={basePath} />;
    content = (
      <>
        <header className="mb-9">
          <h2 className="text-[26px] font-bold leading-tight tracking-tight text-ink">{title}</h2>
          <p className="mt-2 max-w-[62ch] text-[14px] leading-relaxed text-ink-muted">{schema.description}</p>
        </header>
        <Fields body={shown} context={context} anchors />
        {retired.has('logos') ? (
          <p className="mt-10 text-sm text-ink-muted">
            The logos and the browser-tab icon are in{' '}
            {isAdmin ? (
              <Link to="/settings/brand" className="text-link">
                Settings › Logo &amp; icon
              </Link>
            ) : (
              'Settings › Logo & icon'
            )}
            , and the opening hours in{' '}
            {isAdmin ? (
              <Link to="/settings/hours" className="text-link">
                Settings › Opening hours
              </Link>
            ) : (
              'Settings › Opening hours'
            )}
            .
          </p>
        ) : null}
        {isAdmin && !schema.fixed ? (
          <div className="mt-16">
            <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
              Delete this {schema.singular}
            </Button>
          </div>
        ) : null}
      </>
    );
  }

  return (
    // Two panes, each scrolling on its own: the source list, and the document.
    <div className="flex h-full min-h-0">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-surface-muted/45 lg:flex">
        <div className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-5 pt-5">{navigation}</div>
        <div className="px-4 pb-4 pt-2">{technicalToggle}</div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col bg-surface">
        <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-border px-5 py-2.5 sm:px-8">
          <Crumbs items={crumbs} className="flex-1" />
          <SaveIndicator state={saveState} pending={pending} onRetry={() => void save()} />
          <div className="flex flex-wrap items-center gap-2">
            {path ? (
              <a
                href={`${WEB_URL}${path}`}
                target="_blank"
                rel="noopener"
                title="Open this page on the website"
                aria-label="Open this page on the website"
                className="flex h-9 w-9 items-center justify-center rounded-control text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink pointer-coarse:h-11 pointer-coarse:w-11"
              >
                <ArrowSquareOut size={17} aria-hidden="true" />
              </a>
            ) : null}
            {published !== null && notLive ? (
              <Button variant="ghost" onClick={() => setConfirmRevert(true)}>
                Discard changes
              </Button>
            ) : null}
            {isAdmin ? (
              <Button variant="primary" onClick={publish} loading={publishing} disabled={!notLive}>
                Publish
              </Button>
            ) : review ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setNote(review.note ?? '');
                  setNoteFor('review');
                }}
              >
                Update note
              </Button>
            ) : (
              <Button
                variant="primary"
                icon={<PaperPlaneTilt size={15} />}
                disabled={!notLive}
                title={notLive ? undefined : 'Nothing has changed since it was published.'}
                onClick={() => setNoteFor('review')}
              >
                Send for review
              </Button>
            )}
          </div>
        </div>

        <div ref={paneRef} className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[46rem] px-5 pb-[calc(env(safe-area-inset-bottom)+3rem)] pt-8 sm:px-8 lg:pt-10">
            {review ? (
              <div role="status" className="mb-9 flex flex-wrap items-start gap-x-3 gap-y-2 rounded-[10px] bg-warning-bg px-4 py-3 text-sm text-ink">
                <ChatCircleText size={18} aria-hidden="true" className="mt-px shrink-0 text-warning" />
                <p className="min-w-0 flex-1">
                  {isAdmin ? (
                    <>
                      <span className="font-semibold">{review.by}</span> sent this for review {relative(review.at).toLowerCase()}.
                      Publish it, or send it back with a note.
                    </>
                  ) : (
                    <>Sent for review {relative(review.at).toLowerCase()}. An Admin will publish it or send it back.</>
                  )}
                  {review.note ? <span className="mt-1 block italic text-ink-muted">“{review.note}”</span> : null}
                </p>
                {isAdmin ? (
                  <Button variant="secondary" onClick={() => setNoteFor('send-back')}>
                    Send back…
                  </Button>
                ) : null}
              </div>
            ) : entry.data.review_feedback ? (
              <div role="status" className="mb-9 flex items-start gap-3 rounded-[10px] bg-warning-bg px-4 py-3 text-sm text-ink">
                <ChatCircleText size={18} aria-hidden="true" className="mt-px shrink-0 text-warning" />
                <p className="min-w-0 flex-1">
                  <span className="font-semibold">Sent back by an Admin.</span> Make the changes, then send it for review again.
                  <span className="mt-1 block whitespace-pre-wrap italic text-ink-muted">“{entry.data.review_feedback}”</span>
                </p>
              </div>
            ) : null}
            {content}
            {/* No sidebar below lg: the switch follows the form instead. */}
            <div className="mt-14 lg:hidden">{technicalToggle}</div>
          </div>
        </div>
      </div>

      <Modal
        open={noteFor !== null}
        onClose={() => setNoteFor(null)}
        title={noteFor === 'send-back' ? 'Send back' : 'Send for review'}
        description={
          noteFor === 'send-back'
            ? `Nothing is published. ${review?.by ?? 'They'} will see your note.`
            : 'Your changes are saved. An Admin will publish them or send them back.'
        }
        width="sm"
      >
        <div className="flex flex-col gap-4">
          <Textarea
            label={noteFor === 'send-back' ? 'What needs changing?' : 'Note for the Admin (optional)'}
            value={note}
            maxLength={2000}
            onChange={(event) => setNote(event.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setNoteFor(null)}>
              Cancel
            </Button>
            <Button variant="primary" loading={sendingNote} onClick={() => void sendNote()}>
              {noteFor === 'send-back' ? 'Send back' : 'Send for review'}
            </Button>
          </div>
        </div>
      </Modal>
      <ConfirmDialog
        open={confirmRevert}
        title="Discard these changes?"
        message="Everything changed since the last publish is thrown away, and this goes back to exactly what the website is showing."
        confirmLabel="Discard changes"
        onConfirm={revert}
        onCancel={() => setConfirmRevert(false)}
      />
      <ConfirmDialog
        open={confirmDelete}
        title={`Delete ${title}?`}
        message="It is removed from the website straight away. This cannot be undone."
        confirmLabel="Delete"
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
