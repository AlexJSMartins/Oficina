// frontend/src/components/SubscriptionBanner.tsx
import { Link, useLocation } from 'react-router-dom';
import { AlertTriangle, Clock, Sparkles, ArrowRight, FileWarning } from 'lucide-react';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useAuth } from '../contexts/AuthContext';

export default function SubscriptionBanner() {
  const { user } = useAuth();
  const { subscription, allowFiscalEmission, invoiceUsagePct } = useSubscription();
  const location = useLocation();

  if (!subscription || location.pathname.startsWith('/admin/assinatura')) {
    return null;
  }

  const isAdmin = user?.role === 'ADMIN';
  const ent = subscription.entitlements;

  // 1. Fatura em atraso (Carência)
  if (subscription.status === 'PAST_DUE') {
    return (
      <div className="bg-red-600 text-white px-4 py-2.5 text-xs flex flex-wrap items-center justify-between gap-2 shadow-sm">
        <div className="flex items-center gap-2 font-semibold">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            Atenção: existe uma fatura vencida na assinatura da oficina. Regularize agora para
            evitar o bloqueio automático do pátio.
          </span>
        </div>
        {isAdmin && (
          <Link
            to="/admin/assinatura"
            className="px-3 py-1 rounded-lg bg-white text-red-700 hover:bg-red-50 font-extrabold inline-flex items-center gap-1 shrink-0"
          >
            <span>Pagar Agora</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>
    );
  }

  // 2. Período de Trial (mostra aviso mais forte nos últimos 7 dias)
  if (subscription.status === 'TRIAL') {
    const days = subscription.trialDaysLeft ?? 0;
    const isUrgent = days <= 7;

    return (
      <div
        className={`px-4 py-2 text-xs flex flex-wrap items-center justify-between gap-2 border-b ${
          isUrgent
            ? 'bg-amber-50 border-amber-200 text-amber-950'
            : 'bg-blue-50 border-blue-200 text-blue-950'
        }`}
      >
        <div className="flex items-center gap-2 font-medium">
          {isUrgent ? (
            <Clock className="w-4 h-4 text-amber-600 shrink-0" />
          ) : (
            <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
          )}
          <span>
            <strong>
              Teste Grátis: {days === 0 ? 'expira hoje' : `restam ${days} dia(s)`}
            </strong>{' '}
            • Gestão liberada. Emissão de NF-e, NFS-e e Devolução disponível ao assinar um plano
            fiscal.
          </span>
        </div>
        {isAdmin && (
          <Link
            to="/admin/assinatura"
            className={`px-3 py-1 rounded-lg font-bold inline-flex items-center gap-1 shrink-0 transition ${
              isUrgent
                ? 'bg-amber-600 hover:bg-amber-700 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            <span>Ver Planos</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>
    );
  }

  // 3. Assinatura ativa com consumo fiscal >= 80% da cota mensal
  if (subscription.status === 'ACTIVE' && allowFiscalEmission && invoiceUsagePct >= 80) {
    const isFull = ent.invoicesRemaining <= 0;
    return (
      <div
        className={`px-4 py-2 text-xs flex flex-wrap items-center justify-between gap-2 border-b ${
          isFull
            ? 'bg-red-50 border-red-200 text-red-900'
            : 'bg-amber-50 border-amber-200 text-amber-900'
        }`}
      >
        <div className="flex items-center gap-2 font-semibold">
          <FileWarning className="w-4 h-4 shrink-0" />
          <span>
            {isFull
              ? `Cota fiscal mensal atingida (${ent.invoicesUsedThisMonth}/${ent.maxMonthlyInvoices} notas). Faça upgrade para emitir novas notas.`
              : `Você já utilizou ${ent.invoicesUsedThisMonth} de ${ent.maxMonthlyInvoices} notas fiscais neste mês (${invoiceUsagePct}%).`}
          </span>
        </div>
        {isAdmin && (
          <Link
            to="/admin/assinatura"
            className="px-3 py-1 rounded-lg bg-slate-900 hover:bg-blue-600 text-white font-bold inline-flex items-center gap-1 shrink-0"
          >
            <span>Aumentar Cota</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>
    );
  }

  return null;
}