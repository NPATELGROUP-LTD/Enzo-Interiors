/**
 * Makes an existing account the Infra manager, for the first one (after that an
 * Infra manager invites the next from Settings › Users):
 *
 *     npm run auth:make-infra -- someone@example.com
 *     docker compose run --rm seed npm run auth:make-infra -- someone@example.com
 *
 * The person must already have an account (invite them as anything first, or
 * use an existing sign-in). Their role changes and every session they hold is
 * signed out, so they sign in again as an Infra manager. An Infra manager sees
 * no client, project, invoice, document, message, enquiry or booking.
 */

import { isEmail } from 'class-validator';

import { ActivityLogService } from '../src/core/activity-log.service';
import { DatabaseService } from '../src/data/database.service';
import { PrismaService } from '../src/data/prisma.service';

async function main(): Promise<void> {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email || !isEmail(email)) {
    console.error('Usage: npm run auth:make-infra -- <email>');
    process.exit(1);
  }

  const prisma = new PrismaService();
  const db = new DatabaseService(prisma);
  await prisma.$connect();
  try {
    const staff = await db.staffUsers.findOne((row) => row.email.toLowerCase() === email);
    if (!staff) {
      console.error(`No account for ${email}. Invite them from Settings › Users first.`);
      process.exitCode = 1;
      return;
    }
    if (staff.role === 'Infra') {
      console.log(`${staff.email} is already an Infra manager.`);
      return;
    }
    if (staff.role === 'Admin' && (await db.staffUsers.count((row) => row.role === 'Admin')) <= 1) {
      console.error(`${staff.email} is the only Admin. Make someone else an Admin first, or use a different account for Infra.`);
      process.exitCode = 1;
      return;
    }
    await db.staffUsers.update(staff.id, {
      role: 'Infra',
      token_version: staff.token_version + 1,
      updated_at: new Date().toISOString(),
    });
    // Nobody is signed in to a script, so the account itself stands in as the actor.
    await new ActivityLogService(db).record({
      principal: { id: staff.id, kind: 'Staff', role: 'Infra', name: 'make-infra script', email: staff.email },
      action: 'staff_role_change',
      targetTable: 'staff_users',
      targetId: staff.id,
      details: { name: staff.name, from: staff.role, to: 'Infra', via: 'script' },
    });
    console.log(`${staff.email} is now an Infra manager (was ${staff.role}). They are signed out everywhere.`);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
