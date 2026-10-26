import { randomBytes } from 'node:crypto';

import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Injectable,
  Logger,
  NotFoundException,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsEmail, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

import { CurrentUser, Roles } from '../../common/decorators';
import { ADMIN_ROLES, PRIVILEGED_ROLES, StaffRemovalRequest, StaffRole, StaffUser, TwoFactorMethod } from '../../common/types/domain';
import { AuthPrincipal } from '../../common/types/principal';
import { ActivityLogService } from '../../core/activity-log.service';
import { MailService, templates } from '../../core/mail.service';
import { RateLimitStore } from '../../core/rate-limit';
import { DatabaseService } from '../../data/database.service';
import { NotificationsService } from '../notifications/notifications.module';
import { digest, looksHashed } from './auth.service';
import { NOT_IMPORTER } from './dto';
import { PasswordConfirmDto, confirmPassword } from './reauth';
import { NO_TWO_FACTOR, codeFailuresKey } from './two-factor';

type AdminRole = (typeof ADMIN_ROLES)[number];

const ROLE_MESSAGE = 'Choose Admin, Infra manager, Editor, Designer or Installer.';

export class InviteDto {
  @IsString() @MinLength(2, { message: 'Enter their name.' }) @MaxLength(120) @Matches(NOT_IMPORTER, { message: 'Choose a different name.' }) name!: string;
  @IsEmail({}, { message: 'Enter a valid email address.' }) @MaxLength(254) email!: string;
  @IsIn(ADMIN_ROLES, { message: ROLE_MESSAGE }) role!: AdminRole;
}

export class RoleDto {
  @IsIn(ADMIN_ROLES, { message: ROLE_MESSAGE }) role!: AdminRole;
}

export class RemovalRequestDto {
  @IsString() @MinLength(5, { message: 'Say why, in a few words.' }) @MaxLength(500) reason!: string;
}

export class DeclineRemovalDto {
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

/** A person as the Users list shows them. Never carries a credential. */
export interface UserView {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  /** Invited = has not chosen a password yet. */
  status: 'Active' | 'Invited';
  inviteExpired: boolean;
  /** How they get sign-in codes; null = not chosen yet (or reset). */
  twoFactorMethod: TwoFactorMethod | null;
  created_at: string;
}

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const isPrivileged = (role: string): boolean => PRIVILEGED_ROLES.includes(role as StaffRole);

/** Only an Infra manager may touch Admin or Infra accounts, or hand those roles out. */
function assertMayManage(principal: AuthPrincipal, ...roles: string[]): void {
  if (principal.role !== 'Infra' && roles.some(isPrivileged)) {
    throw new ForbiddenException('Only an Infra manager can do that to an Admin or an Infra manager.');
  }
}

function view(staff: StaffUser): UserView {
  const invited = !looksHashed(staff.password_hash);
  return {
    id: staff.id,
    name: staff.name,
    email: staff.email,
    role: staff.role,
    status: invited ? 'Invited' : 'Active',
    inviteExpired: invited && (!staff.reset_expires_at || Date.parse(staff.reset_expires_at) < Date.now()),
    twoFactorMethod: staff.two_factor_method ?? null,
    created_at: staff.created_at,
  };
}

/**
 * Who can sign in to the admin, and as what. Admins and Infra managers invite
 * people by email; the invitation is a password-reset link that lasts a week,
 * so accepting one goes through the same reset page and the same rules as a
 * forgotten password.
 *
 * Admin and Infra accounts are the Infra manager's alone: an Admin manages
 * Editors, Designers and Installers, and asks (removal request) for another
 * Admin to go. One Admin resetting or removing another is the quickest way to
 * take an account over, so it needs someone who is not an Admin.
 */
@Injectable()
export class UsersService {
  private readonly adminUrl = (process.env.ADMIN_URL ?? 'http://localhost:5174').replace(/\/+$/, '');
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly mail: MailService,
    private readonly activity: ActivityLogService,
    private readonly limits: RateLimitStore,
    private readonly notifications: NotificationsService,
  ) {}

  async list(): Promise<UserView[]> {
    const rows = await this.db.staffUsers.findWhere({}, { orderBy: { name: 'asc' } });
    return rows.map(view);
  }

  private async require(id: string): Promise<StaffUser> {
    const staff = await this.db.staffUsers.findById(id);
    if (!staff) throw new NotFoundException('That person is no longer here.');
    return staff;
  }

  /** Nobody may leave the admin without an Admin, or an Infra manager, who can undo it. */
  private async assertNotLast(staff: StaffUser, doing: string): Promise<void> {
    if (!isPrivileged(staff.role)) return;
    if ((await this.db.staffUsers.count((row) => row.role === staff.role)) <= 1) {
      const who = staff.role === 'Admin' ? 'Admin' : 'Infra manager';
      throw new BadRequestException(`${staff.name} is the only ${who}, so you cannot ${doing}. Make someone else ${who === 'Admin' ? 'an Admin' : 'an Infra manager'} first.`);
    }
  }

  private async sendInvite(principal: AuthPrincipal, staff: StaffUser): Promise<boolean> {
    const token = randomBytes(32).toString('base64url');
    await this.db.staffUsers.update(staff.id, {
      reset_token_hash: digest(token),
      reset_expires_at: new Date(Date.now() + INVITE_TTL_MS).toISOString(),
    });
    const link = `${this.adminUrl}/reset-password#token=${token}&invite=1`;
    return this.mail.send({ to: staff.email, ...templates.invite(staff.name, principal.name, staff.role === 'Infra' ? 'Infra manager' : staff.role, link) });
  }

  async invite(principal: AuthPrincipal, dto: InviteDto): Promise<UserView & { emailed: boolean }> {
    assertMayManage(principal, dto.role);
    const email = dto.email.trim().toLowerCase();
    if (await this.db.staffUsers.findOne((row) => row.email.toLowerCase() === email)) {
      throw new BadRequestException('Someone with that email address already has an account.');
    }
    const now = new Date().toISOString();
    const created = await this.db.staffUsers.create({
      name: dto.name.trim(),
      email,
      // No password until the invitation is accepted, and an empty hash can
      // never match one (auth.service verify()).
      password_hash: '',
      role: dto.role,
      token_version: 0,
      reset_token_hash: null,
      reset_expires_at: null,
      created_at: now,
      updated_at: now,
    });
    const emailed = await this.sendInvite(principal, created);
    await this.activity.record({
      principal,
      action: 'staff_invite',
      targetTable: 'staff_users',
      targetId: created.id,
      details: { email, role: dto.role },
    });
    return { ...view((await this.db.staffUsers.findById(created.id))!), emailed };
  }

  async resendInvite(principal: AuthPrincipal, id: string): Promise<{ emailed: boolean }> {
    const staff = await this.require(id);
    assertMayManage(principal, staff.role);
    if (looksHashed(staff.password_hash)) throw new BadRequestException(`${staff.name} has already joined.`);
    return { emailed: await this.sendInvite(principal, staff) };
  }

  async setRole(principal: AuthPrincipal, id: string, role: AdminRole): Promise<UserView> {
    const staff = await this.require(id);
    if (staff.id === principal.id) throw new BadRequestException('Ask someone else to change your own role.');
    assertMayManage(principal, staff.role, role);
    if (role !== staff.role) await this.assertNotLast(staff, 'change their role');
    // A new role signs them out everywhere, so no token (or open socket that
    // read the role once) carries the old one.
    const updated = (await this.db.staffUsers.update(id, {
      role,
      ...(role !== staff.role && { token_version: staff.token_version + 1 }),
      updated_at: new Date().toISOString(),
    }))!;
    await this.activity.record({
      principal,
      action: 'staff_role_change',
      targetTable: 'staff_users',
      targetId: id,
      details: { name: staff.name, from: staff.role, to: role },
    });
    return view(updated);
  }

  /**
   * For a lost phone or inbox, or a taken-over account: they choose a method
   * again at their next sign-in, every remembered browser has to pass it
   * again, the Google link is gone and the wrong-code pause is lifted. For a
   * taken-over account that also means signing out whoever holds a token, so
   * token_version moves on (as in setRole) and open sockets drop with it.
   * An Admin's or Infra manager's is reset by an Infra manager only.
   */
  async resetTwoFactor(principal: AuthPrincipal, id: string): Promise<void> {
    const staff = await this.require(id);
    assertMayManage(principal, staff.role);
    await this.db.staffUsers.update(id, {
      ...NO_TWO_FACTOR,
      token_version: staff.token_version + 1,
      updated_at: new Date().toISOString(),
    });
    await this.db.trustedDevices.deleteMany((row) => row.staff_user_id === id);
    await this.limits.clear(codeFailuresKey(id));
    await this.activity.record({
      principal,
      action: 'staff_reset_2fa',
      targetTable: 'staff_users',
      targetId: id,
      details: { name: staff.name, email: staff.email, method: staff.two_factor_method ?? null },
    });
  }

  /** Signs them out at once: the guard re-reads the account on every request. */
  private async purge(principal: AuthPrincipal, staff: StaffUser, details: Record<string, unknown> = {}): Promise<void> {
    await this.db.staffUsers.delete(staff.id);
    await this.db.trustedDevices.deleteMany((row) => row.staff_user_id === staff.id);
    await this.db.notifications.deleteMany((row) => row.recipient_id === staff.id);
    // Whatever was still waiting on them can no longer be answered.
    await this.db.staffRemovalRequests.updateWhere(
      { target_id: staff.id, status: 'Pending' },
      { status: 'Declined', decision_note: 'Their account was removed.', decided_at: new Date().toISOString() },
    );
    await this.activity.record({
      principal,
      action: 'staff_delete',
      targetTable: 'staff_users',
      targetId: staff.id,
      details: { name: staff.name, email: staff.email, role: staff.role, ...details },
    });
  }

  /**
   * An Editor, Designer or Installer: either of us. An Admin or an Infra
   * manager: an Infra manager only, with their password again.
   */
  async remove(principal: AuthPrincipal, id: string, password: string | undefined): Promise<void> {
    const staff = await this.require(id);
    if (staff.id === principal.id) throw new BadRequestException('You cannot remove your own account.');
    if (isPrivileged(staff.role)) {
      assertMayManage(principal, staff.role);
      await confirmPassword(this.db, principal, password);
    }
    await this.assertNotLast(staff, 'remove them');
    await this.purge(principal, staff);
  }

  /* ------------------------------ removal requests ----------------------------- */

  /** Infra: everyone's. Admin: their own. Newest first. */
  listRemovals(principal: AuthPrincipal): Promise<StaffRemovalRequest[]> {
    return this.db.staffRemovalRequests.findWhere(
      principal.role === 'Infra' ? {} : { requested_by: principal.id },
      { orderBy: { created_at: 'desc' }, take: 50 },
    );
  }

  private async emailInfra(title: string, body: string): Promise<void> {
    try {
      const managers = await this.db.staffUsers.findWhere({ role: 'Infra' });
      for (const manager of managers.filter((row) => looksHashed(row.password_hash))) {
        const sent = await this.mail.send({ to: manager.email, ...templates.staffRequest(manager.name, `[Enzo][SECURITY] ${title}`, body, `${this.adminUrl}/settings/users`) });
        if (!sent) this.logger.warn(`Could not email "${title}" to an Infra manager.`);
      }
    } catch (error) {
      this.logger.error(`Infra email failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /** An Admin asks for another Admin to be removed. The Infra managers are told. */
  async requestRemoval(principal: AuthPrincipal, id: string, reason: string): Promise<StaffRemovalRequest> {
    const staff = await this.require(id);
    if (staff.id === principal.id) throw new BadRequestException('You cannot ask to remove your own account.');
    if (staff.role !== 'Admin') {
      throw new BadRequestException(`${staff.name} is not an Admin. You can remove an Editor, Designer or Installer yourself.`);
    }
    if (await this.db.staffRemovalRequests.findFirstWhere({ target_id: id, status: 'Pending' })) {
      throw new BadRequestException(`Removing ${staff.name} has already been asked for. An Infra manager will answer it.`);
    }
    const saved = await this.db.staffRemovalRequests.create({
      target_id: staff.id,
      target_name: staff.name,
      target_email: staff.email,
      requested_by: principal.id,
      requested_name: principal.name,
      reason: reason.trim(),
      status: 'Pending',
      decided_by: null,
      decided_name: null,
      decision_note: null,
      decided_at: null,
      created_at: new Date().toISOString(),
    });
    await this.activity.record({
      principal,
      action: 'staff_removal_requested',
      targetTable: 'staff_users',
      targetId: staff.id,
      details: { name: staff.name, reason: saved.reason },
    });
    const title = `${principal.name} asks to remove the Admin ${staff.name}`;
    await this.notifications.notifyRole('Infra', { kind: 'request', title, body: saved.reason, link: '/settings/users' });
    void this.emailInfra(title, saved.reason);
    return saved;
  }

  /** Infra only (controller), with their password. Claimed by one conditional UPDATE, so it is applied once. */
  async approveRemoval(principal: AuthPrincipal, id: string, password: string | undefined): Promise<StaffRemovalRequest> {
    await confirmPassword(this.db, principal, password);
    const request = await this.db.staffRemovalRequests.findById(id);
    if (!request || request.status !== 'Pending') throw new NotFoundException('This request was already answered or no longer exists.');
    const staff = await this.db.staffUsers.findById(request.target_id);
    if (!staff) {
      await this.db.staffRemovalRequests.update(id, { status: 'Declined', decision_note: 'Their account was already removed.', decided_at: new Date().toISOString() });
      throw new NotFoundException(`${request.target_name} is already gone.`);
    }
    if (staff.id === principal.id) throw new BadRequestException('You cannot remove your own account.');
    const decided = { status: 'Approved', decided_by: principal.id, decided_name: principal.name, decided_at: new Date().toISOString() } as const;
    if (!(await this.db.staffRemovalRequests.updateWhere({ id, status: 'Pending' }, decided))) {
      throw new NotFoundException('This request was already answered or no longer exists.');
    }
    try {
      await this.assertNotLast(staff, 'remove them');
      await this.purge(principal, staff, { via: 'removal request', requested_by: request.requested_name, reason: request.reason });
    } catch (error) {
      await this.db.staffRemovalRequests.update(id, { status: 'Pending', decided_by: null, decided_name: null, decided_at: null });
      throw error;
    }
    await this.notifications.notify(request.requested_by, {
      kind: 'request',
      title: `${principal.name} approved removing ${request.target_name}`,
      link: '/settings/users',
    });
    return { ...request, ...decided };
  }

  async declineRemoval(principal: AuthPrincipal, id: string, note: string | undefined): Promise<StaffRemovalRequest> {
    const decided = {
      status: 'Declined',
      decided_by: principal.id,
      decided_name: principal.name,
      decision_note: note?.trim() || null,
      decided_at: new Date().toISOString(),
    } as const;
    if (!(await this.db.staffRemovalRequests.updateWhere({ id, status: 'Pending' }, decided))) {
      throw new NotFoundException('This request was already answered or no longer exists.');
    }
    const request = (await this.db.staffRemovalRequests.findById(id))!;
    await this.activity.record({
      principal,
      action: 'staff_removal_declined',
      targetTable: 'staff_users',
      targetId: request.target_id,
      details: { name: request.target_name, note: decided.decision_note },
    });
    await this.notifications.notify(request.requested_by, {
      kind: 'request',
      title: `${principal.name} declined removing ${request.target_name}`,
      body: decided.decision_note,
      link: '/settings/users',
    });
    return request;
  }
}

@Controller('users')
@Roles('Admin', 'Infra')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list() {
    return this.users.list();
  }

  @Get('removal-requests')
  listRemovals(@CurrentUser() principal: AuthPrincipal) {
    return this.users.listRemovals(principal);
  }

  @Post('removal-requests/:id/approve')
  @Roles('Infra')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 15 * 60_000 } })
  approveRemoval(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string, @Body() dto: PasswordConfirmDto) {
    return this.users.approveRemoval(principal, id, dto.password);
  }

  @Post('removal-requests/:id/decline')
  @Roles('Infra')
  @HttpCode(200)
  decline(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string, @Body() dto: DeclineRemovalDto) {
    return this.users.declineRemoval(principal, id, dto.note);
  }

  @Post()
  @Throttle({ default: { limit: 20, ttl: 60 * 60_000 } })
  invite(@CurrentUser() principal: AuthPrincipal, @Body() dto: InviteDto) {
    return this.users.invite(principal, dto);
  }

  @Post(':id/invite')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60 * 60_000 } })
  resend(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string) {
    return this.users.resendInvite(principal, id);
  }

  @Post(':id/removal-request')
  @Roles('Admin')
  @Throttle({ default: { limit: 10, ttl: 60 * 60_000 } })
  requestRemoval(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string, @Body() dto: RemovalRequestDto) {
    return this.users.requestRemoval(principal, id, dto.reason);
  }

  @Post(':id/reset-2fa')
  @HttpCode(204)
  @Throttle({ default: { limit: 20, ttl: 60 * 60_000 } })
  async resetTwoFactor(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string) {
    await this.users.resetTwoFactor(principal, id);
  }

  @Put(':id')
  setRole(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string, @Body() dto: RoleDto) {
    return this.users.setRole(principal, id, dto.role);
  }

  @Delete(':id')
  @HttpCode(204)
  @Throttle({ default: { limit: 10, ttl: 15 * 60_000 } })
  async remove(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string, @Body() dto: PasswordConfirmDto) {
    await this.users.remove(principal, id, dto.password);
  }
}
