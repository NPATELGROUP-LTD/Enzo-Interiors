import { io, type Socket } from 'socket.io-client';

import { api, tokenStore } from './api';

/**
 * One Socket.IO connection per session, shared by the Messages screen and the
 * sidebar unread badge.
 *
 * A module-level singleton rather than a context because the socket outlives
 * any single screen and reconnecting on every navigation would drop messages
 * during the gap. `connect()` is idempotent.
 */
let socket: Socket | null = null;

export function connectSocket(): Socket | null {
  const token = tokenStore.get();
  if (!token) return null;
  if (socket?.connected) return socket;

  socket?.disconnect();
  socket = io(api.baseUrl, {
    // The gateway reads this in handleConnection and verifies it exactly as
    // the HTTP guard does; an unauthenticated socket is disconnected.
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
  });
  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}
