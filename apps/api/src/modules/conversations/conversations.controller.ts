import { Body, Controller, Get, Header, HttpCode, Module, Param, Post, Put } from '@nestjs/common';

import { CurrentUser, Roles } from '../../common/decorators';
import { AuthPrincipal } from '../../common/types/principal';
import { NotificationsModule } from '../notifications/notifications.module';
import { SiteSettingsModule } from '../site-settings/site-settings.module';
import { ConversationsService, CreateConversationDto, SendMessageDto } from './conversations.service';
import { MessagesGateway } from './messages.gateway';

/**
 * Every route names its roles: Admin, Designers/Installers (their assigned
 * clients, via AccessService) and the client (their own). Never Editors.
 */
const PEOPLE = ['Admin', 'Designer', 'Installer', 'Client'] as const;

@Controller('conversations')
export class ConversationsController {
  constructor(
    private readonly conversations: ConversationsService,
    private readonly gateway: MessagesGateway,
  ) {}

  @Get()
  @Roles(...PEOPLE)
  list(@CurrentUser() principal: AuthPrincipal) {
    return this.conversations.list(principal);
  }

  /** The Messages badge. */
  @Get('unread-count')
  @Roles(...PEOPLE)
  async unreadCount(@CurrentUser() principal: AuthPrincipal) {
    return { unread: await this.conversations.unreadCount(principal) };
  }

  @Get(':id')
  @Roles(...PEOPLE)
  findOne(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string) {
    return this.conversations.findOne(principal, id);
  }

  @Get(':id/messages')
  @Roles(...PEOPLE)
  @Header('Cache-Control', 'no-store')
  messages(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string) {
    return this.conversations.messages(principal, id);
  }

  /** What may be attached here: documents shared with this client. */
  @Get(':id/documents')
  @Roles(...PEOPLE)
  attachable(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string) {
    return this.conversations.attachable(principal, id);
  }

  /** The client's conversation, started if there is none. A client opens their own. */
  @Post()
  @Roles(...PEOPLE)
  async open(@CurrentUser() principal: AuthPrincipal, @Body() dto: CreateConversationDto) {
    const { view, created } = await this.conversations.open(principal, dto);
    if (created) await this.gateway.adopt(view);
    return view;
  }

  /** Sending without a socket (or when it is down): same checks, same live delivery. */
  @Post(':id/messages')
  @Roles(...PEOPLE)
  @HttpCode(201)
  async send(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string, @Body() dto: SendMessageDto) {
    const { conversation, message } = await this.conversations.sendMessage(principal, id, dto);
    await this.gateway.publish(principal, conversation, message);
    return message;
  }

  @Put(':id/read')
  @Roles(...PEOPLE)
  @HttpCode(200)
  async markRead(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string) {
    const { conversation, marked, read_at } = await this.conversations.markRead(principal, id);
    if (marked > 0) await this.gateway.read(conversation, principal, read_at);
    return { marked };
  }
}

@Module({
  imports: [NotificationsModule, SiteSettingsModule],
  controllers: [ConversationsController],
  providers: [ConversationsService, MessagesGateway],
})
export class ConversationsModule {}
