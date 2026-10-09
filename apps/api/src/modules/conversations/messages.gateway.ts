import { Logger, UsePipes, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { IsString, MaxLength } from 'class-validator';
import { Server, Socket } from 'socket.io';

import { AccessService } from '../../common/access/access.service';
import { authenticate } from '../../common/guards/jwt-auth.guard';
import { Conversation, Message } from '../../common/types/domain';
import { AuthPrincipal } from '../../common/types/principal';
import { DatabaseService } from '../../data/database.service';
import { ConversationsService, SendMessageDto } from './conversations.service';

/** The room for a conversation. One room per thread. */
const room = (conversationId: string): string => `conversation:${conversationId}`;

/** Message sends per socket per minute: a chat, not a firehose. */
const SENDS_PER_MINUTE = 30;

interface SocketData {
  token: string;
  principal: AuthPrincipal;
  sent: number[];
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped events, typed data
type AuthedSocket = Socket<any, any, any, SocketData>;

export class ConversationRefDto {
  @IsString() @MaxLength(64) conversationId!: string;
}

export class SocketSendDto extends SendMessageDto {
  @IsString() @MaxLength(64) conversationId!: string;
}

/**
 * Allowed browser origins, set from ConfigService when the gateway is built
 * (the decorator below is evaluated at import, before config exists).
 */
let allowedOrigins: string[] = [];

/**
 * Live Messages for the admin inbox and the client portal.
 *
 * Every connection and every event is authenticated with the same
 * authenticate() the HTTP guard uses (one primary-key lookup), so a socket dies
 * with its session: sign-out elsewhere, a password change, a role change or a
 * deactivated client. Rooms are joined only through AccessService. A message
 * is pushed to each socket in the room after re-checking that socket's session
 * and access, so a socket that has gone quiet cannot keep listening either.
 *
 * ponytail: one API instance, so rooms live in this process. Several replicas
 * need @socket.io/redis-adapter and sticky sessions. Socket.IO's default path
 * (/socket.io) on the API host; Traefik and Cloudflare Tunnel pass the
 * WebSocket upgrade through as they are, and polling works as a fallback.
 */
@WebSocketGateway({
  cors: {
    // Called per handshake. No Origin = not a browser, so CORS has nothing to say.
    origin: (origin: string | undefined, done: (error: Error | null, allow?: boolean) => void) =>
      done(null, !origin || allowedOrigins.includes(origin)),
    credentials: true,
  },
})
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
export class MessagesGateway implements OnGatewayInit, OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(MessagesGateway.name);

  constructor(
    private readonly conversations: ConversationsService,
    private readonly access: AccessService,
    private readonly jwt: JwtService,
    private readonly db: DatabaseService,
    config: ConfigService,
  ) {
    allowedOrigins = (config.get<string>('CORS_ORIGINS') ?? 'http://localhost:5174,http://localhost:5175')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
  }

  /** The handshake: no valid session token, no connection (the client sees connect_error). */
  afterInit(server: Server): void {
    server.use((socket, next) => {
      const token = socket.handshake.auth?.token;
      if (typeof token !== 'string' || !token) return next(new Error('Unauthorized'));
      authenticate(this.jwt, this.db, token).then(
        (principal) => {
          Object.assign(socket.data, { token, principal, sent: [] } satisfies SocketData);
          next();
        },
        () => next(new Error('Unauthorized')),
      );
    });
  }

  /** Join every thread this principal may see, so new messages arrive without asking. */
  async handleConnection(socket: AuthedSocket): Promise<void> {
    const visible = await this.conversations.list(socket.data.principal);
    await socket.join(visible.map((conversation) => room(conversation.id)));
    socket.emit('connected', { conversations: visible.map((conversation) => conversation.id) });
  }

  @SubscribeMessage('conversation:join')
  async join(@ConnectedSocket() socket: AuthedSocket, @MessageBody() { conversationId }: ConversationRefDto) {
    const principal = await this.reauthenticate(socket);
    if (!principal) return { ok: false };
    try {
      await this.conversations.requireConversation(principal, conversationId);
    } catch {
      // "Does not exist" and "not yours" look the same over the socket.
      return { ok: false, error: 'Conversation not available' };
    }
    await socket.join(room(conversationId));
    return { ok: true };
  }

  @SubscribeMessage('conversation:leave')
  async leave(@ConnectedSocket() socket: AuthedSocket, @MessageBody() { conversationId }: ConversationRefDto) {
    if (!(await this.reauthenticate(socket))) return { ok: false };
    await socket.leave(room(conversationId));
    return { ok: true };
  }

  /** Same service method as POST /conversations/:id/messages, then the same delivery. */
  @SubscribeMessage('message:send')
  async send(@ConnectedSocket() socket: AuthedSocket, @MessageBody() dto: SocketSendDto) {
    const principal = await this.reauthenticate(socket);
    if (!principal) return { ok: false };

    const now = Date.now();
    socket.data.sent = socket.data.sent.filter((at) => now - at < 60_000);
    if (socket.data.sent.length >= SENDS_PER_MINUTE) return { ok: false, error: 'Slow down a little.' };
    socket.data.sent.push(now);

    try {
      const { conversation, message } = await this.conversations.sendMessage(principal, dto.conversationId, {
        body: dto.body,
        document_ids: dto.document_ids,
      });
      await this.publish(principal, conversation, message);
      return { ok: true, message };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Could not send message' };
    }
  }

  /** Only into a room this socket was let into; nothing comes back. */
  @SubscribeMessage('conversation:typing')
  async typing(@ConnectedSocket() socket: AuthedSocket, @MessageBody() { conversationId }: ConversationRefDto) {
    if (!socket.rooms.has(room(conversationId))) return;
    const principal = await this.reauthenticate(socket);
    if (!principal) return;
    socket.to(room(conversationId)).emit('conversation:typing', {
      conversationId,
      name: principal.kind === 'Client' ? principal.name : 'Enzo Interiors',
      kind: principal.kind,
    });
  }

  /**
   * Deliver a new message to the room, push it to the other side's devices,
   * then email (and ring the bell of) the other side if nobody there was
   * connected. Used by the socket send and the HTTP send alike.
   */
  async publish(sender: AuthPrincipal, conversation: Conversation, message: Message): Promise<void> {
    const reached = await this.deliver(conversation, 'message:new', message);
    void this.conversations.pushMessage(sender, conversation).catch((error: unknown) => {
      this.logger.error(`Message push failed: ${error instanceof Error ? error.message : String(error)}`);
    });
    const recipientOnline = reached.some((p) => (sender.kind === 'Client' ? p.kind === 'Staff' : p.kind === 'Client'));
    if (!recipientOnline) {
      await this.conversations.notifyOffline(sender, conversation).catch((error: unknown) => {
        this.logger.error(`Offline notice failed: ${error instanceof Error ? error.message : String(error)}`);
      });
    }
  }

  /** Read receipts: the other side's ticks update live. */
  async read(conversation: Conversation, reader: AuthPrincipal, readAt: string): Promise<void> {
    await this.deliver(conversation, 'conversation:read', {
      conversationId: conversation.id,
      reader: reader.kind,
      read_at: readAt,
    });
  }

  /** A new conversation: every connected socket that may see it joins its room. */
  async adopt(conversation: Conversation): Promise<void> {
    for (const socket of await this.server.fetchSockets()) {
      const principal = await this.check(socket.data as SocketData, conversation.client_id);
      if (principal) socket.join(room(conversation.id));
    }
  }

  /**
   * Emit to each socket in the room whose session and access still hold;
   * the rest are disconnected or dropped from the room. Returns who got it.
   * One lookup per socket per message: fine for a studio's handful of sockets.
   */
  private async deliver(conversation: Conversation, event: string, payload: unknown): Promise<AuthPrincipal[]> {
    const reached: AuthPrincipal[] = [];
    for (const socket of await this.server.in(room(conversation.id)).fetchSockets()) {
      const data = socket.data as SocketData;
      const principal = await this.check(data, conversation.client_id);
      if (principal === 'signed-out') socket.disconnect(true);
      else if (!principal) socket.leave(room(conversation.id));
      else {
        socket.emit(event, payload);
        reached.push(principal);
      }
    }
    return reached;
  }

  private async check(data: SocketData, clientId: string): Promise<AuthPrincipal | 'signed-out' | null> {
    try {
      const principal = await authenticate(this.jwt, this.db, data.token);
      data.principal = principal;
      return (await this.access.canAccessClient(principal, clientId)) ? principal : null;
    } catch {
      return 'signed-out';
    }
  }

  /** The session behind this socket, fresh from the database, or a disconnect. */
  private async reauthenticate(socket: AuthedSocket): Promise<AuthPrincipal | null> {
    try {
      socket.data.principal = await authenticate(this.jwt, this.db, socket.data.token);
      return socket.data.principal;
    } catch {
      socket.emit('error:auth', { message: 'Your session has ended. Sign in again.' });
      socket.disconnect(true);
      return null;
    }
  }
}
