import {
  ArrowLeft,
  ArrowRight,
  ArrowSquareOut,
  CaretRight,
  EyeSlash,
  Image as ImageIcon,
  MagnifyingGlass,
  Plus,
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
import { DETAILS_GUIDE, PAGES } from '@/components/cms/guide';
import { WEB_URL } from '@/components/cms/MediaPicker';
import { DETAILS_SECTION, splitSections } from '@/components/cms/paths';
import { SECTIONS, useCmsShell } from '@/components/layout/AdminLayout';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Modal,
  PageHeader,
  Select,
  Toggle,
} from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useQuery } from '@/hooks/useApi';
import { ApiError, api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { dateTime } from '@/lib/format';
import type { CmsCollection, CmsEntry, CmsEntrySummary, MediaAsset } from '@/types/cms';

/* -------------------------------------------------------------------------- */
/* Shared bits                                                                */
/* -------------------------------------------------------------------------- */

/** Live / changed since publishing / never published, as a dot and a word. */
function Status({ isNew, isDirty }: { isNew: boolean; isDirty: boolean }) {
  const [dot, text] = isNew
    ? ['bg-ink-muted/60', 'Not published yet']
    : isDirty
      ? ['bg-warning', 'Unpublished changes']
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

/**
 * What "CMS" in the menu bar opens: every page and every kind of shared
 * content on one screen, each with whether it has changes waiting to go live.
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

  const waiting = Object.values(overview.counts).reduce((total, count) => total + count.dirty, 0);

  return (
    <div className={PANE}>
      <PageHeader
        title="Website content"
        description="Everything on the public website. Pages are edited section by section, in the order a visitor scrolls. Shared content appears on several pages, so it is edited once, in its own place."
      />
      <p className="-mt-2 mb-8 flex items-center gap-2 text-sm text-ink-muted">
        <span
          aria-hidden="true"
          className={clsx('h-2 w-2 rounded-full', waiting ? 'bg-warning' : 'bg-success')}
        />
        {waiting === 0
          ? 'Everything is live. The website shows exactly what is saved here.'
          : `${waiting} ${waiting === 1 ? 'change is' : 'changes are'} saved but not on the website yet.`}
      </p>

      <section aria-labelledby="cms-pages">
        <h2 id="cms-pages" className={GROUP_HEADING}>
          Pages
        </h2>
        {pages.error ? (
          <ErrorState message={pages.error} onRetry={pages.refetch} />
        ) : !pages.data ? (
          <LoadingState label="Loading pages…" />
        ) : (
          <div className={GRID}>
            {rows.map((row) => {
              const guide = PAGES[row.slug];
              return (
                <EntryCard
                  key={row.id}
                  to={`/pages/${row.slug}`}
                  title={guide?.name ?? row.title}
                  meta={guide ? (guide.path ?? 'On every page') : row.slug}
                  summary={guide?.summary}
                  pictures={false}
                  hidden={false}
                  row={row}
                />
              );
            })}
          </div>
        )}
      </section>

      <section aria-labelledby="cms-shared" className="mt-11">
        <h2 id="cms-shared" className={GROUP_HEADING}>
          Shared content
        </h2>
        <div className={GRID}>
          {SECTIONS.filter((section) => section.collection !== 'pages').map(
            ({ to, label, collection, Icon }) => {
              const schema = overview.schemas.find((row) => row.collection === collection);
              const count = overview.counts[collection];
              return (
                <Link
                  key={to}
                  to={to}
                  className="group flex flex-col gap-2 rounded-card bg-surface p-4 shadow-soft transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-overlay focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring/40"
                >
                  <span className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] bg-green-100 text-green-900">
                      <Icon size={18} aria-hidden="true" />
                    </span>
                    <span className="flex-1 font-semibold text-ink">{label}</span>
                    <CaretRight
                      size={15}
                      aria-hidden="true"
                      className="shrink-0 text-ink-muted transition-transform group-hover:translate-x-0.5"
                    />
                  </span>
                  {schema ? (
                    <span className="line-clamp-3 text-sm leading-relaxed text-ink-muted">
                      {schema.description}
                    </span>
                  ) : null}
                  <span className="mt-auto flex items-center gap-3 pt-2 text-xs font-medium text-ink-muted">
                    {schema && !schema.fixed && count ? (
                      <span className="tabular">
                        {count.total} {count.total === 1 ? schema.singular : `${schema.singular}s`}
                      </span>
                    ) : null}
                    <Status isNew={false} isDirty={(count?.dirty ?? 0) > 0} />
                  </span>
                </Link>
              );
            },
          )}
        </div>
      </section>
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
      // A new entry starts as an emptied copy of an existing one, so it has
      // every field the collection uses rather than a blank form.
      const template = entries.data?.[0];
      let draft: Record<string, unknown> = {};
      if (template) {
        const existing = await api.get<CmsEntry>(`/cms/collections/${collection}/${template.slug}`);
        draft = Object.fromEntries(
          Object.entries(existing.draft).map(([key, value]) => [
            key,
            typeof value === 'string' ? '' : Array.isArray(value) ? [] : value,
          ]),
        );
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
        description={schema.description}
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
              : `Add the first ${schema.singular} to get started.`
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

/** A page's sections, in the order a visitor scrolls through them. */
function Outline({
  items,
  active,
  onSelect,
}: {
  items: Array<{ id: string; name: string; changed: boolean }>;
  active: string;
  onSelect: (id: string) => void;
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
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [section, setSection] = useState(DETAILS_SECTION);
  const [showTechnical, setShowTechnical] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [confirmRevert, setConfirmRevert] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const leaving = useRef(false);
  const paneRef = useRef<HTMLDivElement>(null);

  // Adopt the server's draft once per entry, keyed on the row id so moving to
  // another entry never leaves the previous one's words on screen.
  if (entry.data && loadedFor !== entry.data.id) {
    setLoadedFor(entry.data.id);
    setBody(entry.data.draft);
    // A search result links straight to a section as /pages/home#process.
    const hash = decodeURIComponent(location.hash.slice(1));
    setSection(hash && hash in entry.data.draft ? hash : DETAILS_SECTION);
  }

  const dirty = useMemo(
    () => (entry.data && body ? !same(body, entry.data.draft) : false),
    [body, entry.data],
  );

  // Nothing typed should be lost to a menu click, the back link or a closed tab.
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && !leaving.current && currentLocation.pathname !== nextLocation.pathname,
  );
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

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

  const save = useCallback(async (): Promise<boolean> => {
    if (!body) return false;
    setSaving(true);
    try {
      await api.put(`/cms/collections/${collection}/${slug}`, { draft: body });
      await entry.refetch();
      refresh();
      toast.success(
        isAdmin
          ? 'Saved as a draft. Publish to put it on the website.'
          : 'Saved. An administrator will publish it.',
      );
      return true;
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'That did not save.');
      return false;
    } finally {
      setSaving(false);
    }
  }, [body, collection, slug, entry, refresh, toast, isAdmin]);

  // Ctrl/Cmd+S saves, because that is where every editor's hand already goes.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        if (dirty && !saving) void save();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dirty, saving, save]);

  if (shellError) return <ErrorState message={shellError} onRetry={refresh} />;
  if (entry.error) return <ErrorState message={entry.error} onRetry={entry.refetch} />;
  if (!schema || !context || !entry.data || !body) return <LoadingState label="Opening…" />;

  const published = entry.data.published;
  const unpublished = dirty || entry.data.isDirty;
  const guide = collection === 'pages' ? PAGES[slug] : undefined;
  const title = guide?.name ?? (String(body[schema.titleField] ?? '') || slug);
  const path = sitePath(collection, slug);

  const publish = async () => {
    // Publishing what is on screen is what the button promises, so unsaved
    // edits are saved first rather than silently left behind.
    if (dirty && !(await save())) return;
    setPublishing(true);
    try {
      await api.post(`/cms/collections/${collection}/${slug}/publish`);
      await entry.refetch();
      refresh();
      toast.success('Published. The website is updating now.');
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'That did not publish.');
    } finally {
      setPublishing(false);
    }
  };

  const revert = async () => {
    setConfirmRevert(false);
    try {
      const restored = await api.post<CmsEntry>(`/cms/collections/${collection}/${slug}/revert`);
      setBody(restored.draft);
      await entry.refetch();
      refresh();
      toast.success('Back to exactly what the website is showing.');
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'That did not work.');
    }
  };

  const remove = async () => {
    setConfirmDelete(false);
    try {
      await api.delete(`/cms/collections/${collection}/${slug}`);
      refresh();
      toast.success('Deleted.');
      leaving.current = true;
      navigate(basePath);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'That could not be deleted.');
    }
  };

  /* ---- Pages step through their sections; everything else is one form ---- */
  let sidebar: ReactNode = null;
  let content: ReactNode;
  if (collection === 'pages') {
    const { scalars, sections } = splitSections(
      body,
      guide?.sections.map(([key]) => key),
    );
    const visibleScalars = scalars.filter((key) => showTechnical || !['id', 'index'].includes(key));
    const named = new Map(guide?.sections.map(([key, name, help]) => [key, { name, help }]));
    const items = [
      ...(visibleScalars.length > 0 ? [{ id: DETAILS_SECTION, ...DETAILS_GUIDE }] : []),
      ...sections.map((key) => ({
        id: key,
        name: named.get(key)?.name ?? humanize(key),
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

    if (current) sidebar = <Outline items={items} active={current.id} onSelect={select} />;
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

        <header className="mb-8">
          <p className="label-eyebrow">
            Section {at + 1} of {items.length}
          </p>
          <h2 id="section-title" className="mt-1.5 text-2xl font-bold tracking-tight text-ink">
            {current.name}
          </h2>
          {current.help ? (
            <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{current.help}</p>
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
          />
        )}

        <footer className="mt-12 flex flex-wrap justify-between gap-3">
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
      sidebar = <Siblings label={schema.label} rows={siblings.data!} basePath={basePath} />;
    content = <Fields body={body} context={context} />;
  }

  // What a Mac app keeps in its inspector: facts about the thing, not the thing.
  const inspector = (
    <div className="flex flex-col gap-8">
      <div>
        <p className="label-eyebrow mb-2">Status</p>
        <Status isNew={published === null} isDirty={unpublished} />
        <dl className="mt-3 flex flex-col gap-2 text-[13px]">
          <div>
            <dt className="text-ink-muted">Published</dt>
            <dd className="text-ink">
              {entry.data.published_at ? dateTime(entry.data.published_at) : 'Never'}
            </dd>
          </div>
          {entry.data.updated_by ? (
            <div>
              <dt className="text-ink-muted">Last edited</dt>
              <dd className="text-ink">
                {entry.data.updated_by}, {dateTime(entry.data.updated_at)}
              </dd>
            </div>
          ) : null}
        </dl>
        {path ? (
          <a
            href={`${WEB_URL}${path}`}
            target="_blank"
            rel="noopener"
            className="mt-4 inline-flex min-h-9 items-center gap-1.5 rounded-control text-sm font-semibold text-green-900 hover:underline pointer-coarse:min-h-11"
          >
            <ArrowSquareOut size={15} aria-hidden="true" />
            View on the website
          </a>
        ) : null}
      </div>

      {guide ? (
        <div>
          <p className="label-eyebrow mb-2">About this page</p>
          <p className="text-[13px] leading-relaxed text-ink-muted">{guide.summary}</p>
        </div>
      ) : null}

      <Toggle
        label="Show technical fields"
        description="Screen-reader labels, ids and 3D camera settings. Rarely needed."
        checked={showTechnical}
        onChange={setShowTechnical}
      />

      {isAdmin && !schema.fixed ? (
        <div>
          <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
            Delete this {schema.singular}
          </Button>
        </div>
      ) : null}
    </div>
  );

  return (
    // Three panes, each scrolling on its own: sidebar, the document, inspector.
    <div className="flex h-full min-h-0">
      {sidebar ? (
        <aside className="hidden w-64 shrink-0 overflow-y-auto border-r border-border bg-surface-muted/45 px-2.5 py-5 lg:block">
          {sidebar}
        </aside>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col bg-surface">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border px-5 py-3 sm:px-8">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold tracking-tight text-ink md:text-xl">{title}</h1>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-muted">
              <Status isNew={published === null} isDirty={unpublished} />
              {dirty ? <span className="font-semibold text-ink">· Not saved</span> : null}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {published !== null && unpublished ? (
              <Button variant="ghost" onClick={() => setConfirmRevert(true)}>
                Undo changes
              </Button>
            ) : null}
            <Button
              variant="secondary"
              onClick={() => void save()}
              loading={saving}
              disabled={!dirty}
            >
              Save draft
            </Button>
            {isAdmin ? (
              <Button
                variant="primary"
                onClick={publish}
                loading={publishing}
                disabled={!unpublished}
              >
                Publish
              </Button>
            ) : null}
          </div>
        </div>

        <div ref={paneRef} className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[52rem] px-5 pb-[calc(env(safe-area-inset-bottom)+3rem)] pt-7 sm:px-8 lg:pt-9">
            {content}
            {/* No inspector column below xl: its contents follow the form. */}
            <div className="mt-14 xl:hidden">{inspector}</div>
          </div>
        </div>
      </div>

      <aside className="hidden w-72 shrink-0 overflow-y-auto border-l border-border bg-surface-muted/45 px-5 py-6 xl:block">
        {inspector}
      </aside>

      <ConfirmDialog
        open={confirmRevert}
        title="Undo these changes?"
        message="Everything changed since the last publish is thrown away, and this goes back to exactly what the website is showing."
        confirmLabel="Undo changes"
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
      <ConfirmDialog
        open={blocker.state === 'blocked'}
        title="Leave without saving?"
        message="You have changes that are not saved. Leaving now throws them away."
        confirmLabel="Discard changes"
        onConfirm={() => blocker.proceed?.()}
        onCancel={() => blocker.reset?.()}
      />
    </div>
  );
}
