import clsx from 'clsx';
import { Files, Paperclip, X } from '@phosphor-icons/react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { Composer, MessageText, TOOL, UploadButton } from '@/components/chat';
import { AttachPicker, Attachments } from '@/pages/Messages';
import { Card, EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { date, time } from '@/lib/format';
import { connectSocket } from '@/lib/socket';
import type { Conversation, Message, MessageAttachment } from '@/types/api';

/**
 * The client's thread, on the client page. Same endpoints and live events as
 * Messages; files are uploaded onto one of the client's shared projects, saved
 * replies stay in Messages. Only mounted for a client who can read it (Active,
 * with portal access).
 */
export function ClientChat({
  clientId,
  clientName,
  projects,
  className,
}: {
  clientId: string;
  clientName: string;
  /** The client's projects a file can go on (shared with the client). */
  projects: Array<{ id: string; name: string }>;
  className?: string;
}) {
  const [attachments, setAttachments] = useState<MessageAttachment[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [picking, setPicking] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);

  // Find or start the conversation, load it and mark it read.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .post<Conversation>('/conversations', { client_id: clientId })
      .then(async (conversation) => {
        const thread = await api.get<Message[]>(`/conversations/${conversation.id}/messages`);
        if (cancelled) return;
        setConversationId(conversation.id);
        setMessages(thread);
        void api.put(`/conversations/${conversation.id}/read`).catch(() => undefined);
        connectSocket()?.emit('conversation:join', { conversationId: conversation.id });
      })
      .catch(
        (caught) =>
          !cancelled &&
          setError(
            caught instanceof ApiError ? caught.message : 'Could not open this conversation.',
          ),
      )
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  // Live messages; a catch-up fetch when the tab comes back (the socket can miss some while asleep).
  useEffect(() => {
    if (!conversationId) return;
    const socket = connectSocket();
    const onNew = (message: Message) => {
      if (message.conversation_id !== conversationId) return;
      setMessages((current) =>
        current.some((m) => m.id === message.id) ? current : [...current, message],
      );
      if (message.sender_type === 'Client')
        void api.put(`/conversations/${conversationId}/read`).catch(() => undefined);
    };
    const resync = () => {
      if (document.hidden) return;
      api
        .get<Message[]>(`/conversations/${conversationId}/messages`)
        .then(setMessages)
        .catch(() => undefined);
    };
    socket?.on('message:new', onNew);
    document.addEventListener('visibilitychange', resync);
    return () => {
      socket?.off('message:new', onNew);
      document.removeEventListener('visibilitychange', resync);
    };
  }, [conversationId]);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && atBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  const send = async () => {
    if (!conversationId || sending || (!draft.trim() && attachments.length === 0)) return;
    setSending(true);
    try {
      const message = await api.post<Message>(`/conversations/${conversationId}/messages`, {
        body: draft.trim(),
        ...(attachments.length ? { document_ids: attachments.map((a) => a.document_id) } : {}),
      });
      atBottom.current = true;
      setMessages((current) =>
        current.some((m) => m.id === message.id) ? current : [...current, message],
      );
      setDraft('');
      setAttachments([]);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not send that message.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className={clsx('flex min-h-0 flex-col !p-0', className)}>
      <div className="shrink-0 border-b border-border px-4 py-3.5">
        <p className="label-eyebrow truncate">Chat with {clientName}</p>
      </div>
      <div
        ref={scroller}
        onScroll={(event) => {
          const el = event.currentTarget;
          atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3"
      >
        {loading ? (
          <LoadingState label="Loading messages…" />
        ) : error && !conversationId ? (
          <ErrorState message={error} />
        ) : messages.length === 0 ? (
          <EmptyState title="No messages yet" message={`Write to ${clientName} below.`} />
        ) : (
          <ul className="flex flex-col gap-2">
            {messages.map((message, index) => {
              const fromStaff = message.sender_type === 'Staff';
              const newDay =
                index === 0 ||
                messages[index - 1]?.created_at.slice(0, 10) !== message.created_at.slice(0, 10);
              return (
                <li key={message.id}>
                  {newDay ? (
                    <p className="my-2 text-center text-xs text-ink-muted">
                      {date(message.created_at)}
                    </p>
                  ) : null}
                  <div className={clsx('flex', fromStaff ? 'justify-end' : 'justify-start')}>
                    <div
                      className={clsx(
                        'max-w-[85%] rounded-card px-3 py-2',
                        fromStaff ? 'bg-green-100' : 'bg-surface-muted',
                      )}
                    >
                      {message.body ? <MessageText text={message.body} /> : null}
                      <Attachments items={message.attachments} />
                      <p className="mt-1 text-[11px] text-ink-muted">{time(message.created_at)}</p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {error && conversationId ? <p className="px-4 text-xs text-danger">{error}</p> : null}
      <div className="px-3 pb-3">
        <Composer
          value={draft}
          onChange={setDraft}
          onSend={() => void send()}
          sending={sending}
          canSend={(Boolean(draft.trim()) || attachments.length > 0) && Boolean(conversationId)}
          placeholder="Message"
          above={
            attachments.length ? (
              <ul className="mb-2 flex flex-wrap gap-1.5">
                {attachments.map((file) => (
                  <li
                    key={file.document_id}
                    className="flex items-center gap-1.5 rounded-control bg-surface-muted py-1 pl-2 text-xs text-ink"
                  >
                    <Paperclip size={12} aria-hidden="true" />
                    <span className="max-w-40 truncate">{file.name}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setAttachments((c) => c.filter((a) => a.document_id !== file.document_id))
                      }
                      aria-label={`Remove ${file.name}`}
                      className="flex h-6 w-7 items-center justify-center text-ink-muted hover:text-danger"
                    >
                      <X size={12} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null
          }
          tools={
            <>
              <UploadButton
                clientId={clientId}
                projects={projects}
                onUploaded={(file) => setAttachments((current) => [...current, file].slice(0, 10))}
              />
              <button
                type="button"
                onClick={() => setPicking(true)}
                disabled={!conversationId}
                aria-label="Attach a shared file"
                title="Attach a file shared with this client"
                className={TOOL}
              >
                <Files size={20} aria-hidden="true" />
              </button>
            </>
          }
        />
        {picking && conversationId ? (
          <AttachPicker
            conversationId={conversationId}
            clientName={clientName}
            chosen={attachments}
            onClose={() => setPicking(false)}
            onChoose={(next) => {
              setAttachments(next);
              setPicking(false);
            }}
          />
        ) : null}
      </div>
    </Card>
  );
}
