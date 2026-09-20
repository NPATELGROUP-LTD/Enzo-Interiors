import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

import { AuthPrincipal, JwtPayload } from '../../common/types/principal';
import { DatabaseService } from '../../data/database.service';

export interface LoginResult {
  access_token: string;
  user: AuthPrincipal;
}

/** Work factor for new hashes. 12 is ~250ms on commodity hardware in 2026. */
export const BCRYPT_ROUNDS = 12;

/** Hash a new password. The only place a password becomes a stored value. */
export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

/**
 * A bcrypt hash, as opposed to the plaintext the prototype used to store.
 *
 * Kept so that a database seeded before the migration fails closed rather than
 * silently comparing a password against a plaintext column.
 */
function looksHashed(value: string): boolean {
  return /^\$2[aby]\$\d{2}\$/.test(value);
}

/**
 * Constant-time password check.
 *
 * A stored value that is not a bcrypt hash is treated as a failure, never as
 * something to compare directly. bcrypt.compare is still run against a dummy
 * hash in that case so a legacy row does not answer faster than a real one and
 * leak which accounts have been migrated.
 */
const DUMMY_HASH = '$2b$12$C6UzMDM.H6dfI/f/IKcEe.6jcJmTR9Qh5tVlM8Hq2FQvVQZQjvOxq';

async function verify(plain: string, stored: string): Promise<boolean> {
  if (!looksHashed(stored)) {
    await bcrypt.compare(plain, DUMMY_HASH);
    return false;
  }
  return bcrypt.compare(plain, stored);
}

/**
 * Authentication.
 *
 * Two separate login endpoints issue separate tokens, the token is signed and
 * verified server-side, and the role inside it is the only role the API will
 * ever trust.
 *
 * Passwords are bcrypt hashes verified in constant time. This replaced a
 * plaintext comparison that the prototype used deliberately and flagged as
 * unsafe; a row still holding plaintext is now rejected outright rather than
 * accepted, so an un-migrated database locks its users out instead of
 * authenticating them against a readable password.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly db: DatabaseService,
    private readonly jwt: JwtService,
  ) {}

  /** POST /auth/admin/login — staff only. A client's credentials will not work here. */
  async loginStaff(email: string, password: string): Promise<LoginResult> {
    const staff = await this.db.staffUsers.findOne(
      (row) => row.email.toLowerCase() === email.trim().toLowerCase(),
    );
    if (!staff || !(await verify(password, staff.password_hash))) {
      // One message for "no such account" and "wrong password" alike, so this
      // endpoint cannot be used to find out which addresses are registered.
      throw new UnauthorizedException('Incorrect email or password');
    }

    return this.issue({
      id: staff.id,
      kind: 'Staff',
      role: staff.role,
      name: staff.name,
      email: staff.email,
    });
  }

  /** POST /auth/portal/login — clients only. Staff credentials will not work here. */
  async loginClient(email: string, password: string): Promise<LoginResult> {
    const client = await this.db.clients.findOne(
      (row) => row.email.toLowerCase() === email.trim().toLowerCase(),
    );
    if (!client || !(await verify(password, client.password_hash))) {
      throw new UnauthorizedException('Incorrect email or password');
    }

    return this.issue({
      id: client.id,
      kind: 'Client',
      role: 'Client',
      name: client.name,
      email: client.email,
    });
  }

  private async issue(principal: AuthPrincipal): Promise<LoginResult> {
    const payload: JwtPayload = {
      sub: principal.id,
      kind: principal.kind,
      role: principal.role,
      name: principal.name,
      email: principal.email,
    };
    return {
      access_token: await this.jwt.signAsync(payload),
      user: principal,
    };
  }
}
