-- CreateTable
CREATE TABLE "WorkshopSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "name" TEXT NOT NULL DEFAULT 'Oficina Pro',
    "slogan" TEXT DEFAULT 'Centro Automotivo Especializado',
    "document" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "logoUrl" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#0f172a',
    "secondaryColor" TEXT NOT NULL DEFAULT '#16a34a',
    "warrantyTerms" TEXT DEFAULT 'Garantia de 90 dias para serviços executados, conforme legislação vigente.',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkshopSettings_pkey" PRIMARY KEY ("id")
);
