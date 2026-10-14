-- Settings › Project stages: the Admin's ordered list of project stages.
-- Additive only: one nullable column, no default, so no existing row is
-- rewritten and the previous release still runs against this schema
-- (docs/prelaunch.md). Null = the default five in projects/stages.ts.

-- AlterTable
ALTER TABLE "site_settings" ADD COLUMN     "project_stages" JSONB;
