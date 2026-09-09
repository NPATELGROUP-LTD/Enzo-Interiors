import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

import { AuthPrincipal, JwtPayload } from '../../common/types/principal';
import { ConversationsService, SendMessageDto } from './conversations.service';

/** The room name for a conversation. One room per thread. */
const room = (conversationId: string): string => `conversation:${conversationId}`;

/** Socket.data shape, so the principal survives across events on a connection. */
interface SocketData {
  principal?: AuthPrincipal;
}

/**
 * The single Socket.IO gateway powering Messages for BOTH the admin inbox and
 * the client portal chat, exactly as the architecture doc describes.
 *
 * Authentication happens once, at connection time, from the same signed token
 * the HTTP API uses — an unauthenticated socket is disconnected rather than
 * left half-connected. Membership of a conversation room is checked against
 * AccessService on join, so a client cannot subscribe to another client's
 * thread by guessing an id.
 *
 * CORS is configured here as well as on the HTTP app: Socket.IO negotiates its
 * own handshake and does not inherit `app.enableCors`.
 */
@WebSocketGateway({
  cors: {
    origin: (process.env.CORS_ORIGINS ?? 'http://localhost:5174,http://localhost:5175')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    credentials: true,
  },
})
export class MessagesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(MessagesGateway.name);

  constructor(
    private readonly conversations: ConversationsService,
    private readonly jwt: JwtService,
  ) {}

  async handleConnection(socket: Socket): Promise<void> {
    // Accept the token from handshake auth (the normal Socket.IO client path)
    // or from the Authorization header, so a non-browser client also works.
    const raw =
      (socket.handshake.auth?.token as string | undefined) ??
      socket.handshake.headers.authorization?.replace(/^Bearer /i, '');

    if (!raw) {
      socket.emit('error:auth', { message: 'Missing session token' });
      socket.disconnect(true);
      return;
    }

    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(raw);
      const principal: AuthPrincipal = {
        id: payload.sub,
        kind: payload.kind,
        role: payload.role,
        name: payload.name,
        email: payload.email,
      };
      (socket.data as SocketData).principal = principal;

      // A client only ever has one counterparty, so auto-joining their own
      // threads means the portal chat is live without an explicit join.
      const visible = await this.conversations.list(principal);
      for (const conversation of visible) {
        await socket.join(room(conversation.id));
      }

      socket.emit('connected', {
        user: principal,
        conversations: visible.map((conversation) => conversation.id),
      });
    } catch {
      socket.emit('error:auth', { message: 'Invalid or expired session token' });
      socket.disconnect(true);
    }
  }

  handleDisconnect(socket: Socket): void {
    const principal = (socket.data as SocketData).principal;
    if (principal) {
      this.logger.debug(`Socket disconnected: ${principal.email}`);
    }
  }

  /** Explicitly subscribe to one thread (the admin inbox switching threads). */
  @SubscribeMessage('conversation:join')
  async join(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: { conversationId?: string },
  ) {
    const principal = this.principalOf(socket);
    if (!principal || !payload?.conversationId) return { ok: false };

    try {
      await this.conversations.requireConversation(principal, payload.conversationId);
      await socket.join(room(payload.conversationId));
      return { ok: true, conversationId: payload.conversationId };
    } catch {
      // Do not distinguish "does not exist" from "not yours" over the socket.
      return { ok: false, error: 'Conversation not available' };
    }
  }

  @SubscribeMessage('conversation:leave')
  async leave(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: { conversationId?: string },
  ) {
    if (!payload?.conversationId) return { ok: false };
    await socket.leave(room(payload.conversationId));
    return { ok: true };
  }

  /**
   * Send a message over the socket.
   *
   * Delegates to the same service method the HTTP endpoint uses, so validation,
   * access control and persistence are identical on both transports, then
   * broadcasts to everyone in the room. That broadcast is what makes an admin
   * reply appear in the client's portal without a refresh.
   */
  @SubscribeMessage('message:send')
  async send(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: { conversationId?: string; body?: string; attachments?: SendMessageDto['attachments'] },
  ) {
    const principal = this.principalOf(socket);
    if (!principal) return { ok: false, error: 'Not authenticated' };
    if (!payload?.conversationId || !payload.body?.trim()) {
      return { ok: false, error: 'A conversation id and a message body are required' };
    }

    try {
      const message = await this.conversations.sendMessage(principal, payload.conversationId, {
        body: payload.body,
        attachments: payload.attachments,
      });
      this.server.to(room(payload.conversationId)).emit('message:new', message);
      return { ok: true, message };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Could not send message',
      };
    }
  }

  @SubscribeMessage('conversation:typing')
  typing(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: { conversationId?: string },
  ) {
    const principal = this.principalOf(socket);
    if (!principal || !payload?.conversationId) return;
    // Broadcast to the room excluding the sender.
    socket.to(room(payload.conversationId)).emit('conversation:typing', {
      conversationId: payload.conversationId,
      name: principal.name,
      kind: principal.kind,
    });
  }

  /**
   * Push a message into a room from outside the socket layer, so a message
   * created over HTTP still reaches live sockets.
   */
  broadcastMessage(conversationId: string, message: unknown): void {
    this.server?.to(room(conversationId)).emit('message:new', message);
  }

  private principalOf(socket: Socket): AuthPrincipal | undefined {
    return (socket.data as SocketData).principal;
  }
}
