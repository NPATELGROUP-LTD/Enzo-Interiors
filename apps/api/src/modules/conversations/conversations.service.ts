import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ArrayMaxSize, IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

import { AccessService } from '../../common/access/access.service';
import { Conversation, DocumentRecord, Message, MessageAttachment } from '../../common/types/domain';
import { AuthPrincipal } from '../../common/types/principal';
import { ActivityLogService } from '../../core/activity-log.service';
import { CacheService } from '../../core/cache';
import { MailService, templates } from '../../core/mail.service';
import { DatabaseService } from '../../data/database.service';
import { Where } from '../../data/prisma-repository';
import { looksHashed } from '../auth/auth.service';
import { NotificationsService } from '../notifications/notifications.module';
import { PushService } from '../notifications/push';
import { SiteSettingsService } from '../site-settings/site-settings.module';

/* -------------------------------------------------------------------------- */
/* DTOs (HTTP and socket share them)                                          */
/* -------------------------------------------------------------------------- */

export const MAX_BODY = 5000;

export class SendMessageDto {
  /** May be empty when the message carries attachments. */
  @IsOptional() @IsString() @MaxLength(MAX_BODY) body?: string;

  /** Documents from the Documents module, shared with this conversation's client. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  document_ids?: string[];
}

export class CreateConversationDto {
  /** Staff: whose conversation. Ignored for a client, who only ever has their own. */
  @IsOptional() @IsString() @MaxLength(64) client_id?: string;
}

/* -------------------------------------------------------------------------- */
/* View models                                                                */
/* -------------------------------------------------------------------------- */

export interface ConversationView extends Conversation {
  client_name: string;
  last_message: Message | null;
  /** Messages addressed to the CALLER that they have not read. */
  unread_count: number;
  message_count: number;
}

/** What the attach picker offers: a document, never where it is stored. */
export type AttachableDocument = Pick<DocumentRecord, 'id' | 'name' | 'type' | 'size_bytes' | 'upload_date'>;

/** The longest thread a screen loads at once; older messages stay in the database. */
const THREAD_LIMIT = 500;
/** At most one "you have a message" email per conversation and side in this window. */
const EMAIL_QUIET_MS = 15 * 60 * 1000;

/**
 * Client messaging. One conversation per client (the schema keys it on
 * client_id); staff and the client write into it.
 *
 * Who sees what is AccessService: Admin every client, a Designer/Installer the
 * clients of their assigned projects, a client their own. Editors never reach
 * this (no @Roles names them). Out of scope is a 404 for a client and a 403
 * for staff, as everywhere else.
 */
@Injectable()
export class ConversationsService {
  private readonly portalUrl = (process.env.PORTAL_URL ?? 'http://localhost:5175').replace(/\/+$/, '');
  private readonly adminUrl = (process.env.ADMIN_URL ?? 'http://localhost:5174').replace(/\/+$/, '');

  constructor(
    private readonly db: DatabaseService,
    private readonly access: AccessService,
    private readonly activity: ActivityLogService,
    private readonly cache: CacheService,
    private readonly mail: MailService,
    private readonly notifications: NotificationsService,
    private readonly settings: SiteSettingsService,
    private readonly push: PushService,
  ) {}

  /** Staff read messages from the client, a client reads messages from staff. */
  private unreadFor(principal: AuthPrincipal): Where<Message> {
    return { read_at: null, sender_type: principal.kind === 'Client' ? 'Staff' : 'Client' };
  }

  /** The conversations this principal may see, as a WHERE clause. */
  private async scope(principal: AuthPrincipal): Promise<Where<Conversation>> {
    const visible = await this.access.visibleClientIds(principal);
    return visible === 'all' ? {} : { client_id: { in: [...visible] } };
  }

  async list(principal: AuthPrincipal): Promise<ConversationView[]> {
    const conversations = await this.db.conversations.findWhere(await this.scope(principal));
    if (conversations.length === 0) return [];
    const ids = conversations.map((row) => row.id);
    // ponytail: every message of the visible threads in one read, grouped here.
    // Fine at studio volumes; a DISTINCT ON / groupBy query when it is not.
    const [messages, clients] = await Promise.all([
      this.db.messages.findWhere({ conversation_id: { in: ids } }, { orderBy: { created_at: 'asc' } }),
      this.db.clients.findWhere({ id: { in: [...new Set(conversations.map((row) => row.client_id))] } }),
    ]);
    const clientName = new Map(clients.map((client) => [client.id, client.name]));
    const unreadType = principal.kind === 'Client' ? 'Staff' : 'Client';

    return conversations
      .map((conversation) => {
        const thread = messages.filter((message) => message.conversation_id === conversation.id);
        return {
          ...conversation,
          client_name: clientName.get(conversation.client_id) ?? 'Unknown client',
          last_message: thread.at(-1) ?? null,
          unread_count: thread.filter((m) => m.read_at === null && m.sender_type === unreadType).length,
          message_count: thread.length,
        };
      })
      .sort((a, b) =>
        (b.last_message?.created_at ?? b.created_at).localeCompare(a.last_message?.created_at ?? a.created_at),
      );
  }

  async findOne(principal: AuthPrincipal, id: string): Promise<ConversationView> {
    await this.requireConversation(principal, id);
    const found = (await this.list(principal)).find((row) => row.id === id);
    if (!found) throw new NotFoundException('Conversation not found');
    return found;
  }

  /** The latest messages, oldest first, as a chat view expects. */
  async messages(principal: AuthPrincipal, id: string): Promise<Message[]> {
    await this.requireConversation(principal, id);
    const latest = await this.db.messages.findWhere(
      { conversation_id: id },
      { orderBy: { created_at: 'desc' }, take: THREAD_LIMIT },
    );
    return latest.reverse();
  }

  /**
   * The client's conversation, started if there is none yet. A client starts
   * their own; staff start one for a client in their scope. One per client is
   * the unique index on client_id: the loser of two simultaneous first
   * messages gets P2002 and re-reads the winner's row.
   */
  async open(principal: AuthPrincipal, dto: CreateConversationDto): Promise<{ view: ConversationView; created: boolean }> {
    const clientId = this.access.isClient(principal) ? principal.id : dto.client_id;
    if (!clientId) throw new BadRequestException('Choose a client');
    await this.access.assertClientAccess(principal, clientId);
    const client = await this.db.clients.findById(clientId);
    if (!client) throw new NotFoundException('Client not found');

    const existing = await this.db.conversations.findFirstWhere({ client_id: clientId }, { created_at: 'asc' });
    if (existing) return { view: await this.findOne(principal, existing.id), created: false };

    let created: Conversation;
    try {
      created = await this.db.conversations.create({
        client_id: clientId,
        subject: `Messages with ${client.name}`,
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error;
      const winner = await this.db.conversations.findFirstWhere({ client_id: clientId });
      if (!winner) throw error;
      return { view: await this.findOne(principal, winner.id), created: false };
    }
    await this.activity.record({
      principal,
      action: 'conversation_create',
      targetTable: 'conversations',
      targetId: created.id,
      details: { client: client.name },
    });
    return { view: await this.findOne(principal, created.id), created: true };
  }

  /**
   * The documents that may be attached in this conversation: the client's
   * own, shared with them on a shared project (so the client can open every
   * attachment), and within the sender's own document scope.
   */
  private async attachableWhere(principal: AuthPrincipal, conversation: Conversation): Promise<Where<DocumentRecord>> {
    const shared = await this.access.sharedWithClient(conversation.client_id);
    const scope = await this.access.documentScope(principal);
    // Admin's scope is {}; Prisma reads OR: [{}] as "nothing", so only nest a real one.
    return Object.keys(scope).length === 0 ? shared : { ...shared, OR: [scope] };
  }

  async attachable(principal: AuthPrincipal, id: string): Promise<AttachableDocument[]> {
    const conversation = await this.requireConversation(principal, id);
    const rows = await this.db.documents.findWhere(await this.attachableWhere(principal, conversation), {
      orderBy: { upload_date: 'desc' },
    });
    return rows.map(({ id: docId, name, type, size_bytes, upload_date }) => ({ id: docId, name, type, size_bytes, upload_date }));
  }

  /**
   * Append a message. Shared by the HTTP endpoint and the socket gateway, so
   * both paths validate, scope and write identically.
   */
  async sendMessage(
    principal: AuthPrincipal,
    conversationId: string,
    dto: SendMessageDto,
  ): Promise<{ conversation: Conversation; message: Message }> {
    const conversation = await this.requireConversation(principal, conversationId);
    const body = (dto.body ?? '').trim();
    const ids = [...new Set(dto.document_ids ?? [])];
    if (!body && ids.length === 0) throw new BadRequestException('Write a message before sending');

    let attachments: MessageAttachment[] | null = null;
    if (ids.length > 0) {
      const docs = await this.db.documents.findWhere({
        ...(await this.attachableWhere(principal, conversation)),
        id: { in: ids },
      });
      if (docs.length !== ids.length) {
        throw new BadRequestException('Attach only files that are shared with this client.');
      }
      attachments = ids.map((docId) => {
        const doc = docs.find((row) => row.id === docId)!;
        return { document_id: doc.id, name: doc.name, size_bytes: doc.size_bytes };
      });
    }

    const message = await this.db.messages.create({
      conversation_id: conversation.id,
      sender_id: principal.id,
      // From the verified principal, never the request: a client cannot post as staff.
      sender_type: principal.kind === 'Client' ? 'Client' : 'Staff',
      body,
      attachments,
      read_at: null,
      created_at: new Date().toISOString(),
    });
    return { conversation, message };
  }

  /** Mark everything addressed to the caller in this thread as read: one UPDATE. */
  async markRead(
    principal: AuthPrincipal,
    conversationId: string,
  ): Promise<{ conversation: Conversation; marked: number; read_at: string }> {
    const conversation = await this.requireConversation(principal, conversationId);
    const read_at = new Date().toISOString();
    const marked = await this.db.messages.updateWhere(
      { conversation_id: conversationId, ...this.unreadFor(principal) },
      { read_at },
    );
    return { conversation, marked, read_at };
  }

  /** Total unread across every thread the caller can see, counted in SQL. Drives the badges. */
  async unreadCount(principal: AuthPrincipal): Promise<number> {
    const ids = (await this.db.conversations.findWhere(await this.scope(principal))).map((row) => row.id);
    if (ids.length === 0) return 0;
    return this.db.messages.countWhere({ conversation_id: { in: ids }, ...this.unreadFor(principal) });
  }

  /**
   * Every new message is pushed to the other side's devices, whether or not
   * they have the app open somewhere: an open tab on a desk says nothing about
   * the phone in their pocket. One notification per chat (same tag), no
   * message text on the lock screen. The page's own service worker stays quiet
   * while that chat is on screen (push-sw.js).
   */
  async pushMessage(sender: AuthPrincipal, conversation: Conversation): Promise<void> {
    const client = await this.db.clients.findById(conversation.client_id);
    if (!client) return;
    const tag = `message:${conversation.id}`;
    if (sender.kind !== 'Client') {
      if (!this.canUsePortal(client) || !(await this.notifications.allows(client.id, 'message', 'push'))) return;
      this.push.send('client', client.id, { title: 'New message from Enzo Interiors', link: '/messages', tag });
      return;
    }
    const note = { title: `New message from ${client.name}`, link: `/messages?client=${client.id}`, tag };
    for (const staffId of await this.staffFor(client.id)) this.push.send('staff', staffId, note);
  }

  /**
   * Nobody on the receiving side had the app open: tell them by email and the
   * bell, at most once per conversation and side every 15 minutes. Neither
   * carries the message text. Devices were already pushed by pushMessage.
   */
  async notifyOffline(sender: AuthPrincipal, conversation: Conversation): Promise<void> {
    const toClient = sender.kind !== 'Client';
    const key = `message-email:${conversation.id}:${toClient ? 'client' : 'staff'}`;
    if (await this.cache.get<number>(key)) return;
    await this.cache.set(key, Date.now(), EMAIL_QUIET_MS);

    const client = await this.db.clients.findById(conversation.client_id);
    if (!client) return;
    if (toClient) {
      // Only someone who can sign in to the portal is sent there.
      if (!this.canUsePortal(client)) return;
      // Pushed already (pushMessage); the email is the chat's own, so no generic notice.
      await this.notifications.notifyClient(client.id, { kind: 'message', title: 'New message from Enzo Interiors', link: '/messages' }, false, false);
      if (await this.notifications.allows(client.id, 'message', 'email')) {
        await this.mail.send({
          to: client.email,
          ...templates.newMessage('Enzo Interiors', 'your client portal', `${this.portalUrl}/messages`),
        });
      }
      return;
    }

    const note = { kind: 'message' as const, title: `New message from ${client.name}`, link: `/messages?client=${client.id}` };
    for (const staffId of await this.staffFor(client.id)) await this.notifications.notify(staffId, note, false);
    const to = await this.settings.notificationRecipients();
    if (to.length > 0) {
      await this.mail.send({ to, ...templates.newMessage(client.name, 'the Enzo Interiors admin', `${this.adminUrl}/messages`) });
    }
  }

  private canUsePortal(client: { status: string; password_hash: string }): boolean {
    return client.status === 'Active' && looksHashed(client.password_hash);
  }

  /** The staff who hear about a client's messages: every Admin, plus whoever designs or installs for them. */
  private async staffFor(clientId: string): Promise<string[]> {
    const projects = await this.db.projects.findWhere({ client_id: clientId });
    const assigned = await this.access.staffOn(projects);
    const staff = await this.db.staffUsers.findAll((row) => row.role === 'Admin' || assigned.has(row.id));
    return staff.map((row) => row.id);
  }

  /** Load a conversation the caller may see, or throw. The gateway uses it too. */
  async requireConversation(principal: AuthPrincipal, id: string): Promise<Conversation> {
    const conversation = await this.db.conversations.findById(id);
    if (!conversation) throw new NotFoundException('Conversation not found');
    await this.access.assertClientAccess(principal, conversation.client_id);
    return conversation;
  }
}
