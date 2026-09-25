import { useEffect, useState } from 'react';

import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';

/**
 * Unread message count for the sidebar badge.
 *
 * Seeded from the API, then kept live by the same socket the Messages screen
 * uses — a reply arriving while the admin is on another screen bumps the badge
 * without polling. Also refreshes when the tab regains focus, which covers the
 * case where the socket dropped while the laptop was asleep.
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
          /* The badge is a nicety; a failure here must not surface as an error. */
        });
    };

    refresh();

    const socket = getSocket();
    socket?.on('message:new', refresh);
    window.addEventListener('focus', refresh);

    return () => {
      cancelled = true;
      socket?.off('message:new', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, []);

  return unread;
}
