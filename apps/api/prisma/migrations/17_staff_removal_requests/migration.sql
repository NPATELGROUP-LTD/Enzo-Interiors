-- An Admin's request to remove another Admin, waiting for an Infra manager
-- (modules/auth/users). The new "Infra" staff role needs no change: roles are
-- plain text. Additive only, so the previous release still runs against this schema.

-- CreateTable
CREATE TABLE "staff_removal_requests" (
    "id" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "target_name" TEXT NOT NULL,
    "target_email" TEXT NOT NULL,
    "requested_by" TEXT NOT NULL,
    "requested_name" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "decided_by" TEXT,
    "decided_name" TEXT,
    "decision_note" TEXT,
    "decided_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_removal_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "staff_removal_requests_status_created_at_idx" ON "staff_removal_requests"("status", "created_at");

-- CreateIndex
CREATE INDEX "staff_removal_requests_target_id_idx" ON "staff_removal_requests"("target_id");
