-- Inventory items become the one material record the quote maker shares: sizes, finish and what the
-- website may show. Only adds nullable or defaulted columns, CHECKs on them and one FK (set null).
ALTER TABLE "inventory_items"
    ADD COLUMN "length_mm" INTEGER,
    ADD COLUMN "width_mm" INTEGER,
    ADD COLUMN "thickness_mm" INTEGER,
    ADD COLUMN "grain" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "board_role" TEXT,
    ADD COLUMN "swatch" TEXT,
    ADD COLUMN "image_id" TEXT,
    ADD COLUMN "specs" JSONB NOT NULL DEFAULT '[]',
    ADD COLUMN "show_on_site" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "public_name" TEXT,
    ADD COLUMN "quote_cost" DECIMAL(12,2),
    ADD CONSTRAINT "inventory_items_dims_check" CHECK (
        ("length_mm" IS NULL OR "length_mm" BETWEEN 1 AND 100000) AND
        ("width_mm" IS NULL OR "width_mm" BETWEEN 1 AND 100000) AND
        ("thickness_mm" IS NULL OR "thickness_mm" BETWEEN 1 AND 1000)),
    ADD CONSTRAINT "inventory_items_board_role_check" CHECK ("board_role" IS NULL OR "board_role" IN ('carcass', 'front', 'worktop', 'back')),
    ADD CONSTRAINT "inventory_items_swatch_check" CHECK ("swatch" IS NULL OR "swatch" ~ '^#[0-9a-f]{6}$'),
    ADD CONSTRAINT "inventory_items_quote_cost_check" CHECK ("quote_cost" IS NULL OR "quote_cost" >= 0),
    ADD CONSTRAINT "inventory_items_image_id_fkey" FOREIGN KEY ("image_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "inventory_items_image_id_idx" ON "inventory_items"("image_id");
