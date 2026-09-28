-- The newsletter: subscribers (double opt-in) and campaigns.
-- Additive only: two new tables and their indexes; no existing table is
-- touched, so the previous release still runs against this schema.

-- CreateTable
CREATE TABLE "newsletter_subscribers" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "token" TEXT NOT NULL,
    "source" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirm_sent_at" TIMESTAMPTZ(6),
    "confirmed_at" TIMESTAMPTZ(6),
    "unsubscribed_at" TIMESTAMPTZ(6),

    CONSTRAINT "newsletter_subscribers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "newsletter_campaigns" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "recipients" INTEGER NOT NULL DEFAULT 0,
    "sent_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "cursor" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMPTZ(6),

    CONSTRAINT "newsletter_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_subscribers_email_key" ON "newsletter_subscribers"("email");

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_subscribers_token_key" ON "newsletter_subscribers"("token");

-- CreateIndex
CREATE INDEX "newsletter_subscribers_status_created_at_idx" ON "newsletter_subscribers"("status", "created_at");

-- CreateIndex
CREATE INDEX "newsletter_campaigns_created_at_idx" ON "newsletter_campaigns"("created_at");

