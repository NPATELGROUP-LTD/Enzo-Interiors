import clsx from 'clsx';
import { CaretLeft, ChatsCircle, Plus } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { TeamThread } from '@/components/TeamThread';
import { Button, Card, EmptyState, ErrorState, LoadingState, Modal, Select } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useQuery } from '@/hooks/useApi';
import { ApiError, api } from '@/lib/api';
import { relative } from '@/lib/format';
import { connectSocket } from '@/lib/socket';
import type { TeamPerson, TeamThreadSummary } from '@/types/api';

/**
 * Staff chat: a thread for each project you work on (shared with the others on it and the Admins)
 * and direct chats between two people. Staff only; clients never see any of it.
 * `?thread=<id>` opens one (the bell links here).
 */
export function TeamPage() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const threads = useQuery<TeamThreadSummary[]>('/team/threads');
  const people = useQuery<TeamPerson[]>('/team/people');
  const [picking, setPicking] = useState(false);
  const [person, setPerson] = useState('');
  const [starting, setStarting] = useState(false);
  const active = params.get('thread');
  const { refetch } = threads;

  // A new message anywhere refreshes the list (unread dots, order).
  useEffect(() => {
    const socket = connectSocket();
    const onNew = () => void refetch();
    socket?.on('team:message', onNew);
    return () => {
      socket?.off('team:message', onNew);
    };
  }, [refetch]);

  const open = (id: string | null) => setParams(id ? { thread: id } : {}, { replace: true });

  const start = async () => {
    setStarting(true);
    try {
      const thread = await api.post<TeamThreadSummary>('/team/direct', { staff_id: person });
      await refetch();
      setPicking(false);
      open(thread.id);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not start that chat.');
    } finally {
      setStarting(false);
    }
  };

  if (threads.error && !threads.data) return <ErrorState message={threads.error} onRetry={() => void refetch()} />;
  if (!threads.data) return <LoadingState label="Loading conversations…" />;

  const current = threads.data.find((thread) => thread.id === active);

  return (
    <div className="grid min-h-0 gap-4 md:grid-cols-[18rem_1fr]">
      <Card className={clsx('p-0', active && 'hidden md:block')}>
        <div className="flex items-center justify-between gap-2 p-3">
          <h2 className="text-sm font-semibold text-ink">Team</h2>
          <Button variant="secondary" onClick={() => setPicking(true)}>
            <Plus size={16} aria-hidden="true" /> New message
          </Button>
        </div>
        {threads.data.length === 0 ? (
          <EmptyState title="No conversations yet" message="Start a chat with someone on the team, or open a project to message everyone on it." />
        ) : (
          <ul>
            {threads.data.map((thread) => (
              <li key={thread.id}>
                <button
                  type="button"
                  onClick={() => open(thread.id)}
                  aria-current={thread.id === active ? 'true' : undefined}
                  className={clsx('block w-full px-3 py-2.5 text-left hover:bg-ink/[0.05]', thread.id === active && 'bg-green-900/10')}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-ink">{thread.title}</span>
                    {thread.unread_count ? (
                      <span className="shrink-0 rounded-full bg-green-900 px-1.5 text-xs text-on-primary" aria-label={`${thread.unread_count} unread`}>
                        {thread.unread_count}
                      </span>
                    ) : null}
                  </span>
                  <span className="block truncate text-xs text-ink-muted">
                    {thread.kind === 'project' ? 'Project · ' : ''}
                    {thread.last_message ? `${thread.last_message.body || 'Sent a file'} · ${relative(thread.last_message.created_at)}` : 'No messages yet'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className={clsx('flex h-[calc(100dvh-12rem)] min-h-96 flex-col', !active && 'hidden md:flex')}>
        {current ? (
          <>
            <div className="flex items-center gap-2 pb-2">
              <button type="button" onClick={() => open(null)} aria-label="Back to conversations" className="md:hidden">
                <CaretLeft size={20} aria-hidden="true" />
              </button>
              <h2 className="truncate text-sm font-semibold text-ink">{current.title}</h2>
            </div>
            <TeamThread key={current.id} threadId={current.id} className="flex-1" />
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-ink-muted">
            <ChatsCircle size={32} aria-hidden="true" />
            <p>Choose a conversation.</p>
          </div>
        )}
      </Card>

      <Modal
        open={picking}
        onClose={() => setPicking(false)}
        title="New message"
        description="Chat with someone on the team."
        footer={
          <>
            <Button variant="secondary" onClick={() => setPicking(false)} disabled={starting}>
              Cancel
            </Button>
            <Button variant="primary" loading={starting} disabled={!person} onClick={() => void start()}>
              Start chat
            </Button>
          </>
        }
      >
        <Select label="Who" value={person} onChange={(event) => setPerson(event.target.value)}>
          <option value="">Choose a person…</option>
          {(people.data ?? []).map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} ({item.role})
            </option>
          ))}
        </Select>
      </Modal>
    </div>
  );
}
