-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "category" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'pending';

-- CreateTable
CREATE TABLE "MerchantCategory" (
    "id" SERIAL NOT NULL,
    "merchantPattern" TEXT NOT NULL,
    "category" TEXT NOT NULL,

    CONSTRAINT "MerchantCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MerchantCategory_merchantPattern_key" ON "MerchantCategory"("merchantPattern");
