import React, { useEffect, useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { api } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import BulkImportFinancialModal from '../../components/BulkImportFinancialModal';
import FinancialChartsPanel from '../../components/FinancialChartsPanel';
import MechanicCommissionsPanel from '../../components/MechanicCommissionsPanel';
import ConfirmModal from '../../components/ConfirmModal';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Plus,
  Trash2,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  FileSpreadsheet,
  Search,
  Calendar,
  BarChart3,
  Download,
  RotateCcw,
  Wrench,
  Users,
} from 'lucide-react';

const CATEGORY_LABELS: Record<string, string> = {
  SERVICE_ORDER: 'Recebimento de OS',
  PARTS_COST: 'Custo de Peças (CMV)',
  RENT: 'Aluguel / Imóvel',
  UTILITIES: 'Água / Luz / Internet',
  SALARY: 'Salários / Comissões',
  TOOLS: 'Ferramentas / Equipamentos',
  OTHER: 'Outros Lançamentos',
};

const PAYMENT_LABELS: Record<string, string> = {
  PIX: 'PIX',
  CREDIT_CARD: 'Cartão de Crédito',
  DEBIT_CARD: 'Cartão de Débito',
  CASH: 'Dinheiro',
  BOLETO: 'Boleto',
  TRANSFER: 'Transferência / Outro',
};

export default function FinancialPage() {
  const { showToast } = useToast();
  const now = new Date();
  const tzOffset = now.getTimezoneOffset() * 60000;
  const todayISO = new Date(now.getTime() - tzOffset).toISOString().split('T')[0];
  const firstDayOfMonthISO = `${todayISO.slice(0, 7)}-01`;

  // Abas: Visão Extrato/DRE vs Visão Gráficos BI
 const [activeTab, setActiveTab] = useState<'EXTRATO' | 'CHARTS' | 'COMMISSIONS'>('EXTRATO');

  // Modo de Filtro de Data (Mês/Ano vs Calendário Personalizado)
  const [dateFilterMode, setDateFilterMode] = useState<'MONTH' | 'CUSTOM'>('MONTH');
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [startDate, setStartDate] = useState(firstDayOfMonthISO);
  const [endDate, setEndDate] = useState(todayISO);

  // Filtros Rápidos do Painel
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');
  const [scopeFilter, setScopeFilter] = useState<
    'ALL' | 'ONLY_LABOR' | 'ONLY_PARTS' | 'ONLY_FIXED_EXPENSES'
  >('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [paymentFilter, setPaymentFilter] = useState('ALL');

  const [data, setData] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);

  // Estado do formulário manual
  const [type, setType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');
  const [category, setCategory] = useState('RENT');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('PIX');
  const [txDate, setTxDate] = useState(todayISO);

  const loadFinancial = async () => {
    try {
      const query =
        dateFilterMode === 'CUSTOM'
          ? `startDate=${startDate}&endDate=${endDate}`
          : `month=${month}&year=${year}`;
      const res = await api.get(`/financial/dashboard?${query}`);
      setData(res.data);
    } catch {
      showToast('Erro ao carregar dados financeiros.', 'error');
    }
  };

  useEffect(() => {
    loadFinancial();
  }, [dateFilterMode, month, year, startDate, endDate]);

  // Atalhos rápidos de calendário
  const setQuickPeriod = (preset: 'TODAY' | 'LAST_7' | 'THIS_MONTH') => {
    if (preset === 'TODAY') {
      setDateFilterMode('CUSTOM');
      setStartDate(todayISO);
      setEndDate(todayISO);
    } else if (preset === 'LAST_7') {
      const d = new Date(now.getTime() - 6 * 86400000 - tzOffset);
      setDateFilterMode('CUSTOM');
      setStartDate(d.toISOString().split('T')[0]);
      setEndDate(todayISO);
    } else {
      setDateFilterMode('MONTH');
      setMonth(now.getMonth() + 1);
      setYear(now.getFullYear());
    }
  };

  const resetFilters = () => {
    setSearchTerm('');
    setTypeFilter('ALL');
    setScopeFilter('ALL');
    setCategoryFilter('ALL');
    setPaymentFilter('ALL');
  };

  const handleCreateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/financial/transactions', {
        type,
        category,
        description,
        amount: Number(amount),
        paymentMethod,
        date: txDate,
      });
      showToast('Lançamento registrado no caixa!', 'success');
      setShowModal(false);
      setDescription('');
      setAmount('');
      loadFinancial();
    } catch {
      showToast('Erro ao salvar lançamento.', 'error');
    }
  };

  const confirmDeleteTransaction = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/financial/transactions/${deleteTarget.id}`);
      showToast('Lançamento removido do caixa.', 'success');
      setDeleteTarget(null);
      loadFinancial();
    } catch {
      showToast('Erro ao excluir lançamento.', 'error');
    }
  };

  // Filtragem Dinâmica Inteligente (incluindo recorte por Mão de Obra ou Peças)
  const filteredTransactions = useMemo(() => {
    const rawList: any[] = data?.transactions || [];

    return rawList
      .filter((t) => {
        // 1. Busca por texto
        if (searchTerm) {
          const q = searchTerm.toLowerCase();
          const matchDesc = String(t.description || '').toLowerCase().includes(q);
          const matchPlate = String(t.serviceOrder?.vehicle?.plate || '')
            .toLowerCase()
            .includes(q);
          const matchClient = String(t.serviceOrder?.customer?.name || '')
            .toLowerCase()
            .includes(q);
          if (!matchDesc && !matchPlate && !matchClient) return false;
        }

        // 2. Filtro Entrada vs Saída
        if (typeFilter !== 'ALL' && t.type !== typeFilter) return false;

        // 3. Filtro por Categoria
        if (categoryFilter !== 'ALL' && t.category !== categoryFilter) return false;

        // 4. Filtro por Meio de Pagamento
        if (paymentFilter !== 'ALL' && t.paymentMethod !== paymentFilter) return false;

        // 5. Filtro por Foco Operacional (Mão de Obra vs Peças vs Custos Fixos)
        if (scopeFilter === 'ONLY_LABOR') {
          return t.type === 'INCOME' && Number(t.laborAmount || 0) > 0;
        }
        if (scopeFilter === 'ONLY_PARTS') {
          const isPartSale = t.type === 'INCOME' && Number(t.partsAmount || 0) > 0;
          const isPartCost = t.type === 'EXPENSE' && t.category === 'PARTS_COST';
          return isPartSale || isPartCost;
        }
        if (scopeFilter === 'ONLY_FIXED_EXPENSES') {
          return t.type === 'EXPENSE' && t.category !== 'PARTS_COST';
        }

        return true;
      })
      .map((t) => {
        // Se o usuário filtrou especificamente "Só Mão de Obra" ou "Só Peças", exibe o valor exato daquela fração!
        if (scopeFilter === 'ONLY_LABOR' && t.type === 'INCOME') {
          return { ...t, displayAmount: Number(t.laborAmount || t.amount) };
        }
        if (scopeFilter === 'ONLY_PARTS' && t.type === 'INCOME') {
          return { ...t, displayAmount: Number(t.partsAmount || 0) };
        }
        return { ...t, displayAmount: Number(t.amount || 0) };
      });
  }, [data, searchTerm, typeFilter, scopeFilter, categoryFilter, paymentFilter]);

  // Totais calculados em tempo real sobre a pesquisa ativa
  const filteredTotals = useMemo(() => {
    let income = 0;
    let expense = 0;
    filteredTransactions.forEach((t) => {
      if (t.type === 'INCOME') income += t.displayAmount;
      else expense += t.displayAmount;
    });
    return {
      income,
      expense,
      balance: income - expense,
    };
  }, [filteredTransactions]);

  // Exportar listagem filtrada para Excel
  const handleExportExcel = () => {
    if (filteredTransactions.length === 0) {
      showToast('Não há lançamentos na pesquisa atual para exportar.', 'error');
      return;
    }
    const rows = filteredTransactions.map((t) => ({
      Data: new Date(t.date).toLocaleDateString('pt-BR'),
      Tipo: t.type === 'INCOME' ? 'Entrada' : 'Saída',
      Categoria: CATEGORY_LABELS[t.category] || t.category,
      Descricao: t.description,
      Meio_Pagamento: PAYMENT_LABELS[t.paymentMethod] || t.paymentMethod,
      Mao_de_Obra_R$: Number(t.laborAmount || 0).toFixed(2),
      Pecas_Venda_R$: Number(t.partsAmount || 0).toFixed(2),
      Valor_Exibido_R$: Number(t.displayAmount || t.amount).toFixed(2),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Extrato_Filtrado');
    XLSX.writeFile(wb, `Relatorio_Financeiro_OficinaPro_${todayISO}.xlsx`);
  };

  const summary = data?.summary || {
    grossRevenue: 0,
    laborRevenue: 0,
    partsRevenue: 0,
    partsCost: 0,
    grossProfit: 0,
    operatingExpenses: 0,
    netProfit: 0,
    profitMargin: 0,
  };

  const hasActiveSubFilters =
    searchTerm !== '' ||
    typeFilter !== 'ALL' ||
    scopeFilter !== 'ALL' ||
    categoryFilter !== 'ALL' ||
    paymentFilter !== 'ALL';

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Cabeçalho + Ações Principais */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Financeiro, Caixa & DRE</h1>
          <p className="text-sm text-slate-500">
            Controle de entradas, custos de peças (CMV), despesas operacionais, importação de planilhas e BI.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Alternador de Visão: Extrato vs Gráficos */}
          <div className="bg-slate-200 p-1 rounded-xl flex items-center text-xs font-bold">
        <button
              onClick={() => setActiveTab('EXTRATO')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                activeTab === 'EXTRATO'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <PieChart className="w-3.5 h-3.5" /> DRE & Extrato
            </button>
            <button
              onClick={() => setActiveTab('CHARTS')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                activeTab === 'CHARTS'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" /> Gráficos & BI
            </button>
            <button
              onClick={() => setActiveTab('COMMISSIONS')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                activeTab === 'COMMISSIONS'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" /> Produtividade & Comissões
            </button>
          </div>

          <button
            onClick={() => setShowImportModal(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
          >
            <FileSpreadsheet className="w-4 h-4" /> Subir Planilha de Custos
          </button>

          <button
            onClick={handleExportExcel}
            className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition"
          >
            <Download className="w-3.5 h-3.5" /> Exportar Excel
          </button>

          <button
            onClick={() => setShowModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
          >
            <Plus className="w-4 h-4" /> Novo Lançamento
          </button>
        </div>
      </div>

      {/* BARRA DE PERÍODO E CALENDÁRIO */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase text-slate-500 flex items-center gap-1 mr-1">
              <Calendar className="w-4 h-4 text-blue-600" /> Período:
            </span>

            <select
              value={dateFilterMode}
              onChange={(e) => setDateFilterMode(e.target.value as 'MONTH' | 'CUSTOM')}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold bg-slate-50"
            >
              <option value="MONTH">Por Mês / Ano Fechado</option>
              <option value="CUSTOM">Calendário (De / Até)</option>
            </select>

            {dateFilterMode === 'MONTH' ? (
              <div className="flex items-center gap-2">
                <select
                  value={month}
                  onChange={(e) => setMonth(Number(e.target.value))}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white font-semibold"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>
                      Mês {String(m).padStart(2, '0')}
                    </option>
                  ))}
                </select>

                <select
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white font-semibold"
                >
                  {[2024, 2025, 2026, 2027].map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white font-semibold"
                />
                <span className="text-xs text-slate-400 font-bold">até</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white font-semibold"
                />
              </div>
            )}
          </div>

          {/* Atalhos Rápidos de Data */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setQuickPeriod('TODAY')}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-xs font-semibold transition"
            >
              Hoje
            </button>
            <button
              type="button"
              onClick={() => setQuickPeriod('LAST_7')}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-xs font-semibold transition"
            >
              Últimos 7 Dias
            </button>
            <button
              type="button"
              onClick={() => setQuickPeriod('THIS_MONTH')}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-xs font-semibold transition"
            >
              Este Mês
            </button>
          </div>
        </div>

        {/* MENUS DROPDOWN DE PESQUISA AVANÇADA */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 pt-1">
          {/* Busca por texto */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              placeholder="Buscar descrição, placa, OS..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs bg-slate-50 focus:bg-white"
            />
          </div>

          {/* Dropdown 1: Entradas vs Saídas */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-semibold text-slate-700"
          >
            <option value="ALL">🔄 Fluxo: Entradas & Saídas</option>
            <option value="INCOME">📈 Apenas Entradas (Receitas)</option>
            <option value="EXPENSE">📉 Apenas Saídas (Custos/Despesas)</option>
          </select>

          {/* Dropdown 2: Foco Mão de Obra vs Peças */}
          <select
            value={scopeFilter}
            onChange={(e) => setScopeFilter(e.target.value as any)}
            className="px-3 py-2 border border-blue-300 rounded-lg text-xs bg-blue-50/50 font-bold text-blue-950"
          >
            <option value="ALL">🔍 Visão: Tudo (Mão de Obra + Peças + Fixos)</option>
            <option value="ONLY_LABOR">🔧 Só Mão de Obra (Serviços OS)</option>
            <option value="ONLY_PARTS">⚙️ Só Peças (Venda + Custo CMV)</option>
            <option value="ONLY_FIXED_EXPENSES">🏢 Só Despesas Fixas / Operacionais</option>
          </select>

          {/* Dropdown 3: Categoria */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-semibold text-slate-700"
          >
            <option value="ALL">📂 Todas as Categorias</option>
            {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>

          {/* Dropdown 4: Meio de Pagamento + Botão Limpar */}
          <div className="flex items-center gap-1.5">
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-semibold text-slate-700"
            >
              <option value="ALL">💳 Todos os Pagamentos</option>
              {Object.entries(PAYMENT_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>

            {hasActiveSubFilters && (
              <button
                type="button"
                onClick={resetFilters}
                title="Limpar filtros de pesquisa"
                className="p-2 bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600 rounded-lg border border-slate-200 transition"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Cards de Resumo Rápido do Período */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center text-slate-500 text-[11px] font-bold uppercase">
            <span>Receita Bruta Total</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-xl font-extrabold text-slate-900 mt-1.5">
            R$ {Number(summary.grossRevenue).toFixed(2)}
          </p>
          <span className="text-[11px] text-slate-400">
            Peças: R$ {Number(summary.partsRevenue || 0).toFixed(2)}
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-blue-200 bg-blue-50/30 shadow-sm">
          <div className="flex justify-between items-center text-blue-800 text-[11px] font-bold uppercase">
            <span>Mão de Obra (OS)</span>
            <Wrench className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-xl font-extrabold text-blue-700 mt-1.5">
            R$ {Number(summary.laborRevenue || 0).toFixed(2)}
          </p>
          <span className="text-[11px] text-blue-600/80">Serviço puro executado</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center text-slate-500 text-[11px] font-bold uppercase">
            <span>Custo de Peças (CMV)</span>
            <TrendingDown className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-xl font-extrabold text-amber-600 mt-1.5">
            - R$ {Number(summary.partsCost).toFixed(2)}
          </p>
          <span className="text-[11px] text-slate-400">Insumos e autopeças</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center text-slate-500 text-[11px] font-bold uppercase">
            <span>Despesas Operacionais</span>
            <TrendingDown className="w-4 h-4 text-red-500" />
          </div>
          <p className="text-xl font-extrabold text-red-600 mt-1.5">
            - R$ {Number(summary.operatingExpenses).toFixed(2)}
          </p>
          <span className="text-[11px] text-slate-400">Aluguel, luz, folha, etc.</span>
        </div>

        <div
          className={`p-4 rounded-xl border shadow-sm ${
            summary.netProfit >= 0
              ? 'bg-emerald-950 text-white border-emerald-800'
              : 'bg-red-950 text-white border-red-800'
          }`}
        >
          <div className="flex justify-between items-center text-emerald-300 text-[11px] font-bold uppercase">
            <span>Lucro Líquido (DRE)</span>
            <DollarSign className="w-4 h-4" />
          </div>
          <p className="text-xl font-extrabold mt-1.5">
            R$ {Number(summary.netProfit).toFixed(2)}
          </p>
          <span className="text-[11px] text-emerald-300 font-medium">
            Margem: {Number(summary.profitMargin).toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Faixa de Resumo da Pesquisa Ativa (aparece quando um filtro específico está aplicado) */}
      {hasActiveSubFilters && (
        <div className="bg-slate-900 text-white px-5 py-3 rounded-xl flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="font-semibold">
            Mostrando <strong>{filteredTransactions.length}</strong> lançamento(s) para o filtro selecionado:
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <span>
              Entradas Filtradas:{' '}
              <strong className="text-emerald-400">R$ {filteredTotals.income.toFixed(2)}</strong>
            </span>
            <span>
              Saídas Filtradas:{' '}
              <strong className="text-red-400">- R$ {filteredTotals.expense.toFixed(2)}</strong>
            </span>
            <span className="bg-white/10 px-2.5 py-1 rounded font-bold">
              Saldo do Filtro: R$ {filteredTotals.balance.toFixed(2)}
            </span>
          </div>
        </div>
      )}

      {/* ABA 1: DRE ESTRUTURADO + EXTRATO DETALHADO */}
      {activeTab === 'EXTRATO' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Coluna 1: DRE Gerencial da Oficina */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4 h-fit">
            <div className="flex items-center gap-2 border-b pb-3">
              <PieChart className="w-5 h-5 text-blue-600" />
              <h2 className="font-bold text-slate-900 text-sm uppercase tracking-wider">
                Demonstrativo DRE do Período
              </h2>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-slate-700">
                <span>(+) Receita Operacional Bruta</span>
                <span className="font-bold text-emerald-600">
                  R$ {Number(summary.grossRevenue).toFixed(2)}
                </span>
              </div>

              <div className="pl-3 border-l-2 border-slate-200 space-y-1 text-xs text-slate-500">
                <div className="flex justify-between">
                  <span>• Serviços / Mão de Obra:</span>
                  <span className="font-semibold text-blue-600">
                    R$ {Number(summary.laborRevenue || 0).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>• Venda de Peças nas OS:</span>
                  <span className="font-semibold text-amber-600">
                    R$ {Number(summary.partsRevenue || 0).toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="flex justify-between text-slate-600">
                <span>(-) Custo de Compra das Peças (CMV)</span>
                <span className="font-semibold text-amber-600">
                  - R$ {Number(summary.partsCost).toFixed(2)}
                </span>
              </div>

              <div className="flex justify-between border-t pt-2 font-bold text-slate-900">
                <span>(=) Lucro Bruto Operacional</span>
                <span>R$ {Number(summary.grossProfit).toFixed(2)}</span>
              </div>

              <div className="flex justify-between text-slate-600 pt-1">
                <span>(-) Despesas Fixas / Operacionais</span>
                <span className="font-semibold text-red-600">
                  - R$ {Number(summary.operatingExpenses).toFixed(2)}
                </span>
              </div>

              <div className="flex justify-between border-t-2 border-slate-900 pt-3 text-base font-extrabold text-slate-900">
                <span>(=) Resultado Líquido Real</span>
                <span className={summary.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                  R$ {Number(summary.netProfit).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Colunas 2 e 3: Extrato Detalhado do Fluxo de Caixa */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">
                Extrato de Movimentações ({filteredTransactions.length})
              </h3>
              {scopeFilter !== 'ALL' && (
                <span className="text-xs font-bold bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full">
                  Exibindo valores proporcionais ao filtro ativo
                </span>
              )}
            </div>

            <div className="divide-y max-h-[540px] overflow-y-auto">
              {filteredTransactions.length === 0 ? (
                <div className="p-10 text-center text-slate-400 text-sm">
                  Nenhuma movimentação encontrada para os filtros selecionados.
                </div>
              ) : (
                filteredTransactions.map((t: any) => (
                  <div
                    key={t.id}
                    className="p-4 flex items-center justify-between hover:bg-slate-50 transition"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`p-2 rounded-lg mt-0.5 ${
                          t.type === 'INCOME'
                            ? 'bg-emerald-50 text-emerald-600'
                            : 'bg-red-50 text-red-600'
                        }`}
                      >
                        {t.type === 'INCOME' ? (
                          <ArrowUpRight className="w-4 h-4" />
                        ) : (
                          <ArrowDownRight className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{t.description}</p>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-0.5">
                          <span className="font-medium text-slate-600">
                            {CATEGORY_LABELS[t.category] || t.category}
                          </span>
                          <span>•</span>
                          <span>{PAYMENT_LABELS[t.paymentMethod] || t.paymentMethod}</span>
                          <span>•</span>
                          <span>{new Date(t.date).toLocaleDateString('pt-BR')}</span>

                          {t.type === 'INCOME' && (t.laborAmount > 0 || t.partsAmount > 0) && (
                            <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[11px] font-semibold">
                              M.O: R$ {Number(t.laborAmount).toFixed(2)} | Peças: R${' '}
                              {Number(t.partsAmount).toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={`text-sm font-extrabold ${
                          t.type === 'INCOME' ? 'text-emerald-600' : 'text-red-600'
                        }`}
                      >
                        {t.type === 'INCOME' ? '+' : '-'} R${' '}
                        {Number(t.displayAmount ?? t.amount).toFixed(2)}
                      </span>
                      <button
                        onClick={() => setDeleteTarget(t)}
                        className="text-slate-300 hover:text-red-600 p-1 rounded hover:bg-red-50 transition"
                        title="Excluir lançamento"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
      
      {activeTab === 'CHARTS' && (
        <FinancialChartsPanel
          transactions={filteredTransactions}
          categoryLabels={CATEGORY_LABELS}
          paymentLabels={PAYMENT_LABELS}
        />
      )}

      {activeTab === 'COMMISSIONS' && (
        <MechanicCommissionsPanel
          dateFilterMode={dateFilterMode}
          month={month}
          year={year}
          startDate={startDate}
          endDate={endDate}
        />
      )}
      

      {/* Modal para Lançar Despesa ou Receita Avulsa */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex justify-between items-center border-b pb-3">
              <h2 className="text-lg font-bold text-slate-900">Novo Lançamento no Caixa</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTransaction} className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setType('EXPENSE');
                    setCategory('RENT');
                  }}
                  className={`py-2 rounded-lg text-xs font-bold border ${
                    type === 'EXPENSE'
                      ? 'bg-red-600 text-white border-red-600'
                      : 'bg-slate-50 text-slate-600'
                  }`}
                >
                  📉 Saída / Despesa
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setType('INCOME');
                    setCategory('OTHER');
                  }}
                  className={`py-2 rounded-lg text-xs font-bold border ${
                    type === 'INCOME'
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-slate-50 text-slate-600'
                  }`}
                >
                  📈 Entrada Avulsa
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Categoria
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                  >
                    <option value="RENT">Aluguel / Imóvel</option>
                    <option value="UTILITIES">Água / Luz / Internet</option>
                    <option value="SALARY">Salários / Comissões</option>
                    <option value="PARTS_COST">Compra de Peças / Insumos</option>
                    <option value="TOOLS">Ferramentas / Manutenção</option>
                    <option value="SERVICE_ORDER">Recebimento de Serviço</option>
                    <option value="OTHER">Outros</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Data do Lançamento
                  </label>
                  <input
                    type="date"
                    value={txDate}
                    onChange={(e) => setTxDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Descrição</label>
                <input
                  placeholder="Ex: Conta de Energia CPFL"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Valor (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Meio de Pagamento
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                  >
                    <option value="PIX">PIX</option>
                    <option value="CREDIT_CARD">Cartão de Crédito</option>
                    <option value="DEBIT_CARD">Cartão de Débito</option>
                    <option value="CASH">Dinheiro</option>
                    <option value="BOLETO">Boleto</option>
                    <option value="TRANSFER">Transferência</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-100 rounded-lg text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold"
                >
                  Salvar no Caixa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Importação de Planilhas Financeiras */}
      {showImportModal && (
        <BulkImportFinancialModal
          onClose={() => setShowImportModal(false)}
          onSuccess={loadFinancial}
        />
      )}

      {/* Modal Personalizado para Excluir Lançamento */}
      {deleteTarget && (
        <ConfirmModal
          isOpen={!!deleteTarget}
          title="Excluir Lançamento do Caixa"
          description={`Tem certeza que deseja remover "${deleteTarget.description}" no valor de R$ ${Number(
            deleteTarget.amount,
          ).toFixed(2)}? O saldo do DRE será recalculado imediatamente.`}
          confirmText="Sim, Excluir do Caixa"
          onConfirm={confirmDeleteTransaction}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}