-- Quote maker: the unit library and the pricing settings. New tables only.
-- Slots, sizes, panels and hardware are JSONB: edited as one thing, joined on by nothing.
-- Inventory item ids inside them are checked by the API on save and again when pricing.
CREATE TABLE "unit_templates" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "room_types" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "mount" TEXT NOT NULL,
    "elevation_mm" INTEGER NOT NULL DEFAULT 0,
    "structure" JSONB NOT NULL,
    "slots" JSONB NOT NULL DEFAULT '[]',
    "variants" JSONB NOT NULL DEFAULT '[]',
    "hardware" JSONB NOT NULL DEFAULT '[]',
    "labour_hours" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "labour_extra" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "updated_by" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "unit_templates_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "unit_templates_mount_check" CHECK ("mount" IN ('floor', 'wall', 'tall', 'gap')),
    CONSTRAINT "unit_templates_elevation_check" CHECK ("elevation_mm" BETWEEN 0 AND 5000),
    CONSTRAINT "unit_templates_labour_check" CHECK ("labour_hours" >= 0 AND "labour_extra" >= 0)
);

CREATE UNIQUE INDEX "unit_templates_slug_key" ON "unit_templates"("slug");

-- One row, id 'quote_maker'. Null pricing keys = the defaults in modules/quote-maker, computed on read.
CREATE TABLE "quote_maker_settings" (
    "id" TEXT NOT NULL,
    "pricing" JSONB NOT NULL DEFAULT '{}',
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by" TEXT,
    CONSTRAINT "quote_maker_settings_pkey" PRIMARY KEY ("id")
);
