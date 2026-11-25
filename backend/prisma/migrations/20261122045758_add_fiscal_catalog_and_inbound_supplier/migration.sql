-- AlterTable
ALTER TABLE "CatalogItem" ADD COLUMN     "cest" TEXT,
ADD COLUMN     "cfopPadraoEntrada" TEXT DEFAULT '1102',
ADD COLUMN     "cfopPadraoSaida" TEXT DEFAULT '5102',
ADD COLUMN     "codigoFornecedor" TEXT,
ADD COLUMN     "csosn" TEXT DEFAULT '102',
ADD COLUMN     "ean" TEXT,
ADD COLUMN     "ncm" TEXT DEFAULT '87089990',
ADD COLUMN     "origem" TEXT DEFAULT '0',
ADD COLUMN     "unidadeMedida" TEXT DEFAULT 'UN';

-- AlterTable
ALTER TABLE "InboundInvoice" ADD COLUMN     "importedToStock" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "itensJson" TEXT,
ADD COLUMN     "supplierId" TEXT;

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "bairro" TEXT,
ADD COLUMN     "cep" TEXT,
ADD COLUMN     "cidade" TEXT,
ADD COLUMN     "codigoIbge" TEXT,
ADD COLUMN     "ie" TEXT,
ADD COLUMN     "logradouro" TEXT,
ADD COLUMN     "numeroEndereco" TEXT,
ADD COLUMN     "uf" TEXT;

-- AlterTable
ALTER TABLE "WorkshopSettings" ADD COLUMN     "certificadoVencimento" TIMESTAMP(3),
ADD COLUMN     "codigoServicoPadrao" TEXT DEFAULT '140101';

-- AddForeignKey
ALTER TABLE "InboundInvoice" ADD CONSTRAINT "InboundInvoice_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
