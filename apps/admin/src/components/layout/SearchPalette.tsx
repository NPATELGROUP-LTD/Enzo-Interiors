import clsx from 'clsx';
import {
  ArrowSquareOut,
  Browsers,
  CloudCheck,
  Gear,
  Image as ImageIcon,
  MagnifyingGlass,
  Moon,
  SignOut,
  SquaresFour,
  TextAlignLeft,
  type Icon as PhosphorIcon,
} from '@phosphor-icons/react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import { PAGES } from '@/components/cms/guide';
import { WEB_URL } from '@/components/cms/MediaPicker';
import { api } from '@/lib/api';

import { SECTIONS } from './AdminLayout';

interface Hit {
  collection: string;
  slug: string;
  title: string;
  section: string | null;
  snippet: string;
}

interface Result {
  id: string;
  group: string;
  label: string;
  detail?: string;
  Icon: PhosphorIcon;
  run: () => void;
}

export interface PaletteActions {
  isAdmin: boolean;
  unpublished: number;
  publishAll: () => void;
  toggleTheme: () => void;
  signOut: () => void;
}

const MODIFIER = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';

/** The editor route for a collection, from the menu's own list. */
function routeFor(collection: string, slug: string): string {
  const section = SECTIONS.find((row) => row.collection === collection);
  if (!section) return '/cms';
  if (collection === 'company') return section.to;
  return `${section.to}/${slug}`;
}

/** Matches every word of the query somewhere in the text. */
function matches(query: string, text: string): boolean {
  const haystack = text.toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}

/**
 * Spotlight for the admin: every page, every section of every page, the shared
 * content types, Settings and the common actions, plus a search through the
 * words themselves. Opened from the menu bar or with Ctrl/⌘ K.
 *
 * A native <dialog>, so it sits in the top layer above the glass menu bar and
 * gets Escape, focus trapping and the backdrop for free.
 */
export function SearchPalette({ open, onClose, actions }: {
  open: boolean;
  onClose: () => void;
  actions: PaletteActions;
}) {
  const navigate = useNavigate();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<{ entries: Hit[]; media: Array<{ id: string; alt: string }> } | null>(null);
  const [active, setActive] = useState(0);
  const [failed, setFailed] = useState(false);

  // A layout effect, so the input has focus before the next keystroke lands:
  // people press Ctrl K and start typing in the same breath.
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      setQuery('');
      setHits(null);
      setActive(0);
      inputRef.current?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // The words search, debounced; the local commands filter instantly.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits(null);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      api
        .get<{ entries: Hit[]; media: Array<{ id: string; alt: string }> }>(`/cms/search?q=${encodeURIComponent(q)}`)
        .then((result) => {
          if (cancelled) return;
          setHits(result);
          setFailed(false);
        })
        .catch(() => {
          if (cancelled) return;
          // Pages, sections and commands still match; only the words search is out.
          setHits({ entries: [], media: [] });
          setFailed(true);
        });
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  const results = useMemo<Result[]>(() => {
    const go = (to: string) => () => {
      onClose();
      navigate(to);
    };
    const local: Result[] = [
      { id: 'overview', group: 'Go to', label: 'Overview', detail: 'Everything on the website', Icon: SquaresFour, run: go('/cms') },
      ...Object.entries(PAGES).map(([slug, page]) => ({
        id: `page-${slug}`,
        group: 'Pages',
        label: page.name,
        detail: page.path ?? 'On every page',
        Icon: Browsers,
        run: go(`/pages/${slug}`),
      })),
      ...Object.entries(PAGES).flatMap(([slug, page]) =>
        page.sections.map(([key, name, help]) => ({
          id: `section-${slug}-${key}`,
          group: 'Sections',
          label: `${page.name} › ${name}`,
          detail: help,
          Icon: TextAlignLeft,
          run: go(`/pages/${slug}#${key}`),
        })),
      ),
      ...SECTIONS.filter((row) => row.collection !== 'pages').map((row) => ({
        id: `shared-${row.collection}`,
        group: 'Shared content',
        label: row.label,
        Icon: row.Icon,
        run: go(row.to),
      })),
      ...(actions.isAdmin
        ? [{ id: 'settings', group: 'Go to', label: 'Settings', detail: 'Launch date, notifications', Icon: Gear, run: go('/settings') }]
        : []),
      ...(actions.isAdmin && actions.unpublished > 0
        ? [{
            id: 'publish',
            group: 'Actions',
            label: `Publish all (${actions.unpublished})`,
            Icon: CloudCheck,
            run: () => {
              onClose();
              actions.publishAll();
            },
          }]
        : []),
      {
        id: 'site',
        group: 'Actions',
        label: 'Open the website',
        Icon: ArrowSquareOut,
        run: () => {
          onClose();
          window.open(WEB_URL, '_blank', 'noopener');
        },
      },
      {
        id: 'theme',
        group: 'Actions',
        label: 'Switch light / dark',
        Icon: Moon,
        run: () => {
          onClose();
          actions.toggleTheme();
        },
      },
      {
        id: 'signout',
        group: 'Actions',
        label: 'Sign out',
        Icon: SignOut,
        run: () => {
          onClose();
          actions.signOut();
        },
      },
    ];

    const q = query.trim();
    // With nothing typed, the short list: where you can go and what you can do.
    const shown = q
      ? local.filter((row) => matches(q, `${row.group} ${row.label} ${row.detail ?? ''}`))
      : local.filter((row) => row.group !== 'Sections');

    const content: Result[] = (hits?.entries ?? []).map((hit) => ({
      id: `hit-${hit.collection}-${hit.slug}-${hit.section ?? ''}`,
      group: 'In the words',
      label: hit.section && hit.collection === 'pages'
        ? `${PAGES[hit.slug]?.name ?? hit.title} › ${PAGES[hit.slug]?.sections.find(([key]) => key === hit.section)?.[1] ?? hit.section}`
        : hit.title,
      detail: hit.snippet,
      Icon: TextAlignLeft,
      run: go(`${routeFor(hit.collection, hit.slug)}${hit.section && hit.collection === 'pages' ? `#${hit.section}` : ''}`),
    }));
    const pictures: Result[] = (hits?.media ?? []).map((row) => ({
      id: `media-${row.id}`,
      group: 'Pictures',
      label: row.alt || row.id,
      detail: 'Used on the website. Open a page to swap it.',
      Icon: ImageIcon,
      run: () => undefined,
    }));

    return [...shown.slice(0, 40), ...content, ...pictures];
  }, [query, hits, actions, navigate, onClose]);

  const clamped = Math.min(active, Math.max(0, results.length - 1));

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      const next = (clamped + step + results.length) % Math.max(1, results.length);
      setActive(next);
      document.getElementById(`palette-${next}`)?.scrollIntoView({ block: 'nearest' });
    } else if (event.key === 'Enter') {
      event.preventDefault();
      results[clamped]?.run();
    }
  };

  let lastGroup = '';

  return (
    <dialog
      ref={dialogRef}
      aria-label="Search"
      onClose={onClose}
      // A click on the backdrop lands on the dialog element itself.
      onClick={(event) => event.target === dialogRef.current && onClose()}
      className="glass m-auto mt-[12vh] w-[min(40rem,calc(100vw-2rem))] overflow-hidden rounded-[14px] border border-glass-border p-0 text-ink shadow-window backdrop:bg-black/25 backdrop:backdrop-blur-[2px]"
    >
      <div className="flex items-center gap-3 border-b border-border px-4">
        <MagnifyingGlass size={18} aria-hidden="true" className="shrink-0 text-ink-muted" />
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          placeholder="Search pages, sections and words…"
          aria-label="Search"
          role="combobox"
          aria-expanded="true"
          aria-controls="palette-results"
          aria-activedescendant={results.length ? `palette-${clamped}` : undefined}
          className="h-14 min-w-0 flex-1 bg-transparent text-[17px] outline-none placeholder:text-ink-muted"
        />
        <kbd className="hidden rounded-[5px] border border-border px-1.5 py-0.5 text-[11px] text-ink-muted sm:block">Esc</kbd>
      </div>

      <ul id="palette-results" role="listbox" aria-label="Results" className="max-h-[min(60vh,28rem)] overflow-y-auto p-1.5">
        {results.length === 0 ? (
          <li className="px-3 py-8 text-center text-sm text-ink-muted">
            {query.trim().length >= 2 && hits === null
              ? 'Searching…'
              : failed
                ? 'Could not search the content just now. Try again in a moment.'
                : `Nothing matches "${query.trim()}".`}
          </li>
        ) : null}
        {results.map((row, index) => {
          const heading = row.group !== lastGroup ? row.group : null;
          lastGroup = row.group;
          const Icon = row.Icon;
          return (
            <li key={row.id} role="presentation">
              {heading ? (
                <p className="px-2.5 pb-1 pt-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">
                  {heading}
                </p>
              ) : null}
              <div
                id={`palette-${index}`}
                role="option"
                aria-selected={index === clamped}
                onMouseMove={() => setActive(index)}
                onClick={row.run}
                className={clsx(
                  'flex cursor-default items-center gap-3 rounded-[8px] px-2.5 py-2',
                  index === clamped ? 'bg-green-900 text-on-primary' : 'text-ink',
                )}
              >
                <Icon size={17} aria-hidden="true" className="shrink-0 opacity-80" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{row.label}</span>
                  {row.detail ? (
                    <span
                      className={clsx(
                        'block truncate text-xs',
                        index === clamped ? 'text-on-primary/75' : 'text-ink-muted',
                      )}
                    >
                      {row.detail}
                    </span>
                  ) : null}
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="flex items-center justify-between border-t border-border px-4 py-2 text-[11px] text-ink-muted">
        <span>↑ ↓ to move · Enter to open</span>
        <span>{MODIFIER} K</span>
      </p>
    </dialog>
  );
}

/** Opens the palette on Ctrl/⌘ K from anywhere in the admin. */
export function usePaletteShortcut(open: () => void): void {
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        open();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
}

export { MODIFIER };
