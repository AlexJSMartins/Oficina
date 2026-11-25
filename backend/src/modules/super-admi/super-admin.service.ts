import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { BillingCycle, Role, SubscriptionStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';

interface LoginAttemptRecord {
  count: number;
  blockedUntil?: number;
}

@Injectable()
export class SuperAdminService {
  // Rate limit em memória para tentativas inválidas no /console (5 erros = bloqueio de 15 min)
  private loginAttempts = new Map<string, LoginAttemptRecord>();

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  // =========================================================
  // 1. AUTENTICAÇÃO SECRETA DO /console (APENAS SUPER_ADMIN)
  // =========================================================
  async loginSuperAdmin(email: string, password: string, clientIp: string) {
    const now = Date.now();
    const record = this.loginAttempts.get(clientIp);

    if (record?.blockedUntil && record.blockedUntil > now) {
      const waitMin = Math.ceil((record.blockedUntil - now) / 60000);
      throw new HttpException(
        `Too many failed attempts. Try again in ${waitMin} minute(s).`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const cleanEmail = String(email || '').toLowerCase().trim();
    const user = await this.prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    const isValidRole = user && user.isActive && user.role === Role.SUPER_ADMIN;
    const isPasswordMatch = isValidRole
      ? await bcrypt.compare(String(password || ''), user.passwordHash)
      : false;

    if (!isValidRole || !isPasswordMatch) {
      const nextCount = (record?.count || 0) + 1;
      this.loginAttempts.set(clientIp, {
        count: nextCount,
        blockedUntil: nextCount >= 5 ? now + 15 * 60 * 1000 : undefined,
      });
      // Mensagem genérica padrão Linux (não revela se o e-mail existe ou não)
      throw new UnauthorizedException('Login incorrect');
    }

    this.loginAttempts.delete(clientIp);

    const payload = {
      sub: user.id,
      workshopId: user.workshopId,
      email: user.email,
      role: user.role,
      permissions: ['*'],
    };

    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }

  // =========================================================
  // 2. VISÃO GERAL / KPIs DO SAAS (MRR, TRIALS, CUSTO DEVNOTA)
  // =========================================================
  async getOverview() {
    const now = new Date();
    const fiveDaysFromNow = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);

    const [workshops, totalInvoicesThisMonth] = await Promise.all([
      this.prisma.workshopSettings.findMany({
        include: {
          subscription: {
            include: { plan: true },
          },
        },
      }),
      this.prisma.fiscalInvoice.count({
        where: {
          createdAt: { gte: monthStart },
          status: { in: ['AUTORIZADA', 'PROCESSANDO'] },
        },
      }),
    ]);

    let activeCount = 0;
    let trialCount = 0;
    let expiringSoonCount = 0;
    let pastDueCount = 0;
    let expiredCount = 0;
    let mrr = 0;

    for (const ws of workshops) {
      const sub = ws.subscription;
      if (!sub) continue;

      let status = sub.status;
      if (status === SubscriptionStatus.TRIAL && sub.trialEndsAt < now && !sub.manualOverride) {
        status = SubscriptionStatus.EXPIRED;
      }

      if (status === SubscriptionStatus.ACTIVE) {
        activeCount++;
        if (sub.customMonthlyPrice !== null && sub.customMonthlyPrice !== undefined) {
          mrr += Number(sub.customMonthlyPrice);
        } else if (sub.plan) {
          const monthlyValue =
            sub.billingCycle === BillingCycle.YEARLY
              ? Number(sub.plan.annualCashPrice || 0) / 12
              : Number(sub.plan.monthlyPrice || 0);
          mrr += monthlyValue;
        }
      } else if (status === SubscriptionStatus.TRIAL) {
        trialCount++;
        if (sub.trialEndsAt <= fiveDaysFromNow) {
          expiringSoonCount++;
        }
      } else if (status === SubscriptionStatus.PAST_DUE) {
        pastDueCount++;
      } else {
        expiredCount++;
      }
    }

    // Estimativa do custo DevNota (R$ 47 a cada bloco de 100 notas)
    const estimatedDevNotaCost =
      totalInvoicesThisMonth > 0 ? Math.ceil(totalInvoicesThisMonth / 100) * 47 : 0;

    return {
      totalWorkshops: workshops.length,
      activeCount,
      trialCount,
      expiringSoonCount,
      pastDueCount,
      expiredCount,
      mrr: Number(mrr.toFixed(2)),
      totalInvoicesThisMonth,
      estimatedDevNotaCost,
    };
  }

  // =========================================================
  // 3. CRUD DE PLANOS & PREÇOS (ALIMENTA LANDING PAGE + CHECKOUT)
  // =========================================================
  async listAllPlans() {
    return this.prisma.plan.findMany({
      include: {
        _count: { select: { subscriptions: true } },
      },
      orderBy: [{ sortOrder: 'asc' }, { monthlyPrice: 'asc' }],
    });
  }

  async createPlan(dto: any) {
    const slug = String(dto.slug || dto.name || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    if (!slug || !dto.name) {
      throw new BadRequestException('Nome e identificador (slug) do plano são obrigatórios.');
    }

    const exists = await this.prisma.plan.findUnique({ where: { slug } });
    if (exists) {
      throw new BadRequestException(`Já existe um plano com o slug "${slug}".`);
    }

    return this.prisma.plan.create({
      data: {
        slug,
        name: String(dto.name).trim(),
        subtitle: dto.subtitle ? String(dto.subtitle).trim() : null,
        badge: dto.badge ? String(dto.badge).trim() : null,
        isPopular: Boolean(dto.isPopular),
        isActive: dto.isActive !== undefined ? Boolean(dto.isActive) : true,
        isCustomContact: Boolean(dto.isCustomContact),
        whatsappNumber: dto.whatsappNumber
          ? String(dto.whatsappNumber).replace(/\D/g, '')
          : null,
        whatsappMessage: dto.whatsappMessage ? String(dto.whatsappMessage).trim() : null,
        sortOrder: Number(dto.sortOrder ?? 0),
        features: Array.isArray(dto.features)
          ? dto.features.map((f: any) => String(f).trim()).filter(Boolean)
          : [],
        monthlyPrice: Number(dto.monthlyPrice ?? 0),
        annualCashPrice: Number(dto.annualCashPrice ?? 0),
        annualCardPrice: Number(dto.annualCardPrice ?? 0),
        maxInstallments: Math.max(1, Math.min(12, Number(dto.maxInstallments ?? 12))),
        allowFiscalEmission: Boolean(dto.allowFiscalEmission),
        maxMonthlyInvoices: Math.max(0, Number(dto.maxMonthlyInvoices ?? 0)),
        maxUsers: Math.max(1, Number(dto.maxUsers ?? 5)),
      },
    });
  }

  async updatePlan(id: string, dto: any) {
    const existing = await this.prisma.plan.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Plano não encontrado.');

    return this.prisma.plan.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: String(dto.name).trim() } : {}),
        ...(dto.subtitle !== undefined ? { subtitle: dto.subtitle ? String(dto.subtitle).trim() : null } : {}),
        ...(dto.badge !== undefined ? { badge: dto.badge ? String(dto.badge).trim() : null } : {}),
        ...(dto.isPopular !== undefined ? { isPopular: Boolean(dto.isPopular) } : {}),
        ...(dto.isActive !== undefined ? { isActive: Boolean(dto.isActive) } : {}),
        ...(dto.isCustomContact !== undefined ? { isCustomContact: Boolean(dto.isCustomContact) } : {}),
        ...(dto.whatsappNumber !== undefined
          ? { whatsappNumber: dto.whatsappNumber ? String(dto.whatsappNumber).replace(/\D/g, '') : null }
          : {}),
        ...(dto.whatsappMessage !== undefined
          ? { whatsappMessage: dto.whatsappMessage ? String(dto.whatsappMessage).trim() : null }
          : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: Number(dto.sortOrder) } : {}),
        ...(dto.features !== undefined
          ? {
              features: Array.isArray(dto.features)
                ? dto.features.map((f: any) => String(f).trim()).filter(Boolean)
                : [],
            }
          : {}),
        ...(dto.monthlyPrice !== undefined ? { monthlyPrice: Number(dto.monthlyPrice) } : {}),
        ...(dto.annualCashPrice !== undefined ? { annualCashPrice: Number(dto.annualCashPrice) } : {}),
        ...(dto.annualCardPrice !== undefined ? { annualCardPrice: Number(dto.annualCardPrice) } : {}),
        ...(dto.maxInstallments !== undefined
          ? { maxInstallments: Math.max(1, Math.min(12, Number(dto.maxInstallments))) }
          : {}),
        ...(dto.allowFiscalEmission !== undefined
          ? { allowFiscalEmission: Boolean(dto.allowFiscalEmission) }
          : {}),
        ...(dto.maxMonthlyInvoices !== undefined
          ? { maxMonthlyInvoices: Math.max(0, Number(dto.maxMonthlyInvoices)) }
          : {}),
        ...(dto.maxUsers !== undefined ? { maxUsers: Math.max(1, Number(dto.maxUsers)) } : {}),
      },
    });
  }

  async deletePlan(id: string) {
    const plan = await this.prisma.plan.findUnique({
      where: { id },
      include: { _count: { select: { subscriptions: true } } },
    });
    if (!plan) throw new NotFoundException('Plano não encontrado.');

    if (plan._count.subscriptions > 0) {
      throw new BadRequestException(
        `Existem ${plan._count.subscriptions} oficina(s) vinculadas a este plano. Desative o plano para ocultá-lo da Landing Page em vez de excluir.`,
      );
    }

    return this.prisma.plan.delete({ where: { id } });
  }

  // =========================================================
  // 4. GESTÃO DE OFICINAS & LEADS (CRM SAAS)
  // =========================================================
  async listWorkshops(params: { search?: string; status?: string }) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);

    const [workshops, monthlyInvoicesGrouped] = await Promise.all([
      this.prisma.workshopSettings.findMany({
        include: {
          subscription: {
            include: { plan: true },
          },
          users: {
            where: { role: { not: Role.SUPER_ADMIN } },
            select: { id: true, name: true, email: true, role: true, isActive: true },
            orderBy: { createdAt: 'asc' },
          },
          _count: {
            select: {
              serviceOrders: true,
              customers: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.fiscalInvoice.groupBy({
        by: ['workshopId'],
        where: {
          createdAt: { gte: monthStart },
          status: { in: ['AUTORIZADA', 'PROCESSANDO'] },
        },
        _count: { id: true },
      }),
    ]);

    const invoiceCountMap = new Map<string, number>();
    for (const row of monthlyInvoicesGrouped) {
      invoiceCountMap.set(row.workshopId, row._count.id);
    }

    const q = (params.search || '').trim().toLowerCase();
    const statusFilter = (params.status || '').toUpperCase();

    const mapped = workshops.map((ws) => {
      const sub = ws.subscription;
      const adminUser = ws.users.find((u) => u.role === Role.ADMIN) || ws.users[0] || null;

      let effectiveStatus: string = sub?.status || 'TRIAL';
      if (
        sub &&
        sub.status === SubscriptionStatus.TRIAL &&
        sub.trialEndsAt < now &&
        !sub.manualOverride
      ) {
        effectiveStatus = 'EXPIRED';
      }

      const trialDaysLeft =
        sub && effectiveStatus === 'TRIAL'
          ? Math.max(0, Math.ceil((sub.trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
          : 0;

      const invoicesUsedThisMonth = invoiceCountMap.get(ws.id) || 0;
      const isPaid = effectiveStatus === 'ACTIVE' || effectiveStatus === 'PAST_DUE';
      const invoicesLimit = isPaid
        ? sub?.customMonthlyInvoices ?? sub?.plan?.maxMonthlyInvoices ?? 0
        : 0;

      return {
        id: ws.id,
        name: ws.name,
        document: ws.document,
        phone: ws.phone,
        ambienteFiscal: ws.ambienteFiscal,
        createdAt: ws.createdAt,
        adminUser,
        usersCount: ws.users.length,
        ordersCount: ws._count.serviceOrders,
        customersCount: ws._count.customers,
        invoicesUsedThisMonth,
        invoicesLimit,
        effectiveStatus,
        trialDaysLeft,
        subscription: sub,
      };
    });

    return mapped.filter((item) => {
      if (q) {
        const matchText =
          item.name.toLowerCase().includes(q) ||
          (item.document || '').toLowerCase().includes(q) ||
          (item.phone || '').toLowerCase().includes(q) ||
          (item.adminUser?.name || '').toLowerCase().includes(q) ||
          (item.adminUser?.email || '').toLowerCase().includes(q);
        if (!matchText) return false;
      }

      if (statusFilter && statusFilter !== 'ALL') {
        if (statusFilter === 'EXPIRING') {
          return item.effectiveStatus === 'TRIAL' && item.trialDaysLeft <= 5;
        }
        return item.effectiveStatus === statusFilter;
      }

      return true;
    });
  }

  // Atalho rápido: estender Trial em +7, +15 ou +30 dias
  async extendTrial(workshopId: string, days: number) {
    const safeDays = Math.max(1, Math.min(365, Number(days || 7)));
    const existing = await this.prisma.subscription.findUnique({ where: { workshopId } });

    const baseDate =
      existing && existing.trialEndsAt > new Date() ? new Date(existing.trialEndsAt) : new Date();
    baseDate.setDate(baseDate.getDate() + safeDays);

    if (!existing) {
      return this.prisma.subscription.create({
        data: {
          workshopId,
          status: SubscriptionStatus.TRIAL,
          trialEndsAt: baseDate,
        },
        include: { plan: true },
      });
    }

    return this.prisma.subscription.update({
      where: { workshopId },
      data: {
        status: SubscriptionStatus.TRIAL,
        trialEndsAt: baseDate,
      },
      include: { plan: true },
    });
  }

  // Gestão completa da assinatura da oficina (Plano, Personalizado, Cota Custom, Cortesia, Bloqueio)
  async updateWorkshopSubscription(workshopId: string, dto: any) {
    const workshop = await this.prisma.workshopSettings.findUnique({ where: { id: workshopId } });
    if (!workshop) throw new NotFoundException('Oficina não encontrada.');

    const existing = await this.prisma.subscription.findUnique({ where: { workshopId } });

    const defaultTrialEnd = new Date();
    defaultTrialEnd.setDate(defaultTrialEnd.getDate() + 30);

    const parsedTrialEnd = dto.trialEndsAt ? new Date(dto.trialEndsAt) : undefined;
    const parsedPeriodEnd = dto.currentPeriodEnd ? new Date(dto.currentPeriodEnd) : undefined;

    const data: any = {
      ...(dto.planId !== undefined ? { planId: dto.planId || null } : {}),
      ...(dto.status ? { status: dto.status as SubscriptionStatus } : {}),
      ...(dto.billingCycle ? { billingCycle: dto.billingCycle as BillingCycle } : {}),
      ...(parsedTrialEnd && !Number.isNaN(parsedTrialEnd.getTime())
        ? { trialEndsAt: parsedTrialEnd }
        : {}),
      ...(dto.currentPeriodEnd !== undefined
        ? {
            currentPeriodEnd:
              parsedPeriodEnd && !Number.isNaN(parsedPeriodEnd.getTime()) ? parsedPeriodEnd : null,
          }
        : {}),
      ...(dto.customMonthlyInvoices !== undefined
        ? {
            customMonthlyInvoices:
              dto.customMonthlyInvoices === '' || dto.customMonthlyInvoices === null
                ? null
                : Math.max(0, Number(dto.customMonthlyInvoices)),
          }
        : {}),
      ...(dto.customMonthlyPrice !== undefined
        ? {
            customMonthlyPrice:
              dto.customMonthlyPrice === '' || dto.customMonthlyPrice === null
                ? null
                : Number(dto.customMonthlyPrice),
          }
        : {}),
      ...(dto.manualOverride !== undefined ? { manualOverride: Boolean(dto.manualOverride) } : {}),
      ...(dto.adminNotes !== undefined ? { adminNotes: dto.adminNotes || null } : {}),
    };

    if (!existing) {
      return this.prisma.subscription.create({
        data: {
          workshopId,
          status: (dto.status as SubscriptionStatus) || SubscriptionStatus.TRIAL,
          trialEndsAt: parsedTrialEnd || defaultTrialEnd,
          ...data,
        },
        include: { plan: true },
      });
    }

    return this.prisma.subscription.update({
      where: { workshopId },
      data,
      include: { plan: true },
    });
  }

  // =========================================================
  // 5. HISTÓRICO CONSOLIDADO DE FATURAS / PAGAMENTOS (ASAAS)
  // =========================================================
  async listPayments(status?: string) {
    return this.prisma.subscriptionPayment.findMany({
      where: status && status !== 'ALL' ? { status: status.toUpperCase() } : undefined,
      include: {
        subscription: {
          include: {
            workshop: { select: { id: true, name: true, document: true, phone: true } },
            plan: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 150,
    });
  }
}