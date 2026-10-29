import clsx from 'clsx';
import { FileText, Paperclip, X } from '@phosphor-icons/react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Composer, MessageText, TOOL } from '@/components/chat';
import { Card, ErrorState, LoadingState } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/lib/auth';
import { ApiError, api } from '@/lib/api';
import { fileSize, relative } from '@/lib/format';
import { connectSocket } from '@/lib/socket';
import type { TeamMessage } from '@/types/api';

const ACCEPT = 'video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm,.jpg,.jpeg,.png,.webp,.pdf';
const MAX_VIDEO = 100 * 1024 * 1024;
const MAX_FILE = 25 * 1024 * 1024;

/**
 * One staff conversation: a project's thread or a direct chat. Messages arrive over the
 * socket (`team:message`), sending is a POST that the API also delivers live. Staff only:
 * the API refuses clients, and nothing here is shown in the portal.
 */
export function TeamThread({ threadId, className }: { threadId: string; className?: string }) {
  const toast = useToast();
  const { user } = useAuth();
  const [messages, setMessages] = useState<TeamMessage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const current = useRef(threadId);
  current.current = threadId;

  const load = useCallback(async () => {
    try {
      const loaded = await api.get<TeamMessage[]>(`/team/threads/${threadId}/messages`);
      // A slower reply for a thread we have since left must not replace this one's messages.
      if (current.current !== threadId) return;
      setMessages(loaded);
      setError(null);
      void api.put(`/team/threads/${threadId}/read`, {}).catch(() => undefined);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not load this conversation.');
    }
  }, [threadId]);

  useEffect(() => {
    setMessages(null);
    void load();
    const socket = connectSocket();
    const onNew = (event: { thread_id: string }) => event.thread_id === threadId && void load();
    socket?.on('team:message', onNew);
    return () => {
      socket?.off('team:message', onNew);
    };
  }, [threadId, load]);

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [messages?.length]);

  const choose = (picked: File | undefined) => {
    if (picker.current) picker.current.value = '';
    if (!picked) return;
    const limit = picked.type.startsWith('video/') || /\.(mp4|mov|webm)$/i.test(picked.name) ? MAX_VIDEO : MAX_FILE;
    if (picked.size > limit) return toast.error(limit === MAX_VIDEO ? 'Videos can be up to 100 MB.' : 'Files can be up to 25 MB.');
    setFile(picked);
  };

  const send = async () => {
    if (sending || (!body.trim() && !file)) return;
    setSending(true);
    try {
      let sent: TeamMessage;
      if (file) {
        const form = new FormData();
        form.append('file', file);
        if (body.trim()) form.append('body', body.trim());
        sent = await api.post<TeamMessage>(`/team/threads/${threadId}/messages`, form);
      } else {
        sent = await api.post<TeamMessage>(`/team/threads/${threadId}/messages`, { body });
      }
      setMessages((current) => [...(current ?? []), sent]);
      setBody('');
      setFile(null);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'That did not send.');
    } finally {
      setSending(false);
    }
  };

  const open = async (message: TeamMessage, index: number) => {
    try {
      const { url } = await api.get<{ url: string }>(`/team/threads/${threadId}/messages/${message.id}/files/${index}`);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not open that file.');
    }
  };

  if (error && !messages) return <ErrorState message={error} onRetry={() => void load()} />;
  if (!messages) return <LoadingState label="Loading messages…" />;

  return (
    <div className={clsx('flex min-h-0 flex-col', className)}>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain py-2" aria-live="polite">
        {messages.length === 0 ? <p className="py-6 text-center text-sm text-ink-muted">No messages yet. Say hello, or send a photo or video.</p> : null}
        {messages.map((message) => {
          const mine = message.sender_id === user?.id;
          return (
            <div key={message.id} className={clsx('flex flex-col', mine ? 'items-end' : 'items-start')}>
              <p className="mb-0.5 px-1 text-xs text-ink-muted">
                {mine ? 'You' : message.sender_name} · {relative(message.created_at)}
              </p>
              <div className={clsx('max-w-[85%] rounded-[14px] px-3.5 py-2 text-sm', mine ? 'bg-green-900/10' : 'bg-ink/[0.05]')}>
                {message.body ? <MessageText text={message.body} /> : null}
                {message.attachments?.map((attachment, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => void open(message, index)}
                    className={clsx('flex items-center gap-2 rounded-[8px] bg-surface px-2.5 py-1.5 text-left hover:bg-surface/70', message.body && 'mt-2')}
                  >
                    <FileText size={18} aria-hidden="true" className="shrink-0 text-green-900" />
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-ink">{attachment.name}</span>
                      <span className="block text-xs text-ink-muted">{attachment.type.startsWith('video/') ? 'Video' : attachment.type.startsWith('image/') ? 'Photo' : 'PDF'} · {fileSize(attachment.size_bytes)} · Open</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        <div ref={end} />
      </div>
      <Composer
        value={body}
        onChange={setBody}
        onSend={() => void send()}
        sending={sending}
        canSend={Boolean(body.trim() || file)}
        placeholder="Write a message…"
        tools={
          <>
            <button type="button" onClick={() => picker.current?.click()} aria-label="Attach a photo, video or PDF" title="Attach a photo, video (up to 100 MB) or PDF" className={TOOL}>
              <Paperclip size={20} aria-hidden="true" />
            </button>
            <input ref={picker} type="file" accept={ACCEPT} hidden onChange={(event) => choose(event.target.files?.[0])} />
          </>
        }
        above={
          file ? (
            <p className="mb-2 flex items-center gap-2 rounded-[10px] bg-ink/[0.05] px-3 py-1.5 text-sm text-ink">
              <FileText size={16} aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">
                {file.name} · {fileSize(file.size)}
              </span>
              <button type="button" onClick={() => setFile(null)} aria-label="Remove the attachment" className="text-ink-muted hover:text-ink">
                <X size={16} aria-hidden="true" />
              </button>
            </p>
          ) : null
        }
      />
    </div>
  );
}

/** A project's thread, as a card on the project page: everyone on the project and the Admins, no clients. */
export function ProjectThread({ projectId }: { projectId: string }) {
  const [thread, setThread] = useState<{ id: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    api
      .get<{ id: string }>(`/team/projects/${projectId}/thread`)
      .then((found) => live && setThread(found))
      .catch((caught) => live && setError(caught instanceof ApiError ? caught.message : 'Could not open the thread.'));
    return () => {
      live = false;
    };
  }, [projectId]);

  return (
    <Card className="flex max-h-[32rem] flex-col">
      <h2 className="pb-1 text-sm font-semibold text-ink">Team thread</h2>
      <p className="pb-2 text-xs text-ink-muted">Messages, photos and videos for everyone on this project and the Admins. Clients never see this.</p>
      {error ? <ErrorState message={error} /> : thread ? <TeamThread threadId={thread.id} className="h-96" /> : <LoadingState label="Opening the thread…" />}
    </Card>
  );
}
