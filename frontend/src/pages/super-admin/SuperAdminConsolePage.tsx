import React, { useEffect, useState } from 'react';
import {
  Terminal,
  LogOut,
  RefreshCw,
  ExternalLink,
  Plus,
  Edit,
  Trash2,
  Building2,
  CreditCard,
  Layers,
  TrendingUp,
  Clock,
  AlertTriangle,
  CheckCircle2,
  FileText,
  MessageCircle,
  Search,
  X,
  ShieldCheck,
  Sliders,
} from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { sysApi, SYS_TOKEN_KEY } from './sysApi';
import ConsoleLoginTerminal from './ConsoleLoginTerminal';

type Tab = 'PLANS' | 'WORKSHOPS' | 'PAYMENTS';

const fmtMoney = (v?: number | null) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  ACTIVE: { label: 'Ativa (Paga)', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  TRIAL: { label: 'Em Trial (30d)', cls: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
  PAST_DUE: { label: 'Atrasada', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  EXPIRED: { label: 'Expirada', cls: 'bg-red-500/15 text-red-300 border-red-500/30' },
  CANCELED: { label: 'Cancelada', cls: 'bg-slate-700 text-slate-300 border-slate-600' },
};

const EMPTY_PLAN_FORM = {
  id: '',
  slug: '',
  name: '',
  subtitle: '',
  badge: '',
  isPopular: false,
  isActive: true,
  isCustomContact: false,
  whatsappNumber: '5517999999999',
  whatsappMessage: 'Olá! Quero montar um plano personalizado no Oficina Pro.',
  sortOrder: 0,
  monthlyPrice: 99,
  annualCashPrice: 990,
  annualCardPrice: 1128,
  maxInstallments: 12,
  allowFiscalEmission: false,
  maxMonthlyInvoices: 0,
  maxUsers: 5,
  featuresText: '',
};

export default function SuperAdminConsolePage() {
  const { showToast } = useToast();

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [rootUser, setRootUser] = useState<{ id: string; name: string; email: string } | null>(
    null,
  );

  const [activeTab, setActiveTab] = useState<Tab>('PLANS');
  const [loading, setLoading] = useState(false);

  const [overview, setOverview] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [workshops, setWorkshops] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);

  // Filtros da aba Oficinas
  const [workshopSearch, setWorkshopSearch] = useState('');
  const [workshopStatusFilter, setWorkshopStatusFilter] = useState('ALL');

  // Modal Criar / Editar Plano
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [planForm, setPlanForm] = useState<typeof EMPTY_PLAN_FORM>(EMPTY_PLAN_FORM);
  const [savingPlan, setSavingPlan] = useState(false);

  // Modal Gerenciar Assinatura da Oficina
  const [editingWorkshop, setEditingWorkshop] = useState<any | null>(null);
  const [subForm, setSubForm] = useState({
    planId: '',
    status: 'TRIAL',
    billingCycle: 'MONTHLY',
    trialEndsAt: '',
    currentPeriodEnd: '',
    customMonthlyInvoices: '',
    customMonthlyPrice: '',
    manualOverride: false,
    adminNotes: '',
  });
  const [savingSub, setSavingSub] = useState(false);

  // Valida se já existe sessão ativa em @oficina:sys_token
  useEffect(() => {
    const token = localStorage.getItem(SYS_TOKEN_KEY);
    if (!token) {
      setCheckingAuth(false);
      return;
    }

    sysApi
      .get('/super-admin/me')
      .then(({ data }) => setRootUser(data))
      .catch(() => {
        localStorage.removeItem(SYS_TOKEN_KEY);
        setRootUser(null);
      })
      .finally(() => setCheckingAuth(false));
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [ovRes, plansRes, wsRes, payRes] = await Promise.all([
        sysApi.get('/super-admin/overview'),
        sysApi.get('/super-admin/plans'),
        sysApi.get('/super-admin/workshops', {
          params: {
            search: workshopSearch || undefined,
            status: workshopStatusFilter !== 'ALL' ? workshopStatusFilter : undefined,
          },
        }),
        sysApi.get('/super-admin/payments'),
      ]);
      setOverview(ovRes.data);
      setPlans(plansRes.data || []);
      setWorkshops(wsRes.data || []);
      setPayments(payRes.data || []);
    } catch {
      showToast('Erro ao carregar dados do painel master.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (rootUser) {
      loadAllData();
    }
  }, [rootUser]);

  // Recarrega oficinas ao alterar busca/filtro
  useEffect(() => {
    if (!rootUser) return;
    const timer = setTimeout(async () => {
      try {
        const { data } = await sysApi.get('/super-admin/workshops', {
          params: {
            search: workshopSearch || undefined,
            status: workshopStatusFilter !== 'ALL' ? workshopStatusFilter : undefined,
          },
        });
        setWorkshops(data || []);
      } catch {
        // silencioso
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [workshopSearch, workshopStatusFilter, rootUser]);

  const handleLogout = () => {
    localStorage.removeItem(SYS_TOKEN_KEY);
    setRootUser(null);
  };

  // --- PLANOS ---
  const openCreatePlan = () => {
    setPlanForm({
      ...EMPTY_PLAN_FORM,
      sortOrder: plans.length + 1,
    });
    setPlanModalOpen(true);
  };

  const openEditPlan = (p: any) => {
    setPlanForm({
      id: p.id,
      slug: p.slug || '',
      name: p.name || '',
      subtitle: p.subtitle || '',
      badge: p.badge || '',
      isPopular: Boolean(p.isPopular),
      isActive: Boolean(p.isActive),
      isCustomContact: Boolean(p.isCustomContact),
      whatsappNumber: p.whatsappNumber || '5517999999999',
      whatsappMessage: p.whatsappMessage || '',
      sortOrder: Number(p.sortOrder ?? 0),
      monthlyPrice: Number(p.monthlyPrice ?? 0),
      annualCashPrice: Number(p.annualCashPrice ?? 0),
      annualCardPrice: Number(p.annualCardPrice ?? 0),
      maxInstallments: Number(p.maxInstallments ?? 12),
      allowFiscalEmission: Boolean(p.allowFiscalEmission),
      maxMonthlyInvoices: Number(p.maxMonthlyInvoices ?? 0),
      maxUsers: Number(p.maxUsers ?? 5),
      featuresText: Array.isArray(p.features) ? p.features.join('\n') : '',
    });
    setPlanModalOpen(true);
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPlan(true);
    try {
      const payload = {
        slug: planForm.slug || planForm.name,
        name: planForm.name,
        subtitle: planForm.subtitle || null,
        badge: planForm.badge || null,
        isPopular: planForm.isPopular,
        isActive: planForm.isActive,
        isCustomContact: planForm.isCustomContact,
        whatsappNumber: planForm.whatsappNumber,
        whatsappMessage: planForm.whatsappMessage,
        sortOrder: Number(planForm.sortOrder),
        monthlyPrice: Number(planForm.monthlyPrice),
        annualCashPrice: Number(planForm.annualCashPrice),
        annualCardPrice: Number(planForm.annualCardPrice),
        maxInstallments: Number(planForm.maxInstallments),
        allowFiscalEmission: planForm.allowFiscalEmission,
        maxMonthlyInvoices: planForm.allowFiscalEmission ? Number(planForm.maxMonthlyInvoices) : 0,
        maxUsers: Number(planForm.maxUsers),
        features: planForm.featuresText
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean),
      };

      if (planForm.id) {
        await sysApi.patch(`/super-admin/plans/${planForm.id}`, payload);
        showToast('Plano atualizado! A Landing Page já reflete os novos valores.', 'success');
      } else {
        await sysApi.post('/super-admin/plans', payload);
        showToast('Novo plano criado e publicado!', 'success');
      }

      setPlanModalOpen(false);
      loadAllData();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Erro ao salvar plano.', 'error');
    } finally {
      setSavingPlan(false);
    }
  };

  const handleTogglePlanActive = async (plan: any) => {
    try {
      await sysApi.patch(`/super-admin/plans/${plan.id}`, { isActive: !plan.isActive });
      showToast(
        plan.isActive ? 'Plano ocultado da Landing Page.' : 'Plano ativado na Landing Page.',
        'info',
      );
      loadAllData();
    } catch {
      showToast('Erro ao alterar visibilidade do plano.', 'error');
    }
  };

  const handleDeletePlan = async (plan: any) => {
    if (!window.confirm(`Deseja excluir o plano "${plan.name}" permanentemente?`)) return;
    try {
      await sysApi.delete(`/super-admin/plans/${plan.id}`);
      showToast('Plano excluído.', 'success');
      loadAllData();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Não foi possível excluir este plano.', 'error');
    }
  };

  // --- OFICINAS / ASSINATURAS ---
  const handleQuickExtendTrial = async (workshopId: string, days: number) => {
    try {
      await sysApi.post(`/super-admin/workshops/${workshopId}/extend-trial`, { days });
      showToast(`Trial estendido em +${days} dias!`, 'success');
      loadAllData();
    } catch {
      showToast('Erro ao estender trial.', 'error');
    }
  };

  const openManageSubscription = (ws: any) => {
    const sub = ws.subscription;
    setEditingWorkshop(ws);
    setSubForm({
      planId: sub?.planId || '',
      status: ws.effectiveStatus || 'TRIAL',
      billingCycle: sub?.billingCycle || 'MONTHLY',
      trialEndsAt: sub?.trialEndsAt ? new Date(sub.trialEndsAt).toISOString().slice(0, 10) : '',
      currentPeriodEnd: sub?.currentPeriodEnd
        ? new Date(sub.currentPeriodEnd).toISOString().slice(0, 10)
        : '',
      customMonthlyInvoices:
        sub?.customMonthlyInvoices !== null && sub?.customMonthlyInvoices !== undefined
          ? String(sub.customMonthlyInvoices)
          : '',
      customMonthlyPrice:
        sub?.customMonthlyPrice !== null && sub?.customMonthlyPrice !== undefined
          ? String(sub.customMonthlyPrice)
          : '',
      manualOverride: Boolean(sub?.manualOverride),
      adminNotes: sub?.adminNotes || '',
    });
  };

  const handleSaveSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWorkshop) return;
    setSavingSub(true);
    try {
      await sysApi.patch(`/super-admin/workshops/${editingWorkshop.id}/subscription`, {
        planId: subForm.planId || null,
        status: subForm.status,
        billingCycle: subForm.billingCycle,
        trialEndsAt: subForm.trialEndsAt ? `${subForm.trialEndsAt}T23:59:59.000Z` : undefined,
        currentPeriodEnd: subForm.currentPeriodEnd
          ? `${subForm.currentPeriodEnd}T23:59:59.000Z`
          : null,
        customMonthlyInvoices:
          subForm.customMonthlyInvoices === '' ? null : Number(subForm.customMonthlyInvoices),
        customMonthlyPrice:
          subForm.customMonthlyPrice === '' ? null : Number(subForm.customMonthlyPrice),
        manualOverride: subForm.manualOverride,
        adminNotes: subForm.adminNotes,
      });
      showToast(`Assinatura de "${editingWorkshop.name}" atualizada!`, 'success');
      setEditingWorkshop(null);
      loadAllData();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Erro ao atualizar assinatura.', 'error');
    } finally {
      setSavingSub(false);
    }
  };

  const openLeadWhatsApp = (ws: any) => {
    const clean = String(ws.phone || '').replace(/\D/g, '');
    if (!clean) {
      showToast('Esta oficina não cadastrou número de WhatsApp.', 'info');
      return;
    }
    const full = clean.startsWith('55') ? clean : `55${clean}`;
    const msg =
      ws.effectiveStatus === 'TRIAL'
        ? `Olá ${ws.adminUser?.name || ''}! Aqui é do suporte do Oficina Pro. Vi que a ${ws.name} está nos seus 30 dias grátis (restam ${ws.trialDaysLeft} dias). Como estão sendo os testes por aí? Posso ajudar a configurar as notas fiscais ou alguma tela?`
        : `Olá ${ws.adminUser?.name || ''}! Tudo bem? Aqui é da equipe Oficina Pro falando sobre a conta da ${ws.name}.`;
    window.open(`https://wa.me/${full}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-[#07090d] text-emerald-400 font-mono text-sm flex items-center justify-center">
        initializing tty1...
      </div>
    );
  }

  if (!rootUser) {
    return <ConsoleLoginTerminal onAuthenticated={(u) => setRootUser(u)} />;
  }

  // Prévia de cálculos dentro do modal de Planos
  const formDevNotaCost = planForm.allowFiscalEmission
    ? Math.ceil(Number(planForm.maxMonthlyInvoices || 0) / 100) * 47
    : 0;
  const formMonthlyMargin = Number(planForm.monthlyPrice || 0) - formDevNotaCost;
  const formInstallmentValue =
    Number(planForm.maxInstallments || 12) > 0
      ? Number(planForm.annualCardPrice || 0) / Number(planForm.maxInstallments || 12)
      : 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Barra Superior Master */}
      <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-sm sm:text-base text-white font-mono">
                  root@oficinapro:/console
                </h1>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  Master SaaS
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Logado como {rootUser.email} • Controle de preços, assinaturas e cotas fiscais
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="/"
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 inline-flex items-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Ver Landing Page
            </a>

            <button
              type="button"
              onClick={loadAllData}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Atualizar
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="px-3 py-1.5 rounded-lg bg-red-600/20 hover:bg-red-600 border border-red-500/40 text-red-200 hover:text-white text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" /> exit
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
        {/* KPIs Executivos do SaaS */}
        {overview && (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-4">
              <span className="text-[10px] font-bold uppercase text-emerald-400 flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" /> MRR Estimado
              </span>
              <strong className="text-xl font-extrabold text-white block mt-1">
                {fmtMoney(overview.mrr)}
              </strong>
              <span className="text-[11px] text-slate-400">Receita mensal recorrente</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <span className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Ativas (Pagas)
              </span>
              <strong className="text-2xl font-extrabold text-emerald-400 block mt-1">
                {overview.activeCount}
              </strong>
              <span className="text-[11px] text-slate-500">de {overview.totalWorkshops} oficinas</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <span className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-blue-400" /> Em Trial (30d)
              </span>
              <strong className="text-2xl font-extrabold text-blue-400 block mt-1">
                {overview.trialCount}
              </strong>
              <span className="text-[11px] text-slate-500">Leads testando agora</span>
            </div>

            <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-4">
              <span className="text-[10px] font-bold uppercase text-amber-400 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> Vencendo ≤ 5d
              </span>
              <strong className="text-2xl font-extrabold text-amber-400 block mt-1">
                {overview.expiringSoonCount}
              </strong>
              <span className="text-[11px] text-slate-400">Abordar no WhatsApp</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <span className="text-[10px] font-bold uppercase text-red-400 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> Expiradas / Bloq.
              </span>
              <strong className="text-2xl font-extrabold text-red-400 block mt-1">
                {overview.expiredCount + overview.pastDueCount}
              </strong>
              <span className="text-[11px] text-slate-500">
                {overview.pastDueCount} em atraso
              </span>
            </div>

            <div className="bg-slate-900 border border-purple-500/30 rounded-2xl p-4">
              <span className="text-[10px] font-bold uppercase text-purple-300 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5" /> Notas no Mês
              </span>
              <strong className="text-2xl font-extrabold text-white block mt-1">
                {overview.totalInvoicesThisMonth}
              </strong>
              <span className="text-[11px] text-purple-300">
                DevNota est.: {fmtMoney(overview.estimatedDevNotaCost)}
              </span>
            </div>
          </div>
        )}

        {/* Navegação de Abas */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('PLANS')}
              className={`px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-2 transition cursor-pointer ${
                activeTab === 'PLANS'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <Layers className="w-4 h-4" /> Planos & Preços ({plans.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('WORKSHOPS')}
              className={`px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-2 transition cursor-pointer ${
                activeTab === 'WORKSHOPS'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <Building2 className="w-4 h-4" /> Oficinas & Leads ({workshops.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('PAYMENTS')}
              className={`px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-2 transition cursor-pointer ${
                activeTab === 'PAYMENTS'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <CreditCard className="w-4 h-4" /> Faturas Asaas ({payments.length})
            </button>
          </div>

          {activeTab === 'PLANS' && (
            <button
              type="button"
              onClick={openCreatePlan}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold inline-flex items-center gap-1.5 shadow-lg shadow-emerald-600/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Criar Novo Plano
            </button>
          )}
        </div>

        {/* ============================================================
            ABA 1: PLANOS & PREÇOS (SINCRONIZADO COM A LANDING PAGE)
           ============================================================ */}
        {activeTab === 'PLANS' && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {plans.map((p) => {
              const devCost = p.allowFiscalEmission
                ? Math.ceil(Number(p.maxMonthlyInvoices || 0) / 100) * 47
                : 0;
              const monthlyNet = Number(p.monthlyPrice || 0) - devCost;
              const installment =
                Number(p.maxInstallments || 12) > 0
                  ? Number(p.annualCardPrice || 0) / Number(p.maxInstallments || 12)
                  : 0;

              return (
                <div
                  key={p.id}
                  className={`rounded-2xl border p-5 flex flex-col justify-between space-y-4 ${
                    !p.isActive
                      ? 'bg-slate-900/40 border-slate-800 opacity-60'
                      : p.isPopular
                      ? 'bg-slate-900 border-blue-500 ring-1 ring-blue-500/30'
                      : 'bg-slate-900 border-slate-800'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-mono bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">
                            #{p.sortOrder}
                          </span>
                          <h3 className="font-extrabold text-white text-base">{p.name}</h3>
                        </div>
                        <span className="text-[11px] font-mono text-slate-500">{p.slug}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleTogglePlanActive(p)}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border cursor-pointer ${
                          p.isActive
                            ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                            : 'bg-slate-800 border-slate-700 text-slate-400'
                        }`}
                      >
                        {p.isActive ? 'Ativo' : 'Oculto'}
                      </button>
                    </div>

                    {p.badge && (
                      <span className="inline-block text-[10px] font-extrabold uppercase bg-blue-500/15 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-full">
                        {p.badge}
                      </span>
                    )}

                    {/* Valores */}
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-1.5 text-xs">
                      {p.isCustomContact ? (
                        <div>
                          <div className="font-extrabold text-emerald-400">Botão WhatsApp</div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {p.whatsappNumber || 'Sem número'}
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Mensal (PIX/Bol/1x):</span>
                            <strong className="text-white">{fmtMoney(p.monthlyPrice)}</strong>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Anual PIX/Boleto:</span>
                            <strong className="text-emerald-400">{fmtMoney(p.annualCashPrice)}</strong>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Anual Cartão:</span>
                            <strong className="text-blue-300">
                              {p.maxInstallments}x {fmtMoney(installment)}
                            </strong>
                          </div>
                          <div className="pt-1.5 border-t border-slate-800 flex justify-between text-[11px]">
                            <span className="text-slate-500">Margem vs DevNota:</span>
                            <span
                              className={`font-bold ${
                                monthlyNet > 0 ? 'text-emerald-400' : 'text-red-400'
                              }`}
                            >
                              {fmtMoney(monthlyNet)}/mês
                            </span>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Limites técnicos */}
                    <div className="flex flex-wrap gap-1.5 text-[11px]">
                      <span
                        className={`px-2 py-0.5 rounded-md font-bold ${
                          p.allowFiscalEmission
                            ? 'bg-purple-500/15 text-purple-300'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {p.allowFiscalEmission ? `${p.maxMonthlyInvoices} notas/mês` : 'Sem fiscal'}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-semibold">
                        Até {p.maxUsers} usuários
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-400">
                        {p._count?.subscriptions || 0} assinante(s)
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => openEditPlan(p)}
                      className="flex-1 py-2 px-3 rounded-lg bg-slate-800 hover:bg-blue-600 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <Edit className="w-3.5 h-3.5" /> Editar Preço / Regras
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeletePlan(p)}
                      title="Excluir plano"
                      className="p-2 rounded-lg bg-slate-800 hover:bg-red-600 text-slate-400 hover:text-white transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ============================================================
            ABA 2: OFICINAS & LEADS (CRM SAAS + CONTROLE DE TRIAL/COTA)
           ============================================================ */}
        {activeTab === 'WORKSHOPS' && (
          <div className="space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  placeholder="Buscar oficina, CNPJ, nome ou e-mail do responsável..."
                  value={workshopSearch}
                  onChange={(e) => setWorkshopSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500"
                />
              </div>

              <div className="flex flex-wrap gap-1.5 text-xs">
                {[
                  { id: 'ALL', label: 'Todas' },
                  { id: 'TRIAL', label: 'Em Trial' },
                  { id: 'EXPIRING', label: 'Vencendo ≤5d' },
                  { id: 'ACTIVE', label: 'Ativas' },
                  { id: 'PAST_DUE', label: 'Atrasadas' },
                  { id: 'EXPIRED', label: 'Expiradas' },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setWorkshopStatusFilter(f.id)}
                    className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                      workshopStatusFilter === f.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-950/70 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                    <th className="py-3 px-4">Oficina / Responsável</th>
                    <th className="py-3 px-4">Status / Vencimento</th>
                    <th className="py-3 px-4">Plano Atual</th>
                    <th className="py-3 px-4">Consumo Notas (Mês)</th>
                    <th className="py-3 px-4">Uso</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {workshops.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-slate-500">
                        Nenhuma oficina encontrada para o filtro selecionado.
                      </td>
                    </tr>
                  ) : (
                    workshops.map((ws) => {
                      const badge = STATUS_BADGE[ws.effectiveStatus] || STATUS_BADGE.TRIAL;
                      const pct =
                        ws.invoicesLimit > 0
                          ? Math.min(100, Math.round((ws.invoicesUsedThisMonth / ws.invoicesLimit) * 100))
                          : 0;

                      return (
                        <tr key={ws.id} className="hover:bg-slate-800/40">
                          <td className="py-3.5 px-4 align-top">
                            <div className="font-bold text-white text-sm">{ws.name}</div>
                            <div className="text-[11px] text-slate-400">
                              {ws.adminUser?.name || 'Sem admin'} • {ws.adminUser?.email || '—'}
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
                              {ws.document || 'Sem CNPJ'} • {ws.phone || 'Sem WhatsApp'}
                            </div>
                          </td>

                          <td className="py-3.5 px-4 align-top whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badge.cls}`}
                            >
                              {badge.label}
                            </span>
                            {ws.effectiveStatus === 'TRIAL' && (
                              <div className="text-[11px] text-blue-300 mt-1 font-semibold">
                                Restam {ws.trialDaysLeft} dia(s)
                              </div>
                            )}
                            {ws.subscription?.currentPeriodEnd && ws.effectiveStatus === 'ACTIVE' && (
                              <div className="text-[11px] text-slate-400 mt-1">
                                Renova:{' '}
                                {new Date(ws.subscription.currentPeriodEnd).toLocaleDateString('pt-BR')}
                              </div>
                            )}
                            {ws.subscription?.manualOverride && (
                              <div className="text-[10px] text-amber-300 mt-0.5">
                                ★ Liberação Manual / Cortesia
                              </div>
                            )}
                          </td>

                          <td className="py-3.5 px-4 align-top">
                            <div className="font-bold text-slate-200">
                              {ws.subscription?.plan?.name || 'Trial Grátis (Sem Fiscal)'}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {ws.subscription?.billingCycle === 'YEARLY' ? 'Ciclo Anual' : 'Ciclo Mensal'}
                              {ws.subscription?.customMonthlyPrice !== null &&
                              ws.subscription?.customMonthlyPrice !== undefined
                                ? ` • ${fmtMoney(ws.subscription.customMonthlyPrice)}/mês`
                                : ''}
                            </div>
                          </td>

                          <td className="py-3.5 px-4 align-top min-w-[140px]">
                            <div className="flex items-center justify-between text-[11px] mb-1">
                              <span className="font-bold text-white">
                                {ws.invoicesUsedThisMonth} / {ws.invoicesLimit}
                              </span>
                              {ws.invoicesLimit > 0 && (
                                <span className="text-slate-400">{pct}%</span>
                              )}
                            </div>
                            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  pct >= 95
                                    ? 'bg-red-500'
                                    : pct >= 80
                                    ? 'bg-amber-400'
                                    : 'bg-blue-500'
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </td>

                          <td className="py-3.5 px-4 align-top text-[11px] text-slate-400 whitespace-nowrap">
                            <div>{ws.usersCount} usuário(s)</div>
                            <div>
                              {ws.ordersCount} OS • {ws.customersCount} clientes
                            </div>
                          </td>

                          <td className="py-3.5 px-4 align-top text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                              <button
                                type="button"
                                onClick={() => openLeadWhatsApp(ws)}
                                title="Chamar responsável no WhatsApp"
                                className="p-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 border border-emerald-500/30 text-emerald-300 hover:text-white transition cursor-pointer"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleQuickExtendTrial(ws.id, 15)}
                                title="Adicionar +15 dias de Trial"
                                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-blue-600 text-slate-200 hover:text-white text-[11px] font-bold transition cursor-pointer"
                              >
                                +15d
                              </button>

                              <button
                                type="button"
                                onClick={() => openManageSubscription(ws)}
                                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold inline-flex items-center gap-1 transition cursor-pointer"
                              >
                                <Sliders className="w-3.5 h-3.5" /> Gerenciar
                              </button>
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
        )}

        {/* ============================================================
            ABA 3: FATURAS & PAGAMENTOS (ASAAS)
           ============================================================ */}
        {activeTab === 'PAYMENTS' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-950/70 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <th className="py-3 px-4">Oficina / Plano</th>
                  <th className="py-3 px-4">ID Asaas</th>
                  <th className="py-3 px-4">Forma / Parcelas</th>
                  <th className="py-3 px-4">Vencimento / Pago em</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500">
                      Nenhuma cobrança Asaas registrada ainda. Assim que o checkout da Etapa 3 for ativado, todas as faturas e confirmações de webhook aparecerão aqui.
                    </td>
                  </tr>
                ) : (
                  payments.map((pay) => (
                    <tr key={pay.id} className="hover:bg-slate-800/40">
                      <td className="py-3 px-4">
                        <div className="font-bold text-white">
                          {pay.subscription?.workshop?.name || '—'}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {pay.subscription?.plan?.name || 'Plano'} ({pay.billingCycle})
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                        {pay.asaasPaymentId || '—'}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-200">{pay.billingType}</span>
                        {pay.installments > 1 && (
                          <span className="text-slate-400"> ({pay.installments}x)</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        <div>Venc: {new Date(pay.dueDate).toLocaleDateString('pt-BR')}</div>
                        {pay.paidAt && (
                          <div className="text-emerald-400">
                            Pago: {new Date(pay.paidAt).toLocaleDateString('pt-BR')}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-200 font-bold text-[10px]">
                          {pay.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-extrabold text-emerald-400">
                        {fmtMoney(pay.amount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* ============================================================
          MODAL: CRIAR / EDITAR PLANO (PREÇOS DA LANDING PAGE + COTAS)
         ============================================================ */}
      {planModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
          onClick={() => setPlanModalOpen(false)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[92vh] overflow-y-auto p-6 space-y-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-extrabold text-white">
                {planForm.id ? `Editar Plano: ${planForm.name}` : 'Criar Novo Plano'}
              </h2>
              <button
                type="button"
                onClick={() => setPlanModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePlan} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-slate-400 font-semibold mb-1">Nome do Plano *</label>
                  <input
                    value={planForm.name}
                    onChange={(e) => setPlanForm((p) => ({ ...p, name: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Ordem na Página</label>
                  <input
                    type="number"
                    value={planForm.sortOrder}
                    onChange={(e) => setPlanForm((p) => ({ ...p, sortOrder: Number(e.target.value) }))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    Slug (identificador único)
                  </label>
                  <input
                    value={planForm.slug}
                    disabled={Boolean(planForm.id)}
                    onChange={(e) => setPlanForm((p) => ({ ...p, slug: e.target.value }))}
                    placeholder="ex: fiscal-100"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono disabled:opacity-50"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    Selo / Badge (opcional)
                  </label>
                  <input
                    value={planForm.badge}
                    onChange={(e) => setPlanForm((p) => ({ ...p, badge: e.target.value }))}
                    placeholder="Ex: Mais Escolhido"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Subtítulo do Card</label>
                <input
                  value={planForm.subtitle}
                  onChange={(e) => setPlanForm((p) => ({ ...p, subtitle: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
                />
              </div>

              {/* Flags de comportamento */}
              <div className="flex flex-wrap gap-4 bg-slate-950 border border-slate-800 rounded-xl p-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={planForm.isActive}
                    onChange={(e) => setPlanForm((p) => ({ ...p, isActive: e.target.checked }))}
                  />
                  <span>Exibir na Landing Page</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={planForm.isPopular}
                    onChange={(e) => setPlanForm((p) => ({ ...p, isPopular: e.target.checked }))}
                  />
                  <span>Card em Destaque</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={planForm.isCustomContact}
                    onChange={(e) =>
                      setPlanForm((p) => ({ ...p, isCustomContact: e.target.checked }))
                    }
                  />
                  <span className="text-emerald-300 font-bold">
                    Plano Personalizado (Botão WhatsApp)
                  </span>
                </label>
              </div>

              {/* Precificação ou WhatsApp */}
              {planForm.isCustomContact ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-4">
                  <div>
                    <label className="block text-emerald-300 font-semibold mb-1">
                      WhatsApp Comercial (55 + DDD + Número)
                    </label>
                    <input
                      value={planForm.whatsappNumber}
                      onChange={(e) =>
                        setPlanForm((p) => ({ ...p, whatsappNumber: e.target.value }))
                      }
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-emerald-300 font-semibold mb-1">
                      Mensagem Automática
                    </label>
                    <input
                      value={planForm.whatsappMessage}
                      onChange={(e) =>
                        setPlanForm((p) => ({ ...p, whatsappMessage: e.target.value }))
                      }
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
                    />
                  </div>
                </div>
              ) : (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                  <div className="font-bold text-blue-300">
                    Precificação (Asaas + Landing Page)
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-slate-400 mb-1">Mensal (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={planForm.monthlyPrice}
                        onChange={(e) =>
                          setPlanForm((p) => ({ ...p, monthlyPrice: Number(e.target.value) }))
                        }
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Anual PIX/Bol (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={planForm.annualCashPrice}
                        onChange={(e) =>
                          setPlanForm((p) => ({ ...p, annualCashPrice: Number(e.target.value) }))
                        }
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-emerald-300 font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Anual Cartão c/ Juros</label>
                      <input
                        type="number"
                        step="0.01"
                        value={planForm.annualCardPrice}
                        onChange={(e) =>
                          setPlanForm((p) => ({ ...p, annualCardPrice: Number(e.target.value) }))
                        }
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-blue-300 font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Máx. Parcelas</label>
                      <input
                        type="number"
                        min={1}
                        max={12}
                        value={planForm.maxInstallments}
                        onChange={(e) =>
                          setPlanForm((p) => ({ ...p, maxInstallments: Number(e.target.value) }))
                        }
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
                      />
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-400 flex flex-wrap gap-4 pt-1">
                    <span>
                      Parcela Cartão Anual:{' '}
                      <strong className="text-blue-300">
                        {planForm.maxInstallments}x de {fmtMoney(formInstallmentValue)}
                      </strong>
                    </span>
                    <span>
                      Custo DevNota:{' '}
                      <strong className="text-amber-300">{fmtMoney(formDevNotaCost)}/mês</strong>
                    </span>
                    <span>
                      Margem Mensal:{' '}
                      <strong
                        className={formMonthlyMargin >= 0 ? 'text-emerald-400' : 'text-red-400'}
                      >
                        {fmtMoney(formMonthlyMargin)}/mês
                      </strong>
                    </span>
                  </div>
                </div>
              )}

              {/* Regras Técnicas / Entitlements */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-950 border border-slate-800 rounded-xl p-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={planForm.allowFiscalEmission}
                    onChange={(e) =>
                      setPlanForm((p) => ({ ...p, allowFiscalEmission: e.target.checked }))
                    }
                  />
                  <span className="font-bold text-purple-300">Libera Emissão Fiscal</span>
                </label>

                <div>
                  <label className="block text-slate-400 mb-1">Cota Mensal de Notas</label>
                  <input
                    type="number"
                    min={0}
                    disabled={!planForm.allowFiscalEmission}
                    value={planForm.allowFiscalEmission ? planForm.maxMonthlyInvoices : 0}
                    onChange={(e) =>
                      setPlanForm((p) => ({ ...p, maxMonthlyInvoices: Number(e.target.value) }))
                    }
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white disabled:opacity-40"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Limite de Usuários</label>
                  <input
                    type="number"
                    min={1}
                    value={planForm.maxUsers}
                    onChange={(e) => setPlanForm((p) => ({ ...p, maxUsers: Number(e.target.value) }))}
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white"
                  />
                </div>
              </div>

              {/* Lista de Benefícios */}
              <div>
                <label className="block text-slate-400 font-semibold mb-1">
                  Benefícios listados no Card (1 item por linha)
                </label>
                <textarea
                  rows={5}
                  value={planForm.featuresText}
                  onChange={(e) => setPlanForm((p) => ({ ...p, featuresText: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-sans leading-relaxed"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setPlanModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingPlan}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold cursor-pointer"
                >
                  {savingPlan ? 'Salvando...' : 'Salvar e Publicar na Landing Page'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================
          MODAL: GERENCIAR ASSINATURA / PLANO PERSONALIZADO DA OFICINA
         ============================================================ */}
      {editingWorkshop && (
        <div
          className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
          onClick={() => setEditingWorkshop(null)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-base font-extrabold text-white">
                  Assinatura — {editingWorkshop.name}
                </h2>
                <p className="text-[11px] text-slate-400">
                  {editingWorkshop.adminUser?.email} • Consumo atual:{' '}
                  {editingWorkshop.invoicesUsedThisMonth} notas no mês
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingWorkshop(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSubscription} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Status da Conta</label>
                  <select
                    value={subForm.status}
                    onChange={(e) => setSubForm((s) => ({ ...s, status: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-bold"
                  >
                    <option value="TRIAL">TRIAL (Teste Grátis)</option>
                    <option value="ACTIVE">ACTIVE (Ativa / Liberada)</option>
                    <option value="PAST_DUE">PAST_DUE (Fatura em Atraso)</option>
                    <option value="EXPIRED">EXPIRED (Bloqueada / Paywall)</option>
                    <option value="CANCELED">CANCELED (Cancelada)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Plano Vinculado</label>
                  <select
                    value={subForm.planId}
                    onChange={(e) => setSubForm((s) => ({ ...s, planId: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
                  >
                    <option value="">Nenhum (Somente Trial)</option>
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.allowFiscalEmission ? `${p.maxMonthlyInvoices} notas` : 'Sem fiscal'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Ciclo</label>
                  <select
                    value={subForm.billingCycle}
                    onChange={(e) => setSubForm((s) => ({ ...s, billingCycle: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
                  >
                    <option value="MONTHLY">Mensal</option>
                    <option value="YEARLY">Anual</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Fim do Trial</label>
                  <input
                    type="date"
                    value={subForm.trialEndsAt}
                    onChange={(e) => setSubForm((s) => ({ ...s, trialEndsAt: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    Vencimento do Período
                  </label>
                  <input
                    type="date"
                    value={subForm.currentPeriodEnd}
                    onChange={(e) =>
                      setSubForm((s) => ({ ...s, currentPeriodEnd: e.target.value }))
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
                  />
                </div>
              </div>

              {/* Sobrescritas para Plano Personalizado */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="font-bold text-purple-300">
                  Sobrescrita Manual (Plano Personalizado / Negociação WhatsApp)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">
                      Cota Customizada de Notas/Mês
                    </label>
                    <input
                      type="number"
                      min={0}
                      placeholder="Ex: 500 ou 1000 (vazio = padrão do plano)"
                      value={subForm.customMonthlyInvoices}
                      onChange={(e) =>
                        setSubForm((s) => ({ ...s, customMonthlyInvoices: e.target.value }))
                      }
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">
                      Valor Mensal Negociado (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Para cálculo do MRR (opcional)"
                      value={subForm.customMonthlyPrice}
                      onChange={(e) =>
                        setSubForm((s) => ({ ...s, customMonthlyPrice: e.target.value }))
                      }
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={subForm.manualOverride}
                    onChange={(e) =>
                      setSubForm((s) => ({ ...s, manualOverride: e.target.checked }))
                    }
                  />
                  <span className="text-amber-300 font-semibold">
                    Ativar Cortesia / Blindagem Manual (não expira automaticamente)
                  </span>
                </label>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">
                  Anotações Internas (visível apenas no /console)
                </label>
                <textarea
                  rows={2}
                  value={subForm.adminNotes}
                  onChange={(e) => setSubForm((s) => ({ ...s, adminNotes: e.target.value }))}
                  placeholder="Ex: Negociado via WhatsApp — 600 notas/mês no boleto..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingWorkshop(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingSub}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold cursor-pointer"
                >
                  {savingSub ? 'Salvando...' : 'Aplicar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}