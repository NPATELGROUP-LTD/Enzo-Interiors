-- Password reset + session revocation.
ALTER TABLE "staff_users" ADD COLUMN "reset_expires_at" TIMESTAMPTZ(6),
ADD COLUMN "reset_token_hash" TEXT,
ADD COLUMN "token_version" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX "staff_users_reset_token_hash_key" ON "staff_users"("reset_token_hash");

-- Enquiries from the site's three forms.
ALTER TABLE "contact_submissions" ADD COLUMN "details" JSONB,
ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'contact';

-- Every image now lives in the public bucket. The rows the content import
-- created pointed at apps/web/public or a third-party URL through `src`; their
-- files are uploaded by the same import under site/{id}.{ext}, so the key is
-- derivable. Uploaded rows already have a key and are left alone.
UPDATE "media_assets"
SET "storage_key" = 'site/' || "id" || CASE WHEN "id" LIKE 'logo-%' THEN '.png' ELSE '.jpg' END
WHERE "storage_key" IS NULL;

UPDATE "media_assets" SET "source" = 'site' WHERE "source" = 'local';

ALTER TABLE "media_assets" DROP COLUMN "src",
ALTER COLUMN "storage_key" SET NOT NULL;

-- General site settings: one row, id 'site', created on first read.
CREATE TABLE "site_settings" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'coming_soon',
    "launch_at" TIMESTAMPTZ(6),
    "notification_emails" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by" TEXT,

    CONSTRAINT "site_settings_pkey" PRIMARY KEY ("id")
);
