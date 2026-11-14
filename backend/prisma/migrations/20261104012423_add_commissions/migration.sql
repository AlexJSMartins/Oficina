-- AlterTable
ALTER TABLE "ServiceOrder" ADD COLUMN     "mechanicCommissionRate" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "commissionRate" DOUBLE PRECISION NOT NULL DEFAULT 0;
