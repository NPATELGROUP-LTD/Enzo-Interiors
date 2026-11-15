import clsx from 'clsx';
import { CaretLeft, Checks, Files, Paperclip, X } from '@phosphor-icons/react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { BubbleMenu, Composer, MessageText, TOOL, UploadButton } from '@/components/chat';
import { Button, Card, Checkbox, EmptyState, ErrorState, LoadingState, Modal } from '@/components/ui';
import { downloadFile, useFileViewer } from '@/components/FileViewer';
import { useToast } from '@/components/ui/Toast';
import { useQuery } from '@/hooks/useApi';
import { ApiError, api } from '@/lib/api';
import { date, fileSize, initials, relative, time } from '@/lib/format';
import { connectSocket } from '@/lib/socket';
import type {
  AttachableDocument,
  Conversation,
  Message,
  MessageAttachment,
  Project,
} from '@/types/api';

const errorText = (caught: unknown, fallback: string) => (caught instanceof ApiError ? caught.message : fallback);

/**
 * One conversation per client. Admin sees every client's; a Designer those of
 * the clients on their projects. Messages arrive live over the socket; sending
 * is a plain POST, which the API also delivers live, so one path covers both.
 * `?client=<id>` (the client page's Message button) opens or starts that
 * client's conversation.
 */
export function MessagesPage() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const conversations = useQuery<Conversation[]>('/conversations');
  // A file from this device goes onto one of the client's shared projects.
  // ponytail: whole scoped list filtered here; add ?client_id= if it grows large.
  const projects = useQuery<Project[]>('/projects');

  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [attachments, setAttachments] = useState<MessageAttachment[]>([]);
  const [picking, setPicking] = useState(false);
  const [sending, setSending] = useState(false);
  const [typingFrom, setTypingFrom] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Follow new messages only while the reader is at the bottom of the thread.
  const atBottom = useRef(true);
  // Phones show the list or one thread, never both squeezed together.
  const [threadOpen, setThreadOpen] = useState(false);
  // Screen readers hear new incoming messages only, not the whole history.
  const [announce, setAnnounce] = useState('');
  const openThread = (id: string) => {
    atBottom.current = true;
    setActiveId(id);
    setThreadOpen(true);
  };

  // ?client=… : open (or start) that client's conversation, then tidy the address.
  const clientParam = params.get('client');
  useEffect(() => {
    if (!clientParam) return;
    api
      .post<Conversation>('/conversations', { client_id: clientParam })
      .then(async (conversation) => {
        await conversations.refetch();
        openThread(conversation.id);
      })
      .catch((caught) => toast.error(errorText(caught, 'Could not open that conversation.')))
      .finally(() => setParams({}, { replace: true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientParam]);

  // On a wide screen, otherwise open the most recent one so the thread pane is
  // never empty. Phones start on the list: opening one marks it read.
  useEffect(() => {
    if (activeId || clientParam || !window.matchMedia('(min-width: 64rem)').matches) return;
    const latest = conversations.data?.find((conversation) => conversation.message_count > 0);
    if (latest) setActiveId(latest.id);
  }, [conversations.data, activeId, clientParam]);

  // Load the selected thread and mark it read.
  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    atBottom.current = true;
    setLoadingThread(true);
    setThreadError(null);
    setAttachments([]);
    setTypingFrom(null);
    api
      .get<Message[]>(`/conversations/${activeId}/messages`)
      .then(async (thread) => {
        if (cancelled) return;
        setMessages(thread);
        await api.put(`/conversations/${activeId}/read`).catch(() => undefined);
        await conversations.refetch();
      })
      .catch((caught) => {
        if (!cancelled) setThreadError(errorText(caught, 'Could not load this conversation.'));
      })
      .finally(() => {
        if (!cancelled) setLoadingThread(false);
      });
    connectSocket()?.emit('conversation:join', { conversationId: activeId });
    return () => {
      cancelled = true;
    };
    // conversations.refetch is stable per path; listing it would reload the thread on every refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  // Live: new messages, the client reading ours, the client typing.
  useEffect(() => {
    const socket = connectSocket();
    if (!socket) return;
    let typingTimer = 0;
    const onNew = (message: Message) => {
      if (message.conversation_id === activeId) {
        setMessages((current) => (current.some((m) => m.id === message.id) ? current : [...current, message]));
        if (message.sender_type === 'Client') {
          setTypingFrom(null);
          setAnnounce(`New message: ${message.body || 'an attachment'}`);
          void api.put(`/conversations/${activeId}/read`).catch(() => undefined);
        }
      }
      void conversations.refetch();
    };
    const onRead = (event: { conversationId: string; reader: 'Staff' | 'Client'; read_at: string }) => {
      if (event.conversationId !== activeId || event.reader !== 'Client') return;
      setMessages((current) =>
        current.map((m) => (m.sender_type === 'Staff' && !m.read_at ? { ...m, read_at: event.read_at } : m)),
      );
    };
    const onTyping = (event: { conversationId: string; name: string; kind: string }) => {
      if (event.conversationId !== activeId || event.kind !== 'Client') return;
      setTypingFrom(event.name);
      window.clearTimeout(typingTimer);
      typingTimer = window.setTimeout(() => setTypingFrom(null), 2500);
    };
    socket.on('message:new', onNew);
    socket.on('conversation:read', onRead);
    socket.on('conversation:typing', onTyping);
    return () => {
      window.clearTimeout(typingTimer);
      socket.off('message:new', onNew);
      socket.off('conversation:read', onRead);
      socket.off('conversation:typing', onTyping);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  // The socket can miss messages while it is down (phone asleep, tab in the
  // background, network switch). Catch up on reconnect, on coming back to the
  // tab and when the network returns; and poll while the socket is down.
  useEffect(() => {
    const resync = () => {
      if (document.hidden) return;
      void conversations.refetch();
      if (!activeId) return;
      api
        .get<Message[]>(`/conversations/${activeId}/messages`)
        .then((thread) => {
          setMessages(thread);
          void api.put(`/conversations/${activeId}/read`).catch(() => undefined);
        })
        .catch(() => undefined);
    };
    const socket = connectSocket();
    socket?.io.on('reconnect', resync);
    document.addEventListener('visibilitychange', resync);
    window.addEventListener('online', resync);
    const poll = window.setInterval(() => {
      if (!connectSocket()?.connected) resync();
    }, 20_000);
    return () => {
      socket?.io.off('reconnect', resync);
      document.removeEventListener('visibilitychange', resync);
      window.removeEventListener('online', resync);
      window.clearInterval(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  // Keep the newest message in view, once the thread has rendered (not while
  // it still shows the loading state) and unless the reader scrolled up.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && atBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages, typingFrom, loadingThread, threadOpen]);

  // Typing pings at most every two seconds.
  const lastPing = useRef(0);
  const pingTyping = () => {
    if (!activeId || Date.now() - lastPing.current < 2000) return;
    lastPing.current = Date.now();
    connectSocket()?.emit('conversation:typing', { conversationId: activeId });
  };

  const send = async () => {
    if (!activeId || sending || (!draft.trim() && attachments.length === 0)) return;
    setSending(true);
    try {
      const message = await api.post<Message>(`/conversations/${activeId}/messages`, {
        body: draft.trim(),
        ...(attachments.length ? { document_ids: attachments.map((a) => a.document_id) } : {}),
      });
      atBottom.current = true;
      setMessages((current) => (current.some((m) => m.id === message.id) ? current : [...current, message]));
      setDraft('');
      setAttachments([]);
      void conversations.refetch();
    } catch (caught) {
      toast.error(errorText(caught, 'Could not send that message.'));
    } finally {
      setSending(false);
    }
  };

  // A conversation opened from a client's page exists before anything is sent;
  // it joins the list with its first message (or while it is open).
  const list = (conversations.data ?? []).filter(
    (conversation) => conversation.message_count > 0 || conversation.id === activeId,
  );
  const active = list.find((conversation) => conversation.id === activeId);
  const lastOwn = [...messages].reverse().find((m) => m.sender_type === 'Staff');

  if (conversations.error) return <ErrorState message={conversations.error} onRetry={conversations.refetch} />;

  return (
    <div className="flex h-full min-h-0 flex-col px-5 pb-5 pt-6 sm:px-8 sm:pb-8 lg:pt-8">
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>

      {conversations.loading ? (
        <LoadingState label="Loading conversations…" />
      ) : list.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            title="No conversations yet"
            message="Open a client and choose Message to start one. Their replies from the client portal arrive here."
          />
        </Card>
      ) : (
        <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)] gap-5 lg:grid-cols-[20rem_1fr]">
          <Card className={clsx('overflow-hidden p-0', threadOpen && 'hidden lg:block')}>
            {/* Not `.rows`: its bleed margins made the list scroll sideways. */}
            <ul className="flex h-full flex-col gap-0.5 overflow-y-auto overflow-x-hidden overscroll-contain p-1.5">
              {list.map((conversation) => (
                <li key={conversation.id} className="rounded-lg odd:bg-[var(--stripe)]">
                  <button
                    type="button"
                    onClick={() => openThread(conversation.id)}
                    aria-current={conversation.id === activeId}
                    className={clsx(
                      'flex w-full gap-2.5 rounded-lg p-3 text-left transition-colors',
                      conversation.id === activeId ? 'bg-green-100' : 'hover:bg-surface-muted/60',
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-surface-muted text-xs font-bold text-ink"
                    >
                      {initials(conversation.client_name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate font-semibold text-ink">{conversation.client_name}</span>
                        {conversation.unread_count > 0 ? (
                          <span className="tabular shrink-0 rounded-control bg-green-900 px-1.5 py-0.5 text-xs font-bold text-on-primary">
                            <span className="sr-only">Unread: </span>
                            {conversation.unread_count}
                          </span>
                        ) : conversation.last_message ? (
                          <span className="shrink-0 text-xs text-ink-muted">
                            {relative(conversation.last_message.created_at)}
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-ink-muted">
                        {conversation.last_message
                          ? `${conversation.last_message.sender_type === 'Staff' ? 'You: ' : ''}${
                              conversation.last_message.body ||
                              `${conversation.last_message.attachments?.length ?? 0} attachment(s)`
                            }`
                          : 'No messages yet'}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>

          <section
            aria-label={active ? `Conversation with ${active.client_name}` : 'Conversation'}
            className={clsx('min-h-0 min-w-0 flex-col', threadOpen ? 'flex' : 'hidden lg:flex')}
          >
            {active ? (
              <>
                <div className="flex items-center gap-1 pb-2">
                  <button
                    type="button"
                    onClick={() => setThreadOpen(false)}
                    aria-label="Back to conversations"
                    className="-my-2 -ml-2 flex min-h-11 min-w-11 items-center justify-center rounded-control text-ink hover:bg-ink/[0.05] lg:hidden"
                  >
                    <CaretLeft size={18} aria-hidden="true" />
                  </button>
                  <p className="min-w-0 truncate">
                    <span className="font-semibold text-ink">{active.client_name}</span>
                    <span className="text-xs text-ink-muted">
                      {' '}
                      · {active.message_count} {active.message_count === 1 ? 'message' : 'messages'}
                    </span>
                  </p>
                </div>

                <div
                  ref={scrollRef}
                  onScroll={(event) => {
                    const el = event.currentTarget;
                    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
                  }}
                  className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
                >
                  {loadingThread ? (
                    <LoadingState label="Loading messages…" />
                  ) : threadError ? (
                    <ErrorState message={threadError} />
                  ) : messages.length === 0 ? (
                    <EmptyState title="No messages yet" message={`Write to ${active.client_name} below.`} />
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {messages.map((message, index) => {
                        const fromStaff = message.sender_type === 'Staff';
                        const previous = messages[index - 1];
                        const newDay = !previous || previous.created_at.slice(0, 10) !== message.created_at.slice(0, 10);
                        return (
                          <li key={message.id}>
                            {newDay ? (
                              <p className="my-2 text-center text-xs text-ink-muted">{date(message.created_at)}</p>
                            ) : null}
                            <div className={clsx('flex', fromStaff ? 'justify-end' : 'justify-start')}>
                              <div
                                className={clsx(
                                  'group relative max-w-[85%] rounded-card py-2 pl-3 pr-8 sm:max-w-[70%]',
                                  fromStaff ? 'bg-green-100' : 'bg-surface-muted',
                                )}
                              >
                                <BubbleMenu actions={bubbleActions(message, toast)} />
                                {message.body ? <MessageText text={message.body} /> : null}
                                <Attachments items={message.attachments} />
                                <p className="mt-1 flex items-center gap-1 text-[11px] text-ink-muted">
                                  {fromStaff ? 'Enzo Interiors' : active.client_name} · {time(message.created_at)}
                                  {fromStaff && message.id === lastOwn?.id && message.read_at ? (
                                    <span className="flex items-center gap-0.5">
                                      · <Checks size={12} aria-hidden="true" /> Read
                                    </span>
                                  ) : null}
                                </p>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {typingFrom ? <p className="mt-2 text-xs italic text-ink-muted">{typingFrom} is typing…</p> : null}
                </div>

                <Composer
                  value={draft}
                  onChange={(next) => {
                    setDraft(next);
                    pingTyping();
                  }}
                  onSend={() => void send()}
                  sending={sending}
                  canSend={Boolean(draft.trim()) || attachments.length > 0}
                  placeholder="Message"
                  above={
                    <Chips items={attachments} onRemove={(id) => setAttachments((c) => c.filter((a) => a.document_id !== id))} />
                  }
                  tools={
                    <>
                      <UploadButton
                        clientId={active.client_id}
                        projects={(projects.data ?? [])
                          .filter((p) => p.client_id === active.client_id && p.client_visible)
                          .map((p) => ({ id: p.id, name: p.name }))}
                        onUploaded={(file) => setAttachments((current) => [...current, file].slice(0, 10))}
                      />
                      <button
                        type="button"
                        onClick={() => setPicking(true)}
                        aria-label="Attach a shared file"
                        title="Attach a file shared with this client"
                        className={TOOL}
                      >
                        <Files size={20} aria-hidden="true" />
                      </button>
                    </>
                  }
                />

                {picking ? (
                  <AttachPicker
                    conversationId={active.id}
                    clientName={active.client_name}
                    chosen={attachments}
                    onClose={() => setPicking(false)}
                    onChoose={(next) => {
                      setAttachments(next);
                      setPicking(false);
                    }}
                  />
                ) : null}
              </>
            ) : (
              <EmptyState title="Select a conversation" message="Choose a client to read the thread." />
            )}
          </section>
        </div>
      )}
    </div>
  );
}

/** Opens a file through Documents' own access check. */

/** The files about to be sent, each removable. */
function Chips({ items, onRemove }: { items: MessageAttachment[]; onRemove: (id: string) => void }) {
  if (!items.length) return null;
  return (
    <ul className="mb-2 flex flex-wrap gap-1.5">
      {items.map((attachment) => (
        <li
          key={attachment.document_id}
          className="flex items-center gap-1.5 rounded-control bg-surface-muted py-1 pl-2 text-xs text-ink"
        >
          <Paperclip size={12} aria-hidden="true" />
          <span className="max-w-40 truncate">{attachment.name}</span>
          <button
            type="button"
            onClick={() => onRemove(attachment.document_id)}
            aria-label={`Remove ${attachment.name}`}
            className="flex h-6 w-7 items-center justify-center text-ink-muted hover:text-danger"
          >
            <X size={12} aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  );
}

/** A bubble's hover menu: copy its text, download its files. */
function bubbleActions(message: Message, toast: ReturnType<typeof useToast>) {
  return [
    ...(message.body
      ? [
          {
            label: 'Copy text',
            run: () =>
              void navigator.clipboard.writeText(message.body).then(
                () => toast.success('Copied'),
                () => toast.error('Could not copy that text.'),
              ),
          },
        ]
      : []),
    ...(message.attachments ?? []).map((attachment) => ({
      label: `Download ${attachment.name}`,
      run: () =>
        void downloadFile(attachment.document_id).catch((caught) =>
          toast.error(errorText(caught, 'That file is no longer available.')),
        ),
    })),
  ];
}

/** Attachment chips; each opens through Documents' own access check. */
export function Attachments({ items }: { items: MessageAttachment[] | null }) {
  const files = useFileViewer();
  if (!items?.length) return null;
  // PDFs and images open in the page; anything else is saved.
  const open = (attachment: MessageAttachment) => files.show({ id: attachment.document_id, name: attachment.name });
  return (
    <>
    {files.viewer}
    <ul className="mt-2 flex flex-col gap-1">
      {items.map((attachment) => (
        <li key={attachment.document_id}>
          <button
            type="button"
            onClick={() => void open(attachment)}
            className="flex w-full items-center gap-1.5 rounded-control border border-border bg-surface px-2 py-1 text-left text-xs text-ink hover:border-green-900"
          >
            <Paperclip size={12} aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">{attachment.name}</span>
            <span className="tabular shrink-0 text-ink-muted">{fileSize(attachment.size_bytes)}</span>
          </button>
        </li>
      ))}
    </ul>
    </>
  );
}

/** Pick from the files already shared with this client: the client can open everything they are sent. */
export function AttachPicker({
  conversationId,
  clientName,
  chosen,
  onClose,
  onChoose,
}: {
  conversationId: string;
  clientName: string;
  chosen: MessageAttachment[];
  onClose: () => void;
  onChoose: (next: MessageAttachment[]) => void;
}) {
  const documents = useQuery<AttachableDocument[]>(`/conversations/${conversationId}/documents`);
  const [picked, setPicked] = useState(() => new Set(chosen.map((a) => a.document_id)));
  const toggle = (id: string, on: boolean) =>
    setPicked((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  return (
    <Modal
      open
      onClose={onClose}
      title="Attach files"
      description={`Files shared with ${clientName}. To send another, share it from their project's documents first.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={picked.size > 10}
            onClick={() =>
              onChoose(
                (documents.data ?? [])
                  .filter((doc) => picked.has(doc.id))
                  .map((doc) => ({ document_id: doc.id, name: doc.name, size_bytes: doc.size_bytes })),
              )
            }
          >
            {picked.size > 10 ? 'Up to 10 files' : 'Attach'}
          </Button>
        </>
      }
    >
      {documents.loading ? (
        <LoadingState label="Loading files…" />
      ) : documents.error ? (
        <ErrorState message={documents.error} onRetry={documents.refetch} />
      ) : !documents.data?.length ? (
        <EmptyState title="Nothing shared yet" message={`A file shows here once it is marked “Client sees” and its project is sent to ${clientName}. Check both on the project’s Documents tab.`} />
      ) : (
        <ul className="flex flex-col">
          {documents.data.map((doc) => (
            <li key={doc.id} className="flex items-center justify-between gap-3">
              <Checkbox label={doc.name} checked={picked.has(doc.id)} onChange={(on) => toggle(doc.id, on)} />
              <span className="tabular shrink-0 text-xs text-ink-muted">
                {doc.type} · {fileSize(doc.size_bytes)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
