import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { AuthPrincipal, JwtPayload } from '../../common/types/principal';
import { DatabaseService } from '../../data/database.service';

export interface LoginResult {
  access_token: string;
  user: AuthPrincipal;
}

/**
 * Mock authentication.
 *
 * ------------------------------------------------------------------------
 * NOT PRODUCTION-SAFE. Passwords are compared as PLAINTEXT against the
 * seeded JSON files, exactly as the prototype brief specifies. Before this
 * goes anywhere real, `password_hash` must hold a genuine bcrypt/argon2
 * hash and this comparison must become a constant-time verify.
 * ------------------------------------------------------------------------
 *
 * Everything else about the flow is real: two separate login endpoints issue
 * separate tokens, the token is signed and verified server-side, and the role
 * inside it is the only role the API will ever trust.
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
    // MOCK ONLY — plaintext comparison, see the class comment.
    if (!staff || staff.password_hash !== password) {
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
    // MOCK ONLY — plaintext comparison, see the class comment.
    if (!client || client.password_hash !== password) {
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
