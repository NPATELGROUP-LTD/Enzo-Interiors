-- Per-type notification choices for portal clients: { project|invoice|document|message:
-- { in_app, email, push } }. Additive only: one nullable column, so the previous
-- release still runs against this schema (docs/prelaunch.md). Null = the defaults,
-- computed on read (modules/notifications/preferences.ts), so no row is rewritten.

-- AlterTable
ALTER TABLE "notification_preferences" ADD COLUMN     "categories" JSONB;
