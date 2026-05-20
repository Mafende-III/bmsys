-- DropIndex
DROP INDEX "Product_categoryId_idx";

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "iconKey" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "iconKey" TEXT;
