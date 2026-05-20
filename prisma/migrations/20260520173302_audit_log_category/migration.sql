-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "category" TEXT;

-- CreateIndex
CREATE INDEX "AuditLog_category_createdAt_idx" ON "AuditLog"("category", "createdAt");
