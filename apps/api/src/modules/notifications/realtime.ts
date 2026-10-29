import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';

/**
 * A handle on the Socket.IO server for anything that is not chat: the gateway
 * hands it the server once it is up, and each connected person's sockets sit
 * in the room `user:<id>` (joined by the gateway, from their verified session).
 * Before the gateway is up (tests, boot) it quietly does nothing.
 *
 * ponytail: a socket whose session ended is not re-checked per emit, as chat
 * messages are; it only ever receives the owner's own notification title.
 */
@Injectable()
export class RealtimeService {
  server: Server | null = null;

  /** Everyone connected, no payload: a nudge to refetch, carrying nothing to leak. */
  broadcast(event: string): void {
    this.server?.emit(event);
  }

  toUser(userId: string, event: string, payload: unknown): void {
    this.server?.to(`user:${userId}`).emit(event, payload);
  }
}

export const userRoom = (userId: string): string => `user:${userId}`;
