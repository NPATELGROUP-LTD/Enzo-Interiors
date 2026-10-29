-- Several designers and installers per project. A row here grants the project
-- (AccessService.projectScope); projects.assigned_designer_id / assigned_installer_id
-- stay as a fallback and mirror the first designer / installer, and
-- `npm run team:backfill` copies existing ones in. Additive only: one new table,
-- its indexes and two foreign keys to tables that are not altered, so the previous
-- release still runs against this schema (docs/prelaunch.md). The table is empty,
-- so the indexes are built at once.

-- CreateTable
CREATE TABLE "project_members" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "added_by" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_members_staff_id_idx" ON "project_members"("staff_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_members_project_id_staff_id_role_key" ON "project_members"("project_id", "staff_id", "role");

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
