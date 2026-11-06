-- Purchase orders (modules/inventory). Only adds. Receiving a line books a stock_movements receipt with po_id.
CREATE TABLE "purchase_orders" (
    "id" TEXT NOT NULL,
    "ref_no" SERIAL NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "vat_rate" DECIMAL(5,2) NOT NULL DEFAULT 20,
    "expected_at" TIMESTAMPTZ(6),
    "notes" TEXT,
    "sent_at" TIMESTAMPTZ(6),
    "created_by" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "purchase_orders_ref_no_key" ON "purchase_orders"("ref_no");
CREATE INDEX "purchase_orders_supplier_id_idx" ON "purchase_orders"("supplier_id");
CREATE INDEX "purchase_orders_status_idx" ON "purchase_orders"("status");
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "inventory_suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "purchase_order_items" (
    "id" TEXT NOT NULL,
    "po_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "received" INTEGER NOT NULL DEFAULT 0,
    "unit_cost" DECIMAL(12,2) NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "purchase_order_items_counts_check" CHECK ("quantity" > 0 AND "received" >= 0 AND "received" <= "quantity")
);
CREATE INDEX "purchase_order_items_po_id_idx" ON "purchase_order_items"("po_id");
CREATE INDEX "purchase_order_items_item_id_idx" ON "purchase_order_items"("item_id");
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "stock_movements" ADD COLUMN "po_id" TEXT;
CREATE INDEX "stock_movements_po_id_idx" ON "stock_movements"("po_id");
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
