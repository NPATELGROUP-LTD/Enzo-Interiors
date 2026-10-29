import clsx from 'clsx';
import { FileText, Paperclip, X } from '@phosphor-icons/react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Composer, MessageText, TOOL } from '@/components/chat';
import { useFileViewer } from '@/components/FileViewer';
import { Card, EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/lib/auth';
import { ApiError, api } from '@/lib/api';
import { date, fileSize, time } from '@/lib/format';
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
  const files = useFileViewer();
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

  // Opens in the page like the client chat's files: a photo, video or PDF in a dialog, anything else saved.
  const open = (message: TeamMessage, index: number) => {
    const attachment = message.attachments?.[index];
    if (!attachment) return;
    const preview = attachment.type.startsWith('video/') ? 'video' : attachment.type.startsWith('image/') ? 'image' : attachment.type === 'application/pdf' ? 'pdf' : null;
    void files.show({
      id: `${message.id}:${index}`,
      name: attachment.name,
      preview,
      link: async () => (await api.get<{ url: string }>(`/team/threads/${threadId}/messages/${message.id}/files/${index}`)).url,
    });
  };

  if (error && !messages) return <ErrorState message={error} onRetry={() => void load()} />;
  if (!messages) return <LoadingState label="Loading messages…" />;

  return (
    <div className={clsx('flex min-h-0 flex-col', className)}>
      {files.viewer}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain" aria-live="polite">
        {messages.length === 0 ? <EmptyState title="No messages yet" message="Say hello, or send a photo or video." /> : null}
        <ul className="flex flex-col gap-2">
          {messages.map((message, index) => {
            const mine = message.sender_id === user?.id;
            const previous = messages[index - 1];
            const newDay = !previous || previous.created_at.slice(0, 10) !== message.created_at.slice(0, 10);
            return (
              <li key={message.id}>
                {newDay ? <p className="my-2 text-center text-xs text-ink-muted">{date(message.created_at)}</p> : null}
                <div className={clsx('flex', mine ? 'justify-end' : 'justify-start')}>
                  <div className={clsx('relative max-w-[85%] rounded-card py-2 pl-3 pr-3 sm:max-w-[70%]', mine ? 'bg-green-100' : 'bg-surface-muted')}>
                    {message.body ? <MessageText text={message.body} /> : null}
                    {message.attachments?.length ? (
                      <ul className="mt-2 flex flex-col gap-1">
                        {message.attachments.map((attachment, fileIndex) => (
                          <li key={fileIndex}>
                            <button
                              type="button"
                              onClick={() => open(message, fileIndex)}
                              className="flex w-full items-center gap-1.5 rounded-control border border-border bg-surface px-2 py-1 text-left text-xs text-ink hover:border-green-900"
                            >
                              <Paperclip size={12} aria-hidden="true" />
                              <span className="min-w-0 flex-1 truncate">{attachment.name}</span>
                              <span className="tabular shrink-0 text-ink-muted">{fileSize(attachment.size_bytes)}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <p className="mt-1 text-[11px] text-ink-muted">
                      {mine ? 'You' : message.sender_name} · {time(message.created_at)}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
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
    <Card className="flex h-[36rem] flex-col xl:sticky xl:top-6">
      <h2 className="pb-1 text-sm font-semibold text-ink">Team thread</h2>
      <p className="pb-2 text-xs text-ink-muted">Messages, photos and videos for everyone on this project and the Admins. Clients never see this.</p>
      {error ? <ErrorState message={error} /> : thread ? <TeamThread threadId={thread.id} className="min-h-0 flex-1" /> : <LoadingState label="Opening the thread…" />}
    </Card>
  );
}
