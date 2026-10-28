-- Per-person Gmail (modules/mailbox): one row per staff member who linked their own Google
-- Workspace mailbox. Holds the sealed refresh token only, never any mail. Additive only, so the
-- previous release still runs against this schema.

-- CreateTable
CREATE TABLE "gmail_accounts" (
    "id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "google_email" TEXT NOT NULL,
    "refresh_token_enc" TEXT NOT NULL,
    "scopes" TEXT NOT NULL,
    "connected_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "needs_reconnect" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gmail_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "gmail_accounts_staff_id_key" ON "gmail_accounts"("staff_id");
