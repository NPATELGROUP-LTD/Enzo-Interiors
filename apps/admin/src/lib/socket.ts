import { io, type Socket } from 'socket.io-client';

import { api, tokenStore } from './api';

/**
 * One Socket.IO connection per session, shared by the Messages screen and the
 * menu-bar badge. A module-level singleton because the socket outlives any one
 * screen. connectSocket() is idempotent, so whichever mounts first opens it;
 * Socket.IO reconnects by itself after a drop. The API checks the token on
 * the handshake and again on every event; a refused one ends in
 * connect_error / disconnect, and the next sign-in opens a fresh socket.
 *
 * The token is read from the store on every handshake, not captured once, so a
 * reconnect after the session was renewed carries the new token.
 */
let socket: Socket | null = null;

export function connectSocket(): Socket | null {
  if (socket) return socket;
  if (!tokenStore.get()) return null;
  socket = io(api.baseUrl, {
    auth: (send) => send({ token: tokenStore.get() }),
    // WebSocket only: long-polling would hop between API instances (no sticky sessions). Pages still refetch every 60 s.
    transports: ['websocket'],
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30_000,
  });
  return socket;
}

/**
 * The session was renewed (a new token after sign-in or a password change):
 * reconnect the same socket so it handshakes with the new token. The same
 * instance, so the listeners the Messages screen and the badge already added
 * keep working.
 */
export function reauthSocket(): void {
  if (!socket) return;
  if (!tokenStore.get()) return disconnectSocket();
  socket.disconnect().connect();
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}
