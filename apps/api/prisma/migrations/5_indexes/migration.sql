-- Indexes for the queries PostgreSQL now filters itself (PrismaRepository
-- findWhere/countWhere): the bell's unread count and newsletter sending.
-- Index-only: no table or row changes. Building them locks each table for
-- milliseconds at this size; with a large table, use CREATE INDEX
-- CONCURRENTLY by hand instead.

-- CreateIndex
CREATE INDEX "newsletter_subscribers_status_id_idx" ON "newsletter_subscribers"("status", "id");

-- CreateIndex
CREATE INDEX "notifications_recipient_id_read_at_idx" ON "notifications"("recipient_id", "read_at");

