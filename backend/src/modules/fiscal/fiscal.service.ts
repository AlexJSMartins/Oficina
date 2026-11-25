// backend/src/modules/fiscal/fiscal.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DevNotaApiService } from './devnota-api.service';
import { BillingService } from '../billing/billing.service';

@Injectable()
export class FiscalService {
  constructor(
    private prisma: PrismaService,
    private devnota: DevNotaApiService,
    private billingService: BillingService,
  ) { }

  private async getWorkshopAndEnv(workshopId: string) {
    const workshop = await this.prisma.workshopSettings.findUnique({
      where: { id: workshopId },
    });
    if (!workshop) {
      throw new NotFoundException('Configurações da oficina não encontradas.');
    }

    const ambiente = workshop.ambienteFiscal || this.devnota.getDefaultEnvironment();
    return { workshop, ambiente };
  }

  private normalizeRegime(raw?: string | null): 'SIMPLES' | 'MEI' | 'PRESUMIDO' | 'REAL' | 'SIMPLES_EXCESSO' {
    const val = String(raw || 'SIMPLES').trim().toUpperCase();
    if (val === 'MEI') return 'MEI';
    if (val.includes('EXCESSO')) return 'SIMPLES_EXCESSO';
    if (val.includes('SIMPLES')) return 'SIMPLES';
    if (val.includes('PRESUMIDO')) return 'PRESUMIDO';
    if (val.includes('REAL')) return 'REAL';
    return 'SIMPLES';
  }

  async getFiscalStatus(workshopId: string) {
    const { workshop, ambiente } = await this.getWorkshopAndEnv(workshopId);
    return {
      workshopId: workshop.id,
      workshopName: workshop.name,
      document: workshop.document,
      devnotaCompanyUuid: workshop.devnotaCompanyUuid,
      ambienteAtivo: ambiente,
      ambienteFiscal: workshop.ambienteFiscal || ambiente,
      defaultEnvFromEnv: this.devnota.getDefaultEnvironment(),
      naturezaJuridica: workshop.naturezaJuridica,
      cnae: workshop.cnae,
      codigoIbge: workshop.codigoIbge,
      cep: workshop.cep,
      logradouro: workshop.logradouro,
      numeroEndereco: workshop.numeroEndereco,
      bairro: workshop.bairro,
      complemento: workshop.complemento,
      inscricaoMunicipal: workshop.inscricaoMunicipal,
      inscricaoEstadual: workshop.inscricaoEstadual,
      regimeTributario: this.normalizeRegime(workshop.regimeTributario),
      cscId: workshop.cscId,
      cscHomologacao: workshop.cscHomologacao,
      cscProducao: workshop.cscProducao,
      serieNfe: workshop.serieNfe,
      proximoNumeroNfe: workshop.proximoNumeroNfe,
      serieNfce: workshop.serieNfce,
      proximoNumeroNfce: workshop.proximoNumeroNfce,
      serieRps: workshop.serieRps,
      proximoNumeroRps: workshop.proximoNumeroRps,
      certificadoVencimento: workshop.certificadoVencimento,
      codigoServicoPadrao: workshop.codigoServicoPadrao || '140101',
    };
  }

  async updateFiscalSettings(workshopId: string, dto: any) {
    await this.getWorkshopAndEnv(workshopId);

    const updated = await this.prisma.workshopSettings.update({
      where: { id: workshopId },
      data: {
        ...(dto.ambienteFiscal ? { ambienteFiscal: String(dto.ambienteFiscal).toLowerCase() } : {}),
        ...(dto.naturezaJuridica ? { naturezaJuridica: dto.naturezaJuridica } : {}),
        ...(dto.document !== undefined ? { document: String(dto.document).replace(/\D/g, '') } : {}),
        ...(dto.cnae !== undefined ? { cnae: dto.cnae || null } : {}),
        ...(dto.codigoIbge !== undefined ? { codigoIbge: String(dto.codigoIbge || '').replace(/\D/g, '') || null } : {}),
        ...(dto.cep !== undefined ? { cep: String(dto.cep || '').replace(/\D/g, '') || null } : {}),
        ...(dto.logradouro !== undefined ? { logradouro: dto.logradouro || null } : {}),
        ...(dto.numeroEndereco !== undefined ? { numeroEndereco: dto.numeroEndereco || null } : {}),
        ...(dto.bairro !== undefined ? { bairro: dto.bairro || null } : {}),
        ...(dto.complemento !== undefined ? { complemento: dto.complemento || null } : {}),
        ...(dto.inscricaoMunicipal !== undefined ? { inscricaoMunicipal: dto.inscricaoMunicipal || null } : {}),
        ...(dto.inscricaoEstadual !== undefined ? { inscricaoEstadual: dto.inscricaoEstadual || null } : {}),
        ...(dto.regimeTributario ? { regimeTributario: dto.regimeTributario } : {}),
        ...(dto.cscId !== undefined ? { cscId: dto.cscId || null } : {}),
        ...(dto.cscHomologacao !== undefined ? { cscHomologacao: dto.cscHomologacao || null } : {}),
        ...(dto.cscProducao !== undefined ? { cscProducao: dto.cscProducao || null } : {}),
        ...(dto.serieNfe !== undefined ? { serieNfe: Number(dto.serieNfe) || 1 } : {}),
        ...(dto.proximoNumeroNfe !== undefined ? { proximoNumeroNfe: Number(dto.proximoNumeroNfe) || 1 } : {}),
        ...(dto.serieNfce !== undefined ? { serieNfce: Number(dto.serieNfce) || 1 } : {}),
        ...(dto.proximoNumeroNfce !== undefined ? { proximoNumeroNfce: Number(dto.proximoNumeroNfce) || 1 } : {}),
        ...(dto.serieRps !== undefined ? { serieRps: String(dto.serieRps || '1') } : {}),
        ...(dto.proximoNumeroRps !== undefined ? { proximoNumeroRps: Number(dto.proximoNumeroRps) || 1 } : {}),
        ...(dto.codigoServicoPadrao !== undefined
          ? { codigoServicoPadrao: String(dto.codigoServicoPadrao || '140101').replace(/\D/g, '') }
          : {}),
      },
    });

    return { message: 'Configurações fiscais salvas com sucesso.', settings: updated };
  }

  async syncCompanyWithDevNota(workshopId: string, dto: any) {
    const { workshop } = await this.getWorkshopAndEnv(workshopId);

    const payloadDevNota = {
      natureza: dto.natureza || workshop.naturezaJuridica || 'PJ',
      nome: dto.nome || workshop.name,
      nome_fantasia: dto.nomeFantasia || workshop.name,
      email: dto.email,
      cnpj: (dto.cnpj || workshop.document || '').replace(/\D/g, ''),
      cnae: dto.cnae || workshop.cnae,
      codigo_ibge: dto.codigoIbge || workshop.codigoIbge,
      cep: (dto.cep || workshop.cep || '').replace(/\D/g, ''),
      endereco: dto.endereco || workshop.logradouro,
      numero: dto.numero || workshop.numeroEndereco,
      bairro: dto.bairro || workshop.bairro,
      complemento: dto.complemento ?? workshop.complemento,
      regime: this.normalizeRegime(dto.regime || workshop.regimeTributario),
      tipos_emissao: dto.tiposEmissao || ['nfse', 'nfe', 'nfce'],
      im: dto.im ?? workshop.inscricaoMunicipal,
      ie: dto.ie ?? workshop.inscricaoEstadual,
      csc_producao: dto.cscProducao ?? workshop.cscProducao,
      csc_homologacao: dto.cscHomologacao ?? workshop.cscHomologacao,
      csc_id: dto.cscId ?? workshop.cscId,
    };

    const apiResult = workshop.devnotaCompanyUuid
      ? await this.devnota.updateCompany(workshop.devnotaCompanyUuid, payloadDevNota)
      : await this.devnota.createCompany(payloadDevNota);

    const companyUuid = apiResult?.uuid || workshop.devnotaCompanyUuid;

    await this.prisma.workshopSettings.update({
      where: { id: workshopId },
      data: {
        devnotaCompanyUuid: companyUuid,
        name: payloadDevNota.nome || workshop.name,
        document: payloadDevNota.cnpj || workshop.document,
        cnae: payloadDevNota.cnae,
        codigoIbge: payloadDevNota.codigo_ibge,
        cep: payloadDevNota.cep,
        logradouro: payloadDevNota.endereco,
        numeroEndereco: payloadDevNota.numero,
        bairro: payloadDevNota.bairro,
        complemento: payloadDevNota.complemento,
        regimeTributario: payloadDevNota.regime,
        inscricaoMunicipal: payloadDevNota.im,
        inscricaoEstadual: payloadDevNota.ie,
        cscProducao: payloadDevNota.csc_producao,
        cscHomologacao: payloadDevNota.csc_homologacao,
        cscId: payloadDevNota.csc_id,
      },
    });

    const confirmedRegime = this.normalizeRegime(apiResult?.regime || payloadDevNota.regime);

    await this.prisma.workshopSettings.update({
      where: { id: workshopId },
      data: { regimeTributario: confirmedRegime },
    });

    return {
      message: `Empresa sincronizada na DevNota (Regime confirmado: ${confirmedRegime}).`,
      devnotaCompanyUuid: companyUuid,
      devnotaResponse: apiResult,
    };
  }

  async uploadCertificate(
    workshopId: string,
    dto: { certBase64: string; password: string; validUntil: string },


  ) {
    const { workshop } = await this.getWorkshopAndEnv(workshopId);

    if (!workshop.devnotaCompanyUuid) {
      throw new BadRequestException(
        'Cadastre/sincronize a empresa na DevNota antes de enviar o certificado digital.',
      );
    }

    const result = await this.devnota.uploadCertificate(workshop.devnotaCompanyUuid, {
      cert_file: dto.certBase64,
      cert_pass: dto.password,
      valid_ultil: dto.validUntil,
    });

    if (dto.validUntil) {
      await this.prisma.workshopSettings.update({
        where: { id: workshopId },
        data: { certificadoVencimento: new Date(dto.validUntil) },
      });
    }

    return result;


  }

  async createServiceForCompany(
    workshopId: string,
    dto: {
      titulo: string;
      codigoServico: string;
      codigoTributacaoMunicipio?: string;
      tributacaoIssqn?: number;
      padrao?: boolean;
    },
  ) {
    const { workshop } = await this.getWorkshopAndEnv(workshopId);
    if (!workshop.devnotaCompanyUuid) {
      throw new BadRequestException('Empresa ainda não vinculada à DevNota.');
    }

    return this.devnota.createCompanyService(workshop.devnotaCompanyUuid, {
      titulo: dto.titulo,
      codigo_servico: dto.codigoServico,
      codigo_tributacao_municipio: dto.codigoTributacaoMunicipio,
      tributacao_issqn: dto.tributacaoIssqn ?? 1,
      padrao: dto.padrao ?? true,
    });
  }
  async emitDocument(
    
    workshopId: string,
    tipo: 'NFE' | 'NFCE' | 'NFSE',
    payload: any,
    meta?: {
      serviceOrderId?: string;
      customerId?: string;
      supplierName?: string;
      finalidade?: 'NORMAL' | 'DEVOLUCAO';
      chaveReferenciada?: string;
      valorTotal?: number;
    },
  ) {
    // Verifica se a oficina tem assinatura ativa ou período gratuito válido para emissão de notas fiscais
    await this.billingService.assertCanEmitFiscal(workshopId, 1);

    // Verifica se a oficina possui Company-uuid configurado para emissão de notas fiscais
    const { workshop, ambiente } = await this.getWorkshopAndEnv(workshopId);

    if (!workshop.devnotaCompanyUuid && ambiente !== 'sandbox') {
      throw new BadRequestException(
        'A oficina não possui Company-uuid configurado para emitir fora do sandbox.',
      );
    }

    // Geração de referência externa única para evitar duplicidade de emissão
    let referenciaExterna =
      payload.referencia_externa ||
      `oficina-${workshopId.slice(0, 8)}-${tipo.toLowerCase()}-${Date.now()}`;

    const existingRef = await this.prisma.fiscalInvoice.findUnique({
      where: { referenciaExterna },
      select: { id: true },
    });

    if (existingRef) {
      referenciaExterna = `${referenciaExterna}-${Date.now()}`;
    }
    

    const finalPayload = {
      ...payload,
      ambiente: payload.ambiente || ambiente,
      referencia_externa: referenciaExterna,
      ...(process.env.DEVNOTA_CALLBACK_URL && !payload.callback
        ? { callback: process.env.DEVNOTA_CALLBACK_URL }
        : {}),
    };


    let responseData: any;
    if (tipo === 'NFSE') {
      responseData = await this.devnota.emitNfse(finalPayload, workshop.devnotaCompanyUuid || undefined);
    } else if (tipo === 'NFCE') {
      responseData = await this.devnota.emitNfce(finalPayload, workshop.devnotaCompanyUuid || undefined);
    } else {
      responseData = await this.devnota.emitNfe(finalPayload, workshop.devnotaCompanyUuid || undefined);
    }

    const invoice = await this.prisma.fiscalInvoice.create({
      data: {
        workshopId,
        uuidDevnota: responseData?.id || responseData?.uuid || null,
        protocolo: responseData?.protocolo ? Number(responseData.protocolo) : null,
        referenciaExterna,
        tipo,
        finalidade: meta?.finalidade || 'NORMAL',
        ambiente: finalPayload.ambiente,
        status: responseData?.status === 'emitida' ? 'AUTORIZADA' : 'PROCESSANDO',
        numero: payload.numero ? Number(payload.numero) : null,
        serie: payload.serie ? String(payload.serie) : null,
        chaveAcesso: responseData?.chave || null,
        chaveReferenciada: meta?.chaveReferenciada || null,
        serviceOrderId: meta?.serviceOrderId || null,
        customerId: meta?.customerId || null,
        supplierName: meta?.supplierName || null,
        linkPdf: responseData?.link || null,
        linkXml: responseData?.xml || null,
        valorTotal: Number(meta?.valorTotal || 0),
        payloadEnviado: JSON.stringify(finalPayload),
        retornoApi: JSON.stringify(responseData),
      },
    });

    return { invoice, devnotaResponse: responseData };
  }

  async listInvoices(
    workshopId: string,
    filters?: {
      tipo?: string;
      status?: string;
      finalidade?: string;
      startDate?: string;
      endDate?: string;
      search?: string;
    },
  ) {
    const where: any = { workshopId };

    if (filters?.tipo && filters.tipo !== 'ALL') {
      where.tipo = filters.tipo.toUpperCase();
    }
    if (filters?.status && filters.status !== 'ALL') {
      where.status = filters.status.toUpperCase();
    }
    if (filters?.finalidade && filters.finalidade !== 'ALL') {
      where.finalidade = filters.finalidade.toUpperCase();
    }
    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = new Date(`${filters.startDate}T00:00:00-03:00`);
      }
      if (filters.endDate) {
        where.createdAt.lte = new Date(`${filters.endDate}T23:59:59-03:00`);
      }
    }

    const [invoices, allMonthInvoices] = await Promise.all([
      this.prisma.fiscalInvoice.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
      this.prisma.fiscalInvoice.findMany({
        where: { workshopId },
        select: {
          status: true,
          finalidade: true,
          valorTotal: true,
          createdAt: true,
        },
      }),
    ]);

    // Enriquecimento em lote com OS, Cliente e Veículo (sem precisar alterar relações no Prisma)
    const orderIds = Array.from(
      new Set(invoices.map((i) => i.serviceOrderId).filter(Boolean) as string[]),
    );
    const customerIds = Array.from(
      new Set(invoices.map((i) => i.customerId).filter(Boolean) as string[]),
    );

    const [orders, customers] = await Promise.all([
      orderIds.length > 0
        ? this.prisma.serviceOrder.findMany({
          where: { id: { in: orderIds }, workshopId },
          include: {
            customer: { select: { id: true, name: true, document: true, phone: true, email: true } },
            vehicle: { select: { id: true, plate: true, brand: true, model: true, year: true } },
          },
        })
        : [],
      customerIds.length > 0
        ? this.prisma.customer.findMany({
          where: { id: { in: customerIds }, workshopId },
          select: { id: true, name: true, document: true, phone: true, email: true },
        })
        : [],
    ]);

    const orderMap = new Map<string, any>();
    for (const o of orders) {
      orderMap.set(o.id, o);
    }

    const customerMap = new Map<string, any>();
    for (const c of customers) {
      customerMap.set(c.id, c);
    }

    let enriched = invoices.map((inv) => {
      const order = inv.serviceOrderId ? orderMap.get(inv.serviceOrderId) : null;
      const customer =
        order?.customer || (inv.customerId ? customerMap.get(inv.customerId) : null) || null;
      const vehicle = order?.vehicle || null;

      return {
        ...inv,
        serviceOrderNumber: order?.number || null,
        customer,
        vehicle,
      };
    });

    // Filtro de busca composta (nº nota, OS, cliente, CPF/CNPJ, placa, modelo, fornecedor, chave, protocolo)
    if (filters?.search?.trim()) {
      const q = filters.search.trim().toLowerCase();
      const qDigits = q.replace(/\D/g, '');

      enriched = enriched.filter((inv) => {
        const fields = [
          inv.numero ? String(inv.numero) : '',
          inv.protocolo ? String(inv.protocolo) : '',
          inv.chaveAcesso || '',
          inv.referenciaExterna || '',
          inv.supplierName || '',
          inv.serviceOrderNumber ? `os ${inv.serviceOrderNumber} #${inv.serviceOrderNumber}` : '',
          inv.customer?.name || '',
          inv.customer?.document || '',
          inv.vehicle?.plate || '',
          inv.vehicle ? `${inv.vehicle.brand} ${inv.vehicle.model}` : '',
        ];

        const textMatch = fields.some((f) => f.toLowerCase().includes(q));
        const docMatch =
          qDigits.length >= 3 &&
          ((inv.customer?.document || '').replace(/\D/g, '').includes(qDigits) ||
            (inv.chaveAcesso || '').includes(qDigits));

        return textMatch || docMatch;
      });
    }

    // Resumo geral (cards do topo)
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const summary = {
      totalEmitidoMes: 0,
      autorizadas: 0,
      processando: 0,
      rejeitadas: 0,
      canceladas: 0,
      devolucoes: 0,
    };

    for (const item of allMonthInvoices) {
      const dt = new Date(item.createdAt);
      const isCurrentMonth = dt.getMonth() === currentMonth && dt.getFullYear() === currentYear;

      if (item.status === 'AUTORIZADA') {
        summary.autorizadas++;
        if (isCurrentMonth && item.finalidade !== 'DEVOLUCAO') {
          summary.totalEmitidoMes += Number(item.valorTotal || 0);
        }
      } else if (item.status === 'PROCESSANDO') {
        summary.processando++;
      } else if (item.status === 'REJEITADA') {
        summary.rejeitadas++;
      } else if (item.status === 'CANCELADA') {
        summary.canceladas++;
      }

      if (item.finalidade === 'DEVOLUCAO') {
        summary.devolucoes++;
      }
    }

    return {
      summary,
      items: enriched,
    };
  }

  async cancelInvoice(
    workshopId: string,
    invoiceId: string,
    body: {
      justificativa?: string;
      codigoCancelamento?: 'ERRO_EMISSAO' | 'SERVICO_NAO_PRESTADO' | 'DUPLICIDADE' | 'OUTROS';
      motivoCancelamento?: string;
    },
  ) {
    const { workshop, ambiente } = await this.getWorkshopAndEnv(workshopId);
    const invoice = await this.prisma.fiscalInvoice.findFirst({
      where: { id: invoiceId, workshopId },
    });

    if (!invoice) throw new NotFoundException('Nota fiscal não encontrada nesta oficina.');

    let uuidDevnota = invoice.uuidDevnota;
    if (!uuidDevnota && invoice.protocolo) {
      const synced = await this.syncAndFetchPdf(workshopId, invoice.id);
      uuidDevnota = synced.uuidDevnota;
    }

    if (!uuidDevnota) {
      throw new BadRequestException(
        'Nota ainda não possui UUID autorizado na DevNota. Sincronize o status antes de cancelar.',
      );
    }

    const companyUuid = workshop.devnotaCompanyUuid || undefined;
    let res: any;

    if (invoice.tipo === 'NFSE') {
      const codigo = body.codigoCancelamento || 'ERRO_EMISSAO';
      if (codigo === 'OUTROS' && (!body.motivoCancelamento || body.motivoCancelamento.trim().length < 5)) {
        throw new BadRequestException('Informe o motivo detalhado para cancelamento como OUTROS.');
      }

      res = await this.devnota.cancelNfse(uuidDevnota, companyUuid, {
        ambiente: invoice.ambiente || ambiente,
        codigoCancelamento: codigo,
        ...(body.motivoCancelamento ? { motivoCancelamento: body.motivoCancelamento.trim() } : {}),
      });
    } else {
      const justificativa = (body.justificativa || '').trim();
      if (justificativa.length < 15 || justificativa.length > 255) {
        throw new BadRequestException(
          'A justificativa de cancelamento deve ter entre 15 e 255 caracteres (regra da SEFAZ).',
        );
      }

      if (invoice.tipo === 'NFCE') {
        res = await this.devnota.cancelNfce(uuidDevnota, companyUuid, {
          ambiente: invoice.ambiente || ambiente,
          justificativa,
        });
      } else {
        res = await this.devnota.cancelNfe(uuidDevnota, companyUuid, {
          ambiente: invoice.ambiente || ambiente,
          justificativa,
        });
      }
    }

    const updated = await this.prisma.fiscalInvoice.update({
      where: { id: invoice.id },
      data: {
        status: 'CANCELADA',
        retornoApi: JSON.stringify(res),
      },
    });

    return { invoice: updated, devnotaResponse: res };
  }

  async sendCce(workshopId: string, invoiceId: string, correcao: string) {
    const { workshop, ambiente } = await this.getWorkshopAndEnv(workshopId);
    const invoice = await this.prisma.fiscalInvoice.findFirst({
      where: { id: invoiceId, workshopId },
    });

    if (!invoice) throw new NotFoundException('Nota fiscal não encontrada.');
    if (invoice.tipo !== 'NFE') {
      throw new BadRequestException('A Carta de Correção (CC-e) está disponível apenas para NF-e.');
    }
    if (invoice.status !== 'AUTORIZADA') {
      throw new BadRequestException('Somente NF-e com status AUTORIZADA pode receber Carta de Correção.');
    }

    const text = (correcao || '').trim();
    if (text.length < 15 || text.length > 1000) {
      throw new BadRequestException(
        'O texto da Carta de Correção deve ter entre 15 e 1000 caracteres.',
      );
    }

    if (!invoice.uuidDevnota) {
      throw new BadRequestException('Nota sem UUID da DevNota. Sincronize o status primeiro.');
    }

    const res = await this.devnota.sendCceNfe(
      invoice.uuidDevnota,
      workshop.devnotaCompanyUuid || undefined,
      {
        ambiente: invoice.ambiente || ambiente,
        correcao: text,
      },
    );

    const updated = await this.prisma.fiscalInvoice.update({
      where: { id: invoice.id },
      data: {
        cartaCorrecao: text,
        retornoApi: JSON.stringify(res),
      },
    });

    return { invoice: updated, devnotaResponse: res };
  }

  async fetchXml(workshopId: string, invoiceId: string) {
    const { workshop } = await this.getWorkshopAndEnv(workshopId);
    let invoice = await this.prisma.fiscalInvoice.findFirst({
      where: { id: invoiceId, workshopId },
    });

    if (!invoice) throw new NotFoundException('Nota fiscal não encontrada.');

    if (!invoice.uuidDevnota && invoice.protocolo) {
      invoice = await this.syncAndFetchPdf(workshopId, invoice.id);
    }

    let xmlBase64 = invoice.xmlBase64;
    if (!xmlBase64 && invoice.uuidDevnota) {
      const tipoSlug =
        invoice.tipo === 'NFCE' ? 'nfc' : (invoice.tipo.toLowerCase() as 'nfe' | 'nfse');
      const xmlRes = await this.devnota.getDocumentXml(
        tipoSlug,
        invoice.uuidDevnota,
        workshop.devnotaCompanyUuid || undefined,
      );

      if (xmlRes?.success !== false) {
        xmlBase64 =
          xmlRes?.content ||
          xmlRes?.xml ||
          xmlRes?.base64 ||
          (typeof xmlRes === 'string' ? xmlRes : null);
      }

      if (xmlBase64) {
        await this.prisma.fiscalInvoice.update({
          where: { id: invoice.id },
          data: { xmlBase64 },
        });
      }
    }

    if (!xmlBase64) {
      throw new BadRequestException(
        'XML ainda não disponível para esta nota (verifique se ela está autorizada).',
      );
    }

    const filename = `${invoice.tipo.toLowerCase()}-${invoice.numero || invoice.protocolo || invoice.id.slice(0, 8)}.xml`;
    return { xmlBase64, filename, linkXml: invoice.linkXml };
  }

  async reprocessInvoice(workshopId: string, invoiceId: string) {
    const invoice = await this.prisma.fiscalInvoice.findFirst({
      where: { id: invoiceId, workshopId },
    });

    if (!invoice) throw new NotFoundException('Nota fiscal não encontrada.');
    if (!invoice.protocolo) {
      throw new BadRequestException('Esta nota não possui protocolo para reprocessamento.');
    }

    const res = await this.devnota.reprocessProtocol(invoice.protocolo);

    const updated = await this.prisma.fiscalInvoice.update({
      where: { id: invoice.id },
      data: {
        status: 'PROCESSANDO',
        motivoRejeicao: null,
        retornoApi: JSON.stringify(res),
      },
    });

    return { invoice: updated, devnotaResponse: res };
  }

  async listExports(workshopId: string) {
    const { workshop } = await this.getWorkshopAndEnv(workshopId);
    if (!workshop.devnotaCompanyUuid) {
      return [];
    }
    return this.devnota.listExports(workshop.devnotaCompanyUuid);
  }

  async createExport(
    workshopId: string,
    dto: {
      tipo: 'nfse' | 'nfe' | 'nfce';
      filtro_data?: 'emissao' | 'competencia';
      data_inicial: string;
      data_final: string;
    },
  ) {
    const { workshop } = await this.getWorkshopAndEnv(workshopId);
    if (!workshop.devnotaCompanyUuid) {
      throw new BadRequestException(
        'A exportação em lote requer a oficina cadastrada/sincronizada na DevNota (Company-uuid).',
      );
    }

    return this.devnota.createExport(workshop.devnotaCompanyUuid, {
      tipo: dto.tipo,
      filtro_data: dto.filtro_data || 'emissao',
      data_inicial: dto.data_inicial,
      data_final: dto.data_final,
    });
  }

  async downloadExportZip(workshopId: string, exportUuid: string) {
    const { workshop } = await this.getWorkshopAndEnv(workshopId);
    if (!workshop.devnotaCompanyUuid) {
      throw new BadRequestException('Oficina não vinculada à DevNota.');
    }
    return this.devnota.downloadExport(exportUuid, workshop.devnotaCompanyUuid);

  }

  // Prévia das notas que entrarão no pacote ZIP do contador
  async previewLocalExport(
    workshopId: string,
    filters: {
      tipo?: string;
      startDate?: string;
      endDate?: string;
      includeCancelled?: boolean;
    },
  ) {
    const where: any = {
      workshopId,
      status: { in: filters.includeCancelled ? ['AUTORIZADA', 'CANCELADA'] : ['AUTORIZADA'] },
    };

    if (filters.tipo && filters.tipo.toUpperCase() !== 'ALL') {
      where.tipo = filters.tipo.toUpperCase();
    }

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = new Date(`${filters.startDate}T00:00:00-03:00`);
      }
      if (filters.endDate) {
        where.createdAt.lte = new Date(`${filters.endDate}T23:59:59-03:00`);
      }
    }

    const invoices = await this.prisma.fiscalInvoice.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        tipo: true,
        finalidade: true,
        status: true,
        numero: true,
        serie: true,
        protocolo: true,
        chaveAcesso: true,
        valorTotal: true,
        createdAt: true,
        uuidDevnota: true,
      },
    });

    const totalValue = invoices.reduce((acc, inv) => acc + Number(inv.valorTotal || 0), 0);

    return {
      count: invoices.length,
      totalValue,
      items: invoices,
    };
  }

  // Gera e devolve o arquivo .ZIP (XMLs + PDFs + CSV resumo) pronto para o contador
  async generateLocalExportZip(
    workshopId: string,
    dto: {
      tipo?: string;
      startDate?: string;
      endDate?: string;
      includePdf?: boolean;
      includeCancelled?: boolean;
    },
  ): Promise<{ buffer: Buffer; filename: string; count: number }> {
    const preview = await this.previewLocalExport(workshopId, dto);

    if (preview.items.length === 0) {
      throw new BadRequestException(
        'Nenhuma nota autorizada encontrada para o tipo e período selecionados.',
      );
    }

    const files: { name: string; data: Buffer }[] = [];
    const csvRows: string[] = [
      'Tipo;Finalidade;Numero;Serie;Status;Data Emissao;Valor Total;Chave de Acesso;Protocolo',
    ];

    for (const inv of preview.items) {
      const baseName = `${inv.tipo.toLowerCase()}-${inv.numero || inv.protocolo || inv.id.slice(0, 8)}`;

      // 1. Garante e anexa o XML
      try {
        const xmlData = await this.fetchXml(workshopId, inv.id);
        if (xmlData?.xmlBase64) {
          const raw = String(xmlData.xmlBase64).trim();
          const xmlBuffer = raw.startsWith('<')
            ? Buffer.from(raw, 'utf8')
            : Buffer.from(raw.replace(/\s+/g, ''), 'base64');
          files.push({ name: `xml/${baseName}.xml`, data: xmlBuffer });
        }
      } catch {
        // Segue a exportação mesmo se algum documento específico ainda não tiver XML disponível
      }

      // 2. Opcionalmente anexa o PDF (DANFE / DANFSE / DANFCE)
      if (dto.includePdf !== false) {
        try {
          const synced = await this.syncAndFetchPdf(workshopId, inv.id);
          if (synced?.pdfBase64) {
            const cleanPdf = synced.pdfBase64
              .replace(/^data:application\/pdf;base64,/, '')
              .replace(/\s+/g, '');
            if (cleanPdf) {
              files.push({
                name: `pdf/${baseName}.pdf`,
                data: Buffer.from(cleanPdf, 'base64'),
              });
            }
          }
        } catch {
          // Segue caso o PDF de alguma nota específica falhe
        }
      }

      const dataFmt = new Date(inv.createdAt).toLocaleString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
      });
      const valorFmt = Number(inv.valorTotal || 0).toFixed(2).replace('.', ',');
      csvRows.push(
        [
          inv.tipo,
          inv.finalidade,
          inv.numero ?? '',
          inv.serie ?? '',
          inv.status,
          dataFmt,
          valorFmt,
          inv.chaveAcesso ? `'${inv.chaveAcesso}` : '',
          inv.protocolo ?? '',
        ].join(';'),
      );
    }

    // Planilha resumo em CSV compatível com Excel (UTF-8 com BOM)
    files.push({
      name: 'resumo-contador.csv',
      data: Buffer.from('\uFEFF' + csvRows.join('\n'), 'utf8'),
    });

    const buffer = this.buildZipBuffer(files);
    const tipoLabel = (dto.tipo || 'todas').toLowerCase();
    const inicioLabel = dto.startDate || 'inicio';
    const fimLabel = dto.endDate || 'fim';
    const filename = `contador-${tipoLabel}-${inicioLabel}_a_${fimLabel}.zip`;

    return { buffer, filename, count: preview.items.length };
  }

  private crc32(buf: Buffer): number {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      crc ^= buf[i];
      for (let j = 0; j < 8; j++) {
        crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
      }
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  private buildZipBuffer(files: { name: string; data: Buffer }[]): Buffer {
    const localParts: Buffer[] = [];
    const centralParts: Buffer[] = [];
    let offset = 0;

    const now = new Date();
    const dosTime =
      ((now.getHours() & 0x1f) << 11) |
      ((now.getMinutes() & 0x3f) << 5) |
      ((now.getSeconds() >> 1) & 0x1f);
    const dosDate =
      (((Math.max(now.getFullYear(), 1980) - 1980) & 0x7f) << 9) |
      (((now.getMonth() + 1) & 0x0f) << 5) |
      (now.getDate() & 0x1f);

    for (const file of files) {
      const nameBuf = Buffer.from(file.name, 'utf8');
      const dataBuf = file.data;
      const crc = this.crc32(dataBuf);

      const localHeader = Buffer.alloc(30);
      localHeader.writeUInt32LE(0x04034b50, 0);
      localHeader.writeUInt16LE(20, 4);
      localHeader.writeUInt16LE(0x0800, 6);
      localHeader.writeUInt16LE(0, 8);
      localHeader.writeUInt16LE(dosTime, 10);
      localHeader.writeUInt16LE(dosDate, 12);
      localHeader.writeUInt32LE(crc, 14);
      localHeader.writeUInt32LE(dataBuf.length, 18);
      localHeader.writeUInt32LE(dataBuf.length, 22);
      localHeader.writeUInt16LE(nameBuf.length, 26);
      localHeader.writeUInt16LE(0, 28);

      localParts.push(localHeader, nameBuf, dataBuf);

      const centralHeader = Buffer.alloc(46);
      centralHeader.writeUInt32LE(0x02014b50, 0);
      centralHeader.writeUInt16LE(20, 4);
      centralHeader.writeUInt16LE(20, 6);
      centralHeader.writeUInt16LE(0x0800, 8);
      centralHeader.writeUInt16LE(0, 10);
      centralHeader.writeUInt16LE(dosTime, 12);
      centralHeader.writeUInt16LE(dosDate, 14);
      centralHeader.writeUInt32LE(crc, 16);
      centralHeader.writeUInt32LE(dataBuf.length, 20);
      centralHeader.writeUInt32LE(dataBuf.length, 24);
      centralHeader.writeUInt16LE(nameBuf.length, 28);
      centralHeader.writeUInt16LE(0, 30);
      centralHeader.writeUInt16LE(0, 32);
      centralHeader.writeUInt16LE(0, 34);
      centralHeader.writeUInt16LE(0, 36);
      centralHeader.writeUInt32LE(0, 38);
      centralHeader.writeUInt32LE(offset, 42);

      centralParts.push(centralHeader, nameBuf);
      offset += localHeader.length + nameBuf.length + dataBuf.length;
    }

    const centralDir = Buffer.concat(centralParts);
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(0, 4);
    eocd.writeUInt16LE(0, 6);
    eocd.writeUInt16LE(files.length, 8);
    eocd.writeUInt16LE(files.length, 10);
    eocd.writeUInt32LE(centralDir.length, 12);
    eocd.writeUInt32LE(offset, 16);
    eocd.writeUInt16LE(0, 20);

    return Buffer.concat([...localParts, centralDir, eocd]);
  }

  async handleWebhook(payload: any) {
    const uuid = payload?.id || payload?.uuid || payload?.response?.id;
    const protocolo = payload?.protocolo;

    const existing = await this.prisma.fiscalInvoice.findFirst({
      where: {
        OR: [
          ...(uuid ? [{ uuidDevnota: String(uuid) }] : []),
          ...(protocolo ? [{ protocolo: Number(protocolo) }] : []),
        ],
      },
    });

    if (!existing) {
      return { received: true, matched: false };
    }

    const doc = payload?.response || payload;
    const rawStatus = String(doc?.status || payload?.status || '').toLowerCase();

    let nextStatus = existing.status;
    if (rawStatus === 'emitida' || rawStatus === 'autorizada' || rawStatus === 'processado') {
      nextStatus = 'AUTORIZADA';
    } else if (rawStatus === 'cancelada') {
      nextStatus = 'CANCELADA';
    } else if (rawStatus.includes('erro') || rawStatus === 'rejeitada') {
      nextStatus = 'REJEITADA';
    }

    const errorList = Array.isArray(doc?.response)
      ? doc.response.map((e: any) => e?.mensagem || e?.codigo).filter(Boolean).join(' | ')
      : null;

    await this.prisma.fiscalInvoice.update({
      where: { id: existing.id },
      data: {
        status: nextStatus,
        numero: doc?.numero ? Number(doc.numero) : existing.numero,
        serie: doc?.serie ? String(doc.serie) : existing.serie,
        chaveAcesso: doc?.chave || existing.chaveAcesso,
        linkPdf: doc?.link || existing.linkPdf,
        linkXml: doc?.xml || existing.linkXml,
        motivoRejeicao: errorList || existing.motivoRejeicao,
        retornoApi: JSON.stringify(payload),
      },
    });

    return { received: true, matched: true, invoiceId: existing.id, status: nextStatus };
  }

  // Reserva e incrementa o próximo número sequencial de forma atômica por oficina e tipo
  private async allocateNextNumber(
    workshopId: string,
    tipo: 'NFE' | 'NFCE' | 'NFSE',
  ): Promise<{ numero: number; serie: string }> {
    if (tipo === 'NFE') {
      const updated = await this.prisma.workshopSettings.update({
        where: { id: workshopId },
        data: { proximoNumeroNfe: { increment: 1 } },
      });
      return {
        numero: updated.proximoNumeroNfe - 1,
        serie: String(updated.serieNfe),
      };
    }

    if (tipo === 'NFCE') {
      const updated = await this.prisma.workshopSettings.update({
        where: { id: workshopId },
        data: { proximoNumeroNfce: { increment: 1 } },
      });
      return {
        numero: updated.proximoNumeroNfce - 1,
        serie: String(updated.serieNfce),
      };
    }

    const updated = await this.prisma.workshopSettings.update({
      where: { id: workshopId },
      data: { proximoNumeroRps: { increment: 1 } },
    });
    return {
      numero: updated.proximoNumeroRps - 1,
      serie: String(updated.serieRps),
    };
  }

  async prepareFromServiceOrder(workshopId: string, serviceOrderId: string) {
    const { workshop, ambiente } = await this.getWorkshopAndEnv(workshopId);

    const order = await this.prisma.serviceOrder.findFirst({
      where: { id: serviceOrderId, workshopId },
      include: {
        customer: true,
        vehicle: true,
        items: true,
        transactions: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Ordem de Serviço não encontrada nesta oficina.');
    }

    // Busca todas as notas já geradas para esta OS (isoladas por workshopId)
    const existingInvoices = await this.prisma.fiscalInvoice.findMany({
      where: { workshopId, serviceOrderId },
      orderBy: { createdAt: 'desc' },
    });

    const activeStatuses = ['PROCESSANDO', 'AUTORIZADA'];

    // Frente 1: Peças (NF-e ou NFC-e ativa impede duplicar venda das mesmas peças)
    const activePartsInvoice = existingInvoices.find(
      (inv) => (inv.tipo === 'NFE' || inv.tipo === 'NFCE') && activeStatuses.includes(inv.status),
    );

    // Frente 2: Serviços / Mão de Obra (totalmente independente da nota de peças)
    const activeServiceInvoice = existingInvoices.find(
      (inv) => inv.tipo === 'NFSE' && activeStatuses.includes(inv.status),
    );

    // Contador de tentativas por tipo (caso haja nota anterior REJEITADA ou CANCELADA)
    const nfeAttempts = existingInvoices.filter((i) => i.tipo === 'NFE').length + 1;
    const nfceAttempts = existingInvoices.filter((i) => i.tipo === 'NFCE').length + 1;
    const nfseAttempts = existingInvoices.filter((i) => i.tipo === 'NFSE').length + 1;

    const partItems = order.items.filter((i) => i.type === 'PART');
    const laborItems = order.items.filter((i) => i.type === 'LABOR');

    const partsSubtotal = partItems.reduce((acc, i) => acc + Number(i.totalPrice || 0), 0);
    const laborSubtotal = laborItems.reduce((acc, i) => acc + Number(i.totalPrice || 0), 0);

    // AQUI ENTRA O TRECHO NOVO DE EXTRAÇÃO E VALIDAÇÃO DO CLIENTE
    const customer = order.customer;
    const cleanDoc = (customer?.document || '').replace(/\D/g, '');
    const cleanPhone = (customer?.phone || '').replace(/\D/g, '');
    const cleanCep = (customer?.cep || '').replace(/\D/g, '');
    const cleanClientIbge = (customer?.codigoIbge || '').replace(/\D/g, '');
    const hasValidClientDoc = cleanDoc.length === 11 || cleanDoc.length === 14;
    const hasValidPhone = cleanPhone.length >= 6 && cleanPhone.length <= 20;

    const cleanWorkshopDoc = (workshop.document || '').replace(/\D/g, '');
    const vehicleInfo = order.vehicle
      ? `Veículo: ${order.vehicle.brand} ${order.vehicle.model} (${order.vehicle.year}) - Placa: ${order.vehicle.plate} - KM: ${order.currentKm}`
      : `OS #${order.number}`;

    const errors: Record<'NFE' | 'NFCE' | 'NFSE', string[]> = {
      NFE: [],
      NFCE: [],
      NFSE: [],
    };
    const warnings: string[] = [];

    if (!cleanWorkshopDoc && ambiente !== 'sandbox') {
      errors.NFE.push('CNPJ da oficina não configurado.');
      errors.NFCE.push('CNPJ da oficina não configurado.');
      errors.NFSE.push('CNPJ da oficina não configurado.');
    }

    if (!workshop.devnotaCompanyUuid && ambiente !== 'sandbox') {
      const msg = 'Oficina ainda não sincronizada com a DevNota (Company-uuid ausente).';
      errors.NFE.push(msg);
      errors.NFCE.push(msg);
      errors.NFSE.push(msg);
    }

    // Checagem detalhada dos dados do cliente exigidos pela NF-e (mesmo em sandbox)
    const missingCustomerFields: string[] = [];
    if (!customer?.name?.trim()) missingCustomerFields.push('Nome / Razão Social');
    if (!hasValidClientDoc) missingCustomerFields.push('CPF (11 dígitos) ou CNPJ (14 dígitos)');
    if (cleanCep.length !== 8) missingCustomerFields.push('CEP (8 dígitos)');
    if (!customer?.logradouro?.trim()) missingCustomerFields.push('Logradouro (Rua/Av.)');
    if (!customer?.numeroEndereco?.trim()) missingCustomerFields.push('Número do endereço');
    if (!customer?.bairro?.trim()) missingCustomerFields.push('Bairro');
    if (!customer?.uf?.trim() || customer.uf.trim().length !== 2) missingCustomerFields.push('UF (Estado)');
    if (cleanClientIbge.length !== 7) {
      missingCustomerFields.push('Código IBGE do município (preenchido automático pelo CEP)');
    }

    // Regras Frente Peças — NF-e (bloqueia ANTES de enviar à DevNota)
    if (activePartsInvoice) {
      errors.NFE.push(
        `As peças desta OS já possuem ${activePartsInvoice.tipo} ${activePartsInvoice.status.toLowerCase()} (Protocolo ${activePartsInvoice.protocolo || '—'}).`,
      );
    }
    if (partItems.length === 0) {
      errors.NFE.push('Não há peças (itens de produto) lançadas nesta OS.');
    }
    if (partsSubtotal <= 0) {
      errors.NFE.push('O valor total das peças precisa ser maior que R$ 0,00.');
    }
    if (missingCustomerFields.length > 0) {
      errors.NFE.push(
        `Dados do cliente incompletos para NF-e: ${missingCustomerFields.join(', ')}. Complete abaixo ou emita NFC-e (Cupom).`,
      );
    }
    if (!workshop.inscricaoEstadual && ambiente !== 'sandbox') {
      errors.NFE.push('Inscrição Estadual (IE) da oficina não informada.');
    }


    // Regras Frente Peças — NFC-e
    if (activePartsInvoice) {
      errors.NFCE.push(
        `As peças desta OS já possuem ${activePartsInvoice.tipo} ${activePartsInvoice.status.toLowerCase()} (Protocolo ${activePartsInvoice.protocolo || '—'}).`,
      );
    }
    if (partItems.length === 0) {
      errors.NFCE.push('Não há peças lançadas nesta OS para emitir NFC-e.');
    }
    if (partsSubtotal <= 0) {
      errors.NFCE.push('O valor total das peças precisa ser maior que R$ 0,00.');
    }
    if ((!workshop.cscId || !workshop.cscProducao) && ambiente === 'producao') {
      errors.NFCE.push('CSC / ID do CSC não configurado para emissão de NFC-e em produção.');
    }

    // Regras Frente Serviços — NFS-e (independente da frente de peças)
    if (activeServiceInvoice) {
      errors.NFSE.push(
        `A mão de obra desta OS já possui NFS-e ${activeServiceInvoice.status.toLowerCase()} (Protocolo ${activeServiceInvoice.protocolo || '—'}).`,
      );
    }
    if (laborItems.length === 0 || laborSubtotal <= 0) {
      errors.NFSE.push('Não há serviços/mão de obra com valor maior que R$ 0,00 nesta OS.');
    }
    if (!workshop.codigoIbge) {
      if (ambiente === 'sandbox') {
        warnings.push('Código IBGE do município da oficina não configurado.');
      } else {
        errors.NFSE.push('Código IBGE do município da oficina é obrigatório para NFS-e.');
      }
    }

    // Busca no catálogo de peças da oficina para tentar casar os dados fiscais (NCM, CFOP, CSOSN, etc.)
    const catalogParts = await this.prisma.catalogItem.findMany({
      where: { workshopId, type: 'PART' },
      select: {
        name: true,
        code: true,
        ncm: true,
        cest: true,
        cfopPadraoSaida: true,
        csosn: true,
        origem: true,
        unidadeMedida: true,
      },
    });

    const catalogByName = new Map<string, (typeof catalogParts)[number]>();
    for (const cp of catalogParts) {
      catalogByName.set(cp.name.trim().toLowerCase(), cp);
    }

    const buildPartItemsPayload = () =>
      partItems.map((item, idx) => {
        const matched = catalogByName.get(String(item.description || '').trim().toLowerCase());
        const ncm = (matched?.ncm || '87089990').replace(/\D/g, '').padEnd(8, '0').slice(0, 8);
        const cfop = (matched?.cfopPadraoSaida || '5102').replace(/\D/g, '').slice(0, 4) || '5102';
        const csosn = (matched?.csosn || '102').replace(/\D/g, '') || '102';
        const origem = matched?.origem || '0';
        const unidade = matched?.unidadeMedida || 'UN';

        return {
          codigo: matched?.code || String(idx + 1).padStart(6, '0'),
          descricao: item.description,
          cfop,
          ncm,
          ...(matched?.cest ? { cest: matched.cest.replace(/\D/g, '') } : {}),
          unidadeMedida: unidade,
          quantidade: Number(item.quantity || 1),
          valorUnitario: Number(item.unitPrice || 0),
          desconto: 0,
          impostos: {
            icms: {
              situacaoTributaria: csosn,
              origem,
              baseCalculo: 0,
              aliquota: 0,
              valor: 0,
            },
            pis: {
              situacaoTributaria: '07',
              baseCalculo: 0,
              aliquota: 0,
              valor: 0,
            },
            cofins: {
              situacaoTributaria: '07',
              baseCalculo: 0,
              aliquota: 0,
              valor: 0,
            },
          },
        };
      });


    const paymentTypeMap: Record<string, string> = {
      PIX: 'Pix',
      CASH: 'Dinheiro',
      CREDIT_CARD: 'CartaoCredito',
      DEBIT_CARD: 'CartaoDebito',
      BOLETO: 'BoletoBancario',
      TRANSFER: 'TransferenciaBancaria',
    };

    const incomeTransactions = (order.transactions || []).filter((t) => t.type === 'INCOME');
    const resolvedPaymentType =
      incomeTransactions.length > 0
        ? paymentTypeMap[incomeTransactions[0].paymentMethod] || 'Pix'
        : 'Pix';

    const nfePayload = {
      ambiente,
      referencia_externa: `os-${order.id}-pecas-nfe-t${nfeAttempts}`,
      numero: workshop.proximoNumeroNfe,
      serie: workshop.serieNfe,
      pedido: {
        naturezaOperacao: 'Venda de mercadoria',
        consumidorFinal: cleanDoc.length === 14 ? 'NAO' : 'SIM',
        presencaConsumidor: 'OperacaoPresencial',
        finalidade: 'Normal',
        informacoesComplementares: `${vehicleInfo}. Ref. OS #${order.number} (Peças). ${order.customerNotes || ''}`.trim(),
        pagamento: {
          formas: [{ tipo: resolvedPaymentType, valor: Number(partsSubtotal.toFixed(2)) }],
        },
      },
      cliente: {
        nome: customer?.name || '',
        cpfCnpj: cleanDoc,
        ...(customer?.email ? { email: customer.email } : {}),
        ...(customer?.phone ? { telefone: customer.phone } : {}),
        endereco: {
          uf: (customer?.uf || '').toUpperCase(),
          cidade: cleanClientIbge,
          logradouro: customer?.logradouro || '',
          numero: customer?.numeroEndereco || '',
          complemento: customer?.complemento || null,
          bairro: customer?.bairro || '',
          cep: cleanCep,
        },
      },
      itens: buildPartItemsPayload(),
    };

    const nfcePayload = {
      ambiente,
      referencia_externa: `os-${order.id}-pecas-nfce-t${nfceAttempts}`,
      numero: workshop.proximoNumeroNfce,
      serie: workshop.serieNfce,
      pedido: {
        naturezaOperacao: 'Venda de mercadoria',
        presencaConsumidor: 'OperacaoPresencial',
        informacoesComplementares: `${vehicleInfo}. Ref. OS #${order.number} (Peças)`.trim(),
        pagamento: {
          formas: [{ tipo: resolvedPaymentType, valor: Number(partsSubtotal.toFixed(2)) }],
        },
      },
      ...(hasValidClientDoc
        ? {
          cliente: {
            nome: customer?.name || 'Consumidor',
            cpfCnpj: cleanDoc,
            ...(customer?.email ? { email: customer.email } : {}),
            ...(customer?.phone ? { telefone: customer.phone } : {}),
          },
        }
        : {}),
      itens: buildPartItemsPayload(),
    };

    const rawServiceCode = workshop.codigoServicoPadrao || '140101';
    const digitsOnly = rawServiceCode.replace(/\D/g, '');
    const cTribNac =
      digitsOnly.length === 6 ? digitsOnly : digitsOnly.padEnd(6, '0').slice(0, 6);

    const brNow = this.getBrazilNow();

   const hasTomadorAddress =
      cleanCep.length === 8 && Boolean(customer?.logradouro?.trim()) && cleanClientIbge.length === 7;

    const laborDescriptionList =
      laborItems.map((l) => `${l.description} (${l.quantity}x)`).join('; ') ||
      order.technicalNotes ||
      `Serviços executados na OS #${order.number}`;

    const nfsePayload = {
      ambiente,
      referencia_externa: `os-${order.id}-servicos-nfse-t${nfseAttempts}`,
      rps: {
        numero: workshop.proximoNumeroRps,
        serie: workshop.serieRps,
      },
      dataEmissao: brNow.dateTimeOffset,
      dataCompetencia: brNow.date,
      tomador: {
        nome: customer?.name || 'Cliente',
        ...(hasValidClientDoc ? { cpfCnpj: cleanDoc } : {}),
        ...(customer?.email ? { email: customer.email } : {}),
        ...(hasValidPhone ? { telefone: cleanPhone } : {}),
        ...(hasTomadorAddress
          ? {
              endereco: {
                codigoMunicipioIBGE: cleanClientIbge,
                logradouro: customer?.logradouro || '',
                numero: customer?.numeroEndereco || 'S/N',
                ...(customer?.complemento ? { complemento: customer.complemento } : {}),
                bairro: customer?.bairro || '',
                cep: cleanCep,
              },
            }
          : {}),
      },
      servico: {
        codigoServico: cTribNac,
        codigoInterno: `OS${order.number}S`,
        discriminacao: `${laborDescriptionList} | ${vehicleInfo} | Ref. OS #${order.number}`,
        ...(workshop.codigoIbge
          ? { codigoMunicipioPrestacaoServicoIBGE: workshop.codigoIbge }
          : {}),
        informacoesComplementares: `${vehicleInfo}. Ref. OS #${order.number} (Mão de Obra)`,
        // Valores do serviço
        valores: {
          valor: Number(laborSubtotal.toFixed(2)),
          baseCalculo: Number(laborSubtotal.toFixed(2)),
          issRetido: 'NAO',
          tributacaoIssqn: 1,
          aliquotaIss: 5,
        },
      },
    };

    return {
      isPreviewOnly: true,
      disclaimer: 'DOCUMENTO NÃO PROTOCOLADO — SEM VALOR FISCAL',
      ambiente,
      warnings,
      missingCustomerFields,
      fiscalStatus: {
        parts: activePartsInvoice || null,
        services: activeServiceInvoice || null,
        history: existingInvoices,
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
        codigoIbge: workshop.codigoIbge || '',
        regimeTributario: workshop.regimeTributario || 'SIMPLES',
      },
      serviceOrder: {
        id: order.id,
        number: order.number,
        status: order.status,
        customer: order.customer,
        vehicle: order.vehicle,
        partsSubtotal,
        laborSubtotal,
        totalAmount: Number(order.totalAmount || 0),
      },
      drafts: {
        NFE: {
          count: partItems.length,
          total: partsSubtotal,
          errors: errors.NFE,
          canEmit: errors.NFE.length === 0,
          activeInvoice: activePartsInvoice?.tipo === 'NFE' ? activePartsInvoice : null,
          payload: nfePayload,
        },
        NFCE: {
          count: partItems.length,
          total: partsSubtotal,
          errors: errors.NFCE,
          canEmit: errors.NFCE.length === 0,
          activeInvoice: activePartsInvoice?.tipo === 'NFCE' ? activePartsInvoice : null,
          payload: nfcePayload,
        },
        NFSE: {
          count: laborItems.length,
          total: laborSubtotal,
          errors: errors.NFSE,
          canEmit: errors.NFSE.length === 0,
          activeInvoice: activeServiceInvoice || null,
          payload: nfsePayload,
        },
      },
    };
  }


  async emitFromServiceOrder(
    workshopId: string,
    serviceOrderId: string,
    tipo: 'NFE' | 'NFCE' | 'NFSE',
    customPayload?: any,
  ) {
    // 1. Valida se a oficina pode emitir nota fiscal (assinatura ativa, limite de notas, etc.)
    await this.billingService.assertCanEmitFiscal(workshopId, 1);
    // 2. Prepara o payload da nota fiscal a partir da OS, validando dados obrigatórios e regras de negócio
    const prepared = await this.prepareFromServiceOrder(workshopId, serviceOrderId);
    // 3. Verifica se o tipo de nota fiscal solicitado é válido e se pode ser emitido
    const normalizedType = String(tipo).toUpperCase() as 'NFE' | 'NFCE' | 'NFSE';
    // 4. Obtém o rascunho da nota fiscal correspondente ao tipo solicitado
    const baseDraft = prepared.drafts[normalizedType];

    if (!baseDraft) {
      throw new BadRequestException('Tipo de nota fiscal inválido. Use NFE, NFCE ou NFSE.');
    }

    // Bloqueia apenas se esta frente específica já tiver nota ativa ou pendência obrigatória
    if (!baseDraft.canEmit) {
      throw new BadRequestException(baseDraft.errors.join(' '));
    }

    // Aloca e incrementa o número sequencial no banco para nunca repetir número
    const allocated = await this.allocateNextNumber(workshopId, normalizedType);
    const rawPayload = customPayload ? { ...baseDraft.payload, ...customPayload } : { ...baseDraft.payload };

    // Garante no backend que número, série, referência e horário de Brasília sejam atualizados no momento do envio
    const brNow = this.getBrazilNow();
    rawPayload.referencia_externa = baseDraft.payload.referencia_externa;
    if (normalizedType === 'NFSE') {
      rawPayload.dataEmissao = brNow.dateTimeOffset;
      rawPayload.dataCompetencia = brNow.date;
      rawPayload.rps = {
        ...(rawPayload.rps || {}),
        numero: allocated.numero,
        serie: allocated.serie,
      };
    } else {
      rawPayload.numero = allocated.numero;
      rawPayload.serie = Number(allocated.serie);
    }

    return this.emitDocument(workshopId, normalizedType, rawPayload, {
      
      serviceOrderId,
      customerId: prepared.serviceOrder.customer?.id,
      finalidade: 'NORMAL',
      valorTotal: baseDraft.total,
    });
  }

  // Método: emite Peças (NFE ou NFCE) + Mão de Obra (NFSE) em sequência na mesma OS
  async emitBothFromServiceOrder(
    workshopId: string,
    serviceOrderId: string,
    partsDocType: 'NFE' | 'NFCE' = 'NFE',
  ) {
    const normalizedParts = partsDocType === 'NFCE' ? 'NFCE' : 'NFE';
    const prepared = await this.prepareFromServiceOrder(workshopId, serviceOrderId);

    const results: {
      parts: { attempted: boolean; ok: boolean; data?: any; error?: string };
      services: { attempted: boolean; ok: boolean; data?: any; error?: string };
    } = {
      parts: { attempted: false, ok: false },
      services: { attempted: false, ok: false },
    };

    // 1. Emite Peças (se houver peças e ainda não tiver nota ativa)
    if (prepared.drafts[normalizedParts].canEmit) {
      results.parts.attempted = true;
      try {
        results.parts.data = await this.emitFromServiceOrder(
          workshopId,
          serviceOrderId,
          normalizedParts,
        );
        results.parts.ok = true;
      } catch (err: any) {
        results.parts.error = this.formatApiError(err, 'Erro ao emitir nota de peças.');
      }
    } else {
      results.parts.error = prepared.drafts[normalizedParts].errors.join(' ');
    }

    // 2. Emite Mão de Obra (independentemente do resultado das peças)
    if (prepared.drafts.NFSE.canEmit) {
      results.services.attempted = true;
      try {
        results.services.data = await this.emitFromServiceOrder(
          workshopId,
          serviceOrderId,
          'NFSE',
        );
        results.services.ok = true;
      } catch (err: any) {
        results.services.error = this.formatApiError(err, 'Erro ao emitir NFS-e.');
      }
    } else {
      results.services.error = prepared.drafts.NFSE.errors.join(' ');
    }

    return results;
  }


  async syncAndFetchPdf(workshopId: string, invoiceId: string) {
    const { workshop } = await this.getWorkshopAndEnv(workshopId);
    const invoice = await this.prisma.fiscalInvoice.findFirst({
      where: { id: invoiceId, workshopId },
    });

    if (!invoice) throw new NotFoundException('Nota fiscal não encontrada.');

    const companyUuid = workshop.devnotaCompanyUuid || undefined;
    let uuidDevnota = invoice.uuidDevnota;
    let status = invoice.status;
    let numero = invoice.numero;
    let serie = invoice.serie;
    let chaveAcesso = invoice.chaveAcesso;
    let linkPdf = invoice.linkPdf;
    let motivoRejeicao = invoice.motivoRejeicao;

    // 1. Se ainda está PROCESSANDO e temos protocolo, consulta o status atualizado na DevNota
    if (invoice.protocolo && (status === 'PROCESSANDO' || !uuidDevnota)) {
      const protoRes = await this.devnota.getProtocol(invoice.protocolo);
      const doc = protoRes?.response || protoRes;
      const rawStatus = String(doc?.status || protoRes?.status || '').toLowerCase();

      if (doc?.id || doc?.uuid) uuidDevnota = String(doc.id || doc.uuid);
      if (doc?.numero) numero = Number(doc.numero);
      if (doc?.serie) serie = String(doc.serie);
      if (doc?.chave) chaveAcesso = doc.chave;
      if (doc?.link) linkPdf = doc.link;

      if (rawStatus === 'emitida' || rawStatus === 'autorizada' || rawStatus === 'processado') {
        status = 'AUTORIZADA';
      } else if (rawStatus.includes('erro') || rawStatus === 'rejeitada') {
        status = 'REJEITADA';
        if (Array.isArray(doc?.response)) {
          motivoRejeicao = doc.response.map((e: any) => e?.mensagem || e?.codigo).join(' | ');
        }
      }
    }

    // 2. Busca o PDF em base64 na DevNota se já tiver UUID da nota
    let pdfBase64 = invoice.pdfBase64;
    if (uuidDevnota && !pdfBase64 && status === 'AUTORIZADA') {
      try {
        const tipoSlug =
          invoice.tipo === 'NFCE'
            ? 'nfc'
            : (invoice.tipo.toLowerCase() as 'nfe' | 'nfse');
        const pdfRes = await this.devnota.getDocumentPdf(tipoSlug, uuidDevnota, companyUuid);
        if (pdfRes?.success !== false) {
          pdfBase64 =
            pdfRes?.content ||
            pdfRes?.pdf ||
            pdfRes?.base64 ||
            (typeof pdfRes === 'string' ? pdfRes : null);
        }
      } catch {
        // Ainda gerando PDF
      }
    }

    const updated = await this.prisma.fiscalInvoice.update({
      where: { id: invoice.id },
      data: {
        uuidDevnota,
        status,
        numero,
        serie,
        chaveAcesso,
        linkPdf,
        pdfBase64,
        motivoRejeicao,
      },
    });

    return updated;
  }

  private formatApiError(err: any, fallback: string): string {
    const res = typeof err?.getResponse === 'function' ? err.getResponse() : err?.response?.data || err?.response;
    if (res?.errors && typeof res.errors === 'object') {
      const details = Object.entries(res.errors)
        .map(([field, msgs]) => `${field}: ${Array.isArray(msgs) ? msgs.join(', ') : msgs}`)
        .join(' | ');
      if (details) return details;
    }
    return res?.message || err?.message || fallback;
  }

  // Atualiza os dados fiscais de um cliente (CPF/CNPJ, endereço, etc.)
  async updateCustomerFiscalData(
    workshopId: string,
    customerId: string,
    dto: {
      name?: string;
      document?: string;
      email?: string;
      phone?: string;
      cep?: string;
      logradouro?: string;
      numeroEndereco?: string;
      complemento?: string;
      bairro?: string;
      cidade?: string;
      uf?: string;
      codigoIbge?: string;
    },
  ) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, workshopId },
    });

    if (!customer) {
      throw new NotFoundException('Cliente não encontrado nesta oficina.');
    }

    const cleanDoc = dto.document !== undefined ? dto.document.replace(/\D/g, '') : undefined;
    if (cleanDoc !== undefined && cleanDoc.length !== 11 && cleanDoc.length !== 14) {
      throw new BadRequestException('Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.');
    }

    const cleanCep = dto.cep !== undefined ? dto.cep.replace(/\D/g, '') : undefined;
    const cleanIbge = dto.codigoIbge !== undefined ? dto.codigoIbge.replace(/\D/g, '') : undefined;

    return this.prisma.customer.update({
      where: { id: customer.id },
      data: {
        ...(dto.name ? { name: dto.name.trim() } : {}),
        ...(cleanDoc !== undefined ? { document: cleanDoc } : {}),
        ...(dto.email !== undefined ? { email: dto.email?.trim() || null } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(cleanCep !== undefined ? { cep: cleanCep } : {}),
        ...(dto.logradouro !== undefined ? { logradouro: dto.logradouro?.trim() || null } : {}),
        ...(dto.numeroEndereco !== undefined ? { numeroEndereco: dto.numeroEndereco?.trim() || null } : {}),
        ...(dto.complemento !== undefined ? { complemento: dto.complemento?.trim() || null } : {}),
        ...(dto.bairro !== undefined ? { bairro: dto.bairro?.trim() || null } : {}),
        ...(dto.cidade !== undefined ? { cidade: dto.cidade?.trim() || null } : {}),
        ...(dto.uf !== undefined ? { uf: dto.uf?.trim().toUpperCase() || null } : {}),
        ...(cleanIbge !== undefined ? { codigoIbge: cleanIbge } : {}),
      },
    });
  }

  // Retorna a data e hora atual no fuso horário do Brasil (São Paulo)
  private getBrazilNow() {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(now);

    const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
    const date = `${map.year}-${map.month}-${map.day}`; // Ex.: "2026-11-21"
    const time = `${map.hour}:${map.minute}:${map.second}`; // Ex.: "23:14:40"

    return {
      date,
      dateTimeOffset: `${date}T${time}-03:00`, // Ex.: "2026-11-21T23:14:40-03:00"
    };
  }


}