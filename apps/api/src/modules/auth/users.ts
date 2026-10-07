import { randomBytes } from 'node:crypto';

import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Injectable,
  NotFoundException,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsEmail, IsIn, IsString, Matches, MaxLength, MinLength } from 'class-validator';

import { CurrentUser, Roles } from '../../common/decorators';
import { ADMIN_ROLES, StaffUser, TwoFactorMethod } from '../../common/types/domain';
import { AuthPrincipal } from '../../common/types/principal';
import { ActivityLogService } from '../../core/activity-log.service';
import { MailService, templates } from '../../core/mail.service';
import { RateLimitStore } from '../../core/rate-limit';
import { DatabaseService } from '../../data/database.service';
import { digest, looksHashed } from './auth.service';
import { NOT_IMPORTER } from './dto';
import { NO_TWO_FACTOR, codeFailuresKey } from './two-factor';

type AdminRole = (typeof ADMIN_ROLES)[number];

export class InviteDto {
  @IsString() @MinLength(2, { message: 'Enter their name.' }) @MaxLength(120) @Matches(NOT_IMPORTER, { message: 'Choose a different name.' }) name!: string;
  @IsEmail({}, { message: 'Enter a valid email address.' }) @MaxLength(254) email!: string;
  @IsIn(ADMIN_ROLES, { message: 'Choose Admin, Editor or Designer.' }) role!: AdminRole;
}

export class RoleDto {
  @IsIn(ADMIN_ROLES, { message: 'Choose Admin, Editor or Designer.' }) role!: AdminRole;
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

/** Installer is a legacy name for Designer. */
const roleOf = (staff: StaffUser): AdminRole => (staff.role === 'Installer' ? 'Designer' : staff.role);

function view(staff: StaffUser): UserView {
  const invited = !looksHashed(staff.password_hash);
  return {
    id: staff.id,
    name: staff.name,
    email: staff.email,
    role: roleOf(staff),
    status: invited ? 'Invited' : 'Active',
    inviteExpired: invited && (!staff.reset_expires_at || Date.parse(staff.reset_expires_at) < Date.now()),
    twoFactorMethod: staff.two_factor_method ?? null,
    created_at: staff.created_at,
  };
}

/**
 * Who can sign in to the admin, and as what. Admins invite people by email;
 * the invitation is a password-reset link that lasts a week, so accepting one
 * goes through the same reset page and the same rules as a forgotten password.
 */
@Injectable()
export class UsersService {
  private readonly adminUrl = (process.env.ADMIN_URL ?? 'http://localhost:5174').replace(/\/+$/, '');

  constructor(
    private readonly db: DatabaseService,
    private readonly mail: MailService,
    private readonly activity: ActivityLogService,
    private readonly limits: RateLimitStore,
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

  /** Nobody may leave the admin without an Admin who can undo it. */
  private async assertNotLastAdmin(staff: StaffUser, doing: string): Promise<void> {
    if (staff.role !== 'Admin') return;
    if ((await this.db.staffUsers.count((row) => row.role === 'Admin')) <= 1) {
      throw new BadRequestException(`${staff.name} is the only Admin, so you cannot ${doing}. Make someone else an Admin first.`);
    }
  }

  private async sendInvite(principal: AuthPrincipal, staff: StaffUser): Promise<boolean> {
    const token = randomBytes(32).toString('base64url');
    await this.db.staffUsers.update(staff.id, {
      reset_token_hash: digest(token),
      reset_expires_at: new Date(Date.now() + INVITE_TTL_MS).toISOString(),
    });
    const link = `${this.adminUrl}/reset-password#token=${token}&invite=1`;
    return this.mail.send({ to: staff.email, ...templates.invite(staff.name, principal.name, roleOf(staff), link) });
  }

  async invite(principal: AuthPrincipal, dto: InviteDto): Promise<UserView & { emailed: boolean }> {
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
    if (looksHashed(staff.password_hash)) throw new BadRequestException(`${staff.name} has already joined.`);
    return { emailed: await this.sendInvite(principal, staff) };
  }

  async setRole(principal: AuthPrincipal, id: string, role: AdminRole): Promise<UserView> {
    const staff = await this.require(id);
    if (staff.id === principal.id) throw new BadRequestException('Ask another Admin to change your own role.');
    if (role !== 'Admin') await this.assertNotLastAdmin(staff, 'change their role');
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
   * again, the Google link is gone and the wrong-code pause is lifted.
   */
  async resetTwoFactor(principal: AuthPrincipal, id: string): Promise<void> {
    const staff = await this.require(id);
    await this.db.staffUsers.update(id, { ...NO_TWO_FACTOR, updated_at: new Date().toISOString() });
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
  async remove(principal: AuthPrincipal, id: string): Promise<void> {
    const staff = await this.require(id);
    if (staff.id === principal.id) throw new BadRequestException('You cannot remove your own account.');
    await this.assertNotLastAdmin(staff, 'remove them');
    await this.db.staffUsers.delete(id);
    await this.db.trustedDevices.deleteMany((row) => row.staff_user_id === id);
    await this.db.notifications.deleteMany((row) => row.recipient_id === id);
    await this.activity.record({
      principal,
      action: 'staff_delete',
      targetTable: 'staff_users',
      targetId: id,
      details: { name: staff.name, email: staff.email },
    });
  }
}

@Controller('users')
@Roles('Admin')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list() {
    return this.users.list();
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
  async remove(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string) {
    await this.users.remove(principal, id);
  }
}
