import { io, type Socket } from 'socket.io-client';

import { api, tokenStore } from './api';

/**
 * One Socket.IO connection per session, shared by the Messages screen and the
 * menu-bar badge. A module-level singleton because the socket outlives any one
 * screen. connectSocket() is idempotent, so whichever mounts first opens it;
 * Socket.IO reconnects by itself after a drop. The API checks the token on
 * the handshake and again on every event; a refused one ends in
 * connect_error / disconnect, and the next sign-in opens a fresh socket.
 */
let socket: Socket | null = null;

export function connectSocket(): Socket | null {
  if (socket) return socket;
  const token = tokenStore.get();
  if (!token) return null;
  socket = io(api.baseUrl, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30_000,
  });
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}
