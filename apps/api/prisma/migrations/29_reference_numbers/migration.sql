-- AlterTable
ALTER TABLE "contact_submissions" ADD COLUMN     "ref_no" SERIAL NOT NULL;

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "ref_no" SERIAL NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "contact_submissions_ref_no_key" ON "contact_submissions"("ref_no");

-- CreateIndex
CREATE UNIQUE INDEX "projects_ref_no_key" ON "projects"("ref_no");

