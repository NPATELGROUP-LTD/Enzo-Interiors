-- Quote maker: saved designs, and the design behind a project quote. New table and a nullable column only.
-- design is JSONB (walls and the units on them), edited and drawn as one thing; template and item ids
-- inside are checked by the API on save and again when pricing.
CREATE TABLE "quote_designs" (
    "id" TEXT NOT NULL,
    "ref_no" SERIAL NOT NULL,
    "source" TEXT NOT NULL,
    "title" TEXT,
    "room_type" TEXT NOT NULL,
    "design" JSONB NOT NULL,
    "answers" JSONB,
    "estimate_low" DECIMAL(12,2),
    "estimate_high" DECIMAL(12,2),
    "enquiry_id" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "quote_designs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "quote_designs_source_check" CHECK ("source" IN ('web', 'staff')),
    CONSTRAINT "quote_designs_estimate_check" CHECK ("estimate_low" IS NULL OR "estimate_high" IS NULL OR "estimate_low" <= "estimate_high"),
    CONSTRAINT "quote_designs_enquiry_id_fkey" FOREIGN KEY ("enquiry_id") REFERENCES "contact_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "quote_designs_ref_no_key" ON "quote_designs"("ref_no");
CREATE INDEX "quote_designs_enquiry_id_idx" ON "quote_designs"("enquiry_id");
CREATE INDEX "quote_designs_created_at_idx" ON "quote_designs"("created_at");

ALTER TABLE "project_quotes" ADD COLUMN "design_id" TEXT;
ALTER TABLE "project_quotes" ADD CONSTRAINT "project_quotes_design_id_fkey" FOREIGN KEY ("design_id") REFERENCES "quote_designs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "project_quotes_design_id_idx" ON "project_quotes"("design_id");
