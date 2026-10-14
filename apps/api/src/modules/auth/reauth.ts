import { ForbiddenException } from '@nestjs/common';
import { IsOptional, IsString, MaxLength } from 'class-validator';

import { AuthPrincipal } from '../../common/types/principal';
import { DatabaseService } from '../../data/database.service';
import { verify } from './auth.service';

/** Body of a delete that cannot be undone: the signed-in person's password, again. */
export class PasswordConfirmDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  password?: string;
}

/**
 * Re-authentication for irreversible deletes (a client and all their records,
 * a project, a paid invoice): a stolen or unattended session alone is not
 * enough. 403, never 401, so the admin is not signed out by a typo. The routes
 * that call this are throttled, so it cannot be used to guess the password.
 */
export async function confirmPassword(db: DatabaseService, principal: AuthPrincipal, password: string | undefined): Promise<void> {
  const staff = principal.kind === 'Staff' ? await db.staffUsers.findById(principal.id) : null;
  if (!password || !(await verify(password, staff?.password_hash))) {
    throw new ForbiddenException('That password is not right. Enter the password you sign in with.');
  }
}
