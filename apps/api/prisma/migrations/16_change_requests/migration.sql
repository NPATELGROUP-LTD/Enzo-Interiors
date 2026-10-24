-- A Designer's client edit or an Installer's stage move, waiting for an Admin
-- (modules/change-requests). Plus the note an Admin leaves when sending CMS
-- changes back, kept on the entry until the next send or publish. Additive
-- only, so the previous release still runs against this schema.

-- CreateTable
CREATE TABLE "change_requests" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "project_id" TEXT,
    "requested_by" TEXT NOT NULL,
    "requested_name" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "decided_by" TEXT,
    "decided_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "change_requests_status_created_at_idx" ON "change_requests"("status", "created_at");

-- CreateIndex
CREATE INDEX "change_requests_client_id_idx" ON "change_requests"("client_id");

-- AlterTable
ALTER TABLE "cms_entries" ADD COLUMN     "review_feedback" TEXT;
