import { useEffect, useState } from 'react';

import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';

/**
 * Unread message count for the navigation badge.
 *
 * Seeded from the API, then kept live by the shared socket so a reply from the
 * Enzo team bumps the badge while the client is on another screen. Refreshes on
 * window focus too, covering a socket that dropped while the device slept.
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
