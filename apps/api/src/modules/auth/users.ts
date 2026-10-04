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
import { ADMIN_ROLES, StaffUser } from '../../common/types/domain';
import { AuthPrincipal } from '../../common/types/principal';
import { ActivityLogService } from '../../core/activity-log.service';
import { MailService, templates } from '../../core/mail.service';
import { DatabaseService } from '../../data/database.service';
import { digest, looksHashed } from './auth.service';
import { NOT_IMPORTER } from './dto';

type AdminRole = (typeof ADMIN_ROLES)[number];

export class InviteDto {
  @IsString() @MinLength(2, { message: 'Enter their name.' }) @MaxLength(120) @Matches(NOT_IMPORTER, { message: 'Choose a different name.' }) name!: string;
  @IsEmail({}, { message: 'Enter a valid email address.' }) @MaxLength(254) email!: string;
  @IsIn(ADMIN_ROLES, { message: 'Choose Admin or Editor.' }) role!: AdminRole;
}

export class RoleDto {
  @IsIn(ADMIN_ROLES, { message: 'Choose Admin or Editor.' }) role!: AdminRole;
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
  created_at: string;
}

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** The CRM's Designer is an Editor here. */
const roleOf = (staff: StaffUser): AdminRole => (staff.role === 'Admin' ? 'Admin' : 'Editor');

function view(staff: StaffUser): UserView {
  const invited = !looksHashed(staff.password_hash);
  return {
    id: staff.id,
    name: staff.name,
    email: staff.email,
    role: roleOf(staff),
    status: invited ? 'Invited' : 'Active',
    inviteExpired: invited && (!staff.reset_expires_at || Date.parse(staff.reset_expires_at) < Date.now()),
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
  ) {}

  async list(): Promise<UserView[]> {
    const rows = await this.db.staffUsers.findAll((row) => row.role !== 'Installer');
    return rows.sort((a, b) => a.name.localeCompare(b.name)).map(view);
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
    const updated = (await this.db.staffUsers.update(id, { role, updated_at: new Date().toISOString() }))!;
    await this.activity.record({
      principal,
      action: 'staff_role_change',
      targetTable: 'staff_users',
      targetId: id,
      details: { name: staff.name, from: staff.role, to: role },
    });
    return view(updated);
  }

  /** Signs them out at once: the guard re-reads the account on every request. */
  async remove(principal: AuthPrincipal, id: string): Promise<void> {
    const staff = await this.require(id);
    if (staff.id === principal.id) throw new BadRequestException('You cannot remove your own account.');
    await this.assertNotLastAdmin(staff, 'remove them');
    await this.db.staffUsers.delete(id);
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
