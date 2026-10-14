-- Two-step sign-in, remembered devices, Sign in with Google and the Google
-- Calendar copy of bookings. Additive only: new tables and nullable/defaulted
-- columns, so the previous release still runs against this schema
-- (docs/prelaunch.md).

-- AlterTable
ALTER TABLE "staff_users" ADD COLUMN     "google_email" TEXT,
ADD COLUMN     "google_sub" TEXT,
ADD COLUMN     "login_code_attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "login_code_expires_at" TIMESTAMPTZ(6),
ADD COLUMN     "login_code_hash" TEXT,
ADD COLUMN     "recovery_hashes" JSONB,
ADD COLUMN     "totp_confirmed_at" TIMESTAMPTZ(6),
ADD COLUMN     "totp_last_step" INTEGER,
ADD COLUMN     "totp_secret_enc" TEXT,
ADD COLUMN     "two_factor_method" TEXT;

-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "calendar_connection_id" TEXT,
ADD COLUMN     "google_calendar_id" TEXT,
ADD COLUMN     "google_event_id" TEXT;

-- CreateTable
CREATE TABLE "trusted_devices" (
    "id" TEXT NOT NULL,
    "staff_user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "label" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "trusted_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_connections" (
    "id" TEXT NOT NULL,
    "staff_user_id" TEXT,
    "google_email" TEXT NOT NULL,
    "calendar_id" TEXT NOT NULL DEFAULT 'primary',
    "calendar_name" TEXT,
    "refresh_token_enc" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'connected',
    "connected_by" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calendar_connections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "trusted_devices_token_hash_key" ON "trusted_devices"("token_hash");

-- CreateIndex
CREATE INDEX "trusted_devices_staff_user_id_idx" ON "trusted_devices"("staff_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "staff_users_google_sub_key" ON "staff_users"("google_sub");

