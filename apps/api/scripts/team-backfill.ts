/**
 * Copies each project's single designer / installer (the old
 * `projects.assigned_designer_id` / `assigned_installer_id`) into
 * `project_members`, the team table. Safe to run any number of times: anyone
 * already on a project is skipped. Reads work without it (the old columns still
 * grant access), so run it once after the release and whenever you like.
 *
 *     npm run team:backfill
 *     docker compose run --rm seed npm run team:backfill
 */

import { PrismaService } from '../src/data/prisma.service';
import { TeamStore } from '../src/data/team-store';

async function main(): Promise<void> {
  const prisma = new PrismaService();
  await prisma.$connect();
  try {
    const added = await new TeamStore(prisma).backfill();
    console.log(`Team backfill: ${added} member${added === 1 ? '' : 's'} added.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
