/*
  Warnings:

  - You are about to drop the column `name` on the `Category` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[micro]` on the table `Category` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `macro` to the `Category` table without a default value. This is not possible if the table is not empty.
  - Added the required column `micro` to the `Category` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Category_name_key";

-- AlterTable
ALTER TABLE "Category" DROP COLUMN "name",
ADD COLUMN     "macro" TEXT NOT NULL,
ADD COLUMN     "micro" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Category_micro_key" ON "Category"("micro");
