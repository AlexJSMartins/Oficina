// frontend/src/pages/admin/SubscriptionPage.tsx
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { api, useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import {
  CreditCard,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileText,
  Users,
  MessageCircle,
  QrCode,
  Barcode,
  Copy,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  X,
  Lock,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

import { DocumentInput, PhoneInput } from '../../components/MaskedInputs';
import { useSubscription } from '../../contexts/SubscriptionContext';


interface Plan {
  id: string;
  slug: string;
  name: string;
  subtitle?: string | null;
  badge?: string | null;
  isPopular: boolean;
  isCustomContact: boolean;
  whatsappNumber?: string | null;
  whatsappMessage?: string | null;
  monthlyPrice: number;
  annualCashPrice: number;
  annualCardPrice: number;
  maxInstallments: number;
  allowFiscalEmission: boolean;
  maxMonthlyInvoices: number;
  maxUsers: number;
  features: string[];
}

const fmtMoney = (v?: number) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const SUB_STATUS_META: Record<string, { label: string; cls: string }> = {
  TRIAL: { label: 'Teste Grátis (30 dias)', cls: 'bg-blue-100 text-blue-800 border-blue-200' },
  ACTIVE: { label: 'Assinatura Ativa', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  PAST_DUE: { label: 'Fatura em Atraso', cls: 'bg-amber-100 text-amber-900 border-amber-300' },
  EXPIRED: { label: 'Período Expirado', cls: 'bg-red-100 text-red-800 border-red-200' },
  CANCELED: { label: 'Cancelada', cls: 'bg-slate-200 text-slate-700 border-slate-300' },
};

const PAY_STATUS_META: Record<string, { label: string; cls: string }> = {
  PENDING: { label: 'Aguardando Pagamento', cls: 'bg-amber-100 text-amber-800' },
  CONFIRMED: { label: 'Confirmado', cls: 'bg-emerald-100 text-emerald-800' },
  RECEIVED: { label: 'Pago', cls: 'bg-emerald-600 text-white' },
  OVERDUE: { label: 'Vencido', cls: 'bg-red-100 text-red-800' },
  REFUNDED: { label: 'Estornado', cls: 'bg-slate-200 text-slate-700' },
  CANCELED: { label: 'Cancelado', cls: 'bg-slate-200 text-slate-700' },
};

export default function SubscriptionPage() {
  const { user } = useAuth();
  const { refreshSubscription } = useSubscription();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<any>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [billingCycle, setBillingCycle] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');

  // Dados pré-carregados da oficina para agilizar o checkout
  const [customerForm, setCustomerForm] = useState({
    name: '',
    cpfCnpj: '',
    email: '',
    phone: '',
    postalCode: '',
    addressNumber: '',
  });

  // Estado do Modal de Checkout
  const [checkoutPlan, setCheckoutPlan] = useState<Plan | null>(null);
  const [billingType, setBillingType] = useState<'PIX' | 'BOLETO' | 'CREDIT_CARD'>('PIX');
  const [installments, setInstallments] = useState<number>(1);
  const [cardForm, setCardForm] = useState({
    holderName: '',
    number: '',
    expiry: '', // MM/AA
    ccv: '',
  });
  const [submittingCheckout, setSubmittingCheckout] = useState(false);
  const [checkoutResult, setCheckoutResult] = useState<any | null>(null);
  const [syncingPaymentId, setSyncingPaymentId] = useState<string | null>(null);
  const [cancelingSub, setCancelingSub] = useState(false);

  // Estado de polling para buscar QR Code PIX caso ainda não esteja pronto
  const [fetchingPixQr, setFetchingPixQr] = useState(false);
  const [pixQrError, setPixQrError] = useState<string | null>(null);

  const handleRetryPixQrCode = async (paymentId: string): Promise<'READY' | 'STOP' | 'RETRY'> => {
    setFetchingPixQr(true);
    try {
      const { data } = await api.get(`/billing/payments/${paymentId}/pix-qrcode`);
      if (data?.ready && data?.payment) {
        setPixQrError(null);
        setCheckoutResult((prev: any) =>
          prev ? { ...prev, payment: data.payment, pixError: null } : prev,
        );
        setSubscription((prev: any) => {
          if (!prev) return prev;
          return {
            ...prev,
            payments: (prev.payments || []).map((p: any) =>
              p.id === paymentId ? data.payment : p,
            ),
          };
        });
        return 'READY';
      }

      if (data?.permanentError) {
        setPixQrError(
          data.errorMessage ||
          'O Asaas recusou o QR Code PIX. Verifique a Chave PIX na conta ou use o link da fatura abaixo.',
        );
        return 'STOP';
      }
      return 'RETRY';
    } catch {
      return 'RETRY';
    } finally {
      setFetchingPixQr(false);
    }
  };

  // Busca sequencial (sem sobrepor chamadas) — para imediatamente se vier erro definitivo
  useEffect(() => {
    const payment = checkoutResult?.payment;
    if (
      !checkoutPlan ||
      !payment?.id ||
      checkoutResult?.confirmed ||
      payment.billingType !== 'PIX' ||
      pixQrError ||
      (payment.pixQrCodeBase64 && payment.pixPayload)
    ) {
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const pollQr = async (attempt: number) => {
      if (cancelled || attempt > 4) return;
      const status = await handleRetryPixQrCode(payment.id);
      if (!cancelled && status === 'RETRY' && attempt < 4) {
        timer = setTimeout(() => pollQr(attempt + 1), 2500);
      }
    };

    timer = setTimeout(() => pollQr(1), 1500);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [checkoutPlan, checkoutResult?.payment?.id, checkoutResult?.confirmed, pixQrError]);


  const loadData = async () => {
    setLoading(true);
    try {
      const [subRes, plansRes, settingsRes] = await Promise.all([
        api.get('/billing/my-subscription'),
        api.get('/billing/plans'),
        api.get('/settings').catch(() => ({ data: null })),
      ]);

      setSubscription(subRes.data);
      setPlans(plansRes.data || []);

      const ws = settingsRes.data;
      setCustomerForm((prev) => ({
        name: prev.name || ws?.name || user?.name || '',
        cpfCnpj: prev.cpfCnpj || ws?.document || '',
        email: prev.email || user?.email || '',
        phone: prev.phone || ws?.phone || '',
        postalCode: prev.postalCode || ws?.cep || '',
        addressNumber: prev.addressNumber || ws?.numeroEndereco || '',
      }));
    } catch {
      showToast('Erro ao carregar dados da assinatura.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Polling automático a cada 5s enquanto o QR Code PIX estiver aberto aguardando pagamento
  useEffect(() => {
    const payment = checkoutResult?.payment;
    if (!checkoutPlan || !payment?.id || checkoutResult?.confirmed || payment.billingType !== 'PIX') {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const { data } = await api.get('/billing/my-subscription');
        const updatedPay = (data?.payments || []).find((p: any) => p.id === payment.id);
        const isPaid = updatedPay?.status === 'CONFIRMED' || updatedPay?.status === 'RECEIVED';
        if (isPaid) {
          setSubscription(data);
          setCheckoutResult({ confirmed: true, payment: updatedPay, subscription: data });
          await refreshSubscription();
          showToast('Pagamento PIX confirmado automaticamente!', 'success');
        }
      } catch {
        // Ignora falhas momentâneas de rede durante o polling
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [checkoutPlan, checkoutResult]);

  const openCheckout = (plan: Plan) => {
    setCheckoutPlan(plan);
    setBillingType('PIX');
    setInstallments(billingCycle === 'YEARLY' ? Math.min(12, plan.maxInstallments || 12) : 1);
    setCardForm({ holderName: '', number: '', expiry: '', ccv: '' });
    setCheckoutResult(null);
    setPixQrError(null);
  };

  const formatCardNumber = (val: string) =>
    val
      .replace(/\D/g, '')
      .slice(0, 16)
      .replace(/(\d{4})(?=\d)/g, '$1 ');

  const formatCardExpiry = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 4);
    if (digits.length <= 2) return digits;
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  };

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkoutPlan) return;

    const cleanCpfCnpj = customerForm.cpfCnpj.replace(/\D/g, '');
    if (cleanCpfCnpj.length !== 11 && cleanCpfCnpj.length !== 14) {
      showToast('Informe um CPF ou CNPJ válido para faturamento.', 'error');
      return;
    }

    let creditCardPayload: any = undefined;
    if (billingType === 'CREDIT_CARD') {
      const [expMonth, expYear] = cardForm.expiry.split('/');
      if (!expMonth || !expYear || expMonth.length !== 2 || expYear.length < 2) {
        showToast('Informe a validade do cartão no formato MM/AA.', 'error');
        return;
      }
      creditCardPayload = {
        holderName: cardForm.holderName,
        number: cardForm.number.replace(/\D/g, ''),
        expiryMonth: expMonth,
        expiryYear: expYear.length === 2 ? `20${expYear}` : expYear,
        ccv: cardForm.ccv.replace(/\D/g, ''),
      };
    }

    setSubmittingCheckout(true);
    try {
      const { data } = await api.post('/billing/checkout', {
        planId: checkoutPlan.id,
        billingCycle,
        billingType,
        installments:
          billingCycle === 'YEARLY' && billingType === 'CREDIT_CARD' ? installments : 1,
        customer: customerForm,
        ...(creditCardPayload ? { creditCard: creditCardPayload } : {}),
      });

      setCheckoutResult(data);
      if (data.subscription) {
        setSubscription(data.subscription);
      }
      setPixQrError(data.pixError || null);
      await refreshSubscription();

      showToast(
        data.confirmed
          ? `Pagamento aprovado! Plano ${checkoutPlan.name} ativado com sucesso.`
          : billingType === 'PIX'
            ? data.pixError
              ? 'Cobrança PIX criada! Use o botão "Abrir Fatura Asaas" para visualizar o QR Code.'
              : 'QR Code PIX gerado! Efetue o pagamento para liberar o plano na hora.'
            : 'Boleto gerado com sucesso!',
        data.pixError ? 'info' : 'success',
      );
    } catch (err: any) {
      showToast(
        err.response?.data?.message || 'Não foi possível processar o checkout no Asaas.',
        'error',
      );
    } finally {
      setSubmittingCheckout(false);
    }
  };

  const handleSyncPayment = async (paymentId: string) => {
    setSyncingPaymentId(paymentId);
    try {
      const { data } = await api.post(`/billing/payments/${paymentId}/sync`);
      if (data.subscription) setSubscription(data.subscription);
      await refreshSubscription();
      if (checkoutResult?.payment?.id === paymentId) {
        setCheckoutResult(data);
      }

      showToast(
        data.confirmed
          ? 'Pagamento confirmado! Seu plano e recursos fiscais já estão liberados.'
          : `Status atual no Asaas: ${data.payment?.status || 'PENDING'}. Aguardando compensação.`,
        data.confirmed ? 'success' : 'info',
      );
    } catch {
      showToast('Erro ao consultar status do pagamento no Asaas.', 'error');
    } finally {
      setSyncingPaymentId(null);
    }
  };

  const handleCancelSubscription = async () => {
    if (
      !window.confirm(
        'Tem certeza que deseja cancelar a renovação automática da sua assinatura?',
      )
    ) {
      return;
    }
    setCancelingSub(true);
    try {
      const { data } = await api.post('/billing/cancel-subscription');
      if (data.subscription) setSubscription(data.subscription);
      await refreshSubscription();
      showToast('Renovação automática cancelada.', 'info');
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Erro ao cancelar assinatura.', 'error');
    } finally {
      setCancelingSub(false);
    }
  };

  const copyPixCode = (payload?: string | null) => {
    if (!payload) return;
    navigator.clipboard.writeText(payload);
    showToast('Código PIX Copia e Cola copiado!', 'success');
  };

  if (loading && !subscription) {
    return (
      <div className="p-8 text-center text-slate-400 text-sm">
        Carregando dados da assinatura...
      </div>
    );
  }

  const statusMeta = SUB_STATUS_META[subscription?.status] || SUB_STATUS_META.TRIAL;
  const ent = subscription?.entitlements || {
    allowFiscalEmission: false,
    maxMonthlyInvoices: 0,
    invoicesUsedThisMonth: 0,
    maxUsers: 5,
    usersCount: 1,
  };
  const invoicePct =
    ent.maxMonthlyInvoices > 0
      ? Math.min(100, Math.round((ent.invoicesUsedThisMonth / ent.maxMonthlyInvoices) * 100))
      : 0;

  // Cálculo do valor exibido no resumo do modal de checkout
  const checkoutTotal = checkoutPlan
    ? billingCycle === 'MONTHLY'
      ? checkoutPlan.monthlyPrice
      : billingType === 'CREDIT_CARD'
        ? checkoutPlan.annualCardPrice
        : checkoutPlan.annualCashPrice
    : 0;

  const checkoutMaxInstallments =
    checkoutPlan && billingCycle === 'YEARLY' && billingType === 'CREDIT_CARD'
      ? Math.max(1, Math.min(12, checkoutPlan.maxInstallments || 12))
      : 1;

 return (
    <div className="w-full min-w-0 p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-blue-600" />
            <span>Minha Assinatura & Plano</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Gerencie seu plano, acompanhe sua cota mensal de notas fiscais e consulte suas faturas.
          </p>
        </div>
        <button
          type="button"
          onClick={async () => {
            await Promise.all([loadData(), refreshSubscription()]);
          }}
          className="self-start sm:self-auto px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 inline-flex items-center gap-1.5 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Atualizar Status
        </button>
      </div>

      {/* Card de Resumo do Plano Atual + Barras de Consumo */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold border ${statusMeta.cls}`}
              >
                {statusMeta.label}
              </span>
              <h2 className="text-lg font-extrabold text-slate-900">
                {subscription?.plan?.name || 'Período Gratuito (Sem Emissão Fiscal)'}
              </h2>
            </div>

            <div className="text-xs text-slate-500 flex flex-wrap items-center gap-3">
              {subscription?.status === 'TRIAL' && (
                <span className="inline-flex items-center gap-1 text-blue-700 font-semibold">
                  <Clock className="w-3.5 h-3.5" />
                  Restam {subscription.trialDaysLeft} dia(s) gratuitos (até{' '}
                  {new Date(subscription.trialEndsAt).toLocaleDateString('pt-BR')})
                </span>
              )}

              {subscription?.status === 'ACTIVE' && subscription?.currentPeriodEnd && (
                <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Ciclo {subscription.billingCycle === 'YEARLY' ? 'Anual' : 'Mensal'} • Válido até{' '}
                  {new Date(subscription.currentPeriodEnd).toLocaleDateString('pt-BR')}
                </span>
              )}

              {subscription?.status === 'EXPIRED' && (
                <span className="inline-flex items-center gap-1 text-red-700 font-bold">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Escolha um plano abaixo para reativar imediatamente o acesso da oficina.
                </span>
              )}
            </div>
          </div>

          {subscription?.asaasSubscriptionId && subscription?.status === 'ACTIVE' && (
            <button
              type="button"
              disabled={cancelingSub}
              onClick={handleCancelSubscription}
              className="self-start lg:self-auto px-3.5 py-2 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold cursor-pointer"
            >
              {cancelingSub ? 'Cancelando...' : 'Cancelar Renovação Mensal'}
            </button>
          )}
        </div>

        {/* Medidores de Consumo (Notas Fiscais + Usuários) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-bold text-slate-700 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Notas Fiscais Emitidas no Mês</span>
              </span>
              {ent.allowFiscalEmission ? (
                <strong className="text-slate-900 shrink-0">
                  {ent.invoicesUsedThisMonth} / {ent.maxMonthlyInvoices} notas
                </strong>
              ) : (
                <span className="text-[11px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                  Disponível nos planos fiscais
                </span>
              )}
            </div>
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  invoicePct >= 95
                    ? 'bg-red-500'
                    : invoicePct >= 80
                      ? 'bg-amber-500'
                      : 'bg-blue-600'
                }`}
                style={{ width: `${ent.allowFiscalEmission ? invoicePct : 0}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-500">
              {ent.allowFiscalEmission
                ? `Restam ${ent.invoicesRemaining} nota(s) na sua cota mensal (NF-e, NFC-e, NFS-e e Devoluções).`
                : 'Assine o plano Profissional 100 ou Master 300 para liberar emissão de NF-e, NFS-e e Devolução em 30s.'}
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-bold text-slate-700 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Usuários Ativos da Equipe</span>
              </span>
              <strong className="text-slate-900 shrink-0">
                {ent.usersCount} / {ent.maxUsers} usuários
              </strong>
            </div>
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-600 rounded-full transition-all"
                style={{
                  width: `${Math.min(100, Math.round((ent.usersCount / Math.max(1, ent.maxUsers)) * 100))}%`,
                }}
              />
            </div>
            <p className="text-[11px] text-slate-500">
              Administradores, recepcionistas e mecânicos cadastrados na sua oficina.
            </p>
          </div>
        </div>
      </div>

      {/* Seção de Escolha / Upgrade de Planos */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">
              Escolha ou faça upgrade do seu plano
            </h2>
            <p className="text-xs text-slate-500">
              Mensal: PIX, Boleto ou Cartão em 1x • Anual: desconto no PIX/Boleto ou Cartão em até 12x.
            </p>
          </div>

          {/* Toggle Mensal / Anual */}
          <div className="inline-flex items-center gap-1 bg-slate-200 p-1 rounded-xl self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setBillingCycle('MONTHLY')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${billingCycle === 'MONTHLY'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              Mensal
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle('YEARLY')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition inline-flex items-center gap-1.5 cursor-pointer ${billingCycle === 'YEARLY'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              <span>Anual</span>
              <span className="bg-emerald-400 text-slate-950 text-[10px] font-extrabold px-1.5 py-0.5 rounded">
                até 12x
              </span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-stretch">
          {plans.map((plan) => {
            const isCurrent =
              subscription?.status === 'ACTIVE' && subscription?.planId === plan.id;
            const maxInst = plan.maxInstallments || 12;
            const cardInstVal = plan.annualCardPrice / maxInst;
            const cleanWhats = String(plan.whatsappNumber || '5517999999999').replace(/\D/g, '');
            const whatsUrl = `https://wa.me/${cleanWhats}?text=${encodeURIComponent(
              plan.whatsappMessage ||
              `Olá! Quero contratar o plano ${plan.name} para minha oficina (${customerForm.name}).`,
            )}`;

            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl p-5 flex flex-col justify-between border transition ${isCurrent
                  ? 'bg-emerald-50/40 border-emerald-500 ring-2 ring-emerald-100'
                  : plan.isPopular
                    ? 'bg-white border-2 border-blue-600 shadow-lg shadow-blue-600/10'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
              >
                {plan.badge && (
                  <span
                    className={`absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-extrabold uppercase tracking-wider px-3 py-0.5 rounded-full whitespace-nowrap ${plan.isPopular
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-900 text-white'
                      }`}
                  >
                    {plan.badge}
                  </span>
                )}

                <div className="space-y-4">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">{plan.name}</h3>
                    <p className="text-xs text-slate-500 mt-1 min-h-[32px]">{plan.subtitle}</p>
                  </div>

                  {/* Preço */}
                  <div className="pb-4 border-b border-slate-100 min-h-[92px] flex flex-col justify-center">
                    {plan.isCustomContact ? (
                      <div>
                        <div className="text-2xl font-extrabold text-slate-900">Sob Consulta</div>
                        <div className="text-[11px] text-emerald-700 font-semibold mt-1">
                          Acima de 300 notas/mês
                        </div>
                      </div>
                    ) : billingCycle === 'MONTHLY' ? (
                      <div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-xs text-slate-400 font-semibold">R$</span>
                          <span className="text-3xl font-extrabold text-slate-900">
                            {plan.monthlyPrice.toFixed(0)}
                          </span>
                          <span className="text-xs text-slate-500">/mês</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1">
                          PIX, Boleto ou Cartão em 1x
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-0.5">
                        <div className="flex items-baseline gap-1">
                          <span className="text-xs font-bold text-blue-600">{maxInst}x</span>
                          <span className="text-2xl font-extrabold text-slate-900">
                            {fmtMoney(cardInstVal)}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          no cartão ({fmtMoney(plan.annualCardPrice)} total)
                        </div>
                        <div className="text-[11px] text-emerald-700 font-bold">
                          ou {fmtMoney(plan.annualCashPrice)} à vista no PIX/Boleto
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Selo Cota Fiscal */}
                  <div
                    className={`text-[11px] font-bold px-2.5 py-1.5 rounded-lg text-center ${plan.allowFiscalEmission
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : 'bg-slate-100 text-slate-600'
                      }`}
                  >
                    {plan.isCustomContact
                      ? 'Cota Personalizada (+300 notas/mês)'
                      : plan.allowFiscalEmission
                        ? `Até ${plan.maxMonthlyInvoices} notas fiscais/mês`
                        : 'Sem emissão de notas fiscais'}
                  </div>

                  <ul className="space-y-2 text-xs text-slate-700">
                    {(plan.features || []).map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-5">
                  {plan.isCustomContact ? (
                    <a
                      href={whatsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 transition"
                    >
                      <MessageCircle className="w-4 h-4" /> Falar no WhatsApp
                    </a>
                  ) : isCurrent && subscription?.billingCycle === billingCycle ? (
                    <div className="w-full py-2.5 px-4 rounded-xl bg-emerald-100 text-emerald-800 text-xs font-extrabold text-center">
                      ✓ Plano Atual Ativo
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => openCheckout(plan)}
                      className={`w-full py-2.5 px-4 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition cursor-pointer ${plan.isPopular
                        ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
                        : 'bg-slate-900 hover:bg-blue-600 text-white'
                        }`}
                    >
                      <span>{isCurrent ? 'Trocar Ciclo' : 'Assinar Agora'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

     {/* Histórico de Faturas (Cards no mobile/tablet + Tabela no desktop) */}
      <div className="w-full min-w-0 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="px-4 sm:px-5 py-4 border-b border-slate-200">
          <h3 className="font-bold text-slate-900 text-sm">Histórico de Cobranças & Faturas</h3>
        </div>

        {/* VISÃO CARDS — Telas menores (< lg) — ZERO scroll lateral */}
        <div className="lg:hidden divide-y divide-slate-100">
          {(subscription?.payments || []).length === 0 ? (
            <div className="py-8 px-4 text-center text-xs text-slate-400">
              Nenhuma fatura gerada até o momento.
            </div>
          ) : (
            subscription.payments.map((pay: any) => {
              const st = PAY_STATUS_META[pay.status] || {
                label: pay.status,
                cls: 'bg-slate-100 text-slate-700',
              };
              const isPending = pay.status === 'PENDING' || pay.status === 'OVERDUE';

              return (
                <div key={pay.id} className="p-4 space-y-3 hover:bg-slate-50/70 transition text-xs">
                  {/* Linha 1: Status + Valor */}
                  <div className="flex items-start justify-between gap-2">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${st.cls}`}>
                      {st.label}
                    </span>
                    <span className="font-extrabold text-slate-900 text-sm shrink-0">
                      {fmtMoney(pay.amount)}
                    </span>
                  </div>

                  {/* Linha 2: Forma/Ciclo + Datas */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50 rounded-xl p-2.5 border border-slate-100">
                    <div>
                      <div className="font-bold text-slate-800">
                        {pay.billingType}
                        {pay.installments > 1 && <span> ({pay.installments}x)</span>}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {pay.billingCycle === 'YEARLY' ? 'Plano Anual' : 'Plano Mensal'}
                      </div>
                    </div>

                    <div className="sm:text-right">
                      <div className="font-semibold text-slate-800">
                        Venc: {new Date(pay.dueDate).toLocaleDateString('pt-BR')}
                      </div>
                      {pay.paidAt && (
                        <div className="text-[11px] text-emerald-600 font-medium">
                          Pago em {new Date(pay.paidAt).toLocaleDateString('pt-BR')}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Linha 3: Ações */}
                  {(pay.pixPayload || pay.bankSlipUrl || pay.invoiceUrl || isPending) && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {pay.pixPayload && isPending && (
                        <button
                          type="button"
                          onClick={() => copyPixCode(pay.pixPayload)}
                          className="flex-1 sm:flex-none px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-bold inline-flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5 shrink-0" /> Copiar PIX
                        </button>
                      )}

                      {(pay.bankSlipUrl || pay.invoiceUrl) && (
                        <a
                          href={pay.bankSlipUrl || pay.invoiceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex-1 sm:flex-none px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-semibold inline-flex items-center justify-center gap-1"
                        >
                          <ExternalLink className="w-3.5 h-3.5 shrink-0" /> Fatura
                        </a>
                      )}

                      {isPending && (
                        <button
                          type="button"
                          disabled={syncingPaymentId === pay.id}
                          onClick={() => handleSyncPayment(pay.id)}
                          className="flex-1 sm:flex-none px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold inline-flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <RefreshCw
                            className={`w-3.5 h-3.5 shrink-0 ${
                              syncingPaymentId === pay.id ? 'animate-spin' : ''
                            }`}
                          />
                          Verificar
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* VISÃO TABELA — Desktop (>= lg) */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 uppercase text-[10px] border-b border-slate-200">
                <th className="py-3 px-4">Data / Vencimento</th>
                <th className="py-3 px-4">Forma / Ciclo</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Valor</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(subscription?.payments || []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    Nenhuma fatura gerada até o momento.
                  </td>
                </tr>
              ) : (
                subscription.payments.map((pay: any) => {
                  const st = PAY_STATUS_META[pay.status] || {
                    label: pay.status,
                    cls: 'bg-slate-100 text-slate-700',
                  };
                  const isPending = pay.status === 'PENDING' || pay.status === 'OVERDUE';

                  return (
                    <tr key={pay.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800">
                          Venc: {new Date(pay.dueDate).toLocaleDateString('pt-BR')}
                        </div>
                        {pay.paidAt && (
                          <div className="text-[11px] text-emerald-600">
                            Pago em {new Date(pay.paidAt).toLocaleDateString('pt-BR')}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-800">{pay.billingType}</span>
                        {pay.installments > 1 && <span> ({pay.installments}x)</span>}
                        <div className="text-[11px] text-slate-400">
                          {pay.billingCycle === 'YEARLY' ? 'Plano Anual' : 'Plano Mensal'}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${st.cls}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-extrabold text-slate-900 whitespace-nowrap">
                        {fmtMoney(pay.amount)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {pay.pixPayload && isPending && (
                            <button
                              type="button"
                              onClick={() => copyPixCode(pay.pixPayload)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-bold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Copy className="w-3 h-3" /> Copiar PIX
                            </button>
                          )}

                          {(pay.bankSlipUrl || pay.invoiceUrl) && (
                            <a
                              href={pay.bankSlipUrl || pay.invoiceUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-semibold inline-flex items-center gap-1"
                            >
                              <ExternalLink className="w-3 h-3" /> Fatura
                            </a>
                          )}

                          {isPending && (
                            <button
                              type="button"
                              disabled={syncingPaymentId === pay.id}
                              onClick={() => handleSyncPayment(pay.id)}
                              className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <RefreshCw
                                className={`w-3 h-3 ${
                                  syncingPaymentId === pay.id ? 'animate-spin' : ''
                                }`}
                              />
                              Verificar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ====================================================================
          MODAL DE CHECKOUT ASAAS (VIA PORTAL — ACIMA DA SIDEBAR)
         ==================================================================== */}
      {checkoutPlan &&
        createPortal(
          <div
            className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-[1px] flex items-center justify-center p-3 sm:p-5"
            onClick={() => !submittingCheckout && setCheckoutPlan(null)}
          >
            <div
              className="bg-white rounded-2xl max-w-2xl w-full max-h-[92vh] overflow-y-auto shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Topo */}
              <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between sticky top-0 z-10">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Checkout Seguro Asaas
                  </span>
                  <h2 className="text-base font-extrabold">
                    {checkoutPlan.name} — {billingCycle === 'YEARLY' ? 'Plano Anual' : 'Plano Mensal'}
                  </h2>
                </div>
                <button
                  type="button"
                  disabled={submittingCheckout}
                  onClick={() => setCheckoutPlan(null)}
                  className="text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6">
                {/* RESULTADO APÓS GERAR COBRANÇA */}
                {checkoutResult ? (
                  <div className="space-y-5 text-center">
                    {checkoutResult.confirmed ? (
                      <div className="space-y-3 py-4">
                        <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                          <CheckCircle2 className="w-9 h-9" />
                        </div>
                        <h3 className="text-xl font-extrabold text-slate-900">
                          Assinatura Ativada com Sucesso!
                        </h3>
                        <p className="text-sm text-slate-600">
                          Seu plano <strong>{checkoutPlan.name}</strong> já está ativo e todos os
                          recursos contratados foram liberados.
                        </p>
                        <button
                          type="button"
                          onClick={() => setCheckoutPlan(null)}
                          className="mt-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold cursor-pointer"
                        >
                          Concluir e Voltar
                        </button>
                      </div>
                    ) : checkoutResult.payment?.billingType === 'PIX' ? (
                      <div className="space-y-4">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold">
                          <QrCode className="w-4 h-4" /> Escaneie o QR Code ou copie o código PIX
                        </div>

                        <div className="text-2xl font-extrabold text-slate-900">
                          {fmtMoney(checkoutResult.payment.amount)}
                        </div>
                       {checkoutResult.payment.pixQrCodeBase64 ? (
                          <div className="flex justify-center">
                            <img
                              src={
                                checkoutResult.payment.pixQrCodeBase64.startsWith('data:')
                                  ? checkoutResult.payment.pixQrCodeBase64
                                  : `data:image/png;base64,${checkoutResult.payment.pixQrCodeBase64}`
                              }
                              alt="QR Code PIX"
                              className="w-52 h-52 border-4 border-slate-900 rounded-2xl p-2 bg-white"
                            />
                          </div>
                        ) : pixQrError ? (
                          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-3 text-left">
                            <div className="flex items-start gap-2.5 text-amber-900">
                              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                              <div className="text-xs space-y-1">
                                <div className="font-extrabold">
                                  QR Code PIX indisponível no momento
                                </div>
                                <p>{pixQrError}</p>
                                <p className="text-amber-800/80">
                                  Você pode tentar carregar novamente ou concluir o pagamento direto
                                  pelo botão <strong>Abrir Fatura Asaas</strong> abaixo.
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              disabled={fetchingPixQr}
                              onClick={() => {
                                setPixQrError(null);
                                handleRetryPixQrCode(checkoutResult.payment.id);
                              }}
                              className="w-full py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold cursor-pointer"
                            >
                              {fetchingPixQr ? 'Consultando...' : 'Tentar Gerar QR Code Novamente'}
                            </button>
                          </div>
                        ) : (
                          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-3">
                            <RefreshCw className="w-7 h-7 text-blue-600 animate-spin mx-auto" />
                            <div className="text-xs font-bold text-slate-700">
                              Gerando QR Code PIX junto ao Banco Central...
                            </div>
                            <button
                              type="button"
                              disabled={fetchingPixQr}
                              onClick={() => handleRetryPixQrCode(checkoutResult.payment.id)}
                              className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
                            >
                              {fetchingPixQr ? 'Buscando...' : 'Tentar Carregar QR Code Agora'}
                            </button>
                          </div>
                        )}

                        {checkoutResult.payment.pixPayload && (
                          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                            <div className="text-[11px] font-mono text-slate-600 break-all max-h-20 overflow-y-auto">
                              {checkoutResult.payment.pixPayload}
                            </div>
                            <button
                              type="button"
                              onClick={() => copyPixCode(checkoutResult.payment.pixPayload)}
                              className="w-full py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <Copy className="w-3.5 h-3.5" /> Copiar PIX Copia e Cola
                            </button>
                          </div>
                        )}

                        <div className="flex flex-col sm:flex-row gap-2 pt-2">
                          <button
                            type="button"
                            disabled={syncingPaymentId === checkoutResult.payment.id}
                            onClick={() => handleSyncPayment(checkoutResult.payment.id)}
                            className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <RefreshCw
                              className={`w-4 h-4 ${syncingPaymentId === checkoutResult.payment.id ? 'animate-spin' : ''
                                }`}
                            />
                            Já paguei — Verificar Agora
                          </button>

                          {checkoutResult.payment.invoiceUrl && (
                            <a
                              href={checkoutResult.payment.invoiceUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold inline-flex items-center justify-center gap-1.5"
                            >
                              <ExternalLink className="w-4 h-4" /> Abrir Fatura Asaas
                            </a>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4 py-3">
                        <div className="w-14 h-14 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mx-auto">
                          <Barcode className="w-7 h-7" />
                        </div>
                        <h3 className="text-lg font-extrabold text-slate-900">
                          Cobrança Gerada ({fmtMoney(checkoutResult.payment?.amount)})
                        </h3>
                        <p className="text-xs text-slate-600">
                          Abra o boleto abaixo para efetuar o pagamento. Assim que o banco confirmar,
                          o plano é liberado automaticamente.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
                          {(checkoutResult.payment?.bankSlipUrl ||
                            checkoutResult.payment?.invoiceUrl) && (
                              <a
                                href={
                                  checkoutResult.payment.bankSlipUrl ||
                                  checkoutResult.payment.invoiceUrl
                                }
                                target="_blank"
                                rel="noreferrer"
                                className="py-2.5 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5"
                              >
                                <ExternalLink className="w-4 h-4" /> Abrir Boleto PDF
                              </a>
                            )}
                          <button
                            type="button"
                            disabled={syncingPaymentId === checkoutResult.payment?.id}
                            onClick={() => handleSyncPayment(checkoutResult.payment.id)}
                            className="py-2.5 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <RefreshCw className="w-3.5 h-3.5" /> Verificar Confirmação
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* FORMULÁRIO DE CHECKOUT */
                  <form onSubmit={handleCheckoutSubmit} className="space-y-5 text-xs">
                    {/* Seletor de Forma de Pagamento */}
                    <div className="space-y-2">
                      <label className="font-bold text-slate-700 block">Forma de Pagamento</label>
                      <div className="grid grid-cols-3 gap-2.5">
                        {[
                          { id: 'PIX', label: 'PIX (Na Hora)', icon: QrCode },
                          { id: 'CREDIT_CARD', label: 'Cartão de Crédito', icon: CreditCard },
                          { id: 'BOLETO', label: 'Boleto Bancário', icon: Barcode },
                        ].map((m) => {
                          const Icon = m.icon;
                          const selected = billingType === m.id;
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => {
                                setBillingType(m.id as any);
                                if (m.id !== 'CREDIT_CARD' || billingCycle === 'MONTHLY') {
                                  setInstallments(1);
                                }
                              }}
                              className={`p-3 rounded-xl border font-bold flex flex-col items-center gap-1.5 transition cursor-pointer ${selected
                                ? 'bg-blue-50 border-blue-600 text-blue-700 ring-2 ring-blue-100'
                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                }`}
                            >
                              <Icon className="w-5 h-5" />
                              <span>{m.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Resumo de Valores e Parcelas */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <span className="text-[11px] text-slate-500 block">
                          Total a pagar ({billingCycle === 'YEARLY' ? 'Anual' : 'Mensal'})
                        </span>
                        <strong className="text-xl font-extrabold text-slate-900">
                          {fmtMoney(checkoutTotal)}
                        </strong>
                        {billingCycle === 'MONTHLY' && (
                          <span className="block text-[11px] text-slate-500">
                            Renovação mensal sem parcelamento (1x)
                          </span>
                        )}
                      </div>

                      {billingCycle === 'YEARLY' && billingType === 'CREDIT_CARD' && (
                        <div className="min-w-[200px]">
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">
                            Parcelamento no Cartão (juros inclusos)
                          </label>
                          <select
                            value={installments}
                            onChange={(e) => setInstallments(Number(e.target.value))}
                            className="w-full px-3 py-2 border border-blue-300 rounded-lg bg-white font-bold text-slate-900"
                          >
                            {Array.from({ length: checkoutMaxInstallments }, (_, i) => i + 1).map(
                              (n) => (
                                <option key={n} value={n}>
                                  {n}x de {fmtMoney(checkoutTotal / n)}
                                </option>
                              ),
                            )}
                          </select>
                        </div>
                      )}
                    </div>

                    {/* Dados do Pagador / Faturamento */}
                    <div className="space-y-3">
                      <div className="font-bold text-slate-700">Dados de Faturamento</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-slate-600 font-semibold mb-1">
                            Nome / Razão Social *
                          </label>
                          <input
                            value={customerForm.name}
                            onChange={(e) =>
                              setCustomerForm((p) => ({ ...p, name: e.target.value }))
                            }
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-slate-600 font-semibold mb-1">
                            CPF / CNPJ *
                          </label>
                          <DocumentInput
                            value={customerForm.cpfCnpj}
                            onChangeValue={(val) =>
                              setCustomerForm((p) => ({ ...p, cpfCnpj: val }))
                            }
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-slate-600 font-semibold mb-1">
                            E-mail *
                          </label>
                          <input
                            type="email"
                            value={customerForm.email}
                            onChange={(e) =>
                              setCustomerForm((p) => ({ ...p, email: e.target.value }))
                            }
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-slate-600 font-semibold mb-1">
                            Celular / WhatsApp *
                          </label>
                          <PhoneInput
                            value={customerForm.phone}
                            onChangeValue={(val) =>
                              setCustomerForm((p) => ({ ...p, phone: val }))
                            }
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-slate-600 font-semibold mb-1">
                            CEP {billingType === 'CREDIT_CARD' ? '*' : ''}
                          </label>
                          <input
                            placeholder="15047033"
                            maxLength={8}
                            value={customerForm.postalCode}
                            onChange={(e) =>
                              setCustomerForm((p) => ({
                                ...p,
                                postalCode: e.target.value.replace(/\D/g, ''),
                              }))
                            }
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                            required={billingType === 'CREDIT_CARD'}
                          />
                        </div>
                        <div>
                          <label className="block text-slate-600 font-semibold mb-1">
                            Número do Endereço {billingType === 'CREDIT_CARD' ? '*' : ''}
                          </label>
                          <input
                            placeholder="Ex: 202"
                            value={customerForm.addressNumber}
                            onChange={(e) =>
                              setCustomerForm((p) => ({ ...p, addressNumber: e.target.value }))
                            }
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                            required={billingType === 'CREDIT_CARD'}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Dados do Cartão (exibido apenas se CREDIT_CARD) */}
                    {billingType === 'CREDIT_CARD' && (
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                        <div className="font-bold text-slate-800 flex items-center gap-1.5">
                          <Lock className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Dados do Cartão de Crédito</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="sm:col-span-2">
                            <label className="block text-slate-600 font-semibold mb-1">
                              Nome Impresso no Cartão *
                            </label>
                            <input
                              placeholder="JOAO DA SILVA"
                              value={cardForm.holderName}
                              onChange={(e) =>
                                setCardForm((c) => ({
                                  ...c,
                                  holderName: e.target.value.toUpperCase(),
                                }))
                              }
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white uppercase"
                              required
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-slate-600 font-semibold mb-1">
                              Número do Cartão *
                            </label>
                            <input
                              placeholder="0000 0000 0000 0000"
                              value={cardForm.number}
                              onChange={(e) =>
                                setCardForm((c) => ({
                                  ...c,
                                  number: formatCardNumber(e.target.value),
                                }))
                              }
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-mono"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-slate-600 font-semibold mb-1">
                              Validade (MM/AA) *
                            </label>
                            <input
                              placeholder="08/29"
                              value={cardForm.expiry}
                              onChange={(e) =>
                                setCardForm((c) => ({
                                  ...c,
                                  expiry: formatCardExpiry(e.target.value),
                                }))
                              }
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-mono"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-slate-600 font-semibold mb-1">
                              CVV *
                            </label>
                            <input
                              placeholder="123"
                              maxLength={4}
                              value={cardForm.ccv}
                              onChange={(e) =>
                                setCardForm((c) => ({
                                  ...c,
                                  ccv: e.target.value.replace(/\D/g, ''),
                                }))
                              }
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-mono"
                              required
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-200">
                      <span className="text-[11px] text-slate-500 inline-flex items-center gap-1">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        Processado com criptografia pelo Asaas
                      </span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={submittingCheckout}
                          onClick={() => setCheckoutPlan(null)}
                          className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          disabled={submittingCheckout}
                          className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-extrabold cursor-pointer"
                        >
                          {submittingCheckout
                            ? 'Processando...'
                            : billingType === 'PIX'
                              ? 'Gerar QR Code PIX'
                              : billingType === 'BOLETO'
                                ? 'Gerar Boleto'
                                : 'Confirmar Pagamento'}
                        </button>
                      </div>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}