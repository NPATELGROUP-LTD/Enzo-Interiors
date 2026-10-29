import { randomUUID } from 'node:crypto';
import path from 'node:path';

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Post,
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { IsOptional, IsString, MaxLength } from 'class-validator';

import { AccessService } from '../../common/access/access.service';
import { CurrentUser, Roles } from '../../common/decorators';
import { Project, StaffAttachment, StaffMessage, StaffThread } from '../../common/types/domain';
import { AuthPrincipal } from '../../common/types/principal';
import { PrivateStorage } from '../../core/storage';
import { DatabaseService } from '../../data/database.service';
import { NotificationsModule, NotificationsService } from '../notifications/notifications.module';
import { RealtimeService } from '../notifications/realtime';

/** Staff chat is for the studio's team: never a client, never Infra (who runs the platform, not the business). */
const TEAM = ['Admin', 'Designer', 'Installer', 'Editor'] as const;
/** A project's thread is for the people on that project and the Admins. */
const PROJECT_TEAM = ['Admin', 'Designer', 'Installer'] as const;

export const MAX_BODY = 5000;
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
export const MAX_FILE_BYTES = 25 * 1024 * 1024;
/** The thread a screen loads at once; older messages stay in the database. */
const THREAD_LIMIT = 200;

const starts = (bytes: Buffer, hex: string, at = 0) => bytes.subarray(at, at + hex.length / 2).toString('hex') === hex;
/** What a thread accepts, each checked against the file's first bytes: the declared type is only the sender's word. */
const KINDS: { type: string; ext: string; video: boolean; matches: (b: Buffer) => boolean }[] = [
  { type: 'video/mp4', ext: '.mp4', video: true, matches: (b) => starts(b, '66747970', 4) && !starts(b, '71742020', 8) },
  { type: 'video/quicktime', ext: '.mov', video: true, matches: (b) => starts(b, '66747970', 4) && starts(b, '71742020', 8) },
  { type: 'video/webm', ext: '.webm', video: true, matches: (b) => starts(b, '1a45dfa3') },
  { type: 'image/jpeg', ext: '.jpg', video: false, matches: (b) => starts(b, 'ffd8ff') },
  { type: 'image/png', ext: '.png', video: false, matches: (b) => starts(b, '89504e470d0a1a0a') },
  { type: 'image/webp', ext: '.webp', video: false, matches: (b) => starts(b, '52494646') && starts(b, '57454250', 8) },
  { type: 'application/pdf', ext: '.pdf', video: false, matches: (b) => starts(b, '255044462d') },
];
const TYPES_MESSAGE = 'Attach an MP4, MOV or WebM video (up to 100 MB), or a JPG, PNG, WebP or PDF (up to 25 MB).';

/** The part of a multer file this module reads (memory storage). */
interface Upload {
  originalname: string;
  size: number;
  buffer: Buffer;
}

export class SendTeamMessageDto {
  /** May be empty when a file is attached. */
  @IsOptional() @IsString() @MaxLength(MAX_BODY) body?: string;
}

export class OpenDirectDto {
  @IsString() @MaxLength(64) staff_id!: string;
}

export interface ThreadView extends StaffThread {
  /** "Project name" for a project thread, the other person's name for a direct one. */
  title: string;
  kind: 'project' | 'direct';
  last_message: Pick<StaffMessage, 'body' | 'created_at' | 'sender_id'> | null;
  unread_count: number;
}

export interface MessageView extends Omit<StaffMessage, 'attachments'> {
  sender_name: string;
  /** Names and sizes only: the key stays on the server, files are opened through `/team/threads/:id/messages/:mid/files/:n`. */
  attachments: { name: string; size_bytes: number; type: string }[] | null;
}

@Injectable()
export class TeamChatService {
  constructor(
    private readonly db: DatabaseService,
    private readonly access: AccessService,
    private readonly storage: PrivateStorage,
    private readonly notifications: NotificationsService,
    private readonly realtime: RealtimeService,
  ) {}

  /** The other staff a person can start a direct chat with. */
  async people(principal: AuthPrincipal): Promise<{ id: string; name: string; role: string }[]> {
    const rows = await this.db.staffUsers.findAll((row) => row.id !== principal.id && (TEAM as readonly string[]).includes(row.role));
    return rows.map(({ id, name, role }) => ({ id, name, role })).sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Every thread the caller is in: their direct chats plus the project threads of their projects. */
  async list(principal: AuthPrincipal): Promise<ThreadView[]> {
    const direct = await this.db.staffThreads.findWhere({ pair_key: { contains: principal.id } });
    const mine = direct.filter((thread) => thread.pair_key!.split(':').includes(principal.id));
    const projects = await this.db.projects.findWhere(this.access.projectScope(principal));
    const projectThreads = projects.length
      ? await this.db.staffThreads.findWhere({ project_id: { in: projects.map((project) => project.id) } })
      : [];
    const names = new Map(projects.map((project) => [project.id, project.name]));

    const views: ThreadView[] = [];
    for (const thread of [...mine, ...projectThreads]) {
      const kind = thread.project_id ? 'project' : 'direct';
      const title = thread.project_id
        ? (names.get(thread.project_id) ?? 'Project')
        : await this.otherName(thread, principal.id);
      views.push({
        ...thread,
        kind,
        title,
        last_message: await this.lastMessage(thread.id),
        unread_count: await this.unread(thread.id, principal.id),
      });
    }
    return views.sort((a, b) => (b.last_message?.created_at ?? b.created_at).localeCompare(a.last_message?.created_at ?? a.created_at));
  }

  /** The Team badge: unread across every thread the caller is in. */
  async unreadCount(principal: AuthPrincipal): Promise<number> {
    return (await this.list(principal)).reduce((sum, thread) => sum + thread.unread_count, 0);
  }

  /** The caller's direct chat with `staffId`, started if there is none. One per pair (a unique key, so a race re-reads the winner). */
  async openDirect(principal: AuthPrincipal, dto: OpenDirectDto): Promise<ThreadView> {
    if (dto.staff_id === principal.id) throw new BadRequestException('Choose someone else to message.');
    const other = await this.db.staffUsers.findById(dto.staff_id);
    if (!other || !(TEAM as readonly string[]).includes(other.role)) throw new NotFoundException('Person not found');
    const pair_key = [principal.id, other.id].sort().join(':');
    const thread = await this.getOrCreate({ pair_key });
    return this.view(thread, principal);
  }

  /** The project's thread, started if there is none. Out-of-scope projects are 404 (requireProject). */
  async openProject(principal: AuthPrincipal, projectId: string): Promise<ThreadView> {
    const project = await this.access.requireProject(principal, projectId);
    const thread = await this.getOrCreate({ project_id: project.id });
    return this.view(thread, principal);
  }

  async messages(principal: AuthPrincipal, threadId: string): Promise<MessageView[]> {
    await this.require(principal, threadId);
    const latest = await this.db.staffMessages.findWhere(
      { thread_id: threadId },
      { orderBy: { created_at: 'desc' }, take: THREAD_LIMIT },
    );
    const senders = await this.db.staffUsers.findAll((row) => latest.some((message) => message.sender_id === row.id));
    const names = new Map(senders.map((row) => [row.id, row.name]));
    return latest.reverse().map((message) => this.messageView(message, names.get(message.sender_id) ?? 'Former team member'));
  }

  async send(principal: AuthPrincipal, threadId: string, dto: SendTeamMessageDto, file?: Upload): Promise<MessageView> {
    const { thread, project } = await this.require(principal, threadId);
    const body = (dto.body ?? '').trim();
    if (!body && !file) throw new BadRequestException('Write a message or attach a file.');

    let attachment: StaffAttachment | null = null;
    if (file) {
      const kind = KINDS.find((candidate) => candidate.matches(file.buffer));
      if (!kind) throw new BadRequestException(TYPES_MESSAGE);
      if (file.size > (kind.video ? MAX_VIDEO_BYTES : MAX_FILE_BYTES)) {
        throw new BadRequestException(kind.video ? 'Videos can be up to 100 MB.' : 'Files can be up to 25 MB.');
      }
      const name = file.originalname.trim().slice(0, 160) || `file${kind.ext}`;
      const stem = path.basename(name, path.extname(name)).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
      // Generated here, never taken from the request, so it cannot traverse or overwrite.
      // ponytail: held in memory (100 MB cap) and not removed with its project; stream and sweep if uploads get heavy.
      const key = `team/${thread.id}/${randomUUID()}-${stem || 'file'}${kind.ext}`;
      await this.storage.put(key, file.buffer, kind.type);
      attachment = { key, name, size_bytes: file.size, type: kind.type };
    }

    const message = await this.db.staffMessages.create({
      thread_id: thread.id,
      // From the verified principal, never the request.
      sender_id: principal.id,
      body,
      attachments: attachment ? [attachment] : null,
      created_at: new Date().toISOString(),
    });
    await this.tell(principal, thread, project);
    return this.messageView(message, principal.name);
  }

  /** One signed, five-minute link to an attachment. Images, video and PDFs open in the browser; the rest download. */
  async fileUrl(principal: AuthPrincipal, threadId: string, messageId: string, index: number): Promise<{ url: string }> {
    await this.require(principal, threadId);
    const message = await this.db.staffMessages.findFirstWhere({ id: messageId, thread_id: threadId });
    const file = message?.attachments?.[index];
    if (!file) throw new NotFoundException('File not found');
    return { url: await this.storage.downloadUrl(file.key, file.name, file.type) };
  }

  async markRead(principal: AuthPrincipal, threadId: string): Promise<{ read: true }> {
    await this.require(principal, threadId);
    const read_at = new Date().toISOString();
    const updated = await this.db.staffThreadReads.updateWhere({ thread_id: threadId, staff_id: principal.id }, { read_at });
    if (updated === 0) {
      try {
        await this.db.staffThreadReads.create({ thread_id: threadId, staff_id: principal.id, read_at });
      } catch {
        // Lost a race with our own second tab: the other row says the same thing.
      }
    }
    return { read: true };
  }

  /* ----------------------------------------------------------------------- */

  /** A thread the caller may use, with its project when it is one. Anything else is 404. */
  private async require(principal: AuthPrincipal, threadId: string): Promise<{ thread: StaffThread; project: Project | null }> {
    const thread = await this.db.staffThreads.findById(threadId);
    if (!thread) throw new NotFoundException('Conversation not found');
    if (thread.project_id) return { thread, project: await this.access.requireProject(principal, thread.project_id) };
    if (!thread.pair_key?.split(':').includes(principal.id)) throw new NotFoundException('Conversation not found');
    return { thread, project: null };
  }

  private async getOrCreate(where: { project_id: string } | { pair_key: string }): Promise<StaffThread> {
    const found = await this.db.staffThreads.findFirstWhere(where);
    if (found) return found;
    try {
      return await this.db.staffThreads.create({
        project_id: null,
        pair_key: null,
        ...where,
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      const winner = await this.db.staffThreads.findFirstWhere(where);
      if (!winner) throw error;
      return winner;
    }
  }

  private async view(thread: StaffThread, principal: AuthPrincipal): Promise<ThreadView> {
    const project = thread.project_id ? await this.db.projects.findById(thread.project_id) : null;
    return {
      ...thread,
      kind: thread.project_id ? 'project' : 'direct',
      title: project ? project.name : await this.otherName(thread, principal.id),
      last_message: await this.lastMessage(thread.id),
      unread_count: await this.unread(thread.id, principal.id),
    };
  }

  private async otherName(thread: StaffThread, me: string): Promise<string> {
    const otherId = thread.pair_key?.split(':').find((id) => id !== me);
    return (otherId && (await this.db.staffUsers.findById(otherId))?.name) || 'Former team member';
  }

  private async lastMessage(threadId: string): Promise<ThreadView['last_message']> {
    const last = await this.db.staffMessages.findFirstWhere({ thread_id: threadId }, { created_at: 'desc' });
    return last && { body: last.body, created_at: last.created_at, sender_id: last.sender_id };
  }

  /** Messages from someone else since this person last opened the thread. */
  private async unread(threadId: string, staffId: string): Promise<number> {
    const read = await this.db.staffThreadReads.findFirstWhere({ thread_id: threadId, staff_id: staffId });
    return this.db.staffMessages.countWhere({
      thread_id: threadId,
      sender_id: { not: staffId },
      ...(read ? { created_at: { gt: read.read_at } } : {}),
    });
  }

  private messageView(message: StaffMessage, sender_name: string): MessageView {
    const { attachments, ...rest } = message;
    return {
      ...rest,
      sender_name,
      attachments: attachments?.map(({ name, size_bytes, type }) => ({ name, size_bytes, type })) ?? null,
    };
  }

  /**
   * Live refresh and a bell + push to everyone else in the thread: the other
   * person in a direct chat; for a project, everyone on it plus every Admin.
   * No message text leaves the app on the lock screen, only who and where.
   */
  private async tell(sender: AuthPrincipal, thread: StaffThread, project: Project | null): Promise<void> {
    let audience: Set<string>;
    if (project) {
      audience = await this.access.staffOn([project]);
      for (const admin of await this.db.staffUsers.findWhere({ role: 'Admin' })) audience.add(admin.id);
    } else {
      audience = new Set(thread.pair_key!.split(':'));
    }
    audience.delete(sender.id);
    const title = project ? `${sender.name} on ${project.name}` : `New message from ${sender.name}`;
    const link = `/team?thread=${thread.id}`;
    for (const id of audience) {
      this.realtime.toUser(id, 'team:message', { thread_id: thread.id });
      await this.notifications.notify(id, { kind: 'message', title, link });
    }
  }
}

@Controller('team')
export class TeamChatController {
  constructor(private readonly team: TeamChatService) {}

  @Get('people')
  @Roles(...TEAM)
  people(@CurrentUser() principal: AuthPrincipal) {
    return this.team.people(principal);
  }

  @Get('threads')
  @Roles(...TEAM)
  threads(@CurrentUser() principal: AuthPrincipal) {
    return this.team.list(principal);
  }

  /** The Team badge. */
  @Get('unread-count')
  @Roles(...TEAM)
  async unread(@CurrentUser() principal: AuthPrincipal) {
    return { unread: await this.team.unreadCount(principal) };
  }

  @Post('direct')
  @Roles(...TEAM)
  openDirect(@CurrentUser() principal: AuthPrincipal, @Body() dto: OpenDirectDto) {
    return this.team.openDirect(principal, dto);
  }

  @Get('projects/:projectId/thread')
  @Roles(...PROJECT_TEAM)
  openProject(@CurrentUser() principal: AuthPrincipal, @Param('projectId') projectId: string) {
    return this.team.openProject(principal, projectId);
  }

  @Get('threads/:id/messages')
  @Roles(...TEAM)
  messages(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string) {
    return this.team.messages(principal, id);
  }

  /** JSON, or multipart/form-data with an optional `file` (video up to 100 MB, image or PDF up to 25 MB) and `body`. */
  @Post('threads/:id/messages')
  @Roles(...TEAM)
  @HttpCode(201)
  @Throttle({ default: { limit: 120, ttl: 15 * 60_000 } })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_VIDEO_BYTES, files: 1, fields: 5 } }))
  send(
    @CurrentUser() principal: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: SendTeamMessageDto,
    @UploadedFile() file: Upload | undefined,
  ) {
    return this.team.send(principal, id, dto, file);
  }

  @Get('threads/:id/messages/:messageId/files/:index')
  @Roles(...TEAM)
  file(
    @CurrentUser() principal: AuthPrincipal,
    @Param('id') id: string,
    @Param('messageId') messageId: string,
    @Param('index') index: string,
  ) {
    return this.team.fileUrl(principal, id, messageId, Number.parseInt(index, 10) || 0);
  }

  @Put('threads/:id/read')
  @Roles(...TEAM)
  @HttpCode(200)
  read(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string) {
    return this.team.markRead(principal, id);
  }
}

@Module({
  imports: [NotificationsModule],
  controllers: [TeamChatController],
  providers: [TeamChatService],
})
export class TeamChatModule {}
