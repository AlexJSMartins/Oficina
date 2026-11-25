// backend/src/modules/fiscal/return-invoice.service.ts

import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DevNotaApiService } from './devnota-api.service';
import { FiscalService } from './fiscal.service';
import { XmlParserService, ParsedInboundXml, ParsedXmlItem } from './xml-parser.service';

import { BillingService } from '../billing/billing.service';

export interface ReturnItemSelectionDto {
  index: number;
  selected: boolean;
  returnQty: number;
  catalogItemId?: string | null;
  cfopDevolucao?: string;
}

export interface BuildReturnDto {
  inboundInvoiceId?: string;
  xmlContent?: string;
  reason: string;
  deductFromStock?: boolean;
  createSupplierCredit?: boolean;
  idempotencyKey?: string;
  items: ReturnItemSelectionDto[];
}

@Injectable()
export class ReturnInvoiceService {
  constructor(
    private prisma: PrismaService,
    private devnota: DevNotaApiService,
    private fiscalService: FiscalService,
    private xmlParser: XmlParserService,
    private billingService: BillingService,
  ) { }

  // Inversão automática de CFOP de compra -> CFOP de devolução
  convertCfopForReturn(originalCfop: string): string {
    const clean = String(originalCfop || '').replace(/\D/g, '').slice(0, 4);

    const map: Record<string, string> = {
      // Operações Estaduais (5xxx)
      '5101': '5202',
      '5102': '5202',
      '5103': '5202',
      '5104': '5202',
      '5115': '5202',
      '5401': '5411',
      '5402': '5411',
      '5403': '5411',
      '5405': '5411',
      '1102': '5202',
      '1403': '5411',
      // Operações Interestaduais (6xxx)
      '6101': '6202',
      '6102': '6202',
      '6103': '6202',
      '6104': '6202',
      '6401': '6411',
      '6403': '6411',
      '6404': '6411',
      '2102': '6202',
      '2403': '6411',
    };

    if (map[clean]) return map[clean];
    if (clean.startsWith('6') || clean.startsWith('2')) return '6202';
    return '5202';
  }

  private round2(val: number): number {
    return Number((Number(val || 0)).toFixed(2));
  }

  private formatBrDate(isoDate: string): string {
    const d = new Date(isoDate);
    if (Number.isNaN(d.getTime())) return isoDate;
    return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  }

  // Valida dígito verificador oficial GS1 (EAN-8, UPC-12, EAN-13, GTIN-14)
  private isValidGtin(code?: string | null): boolean {
    const digits = String(code || '').replace(/\D/g, '');
    if (![8, 12, 13, 14].includes(digits.length)) return false;

    const checkDigit = Number(digits[digits.length - 1]);
    let sum = 0;
    for (let i = digits.length - 2, pos = 0; i >= 0; i--, pos++) {
      const weight = pos % 2 === 0 ? 3 : 1;
      sum += Number(digits[i]) * weight;
    }
    const expected = (10 - (sum % 10)) % 10;
    return expected === checkDigit;
  }

  // 1. Lista Notas de Compra já importadas com contagem de devoluções já feitas
  async listInboundForReturn(workshopId: string) {
    const [inbounds, returns] = await Promise.all([
      this.prisma.inboundInvoice.findMany({
        where: { workshopId },
        include: {
          supplier: { select: { id: true, name: true, document: true, phone: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      this.prisma.fiscalInvoice.findMany({
        where: { workshopId, finalidade: 'DEVOLUCAO' },
        select: { id: true, chaveReferenciada: true, status: true, numero: true, valorTotal: true },
      }),
    ]);

    const returnsByKey = new Map<string, typeof returns>();
    for (const r of returns) {
      if (!r.chaveReferenciada) continue;
      const list = returnsByKey.get(r.chaveReferenciada) || [];
      list.push(r);
      returnsByKey.set(r.chaveReferenciada, list);
    }

    return inbounds.map((inb) => {
      const linkedReturns = returnsByKey.get(inb.chaveAcesso) || [];
      return {
        id: inb.id,
        chaveAcesso: inb.chaveAcesso,
        numero: inb.numero,
        serie: inb.serie,
        dataEmissao: inb.dataEmissao,
        supplierCnpj: inb.supplierCnpj,
        supplierName: inb.supplier?.name || inb.supplierName,
        valorTotal: inb.valorTotal,
        createdAt: inb.createdAt,
        returnsCount: linkedReturns.length,
        returns: linkedReturns,
      };
    });
  }

  // Helper interno: resolve o XML (de uma InboundInvoice salva ou upload direto)
  private async resolveParsedXml(
    workshopId: string,
    params: { inboundInvoiceId?: string; xmlContent?: string },
  ): Promise<{ parsed: ParsedInboundXml; inboundId: string | null; rawXml: string }> {
    let rawXml = params.xmlContent || '';
    let inboundId: string | null = null;

    if (params.inboundInvoiceId) {
      const inbound = await this.prisma.inboundInvoice.findFirst({
        where: { id: params.inboundInvoiceId, workshopId },
      });
      if (!inbound) {
        throw new NotFoundException('Nota de compra não encontrada nesta oficina.');
      }
      rawXml = inbound.xmlContent;
      inboundId = inbound.id;
    }

    if (!rawXml.trim()) {
      throw new BadRequestException(
        'Selecione uma Nota de Compra importada ou envie o arquivo .XML da autopeças.',
      );
    }

    const parsed = this.xmlParser.parseNfeXml(rawXml);
    return { parsed, inboundId, rawXml };
  }

  // 2. Prepara os dados da devolução (lê XML, converte CFOPs e cruza com o estoque)
  async prepareReturn(
    workshopId: string,
    params: { inboundInvoiceId?: string; xmlContent?: string },
  ) {
    const workshop = await this.prisma.workshopSettings.findUnique({
      where: { id: workshopId },
    });
    if (!workshop) throw new NotFoundException('Configurações da oficina não encontradas.');

    const ambiente = workshop.ambienteFiscal || this.devnota.getDefaultEnvironment();
    const { parsed, inboundId, rawXml } = await this.resolveParsedXml(workshopId, params);

    // Cruza peças do XML com o estoque atual para possibilitar baixa automática
    const catalogParts = await this.prisma.catalogItem.findMany({
      where: { workshopId, type: 'PART' },
      select: {
        id: true,
        code: true,
        name: true,
        ean: true,
        codigoFornecedor: true,
        stock: true,
      },
    });

    const items = parsed.items.map((item) => {
      const cleanForCode = item.codigoFornecedor.trim().toLowerCase();
      const normName = item.name.trim().toLowerCase();

      const matched =
        (item.ean ? catalogParts.find((p) => p.ean && p.ean === item.ean) : undefined) ||
        catalogParts.find(
          (p) =>
            (p.codigoFornecedor && p.codigoFornecedor.trim().toLowerCase() === cleanForCode) ||
            (p.code && p.code.trim().toLowerCase() === cleanForCode),
        ) ||
        catalogParts.find((p) => p.name.trim().toLowerCase() === normName);

      const cfopDevolucao = this.convertCfopForReturn(item.cfop);

      return {
        ...item,
        cfopDevolucao,
        matchedCatalogItemId: matched?.id || null,
        matchedCatalogItemName: matched?.name || null,
        currentStock: matched?.stock ?? null,
      };
    });

    return {
      ambiente,
      inboundInvoiceId: inboundId,
      xmlContent: rawXml,
      emitter: {
        name: workshop.name,
        document: workshop.document || '00.000.000/0000-00',
        ie: workshop.inscricaoEstadual || 'ISENTO',
        im: workshop.inscricaoMunicipal || '—',
        address:
          [workshop.logradouro, workshop.numeroEndereco].filter(Boolean).join(', ') ||
          'Endereço não cadastrado',
        neighborhood: workshop.bairro || '',
        cep: workshop.cep || '',
        regimeTributario: workshop.regimeTributario || 'SIMPLES',
      },
      originalInvoice: {
        chaveAcesso: parsed.chaveAcesso,
        numero: parsed.numero,
        serie: parsed.serie,
        dataEmissao: parsed.dataEmissao,
        dataEmissaoBr: this.formatBrDate(parsed.dataEmissao),
        valorTotal: parsed.valorTotal,
      },
      supplier: parsed.supplier,
      proximoNumeroNfe: workshop.proximoNumeroNfe,
      serieNfe: workshop.serieNfe,
      items,
    };
  }

  // 3. Monta o payload completo de NF-e de Devolução com cálculo proporcional de impostos
  async buildReturnPreview(workshopId: string, dto: BuildReturnDto) {
    const workshop = await this.prisma.workshopSettings.findUnique({
      where: { id: workshopId },
    });
    if (!workshop) throw new NotFoundException('Configurações da oficina não encontradas.');

    const ambiente = workshop.ambienteFiscal || this.devnota.getDefaultEnvironment();
    const { parsed } = await this.resolveParsedXml(workshopId, {
      inboundInvoiceId: dto.inboundInvoiceId,
      xmlContent: dto.xmlContent,
    });

    const selected = (dto.items || []).filter((i) => i.selected && Number(i.returnQty) > 0);
    if (selected.length === 0) {
      throw new BadRequestException('Selecione ao menos uma peça com quantidade maior que zero para devolver.');
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    if (!parsed.supplier.cnpj || (parsed.supplier.cnpj.length !== 11 && parsed.supplier.cnpj.length !== 14)) {
      errors.push('Fornecedor sem CNPJ/CPF válido no XML de origem.');
    }
    if (!parsed.supplier.cep || parsed.supplier.cep.length !== 8) {
      errors.push('Endereço do fornecedor sem CEP de 8 dígitos no XML.');
    }
    if (!parsed.supplier.codigoIbge || parsed.supplier.codigoIbge.length !== 7) {
      errors.push('Endereço do fornecedor sem código IBGE do município (7 dígitos).');
    }
    if (!workshop.inscricaoEstadual && ambiente !== 'sandbox') {
      errors.push('Inscrição Estadual (IE) da oficina obrigatória para emitir NF-e fora do sandbox.');
    }

    const isSimples = (workshop.regimeTributario || 'SIMPLES').toUpperCase().includes('SIMPLES') ||
      (workshop.regimeTributario || '').toUpperCase() === 'MEI';

    let totalProducts = 0;
    let totalIcms = 0;
    let totalIcmsSt = 0;
    let totalIpi = 0;

    const payloadItems = selected.map((sel, idx) => {
      const orig: ParsedXmlItem | undefined = parsed.items.find((p) => p.index === sel.index);
      if (!orig) {
        throw new BadRequestException(`Item #${sel.index + 1} não encontrado na nota original.`);
      }

      const qtyReturn = Number(sel.returnQty);
      if (qtyReturn <= 0 || qtyReturn > orig.quantity) {
        throw new BadRequestException(
          `Quantidade de devolução inválida para "${orig.name}". Máximo na nota original: ${orig.quantity}.`,
        );
      }

      // Fator proporcional para devoluções parciais (ex: comprou 4, devolveu 2 -> ratio = 0.5)
      const ratio = orig.quantity > 0 ? qtyReturn / orig.quantity : 1;

      const itemTotal = this.round2(qtyReturn * orig.unitCost);
      const icmsBase = this.round2(orig.icmsBase * ratio);
      const icmsValor = this.round2(orig.icmsValor * ratio);
      const icmsStBase = this.round2(orig.icmsStBase * ratio);
      const icmsStValor = this.round2(orig.icmsStValor * ratio);
      const ipiBase = this.round2(orig.ipiBase * ratio);
      const ipiValor = this.round2(orig.ipiValor * ratio);

      totalProducts = this.round2(totalProducts + itemTotal);
      totalIcms = this.round2(totalIcms + icmsValor);
      totalIcmsSt = this.round2(totalIcmsSt + icmsStValor);
      totalIpi = this.round2(totalIpi + ipiValor);

      const cfopFinal =
        (sel.cfopDevolucao || this.convertCfopForReturn(orig.cfop)).replace(/\D/g, '').slice(0, 4);
      const supportedCsts = ['00', '40', '41', '50', '60', '90'];
      const normalCst = supportedCsts.includes(orig.icmsCst) ? orig.icmsCst : '90';
      const icmsObj: Record<string, any> = isSimples
        ? {
          situacaoTributaria: '900', // CSOSN 900 (Simples Nacional)
          origem: orig.origem || '0',
          ...(icmsBase > 0 ? { modalidadeBaseCalculo: '3' } : {}),
          baseCalculo: icmsBase,
          aliquota: orig.icmsAliquota || 0,
          valor: icmsValor,
          ...(icmsStValor > 0
            ? {
              modalidadeBaseCalculoST: '4',
              baseCalculoST: icmsStBase,
              aliquotaST: orig.icmsStAliquota || 0,
              valorST: icmsStValor,
            }
            : {}),
        }
        : {
          situacaoTributaria: normalCst, // CST 2 dígitos suportado (00, 40, 41, 50, 60, 90)
          origem: orig.origem || '0',
          baseCalculo: icmsBase,
          aliquota: orig.icmsAliquota || 0,
          valor: icmsValor,
        };

      const impostos: Record<string, any> = {
        icms: icmsObj,
        pis: {
          situacaoTributaria: '49', // Outras Operações de Saída (aceito pela DevNota)
          baseCalculo: 0,
          aliquota: 0,
          valor: 0,
        },
        cofins: {
          situacaoTributaria: '49', // Outras Operações de Saída (aceito pela DevNota)
          baseCalculo: 0,
          aliquota: 0,
          valor: 0,
        },
        ...(ipiValor > 0
          ? {
            ipi: {
              situacaoTributaria: '99',
              enquadramentoLegal: '999',
              baseCalculo: ipiBase,
              aliquota: orig.ipiAliquota || 0,
              valor: ipiValor,
            },
          }
          : {}),
      };

      return {
        codigo: orig.codigoFornecedor || String(idx + 1).padStart(6, '0'),
        descricao: orig.name,
        cfop: cfopFinal,
        ncm: (orig.ncm || '87089990').replace(/\D/g, '').padEnd(8, '0').slice(0, 8),
        ...(orig.cest ? { cest: orig.cest } : {}),
        ...(this.isValidGtin(orig.ean) ? { ean: orig.ean } : {}),
        unidadeMedida: orig.unidadeMedida || 'UN',
        quantidade: qtyReturn,
        valorUnitario: orig.unitCost,
        desconto: 0,
        impostos,
      };
    });

    const dataEmissaoOrigBr = this.formatBrDate(parsed.dataEmissao);
    const motivoLimpo = (dto.reason || 'Mercadoria devolvida ao fornecedor').trim();

    // Mensagem padrão exigida pelas autopeças nas Informações Complementares
    const fmtBr = (n: number) => n.toFixed(2).replace('.', ',');
    const taxNoteParts: string[] = [];
    if (totalIcms > 0) taxNoteParts.push(`ICMS destacado: R$ ${fmtBr(totalIcms)}`);
    if (totalIcmsSt > 0) taxNoteParts.push(`ICMS-ST ref.: R$ ${fmtBr(totalIcmsSt)}`);
    if (totalIpi > 0) taxNoteParts.push(`IPI ref.: R$ ${fmtBr(totalIpi)}`);

    const infoComplementares = [
      `Devolução referente à NF-e nº ${parsed.numero}, Série ${parsed.serie}, emitida em ${dataEmissaoOrigBr} - Chave de Acesso: ${parsed.chaveAcesso}.`,
      `Motivo: ${motivoLimpo}.`,
      taxNoteParts.length > 0 ? taxNoteParts.join(' | ') : null,
    ]
      .filter(Boolean)
      .join(' ');

    const refSuffix = (dto.idempotencyKey || `${Date.now()}`).replace(/[^a-zA-Z0-9._-]/g, '');
    const referenciaExterna = `dev-${parsed.numero}-${refSuffix}`.slice(0, 100);

    const cleanPhone = (parsed.supplier.phone || '').replace(/\D/g, '');

    const nfeReturnPayload = {
      ambiente,
      referencia_externa: referenciaExterna,
      numero: workshop.proximoNumeroNfe,
      serie: workshop.serieNfe,
      pedido: {
        naturezaOperacao: 'Devolucao de compra para comercializacao',
        consumidorFinal: 'NAO',
        presencaConsumidor: 'OperacaoPresencial',
        finalidade: 'DevolucaoRetorno',
        notasReferenciadas: [parsed.chaveAcesso],
        informacoesComplementares: infoComplementares,
        frete: {
          modalidade: 'SemFrete',
        },
        pagamento: {
          formas: [
            {
              tipo: 'SemPagamento',
              valor: 0,
            },
          ],
        },
      },
      // Inversão: o Emitente (<emit>) da nota de compra vira o Destinatário (cliente) na devolução
      cliente: {
        nome: parsed.supplier.name,
        cpfCnpj: parsed.supplier.cnpj,
        ...(parsed.supplier.ie ? { ie: parsed.supplier.ie.replace(/\D/g, '') } : {}),
        ...(cleanPhone.length >= 6 ? { telefone: cleanPhone } : {}),
        endereco: {
          uf: (parsed.supplier.uf || 'SP').toUpperCase(),
          cidade: parsed.supplier.codigoIbge || workshop.codigoIbge || '3549805',
          logradouro: parsed.supplier.logradouro || 'Rua Principal',
          numero: parsed.supplier.numeroEndereco || 'S/N',
          complemento: null,
          bairro: parsed.supplier.bairro || 'Centro',
          cep: (parsed.supplier.cep || '').replace(/\D/g, ''),
        },
      },
      itens: payloadItems,
    };

    const totalInvoiceValue = this.round2(totalProducts + totalIpi + totalIcmsSt);

    return {
      ambiente,
      canEmit: errors.length === 0,
      errors,
      warnings,
      totals: {
        products: totalProducts,
        icms: totalIcms,
        icmsSt: totalIcmsSt,
        ipi: totalIpi,
        totalInvoice: totalInvoiceValue,
      },
      emitter: {
        name: workshop.name,
        document: workshop.document || '00.000.000/0000-00',
        ie: workshop.inscricaoEstadual || 'ISENTO',
        im: workshop.inscricaoMunicipal || '—',
        address:
          [workshop.logradouro, workshop.numeroEndereco].filter(Boolean).join(', ') ||
          'Endereço não cadastrado',
        neighborhood: workshop.bairro || '',
        cep: workshop.cep || '',
        regimeTributario: workshop.regimeTributario || 'SIMPLES',
      },
      originalInvoice: {
        chaveAcesso: parsed.chaveAcesso,
        numero: parsed.numero,
        serie: parsed.serie,
        dataEmissao: parsed.dataEmissao,
        supplierName: parsed.supplier.name,
      },
      payload: nfeReturnPayload,
    };
  }

  // 4. Emite a NF-e de Devolução com checagem de idempotência + baixa automática de estoque
  async emitReturnInvoice(workshopId: string, userId: string, dto: BuildReturnDto) {
    // 1. Valida se a oficina pode emitir nota fiscal (assinatura ativa, limite de notas, etc.)
    await this.billingService.assertCanEmitFiscal(workshopId, 1);

    // 2. Prepara o payload da nota fiscal de devolução a partir da NF-e de compra
    const preview = await this.buildReturnPreview(workshopId, dto);
    if (!preview.canEmit) {
      throw new BadRequestException(preview.errors.join(' '));
    }

    const workshop = await this.prisma.workshopSettings.findUnique({
      where: { id: workshopId },
    });
    if (!workshop) throw new NotFoundException('Configurações da oficina não encontradas.');

    // Idempotência: se o cliente reenviou a mesma idempotencyKey após oscilação de rede,
    // verifica localmente e na DevNota (GET /v2/consulta/referencia/{ref}) antes de gerar nota duplicada
    if (dto.idempotencyKey) {
      const localExisting = await this.prisma.fiscalInvoice.findUnique({
        where: { referenciaExterna: preview.payload.referencia_externa },
      });
      if (localExisting && (localExisting.status === 'PROCESSANDO' || localExisting.status === 'AUTORIZADA')) {
        return {
          reused: true,
          invoice: localExisting,
          stockDeductedCount: 0,
          financialCreditId: null,
        };
      }

      if (workshop.devnotaCompanyUuid) {
        try {
          const refCheck = await this.devnota.getByExternalRef(
            preview.payload.referencia_externa,
            workshop.devnotaCompanyUuid,
          );
          const activeAttempt = (refCheck?.tentativas || []).find(
            (t: any) => t.status === 'concluido' || t.status === 'processando',
          );
          if (activeAttempt) {
            const recovered = await this.prisma.fiscalInvoice.create({
              data: {
                workshopId,
                uuidDevnota: activeAttempt.uuid || null,
                protocolo: activeAttempt.protocolo ? Number(activeAttempt.protocolo) : null,
                referenciaExterna: preview.payload.referencia_externa,
                tipo: 'NFE',
                finalidade: 'DEVOLUCAO',
                ambiente: preview.ambiente,
                status: activeAttempt.status === 'concluido' ? 'AUTORIZADA' : 'PROCESSANDO',
                numero: activeAttempt.numero_nota ? Number(activeAttempt.numero_nota) : null,
                serie: String(preview.payload.serie),
                chaveReferenciada: preview.originalInvoice.chaveAcesso,
                supplierName: preview.originalInvoice.supplierName,
                valorTotal: preview.totals.products,
                payloadEnviado: JSON.stringify(preview.payload),
                retornoApi: JSON.stringify(refCheck),
              },
            });
            return {
              reused: true,
              invoice: recovered,
              stockDeductedCount: 0,
              financialCreditId: null,
            };
          }
        } catch {
          // 404 = nenhuma tentativa anterior na DevNota; segue fluxo normal
        }
      }
    }

    // Reserva e incrementa atomicamente o próximo número da NF-e
    const updatedWorkshop = await this.prisma.workshopSettings.update({
      where: { id: workshopId },
      data: { proximoNumeroNfe: { increment: 1 } },
    });

    const allocatedNumero = updatedWorkshop.proximoNumeroNfe - 1;
    const finalPayload = {
      ...preview.payload,
      numero: allocatedNumero,
      serie: Number(updatedWorkshop.serieNfe),
    };

    // Transmite para a DevNota e registra em FiscalInvoice (com payloadEnviado e retornoApi completos)
    const emitted = await this.fiscalService.emitDocument(workshopId, 'NFE', finalPayload, {
      finalidade: 'DEVOLUCAO',
      chaveReferenciada: preview.originalInvoice.chaveAcesso,
      supplierName: preview.originalInvoice.supplierName,
      valorTotal: preview.totals.products,
    });

    // Pós-emissão: baixa automática no estoque e crédito opcional com o fornecedor
    let stockDeductedCount = 0;
    let financialCreditId: string | null = null;

    await this.prisma.$transaction(async (tx) => {
      if (dto.deductFromStock) {
        const selected = (dto.items || []).filter((i) => i.selected && Number(i.returnQty) > 0);
        for (const sel of selected) {
          if (!sel.catalogItemId) continue;

          const part = await tx.catalogItem.findFirst({
            where: { id: sel.catalogItemId, workshopId },
          });
          if (!part) continue;

          const qtyToDeduct = Math.max(1, Math.round(Number(sel.returnQty)));
          const nextStock = Math.max(0, part.stock - qtyToDeduct);

          await tx.catalogItem.update({
            where: { id: part.id },
            data: { stock: nextStock },
          });

          await tx.stockMovement.create({
            data: {
              workshopId,
              catalogItemId: part.id,
              type: 'OUT',
              quantity: qtyToDeduct,
              reason: `Devolução NF-e #${allocatedNumero} (ref. compra #${preview.originalInvoice.numero} - ${preview.originalInvoice.supplierName})`,
              createdById: userId,
            },
          });

          stockDeductedCount++;
        }
      }

      if (dto.createSupplierCredit && preview.totals.products > 0) {
        const fin = await tx.financialTransaction.create({
          data: {
            workshopId,
            type: 'INCOME',
            category: 'PARTS_COST',
            description: `Crédito Devolução NF-e #${allocatedNumero} - ${preview.originalInvoice.supplierName}`,
            amount: preview.totals.products,
            paymentMethod: 'TRANSFER',
            date: new Date(),
            createdById: userId,
          },
        });
        financialCreditId = fin.id;
      }
    });

    return {
      reused: false,
      ...emitted,
      stockDeductedCount,
      financialCreditId,
    };
  }
}