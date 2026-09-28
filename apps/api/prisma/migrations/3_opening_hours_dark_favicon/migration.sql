-- Opening hours (Settings › Opening hours) and a favicon for dark mode.
-- Additive only: two nullable columns, no default, so no existing row is
-- rewritten and the previous release still runs against this schema
-- (docs/prelaunch.md). Null opening_hours = the company record's hours.

-- AlterTable
ALTER TABLE "site_settings" ADD COLUMN     "favicon_dark_id" TEXT,
ADD COLUMN     "opening_hours" JSONB;
