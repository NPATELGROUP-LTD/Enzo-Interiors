import { Body, Controller, Get, HttpCode, Module, Param, Post, Put } from '@nestjs/common';

import { CurrentUser, Roles } from '../../common/decorators';
import { AuthPrincipal } from '../../common/types/principal';
import {
  ConversationsService,
  CreateConversationDto,
  SendMessageDto,
} from './conversations.service';
import { MessagesGateway } from './messages.gateway';

@Controller('conversations')
export class ConversationsController {
  constructor(
    private readonly conversations: ConversationsService,
    private readonly gateway: MessagesGateway,
  ) {}

  /** Admin all-client inbox; for a client, their own threads. */
  @Get()
  list(@CurrentUser() principal: AuthPrincipal) {
    return this.conversations.list(principal);
  }

  /** Unread badge for the nav shell. */
  @Get('unread-count')
  async unreadCount(@CurrentUser() principal: AuthPrincipal) {
    return { unread: await this.conversations.unreadCount(principal) };
  }

  @Get(':id')
  findOne(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string) {
    return this.conversations.findOne(principal, id);
  }

  @Get(':id/messages')
  messages(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string) {
    return this.conversations.messages(principal, id);
  }

  @Post()
  @Roles('Admin', 'Designer', 'Installer')
  create(@CurrentUser() principal: AuthPrincipal, @Body() dto: CreateConversationDto) {
    return this.conversations.create(principal, dto);
  }

  /**
   * HTTP fallback for sending. The WebSocket path is the primary one, but a
   * send must still work if the socket is down — an offline portal that loses
   * messages would be worse than one that is briefly not live.
   *
   * Broadcasts to the room afterwards so sockets that ARE connected still see
   * it immediately.
   */
  @Post(':id/messages')
  @HttpCode(201)
  async send(
    @CurrentUser() principal: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
  ) {
    const message = await this.conversations.sendMessage(principal, id, dto);
    this.gateway.broadcastMessage(id, message);
    return message;
  }

  @Put(':id/read')
  @HttpCode(200)
  markRead(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string) {
    return this.conversations.markRead(principal, id);
  }
}

@Module({
  controllers: [ConversationsController],
  providers: [ConversationsService, MessagesGateway],
  exports: [ConversationsService],
})
export class ConversationsModule {}
