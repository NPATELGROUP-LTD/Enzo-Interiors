import clsx from 'clsx';
import { CaretLeft, Plus } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { TeamThread } from '@/components/TeamThread';
import { Button, Card, EmptyState, ErrorState, LoadingState, Modal, Select } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useQuery } from '@/hooks/useApi';
import { ApiError, api } from '@/lib/api';
import { initials, relative } from '@/lib/format';
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
    <div className="flex h-full min-h-0 flex-col px-5 pb-5 pt-6 sm:px-8 sm:pb-8 lg:pt-8">
      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)] gap-5 lg:grid-cols-[20rem_1fr]">
        <Card className={clsx('flex flex-col overflow-hidden p-0', active && 'hidden lg:flex')}>
          <div className="flex items-center justify-between gap-2 p-3 pb-1.5">
            <h2 className="text-sm font-semibold text-ink">Team</h2>
            <Button variant="secondary" onClick={() => setPicking(true)}>
              <Plus size={16} aria-hidden="true" /> New message
            </Button>
          </div>
          {threads.data.length === 0 ? (
            <EmptyState title="No conversations yet" message="Start a chat with someone on the team, or open a project to message everyone on it." />
          ) : (
            <ul className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-hidden overscroll-contain p-1.5">
              {threads.data.map((thread) => (
                <li key={thread.id} className="rounded-lg odd:bg-[var(--stripe)]">
                  <button
                    type="button"
                    onClick={() => open(thread.id)}
                    aria-current={thread.id === active}
                    className={clsx(
                      'flex w-full gap-2.5 rounded-lg p-3 text-left transition-colors',
                      thread.id === active ? 'bg-green-100' : 'hover:bg-surface-muted/60',
                    )}
                  >
                    <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-surface-muted text-xs font-bold text-ink">
                      {initials(thread.title)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate font-semibold text-ink">{thread.title}</span>
                        {thread.unread_count ? (
                          <span className="tabular shrink-0 rounded-control bg-green-900 px-1.5 py-0.5 text-xs font-bold text-on-primary">
                            <span className="sr-only">Unread: </span>
                            {thread.unread_count}
                          </span>
                        ) : thread.last_message ? (
                          <span className="shrink-0 text-xs text-ink-muted">{relative(thread.last_message.created_at)}</span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-ink-muted">
                        {thread.kind === 'project' ? 'Project · ' : ''}
                        {thread.last_message ? thread.last_message.body || 'Sent a file' : 'No messages yet'}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <section aria-label={current ? `Conversation: ${current.title}` : 'Conversation'} className={clsx('min-h-0 min-w-0 flex-col', active ? 'flex' : 'hidden lg:flex')}>
          {current ? (
            <>
              <div className="flex items-center gap-1 pb-2">
                <button
                  type="button"
                  onClick={() => open(null)}
                  aria-label="Back to conversations"
                  className="-my-2 -ml-2 flex min-h-11 min-w-11 items-center justify-center rounded-control text-ink hover:bg-ink/[0.05] lg:hidden"
                >
                  <CaretLeft size={18} aria-hidden="true" />
                </button>
                <p className="min-w-0 truncate font-semibold text-ink">{current.title}</p>
              </div>
              <TeamThread key={current.id} threadId={current.id} className="flex-1" />
            </>
          ) : (
            <EmptyState title="Select a conversation" message="Choose a person or a project to read the thread." />
          )}
        </section>
      </div>

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
