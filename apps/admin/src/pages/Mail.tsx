import {
  ArrowBendDoubleUpLeft,
  ArrowBendUpLeft,
  ArrowBendUpRight,
  ArrowsClockwise,
  CaretLeft,
  DownloadSimple,
  Envelope,
  EnvelopeOpen,
  EnvelopeSimple,
  FileText,
  Flag,
  MagnifyingGlass,
  PaperPlaneTilt,
  PencilSimpleLine,
  Star,
  Tag,
  Trash,
  Tray,
  Warning,
  X,
} from '@phosphor-icons/react';
import clsx from 'clsx';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';

import { ComposeSheet } from '@/components/mail/Compose';
import { ConnectButton } from '@/components/mail/ConnectButton';
import { MessageBody } from '@/components/mail/MessageBody';
import { Button, Card, ConfirmDialog, EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useQuery } from '@/hooks/useApi';
import { ApiError, api } from '@/lib/api';
import { dateTime, fileSize, initials, relative } from '@/lib/format';
import { draftFor, shortWho } from '@/lib/mail';
import type { Draft, MailFile, MailFolder, MailMessage, MailRow, MailStatus, MailThread } from '@/types/mail';

const FOCUS = 'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring/40';
const EMPTY_DRAFT: Draft = { to: '', cc: '', bcc: '', subject: '', body: '' };
const FOLDER_ICON: Record<string, typeof Tray> = { INBOX: Tray, STARRED: Star, IMPORTANT: Flag, SENT: PaperPlaneTilt, DRAFT: FileText, SPAM: Warning, TRASH: Trash };
const BASIC_FOLDERS: MailFolder[] = [
  { id: 'INBOX', name: 'Inbox', system: true },
  { id: 'SENT', name: 'Sent', system: true },
];
const ADDRESS = /^[^\s<>,;"']+@[^\s<>,;"']+\.[^\s<>,;"']+$/;
const MAIL_RESULTS: Record<string, string> = { error: 'Could not connect your Gmail. Try again, and tick every box Google shows.' };

/**
 * Your own Gmail, inside the admin: Inbox and Sent, search, reading, replying,
 * forwarding and attachments. Everything is read from Google when you open it;
 * Enzo's servers keep no copy of any message. Designers, Editors and Admins.
 */
export function MailPage() {
  const toast = useToast();
  const status = useQuery<MailStatus>('/mailbox/status');
  const [params, setParams] = useSearchParams();

  // Back from Google: finish the link as this signed-in person (the API links it only for whoever started it),
  // say how it went, and drop the code from the address.
  const finishing = useRef(false);
  useEffect(() => {
    const code = params.get('mail_code');
    const result = params.get('mail');
    if ((!code && !result) || finishing.current) return;
    finishing.current = true;
    setParams({}, { replace: true });
    if (!code) return void toast.error(MAIL_RESULTS[result ?? ''] ?? 'Could not connect your Gmail.');
    api.post('/mailbox/connect/complete', { code }).then(
      () => {
        toast.success('Gmail connected.');
        void status.refetch();
      },
      (caught) => toast.error(caught instanceof ApiError ? caught.message : 'Could not connect your Gmail.'),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const s = status.data;
  if (status.error) return <ErrorState message={status.error} onRetry={() => void status.refetch()} />;
  if (!s) return <LoadingState label="Opening Mail…" />;
  if (!s.configured) {
    return <EmptyState title="Mail is not set up yet" message="Ask whoever runs the platform to add the Google keys for Mail. Nothing is lost in the meantime." />;
  }
  if (!s.connected || s.needs_reconnect) return <ConnectCard reconnect={s.needs_reconnect} />;
  return <Mailbox me={s.email ?? ''} onLost={() => void status.refetch()} />;
}

function ConnectCard({ reconnect }: { reconnect: boolean }) {
  return (
    <div className="flex h-full items-start justify-center px-5 pb-16 pt-10 sm:px-8 lg:pt-16">
      <Card className="w-full max-w-md p-6" accent={reconnect ? 'warning' : 'none'}>
        <span className="flex h-11 w-11 items-center justify-center rounded-[11px] bg-green-100 text-green-900">
          <EnvelopeSimple size={22} aria-hidden="true" />
        </span>
        <h2 className="mt-4 text-lg font-semibold text-ink">{reconnect ? 'Reconnect your Gmail' : 'Connect your Gmail'}</h2>
        <p className="mt-1.5 text-[14px] text-ink-muted">
          {reconnect
            ? 'Google stopped accepting the link to your mailbox, so Mail is paused. Connect again to carry on.'
            : 'Read and send mail from your own Enzo Interiors Google address, without leaving the admin.'}
        </p>
        <ul className="mt-4 flex list-disc flex-col gap-2 pl-4 text-[13px] text-ink-muted">
          <li>Only you can open your mailbox. Nobody else, including an Admin, can read it here.</li>
          <li>Mail is read from Google each time you open it. Enzo keeps no copy of your messages.</li>
          <li>You can disconnect whenever you like.</li>
        </ul>
        <div className="mt-5">
          <ConnectButton label={reconnect ? 'Reconnect your Gmail' : 'Connect your Gmail'} />
        </div>
      </Card>
    </div>
  );
}

function Mailbox({ me, onLost }: { me: string; onLost: () => void }) {
  const toast = useToast();
  // The parent hands a new function every render; held in a ref so the list is not reloaded each time the address changes.
  const lost = useRef(onLost);
  lost.current = onLost;
  const [params, setParams] = useSearchParams();
  // A Gmail label id; the old ?folder=sent address still works.
  const folderParam = params.get('folder') ?? '';
  const folder = folderParam === 'sent' ? 'SENT' : /^[A-Za-z0-9_-]{1,100}$/.test(folderParam) ? folderParam : 'INBOX';
  const labels = useQuery<MailFolder[]>('/mailbox/labels');
  const folders = labels.data?.length ? labels.data : BASIC_FOLDERS;
  const q = params.get('q') ?? '';
  const withAddr = params.get('with') ?? '';
  const threadParam = params.get('thread');
  const threadId = threadParam && /^[\w-]{1,64}$/.test(threadParam) ? threadParam : null;
  const searching = Boolean(q || withAddr);

  const go = (changes: Record<string, string | null>, replace = false) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const [key, value] of Object.entries(changes)) {
          if (value === null || value === '') next.delete(key);
          else next.set(key, value);
        }
        return next;
      },
      { replace },
    );

  /* ---- The list ---- */

  const listQuery = useMemo(() => {
    const query = new URLSearchParams({ limit: '25' });
    if (q) query.set('q', q);
    if (withAddr) query.set('with', withAddr);
    if (!searching) query.set('label', folder);
    return query.toString();
  }, [q, withAddr, searching, folder]);
  const [rows, setRows] = useState<MailRow[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(0);

  const load = useCallback(
    async (page?: string) => {
      const id = ++latest.current;
      setLoading(true);
      setError(null);
      try {
        const query = new URLSearchParams(listQuery);
        if (page) query.set('page', page);
        const result = await api.get<{ items: MailRow[]; next_page: string | null }>(`/mailbox/threads?${query}`);
        if (id !== latest.current) return;
        setRows((current) => (page ? [...current, ...result.items.filter((r) => !current.some((c) => c.id === r.id))] : result.items));
        setNext(result.next_page);
      } catch (caught) {
        if (id !== latest.current) return;
        if (caught instanceof ApiError && caught.status === 409) return lost.current();
        setError(caught instanceof ApiError ? caught.message : 'Could not load your mail.');
      } finally {
        if (id === latest.current) setLoading(false);
      }
    },
    [listQuery],
  );
  useEffect(() => {
    setRows([]);
    setNext(null);
    void load();
  }, [load]);

  const [term, setTerm] = useState(q);
  const [addr, setAddr] = useState(withAddr);
  useEffect(() => setTerm(q), [q]);
  useEffect(() => setAddr(withAddr), [withAddr]);
  const search = (event: FormEvent) => {
    event.preventDefault();
    go({ q: term.trim(), with: null, thread: null });
  };
  const lookup = (event: FormEvent) => {
    event.preventDefault();
    const value = addr.trim();
    if (!ADDRESS.test(value)) return toast.error('Type a full email address, like name@example.com.');
    go({ with: value, q: null, thread: null });
  };

  /* ---- The open conversation ---- */

  const thread = useQuery<MailThread>(threadId ? `/mailbox/threads/${threadId}` : null);
  const open = thread.data && thread.data.id === threadId ? thread.data : null;
  const autoRead = useRef(new Set<string>());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  useEffect(() => {
    setExpanded(new Set());
    autoRead.current.clear(); // reopening a conversation that got a new message reads it again
  }, [threadId]);
  useEffect(() => {
    if (thread.error && /Connect|Reconnect/.test(thread.error)) lost.current();
  }, [thread.error]);

  const setRead = async (id: string, read: boolean) => {
    try {
      await api.post(`/mailbox/threads/${id}/read`, { read });
      setRows((current) => current.map((r) => (r.id === id ? { ...r, unread: !read } : r)));
      return true;
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not change that.');
      return false;
    }
  };
  // Opening a conversation reads it, once; marking it unread afterwards sticks.
  useEffect(() => {
    if (!open || autoRead.current.has(open.id)) return;
    autoRead.current.add(open.id);
    if (open.messages.some((m) => m.unread)) void setRead(open.id, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const [busyFile, setBusyFile] = useState<string | null>(null);
  const download = async (message: MailMessage, file: MailFile) => {
    setBusyFile(`${message.id}/${file.part_id}`);
    try {
      const blob = await api.blob(`/mailbox/messages/${message.id}/attachments/${file.part_id}`);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.filename;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not download that file.');
    } finally {
      setBusyFile(null);
    }
  };

  /* ---- Writing and leaving ---- */

  const [draft, setDraft] = useState<Draft | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const disconnect = async () => {
    setDisconnecting(true);
    try {
      await api.delete('/mailbox');
      toast.success('Gmail disconnected.');
      lost.current();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not disconnect.');
      setDisconnecting(false);
    }
  };

  const folderName = folders.find((f) => f.id === folder)?.name ?? 'Mail';
  const heading = q ? `Search: ${q}` : withAddr ? `Mail with ${withAddr}` : folderName;
  const pick = (id: string) => go({ folder: id === 'INBOX' ? null : id, q: null, with: null, thread: null });

  return (
    <div className="flex h-full min-h-0 flex-col px-3 pb-3 pt-3 sm:px-4 sm:pb-4 lg:pt-4">
      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)] gap-3 lg:grid-cols-[14rem_24rem_minmax(0,1fr)]">
        {/* Folders: every Gmail folder and label, no frame around them */}
        <div className="hidden min-h-0 flex-col gap-4 lg:flex">
          <Button variant="primary" icon={<PencilSimpleLine size={16} aria-hidden="true" />} onClick={() => setDraft(EMPTY_DRAFT)}>
            New message
          </Button>
          <nav aria-label="Folders" className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain">
            {folders.map(({ id, name }) => {
              const Icon = FOLDER_ICON[id] ?? Tag;
              const here = !searching && folder === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => pick(id)}
                  aria-current={here ? 'page' : undefined}
                  className={clsx('flex min-h-10 items-center gap-2.5 rounded-card px-3 text-left text-[14px] text-ink shadow-soft', here ? 'bg-green-100 font-semibold' : 'bg-surface hover:bg-surface-muted', FOCUS)}
                >
                  <Icon size={17} aria-hidden="true" className="shrink-0" />
                  <span className="truncate">{name}</span>
                </button>
              );
            })}
          </nav>
          <form onSubmit={lookup} className="flex flex-col gap-1.5">
            <label htmlFor="mail-with" className="text-xs font-semibold text-ink-muted">
              Mail with an address
            </label>
            <input
              id="mail-with"
              type="email"
              value={addr}
              onChange={(e) => setAddr(e.target.value)}
              placeholder="name@example.com"
              className="min-h-9 rounded-control border border-border bg-surface px-2.5 text-[13px] text-ink placeholder:text-ink-muted focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring/40"
            />
          </form>
          <div className="flex flex-col gap-1 border-t border-border/60 pt-3">
            <p className="truncate text-xs text-ink-muted" title={me}>{me}</p>
            <button type="button" onClick={() => setLeaving(true)} className={clsx('w-fit rounded-control text-[13px] font-semibold text-ink-muted hover:text-ink', FOCUS)}>
              Disconnect Gmail
            </button>
          </div>
        </div>

        {/* The list */}
        <div className={clsx('min-h-0 flex-col overflow-hidden', threadId ? 'hidden lg:flex' : 'flex')}>
          <div className="flex flex-col gap-2 pb-2">
            <div className="flex items-center gap-2 lg:hidden">
              <select
                aria-label="Folder"
                value={searching ? '' : folder}
                onChange={(event) => event.target.value && pick(event.target.value)}
                className="min-h-10 min-w-0 flex-1 rounded-control border border-border bg-surface px-3 text-[14px] text-ink focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring/40"
              >
                {searching ? <option value="">{heading}</option> : null}
                {folders.map(({ id, name }) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
              <Button variant="primary" aria-label="New message" className="mb-4 shrink-0 px-3" onClick={() => setDraft(EMPTY_DRAFT)}>
                <PencilSimpleLine size={18} aria-hidden="true" />
              </Button>
            </div>
            <form onSubmit={search} role="search" className="relative">
              <MagnifyingGlass size={16} aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted" />
              <input
                type="search"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                aria-label="Search mail"
                maxLength={500}
                placeholder="Search mail (from:, has:attachment…)"
                className="min-h-10 w-full rounded-control border border-border bg-surface pl-8 pr-3 text-[13px] text-ink placeholder:text-ink-muted focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring/40 pointer-fine:min-h-9"
              />
            </form>
            <form onSubmit={lookup} className="lg:hidden">
              <input
                type="email"
                value={addr}
                onChange={(e) => setAddr(e.target.value)}
                aria-label="Mail with an address"
                placeholder="Mail with an address (name@example.com)"
                className="min-h-10 w-full rounded-control border border-border bg-surface px-3 text-[13px] text-ink placeholder:text-ink-muted focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring/40"
              />
            </form>
            <div className="flex items-center justify-between gap-2">
              <h2 className="min-w-0 truncate text-[13px] font-semibold text-ink">{heading}</h2>
              <div className="flex shrink-0 items-center gap-1">
                {searching ? (
                  <button type="button" onClick={() => go({ q: null, with: null, thread: null })} className={clsx('flex min-h-8 items-center gap-1 rounded-control px-2 text-xs font-semibold text-ink-muted hover:text-ink', FOCUS)}>
                    <X size={13} aria-hidden="true" />
                    Clear
                  </button>
                ) : null}
                <button type="button" aria-label="Refresh" onClick={() => void load()} className={clsx('flex h-8 w-8 items-center justify-center rounded-control text-ink-muted hover:bg-ink/[0.06] hover:text-ink', FOCUS)}>
                  <ArrowsClockwise size={16} aria-hidden="true" className={loading ? 'animate-spin' : undefined} />
                </button>
              </div>
            </div>
          </div>

          {error ? (
            <ErrorState message={error} onRetry={() => void load()} />
          ) : loading && rows.length === 0 ? (
            <LoadingState label="Loading mail…" />
          ) : rows.length === 0 ? (
            <EmptyState title={searching ? 'Nothing found' : `${folderName} is empty`} message={searching ? 'Try different words, or clear the search.' : 'Nothing in this folder.'} />
          ) : (
            <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain pb-1">
              {rows.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => go({ thread: row.id })}
                    aria-current={row.id === threadId}
                    className={clsx('flex w-full items-start gap-2.5 rounded-card px-3 py-3 text-left shadow-soft', row.id === threadId ? 'bg-green-100' : 'bg-surface hover:bg-surface-muted', FOCUS)}
                  >
                    <span aria-hidden="true" className={clsx('mt-[7px] h-2 w-2 shrink-0 rounded-full', row.unread ? 'bg-green-900' : 'bg-transparent')} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className={clsx('min-w-0 truncate text-[14px] text-ink', row.unread ? 'font-bold' : 'font-medium')}>
                          {!searching && folder === 'SENT' ? `To: ${row.to.map(shortWho).join(', ') || 'no one'}` : shortWho(row.from)}
                          {row.count > 1 ? <span className="ml-1.5 text-xs font-normal text-ink-muted">{row.count}</span> : null}
                        </span>
                        <span className="tabular shrink-0 text-xs text-ink-muted">{relative(row.date)}</span>
                      </span>
                      <span className={clsx('block truncate text-[13px] text-ink', row.unread && 'font-semibold')}>{row.subject || '(no subject)'}</span>
                      <span className="block truncate text-xs text-ink-muted">{row.snippet}</span>
                    </span>
                    {row.unread ? <span className="sr-only">Unread</span> : null}
                  </button>
                </li>
              ))}
              {next ? (
                <li className="flex justify-center p-2">
                  <Button variant="secondary" loading={loading} onClick={() => void load(next)}>
                    Show more
                  </Button>
                </li>
              ) : null}
            </ul>
          )}
        </div>

        {/* The reader */}
        <div className={clsx('min-h-0 min-w-0 flex-col overflow-hidden', threadId ? 'flex' : 'hidden lg:flex')}>
          {!threadId ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-ink-muted">
              <EnvelopeOpen size={28} aria-hidden="true" />
              <p className="text-[14px]">Choose a message to read it.</p>
            </div>
          ) : thread.error && !open ? (
            <ErrorState message={thread.error} onRetry={() => void thread.refetch()} />
          ) : !open ? (
            <LoadingState label="Opening message…" />
          ) : (
            <>
              <div className="flex items-start gap-2 pb-3">
                <button type="button" aria-label="Back to the list" onClick={() => go({ thread: null })} className={clsx('-my-1 -ml-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-control text-ink hover:bg-ink/[0.05] lg:hidden', FOCUS)}>
                  <CaretLeft size={18} aria-hidden="true" />
                </button>
                <h2 className="min-w-0 flex-1 text-[17px] font-semibold leading-snug text-ink [overflow-wrap:anywhere]">{open.subject || '(no subject)'}</h2>
                <Button
                  variant="secondary"
                  icon={<Envelope size={15} aria-hidden="true" />}
                  className="shrink-0"
                  onClick={async () => {
                    if (await setRead(open.id, false)) toast.success('Marked unread.');
                  }}
                >
                  <span className="hidden sm:inline">Mark unread</span>
                </Button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                <ol className="flex flex-col gap-3">
                  {open.messages.map((m, index) => {
                    const isOpen = expanded.has(m.id) || index === open.messages.length - 1;
                    return (
                      <li key={m.id}>
                        <article className="rounded-card bg-surface p-4 shadow-soft">
                          <button
                            type="button"
                            aria-expanded={isOpen}
                            onClick={() => setExpanded((current) => { const n = new Set(current); if (n.has(m.id)) n.delete(m.id); else n.add(m.id); return n; })}
                            className={clsx('flex w-full items-start gap-3 rounded-control text-left', FOCUS)}
                          >
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-100 text-xs font-bold text-green-900">{initials(shortWho(m.from))}</span>
                            <span className="min-w-0 flex-1">
                              <span className="flex items-baseline justify-between gap-2">
                                <span className="min-w-0 truncate text-[14px] font-semibold text-ink">{shortWho(m.from)}</span>
                                <span className="shrink-0 text-xs text-ink-muted">{dateTime(m.date)}</span>
                              </span>
                              <span className="block truncate text-xs text-ink-muted">
                                {isOpen ? `${m.from?.email ?? ''} to ${m.to.map(shortWho).join(', ')}${m.cc.length ? `, cc ${m.cc.map(shortWho).join(', ')}` : ''}` : m.text.slice(0, 140)}
                              </span>
                            </span>
                          </button>

                          {isOpen ? (
                            <div className="mt-3 flex flex-col gap-3">
                              {m.attachments.length ? (
                                <ul className="flex flex-wrap gap-2" aria-label="Attachments">
                                  {m.attachments.map((file) => (
                                    <li key={file.part_id}>
                                      <button
                                        type="button"
                                        disabled={busyFile === `${m.id}/${file.part_id}`}
                                        onClick={() => void download(m, file)}
                                        className={clsx('flex min-h-9 max-w-full items-center gap-1.5 rounded-control bg-surface-muted px-2.5 text-[13px] text-ink hover:bg-ink/10 disabled:opacity-50', FOCUS)}
                                      >
                                        <DownloadSimple size={15} aria-hidden="true" className="shrink-0" />
                                        <span className="truncate">{file.filename}</span>
                                        <span className="shrink-0 text-ink-muted">{fileSize(file.size)}</span>
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              ) : null}
                              {m.html ? (
                                <MessageBody html={m.html} />
                              ) : (
                                <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-ink [overflow-wrap:anywhere]">{m.text || '(no text)'}</p>
                              )}
                              {m.inline_images ? <p className="text-xs text-ink-muted">Pictures built into this message are not shown here.</p> : null}
                              {m.truncated ? <p className="text-xs text-ink-muted">This message is very long, so only part of it is shown. Open it in Gmail for the rest.</p> : null}
                              <div className="flex flex-wrap gap-2">
                                <Button variant="secondary" icon={<ArrowBendUpLeft size={15} aria-hidden="true" />} onClick={() => setDraft(draftFor('reply', m, me))}>Reply</Button>
                                <Button variant="secondary" icon={<ArrowBendDoubleUpLeft size={15} aria-hidden="true" />} onClick={() => setDraft(draftFor('reply_all', m, me))}>Reply all</Button>
                                <Button variant="secondary" icon={<ArrowBendUpRight size={15} aria-hidden="true" />} onClick={() => setDraft(draftFor('forward', m, me))}>Forward</Button>
                              </div>
                            </div>
                          ) : null}
                        </article>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </>
          )}
        </div>
      </div>

      <ComposeSheet
        draft={draft}
        onClose={() => setDraft(null)}
        onSent={() => {
          setDraft(null);
          if (!searching && folder === 'SENT') void load();
        }}
      />
      <ConfirmDialog
        open={leaving}
        title="Disconnect your Gmail?"
        message="Mail will stop showing here until you connect again. Nothing in your Gmail is changed or deleted."
        confirmLabel="Disconnect"
        pending={disconnecting}
        onConfirm={() => void disconnect()}
        onCancel={() => setLeaving(false)}
      />
    </div>
  );
}
