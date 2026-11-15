import clsx from 'clsx';
import {
  AddressBook,
  EnvelopeSimple,
  ArrowSquareOut,
  Browsers,
  CalendarCheck,
  CloudCheck,
  Gauge,
  UserCircle,
  Image as ImageIcon,
  ChatsCircle,
  Kanban,
  MagnifyingGlass,
  Moon,
  Receipt,
  SignOut,
  SquaresFour,
  TextAlignLeft,
  X,
  type Icon as PhosphorIcon,
} from '@phosphor-icons/react';
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import { PAGES } from '@/components/cms/guide';
import { WEB_URL } from '@/components/cms/MediaPicker';
import { api } from '@/lib/api';

import { settingsSections } from '@/pages/SiteSettings';

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
  /** May open the CRM: clients and projects (Admin, Designer). */
  clients: boolean;
  /** May open the CMS (Admin, Editor). */
  cms: boolean;
  unpublished: number;
  publishAll: () => void;
  toggleTheme: () => void;
  signOut: () => void;
}

const RECORD_ICONS: Record<string, PhosphorIcon> = { client: AddressBook, project: Kanban, invoice: Receipt, enquiry: EnvelopeSimple, booking: CalendarCheck };

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
 * The menu bar's search: the bar is the input and the results drop under it
 * (no dialog). Every page, section, shared content type, Settings pane, action,
 * record and a search through the words. Ctrl/⌘ K focuses it from anywhere
 * (`focusSearch`). Below md it is a magnifier that opens the bar across the menu bar.
 */
export function focusSearch(first?: string) {
  window.dispatchEvent(new CustomEvent('enzo:search', { detail: first ?? '' }));
}

export function SearchPalette({ actions }: { actions: PaletteActions }) {
  const navigate = useNavigate();
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [wide, setWide] = useState(false);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<{ entries: Hit[]; media: Array<{ id: string; alt: string }> } | null>(null);
  const [active, setActive] = useState(0);
  const [failed, setFailed] = useState(false);
  /** Records (clients, projects, invoices, enquiries, bookings) matching the words or a reference. */
  const [recordsFor, setRecordsFor] = useState('');
  const [records, setRecords] = useState<Array<{ type: string; id: string; title: string; detail: string; link: string }>>([]);

  const onClose = useCallback(() => {
    setOpen(false);
    setWide(false);
    setQuery('');
    setHits(null);
    setActive(0);
    inputRef.current?.blur();
  }, []);

  // Ctrl/⌘ K (and the 404 page's button) focus the bar, with any letters already typed.
  useEffect(() => {
    const focus = (first: string) => {
      setWide(true);
      setOpen(true);
      if (first) setQuery(first);
      inputRef.current?.focus();
    };
    const onEvent = (event: Event) => focus((event as CustomEvent<string>).detail);
    const onKey = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        focus('');
      }
    };
    window.addEventListener('enzo:search', onEvent);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('enzo:search', onEvent);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  // The phone's bar appears on tap, so focus it once it is on screen.
  useEffect(() => {
    if (wide) inputRef.current?.focus();
  }, [wide]);


  // Records by reference or a small detail ("PRJ-0012", a name, an email, a phone number); Admin and Designers.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2 || !actions.clients) {
      setRecords([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      api
        .get<{ results: typeof records }>(`/search?q=${encodeURIComponent(q)}`)
        .then((found) => {
          if (cancelled) return;
          setRecords(found.results);
          setRecordsFor(q);
        })
        .catch(() => !cancelled && setRecords([]));
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, actions.clients]);

  // The words search, debounced; the local commands filter instantly.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2 || !actions.cms) {
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
  }, [query, actions.cms]);

  const results = useMemo<Result[]>(() => {
    const go = (to: string) => () => {
      onClose();
      navigate(to);
    };
    const local: Result[] = [
      ...(actions.cms
        ? [
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
          ]
        : []),
      ...(actions.clients
        ? [
            { id: 'dashboard', group: 'Go to', label: 'Dashboard', detail: 'Projects, and for an Admin the money and enquiries', Icon: Gauge, run: go('/') },
            { id: 'clients', group: 'Go to', label: 'Clients', detail: 'Client records, portal invitations', Icon: AddressBook, run: go('/clients') },
            { id: 'projects', group: 'Go to', label: 'Projects', detail: 'The five-stage board, from consultation to completed', Icon: Kanban, run: go('/projects') },
            { id: 'messages', group: 'Go to', label: 'Messages', detail: 'Conversations with clients', Icon: ChatsCircle, run: go('/messages') },
          ]
        : []),
      ...(actions.isAdmin
        ? [
            { id: 'enquiries', group: 'Go to', label: 'Enquiries', detail: 'Messages from the website’s forms', Icon: EnvelopeSimple, run: go('/enquiries') },
            { id: 'bookings', group: 'Go to', label: 'Bookings', detail: 'Consultations, new booking', Icon: CalendarCheck, run: go('/bookings') },
            ...settingsSections(false).map((row) => ({
              id: `settings-${row.id}`,
              group: 'Settings',
              label: `Settings › ${row.label}`,
              detail: row.detail,
              Icon: row.Icon,
              run: go(`/settings/${row.id}`),
            })),
          ]
        : []),
      { id: 'account', group: 'Go to', label: 'Account settings', detail: 'Your name, password, appearance', Icon: UserCircle, run: go('/account') },
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

    const found: Result[] = (recordsFor === query.trim() ? records : []).map((record) => ({
      id: `record-${record.type}-${record.id}`,
      group: 'Records',
      label: record.title,
      detail: record.detail,
      Icon: RECORD_ICONS[record.type] ?? AddressBook,
      run: go(record.link),
    }));

    // A reference or a name that matches a record is what was asked for, so it comes first.
    return [...found, ...shown.slice(0, 40), ...content, ...pictures];
  }, [query, hits, records, recordsFor, actions, navigate, onClose]);

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
    <>
      <button
        type="button"
        onClick={() => {
          setWide(true);
          setOpen(true);
        }}
        aria-label="Search"
        className="flex h-9 w-9 items-center justify-center rounded-[8px] text-ink-muted hover:bg-ink/10 hover:text-ink md:hidden pointer-coarse:h-11 pointer-coarse:w-11"
      >
        <MagnifyingGlass size={18} weight="bold" aria-hidden="true" />
      </button>
      <div
        ref={wrapRef}
        onBlur={(event) => {
          if (!wrapRef.current?.contains(event.relatedTarget as Node | null)) onClose();
        }}
        className={clsx(
          'w-full max-w-md md:relative md:block',
          wide ? 'max-md:absolute max-md:inset-0 max-md:z-10 max-md:flex max-md:items-center max-md:bg-canvas max-md:px-2' : 'max-md:hidden',
        )}
      >
        <label className="flex h-8 w-full items-center gap-2 rounded-[8px] border border-glass-border bg-ink/[0.04] px-2.5 font-normal text-ink-muted transition-colors focus-within:border-green-700 focus-within:bg-surface focus-within:text-ink hover:bg-ink/10 pointer-coarse:h-10">
          <MagnifyingGlass size={15} weight="bold" aria-hidden="true" className="shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onFocus={() => setOpen(true)}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
              setOpen(true);
            }}
            onKeyDown={(event) => (event.key === 'Escape' ? onClose() : onKeyDown(event))}
            placeholder="Search clients, projects, pages…"
            aria-label={`Search (${MODIFIER} K)`}
            role="combobox"
            aria-expanded={open}
            aria-controls="palette-results"
            aria-activedescendant={open && results.length ? `palette-${clamped}` : undefined}
            autoComplete="off"
            className="h-full min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-muted"
          />
          <kbd className="hidden shrink-0 rounded-[5px] border border-border px-1.5 py-px text-[12px] leading-5 md:block">{MODIFIER} K</kbd>
          <button type="button" onClick={onClose} aria-label="Close search" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full hover:bg-ink/10 md:hidden">
            <X size={14} aria-hidden="true" />
          </button>
        </label>

        {open ? (
          <ul
            id="palette-results"
            role="listbox"
            aria-label="Results"
            // Keeps the input focused while a row is pressed.
            onMouseDown={(event) => event.preventDefault()}
            className="absolute left-0 right-0 top-full mt-1.5 max-h-[min(70dvh,30rem)] overflow-y-auto rounded-[12px] border border-border bg-surface p-1.5 text-left text-ink shadow-window max-md:left-2 max-md:right-2"
          >
            {results.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-ink-muted">
                {query.trim().length >= 2 && hits === null
                  ? 'Searching…'
                  : failed
                    ? 'Could not search the content just now. Try again in a moment.'
                    : query.trim()
                      ? `Nothing matches "${query.trim()}".`
                      : 'Start typing to search.'}
              </li>
            ) : null}
            {results.map((row, index) => {
              const heading = row.group !== lastGroup ? row.group : null;
              lastGroup = row.group;
              const Icon = row.Icon;
              return (
                <li key={row.id} role="presentation">
                  {heading ? (
                    <p className="px-2.5 pb-1 pt-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">{heading}</p>
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
                        <span className={clsx('block truncate text-xs', index === clamped ? 'text-on-primary/75' : 'text-ink-muted')}>
                          {row.detail}
                        </span>
                      ) : null}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </>
  );
}

export { MODIFIER };
