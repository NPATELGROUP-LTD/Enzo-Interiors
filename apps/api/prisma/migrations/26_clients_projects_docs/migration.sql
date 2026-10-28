-- Phase 4: default portal password flag, a project's site address, document categories and
-- per-document download permission. Additive only (nullable or defaulted, no existing row
-- rewritten) so the previous release still runs against this schema.

-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "password_is_default" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "site_address" TEXT;

-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "category" TEXT,
ADD COLUMN     "client_can_download" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "site_settings" ADD COLUMN     "document_categories" JSONB;
