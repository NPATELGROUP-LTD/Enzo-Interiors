import clsx from 'clsx';
import { Paperclip, Send, X } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';

import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Select,
  StatusTag,
} from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useQuery } from '@/hooks/useApi';
import { ApiError, api } from '@/lib/api';
import { fileSize, initials, relative, time } from '@/lib/format';
import { getSocket } from '@/lib/socket';
import type { Conversation, Message, MessageAttachment, SavedReply } from '@/types/api';

export function MessagesPage() {
  const toast = useToast();
  const conversations = useQuery<Conversation[]>('/conversations');
  const savedReplies = useQuery<SavedReply[]>('/saved-replies');

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

  // Pick the first thread once the list arrives, so the screen is never empty
  // on a workspace that has conversations.
  useEffect(() => {
    if (!activeId && conversations.data && conversations.data.length > 0) {
      setActiveId(conversations.data[0]!.id);
    }
  }, [conversations.data, activeId]);

  // Load the selected thread and mark it read.
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

    const socket = getSocket();
    socket?.emit('conversation:join', { conversationId: activeId });

    return () => {
      cancelled = true;
    };
    // conversations.refetch is stable enough for this effect's purpose and
    // including it would re-run the load on every list refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  // Live inbound messages.
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onNew = (message: Message) => {
      if (message.conversation_id === activeId) {
        // Guard against the echo of our own optimistic send.
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

  // Keep the newest message in view.
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

  /**
   * Attachments are metadata only this phase — there is no object storage, so
   * the file is never read or uploaded. Picking a file records its name and
   * size so the thread shows a realistic attachment chip.
   */
  const onPickFile = (event: React.ChangeEvent<HTMLInputElement>) => {
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

  const active = (conversations.data ?? []).find((conversation) => conversation.id === activeId);

  if (conversations.error) {
    return <ErrorState message={conversations.error} onRetry={conversations.refetch} />;
  }

  return (
    <>
      <PageHeader
        title="Messages"
        description="Every client conversation in one inbox, live over WebSocket."
      />

      {conversations.loading ? (
        <LoadingState label="Loading conversations…" />
      ) : (conversations.data ?? []).length === 0 ? (
        <Card className="p-0">
          <EmptyState
            title="No conversations"
            message="Client conversations will appear here once a thread is started."
          />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
          {/* Thread list */}
          <Card className="p-0 lg:max-h-[calc(100dvh-13rem)] lg:overflow-y-auto">
            <ul className="flex flex-col divide-y divide-border">
              {(conversations.data ?? []).map((conversation) => (
                <li key={conversation.id}>
                  <button
                    type="button"
                    onClick={() => setActiveId(conversation.id)}
                    aria-current={conversation.id === activeId}
                    className={clsx(
                      'flex w-full gap-2.5 p-3 text-left transition-colors',
                      conversation.id === activeId
                        ? 'bg-green-100'
                        : 'hover:bg-surface-muted/60',
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
                        <span className="truncate font-semibold text-ink">
                          {conversation.client_name}
                        </span>
                        {conversation.unread_count > 0 ? (
                          <span className="tabular shrink-0 rounded-control bg-green-900 px-1.5 py-0.5 text-xs font-bold text-on-primary">
                            {conversation.unread_count}
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-ink-muted">
                        {conversation.subject}
                      </span>
                      {conversation.last_message ? (
                        <span className="mt-0.5 block truncate text-xs text-ink-muted">
                          {relative(conversation.last_message.created_at)} ·{' '}
                          {conversation.last_message.body}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>

          {/* Thread */}
          <Card className="flex min-h-[28rem] flex-col p-0 lg:max-h-[calc(100dvh-13rem)]">
            {active ? (
              <>
                <div className="flex items-center justify-between gap-3 border-b border-border p-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink">{active.client_name}</p>
                    <p className="truncate text-xs text-ink-muted">{active.subject}</p>
                  </div>
                  <StatusTag tone="neutral">{active.message_count} messages</StatusTag>
                </div>

                <div ref={scrollRef} className="flex-1 overflow-y-auto p-3">
                  {loadingThread ? (
                    <LoadingState label="Loading messages…" />
                  ) : threadError ? (
                    <ErrorState message={threadError} />
                  ) : messages.length === 0 ? (
                    <EmptyState
                      title="No messages yet"
                      message="Send the first message in this conversation."
                    />
                  ) : (
                    <ul className="flex flex-col gap-3">
                      {messages.map((message) => {
                        const fromStaff = message.sender_type === 'Staff';
                        return (
                          <li
                            key={message.id}
                            className={clsx('flex', fromStaff ? 'justify-end' : 'justify-start')}
                          >
                            <div
                              className={clsx(
                                'max-w-[85%] rounded-card border p-2.5 sm:max-w-[70%]',
                                fromStaff
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
                                {fromStaff ? 'You' : active.client_name} · {time(message.created_at)}
                              </p>
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
                  {(savedReplies.data ?? []).length > 0 ? (
                    <div className="mb-2">
                      <Select
                        label="Saved reply"
                        value=""
                        onChange={(event) => {
                          const template = (savedReplies.data ?? []).find(
                            (entry) => entry.id === event.target.value,
                          );
                          if (template) setDraft(template.body);
                        }}
                      >
                        <option value="">Insert a saved reply…</option>
                        {(savedReplies.data ?? []).map((template) => (
                          <option key={template.id} value={template.id}>
                            {template.title}
                            {template.staff_id === null ? ' (shared)' : ''}
                          </option>
                        ))}
                      </Select>
                    </div>
                  ) : null}

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
                        // Enter sends; Shift+Enter is a newline — the convention
                        // in every chat tool the team already uses.
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault();
                          void send(event as unknown as FormEvent);
                        }
                      }}
                      rows={2}
                      placeholder="Write a reply… (Enter to send, Shift+Enter for a new line)"
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
                      title="Attach a file (metadata only in this prototype)"
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
              </>
            ) : (
              <EmptyState title="Select a conversation" message="Choose a thread to read it." />
            )}
          </Card>
        </div>
      )}
    </>
  );
}
