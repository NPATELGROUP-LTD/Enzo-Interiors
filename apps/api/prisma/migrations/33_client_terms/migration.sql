-- AlterTable: which terms version a client last accepted, and when.
ALTER TABLE "clients" ADD COLUMN "terms_version" TEXT,
ADD COLUMN "terms_accepted_at" TIMESTAMPTZ(6);

-- CreateTable: one row per acceptance, as evidence.
CREATE TABLE "terms_acceptances" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "client_name" TEXT NOT NULL,
    "client_email" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "ip" TEXT,
    "device" TEXT,
    "accepted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "terms_acceptances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "terms_acceptances_client_id_accepted_at_idx" ON "terms_acceptances"("client_id", "accepted_at");
