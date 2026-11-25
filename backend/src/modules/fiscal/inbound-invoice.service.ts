import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { XmlParserService, ParsedXmlSupplier } from './xml-parser.service';

export interface ConfirmInboundItemDto {
  importItem: boolean;
  action: 'LINK' | 'CREATE';
  catalogItemId?: string | null;
  code?: string;
  codigoFornecedor: string;
  ean?: string | null;
  name: string;
  ncm: string;
  cest?: string | null;
  cfopEntrada?: string;
  unidadeMedida: string;
  quantity: number;
  unitCost: number;
  salePrice: number;
  minStock?: number;
}

export interface ConfirmInboundImportDto {
  xmlContent: string;
  chaveAcesso: string;
  numero: number;
  serie: string;
  dataEmissao: string;
  valorTotal: number;
  supplier: ParsedXmlSupplier;
  linkSupplierToParts: boolean;
  addToStock: boolean;
  createFinancialExpense: boolean;
  paymentMethod?: 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'CASH' | 'BOLETO' | 'TRANSFER';
  items: ConfirmInboundItemDto[];
}

@Injectable()
export class InboundInvoiceService {
  constructor(
    private prisma: PrismaService,
    private xmlParser: XmlParserService,
  ) {}

  async listInboundInvoices(workshopId: string) {
    return this.prisma.inboundInvoice.findMany({
      where: { workshopId },
      include: {
        supplier: {
          select: { id: true, name: true, document: true, phone: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async parseXmlAndMatch(workshopId: string, xmlContent: string) {
    const parsed = this.xmlParser.parseNfeXml(xmlContent);

    // 1. Verifica se esta nota já foi importada anteriormente
    const alreadyImported = await this.prisma.inboundInvoice.findUnique({
      where: { chaveAcesso: parsed.chaveAcesso },
      select: { id: true, createdAt: true, numero: true },
    });

    // 2. Identificação automática do Fornecedor pelo CNPJ (comparando somente dígitos)
    const suppliers = await this.prisma.supplier.findMany({
      where: { workshopId },
    });
    const matchedSupplier =
      suppliers.find(
        (s) => (s.document || '').replace(/\D/g, '') === parsed.supplier.cnpj,
      ) || null;

    // 3. Carrega o estoque da oficina para cruzamento inteligente dos itens
    const catalogParts = await this.prisma.catalogItem.findMany({
      where: { workshopId, type: 'PART' },
      select: {
        id: true,
        code: true,
        name: true,
        ean: true,
        codigoFornecedor: true,
        stock: true,
        costPrice: true,
        salePrice: true,
        supplierId: true,
      },
      orderBy: { name: 'asc' },
    });

    const matchedItems = parsed.items.map((item) => {
      let match: (typeof catalogParts)[number] | undefined;
      let matchReason: string | null = null;

      // Prioridade 1: EAN / Código de Barras
      if (item.ean) {
        match = catalogParts.find((p) => p.ean && p.ean === item.ean);
        if (match) matchReason = 'Código de barras (EAN)';
      }

      // Prioridade 2: Código no fornecedor ou SKU igual
      if (!match && item.codigoFornecedor) {
        const cleanCode = item.codigoFornecedor.trim().toLowerCase();
        match = catalogParts.find(
          (p) =>
            (p.codigoFornecedor && p.codigoFornecedor.trim().toLowerCase() === cleanCode) ||
            (p.code && p.code.trim().toLowerCase() === cleanCode),
        );
        if (match) matchReason = 'Código do fornecedor / SKU';
      }

      // Prioridade 3: Nome exato ou muito parecido
      if (!match) {
        const normXmlName = item.name.trim().toLowerCase();
        match = catalogParts.find(
          (p) =>
            p.name.trim().toLowerCase() === normXmlName ||
            (normXmlName.length >= 8 && p.name.trim().toLowerCase().includes(normXmlName.slice(0, 12))),
        );
        if (match) matchReason = 'Nome similar';
      }

      // Margem sugerida padrão de 60% caso seja peça nova
      const suggestedSalePrice = match
        ? Number(match.salePrice || 0)
        : Number((item.unitCost * 1.6).toFixed(2));

      return {
        ...item,
        suggestedAction: match ? ('LINK' as const) : ('CREATE' as const),
        matchedCatalogItemId: match?.id || null,
        matchedCatalogItemName: match?.name || null,
        matchedCurrentStock: match?.stock ?? 0,
        matchReason,
        suggestedSalePrice,
      };
    });

    return {
      alreadyImported: Boolean(alreadyImported),
      existingInboundId: alreadyImported?.id || null,
      invoice: {
        chaveAcesso: parsed.chaveAcesso,
        numero: parsed.numero,
        serie: parsed.serie,
        dataEmissao: parsed.dataEmissao,
        valorTotal: parsed.valorTotal,
      },
      supplier: {
        ...parsed.supplier,
        status: matchedSupplier ? ('EXISTING' as const) : ('NEW' as const),
        existingSupplierId: matchedSupplier?.id || null,
        existingSupplierName: matchedSupplier?.name || null,
      },
      items: matchedItems,
      catalogOptions: catalogParts.map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        stock: p.stock,
      })),
    };
  }

  async confirmImport(workshopId: string, userId: string, dto: ConfirmInboundImportDto) {
    if (!dto.chaveAcesso || dto.chaveAcesso.replace(/\D/g, '').length !== 44) {
      throw new BadRequestException('Chave de acesso inválida para importação.');
    }

    const existingInvoice = await this.prisma.inboundInvoice.findUnique({
      where: { chaveAcesso: dto.chaveAcesso },
      select: { id: true },
    });

    if (existingInvoice) {
      throw new BadRequestException(
        'Esta Nota Fiscal de compra (Chave de Acesso) já foi importada anteriormente.',
      );
    }

    const cleanCnpj = (dto.supplier?.cnpj || '').replace(/\D/g, '');
    const selectedItems = (dto.items || []).filter((i) => i.importItem);

    return this.prisma.$transaction(async (tx) => {
      // 1. Identifica, cria ou atualiza o Fornecedor (Supplier)
      let supplierId: string | null = null;
      let supplierCreated = false;

      if (cleanCnpj) {
        const workshopSuppliers = await tx.supplier.findMany({ where: { workshopId } });
        const existingSupplier = workshopSuppliers.find(
          (s) => (s.document || '').replace(/\D/g, '') === cleanCnpj,
        );

        if (existingSupplier) {
          supplierId = existingSupplier.id;
          await tx.supplier.update({
            where: { id: existingSupplier.id },
            data: {
              ie: dto.supplier.ie || existingSupplier.ie,
              phone: dto.supplier.phone || existingSupplier.phone,
              cep: dto.supplier.cep || existingSupplier.cep,
              logradouro: dto.supplier.logradouro || existingSupplier.logradouro,
              numeroEndereco: dto.supplier.numeroEndereco || existingSupplier.numeroEndereco,
              bairro: dto.supplier.bairro || existingSupplier.bairro,
              cidade: dto.supplier.cidade || existingSupplier.cidade,
              uf: dto.supplier.uf || existingSupplier.uf,
              codigoIbge: dto.supplier.codigoIbge || existingSupplier.codigoIbge,
            },
          });
        } else {
          const createdSupplier = await tx.supplier.create({
            data: {
              workshopId,
              name: dto.supplier.fantasyName || dto.supplier.name || 'Fornecedor XML',
              document: cleanCnpj,
              phone: dto.supplier.phone || null,
              ie: dto.supplier.ie || null,
              cep: dto.supplier.cep || null,
              logradouro: dto.supplier.logradouro || null,
              numeroEndereco: dto.supplier.numeroEndereco || null,
              bairro: dto.supplier.bairro || null,
              cidade: dto.supplier.cidade || null,
              uf: dto.supplier.uf || null,
              codigoIbge: dto.supplier.codigoIbge || null,
              rating: 5.0,
            },
          });
          supplierId = createdSupplier.id;
          supplierCreated = true;
        }
      }

      // 2. Grava a InboundInvoice vinculada ao fornecedor (base pronta para devoluções!)
      const inbound = await tx.inboundInvoice.create({
        data: {
          workshopId,
          chaveAcesso: dto.chaveAcesso,
          numero: Number(dto.numero || 0),
          serie: String(dto.serie || '1'),
          dataEmissao: new Date(dto.dataEmissao),
          supplierCnpj: cleanCnpj,
          supplierName: dto.supplier.name || 'Fornecedor XML',
          supplierId,
          xmlContent: dto.xmlContent,
          itensJson: JSON.stringify(dto.items || []),
          valorTotal: Number(dto.valorTotal || 0),
          importedToStock: Boolean(dto.addToStock),
        },
      });

      // 3. Processa itens no Estoque (CatalogItem + StockMovement)
      let createdPartsCount = 0;
      let updatedPartsCount = 0;

      for (const item of selectedItems) {
        const qtyInt = Math.max(1, Math.round(Number(item.quantity || 1)));
        const cfopSaida =
          item.cfopEntrada === '5405' || item.cfopEntrada === '5403' || item.cfopEntrada === '6403'
            ? '5405'
            : '5102';
        const csosn = cfopSaida === '5405' ? '500' : '102';

        if (item.action === 'LINK' && item.catalogItemId) {
          const existingPart = await tx.catalogItem.findFirst({
            where: { id: item.catalogItemId, workshopId },
          });

          if (existingPart) {
            await tx.catalogItem.update({
              where: { id: existingPart.id },
              data: {
                ...(dto.addToStock ? { stock: { increment: qtyInt } } : {}),
                costPrice: Number(item.unitCost || existingPart.costPrice),
                salePrice: Number(item.salePrice || existingPart.salePrice),
                ncm: (item.ncm || existingPart.ncm || '87089990').replace(/\D/g, '').slice(0, 8),
                cest: item.cest || existingPart.cest,
                ean: item.ean || existingPart.ean,
                unidadeMedida: item.unidadeMedida || existingPart.unidadeMedida || 'UN',
                codigoFornecedor: item.codigoFornecedor || existingPart.codigoFornecedor,
                ...(dto.linkSupplierToParts && supplierId ? { supplierId } : {}),
              },
            });

            if (dto.addToStock) {
              await tx.stockMovement.create({
                data: {
                  workshopId,
                  catalogItemId: existingPart.id,
                  type: 'IN',
                  quantity: qtyInt,
                  reason: `Entrada NF-e #${dto.numero} - ${dto.supplier.name}`,
                  createdById: userId,
                },
              });
            }

            updatedPartsCount++;
            continue;
          }
        }

        // Cria nova peça já com dados fiscais e fornecedor atribuído
        let finalCode = (item.code || item.codigoFornecedor || '').trim().toUpperCase() || null;
        if (finalCode) {
          const codeConflict = await tx.catalogItem.findFirst({
            where: { workshopId, code: finalCode },
            select: { id: true },
          });
          if (codeConflict) {
            finalCode = `${finalCode}-${Date.now().toString().slice(-4)}`;
          }
        }

        const newPart = await tx.catalogItem.create({
          data: {
            workshopId,
            type: 'PART',
            code: finalCode,
            name: String(item.name).trim(),
            costPrice: Number(item.unitCost || 0),
            salePrice: Number(item.salePrice || Number(item.unitCost || 0) * 1.6),
            stock: dto.addToStock ? qtyInt : 0,
            minStock: Number(item.minStock ?? 2),
            supplierId: dto.linkSupplierToParts ? supplierId : null,
            ean: item.ean || null,
            ncm: (item.ncm || '87089990').replace(/\D/g, '').slice(0, 8),
            cest: item.cest || null,
            cfopPadraoEntrada: item.cfopEntrada || '1102',
            cfopPadraoSaida: cfopSaida,
            csosn,
            origem: '0',
            unidadeMedida: item.unidadeMedida || 'UN',
            codigoFornecedor: item.codigoFornecedor || null,
          },
        });

        if (dto.addToStock) {
          await tx.stockMovement.create({
            data: {
              workshopId,
              catalogItemId: newPart.id,
              type: 'IN',
              quantity: qtyInt,
              reason: `Entrada NF-e #${dto.numero} - ${dto.supplier.name}`,
              createdById: userId,
            },
          });
        }

        createdPartsCount++;
      }

      // 4. Opcionalmente lança a despesa no módulo Financeiro vinculada ao fornecedor
      let financialTransactionId: string | null = null;
      if (dto.createFinancialExpense && Number(dto.valorTotal) > 0) {
        const fin = await tx.financialTransaction.create({
          data: {
            workshopId,
            type: 'EXPENSE',
            category: 'PARTS_COST',
            description: `Compra Peças NF-e #${dto.numero} - ${dto.supplier.name}`,
            amount: Number(dto.valorTotal),
            paymentMethod: dto.paymentMethod || 'BOLETO',
            date: new Date(dto.dataEmissao),
            createdById: userId,
          },
        });
        financialTransactionId = fin.id;
      }

      return {
        message: 'Nota de compra importada com sucesso!',
        inboundInvoiceId: inbound.id,
        supplierId,
        supplierCreated,
        createdPartsCount,
        updatedPartsCount,
        financialTransactionId,
      };
    });
  }
}