-- Where an enquiry came from (a tag in the inbox), and the replies an Admin sends from it
-- (modules/enquiries). Additive only, so the previous release still runs against this schema.

-- AlterTable
ALTER TABLE "contact_submissions" ADD COLUMN "source" TEXT;

-- CreateTable
CREATE TABLE "enquiry_messages" (
    "id" TEXT NOT NULL,
    "enquiry_id" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "to_address" TEXT NOT NULL,
    "sent_by" TEXT,
    "sent_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enquiry_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "enquiry_messages_enquiry_id_sent_at_idx" ON "enquiry_messages"("enquiry_id", "sent_at");

-- AddForeignKey
ALTER TABLE "enquiry_messages" ADD CONSTRAINT "enquiry_messages_enquiry_id_fkey" FOREIGN KEY ("enquiry_id") REFERENCES "contact_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
