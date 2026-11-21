-- Quote presets: a named set of lines (with cost and margin), VAT, discount, title and notes that the Admin
-- starts a new quote from. New table only. "body" is JSONB because it is only ever read whole and copied
-- into a quote, where POST /quotes validates and prices it again in decimals.
CREATE TABLE "quote_presets" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "body" JSONB NOT NULL,
    "created_by" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "quote_presets_pkey" PRIMARY KEY ("id")
);
