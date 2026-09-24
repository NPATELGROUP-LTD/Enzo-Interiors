import { Bell, CalendarCheck, ChatCircleText, CheckCircle } from '@phosphor-icons/react';
import clsx from 'clsx';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { api } from '@/lib/api';
import { relative } from '@/lib/format';

import { Badge } from './Desktop';

interface Note {
  id: string;
  kind: 'booking' | 'review' | 'review_reply';
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

const ICONS = { booking: CalendarCheck, review: ChatCircleText, review_reply: CheckCircle };

/** How often the bell asks. It also asks whenever the window comes back into focus. */
const POLL_MS = 60_000;

/**
 * The bell in the menu bar: new bookings, pages sent for review, and replies
 * to your own review requests. Opening one marks it read and goes to it.
 *
 * ponytail: polls once a minute rather than holding a socket open. Plenty for
 * a handful of staff; push over the existing socket.io gateway if it ever
 * needs to be instant.
 */
export function Notifications({ onChange }: { onChange?: () => void }) {
  const navigate = useNavigate();
  const [items, setItems] = useState<Note[]>([]);
  const [unread, setUnread] = useState(0);
  const menu = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const result = await api.get<{ items: Note[]; unread: number }>('/notifications');
      setItems(result.items);
      setUnread((before) => {
        // Something new arrived: let the screens behind refresh their counts.
        if (result.unread > before) onChange?.();
        return result.unread;
      });
    } catch {
      /* Offline or signed out: the bell just stays as it was. */
    }
  }, [onChange]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), POLL_MS);
    const onFocus = () => void load();
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [load]);

  const markRead = async (ids?: string[]) => {
    const now = new Date().toISOString();
    setItems((list) => list.map((item) => (!ids || ids.includes(item.id) ? { ...item, read_at: item.read_at ?? now } : item)));
    setUnread((count) => (ids ? Math.max(0, count - ids.filter((id) => items.find((i) => i.id === id && !i.read_at)).length) : 0));
    await api.post('/notifications/read', ids ? { ids } : {}).catch(() => undefined);
  };

  const open = (item: Note) => {
    menu.current?.hidePopover();
    if (!item.read_at) void markRead([item.id]);
    if (item.link) navigate(item.link);
  };

  return (
    <>
      <button
        type="button"
        popoverTarget="notifications-menu"
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        title="Notifications"
        className="relative flex h-7 w-8 items-center justify-center rounded-[6px] hover:bg-ink/10 pointer-coarse:h-10 pointer-coarse:w-10"
      >
        <Bell size={15} weight={unread ? 'fill' : 'regular'} aria-hidden="true" />
        {unread ? (
          <span className="absolute -right-0.5 -top-0.5">
            <Badge count={unread} />
          </span>
        ) : null}
      </button>

      <div
        ref={menu}
        id="notifications-menu"
        popover="auto"
        className="glass fixed inset-auto right-2 top-11 m-0 w-[min(24rem,calc(100vw-1rem))] rounded-[12px] border border-glass-border p-1.5 text-sm text-ink shadow-window pointer-coarse:top-[3.25rem]"
      >
        <div className="flex items-center justify-between px-2 py-1.5">
          <p className="font-semibold">Notifications</p>
          {unread ? (
            <button type="button" onClick={() => void markRead()} className="text-link text-[13px]">
              Mark all read
            </button>
          ) : null}
        </div>
        <div className="my-1 h-px bg-border" />
        {items.length === 0 ? (
          <p className="px-2 py-6 text-center text-[13px] text-ink-muted">
            New bookings and review requests will show up here.
          </p>
        ) : (
          <ul className="max-h-[min(28rem,calc(100dvh-6rem))] overflow-y-auto">
            {items.map((item) => {
              const Icon = ICONS[item.kind] ?? Bell;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => open(item)}
                    className="flex w-full items-start gap-2.5 rounded-[8px] px-2 py-2 text-left hover:bg-ink/[0.06]"
                  >
                    <Icon size={17} aria-hidden="true" className="mt-0.5 shrink-0 text-green-900 dark:text-ink" />
                    <span className="min-w-0 flex-1">
                      <span className={clsx('block leading-snug', item.read_at ? 'text-ink-muted' : 'font-semibold text-ink')}>
                        {item.title}
                      </span>
                      {item.body ? (
                        <span className="mt-0.5 line-clamp-2 block text-[12.5px] leading-snug text-ink-muted">{item.body}</span>
                      ) : null}
                      <span className="mt-0.5 block text-[11.5px] text-ink-muted">{relative(item.created_at)}</span>
                    </span>
                    {item.read_at ? null : (
                      <span aria-label="unread" className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-badge" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
