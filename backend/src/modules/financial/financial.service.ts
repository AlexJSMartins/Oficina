import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  OrderStatus,
  PaymentMethod,
  TransactionType,
} from '@prisma/client';

export const TransactionCategory = {
  SERVICE_ORDER: 'SERVICE_ORDER',
  PARTS_COST: 'PARTS_COST',
  RENT: 'RENT',
  UTILITIES: 'UTILITIES',
  SALARY: 'SALARY',
  TOOLS: 'TOOLS',
  OTHER: 'OTHER',
} as const;

export type TransactionCategory =
  | (typeof TransactionCategory)[keyof typeof TransactionCategory]
  | string;

export interface SettlePaymentPart {
  paymentMethod: PaymentMethod;
  amount: number;
  installments?: number;
  customLabel?: string;
}

export interface BulkFinancialRow {
  date?: string | number;
  description: string;
  amount: string | number;
  type?: string;
  category?: string;
  paymentMethod?: string;
}

@Injectable()
export class FinancialService {
  constructor(private prisma: PrismaService) {}

  // 1. Baixa Financeira da OS (suporta Múltiplos Pagamentos e calcula CMV automático)
  async settleServiceOrder(
    orderId: string,
    body: { paymentMethod?: PaymentMethod; payments?: SettlePaymentPart[] },
    userId: string,
  ) {
    const order = await this.prisma.serviceOrder.findUnique({
      where: { id: orderId },
      include: { items: true, vehicle: true, customer: true },
    });

    if (!order) throw new NotFoundException('Ordem de Serviço não encontrada.');

    const totalRevenue = Number(order.totalAmount || 0);
    if (totalRevenue <= 0) {
      throw new BadRequestException(
        'Esta OS está com valor R$ 0,00. Adicione peças ou mão de obra no orçamento antes de dar baixa.',
      );
    }

    const totalPartsCost = order.items
      .filter((i) => i.type === 'PART')
      .reduce((acc, i) => acc + Number(i.costPrice || 0), 0);

    const paymentParts: SettlePaymentPart[] =
      body.payments && body.payments.length > 0
        ? body.payments
        : [
            {
              paymentMethod: body.paymentMethod || PaymentMethod.PIX,
              amount: totalRevenue,
              installments: 1,
            },
          ];

    return this.prisma.$transaction(async (tx) => {
      // Remove lançamentos anteriores desta OS caso ela tenha sido reaberta
      await tx.financialTransaction.deleteMany({
        where: { serviceOrderId: order.id },
      });

      const updatedOrder = await tx.serviceOrder.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.COMPLETED,
          exitDate: new Date(),
        },
      });

      // Registra cada parcela/forma de pagamento como Entrada
      for (const part of paymentParts) {
        const instText =
          part.installments && part.installments > 1 ? ` (${part.installments}x)` : '';
        const customText = part.customLabel ? ` [${part.customLabel}]` : '';

        await tx.financialTransaction.create({
          data: {
            type: TransactionType.INCOME,
            category: TransactionCategory.SERVICE_ORDER,
            description: `Recebimento OS #${order.number} - ${order.vehicle.plate} (${order.customer.name})${customText}${instText}`,
            amount: Number(part.amount),
            paymentMethod: part.paymentMethod,
            serviceOrderId: order.id,
            createdById: userId,
          },
        });
      }

      // Se houve custo de peças (CMV), registra a saída correspondente
      if (totalPartsCost > 0) {
        await tx.financialTransaction.create({
          data: {
            type: TransactionType.EXPENSE,
            category: TransactionCategory.PARTS_COST,
            description: `Custo de Peças (CMV) Ref. OS #${order.number} - ${order.vehicle.plate}`,
            amount: totalPartsCost,
            paymentMethod: PaymentMethod.TRANSFER,
            serviceOrderId: order.id,
            createdById: userId,
          },
        });
      }

      const summaryLabels = paymentParts
        .map(
          (p) =>
            `${p.customLabel || p.paymentMethod}${
              p.installments && p.installments > 1 ? ` ${p.installments}x` : ''
            }: R$ ${Number(p.amount).toFixed(2)}`,
        )
        .join(' | ');

      await tx.orderTimeline.create({
        data: {
          serviceOrderId: order.id,
          status: OrderStatus.COMPLETED,
          description: `Pagamento recebido (${summaryLabels}) e veículo entregue ao cliente.`,
          isPublic: true,
          createdById: userId,
        },
      });

      return updatedOrder;
    });
  }

  // 2. Criar Lançamento Manual (Despesa ou Entrada Avulsa com suporte a data personalizada)
  async createTransaction(
    dto: {
      type: TransactionType;
      category: TransactionCategory;
      description: string;
      amount: number;
      paymentMethod: PaymentMethod;
      date?: string;
    },
    userId: string,
  ) {
    let parsedDate = new Date();
    if (dto.date) {
      const d = new Date(`${dto.date}T12:00:00`);
      if (!isNaN(d.getTime())) parsedDate = d;
    }

    return this.prisma.financialTransaction.create({
      data: {
        type: dto.type,
        category: dto.category,
        description: dto.description,
        amount: Number(dto.amount),
        paymentMethod: dto.paymentMethod,
        date: parsedDate,
        createdById: userId,
      },
    });
  }

  // 3. Excluir Lançamento
  async deleteTransaction(id: string) {
    return this.prisma.financialTransaction.delete({ where: { id } });
  }

  // 4. Dashboard + DRE + Detalhamento Mão de Obra vs Peças + Filtro por Calendário
  async getDashboardData(params: {
    month?: number;
    year?: number;
    startDate?: string;
    endDate?: string;
  }) {
    let start: Date;
    let end: Date;

    if (params.startDate && params.endDate) {
      start = new Date(`${params.startDate}T00:00:00.000`);
      end = new Date(`${params.endDate}T23:59:59.999`);
    } else {
      const now = new Date();
      const m = params.month || now.getMonth() + 1;
      const y = params.year || now.getFullYear();
      start = new Date(y, m - 1, 1, 0, 0, 0);
      end = new Date(y, m, 0, 23, 59, 59, 999);
    }

    const transactions = await this.prisma.financialTransaction.findMany({
      where: {
        date: { gte: start, lte: end },
      },
      include: {
        serviceOrder: {
          include: {
            items: true,
            vehicle: { select: { plate: true, brand: true, model: true } },
            customer: { select: { name: true } },
          },
        },
      },
      orderBy: { date: 'desc' },
    });

    let grossRevenue = 0;
    let partsCost = 0;
    let operatingExpenses = 0;
    let laborRevenue = 0;
    let partsRevenue = 0;
    let otherIncome = 0;

    const enrichedTransactions = transactions.map((t) => {
      const amount = Number(t.amount || 0);
      let txLaborAmount = 0;
      let txPartsAmount = 0;

      if (t.type === TransactionType.INCOME) {
        grossRevenue += amount;

        if (t.serviceOrder && t.serviceOrder.items && t.serviceOrder.items.length > 0) {
          const osLabor = t.serviceOrder.items
            .filter((i) => i.type === 'LABOR')
            .reduce((acc, i) => acc + Number(i.totalPrice || 0), 0);
          const osParts = t.serviceOrder.items
            .filter((i) => i.type === 'PART')
            .reduce((acc, i) => acc + Number(i.totalPrice || 0), 0);
          const osItemsSum = osLabor + osParts;

          if (osItemsSum > 0) {
            txLaborAmount = Number(((amount * osLabor) / osItemsSum).toFixed(2));
            txPartsAmount = Number(((amount * osParts) / osItemsSum).toFixed(2));
          } else {
            txLaborAmount = amount;
          }
          laborRevenue += txLaborAmount;
          partsRevenue += txPartsAmount;
        } else if (t.category === TransactionCategory.SERVICE_ORDER) {
          txLaborAmount = amount;
          laborRevenue += amount;
        } else {
          otherIncome += amount;
        }
      } else {
        if (t.category === TransactionCategory.PARTS_COST) {
          partsCost += amount;
        } else {
          operatingExpenses += amount;
        }
      }

      return {
        ...t,
        laborAmount: txLaborAmount,
        partsAmount: txPartsAmount,
      };
    });

    const grossProfit = grossRevenue - partsCost;
    const netProfit = grossProfit - operatingExpenses;
    const profitMargin = grossRevenue > 0 ? (netProfit / grossRevenue) * 100 : 0;

    return {
      summary: {
        grossRevenue,
        laborRevenue,
        partsRevenue,
        otherIncome,
        partsCost,
        grossProfit,
        operatingExpenses,
        netProfit,
        profitMargin,
      },
      transactions: enrichedTransactions,
    };
  }

  // 5. IMPORTAÇÃO EM LOTE DE CUSTOS E LANÇAMENTOS FINANCEIROS VIA PLANILHA
  async bulkImport(rows: BulkFinancialRow[], userId: string) {
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      throw new BadRequestException('Nenhum lançamento válido encontrado na planilha.');
    }

    const parseMoney = (val: any): number => {
      if (typeof val === 'number') return Math.abs(val);
      if (!val) return 0;
      const str = String(val).replace(/[R$\s]/g, '');
      if (str.includes(',') && str.includes('.')) {
        return Math.abs(Number(str.replace(/\./g, '').replace(',', '.'))) || 0;
      }
      if (str.includes(',')) {
        return Math.abs(Number(str.replace(',', '.'))) || 0;
      }
      return Math.abs(Number(str)) || 0;
    };

    const parseFlexibleDate = (val: any): Date => {
      if (!val) return new Date();
      if (typeof val === 'number') {
        return new Date(Math.round((val - 25569) * 86400 * 1000));
      }
      const str = String(val).trim();
      const brMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
      if (brMatch) {
        const day = Number(brMatch[1]);
        const month = Number(brMatch[2]) - 1;
        const year = brMatch[3].length === 2 ? 2000 + Number(brMatch[3]) : Number(brMatch[3]);
        const d = new Date(year, month, day, 12, 0, 0);
        if (!isNaN(d.getTime())) return d;
      }
      const parsed = new Date(str);
      return isNaN(parsed.getTime()) ? new Date() : parsed;
    };

    const normalize = (s: any) =>
      String(s || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();

    const mapType = (rawType: any, rawCat: any, rawAmount: any): TransactionType => {
      const t = normalize(rawType);
      const c = normalize(rawCat);
      if (
        t.includes('entrada') ||
        t.includes('receita') ||
        t.includes('income') ||
        t.includes('credito') ||
        c.includes('os') ||
        c.includes('servico')
      ) {
        return TransactionType.INCOME;
      }
      if (String(rawAmount || '').trim().startsWith('+')) {
        return TransactionType.INCOME;
      }
      return TransactionType.EXPENSE;
    };

    const mapCategory = (rawCat: any, desc: any, type: TransactionType): string => {
      const text = `${normalize(rawCat)} ${normalize(desc)}`;
      if (type === TransactionType.INCOME) {
        if (text.includes('os') || text.includes('servico') || text.includes('mao de obra')) {
          return TransactionCategory.SERVICE_ORDER;
        }
        return TransactionCategory.OTHER;
      }
      if (
        text.includes('peca') ||
        text.includes('insumo') ||
        text.includes('cmv') ||
        text.includes('fornecedor') ||
        text.includes('auto pecas')
      ) {
        return TransactionCategory.PARTS_COST;
      }
      if (
        text.includes('aluguel') ||
        text.includes('iptu') ||
        text.includes('imovel') ||
        text.includes('condominio')
      ) {
        return TransactionCategory.RENT;
      }
      if (
        text.includes('luz') ||
        text.includes('agua') ||
        text.includes('energia') ||
        text.includes('internet') ||
        text.includes('cpfl') ||
        text.includes('sabesp') ||
        text.includes('telefone')
      ) {
        return TransactionCategory.UTILITIES;
      }
      if (
        text.includes('salario') ||
        text.includes('comissao') ||
        text.includes('folha') ||
        text.includes('mecanico') ||
        text.includes('adiantamento') ||
        text.includes('vale')
      ) {
        return TransactionCategory.SALARY;
      }
      if (
        text.includes('ferramenta') ||
        text.includes('equipamento') ||
        text.includes('elevador') ||
        text.includes('scanner') ||
        text.includes('manutencao')
      ) {
        return TransactionCategory.TOOLS;
      }
      return TransactionCategory.OTHER;
    };

    const mapPaymentMethod = (rawMethod: any): PaymentMethod => {
      const m = normalize(rawMethod);
      if (m.includes('pix')) return PaymentMethod.PIX;
      if (m.includes('credito') || m.includes('credit')) return PaymentMethod.CREDIT_CARD;
      if (m.includes('debito') || m.includes('debit')) return PaymentMethod.DEBIT_CARD;
      if (m.includes('dinheiro') || m.includes('especie') || m.includes('cash'))
        return PaymentMethod.CASH;
      if (m.includes('boleto')) return PaymentMethod.BOLETO;
      if (m.includes('ted') || m.includes('doc') || m.includes('transf'))
        return PaymentMethod.TRANSFER;
      return PaymentMethod.PIX;
    };

    let importedCount = 0;
    let skippedCount = 0;

    for (const row of rows) {
      const desc = String(row.description || '').trim();
      const amount = parseMoney(row.amount);

      if (!desc || amount <= 0) {
        skippedCount++;
        continue;
      }

      const txType = mapType(row.type, row.category, row.amount);
      const txCategory = mapCategory(row.category, desc, txType);
      const txMethod = mapPaymentMethod(row.paymentMethod);
      const txDate = parseFlexibleDate(row.date);

      try {
        await this.prisma.financialTransaction.create({
          data: {
            type: txType,
            category: txCategory,
            description: desc,
            amount,
            paymentMethod: txMethod,
            date: txDate,
            createdById: userId,
          },
        });
        importedCount++;
      } catch {
        skippedCount++;
      }
    }

    return {
      message: 'Planilha financeira importada com sucesso!',
      stats: {
        totalReceived: rows.length,
        importedCount,
        skippedCount,
      },
    };
  }

  // 6. RELATÓRIO DE PRODUTIVIDADE E COMISSÕES
  async getMechanicProductivity(params: { startDate?: string; endDate?: string; month?: number; year?: number }) {
    let start: Date;
    let end: Date;

    if (params.startDate && params.endDate) {
      start = new Date(`${params.startDate}T00:00:00.000`);
      end = new Date(`${params.endDate}T23:59:59.999`);
    } else {
      const now = new Date();
      const m = params.month || now.getMonth() + 1;
      const y = params.year || now.getFullYear();
      start = new Date(y, m - 1, 1, 0, 0, 0);
      end = new Date(y, m, 0, 23, 59, 59, 999);
    }

    // Busca apenas OS finalizadas que possuem mecânico vinculado
    const orders = await this.prisma.serviceOrder.findMany({
      where: {
        status: 'COMPLETED',
        exitDate: { gte: start, lte: end },
        mechanicId: { not: null },
      },
      include: {
        mechanic: { select: { id: true, name: true, commissionRate: true } },
        vehicle: { select: { plate: true, brand: true, model: true } },
        items: true,
      },
    });

    const report: Record<string, any> = {};
    let totalCommissions = 0;
    let totalLaborTeam = 0;

    orders.forEach((os) => {
      const mech = os.mechanic;
      if (!mech) return;

      if (!report[mech.id]) {
        report[mech.id] = {
          id: mech.id,
          name: mech.name,
          defaultRate: mech.commissionRate || 0,
          osCount: 0,
          laborRevenue: 0,
          commissionOwed: 0,
          orders: [],
        };
      }
      


      // Isola o valor gerado APENAS por Mão de Obra (despreza peças)
      const laborTotal = os.items.filter((i) => i.type === 'LABOR').reduce((acc, i) => acc + Number(i.totalPrice || 0), 0);
      
      // Define a taxa: usa a combinada da OS ou a padrão do mecânico
      const activeRate = os.mechanicCommissionRate !== null ? os.mechanicCommissionRate : (mech.commissionRate || 0);
      const commission = (laborTotal * activeRate) / 100;

      report[mech.id].osCount += 1;
      report[mech.id].laborRevenue += laborTotal;
      report[mech.id].commissionOwed += commission;

      totalCommissions += commission;
      totalLaborTeam += laborTotal;

      report[mech.id].orders.push({
        id: os.id,
        number: os.number,
        plate: os.vehicle.plate,
        car: `${os.vehicle.brand} ${os.vehicle.model}`,
        exitDate: os.exitDate,
        laborTotal,
        activeRate,
        commission,
      });
    });

    return {
      totalCommissions,
      totalLaborTeam,
      mechanics: Object.values(report).sort((a: any, b: any) => b.laborRevenue - a.laborRevenue), // Ordena pelos que mais produziram
    };
  }
}