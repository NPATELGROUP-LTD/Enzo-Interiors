import { ArrowLeft, ArrowSquareOut, CloudCheck, Plus, Trash } from '@phosphor-icons/react';
import { useCallback, useMemo, useState } from 'react';

import {
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  PageHeader,
  StatusTag,
  TableSkeleton,
  TableWrap,
  Tabs,
  Td,
  Th,
  type StatusTone,
} from '@/components/ui';
import { JsonEditor, JsonField, humanize, removeAt, setIn, type Path } from '@/components/cms/JsonEditor';
import { WEB_URL } from '@/components/cms/MediaPicker';
import { DETAILS_SECTION, splitSections } from '@/components/cms/paths';
import { useToast } from '@/components/ui/Toast';
import { useQuery } from '@/hooks/useApi';
import { ApiError, api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { dateTime } from '@/lib/format';
import type {
  CmsEntry,
  CmsEntrySummary,
  CmsOverview,
  CollectionSchema,
  MediaAsset,
} from '@/types/cms';

/** Live / unpublished changes / never published, as one badge. */
function PublishState({ entry }: { entry: { isNew: boolean; isDirty: boolean } }) {
  const [tone, label]: [StatusTone, string] = entry.isNew
    ? ['warning', 'Not published']
    : entry.isDirty
      ? ['info', 'Unpublished changes']
      : ['success', 'Live'];
  return <StatusTag tone={tone}>{label}</StatusTag>;
}

/* -------------------------------------------------------------------------- */
/* Editor                                                                     */
/* -------------------------------------------------------------------------- */

function EntryEditor({
  schema,
  slug,
  assets,
  options,
  onBack,
  onChanged,
}: {
  schema: CollectionSchema;
  slug: string;
  assets: MediaAsset[];
  options: Record<string, Array<{ slug: string; title: string }>>;
  onBack: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const { isAdmin } = useAuth();
  const entry = useQuery<CmsEntry>(`/cms/collections/${schema.collection}/${slug}`);

  /** The working copy. Null until loaded, then always the editable draft. */
  const [body, setBody] = useState<Record<string, unknown> | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [confirmRevert, setConfirmRevert] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  /** Which pane of the rail is on screen. */
  const [section, setSection] = useState(DETAILS_SECTION);

  // Adopt the server's draft once per entry. Keyed on the row id rather than a
  // bare `if (!body)` so switching entries does not keep the previous one's
  // content on screen.
  if (entry.data && loadedFor !== entry.data.id) {
    setLoadedFor(entry.data.id);
    setBody(entry.data.draft);
    setSection(DETAILS_SECTION);
  }

  const dirtyLocally = useMemo(
    () => (entry.data && body ? JSON.stringify(body) !== JSON.stringify(entry.data.draft) : false),
    [body, entry.data],
  );

  const context = useMemo(
    () => ({
      schema,
      assets,
      options,
      onChange: (path: Path, value: unknown) =>
        setBody((current) => (current ? (setIn(current, path, value) as Record<string, unknown>) : current)),
      onRemove: (path: Path) =>
        setBody((current) => (current ? (removeAt(current, path) as Record<string, unknown>) : current)),
    }),
    [schema, assets, options],
  );

  const save = useCallback(async (): Promise<boolean> => {
    if (!body) return false;
    setSaving(true);
    try {
      await api.put(`/cms/collections/${schema.collection}/${slug}`, { draft: body });
      await entry.refetch();
      onChanged();
      toast.success('Saved. It is not on the website until you publish it.');
      return true;
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'That did not save.');
      return false;
    } finally {
      setSaving(false);
    }
  }, [body, entry, onChanged, schema.collection, slug, toast]);

  const publish = async () => {
    // Publishing what is on screen is what the button appears to promise, so
    // unsaved edits are saved first rather than silently left behind.
    if (dirtyLocally && !(await save())) return;
    setPublishing(true);
    try {
      await api.post(`/cms/collections/${schema.collection}/${slug}/publish`);
      await entry.refetch();
      onChanged();
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
      const restored = await api.post<CmsEntry>(
        `/cms/collections/${schema.collection}/${slug}/revert`,
      );
      setBody(restored.draft);
      await entry.refetch();
      onChanged();
      toast.success('Put back to what the website is showing.');
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'That did not work.');
    }
  };

  if (entry.loading && !body) return <LoadingState label="Opening…" />;
  if (entry.error) return <ErrorState message={entry.error} onRetry={entry.refetch} />;
  if (!entry.data || !body) return null;

  const unpublished = dirtyLocally || entry.data.isDirty;

  const { scalars, sections } = splitSections(body);
  // One section is not worth a rail: a testimonial or a FAQ is a short form,
  // and splitting it in two would add a click to reach half of it.
  const railed = sections.length > 1;

  // A page whose keys are all sections has no Details pane, so the rail opens
  // on the first section instead of on an empty one.
  const fallback = scalars.length > 0 ? DETAILS_SECTION : (sections[0] ?? DETAILS_SECTION);
  const selectable =
    section === DETAILS_SECTION ? scalars.length > 0 : sections.includes(section);
  const active = railed && selectable ? section : fallback;
  const activeValue = active === DETAILS_SECTION ? null : body[active];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={String(body[schema.titleField] ?? slug)}
        description={`${schema.singular.charAt(0).toUpperCase()}${schema.singular.slice(1)} · ${slug}`}
        actions={
          <>
            <Button
              variant="ghost"
              // Leaving throws away unsaved edits, so it asks first. The
              // previous behaviour lost a page of retyped copy to a misclick
              // on a button labelled "All pages".
              onClick={() => (dirtyLocally ? setConfirmLeave(true) : onBack())}
              icon={<ArrowLeft size={16} />}
            >
              All {schema.label.toLowerCase()}
            </Button>
            {entry.data.published !== null ? (
              <Button variant="secondary" onClick={() => setConfirmRevert(true)} disabled={!unpublished}>
                Undo changes
              </Button>
            ) : null}
            <Button variant="secondary" onClick={save} loading={saving} disabled={!dirtyLocally}>
              Save
            </Button>
            {isAdmin ? (
              <Button variant="primary" onClick={publish} loading={publishing} disabled={!unpublished}>
                Publish
              </Button>
            ) : null}
          </>
        }
      />

      <div
        className="flex flex-wrap items-center gap-2 rounded-card bg-surface px-3.5 py-2.5 shadow-soft"
        role="status"
      >
        <PublishState entry={{ isNew: entry.data.published === null, isDirty: unpublished }} />
        <span className="text-xs text-ink-muted">
          {entry.data.published_at
            ? `Last published ${dateTime(entry.data.published_at)}`
            : 'This has never been on the website.'}
          {entry.data.updated_by ? ` · Last edited by ${entry.data.updated_by}` : ''}
        </span>
        {!isAdmin ? (
          <span className="text-xs text-ink-muted">
            You can save changes; an administrator publishes them.
          </span>
        ) : null}
      </div>

      {railed ? (
        <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[13rem_1fr] lg:items-start lg:gap-5">
          {/* The page's own sections, as the map of the page. Same rail as the
              collection list uses, so the two levels read the same way. */}
          <Tabs
            vertical
            active={active}
            onChange={setSection}
            tabs={[
              ...(scalars.length > 0
                ? [{ id: DETAILS_SECTION, label: 'Details', count: scalars.length }]
                : []),
              ...sections.map((key) => ({
                id: key,
                label: humanize(key),
                count: Array.isArray(body[key])
                  ? (body[key] as unknown[]).length
                  : Object.keys(body[key] as object).length,
              })),
            ]}
          />

          <div className="min-w-0 rounded-card bg-surface p-4 shadow-soft">
            {active === DETAILS_SECTION ? (
              <JsonEditor
                body={Object.fromEntries(scalars.map((key) => [key, body[key]]))}
                context={context}
              />
            ) : Array.isArray(activeValue) ? (
              // A top-level list keeps its own group chrome — the add, reorder
              // and remove controls live on it.
              <JsonField keyName={active} value={activeValue} path={[active]} context={context} />
            ) : (
              // An object section is rendered flat: the pane is already
              // labelled by the rail, so a collapsible header saying the same
              // word again is a click between the editor and the words.
              <JsonEditor
                body={activeValue as Record<string, unknown>}
                context={context}
                prefix={[active]}
              />
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-card bg-surface p-4 shadow-soft">
          <JsonEditor body={body} context={context} />
        </div>
      )}

      <ConfirmDialog
        open={confirmRevert}
        title="Undo these changes?"
        message="Your unpublished edits will be thrown away and this will go back to exactly what the website is showing."
        confirmLabel="Undo changes"
        onConfirm={revert}
        onCancel={() => setConfirmRevert(false)}
      />

      <ConfirmDialog
        open={confirmLeave}
        title="Leave without saving?"
        message="You have changes that have not been saved. Leaving now throws them away."
        confirmLabel="Discard changes"
        onConfirm={() => {
          setConfirmLeave(false);
          onBack();
        }}
        onCancel={() => setConfirmLeave(false)}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export function CmsPage() {
  const toast = useToast();
  const { isAdmin } = useAuth();

  const overview = useQuery<CmsOverview>('/cms/overview');
  const assets = useQuery<MediaAsset[]>('/cms/media');
  const services = useQuery<CmsEntrySummary[]>('/cms/collections/services');
  const projects = useQuery<CmsEntrySummary[]>('/cms/collections/portfolio');

  const [collection, setCollection] = useState('pages');
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [newSlug, setNewSlug] = useState('');
  const [deleting, setDeleting] = useState<CmsEntrySummary | null>(null);
  const [publishingAll, setPublishingAll] = useState(false);

  const entries = useQuery<CmsEntrySummary[]>(`/cms/collections/${collection}`);
  const schema = overview.data?.schemas.find((row) => row.collection === collection) ?? null;

  const options = useMemo(
    () => ({
      services: (services.data ?? []).map((row) => ({ slug: row.slug, title: row.title })),
      portfolio: (projects.data ?? []).map((row) => ({ slug: row.slug, title: row.title })),
    }),
    [services.data, projects.data],
  );

  const refreshCounts = useCallback(() => {
    void overview.refetch();
    void entries.refetch();
  }, [overview, entries]);

  const totalDirty = useMemo(
    () =>
      Object.values(overview.data?.counts ?? {}).reduce((total, count) => total + count.dirty, 0),
    [overview.data],
  );

  const rows = useMemo(() => {
    const all = entries.data ?? [];
    const needle = search.trim().toLowerCase();
    if (!needle) return all;
    // Slug included: it is the web address, and it is what someone pastes in
    // when they have the URL of the page they need to fix and not its title.
    return all.filter((row) =>
      [row.title, row.slug, ...Object.values(row.columns)].some((field) =>
        String(field ?? '').toLowerCase().includes(needle),
      ),
    );
  }, [entries.data, search]);

  const publishAll = async () => {
    setPublishingAll(true);
    try {
      const result = await api.post<{ published: number }>('/cms/publish');
      refreshCounts();
      toast.success(
        result.published === 0
          ? 'Everything was already live.'
          : `Published ${result.published} ${result.published === 1 ? 'change' : 'changes'}. The website is updating now.`,
      );
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'That did not publish.');
    } finally {
      setPublishingAll(false);
    }
  };

  const create = async () => {
    if (!schema) return;
    const template = entries.data?.[0];
    if (!template) {
      toast.error('Add the first one by hand in the database, so it has a shape to copy.');
      return;
    }
    try {
      // A new entry starts as a blank copy of an existing one, so it arrives
      // with every field the collection uses rather than an empty object the
      // editor has nothing to render.
      const existing = await api.get<CmsEntry>(
        `/cms/collections/${collection}/${template.slug}`,
      );
      const blank = Object.fromEntries(
        Object.entries(existing.draft).map(([key, value]) => [
          key,
          typeof value === 'string' ? '' : Array.isArray(value) ? [] : value,
        ]),
      );
      await api.post(`/cms/collections/${collection}`, { slug: newSlug.trim(), draft: blank });
      setCreating(false);
      setNewSlug('');
      refreshCounts();
      setOpenSlug(newSlug.trim());
      toast.success(`New ${schema.singular} created. Fill it in, then publish.`);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'That could not be created.');
    }
  };

  const remove = async () => {
    if (!deleting) return;
    const target = deleting;
    setDeleting(null);
    try {
      await api.delete(`/cms/collections/${collection}/${target.slug}`);
      refreshCounts();
      toast.success('Deleted.');
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'That could not be deleted.');
    }
  };

  if (overview.loading) return <LoadingState label="Loading the website content…" />;
  if (overview.error) return <ErrorState message={overview.error} onRetry={overview.refetch} />;
  if (!overview.data) return null;

  if (openSlug && schema) {
    return (
      <EntryEditor
        schema={schema}
        slug={openSlug}
        assets={assets.data ?? []}
        options={options}
        onBack={() => {
          setOpenSlug(null);
          refreshCounts();
        }}
        onChanged={refreshCounts}
      />
    );
  }

  return (
    <div>
      <PageHeader
        title="Website"
        description="Everything the public site says and shows. Changes are saved as a draft first, and only appear online once you publish them."
        actions={
          <>
            <Button
              variant="ghost"
              onClick={() => window.open(WEB_URL, '_blank', 'noopener')}
              icon={<ArrowSquareOut size={16} />}
            >
              View site
            </Button>
            {isAdmin ? (
              <Button
                variant="primary"
                onClick={publishAll}
                loading={publishingAll}
                disabled={totalDirty === 0}
                icon={<CloudCheck size={16} />}
              >
                {totalDirty === 0 ? 'Everything is live' : `Publish ${totalDirty} change${totalDirty === 1 ? '' : 's'}`}
              </Button>
            ) : null}
          </>
        }
      />

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[15rem_1fr] lg:items-start lg:gap-5">
        <Tabs
          vertical
          active={collection}
          onChange={(next) => {
            setCollection(next);
            setOpenSlug(null);
            setSearch('');
          }}
          tabs={overview.data.schemas.map((row) => ({
            id: row.collection,
            label: row.label,
            count: overview.data!.counts[row.collection]?.dirty || undefined,
          }))}
        />

        <section className="flex min-w-0 flex-col gap-3">
          {schema ? (
            <div className="flex flex-wrap items-end justify-between gap-3">
              <p className="max-w-2xl text-sm text-ink-muted">{schema.description}</p>
              {isAdmin && !schema.fixed ? (
                <Button variant="secondary" onClick={() => setCreating(true)} icon={<Plus size={16} />}>
                  New {schema.singular}
                </Button>
              ) : null}
            </div>
          ) : null}

          {/* Only once the list is long enough to be worth searching. Below
              that the box is a control that costs more attention than the
              scan it replaces. */}
          {(entries.data ?? []).length > 6 ? (
            <Input
              label={`Search ${schema?.label.toLowerCase() ?? 'entries'}`}
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Name or web address"
            />
          ) : null}

          {entries.loading ? (
            <TableSkeleton rows={6} columns={4} />
          ) : entries.error ? (
            <ErrorState message={entries.error} onRetry={entries.refetch} />
          ) : (entries.data ?? []).length === 0 ? (
            <EmptyState title="Nothing here yet" message="Add the first one to get started." />
          ) : rows.length === 0 ? (
            <EmptyState
              title="Nothing matches that"
              message={`No ${schema?.label.toLowerCase() ?? 'entry'} has “${search.trim()}” in its name or web address.`}
            />
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <Th>Name</Th>
                  {schema?.listColumns.map((column) => <Th key={column}>{humanize(column)}</Th>)}
                  <Th>Status</Th>
                  <Th>Last edited</Th>
                  <Th className="text-right">{''}</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <Td>
                      <button
                        type="button"
                        onClick={() => setOpenSlug(row.slug)}
                        className="text-left font-semibold text-ink underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring/35"
                      >
                        {row.title}
                      </button>
                    </Td>
                    {schema?.listColumns.map((column) => (
                      <Td key={column}>{row.columns[column] || '—'}</Td>
                    ))}
                    <Td>
                      <PublishState entry={row} />
                    </Td>
                    <Td>{dateTime(row.updated_at)}</Td>
                    <Td className="text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button variant="ghost" onClick={() => setOpenSlug(row.slug)}>
                          Edit
                        </Button>
                        {isAdmin && !schema?.fixed ? (
                          <Button
                            variant="ghost"
                            onClick={() => setDeleting(row)}
                            aria-label={`Delete ${row.title}`}
                            icon={<Trash size={15} />}
                          >
                            {''}
                          </Button>
                        ) : null}
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={creating}
        title={`New ${schema?.singular ?? 'entry'}`}
        confirmLabel="Create"
        onConfirm={create}
        onCancel={() => {
          setCreating(false);
          setNewSlug('');
        }}
        message={
          <div className="flex flex-col gap-3">
            <p>Give it a short web address. Lowercase letters, numbers and hyphens.</p>
            <Input
              label="Web address"
              value={newSlug}
              onChange={(event) => setNewSlug(event.target.value)}
              placeholder="walnut-kitchen-oadby"
            />
          </div>
        }
      />

      <ConfirmDialog
        open={deleting !== null}
        title={`Delete ${deleting?.title ?? ''}?`}
        message="This removes it from the website and cannot be undone."
        confirmLabel="Delete"
        onConfirm={remove}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
