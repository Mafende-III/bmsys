-- CreateEnum
CREATE TYPE "CashTransferTarget" AS ENUM ('MOMO', 'BANK');

-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "bankCheckpointAt" TIMESTAMP(3),
ADD COLUMN     "bankOpeningBalance" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "momoCheckpointAt" TIMESTAMP(3),
ADD COLUMN     "momoOpeningBalance" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "CashTransfer" (
    "id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "toMethod" "CashTransferTarget" NOT NULL,
    "reference" TEXT,
    "note" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CashTransfer_createdAt_idx" ON "CashTransfer"("createdAt");

-- AddForeignKey
ALTER TABLE "CashTransfer" ADD CONSTRAINT "CashTransfer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

