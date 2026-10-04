-- Settings › Pages: which public pages are switched on.
-- Additive only: one nullable column, no default, so no existing row is
-- rewritten and the previous release still runs against this schema
-- (docs/prelaunch.md). Null = the defaults in site-settings/pages.ts.

-- AlterTable
ALTER TABLE "site_settings" ADD COLUMN     "pages" JSONB;
