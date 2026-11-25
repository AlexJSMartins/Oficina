// frontend/src/components/fiscal/FiscalUpgradeBanner.tsx
import { Link } from 'react-router-dom';
import { Lock, Sparkles, ArrowRight, AlertTriangle } from 'lucide-react';
import { useSubscription } from '../../contexts/SubscriptionContext';

interface Props {
  compact?: boolean;
}

export default function FiscalUpgradeBanner({ compact = false }: Props) {
  const { subscription, allowFiscalEmission, isFiscalQuotaExceeded } = useSubscription();

  if (!subscription || (allowFiscalEmission && !isFiscalQuotaExceeded)) {
    return null;
  }

  const ent = subscription.entitlements;

  if (isFiscalQuotaExceeded) {
    return (
      <div
        className={`rounded-2xl border border-amber-500/40 bg-amber-500/10 ${
          compact ? 'p-3.5' : 'p-5'
        } flex flex-col sm:flex-row sm:items-center justify-between gap-3`}
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-xs space-y-0.5">
            <div className="font-extrabold text-amber-700 dark:text-amber-300 text-sm">
              Cota Mensal de Notas Atingida ({ent.invoicesUsedThisMonth}/{ent.maxMonthlyInvoices})
            </div>
            <p className="text-slate-600 dark:text-slate-300">
              Seu plano atual atingiu o limite mensal de emissões. Faça upgrade para o{' '}
              <strong>Master 300</strong> ou solicite o plano <strong>Personalizado</strong> para
              continuar emitindo sem interrupção.
            </p>
          </div>
        </div>
        <Link
          to="/admin/assinatura"
          className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-extrabold inline-flex items-center justify-center gap-1.5 shrink-0"
        >
          <span>Fazer Upgrade</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl border border-blue-500/30 bg-gradient-to-r from-slate-900 to-blue-950 text-white ${
        compact ? 'p-4' : 'p-6'
      } flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg`}
    >
      <div className="flex items-start gap-3.5">
        <div className="p-2.5 rounded-xl bg-blue-500/20 border border-blue-400/30 text-blue-300 shrink-0">
          <Lock className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-blue-300">
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>Recurso Exclusivo dos Planos Fiscais</span>
          </div>
          <h3 className="font-extrabold text-sm sm:text-base">
            Libere a emissão de NF-e, NFC-e, NFS-e e Devolução em 30 segundos
          </h3>
          <p className="text-xs text-slate-300">
            Você pode conferir a prévia visual (Pré-DANFE) gratuitamente. Para transmitir notas
            oficiais e gerar o ZIP do contador, ative o plano <strong>Profissional 100</strong> ou{' '}
            <strong>Master 300</strong>.
          </p>
        </div>
      </div>

      <Link
        to="/admin/assinatura"
        className="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 shadow-lg shadow-blue-600/30 shrink-0"
      >
        <span>Liberar Módulo Fiscal</span>
        <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  );
}