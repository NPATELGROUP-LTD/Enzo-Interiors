-- Consultation bookings, the admin bell, editor review requests and brand
-- images. Additive only: new tables and nullable/defaulted columns, so the
-- previous release still runs against this schema (docs/prelaunch.md).

-- AlterTable
ALTER TABLE "cms_entries" ADD COLUMN     "review_at" TIMESTAMPTZ(6),
ADD COLUMN     "review_by" TEXT,
ADD COLUMN     "review_note" TEXT;

-- AlterTable
ALTER TABLE "site_settings" ADD COLUMN     "favicon_id" TEXT,
ADD COLUMN     "logo_dark_id" TEXT DEFAULT 'logo-white',
ADD COLUMN     "logo_light_id" TEXT DEFAULT 'logo-forest';

-- CreateTable
CREATE TABLE "booking_settings" (
    "id" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by" TEXT,

    CONSTRAINT "booking_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "service_label" TEXT NOT NULL,
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6) NOT NULL,
    "slot" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Confirmed',
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "postcode" TEXT,
    "notes" TEXT,
    "details" JSONB,
    "source" TEXT NOT NULL,
    "created_by" TEXT,
    "cancelled_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "recipient_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "read_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "appointments_reference_key" ON "appointments"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "appointments_slot_key" ON "appointments"("slot");

-- CreateIndex
CREATE INDEX "appointments_starts_at_idx" ON "appointments"("starts_at");

-- CreateIndex
CREATE INDEX "notifications_recipient_id_created_at_idx" ON "notifications"("recipient_id", "created_at");

