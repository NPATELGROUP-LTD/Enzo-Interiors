-- Per-invoice permission for a client to download or print it from the portal. Defaulted false:
-- existing invoices become view-only for clients until an Admin allows them. Additive only.

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "client_can_download" BOOLEAN NOT NULL DEFAULT false;
