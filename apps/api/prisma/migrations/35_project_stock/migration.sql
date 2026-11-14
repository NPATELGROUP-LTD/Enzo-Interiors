-- Project stock (modules/inventory): what each project needs, holds and has used. Only adds.
-- Reserved stock is not stored on the item: available = on_hand - SUM(project_materials.reserved),
-- so deleting a project (lines cascade) frees its reservations with no code.
CREATE TABLE "project_materials" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "needed" INTEGER NOT NULL DEFAULT 0,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "issued" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_materials_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "project_materials_counts_check" CHECK ("needed" >= 0 AND "reserved" >= 0 AND "issued" >= 0)
);

CREATE UNIQUE INDEX "project_materials_project_id_item_id_key" ON "project_materials"("project_id", "item_id");
CREATE INDEX "project_materials_item_id_idx" ON "project_materials"("item_id");
ALTER TABLE "project_materials" ADD CONSTRAINT "project_materials_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_materials" ADD CONSTRAINT "project_materials_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- A movement may belong to a project; a deleted project leaves its history unlinked.
ALTER TABLE "stock_movements" ADD COLUMN "project_id" TEXT;
CREATE INDEX "stock_movements_project_id_idx" ON "stock_movements"("project_id");
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- One row (id 'inventory'); no row = defaults (reserve by hand only).
CREATE TABLE "inventory_settings" (
    "id" TEXT NOT NULL,
    "reserve_on_stage" TEXT,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_settings_pkey" PRIMARY KEY ("id")
);
