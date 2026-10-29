-- CreateTable
CREATE TABLE "project_quotes" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "title" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "amount" DECIMAL(12,2) NOT NULL,
    "vat_rate" DECIMAL(5,2) NOT NULL,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "valid_until" TIMESTAMPTZ(6),
    "notes" TEXT,
    "sent_at" TIMESTAMPTZ(6),
    "responded_at" TIMESTAMPTZ(6),
    "response_comment" TEXT,
    "invoice_id" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_quote_items" (
    "id" TEXT NOT NULL,
    "quote_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "section" TEXT,
    "detail" TEXT,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "project_quote_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "project_quotes_number_key" ON "project_quotes"("number");

-- CreateIndex
CREATE INDEX "project_quotes_client_id_idx" ON "project_quotes"("client_id");

-- CreateIndex
CREATE INDEX "project_quotes_project_id_idx" ON "project_quotes"("project_id");

-- CreateIndex
CREATE INDEX "project_quote_items_quote_id_idx" ON "project_quote_items"("quote_id");

-- AddForeignKey
ALTER TABLE "project_quote_items" ADD CONSTRAINT "project_quote_items_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "project_quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
