import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Injectable,
  MiddlewareConsumer,
  Module,
  NestModule,
  Param,
  PipeTransform,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { Type } from 'class-transformer';
import { IsBoolean, IsEmail, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import type { Response } from 'express';

import { CurrentUser, Public, Roles } from '../../common/decorators';
import { AuthPrincipal } from '../../common/types/principal';
import { NotificationsModule } from '../notifications/notifications.module';
import { GMAIL_ID, GmailService, MAIL_ROLES, PART_ID } from './gmail.service';
import { MAX_SEND_BYTES, fileParam } from './mime';

/** A Gmail id from the address, checked before it goes anywhere near a Google URL. */
@Injectable()
class GmailIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!GMAIL_ID.test(value)) throw new BadRequestException('Not a valid id.');
    return value;
  }
}

@Injectable()
class PartIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!PART_ID.test(value)) throw new BadRequestException('Not a valid attachment.');
    return value;
  }
}

export class ListQuery {
  @IsOptional() @IsIn(['inbox', 'sent']) folder?: 'inbox' | 'sent';
  /** A Gmail label id (INBOX, SENT, Label_12…); Gmail refuses one the account does not have. */
  @IsOptional() @Matches(/^[A-Za-z0-9_-]{1,100}$/) label?: string;
  /** Gmail's own search syntax, passed through. It only ever reads. */
  @IsOptional() @IsString() @MaxLength(500) q?: string;
  /** Everything to or from one address. */
  @IsOptional() @IsEmail() @MaxLength(254) with?: string;
  @IsOptional() @Matches(/^[\w=.-]{1,256}$/) page?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit?: number;
}

export class CompleteDto {
  @IsString() @Matches(/^[\w-]{20,80}$/) code!: string;
}

export class ReadDto {
  @IsBoolean() read!: boolean;
}

/** Multipart text fields: recipients are comma separated. */
export class SendDto {
  @IsString() @MaxLength(7000) to!: string;
  @IsOptional() @IsString() @MaxLength(7000) cc?: string;
  @IsOptional() @IsString() @MaxLength(7000) bcc?: string;
  @IsString() @MaxLength(300) subject!: string;
  @IsString() @MaxLength(1_000_000) body!: string;
  /** The Gmail message being answered; the reply's headers and thread come from it. */
  @IsOptional() @Matches(GMAIL_ID) reply_to_id?: string;
  /** The Gmail message being forwarded, and which of its attachments (part ids, comma separated) go with it. */
  @IsOptional() @Matches(GMAIL_ID) forward_id?: string;
  @IsOptional() @IsString() @MaxLength(200) forward_parts?: string;
}

interface Upload {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
}

/** Multer reads a file name as latin1; browsers send UTF-8. */
const utf8Name = (name: string): string => {
  const fixed = Buffer.from(name, 'latin1').toString('utf8');
  return fixed.includes('�') ? name : fixed;
};

/**
 * The Mail page's API. Every route is the signed-in person's own mailbox:
 * the service reads the row for the caller's id and nothing in a request can
 * name another. Designers, Editors and Admins only; Installers and Infra
 * managers get 403 from the guard on every route.
 */
@Controller('mailbox')
@Roles(...MAIL_ROLES)
export class MailboxController {
  constructor(private readonly gmail: GmailService) {}

  @Get('status')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  status(@CurrentUser() principal: AuthPrincipal) {
    return this.gmail.status(principal.id);
  }

  @Get('connect')
  @Throttle({ default: { limit: 10, ttl: 60 * 60_000 } })
  connect(@CurrentUser() principal: AuthPrincipal) {
    return this.gmail.connectUrl(principal);
  }

  /** Google sends the browser here; no token, the signed state says who started it. */
  @Public()
  @Get('callback')
  @Throttle({ default: { limit: 20, ttl: 15 * 60_000 } })
  async callback(@Query('code') code = '', @Query('state') state = '', @Res() res: Response) {
    const handoff = typeof code === 'string' && typeof state === 'string' && code && state ? await this.gmail.callback(code, state) : null;
    res.redirect(`${(process.env.ADMIN_URL ?? 'http://localhost:5174').replace(/\/+$/, '')}/mail?${handoff ? `mail_code=${handoff}` : 'mail=error'}`);
  }

  /** The admin hands back the one-time code from the address; only the person who started the link can finish it. */
  @Post('connect/complete')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 15 * 60_000 } })
  async complete(@CurrentUser() principal: AuthPrincipal, @Body() dto: CompleteDto) {
    await this.gmail.complete(principal, dto.code);
    return this.gmail.status(principal.id);
  }

  @Delete()
  @HttpCode(204)
  @Throttle({ default: { limit: 10, ttl: 60 * 60_000 } })
  async disconnect(@CurrentUser() principal: AuthPrincipal): Promise<void> {
    await this.gmail.disconnect(principal);
  }

  @Get('labels')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  labels(@CurrentUser() principal: AuthPrincipal) {
    return this.gmail.labels(principal.id);
  }

  @Get('threads')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  list(@CurrentUser() principal: AuthPrincipal, @Query() query: ListQuery) {
    return this.gmail.list(principal.id, query);
  }

  @Get('threads/:threadId')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  thread(@CurrentUser() principal: AuthPrincipal, @Param('threadId', GmailIdPipe) threadId: string) {
    return this.gmail.thread(principal.id, threadId);
  }

  @Post('threads/:threadId/read')
  @HttpCode(204)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  async read(@CurrentUser() principal: AuthPrincipal, @Param('threadId', GmailIdPipe) threadId: string, @Body() dto: ReadDto): Promise<void> {
    await this.gmail.setRead(principal.id, threadId, dto.read);
  }

  /** Always sent as a download, never rendered: a file from outside is not trusted with this origin. */
  @Get('messages/:messageId/attachments/:partId')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async attachment(
    @CurrentUser() principal: AuthPrincipal,
    @Param('messageId', GmailIdPipe) messageId: string,
    @Param('partId', PartIdPipe) partId: string,
  ): Promise<StreamableFile> {
    const file = await this.gmail.attachment(principal.id, messageId, partId);
    return new StreamableFile(file.content, {
      type: 'application/octet-stream',
      disposition: `attachment; ${fileParam(file.filename)}`,
      length: file.content.length,
    });
  }

  @Post('send')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  // ponytail: multer holds uploads in memory, so 10 files x 25 MB is the worst case per request (the 25 MB total is
  // checked in sendAs); the 20/min throttle bounds it. Stream to disk if that ever matters.
  @UseInterceptors(FilesInterceptor('files', 10, { limits: { fileSize: MAX_SEND_BYTES, files: 10, fields: 12, fieldSize: 1_100_000 } }))
  send(@CurrentUser() principal: AuthPrincipal, @Body() dto: SendDto, @UploadedFiles() files: Upload[] = []) {
    return this.gmail.send(
      principal.id,
      dto,
      files.map((f) => ({ filename: utf8Name(f.originalname), mime: f.mimetype, content: f.buffer })),
    );
  }
}

@Module({
  imports: [NotificationsModule],
  controllers: [MailboxController],
  providers: [GmailService],
  // Phase 1's enquiry reply sends through GmailService.sendAs.
  exports: [GmailService],
})
export class MailboxModule implements NestModule {
  /** What is in a mailbox is never cached by the browser or anything in between. */
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply((_req: unknown, res: Response, next: () => void) => {
        res.setHeader('Cache-Control', 'no-store');
        next();
      })
      .forRoutes(MailboxController);
  }
}
