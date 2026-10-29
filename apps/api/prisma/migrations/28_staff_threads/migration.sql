-- CreateTable
CREATE TABLE "staff_threads" (
    "id" TEXT NOT NULL,
    "project_id" TEXT,
    "pair_key" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_messages" (
    "id" TEXT NOT NULL,
    "thread_id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "attachments" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_thread_reads" (
    "id" TEXT NOT NULL,
    "thread_id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "read_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_thread_reads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "staff_threads_project_id_key" ON "staff_threads"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "staff_threads_pair_key_key" ON "staff_threads"("pair_key");

-- CreateIndex
CREATE INDEX "staff_messages_thread_id_created_at_idx" ON "staff_messages"("thread_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "staff_thread_reads_thread_id_staff_id_key" ON "staff_thread_reads"("thread_id", "staff_id");

-- AddForeignKey
ALTER TABLE "staff_threads" ADD CONSTRAINT "staff_threads_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_messages" ADD CONSTRAINT "staff_messages_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "staff_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

