import { useEffect, useState } from 'react';

import { api } from '@/lib/api';
import { connectSocket } from '@/lib/socket';

/**
 * Unread client messages, for the menu-bar badge. Seeded from the API, then
 * refreshed when a message arrives or a thread is read (on any screen), and
 * when the window regains focus (a socket that dropped while asleep).
 * `enabled` is false for Editors, who have no Messages.
 */
export function useUnreadCount(enabled: boolean): number {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const refresh = () => {
      api
        .get<{ unread: number }>('/conversations/unread-count')
        .then((result) => {
          if (!cancelled) setUnread(result.unread);
        })
        .catch(() => {
          /* The badge is a nicety; a failure here must not surface as an error. */
        });
    };
    refresh();

    const socket = connectSocket();
    socket?.on('message:new', refresh);
    socket?.on('conversation:read', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      cancelled = true;
      socket?.off('message:new', refresh);
      socket?.off('conversation:read', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [enabled]);

  return unread;
}
