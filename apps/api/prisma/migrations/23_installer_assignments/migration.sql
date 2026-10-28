-- An installer's installation dates and pay on one project, with their approvals
-- and any dates they suggest. Its own table so pay can never ride along on a
-- project_members row that any team member may be sent. Additive only: one new
-- table, a unique index and a foreign key to a table created in migration 22.

-- CreateTable
CREATE TABLE "installer_assignments" (
    "id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "start_date" DATE,
    "end_date" DATE,
    "sent_at" TIMESTAMPTZ(6),
    "pay" DECIMAL(12,2),
    "pay_note" TEXT,
    "pay_status" TEXT NOT NULL DEFAULT 'pending',
    "dates_status" TEXT NOT NULL DEFAULT 'pending',
    "suggested_start" DATE,
    "suggested_end" DATE,
    "suggestion_comment" TEXT,
    "suggested_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "installer_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "installer_assignments_member_id_key" ON "installer_assignments"("member_id");

-- AddForeignKey
ALTER TABLE "installer_assignments" ADD CONSTRAINT "installer_assignments_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "project_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
