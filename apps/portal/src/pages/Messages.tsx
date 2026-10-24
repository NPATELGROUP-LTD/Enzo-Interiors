import clsx from 'clsx';
import { Checks, Files, Paperclip, X } from '@phosphor-icons/react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { BubbleMenu, Composer, MessageText, TOOL, UploadButton } from '@/components/chat';
import { Button, Checkbox, EmptyState, ErrorState, LoadingState, Modal } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useQuery } from '@/hooks/useApi';
import { ApiError, api, downloadDocument } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { date, fileSize, time } from '@/lib/format';
import { connectSocket } from '@/lib/socket';
import type { AttachableDocument, Conversation, Message, MessageAttachment, Project } from '@/types/api';

const errorText = (caught: unknown, fallback: string) => (caught instanceof ApiError ? caught.message : fallback);

/**
 * The client's one conversation with the Enzo team. It opens straight into
 * the thread; the first message starts it. Replies arrive live over the
 * socket; sending is a plain POST, which the API also delivers live.
 */
export function MessagesPage() {
  const toast = useToast();
  const { user } = useAuth();
  const conversations = useQuery<Conversation[]>('/conversations');
  // A file from this device goes onto one of the client's shared projects.
  const projects = useQuery<Project[]>('/projects');
  const conversation = conversations.data?.[0] ?? null;
  const activeId = conversation?.id ?? null;
  const refetchConversations = conversations.refetch;

  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [attachments, setAttachments] = useState<MessageAttachment[]>([]);
  const [picking, setPicking] = useState(false);
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Follow new messages only while the reader is at the bottom of the thread.
  const atBottom = useRef(true);
  // Screen readers hear new replies only, not the whole history.
  const [announce, setAnnounce] = useState('');

  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    atBottom.current = true;
    setLoadingThread(true);
    setThreadError(null);
    api
      .get<Message[]>(`/conversations/${activeId}/messages`)
      .then(async (thread) => {
        if (cancelled) return;
        setMessages(thread);
        await api.put(`/conversations/${activeId}/read`).catch(() => undefined);
      })
      .catch((caught) => {
        if (!cancelled) setThreadError(errorText(caught, 'Could not load your messages.'));
      })
      .finally(() => {
        if (!cancelled) setLoadingThread(false);
      });
    connectSocket()?.emit('conversation:join', { conversationId: activeId });
    return () => {
      cancelled = true;
    };
  }, [activeId]);

  useEffect(() => {
    const socket = connectSocket();
    if (!socket) return;
    if (!activeId) {
      // No thread yet: when the studio starts one, its first message brings it in.
      const onFirst = () => void refetchConversations();
      socket.on('message:new', onFirst);
      return () => {
        socket.off('message:new', onFirst);
      };
    }
    let typingTimer = 0;
    const onNew = (message: Message) => {
      if (message.conversation_id !== activeId) return;
      setMessages((current) => (current.some((m) => m.id === message.id) ? current : [...current, message]));
      if (message.sender_type === 'Staff') {
        setTyping(false);
        setAnnounce(`New reply: ${message.body || 'an attachment'}`);
        void api.put(`/conversations/${activeId}/read`).catch(() => undefined);
      }
    };
    const onRead = (event: { conversationId: string; reader: 'Staff' | 'Client'; read_at: string }) => {
      if (event.conversationId !== activeId || event.reader !== 'Staff') return;
      setMessages((current) =>
        current.map((m) => (m.sender_type === 'Client' && !m.read_at ? { ...m, read_at: event.read_at } : m)),
      );
    };
    const onTyping = (event: { conversationId: string; kind: string }) => {
      if (event.conversationId !== activeId || event.kind !== 'Staff') return;
      setTyping(true);
      window.clearTimeout(typingTimer);
      typingTimer = window.setTimeout(() => setTyping(false), 2500);
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
  }, [activeId, refetchConversations]);

  // The socket can miss messages while it is down (phone asleep, tab in the
  // background, network switch). Catch up on reconnect, on coming back to the
  // tab and when the network returns; and poll while the socket is down.
  useEffect(() => {
    const resync = () => {
      if (document.hidden) return;
      void refetchConversations();
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
  }, [messages, typing, loadingThread]);

  const lastPing = useRef(0);
  const pingTyping = () => {
    if (!activeId || Date.now() - lastPing.current < 2000) return;
    lastPing.current = Date.now();
    connectSocket()?.emit('conversation:typing', { conversationId: activeId });
  };

  const send = async () => {
    if (sending || (!draft.trim() && attachments.length === 0)) return;
    setSending(true);
    try {
      // The first message starts the conversation.
      const id = activeId ?? (await api.post<Conversation>('/conversations', {})).id;
      const message = await api.post<Message>(`/conversations/${id}/messages`, {
        body: draft.trim(),
        ...(attachments.length ? { document_ids: attachments.map((a) => a.document_id) } : {}),
      });
      atBottom.current = true;
      setMessages((current) => (current.some((m) => m.id === message.id) ? current : [...current, message]));
      setDraft('');
      setAttachments([]);
      if (!activeId) await conversations.refetch();
    } catch (caught) {
      toast.error(errorText(caught, 'Could not send that message.'));
    } finally {
      setSending(false);
    }
  };

  const lastOwn = [...messages].reverse().find((m) => m.sender_type === 'Client');

  if (conversations.error) return <ErrorState message={conversations.error} onRetry={conversations.refetch} />;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
      <p className="pb-2 text-xs text-ink-muted">
        <span className="font-semibold text-ink">Enzo Interiors</span> · We usually reply within a working day, and
        email you when we do.
      </p>

      {conversations.loading ? (
        <LoadingState label="Loading your messages…" />
      ) : (
        <>
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
              <EmptyState title="No messages yet" message="Ask us anything about your project. Write below to start." />
            ) : (
              <ul className="flex flex-col gap-2">
                {messages.map((message, index) => {
                  const fromMe = message.sender_type === 'Client';
                  const previous = messages[index - 1];
                  // Local days, like the label: the first 10 chars of the ISO string are the UTC day.
                  const newDay =
                    !previous || new Date(previous.created_at).toDateString() !== new Date(message.created_at).toDateString();
                  return (
                    <li key={message.id}>
                      {newDay ? <p className="my-2 text-center text-xs text-ink-muted">{date(message.created_at)}</p> : null}
                      <div className={clsx('flex', fromMe ? 'justify-end' : 'justify-start')}>
                        <div
                          className={clsx(
                            'group relative max-w-[85%] rounded-card py-2 pl-3 pr-8 sm:max-w-[70%]',
                            fromMe ? 'bg-green-100' : 'bg-surface-muted',
                          )}
                        >
                          <BubbleMenu actions={bubbleActions(message, toast)} />
                          {message.body ? <MessageText text={message.body} /> : null}
                          <Attachments items={message.attachments} />
                          <p className="mt-1 flex items-center gap-1 text-[11px] text-ink-muted">
                            {fromMe ? 'You' : 'Enzo Interiors'} · {time(message.created_at)}
                            {fromMe && message.id === lastOwn?.id && message.read_at ? (
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
            {typing ? <p className="mt-2 text-xs italic text-ink-muted">Enzo Interiors is typing…</p> : null}
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
            above={<Chips items={attachments} onRemove={(id) => setAttachments((c) => c.filter((a) => a.document_id !== id))} />}
            tools={
              <>
                {user ? (
                  <UploadButton
                    clientId={user.id}
                    projects={(projects.data ?? []).map((p) => ({ id: p.id, name: p.name }))}
                    onUploaded={(file) => setAttachments((current) => [...current, file].slice(0, 10))}
                  />
                ) : null}
                {activeId ? (
                  <button
                    type="button"
                    onClick={() => setPicking(true)}
                    aria-label="Attach one of your documents"
                    title="Attach one of your documents"
                    className={TOOL}
                  >
                    <Files size={20} aria-hidden="true" />
                  </button>
                ) : null}
              </>
            }
          />

          {picking && activeId ? (
            <AttachPicker
              conversationId={activeId}
              chosen={attachments}
              onClose={() => setPicking(false)}
              onChoose={(next) => {
                setAttachments(next);
                setPicking(false);
              }}
            />
          ) : null}
        </>
      )}
    </div>
  );
}

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
        void downloadDocument(attachment.document_id).catch((caught) =>
          toast.error(errorText(caught, 'That file is no longer available.')),
        ),
    })),
  ];
}

/** Attachment chips; each opens through the Documents download check. */
function Attachments({ items }: { items: MessageAttachment[] | null }) {
  const toast = useToast();
  if (!items?.length) return null;
  const open = async (attachment: MessageAttachment) => {
    try {
      await downloadDocument(attachment.document_id);
    } catch (caught) {
      toast.error(errorText(caught, 'That file is no longer available.'));
    }
  };
  return (
    <ul className="mt-2 flex flex-col gap-1">
      {items.map((attachment) => (
        <li key={attachment.document_id}>
          <button
            type="button"
            onClick={() => void open(attachment)}
            className="flex min-h-9 w-full items-center gap-1.5 rounded-control border border-border bg-surface px-2 py-1 text-left text-xs text-ink hover:border-green-900"
          >
            <Paperclip size={12} aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">{attachment.name}</span>
            <span className="tabular shrink-0 text-ink-muted">{fileSize(attachment.size_bytes)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** The client's own shared documents, to point the team at one. */
function AttachPicker({
  conversationId,
  chosen,
  onClose,
  onChoose,
}: {
  conversationId: string;
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
      title="Attach a document"
      description="Documents the Enzo team has shared with you."
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
        <LoadingState label="Loading documents…" />
      ) : documents.error ? (
        <ErrorState message={documents.error} onRetry={documents.refetch} />
      ) : !documents.data?.length ? (
        <EmptyState title="No documents yet" message="When the team shares a document with you, you can attach it here." />
      ) : (
        <ul className="flex flex-col">
          {documents.data.map((doc) => (
            <li key={doc.id} className="flex items-center justify-between gap-3">
              <Checkbox label={doc.name} checked={picked.has(doc.id)} onChange={(on) => toggle(doc.id, on)} />
              <span className="tabular shrink-0 text-xs text-ink-muted">{fileSize(doc.size_bytes)}</span>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
