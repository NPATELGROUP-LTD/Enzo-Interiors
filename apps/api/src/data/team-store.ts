import { randomUUID } from 'node:crypto';

import { PrismaService } from './prisma.service';

/**
 * Copies the single designer / installer a project used to have
 * (`projects.assigned_designer_id` / `assigned_installer_id`) into
 * `project_members`. Idempotent: someone already on the project in that role is
 * skipped, so `npm run team:backfill` and the lazy per-project call in
 * TeamService can run in any order, any number of times.
 */
export class TeamStore {
  constructor(private readonly prisma: PrismaService) {}

  /** One project, or every project when `projectId` is left out. Returns how many rows were added. */
  async backfill(projectId?: string): Promise<number> {
    const projects = await this.prisma.project.findMany({
      where: {
        ...(projectId ? { id: projectId } : {}),
        OR: [{ assigned_designer_id: { not: null } }, { assigned_installer_id: { not: null } }],
      },
      select: { id: true, assigned_designer_id: true, assigned_installer_id: true },
    });
    const wanted: Array<{ project_id: string; staff_id: string; role: string }> = [];
    for (const project of projects) {
      if (project.assigned_designer_id) wanted.push({ project_id: project.id, staff_id: project.assigned_designer_id, role: 'Designer' });
      if (project.assigned_installer_id) wanted.push({ project_id: project.id, staff_id: project.assigned_installer_id, role: 'Installer' });
    }
    // A person deleted since would break the foreign key; they have nothing to keep.
    const alive = new Set(
      (await this.prisma.staffUser.findMany({ where: { id: { in: wanted.map((row) => row.staff_id) } }, select: { id: true } })).map((row) => row.id),
    );
    const { count } = await this.prisma.projectMember.createMany({
      data: wanted.filter((row) => alive.has(row.staff_id)).map((row) => ({ ...row, id: randomUUID() })),
      skipDuplicates: true,
    });
    return count;
  }
}
