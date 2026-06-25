-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "minMarginBps" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "SaleLine" ADD COLUMN     "discountAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "discountReason" TEXT,
ADD COLUMN     "floorOverride" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "defaultMinMarginBps" INTEGER NOT NULL DEFAULT 0;
