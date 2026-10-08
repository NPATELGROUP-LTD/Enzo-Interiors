-- The printed invoice layout: a job block (name, address, notes), a fixed £
-- discount taken before VAT, a payment schedule (display only), and per-line
-- section headings and a second "description" column.
-- Additive only: nullable columns, or NOT NULL with a constant default (no
-- table rewrite on PostgreSQL 11+), so the previous release still runs on
-- this schema (docs/prelaunch.md). Existing invoices read as discount 0 and an
-- empty schedule, which leaves every stored amount exactly as it was.

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN "discount" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "invoices" ADD COLUMN "job_name" TEXT;
ALTER TABLE "invoices" ADD COLUMN "job_address" TEXT;
ALTER TABLE "invoices" ADD COLUMN "job_notes" TEXT;
ALTER TABLE "invoices" ADD COLUMN "payment_schedule" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "invoice_items" ADD COLUMN "section" TEXT;
ALTER TABLE "invoice_items" ADD COLUMN "detail" TEXT;
