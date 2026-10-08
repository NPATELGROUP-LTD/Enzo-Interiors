import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import type { AddressInfo } from 'node:net';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { PrismaClient } from '@prisma/client';

export const ADMIN = { email: 'admin@test.enzo.local', password: 'test-admin-password-123' };

/**
 * Boots the real AppModule on a random port against a real PostgreSQL test
 * database, and returns its base URL and a close function.
 *
 * Safety: the database name must end in `_test` or this throws before touching
 * anything. Locally it is `enzo_test` on the same server as `.env`'s DATABASE_URL
 * (created on first use); in CI set DATABASE_URL to the service container.
 */
export async function startTestApp(): Promise<{ url: string; nest: NestExpressApplication; close: () => Promise<void> }> {
  if (existsSync('.env')) process.loadEnvFile('.env'); // never overrides what is already set
  const base = new URL(process.env.DATABASE_URL ?? '');
  if (!base.pathname.endsWith('_test')) base.pathname = '/enzo_test';
  const dbName = base.pathname.slice(1);
  if (!dbName.endsWith('_test')) throw new Error('Refusing to run against a non-test database.');
  process.env.DATABASE_URL = base.toString();

  // Create the database once (connect to the maintenance db to do it).
  const maintenance = new URL(base);
  maintenance.pathname = '/postgres';
  const root = new PrismaClient({ datasourceUrl: maintenance.toString() });
  try {
    const found = await root.$queryRaw<unknown[]>`SELECT 1 FROM pg_database WHERE datname = ${dbName}`;
    if (found.length === 0) await root.$executeRawUnsafe(`CREATE DATABASE "${dbName}"`);
  } finally {
    await root.$disconnect();
  }
  execSync('npx prisma migrate deploy', { stdio: 'pipe', env: process.env });

  // The test environment: password-only sign-in, no Redis, no real mail.
  Object.assign(process.env, {
    DISABLE_2FA: 'true',
    ADMIN_EMAIL: ADMIN.email,
    ADMIN_PASSWORD: ADMIN.password,
    // Empty, not deleted: ConfigModule.forRoot reloads .env into process.env
    // for any key that is missing, which would bring Redis and SMTP back.
    REDIS_URL: '',
    SMTP_HOST: '',
  });

  const { AppModule } = await import('../app.module'); // after env is set: modules read it at import
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: ['error'] });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.listen(0, '127.0.0.1');
  const { port } = app.getHttpServer().address() as AddressInfo;
  // `nest` lets a test reach a provider, e.g. to read the email it would have sent.
  return { url: `http://127.0.0.1:${port}`, nest: app, close: () => app.close() };
}
