/*
  Warnings:

  - You are about to drop the column `dueDate` on the `FinancialTransaction` table. All the data in the column will be lost.
  - You are about to drop the column `paymentDate` on the `FinancialTransaction` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `FinancialTransaction` table. All the data in the column will be lost.
  - You are about to alter the column `amount` on the `FinancialTransaction` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `DoublePrecision`.
  - The `paymentMethod` column on the `FinancialTransaction` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to alter the column `unitCost` on the `OrderItem` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `DoublePrecision`.
  - You are about to alter the column `unitPrice` on the `OrderItem` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `DoublePrecision`.
  - You are about to alter the column `totalPrice` on the `OrderItem` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `DoublePrecision`.
  - You are about to alter the column `discount` on the `ServiceOrder` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `DoublePrecision`.
  - You are about to alter the column `totalAmount` on the `ServiceOrder` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `DoublePrecision`.
  - Changed the type of `category` on the `FinancialTransaction` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('PIX', 'CREDIT_CARD', 'DEBIT_CARD', 'CASH', 'BOLETO', 'TRANSFER');

-- AlterTable
ALTER TABLE "FinancialTransaction" DROP COLUMN "dueDate",
DROP COLUMN "paymentDate",
DROP COLUMN "status",
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
DROP COLUMN "category",
ADD COLUMN     "category" TEXT NOT NULL,
ALTER COLUMN "amount" SET DATA TYPE DOUBLE PRECISION,
DROP COLUMN "paymentMethod",
ADD COLUMN     "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'PIX';

-- AlterTable
ALTER TABLE "OrderItem" ALTER COLUMN "unitCost" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "unitPrice" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "totalPrice" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "ServiceOrder" ALTER COLUMN "discount" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "totalAmount" SET DATA TYPE DOUBLE PRECISION;

-- AddForeignKey
ALTER TABLE "FinancialTransaction" ADD CONSTRAINT "FinancialTransaction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
