-- The daily summary email (modules/infra): on by default, and the London day it last went out
-- on, so a restart after 08:00 does not send it twice. Additive only, so the previous release
-- still runs against this schema.

-- AlterTable
ALTER TABLE "alert_settings" ADD COLUMN "digest_on" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "alert_settings" ADD COLUMN "digest_day" TEXT;
