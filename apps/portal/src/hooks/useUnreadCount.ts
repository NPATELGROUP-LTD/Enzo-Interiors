import { useEffect, useState } from 'react';

import { api } from '@/lib/api';
import { connectSocket } from '@/lib/socket';

/**
 * Unread messages from the Enzo team, for the navigation badge. Seeded from
 * the API, refreshed when a message arrives or a thread is read, and when the
 * window regains focus (a socket that dropped while the device slept).
 */
export function useUnreadCount(): number {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      api
        .get<{ unread: number }>('/conversations/unread-count')
        .then((result) => {
          if (!cancelled) setUnread(result.unread);
        })
        .catch(() => {
          /* The badge is a nicety; never surface a failure here as an error. */
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
  }, []);

  return unread;
}
