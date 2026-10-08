import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { test } from 'node:test';

import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { StaffUser } from '../../common/types/domain';
import { seal } from '../../core/crypto';
import { Mail, MailService } from '../../core/mail.service';
import { RateLimitStore } from '../../core/rate-limit';
import { DatabaseService } from '../../data/database.service';
import { AuthService, maskEmail } from './auth.service';
import { base32Decode, base32Encode, totp, totpStep } from './totp';
import { TwoFactorService, TwoFactorStep, deviceLabel, normaliseRecovery } from './two-factor';

const jwt = new JwtService({ secret: 'test-secret-that-is-at-least-32-characters' });

test('a 2FA challenge (or any purpose token) is never a session', async () => {
  const staff = { id: 's1', role: 'Admin', name: 'A', email: 'a@x.com', token_version: 0 };
  const guard = new JwtAuthGuard(
    jwt,
    { getAllAndOverride: () => false } as unknown as Reflector,
    { staffUsers: { findById: async () => staff } } as unknown as DatabaseService,
  );
  const call = (token: string) =>
    guard.canActivate({
      getType: () => 'http',
      getHandler: () => null,
      getClass: () => null,
      switchToHttp: () => ({ getRequest: () => ({ headers: { authorization: `Bearer ${token}` } }) }),
    } as unknown as ExecutionContext);

  const session = { sub: 's1', kind: 'Staff', role: 'Admin', name: 'A', email: 'a@x.com', tv: 0 };
  assert.equal(await call(await jwt.signAsync(session)), true);
  await assert.rejects(call(await jwt.signAsync({ ...session, purpose: '2fa' })));
  await assert.rejects(call(await jwt.signAsync({ sub: 's1', tv: 0, purpose: '2fa' })));
});

test('helpers: masked email, device label, recovery code as typed', () => {
  assert.equal(maskEmail('neel@outlook.com'), 'n***@outlook.com');
  assert.equal(
    deviceLabel('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36 Edg/140.0'),
    'Edge on Windows',
  );
  assert.equal(
    deviceLabel('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'),
    'Safari on iPhone',
  );
  assert.equal(deviceLabel('curl/8.0'), 'curl/8.0');
  assert.equal(deviceLabel(undefined), null);
  assert.equal(normaliseRecovery(' ABCD-efgh '), normaliseRecovery('abcdefgh'));
});

/* ---- The service, over one in-memory staff row ---- */

/** One staff row with the repository methods two-factor.ts uses, updateWhere matching like SQL would. */
function setup(fields: Partial<StaffUser>, smtp = true) {
  const row: Record<string, unknown> = {
    id: 's1', name: 'Neel', email: 'neel@example.com', role: 'Admin', token_version: 0, password_hash: 'x',
    two_factor_method: null, totp_secret_enc: null, totp_last_step: null, recovery_hashes: [],
    login_code_hash: null, login_code_expires_at: null, login_code_attempts: 0, ...fields,
  };
  const matches = (where: Record<string, unknown>): boolean =>
    Object.entries(where).every(([key, want]) => {
      if (key === 'OR') return (want as Array<Record<string, unknown>>).some(matches);
      if (want && typeof want === 'object' && 'lt' in want) return row[key] != null && (row[key] as number) < (want as { lt: number }).lt;
      if (want && typeof want === 'object' && 'equals' in want) return JSON.stringify(row[key]) === JSON.stringify((want as { equals: unknown }).equals);
      return (row[key] ?? null) === want;
    });
  const db = {
    staffUsers: {
      findById: async () => ({ ...row }),
      update: async (_id: string, patch: object) => Object.assign(row, patch),
      updateWhere: async (where: Record<string, unknown>, patch: object) => (matches(where) ? (Object.assign(row, patch), 1) : 0),
    },
  } as unknown as DatabaseService;
  const mails: Mail[] = [];
  const mail = { enabled: smtp, send: async (m: Mail) => (mails.push(m), true) } as unknown as MailService;
  const limits = new RateLimitStore();
  const service = new TwoFactorService(db, jwt, mail, limits, new AuthService(db, jwt, mail, limits));
  const lastCode = () => /code is (\d{6})/.exec(mails.at(-1)?.text ?? '')?.[1] ?? '';
  const begin = async () => (await service.begin({ ...row } as unknown as StaffUser, 'ip')) as TwoFactorStep;
  return { row, mails, service, lastCode, begin, done: () => limits.onApplicationShutdown() };
}

test('email codes: racing guesses spend attempts before comparing, and a code works once', async () => {
  const t = setup({ two_factor_method: 'email' });
  const { challenge } = await t.begin();
  const code = t.lastCode();
  const wrong = code === '000000' ? '111111' : '000000';

  const results = await Promise.allSettled(Array.from({ length: 8 }, (_, i) => t.service.verify(challenge, wrong, `ip${i}`)));
  assert.ok(results.every((r) => r.status === 'rejected'));
  assert.ok((t.row.login_code_attempts as number) <= 5, 'never more than five comparisons');

  await t.begin();
  const fresh = t.lastCode();
  const both = await Promise.allSettled([t.service.verify(challenge, fresh, 'a'), t.service.verify(challenge, fresh, 'b')]);
  assert.equal(both.filter((r) => r.status === 'fulfilled').length, 1, 'the same code twice at once signs in once');

  // Five misses burn a code.
  await t.begin();
  const next = t.lastCode();
  for (let i = 0; i < 4; i++) await assert.rejects(t.service.verify(challenge, wrong, `m${i}`), /not right/);
  await assert.rejects(t.service.verify(challenge, wrong, 'm4'), /Sign in again/);
  await assert.rejects(t.service.verify(challenge, next, 'm5'), /Sign in again/);
  t.done();
});

test('the sign-in form emails at most three codes per 15 minutes, and still moves on', async () => {
  const t = setup({ two_factor_method: 'email' });
  for (let i = 0; i < 5; i++) assert.equal((await t.begin()).twoFactor, 'email');
  assert.equal(t.mails.length, 3);
  t.done();
});

test('20 wrong codes in a day pause code checks for the account and email its owner once', async () => {
  process.env.APP_ENCRYPTION_KEY = randomBytes(32).toString('base64');
  const secret = base32Encode(randomBytes(20));
  const t = setup({ two_factor_method: 'totp', totp_secret_enc: seal(secret) });
  const { challenge } = await t.begin();
  for (let i = 0; i < 20; i++) await assert.rejects(t.service.verify(challenge, 'zzzz-zzzz', `ip${i}`), /not right/);
  await assert.rejects(t.service.verify(challenge, 'zzzz-zzzz', 'ip20'), /Too many wrong codes. Try again later/);
  const right = totp(base32Decode(secret), totpStep());
  await assert.rejects(t.service.verify(challenge, right, 'ip21'), /Too many wrong codes. Try again later/, 'not even compared');
  assert.equal(t.mails.filter((m) => m.subject.startsWith('Wrong sign-in codes')).length, 1);
  t.done();
});

test('an authenticator app can only be added after the emailed code', async () => {
  process.env.APP_ENCRYPTION_KEY = randomBytes(32).toString('base64');
  const t = setup({});
  const { challenge, twoFactor } = await t.begin();
  assert.equal(twoFactor, 'enrol');
  await assert.rejects(t.service.enrolAppConfirm(challenge, '123456', 'ip'), /emailed code first/);

  assert.deepEqual(await t.service.enrolAppStart(challenge), { emailHint: 'n***@example.com' });
  await assert.rejects(t.service.enrolAppSecret(challenge, t.lastCode() === '000000' ? '111111' : '000000', 'ip'), /not right/);
  const { secret, otpauthUrl } = await t.service.enrolAppSecret(challenge, t.lastCode(), 'ip');
  assert.match(otpauthUrl, /^otpauth:\/\/totp\/Enzo%20Interiors:neel%40example\.com\?secret=/);

  const signedIn = await t.service.enrolAppConfirm(challenge, totp(base32Decode(secret), totpStep()), 'ip');
  assert.equal(signedIn.recoveryCodes?.length, 10);
  assert.equal(t.row.two_factor_method, 'totp');
  assert.ok(t.mails.some((m) => m.subject === 'Authenticator app added to your Enzo account'));
  t.done();
});

test('with SMTP unset the code is logged, not a 503; without a key, app setup stops before emailing', async () => {
  const offline = setup({ two_factor_method: 'email' }, false);
  assert.equal((await offline.begin()).twoFactor, 'email');
  assert.equal(offline.mails.length, 0);
  assert.ok(offline.row.login_code_hash, 'a code was still made');
  offline.done();

  const saved = process.env.APP_ENCRYPTION_KEY;
  delete process.env.APP_ENCRYPTION_KEY;
  try {
    const t = setup({});
    const { challenge } = await t.begin();
    await assert.rejects(t.service.enrolAppStart(challenge), /not set up on this server/);
    await assert.rejects(t.service.enrolAppSecret(challenge, '123456', 'ip'), /not set up on this server/);
    assert.equal(t.mails.length, 0);
    assert.equal(t.row.login_code_attempts, 0, 'no code attempt spent');
    t.done();
  } finally {
    if (saved !== undefined) process.env.APP_ENCRYPTION_KEY = saved;
  }
});
