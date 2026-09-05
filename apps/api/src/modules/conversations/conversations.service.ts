import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

import { AccessService } from '../../common/access/access.service';
import { Conversation, Message, MessageAttachment } from '../../common/types/domain';
import { AuthPrincipal } from '../../common/types/principal';
import { ActivityLogService } from '../../core/activity-log.service';
import { DatabaseService } from '../../data/database.service';

/* -------------------------------------------------------------------------- */
/* DTOs                                                                       */
/* -------------------------------------------------------------------------- */

export class AttachmentDto {
  @IsString() @MinLength(1) @MaxLength(200) name!: string;

  @Type(() => Number)
  @IsInt({ message: 'Attachment size must be a whole number of bytes' })
  @Min(0)
  size_bytes!: number;

  /**
   * Placeholder descriptor. There is no object storage this phase, so the
   * frontend sends a synthetic locator and no bytes are ever transferred.
   */
  @IsString() @MaxLength(500) storage_url!: string;
}

export class SendMessageDto {
  @IsString()
  @MinLength(1, { message: 'Write a message before sending' })
  @MaxLength(5000)
  body!: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  attachments?: AttachmentDto[];
}

export class CreateConversationDto {
  @IsString() client_id!: string;
  @IsOptional() @IsString() @MaxLength(160) subject?: string;
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

@Injectable()
export class ConversationsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly access: AccessService,
    private readonly activity: ActivityLogService,
  ) {}

  /**
   * "Unread" is always relative to the caller: staff count unread messages
   * FROM clients, and a client counts unread messages FROM staff. A sender
   * never has unread messages of their own.
   */
  private isUnreadFor(principal: AuthPrincipal, message: Message): boolean {
    if (message.read_at !== null) return false;
    return principal.kind === 'Client'
      ? message.sender_type === 'Staff'
      : message.sender_type === 'Client';
  }

  async list(principal: AuthPrincipal): Promise<ConversationView[]> {
    const all = await this.db.conversations.findAll();
    const scoped = await this.access.scopeToVisibleClients(principal, all, (row) => row.client_id);

    const [messages, clients] = await Promise.all([
      this.db.messages.findAll(),
      this.db.clients.findAll(),
    ]);
    const clientName = new Map(clients.map((client) => [client.id, client.name]));

    return scoped
      .map((conversation) => {
        const thread = messages
          .filter((message) => message.conversation_id === conversation.id)
          .sort((a, b) => a.created_at.localeCompare(b.created_at));
        return {
          ...conversation,
          client_name: clientName.get(conversation.client_id) ?? 'Unknown client',
          last_message: thread.length > 0 ? thread[thread.length - 1]! : null,
          unread_count: thread.filter((message) => this.isUnreadFor(principal, message)).length,
          message_count: thread.length,
        };
      })
      .sort((a, b) => {
        // Most recently active thread first — an empty thread falls back to
        // when it was created so a brand new conversation still surfaces.
        const aAt = a.last_message?.created_at ?? a.created_at;
        const bAt = b.last_message?.created_at ?? b.created_at;
        return bAt.localeCompare(aAt);
      });
  }

  async findOne(principal: AuthPrincipal, id: string): Promise<ConversationView> {
    const conversation = await this.requireConversation(principal, id);
    const all = await this.list(principal);
    const found = all.find((row) => row.id === conversation.id);
    if (!found) throw new NotFoundException('Conversation not found');
    return found;
  }

  /** The thread itself, oldest first, as a chat view expects. */
  async messages(principal: AuthPrincipal, id: string): Promise<Message[]> {
    await this.requireConversation(principal, id);
    const thread = await this.db.messages.findAll((message) => message.conversation_id === id);
    return thread.sort((a, b) => a.created_at.localeCompare(b.created_at));
  }

  async create(principal: AuthPrincipal, dto: CreateConversationDto): Promise<ConversationView> {
    await this.access.assertClientAccess(principal, dto.client_id);
    const client = await this.db.clients.findById(dto.client_id);
    if (!client) throw new BadRequestException('Client does not exist');

    const created = await this.db.conversations.create({
      client_id: dto.client_id,
      subject: dto.subject?.trim() || `Conversation with ${client.name}`,
      created_at: new Date().toISOString(),
    });

    await this.activity.record({
      principal,
      action: 'conversation_create',
      targetTable: 'conversations',
      targetId: created.id,
      details: { client: client.name, subject: created.subject },
    });
    return this.findOne(principal, created.id);
  }

  /**
   * Append a message. Shared by the HTTP endpoint and the WebSocket gateway so
   * both paths write identically — the gateway is a transport, not a second
   * implementation.
   */
  async sendMessage(
    principal: AuthPrincipal,
    conversationId: string,
    dto: SendMessageDto,
  ): Promise<Message> {
    await this.requireConversation(principal, conversationId);

    const attachments: MessageAttachment[] | null =
      dto.attachments && dto.attachments.length > 0
        ? dto.attachments.map((attachment) => ({
            name: attachment.name,
            size_bytes: attachment.size_bytes,
            storage_url: attachment.storage_url,
          }))
        : null;

    return this.db.messages.create({
      conversation_id: conversationId,
      sender_id: principal.id,
      // Taken from the verified token, never from the request body — a client
      // cannot post a message that claims to be from staff.
      sender_type: principal.kind === 'Client' ? 'Client' : 'Staff',
      body: dto.body.trim(),
      attachments,
      read_at: null,
      created_at: new Date().toISOString(),
    });
  }

  /** Mark everything addressed to the caller in this thread as read. */
  async markRead(principal: AuthPrincipal, conversationId: string): Promise<{ marked: number }> {
    await this.requireConversation(principal, conversationId);
    const thread = await this.db.messages.findAll(
      (message) => message.conversation_id === conversationId,
    );

    const now = new Date().toISOString();
    let marked = 0;
    for (const message of thread) {
      if (this.isUnreadFor(principal, message)) {
        await this.db.messages.update(message.id, { read_at: now });
        marked += 1;
      }
    }
    return { marked };
  }

  /** Total unread across every thread the caller can see. Drives the nav badge. */
  async unreadCount(principal: AuthPrincipal): Promise<number> {
    const conversations = await this.list(principal);
    return conversations.reduce((total, conversation) => total + conversation.unread_count, 0);
  }

  /**
   * Load a conversation the caller is allowed to see, or throw.
   * Exposed to the gateway so socket traffic gets the same check as HTTP.
   */
  async requireConversation(principal: AuthPrincipal, id: string): Promise<Conversation> {
    const conversation = await this.db.conversations.findById(id);
    if (!conversation) throw new NotFoundException('Conversation not found');
    await this.access.assertClientAccess(principal, conversation.client_id);
    return conversation;
  }
}
