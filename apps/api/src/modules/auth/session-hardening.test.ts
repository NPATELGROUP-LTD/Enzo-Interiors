import assert from 'node:assert/strict';
import { test } from 'node:test';

import { JwtService } from '@nestjs/jwt';

import { authenticate } from '../../common/guards/jwt-auth.guard';
import { AuthPrincipal } from '../../common/types/principal';
import { ActivityLogService } from '../../core/activity-log.service';
import { MailService } from '../../core/mail.service';
import { RateLimitStore } from '../../core/rate-limit';
import { DatabaseService } from '../../data/database.service';
import { NotificationsService } from '../notifications/notifications.module';
import { AuthService, hashPassword } from './auth.service';
import { UsersService } from './users';

const jwt = new JwtService({ secret: 'test-secret-that-is-at-least-32-characters' });

/** One staff row with just the repository methods these two services touch. */
function setup(fields: Record<string, unknown> = {}) {
  const row: Record<string, unknown> = {
    id: 's1', name: 'Neel', email: 'neel@example.com', role: 'Admin', token_version: 3, password_hash: 'x',
    two_factor_method: 'totp', ...fields,
  };
  const db = {
    staffUsers: {
      findById: async () => ({ ...row }),
      update: async (_id: string, patch: object) => Object.assign(row, patch),
    },
    trustedDevices: { deleteMany: async () => 0 },
  } as unknown as DatabaseService;
  const mail = { enabled: false, send: async () => false } as unknown as MailService;
  const limits = new RateLimitStore();
  const activity = { record: async () => undefined } as unknown as ActivityLogService;
  return {
    row,
    auth: new AuthService(db, jwt, mail, limits),
    users: new UsersService(db, mail, activity, limits, {} as unknown as NotificationsService),
    sign: (tv: number) => jwt.signAsync({ sub: 's1', kind: 'Staff', role: 'Admin', name: 'Neel', email: 'neel@example.com', tv }),
    authenticate: (token: string) => authenticate(jwt, db, token),
    done: () => limits.onApplicationShutdown(),
  };
}

const principal: AuthPrincipal = { id: 's1', kind: 'Staff', role: 'Admin', name: 'Neel', email: 'Neel@Example.com' };

test('resetting 2FA signs out a token issued before it (and the sockets that read it)', async () => {
  const t = setup();
  const token = await t.sign(3);
  assert.equal((await t.authenticate(token)).id, 's1');

  // s1 is an Admin, so only an Infra manager may reset it.
  await t.users.resetTwoFactor({ ...principal, id: 'infra-1', role: 'Infra' }, 's1');

  assert.equal(t.row.token_version, 4);
  assert.equal(t.row.two_factor_method, null);
  await assert.rejects(t.authenticate(token), /Invalid or expired session token/);
  assert.equal((await t.authenticate(await t.sign(4))).id, 's1');
  t.done();
});

test('wrong current passwords lock the change-password form like a wrong sign-in', async () => {
  const t = setup({ password_hash: await hashPassword('the-right-password') });

  for (let i = 0; i < 5; i++) {
    await assert.rejects(t.auth.changePassword(principal, 'wrong-guess', 'a-new-password-1', 'ip1'), /current password is not correct/);
  }
  // Locked: even the right password is refused until the pause is over, and nothing changed.
  await assert.rejects(t.auth.changePassword(principal, 'the-right-password', 'a-new-password-1', 'ip1'), /Too many attempts/);
  assert.equal(t.row.token_version, 3);
  t.done();
});

test('refresh renews a live session, keeps its sign-in time, and stops 12h after sign-in', async () => {
  const t = setup();
  const claims = { sub: 's1', kind: 'Staff', role: 'Admin', name: 'Neel', email: 'neel@example.com', tv: 3 };
  const now = Math.floor(Date.now() / 1000);

  const fresh = await t.auth.refresh(principal, await jwt.signAsync({ ...claims, at: now - 3600 }));
  assert.equal((await t.authenticate(fresh.access_token)).id, 's1');
  assert.equal((jwt.decode(fresh.access_token) as { at: number }).at, now - 3600);

  const stale = await jwt.signAsync({ ...claims, at: now - 13 * 3600 });
  await assert.rejects(t.auth.refresh(principal, stale), /session has expired/);

  // Revocation still wins: the guard refuses a bumped token_version before refresh is reached.
  t.row.token_version = 4;
  await assert.rejects(t.authenticate(fresh.access_token), /Invalid or expired session token/);
  t.done();
});
