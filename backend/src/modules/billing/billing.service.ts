// backend/src/modules/billing/billing.service.ts

import {
  Injectable,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { BillingCycle, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AsaasApiService } from './asaas-api.service';

export interface CheckoutDto {
  planId: string;
  billingCycle: 'MONTHLY' | 'YEARLY';
  billingType: 'PIX' | 'BOLETO' | 'CREDIT_CARD';
  installments?: number;
  customer: {
    name: string;
    cpfCnpj: string;
    email: string;
    phone: string;
    postalCode: string;
    addressNumber: string;
  };
  creditCard?: {
    holderName: string;
    number: string;
    expiryMonth: string;
    expiryYear: string;
    ccv: string;
  };
}

@Injectable()
export class BillingService {
  constructor(
    private prisma: PrismaService,
    private asaas: AsaasApiService,
  ) { }

  // Data YYYY-MM-DD no fuso de São Paulo (evita virar o dia em UTC à noite)
  private getBrazilDateIso(addDays = 0): string {
    const target = new Date(Date.now() + addDays * 24 * 60 * 60 * 1000);
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(target);
    const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
    return `${map.year}-${map.month}-${map.day}`;
  }

  private normalizeIp(rawIp?: string): string {
    const cleaned = String(rawIp || '').replace(/^::ffff:/, '').trim();
    if (!cleaned || cleaned === '::1') return '127.0.0.1';
    return cleaned;
  }

  private buildExternalReference(workshopId: string, planId: string, cycle: BillingCycle): string {
    // Formato compacto (<= 85 caracteres, dentro do limite de 100 do Asaas)
    return `op:${workshopId}:${planId}:${cycle}`;
  }

  private parseExternalReference(ref?: string | null): {
    workshopId?: string;
    planId?: string;
    billingCycle?: BillingCycle;
  } {
    if (!ref || !ref.startsWith('op:')) return {};
    const [, workshopId, planId, cycle] = ref.split(':');
    return {
      workshopId,
      planId,
      billingCycle: cycle === 'YEARLY' ? BillingCycle.YEARLY : BillingCycle.MONTHLY,
    };
  }

  // 1. Planos públicos (Landing Page + tela /admin/assinatura)
  async listPublicPlans() {
    return this.prisma.plan.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { monthlyPrice: 'asc' }],
    });
  }

  // 2. Status atual da assinatura da oficina + consumo do mês
  async getWorkshopSubscriptionStatus(workshopId: string) {
    let sub = await this.prisma.subscription.findUnique({
      where: { workshopId },
      include: {
        plan: true,
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 15,
        },
      },
    });

    if (!sub) {
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 30);
      sub = await this.prisma.subscription.create({
        data: { workshopId, status: SubscriptionStatus.TRIAL, trialEndsAt },
        include: { plan: true, payments: true },
      });
    }

    const now = new Date();
    let effectiveStatus = sub.status;

    if (
      sub.status === SubscriptionStatus.TRIAL &&
      sub.trialEndsAt < now &&
      !sub.manualOverride
    ) {
      effectiveStatus = SubscriptionStatus.EXPIRED;
      await this.prisma.subscription.update({
        where: { id: sub.id },
        data: { status: SubscriptionStatus.EXPIRED },
      });
    }

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const invoicesUsedThisMonth = await this.prisma.fiscalInvoice.count({
      where: {
        workshopId,
        createdAt: { gte: monthStart },
        status: { in: ['AUTORIZADA', 'PROCESSANDO'] },
      },
    });

    const usersCount = await this.prisma.user.count({
      where: { workshopId, isActive: true, role: { not: 'SUPER_ADMIN' } },
    });

    const trialDaysLeft =
      effectiveStatus === SubscriptionStatus.TRIAL
        ? Math.max(0, Math.ceil((sub.trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
        : 0;

    const isPaidActive =
      effectiveStatus === SubscriptionStatus.ACTIVE ||
      effectiveStatus === SubscriptionStatus.PAST_DUE;

    const allowFiscalEmission =
      isPaidActive &&
      Boolean(sub.plan?.allowFiscalEmission || (sub.customMonthlyInvoices && sub.customMonthlyInvoices > 0));

    const maxMonthlyInvoices = isPaidActive
      ? sub.customMonthlyInvoices ?? sub.plan?.maxMonthlyInvoices ?? 0
      : 0;

    const maxUsers = isPaidActive ? sub.plan?.maxUsers ?? 5 : 5;

    return {
      ...sub,
      status: effectiveStatus,
      trialDaysLeft,
      entitlements: {
        isLocked:
          effectiveStatus === SubscriptionStatus.EXPIRED ||
          effectiveStatus === SubscriptionStatus.CANCELED,
        allowFiscalEmission,
        maxMonthlyInvoices,
        invoicesUsedThisMonth,
        invoicesRemaining: Math.max(0, maxMonthlyInvoices - invoicesUsedThisMonth),
        maxUsers,
        usersCount,
      },
    };
  }

  // Trava 1: Verifica se a assinatura está ativa ou em trial válido
  async assertActiveSubscription(workshopId: string) {
    const sub = await this.getWorkshopSubscriptionStatus(workshopId);
    if (sub.entitlements.isLocked) {
      throw new ForbiddenException({
        code: 'SUBSCRIPTION_EXPIRED',
        message:
          'O período gratuito ou a assinatura da sua oficina expirou. Regularize em "Minha Assinatura" para continuar operando.',
      });
    }
    return sub;
  }

  // Trava 2: Valida permissão fiscal (somente plano pago fiscal) e cota mensal de notas
  async assertCanEmitFiscal(workshopId: string, neededInvoices = 1) {
    const sub = await this.assertActiveSubscription(workshopId);
    const { allowFiscalEmission, maxMonthlyInvoices, invoicesUsedThisMonth } = sub.entitlements;

    if (!allowFiscalEmission) {
      throw new ForbiddenException({
        code: 'FISCAL_UPGRADE_REQUIRED',
        message:
          'A emissão de notas fiscais (NF-e, NFC-e, NFS-e e Devolução) está disponível apenas nos planos fiscais pagos (a partir do Profissional 100). Faça upgrade em "Minha Assinatura".',
      });
    }

    if (invoicesUsedThisMonth + neededInvoices > maxMonthlyInvoices) {
      throw new ForbiddenException({
        code: 'FISCAL_QUOTA_EXCEEDED',
        message: `Você atingiu a cota mensal de ${invoicesUsedThisMonth}/${maxMonthlyInvoices} notas fiscais do seu plano atual. Faça upgrade em "Minha Assinatura" para continuar emitindo.`,
      });
    }

    return sub;
  }

  // Trava 3: Valida limite de usuários simultâneos do plano
  async assertCanCreateUser(workshopId: string) {
    const sub = await this.assertActiveSubscription(workshopId);
    const { usersCount, maxUsers } = sub.entitlements;

    if (usersCount >= maxUsers) {
      throw new ForbiddenException({
        code: 'USER_LIMIT_REACHED',
        message: `Limite de ${maxUsers} usuário(s) ativos do seu plano atingido. Faça upgrade em "Minha Assinatura" para adicionar mais membros à equipe.`,
      });
    }

    return sub;
  }

  // Garante cliente cadastrado no Asaas vinculado à Subscription da oficina
  private async ensureAsaasCustomer(
    subscription: { id: string; workshopId: string; asaasCustomerId: string | null },
    customer: CheckoutDto['customer'],
  ): Promise<string> {
    if (subscription.asaasCustomerId) {
      return subscription.asaasCustomerId;
    }

    const cleanCpfCnpj = String(customer.cpfCnpj || '').replace(/\D/g, '');
    if (cleanCpfCnpj.length !== 11 && cleanCpfCnpj.length !== 14) {
      throw new BadRequestException('Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.');
    }

    const existing = await this.asaas.findCustomerByCpfCnpj(cleanCpfCnpj);
    let asaasCustomerId = existing?.id;

    if (!asaasCustomerId) {
      const created = await this.asaas.createCustomer({
        name: customer.name.trim(),
        cpfCnpj: cleanCpfCnpj,
        email: customer.email.trim(),
        mobilePhone: String(customer.phone || '').replace(/\D/g, ''),
        postalCode: String(customer.postalCode || '').replace(/\D/g, ''),
        addressNumber: String(customer.addressNumber || 'S/N').trim(),
        externalReference: subscription.workshopId,
      });
      asaasCustomerId = created.id;
    }

    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: { asaasCustomerId },
    });

    return asaasCustomerId;
  }

  // 3. CHECKOUT ASAAS (Mensal: PIX/Boleto/Cartão 1x | Anual: PIX/Boleto à vista ou Cartão 1x..12x)
  async createCheckout(workshopId: string, dto: CheckoutDto, rawIp?: string) {
    const plan = await this.prisma.plan.findUnique({ where: { id: dto.planId } });
    if (!plan || !plan.isActive) {
      throw new NotFoundException('Plano não encontrado ou inativo.');
    }
    if (plan.isCustomContact) {
      throw new BadRequestException(
        'O plano Personalizado é contratado diretamente pelo WhatsApp comercial.',
      );
    }

    const billingCycle =
      dto.billingCycle === 'YEARLY' ? BillingCycle.YEARLY : BillingCycle.MONTHLY;
    const billingType = dto.billingType;

    if (!['PIX', 'BOLETO', 'CREDIT_CARD'].includes(billingType)) {
      throw new BadRequestException('Forma de pagamento inválida. Use PIX, BOLETO ou CREDIT_CARD.');
    }

    // Garante existência da Subscription
    const subStatus = await this.getWorkshopSubscriptionStatus(workshopId);
    const asaasCustomerId = await this.ensureAsaasCustomer(
      {
        id: subStatus.id,
        workshopId,
        asaasCustomerId: subStatus.asaasCustomerId,
      },
      dto.customer,
    );

    const cleanCpfCnpj = String(dto.customer.cpfCnpj || '').replace(/\D/g, '');
    const cleanPhone = String(dto.customer.phone || '').replace(/\D/g, '');
    const cleanCep = String(dto.customer.postalCode || '').replace(/\D/g, '');
    const remoteIp = this.normalizeIp(rawIp);

    // Validação do cartão (somente quando CREDIT_CARD) — nunca gravamos número/CVV no banco!
    let creditCardPayload: any = undefined;
    let creditCardHolderInfo: any = undefined;

    if (billingType === 'CREDIT_CARD') {
      const cc = dto.creditCard;
      const cleanNumber = String(cc?.number || '').replace(/\D/g, '');
      const cleanMonth = String(cc?.expiryMonth || '').replace(/\D/g, '').padStart(2, '0');
      const rawYear = String(cc?.expiryYear || '').replace(/\D/g, '');
      const cleanYear = rawYear.length === 2 ? `20${rawYear}` : rawYear;
      const cleanCcv = String(cc?.ccv || '').replace(/\D/g, '');

      if (!cc?.holderName?.trim() || cleanNumber.length < 13 || cleanCcv.length < 3) {
        throw new BadRequestException('Preencha corretamente os dados do cartão de crédito.');
      }
      if (cleanCep.length !== 8) {
        throw new BadRequestException('Informe um CEP válido (8 dígitos) para pagamento com cartão.');
      }

      creditCardPayload = {
        holderName: cc.holderName.trim().toUpperCase(),
        number: cleanNumber,
        expiryMonth: cleanMonth,
        expiryYear: cleanYear,
        ccv: cleanCcv,
      };

      creditCardHolderInfo = {
        name: dto.customer.name.trim(),
        email: dto.customer.email.trim(),
        cpfCnpj: cleanCpfCnpj,
        postalCode: cleanCep,
        addressNumber: String(dto.customer.addressNumber || 'S/N').trim(),
        phone: cleanPhone,
        mobilePhone: cleanPhone,
      };
    }

    const externalReference = this.buildExternalReference(workshopId, plan.id, billingCycle);
    const dueDate = billingType === 'BOLETO' ? this.getBrazilDateIso(3) : this.getBrazilDateIso(0);

    let asaasPayment: any = null;
    let createdAsaasSubscriptionId: string | null = null;
    let finalInstallments = 1;
    let finalAmount = 0;

    if (billingCycle === BillingCycle.MONTHLY) {
      // MENSAL: assinatura recorrente no Asaas (PIX, Boleto ou Cartão em 1x sem parcelamento)
      finalInstallments = 1;
      finalAmount = Number(plan.monthlyPrice);

      const subPayload: Record<string, any> = {
        customer: asaasCustomerId,
        billingType,
        value: finalAmount,
        nextDueDate: dueDate,
        cycle: 'MONTHLY',
        description: `Oficina Pro — Plano ${plan.name} (Mensal)`,
        externalReference,
        ...(billingType === 'CREDIT_CARD'
          ? {
            creditCard: creditCardPayload,
            creditCardHolderInfo,
            remoteIp,
          }
          : {}),
      };
      

      const createdSub = await this.asaas.createSubscription(subPayload);
      createdAsaasSubscriptionId = createdSub.id;

      // Busca a primeira cobrança gerada pela assinatura para exibir QR Code / Boleto / Status
      const subPayments = await this.asaas.listSubscriptionPayments(createdSub.id);
      asaasPayment = subPayments[0] || null;
    } else {
      // ANUAL:
      // - PIX ou BOLETO: pagamento à vista usando annualCashPrice
      // - CARTÃO: 1x a 12x usando annualCardPrice (juros já inclusos)
      if (billingType === 'CREDIT_CARD') {
        const maxInst = Math.max(1, Math.min(12, plan.maxInstallments || 12));
        finalInstallments = Math.max(1, Math.min(maxInst, Number(dto.installments || 1)));
        finalAmount = Number(plan.annualCardPrice || plan.annualCashPrice);
      } else {
        finalInstallments = 1;
        finalAmount = Number(plan.annualCashPrice);
      }

      const paymentPayload: Record<string, any> = {
        customer: asaasCustomerId,
        billingType,
        dueDate,
        description: `Oficina Pro — Plano ${plan.name} (Anual${finalInstallments > 1 ? ` ${finalInstallments}x` : ' à vista'
          })`,
        externalReference,
        // Regra oficial Asaas v3: 1x usa apenas "value"; >= 2x usa "installmentCount" + "totalValue"
        ...(finalInstallments > 1
          ? {
            installmentCount: finalInstallments,
            totalValue: finalAmount,
          }
          : {
            value: finalAmount,
          }),
        ...(billingType === 'CREDIT_CARD'
          ? {
            creditCard: creditCardPayload,
            creditCardHolderInfo,
            remoteIp,
          }
          : {}),
      };

      asaasPayment = await this.asaas.createPayment(paymentPayload);
    }

    if (!asaasPayment?.id) {
      throw new BadRequestException(
        'A cobrança foi solicitada no Asaas, mas não retornou o identificador do pagamento.',
      );
    }
    console.log('[Asaas] Cobrança criada:', {
      id: asaasPayment.id,
      billingType: asaasPayment.billingType,
      status: asaasPayment.status,
      dueDate: asaasPayment.dueDate,
      invoiceUrl: asaasPayment.invoiceUrl,
    });

    // Se for PIX, busca QR Code (Base64) + Copia e Cola
    let pixQrCodeBase64: string | null = null;
    let pixPayload: string | null = null;
    let pixError: string | null = null;
    if (billingType === 'PIX') {
      const pix = await this.asaas.getPixQrCode(asaasPayment.id, 2);
      if (pix?.encodedImage && pix?.payload) {
        pixQrCodeBase64 = pix.encodedImage;
        pixPayload = pix.payload;
      } else if (pix?.permanentError) {
        pixError =
          pix.errorMessage ||
          'Não foi possível gerar o QR Code PIX. Verifique se a chave PIX está ativa no Asaas.';
      }
    }

    const paymentStatus = String(asaasPayment.status || 'PENDING').toUpperCase();
    const isConfirmedNow = paymentStatus === 'CONFIRMED' || paymentStatus === 'RECEIVED';

    const savedPayment = await this.prisma.subscriptionPayment.upsert({
      where: { asaasPaymentId: asaasPayment.id },
      update: {
        status: paymentStatus,
        amount: finalAmount,
        installments: finalInstallments,
        invoiceUrl: asaasPayment.invoiceUrl || null,
        bankSlipUrl: asaasPayment.bankSlipUrl || null,
        pixQrCodeBase64,
        pixPayload,
        ...(isConfirmedNow ? { paidAt: new Date() } : {}),
      },
      create: {
        subscriptionId: subStatus.id,
        asaasPaymentId: asaasPayment.id,
        billingType,
        billingCycle,
        installments: finalInstallments,
        amount: finalAmount,
        status: paymentStatus,
        dueDate: new Date(`${asaasPayment.dueDate || dueDate}T12:00:00.000Z`),
        paidAt: isConfirmedNow ? new Date() : null,
        invoiceUrl: asaasPayment.invoiceUrl || null,
        bankSlipUrl: asaasPayment.bankSlipUrl || null,
        pixQrCodeBase64,
        pixPayload,
        webhookPayload: JSON.stringify({
          source: 'checkout',
          targetPlanId: plan.id,
          billingCycle,
          asaasSubscriptionId: createdAsaasSubscriptionId,
        }),
      },
    });

    // Se já aprovou na hora (Cartão de Crédito), ativa o plano e libera o módulo fiscal imediatamente
    if (isConfirmedNow) {
      await this.activateSubscription({
        subscriptionId: subStatus.id,
        targetPlanId: plan.id,
        billingCycle,
        newAsaasSubscriptionId: createdAsaasSubscriptionId,
      });
    }

    const updatedSubscription = await this.getWorkshopSubscriptionStatus(workshopId);

    return {
      confirmed: isConfirmedNow,
      payment: savedPayment,
      subscription: updatedSubscription,
      pixError,
    };
  }

  // Ativa/renova assinatura e cancela eventual assinatura recorrente anterior no Asaas
  private async activateSubscription(params: {
    subscriptionId: string;
    targetPlanId?: string;
    billingCycle: BillingCycle;
    newAsaasSubscriptionId?: string | null;
  }) {
    const current = await this.prisma.subscription.findUnique({
      where: { id: params.subscriptionId },
    });
    if (!current) return;

    // Se havia uma assinatura recorrente anterior diferente no Asaas, cancela para evitar cobrança dupla
    if (
      current.asaasSubscriptionId &&
      current.asaasSubscriptionId !== params.newAsaasSubscriptionId
    ) {
      try {
        await this.asaas.deleteSubscription(current.asaasSubscriptionId);
      } catch {
        // Segue ativação mesmo se a assinatura antiga já estava cancelada
      }
    }

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setDate(
      periodEnd.getDate() + (params.billingCycle === BillingCycle.YEARLY ? 365 : 30),
    );

    await this.prisma.subscription.update({
      where: { id: current.id },
      data: {
        status: SubscriptionStatus.ACTIVE,
        ...(params.targetPlanId ? { planId: params.targetPlanId } : {}),
        billingCycle: params.billingCycle,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        asaasSubscriptionId:
          params.billingCycle === BillingCycle.YEARLY
            ? null
            : params.newAsaasSubscriptionId ?? current.asaasSubscriptionId,
      },
    });
  }

  // 4. Sincronização manual de um pagamento (útil no Sandbox local e no botão "Já paguei")
  async syncPaymentStatus(workshopId: string, paymentId: string) {
    const payment = await this.prisma.subscriptionPayment.findFirst({
      where: {
        id: paymentId,
        subscription: { workshopId },
      },
      include: { subscription: true },
    });

    if (!payment || !payment.asaasPaymentId) {
      throw new NotFoundException('Cobrança não encontrada para esta oficina.');
    }

    const remote = await this.asaas.getPayment(payment.asaasPaymentId);
    const remoteStatus = String(remote?.status || payment.status).toUpperCase();
    const isConfirmed = remoteStatus === 'CONFIRMED' || remoteStatus === 'RECEIVED';

    const updatedPayment = await this.prisma.subscriptionPayment.update({
      where: { id: payment.id },
      data: {
        status: remoteStatus,
        paidAt: isConfirmed ? payment.paidAt || new Date() : payment.paidAt,
        invoiceUrl: remote?.invoiceUrl || payment.invoiceUrl,
        bankSlipUrl: remote?.bankSlipUrl || payment.bankSlipUrl,
      },
    });

    if (isConfirmed) {
      const parsedRef = this.parseExternalReference(remote?.externalReference);
      let meta: any = {};
      try {
        meta = payment.webhookPayload ? JSON.parse(payment.webhookPayload) : {};
      } catch {
        meta = {};
      }

      await this.activateSubscription({
        subscriptionId: payment.subscriptionId,
        targetPlanId: parsedRef.planId || meta.targetPlanId || payment.subscription.planId || undefined,
        billingCycle: parsedRef.billingCycle || payment.billingCycle,
        newAsaasSubscriptionId: remote?.subscription || meta.asaasSubscriptionId || null,
      });
    }

    const subscription = await this.getWorkshopSubscriptionStatus(workshopId);
    return {
      confirmed: isConfirmed,
      payment: updatedPayment,
      subscription,
    };
  }

  // Busca (ou rebusca) o QR Code PIX sob demanda sem gerar nova cobrança nem cair para boleto
  async fetchPixQrCode(workshopId: string, paymentId: string) {
    const payment = await this.prisma.subscriptionPayment.findFirst({
      where: {
        id: paymentId,
        subscription: { workshopId },
      },
    });

    if (!payment || !payment.asaasPaymentId) {
      throw new NotFoundException('Cobrança PIX não encontrada para esta oficina.');
    }

    if (payment.billingType !== 'PIX') {
      throw new BadRequestException('Esta cobrança não é do tipo PIX.');
    }

    // Se já está salvo no banco, devolve instantaneamente
    if (payment.pixQrCodeBase64 && payment.pixPayload) {
      return {
        ready: true,
        payment,
      };
    }

    const pix = await this.asaas.getPixQrCode(payment.asaasPaymentId, 1);
    if (pix?.permanentError) {
      return {
        ready: false,
        permanentError: true,
        errorMessage: pix.errorMessage,
        payment,
      };
    }

    if (!pix?.encodedImage || !pix?.payload) {
      return {
        ready: false,
        permanentError: false,
        payment,
      };
    }

    const updated = await this.prisma.subscriptionPayment.update({
      where: { id: payment.id },
      data: {
        pixQrCodeBase64: pix.encodedImage,
        pixPayload: pix.payload,
      },
    });

    return {
      ready: true,
      payment: updated,
    };
  }

  // 5. Cancelar renovação automática da assinatura mensal no Asaas
  async cancelRecurringSubscription(workshopId: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { workshopId } });
    if (!sub) throw new NotFoundException('Assinatura não encontrada.');

    if (sub.asaasSubscriptionId) {
      try {
        await this.asaas.deleteSubscription(sub.asaasSubscriptionId);
      } catch {
        // Caso já tenha sido cancelada no painel do Asaas
      }
    }

    await this.prisma.subscription.update({
      where: { id: sub.id },
      data: {
        asaasSubscriptionId: null,
        status: SubscriptionStatus.CANCELED,
      },
    });

    return {
      message: 'Assinatura cancelada com sucesso.',
      subscription: await this.getWorkshopSubscriptionStatus(workshopId),
    };
  }

  // 6. WEBHOOK AUTOMÁTICO DO ASAAS (POST /billing/webhooks/asaas)
  async handleAsaasWebhook(tokenHeader: string | undefined, body: any) {
    const expectedToken = (process.env.ASAAS_WEBHOOK_TOKEN || '').trim();
    if (expectedToken && tokenHeader !== expectedToken) {
      throw new UnauthorizedException('Token de webhook Asaas inválido.');
    }

    const event = String(body?.event || '').toUpperCase();
    const payment = body?.payment;
    const subscriptionObj = body?.subscription;

    // Eventos de cancelamento de assinatura recorrente
    if (
      (event === 'SUBSCRIPTION_DELETED' || event === 'SUBSCRIPTION_INACTIVATED') &&
      subscriptionObj?.id
    ) {
      const sub = await this.prisma.subscription.findFirst({
        where: { asaasSubscriptionId: subscriptionObj.id },
      });
      if (sub) {
        await this.prisma.subscription.update({
          where: { id: sub.id },
          data: { status: SubscriptionStatus.CANCELED, asaasSubscriptionId: null },
        });
      }
      return { received: true, event };
    }

    if (!payment?.id) {
      return { received: true, ignored: true, event };
    }

    // Resolve qual Subscription pertence a este pagamento
    const existingPayment = await this.prisma.subscriptionPayment.findUnique({
      where: { asaasPaymentId: payment.id },
      include: { subscription: true },
    });

    const parsedRef = this.parseExternalReference(payment.externalReference);

    let subscription = existingPayment?.subscription || null;
    if (!subscription && parsedRef.workshopId) {
      subscription = await this.prisma.subscription.findUnique({
        where: { workshopId: parsedRef.workshopId },
      });
    }
    if (!subscription && payment.subscription) {
      subscription = await this.prisma.subscription.findFirst({
        where: { asaasSubscriptionId: payment.subscription },
      });
    }

    if (!subscription) {
      return { received: true, unmatched: true, event };
    }

    const paymentStatus = String(payment.status || 'PENDING').toUpperCase();
    const isPaidEvent =
      event === 'PAYMENT_CONFIRMED' ||
      event === 'PAYMENT_RECEIVED' ||
      paymentStatus === 'CONFIRMED' ||
      paymentStatus === 'RECEIVED';

    const cycle = parsedRef.billingCycle || existingPayment?.billingCycle || subscription.billingCycle;

    await this.prisma.subscriptionPayment.upsert({
      where: { asaasPaymentId: payment.id },
      update: {
        status: paymentStatus,
        paidAt: isPaidEvent ? existingPayment?.paidAt || new Date() : existingPayment?.paidAt,
        invoiceUrl: payment.invoiceUrl || existingPayment?.invoiceUrl,
        bankSlipUrl: payment.bankSlipUrl || existingPayment?.bankSlipUrl,
        webhookPayload: JSON.stringify(body),
      },
      create: {
        subscriptionId: subscription.id,
        asaasPaymentId: payment.id,
        billingType: String(payment.billingType || 'PIX'),
        billingCycle: cycle,
        installments: Number(payment.installmentCount || 1),
        amount: Number(payment.value || 0),
        status: paymentStatus,
        dueDate: payment.dueDate ? new Date(`${payment.dueDate}T12:00:00.000Z`) : new Date(),
        paidAt: isPaidEvent ? new Date() : null,
        invoiceUrl: payment.invoiceUrl || null,
        bankSlipUrl: payment.bankSlipUrl || null,
        webhookPayload: JSON.stringify(body),
      },
    });

    if (isPaidEvent) {
      await this.activateSubscription({
        subscriptionId: subscription.id,
        targetPlanId: parsedRef.planId || subscription.planId || undefined,
        billingCycle: cycle,
        newAsaasSubscriptionId: payment.subscription || null,
      });
    } else if (event === 'PAYMENT_OVERDUE') {
      // Marca PAST_DUE apenas se for cobrança da assinatura ativa atual
      const isCurrentActiveSub =
        !payment.subscription || subscription.asaasSubscriptionId === payment.subscription;
      if (subscription.status === SubscriptionStatus.ACTIVE && isCurrentActiveSub) {
        await this.prisma.subscription.update({
          where: { id: subscription.id },
          data: { status: SubscriptionStatus.PAST_DUE },
        });
      }
    } else if (event === 'PAYMENT_REFUNDED' || event === 'PAYMENT_CHARGEBACK_REQUESTED') {
      await this.prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: SubscriptionStatus.CANCELED },
      });
    }

    return { received: true, event, status: paymentStatus };
  }
}