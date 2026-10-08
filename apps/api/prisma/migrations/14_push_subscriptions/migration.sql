-- Web Push: one row per browser that turned on "Notifications on this device"
-- in the admin (Account) or the portal (Settings). owner_type says which table
-- owner_id points at ('staff' = staff_users, 'client' = clients).
-- Additive only: a new table and its indexes; nothing existing is touched, so
-- the previous release still runs against this schema (docs/prelaunch.md).

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "owner_type" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "push_subscriptions_owner_type_owner_id_created_at_idx" ON "push_subscriptions"("owner_type", "owner_id", "created_at");
