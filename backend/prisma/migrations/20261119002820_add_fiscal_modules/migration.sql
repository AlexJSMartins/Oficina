-- AlterTable
ALTER TABLE "WorkshopSettings" ADD COLUMN     "ambienteFiscal" TEXT NOT NULL DEFAULT 'sandbox',
ADD COLUMN     "devnotaCompanyUuid" TEXT,
ADD COLUMN     "inscricaoEstadual" TEXT,
ADD COLUMN     "inscricaoMunicipal" TEXT,
ADD COLUMN     "proximoNumeroNfce" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "proximoNumeroNfe" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "proximoNumeroRps" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "regimeTributario" TEXT NOT NULL DEFAULT 'SIMPLES_NACIONAL',
ADD COLUMN     "serieNfce" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "serieNfe" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "serieRps" TEXT NOT NULL DEFAULT '1';

-- CreateTable
CREATE TABLE "FiscalInvoice" (
    "id" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "uuidDevnota" TEXT,
    "protocolo" INTEGER,
    "referenciaExterna" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "finalidade" TEXT NOT NULL DEFAULT 'NORMAL',
    "status" TEXT NOT NULL DEFAULT 'RASCUNHO',
    "numero" INTEGER,
    "serie" INTEGER,
    "chaveAcesso" TEXT,
    "chaveReferenciada" TEXT,
    "serviceOrderId" TEXT,
    "customerId" TEXT,
    "supplierName" TEXT,
    "xmlUrl" TEXT,
    "pdfUrl" TEXT,
    "motivoRejeicao" TEXT,
    "cartaCorrecao" TEXT,
    "valorTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "payloadEnviado" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FiscalInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboundInvoice" (
    "id" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "chaveAcesso" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "serie" INTEGER NOT NULL,
    "dataEmissao" TIMESTAMP(3) NOT NULL,
    "supplierCnpj" TEXT NOT NULL,
    "supplierName" TEXT NOT NULL,
    "xmlContent" TEXT NOT NULL,
    "valorTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InboundInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FiscalInvoice_referenciaExterna_key" ON "FiscalInvoice"("referenciaExterna");

-- CreateIndex
CREATE UNIQUE INDEX "InboundInvoice_chaveAcesso_key" ON "InboundInvoice"("chaveAcesso");

-- AddForeignKey
ALTER TABLE "FiscalInvoice" ADD CONSTRAINT "FiscalInvoice_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "WorkshopSettings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundInvoice" ADD CONSTRAINT "InboundInvoice_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "WorkshopSettings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
