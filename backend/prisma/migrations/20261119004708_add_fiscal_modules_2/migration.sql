/*
  Warnings:

  - You are about to drop the column `pdfUrl` on the `FiscalInvoice` table. All the data in the column will be lost.
  - You are about to drop the column `xmlUrl` on the `FiscalInvoice` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "FiscalInvoice" DROP COLUMN "pdfUrl",
DROP COLUMN "xmlUrl",
ADD COLUMN     "ambiente" TEXT NOT NULL DEFAULT 'sandbox',
ADD COLUMN     "linkPdf" TEXT,
ADD COLUMN     "linkXml" TEXT,
ADD COLUMN     "pdfBase64" TEXT,
ADD COLUMN     "retornoApi" TEXT,
ADD COLUMN     "xmlBase64" TEXT,
ALTER COLUMN "serie" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "InboundInvoice" ALTER COLUMN "serie" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "WorkshopSettings" ADD COLUMN     "bairro" TEXT,
ADD COLUMN     "cep" TEXT,
ADD COLUMN     "cnae" TEXT,
ADD COLUMN     "codigoIbge" TEXT,
ADD COLUMN     "complemento" TEXT,
ADD COLUMN     "cscHomologacao" TEXT,
ADD COLUMN     "cscId" TEXT,
ADD COLUMN     "cscProducao" TEXT,
ADD COLUMN     "logradouro" TEXT,
ADD COLUMN     "naturezaJuridica" TEXT NOT NULL DEFAULT 'PJ',
ADD COLUMN     "numeroEndereco" TEXT,
ALTER COLUMN "ambienteFiscal" DROP NOT NULL,
ALTER COLUMN "ambienteFiscal" DROP DEFAULT,
ALTER COLUMN "regimeTributario" SET DEFAULT 'SIMPLES';
