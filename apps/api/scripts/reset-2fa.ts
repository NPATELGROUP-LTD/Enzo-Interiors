/**
 * Clears someone's two-step sign-in, for when the only Admin has lost their
 * phone or inbox and nobody is left to do it from Settings › Users:
 *
 *     npm run auth:reset-2fa -- someone@example.com
 *     docker compose run --rm seed npm run auth:reset-2fa -- someone@example.com
 *
 * They choose a method again at their next sign-in; every remembered browser
 * and the Google link are forgotten, and the wrong-code pause is lifted (with
 * REDIS_URL set; otherwise that counter lives in the API process anyway).
 * Their password is untouched.
 */

import { DatabaseService } from '../src/data/database.service';
import { PrismaService } from '../src/data/prisma.service';
import { RateLimitStore } from '../src/core/rate-limit';
import { NO_TWO_FACTOR, codeFailuresKey } from '../src/modules/auth/two-factor';

async function main(): Promise<void> {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error('Usage: npm run auth:reset-2fa -- <email>');
    process.exit(1);
  }

  const prisma = new PrismaService();
  const db = new DatabaseService(prisma);
  await prisma.$connect();
  try {
    const staff = await db.staffUsers.findOne((row) => row.email.toLowerCase() === email);
    if (!staff) {
      console.error(`No account for ${email}.`);
      process.exitCode = 1;
      return;
    }
    await db.staffUsers.update(staff.id, { ...NO_TWO_FACTOR, updated_at: new Date().toISOString() });
    const devices = await db.trustedDevices.deleteMany((row) => row.staff_user_id === staff.id);
    const limits = new RateLimitStore();
    // Its commands fail fast until Redis is connected, so give it a moment.
    await new Promise((resolve) => {
      setTimeout(resolve, 5_000).unref();
      if (limits.redis) limits.redis.once('ready', resolve);
      else resolve(null);
    });
    await limits.clear(codeFailuresKey(staff.id));
    limits.onApplicationShutdown();
    console.log(`Two-step sign-in and Google link cleared for ${staff.email}; ${devices} remembered device(s) forgotten.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('\nReset failed:\n', error);
  process.exit(1);
});
