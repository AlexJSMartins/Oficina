/*
  Warnings:

  - A unique constraint covering the columns `[code,workshopId]` on the table `CatalogItem` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[plate,workshopId]` on the table `Vehicle` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `workshopId` to the `CatalogItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `workshopId` to the `Customer` table without a default value. This is not possible if the table is not empty.
  - Added the required column `workshopId` to the `FinancialTransaction` table without a default value. This is not possible if the table is not empty.
  - Added the required column `workshopId` to the `ServiceOrder` table without a default value. This is not possible if the table is not empty.
  - Added the required column `workshopId` to the `StockMovement` table without a default value. This is not possible if the table is not empty.
  - Added the required column `workshopId` to the `Supplier` table without a default value. This is not possible if the table is not empty.
  - Added the required column `workshopId` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `workshopId` to the `Vehicle` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "CatalogItem_code_key";

-- DropIndex
DROP INDEX "Vehicle_plate_key";

-- AlterTable
ALTER TABLE "CatalogItem" ADD COLUMN     "workshopId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "workshopId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "FinancialTransaction" ADD COLUMN     "workshopId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "ServiceOrder" ADD COLUMN     "workshopId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN     "workshopId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "workshopId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "workshopId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN     "workshopId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "WorkshopSettings" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "name" SET DEFAULT 'Minha Oficina',
ALTER COLUMN "secondaryColor" SET DEFAULT '#1f16a3';

-- CreateIndex
CREATE UNIQUE INDEX "CatalogItem_code_workshopId_key" ON "CatalogItem"("code", "workshopId");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_plate_workshopId_key" ON "Vehicle"("plate", "workshopId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "WorkshopSettings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "WorkshopSettings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "WorkshopSettings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOrder" ADD CONSTRAINT "ServiceOrder_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "WorkshopSettings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialTransaction" ADD CONSTRAINT "FinancialTransaction_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "WorkshopSettings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "WorkshopSettings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogItem" ADD CONSTRAINT "CatalogItem_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "WorkshopSettings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "WorkshopSettings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
