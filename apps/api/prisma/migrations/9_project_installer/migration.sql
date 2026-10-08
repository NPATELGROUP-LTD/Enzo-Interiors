-- Projects get an installer as well as a designer. Either assignment gives a
-- Designer-role user access to the project (common/access/access.service.ts).
-- Additive only: one nullable column (no table rewrite) and its index, so the
-- previous release still runs against this schema (docs/prelaunch.md). The
-- projects table is small; on a large one, build the index CONCURRENTLY by hand.

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "assigned_installer_id" TEXT;

-- CreateIndex
CREATE INDEX "projects_assigned_installer_id_idx" ON "projects"("assigned_installer_id");
