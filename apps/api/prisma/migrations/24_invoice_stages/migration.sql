-- Payment stages of an invoice (modules/invoices/stages.ts) and the global bank-details block
-- printed on invoices (Settings > Bank details). Additive only, so the previous release still
-- runs against this schema: an invoice without stages behaves exactly as before.

-- CreateTable
CREATE TABLE "invoice_stages" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "label" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "due_note" TEXT,
    "paid_at" TIMESTAMPTZ(6),
    "paid_by" TEXT,

    CONSTRAINT "invoice_stages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invoice_stages_invoice_id_position_key" ON "invoice_stages"("invoice_id", "position");

-- AddForeignKey
ALTER TABLE "invoice_stages" ADD CONSTRAINT "invoice_stages_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "site_settings" ADD COLUMN "bank_details" JSONB;
