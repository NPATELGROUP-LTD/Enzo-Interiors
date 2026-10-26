-- Access log (core/access-log.service): who signed in or changed something, from where.
-- Additive only, so the previous release still runs against this schema.

-- CreateTable
CREATE TABLE "access_events" (
    "id" TEXT NOT NULL,
    "at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kind" TEXT NOT NULL,
    "actor_id" TEXT,
    "actor_kind" TEXT,
    "actor_name" TEXT,
    "actor_role" TEXT,
    "method" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "target_id" TEXT,
    "status" INTEGER NOT NULL,
    "ip" TEXT,
    "country" TEXT,
    "device" TEXT,

    CONSTRAINT "access_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "access_events_at_idx" ON "access_events"("at");

-- CreateIndex
CREATE INDEX "access_events_actor_id_kind_idx" ON "access_events"("actor_id", "kind");
