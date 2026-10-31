-- AlterTable: what a line costs the studio and the margin put on top; unit_price stays the price the client pays.
ALTER TABLE "project_quote_items" ADD COLUMN "cost_price" DECIMAL(12,2),
ADD COLUMN "margin_pct" DECIMAL(6,2);
