import clsx from 'clsx';
import { Paperclip, Send, X } from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';

import { Button, Card, EmptyState, ErrorState, LoadingState, PageHeader } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useQuery } from '@/hooks/useApi';
import { ApiError, api } from '@/lib/api';
import { date, fileSize, time } from '@/lib/format';
import { getSocket } from '@/lib/socket';
import type { Conversation, Message, MessageAttachment } from '@/types/api';

/**
 * Client chat with the Enzo team.
 *
 * A client normally has a single thread, so unlike the admin inbox this screen
 * opens straight into the conversation rather than showing a list first. When
 * there is more than one, a compact switcher appears above the thread.
 */
export function MessagesPage() {
  const toast = useToast();
  const conversations = useQuery<Conversation[]>('/conversations');

  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [attachments, setAttachments] = useState<MessageAttachment[]>([]);
  const [sending, setSending] = useState(false);
  const [typingFrom, setTypingFrom] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!activeId && conversations.data && conversations.data.length > 0) {
      setActiveId(conversations.data[0]!.id);
    }
  }, [conversations.data, activeId]);

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
        await conversations.refetch();
      })
      .catch((caught) => {
        if (!cancelled) {
          setThreadError(
            caught instanceof ApiError ? caught.message : 'Could not load this conversation.',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingThread(false);
      });

    getSocket()?.emit('conversation:join', { conversationId: activeId });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onNew = (message: Message) => {
      if (message.conversation_id === activeId) {
        setMessages((current) =>
          current.some((entry) => entry.id === message.id) ? current : [...current, message],
        );
        void api.put(`/conversations/${activeId}/read`).catch(() => undefined);
      }
      void conversations.refetch();
    };
    const onTyping = (payload: { conversationId: string; name: string }) => {
      if (payload.conversationId !== activeId) return;
      setTypingFrom(payload.name);
      window.setTimeout(() => setTypingFrom(null), 2500);
    };

    socket.on('message:new', onNew);
    socket.on('conversation:typing', onTyping);
    return () => {
      socket.off('message:new', onNew);
      socket.off('conversation:typing', onTyping);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  const send = async (event: FormEvent) => {
    event.preventDefault();
    if (!activeId || (!draft.trim() && attachments.length === 0)) return;

    setSending(true);
    try {
      const message = await api.post<Message>(`/conversations/${activeId}/messages`, {
        body: draft.trim() || '(attachment)',
        attachments: attachments.length > 0 ? attachments : undefined,
      });
      setMessages((current) =>
        current.some((entry) => entry.id === message.id) ? current : [...current, message],
      );
      setDraft('');
      setAttachments([]);
      await conversations.refetch();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not send that message.');
    } finally {
      setSending(false);
    }
  };

  /** Metadata only — no object storage this phase, so no bytes are uploaded. */
  const onPickFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setAttachments((current) => [
      ...current,
      {
        name: file.name,
        size_bytes: file.size,
        storage_url: `placeholder://message-attachments/${activeId}/${file.name}`,
      },
    ]);
    event.target.value = '';
  };

  const list = conversations.data ?? [];
  const active = list.find((conversation) => conversation.id === activeId);

  if (conversations.error) {
    return <ErrorState message={conversations.error} onRetry={conversations.refetch} />;
  }

  return (
    <>
      <PageHeader title="Messages" description="Talk to the Enzo Interiors team." />

      {conversations.loading ? (
        <LoadingState label="Loading your messages…" />
      ) : list.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            title="No messages yet"
            message="When the Enzo team gets in touch, the conversation will appear here."
          />
        </Card>
      ) : (
        <>
          {list.length > 1 ? (
            <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Conversations">
              {list.map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => setActiveId(conversation.id)}
                  aria-pressed={conversation.id === activeId}
                  className={clsx(
                    'min-h-11 rounded-control border px-3 text-sm font-semibold transition-colors duration-[160ms]',
                    conversation.id === activeId
                      ? 'border-green-900 bg-green-100 text-green-900'
                      : 'border-border bg-surface text-ink-muted hover:text-ink',
                  )}
                >
                  {conversation.subject}
                  {conversation.unread_count > 0 ? (
                    <span className="tabular ml-1.5 rounded-control bg-green-900 px-1.5 py-0.5 text-xs text-on-primary">
                      {conversation.unread_count}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}

          <Card className="flex min-h-[28rem] flex-col p-0 lg:max-h-[calc(100dvh-16rem)]">
            <div className="border-b border-border p-3">
              <p className="font-semibold text-ink">{active?.subject ?? 'Conversation'}</p>
              <p className="text-xs text-ink-muted">
                With the Enzo Interiors team · replies usually within a working day
              </p>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-3">
              {loadingThread ? (
                <LoadingState label="Loading messages…" />
              ) : threadError ? (
                <ErrorState message={threadError} />
              ) : messages.length === 0 ? (
                <EmptyState
                  title="No messages yet"
                  message="Send the first message — we are happy to help with anything."
                />
              ) : (
                <ul className="flex flex-col gap-3">
                  {messages.map((message, index) => {
                    const fromMe = message.sender_type === 'Client';
                    const previous = messages[index - 1];
                    const showDate =
                      !previous ||
                      previous.created_at.slice(0, 10) !== message.created_at.slice(0, 10);

                    return (
                      <li key={message.id}>
                        {showDate ? (
                          <p className="my-2 text-center text-xs text-ink-muted">
                            {date(message.created_at)}
                          </p>
                        ) : null}
                        <div className={clsx('flex', fromMe ? 'justify-end' : 'justify-start')}>
                          <div
                            className={clsx(
                              'max-w-[85%] rounded-card border p-2.5 sm:max-w-[70%]',
                              fromMe
                                ? 'border-green-900/25 bg-green-100'
                                : 'border-border bg-surface-muted',
                            )}
                          >
                            <p className="whitespace-pre-wrap leading-relaxed text-ink">
                              {message.body}
                            </p>
                            {message.attachments?.length ? (
                              <ul className="mt-2 flex flex-col gap-1">
                                {message.attachments.map((attachment) => (
                                  <li
                                    key={attachment.name}
                                    className="flex items-center gap-1.5 rounded-control border border-border bg-surface px-2 py-1 text-xs text-ink"
                                  >
                                    <Paperclip size={12} aria-hidden="true" />
                                    <span className="truncate">{attachment.name}</span>
                                    <span className="tabular shrink-0 text-ink-muted">
                                      {fileSize(attachment.size_bytes)}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                            <p className="mt-1 text-[11px] text-ink-muted">
                              {fromMe ? 'You' : 'Enzo Interiors'} · {time(message.created_at)}
                            </p>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              {typingFrom ? (
                <p className="mt-2 text-xs italic text-ink-muted">{typingFrom} is typing…</p>
              ) : null}
            </div>

            <form onSubmit={send} className="border-t border-border p-3">
              {attachments.length > 0 ? (
                <ul className="mb-2 flex flex-wrap gap-1.5">
                  {attachments.map((attachment, index) => (
                    <li
                      key={`${attachment.name}-${index}`}
                      className="flex items-center gap-1.5 rounded-control border border-border bg-surface-muted px-2 py-1 text-xs text-ink"
                    >
                      <Paperclip size={12} aria-hidden="true" />
                      <span className="max-w-40 truncate">{attachment.name}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setAttachments((current) => current.filter((_, i) => i !== index))
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
                  onChange={(event) => {
                    setDraft(event.target.value);
                    getSocket()?.emit('conversation:typing', { conversationId: activeId });
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      void send(event as unknown as FormEvent);
                    }
                  }}
                  rows={2}
                  placeholder="Write a message…"
                  className="min-h-11 flex-1 resize-y rounded-control border border-border bg-surface px-3 py-2 leading-relaxed text-ink placeholder:text-ink-muted/70 focus:border-green-900"
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={onPickFile}
                  className="sr-only"
                  aria-hidden="true"
                  tabIndex={-1}
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Attach a file"
                  title="Attach a file"
                >
                  <Paperclip size={16} aria-hidden="true" />
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  loading={sending}
                  disabled={!draft.trim() && attachments.length === 0}
                  icon={<Send size={16} aria-hidden="true" />}
                >
                  Send
                </Button>
              </div>
            </form>
          </Card>
        </>
      )}
    </>
  );
}
