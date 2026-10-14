import clsx from 'clsx';
import { Checks, Paperclip, PaperPlaneRight, X } from '@phosphor-icons/react';
import { useEffect, useRef, useState, type FormEvent } from 'react';

import { Button, Card, Checkbox, EmptyState, ErrorState, LoadingState, Modal, PageHeader } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useQuery } from '@/hooks/useApi';
import { ApiError, api } from '@/lib/api';
import { date, fileSize, time } from '@/lib/format';
import { connectSocket } from '@/lib/socket';
import type { AttachableDocument, Conversation, DocumentDownload, Message, MessageAttachment } from '@/types/api';

const MAX_BODY = 5000;
const errorText = (caught: unknown, fallback: string) => (caught instanceof ApiError ? caught.message : fallback);

/**
 * The client's one conversation with the Enzo team. It opens straight into
 * the thread; the first message starts it. Replies arrive live over the
 * socket; sending is a plain POST, which the API also delivers live.
 */
export function MessagesPage() {
  const toast = useToast();
  const conversations = useQuery<Conversation[]>('/conversations');
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

  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
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

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, typing]);

  const lastPing = useRef(0);
  const pingTyping = () => {
    if (!activeId || Date.now() - lastPing.current < 2000) return;
    lastPing.current = Date.now();
    connectSocket()?.emit('conversation:typing', { conversationId: activeId });
  };

  const send = async (event?: FormEvent) => {
    event?.preventDefault();
    if (sending || (!draft.trim() && attachments.length === 0)) return;
    setSending(true);
    try {
      // The first message starts the conversation.
      const id = activeId ?? (await api.post<Conversation>('/conversations', {})).id;
      const message = await api.post<Message>(`/conversations/${id}/messages`, {
        body: draft.trim(),
        ...(attachments.length ? { document_ids: attachments.map((a) => a.document_id) } : {}),
      });
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
      <PageHeader title="Messages" description="Talk to the Enzo Interiors team." />

      {conversations.loading ? (
        <LoadingState label="Loading your messages…" />
      ) : (
        <Card className="flex min-h-0 flex-1 flex-col p-0">
          <div className="bg-ink/[0.025] p-3">
            <p className="font-semibold text-ink">Enzo Interiors</p>
            <p className="text-xs text-ink-muted">
              We usually reply within a working day. We will email you when there is a reply.
            </p>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3" aria-live="polite">
            {loadingThread ? (
              <LoadingState label="Loading messages…" />
            ) : threadError ? (
              <ErrorState message={threadError} />
            ) : messages.length === 0 ? (
              <EmptyState title="No messages yet" message="Ask us anything about your project. Write below to start." />
            ) : (
              <ul className="flex flex-col gap-3">
                {messages.map((message, index) => {
                  const fromMe = message.sender_type === 'Client';
                  const previous = messages[index - 1];
                  const newDay = !previous || previous.created_at.slice(0, 10) !== message.created_at.slice(0, 10);
                  return (
                    <li key={message.id}>
                      {newDay ? <p className="my-2 text-center text-xs text-ink-muted">{date(message.created_at)}</p> : null}
                      <div className={clsx('flex', fromMe ? 'justify-end' : 'justify-start')}>
                        <div
                          className={clsx(
                            'max-w-[85%] rounded-card p-2.5 sm:max-w-[70%]',
                            fromMe ? 'bg-green-100' : 'bg-surface-muted',
                          )}
                        >
                          {message.body ? (
                            <p className="whitespace-pre-wrap break-words leading-relaxed text-ink">{message.body}</p>
                          ) : null}
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

          <form onSubmit={send} className="bg-ink/[0.025] p-3">
            {attachments.length > 0 ? (
              <ul className="mb-2 flex flex-wrap gap-1.5">
                {attachments.map((attachment) => (
                  <li
                    key={attachment.document_id}
                    className="flex items-center gap-1.5 rounded-control bg-surface-muted px-2 py-1 text-xs text-ink"
                  >
                    <Paperclip size={12} aria-hidden="true" />
                    <span className="max-w-40 truncate">{attachment.name}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setAttachments((current) => current.filter((a) => a.document_id !== attachment.document_id))
                      }
                      aria-label={`Remove ${attachment.name}`}
                      className="text-ink-muted hover:text-danger"
                    >
                      <X size={12} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="flex items-end gap-2">
              <label htmlFor="message-body" className="sr-only">
                Message
              </label>
              <textarea
                id="message-body"
                value={draft}
                maxLength={MAX_BODY}
                onChange={(event) => {
                  setDraft(event.target.value);
                  pingTyping();
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void send();
                  }
                }}
                rows={2}
                placeholder="Write a message…"
                className="min-h-11 flex-1 resize-y rounded-control border border-border bg-surface px-3 py-2 leading-relaxed text-ink placeholder:text-ink-muted/70 focus:border-green-900"
              />
              {activeId ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setPicking(true)}
                  aria-label="Attach one of your documents"
                  title="Attach one of your documents"
                >
                  <Paperclip size={16} aria-hidden="true" />
                </Button>
              ) : null}
              <Button
                type="submit"
                variant="primary"
                loading={sending}
                disabled={!draft.trim() && attachments.length === 0}
                icon={<PaperPlaneRight size={16} aria-hidden="true" />}
              >
                Send
              </Button>
            </div>
          </form>

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
        </Card>
      )}
    </div>
  );
}

/** Attachment chips; each opens through the Documents download check. */
function Attachments({ items }: { items: MessageAttachment[] | null }) {
  const toast = useToast();
  if (!items?.length) return null;
  const open = async (attachment: MessageAttachment) => {
    try {
      const { url } = await api.get<DocumentDownload>(`/documents/${attachment.document_id}/download`);
      window.location.assign(url);
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
