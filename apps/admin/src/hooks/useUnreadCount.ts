import { useEffect, useState } from 'react';

import { api } from '@/lib/api';
import { connectSocket } from '@/lib/socket';

/**
 * Unread client messages, for the menu-bar badge. Seeded from the API, then
 * refreshed when a message arrives or a thread is read (on any screen), and
 * when the window regains focus (a socket that dropped while asleep).
 * `enabled` is false for Editors, who have no Messages. The Team badge is the same hook on its own
 * route and events.
 */
export function useUnreadCount(
  enabled: boolean,
  path = '/conversations/unread-count',
  events: string[] = ['message:new', 'conversation:read'],
): number {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const refresh = () => {
      api
        .get<{ unread: number }>(path)
        .then((result) => {
          if (!cancelled) setUnread(result.unread);
        })
        .catch(() => {
          /* The badge is a nicety; a failure here must not surface as an error. */
        });
    };
    refresh();

    const socket = connectSocket();
    for (const event of events) socket?.on(event, refresh);
    window.addEventListener('focus', refresh);
    return () => {
      cancelled = true;
      for (const event of events) socket?.off(event, refresh);
      window.removeEventListener('focus', refresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- path and events are constants per call site
  }, [enabled]);

  return unread;
}
