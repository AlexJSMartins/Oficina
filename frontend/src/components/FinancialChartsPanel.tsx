// frontend/src/components/FinancialChartsPanel.tsx
import { useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  TrendingUp,
  PieChart as PieIcon,
  CreditCard,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
} from 'lucide-react';

interface FinancialChartsPanelProps {
  transactions: any[];
  categoryLabels: Record<string, string>;
  paymentLabels: Record<string, string>;
}

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#64748b'];
const EXPENSE_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#eab308', '#8b5cf6', '#64748b'];

const formatBRL = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));

export default function FinancialChartsPanel({
  transactions,
  categoryLabels,
  paymentLabels,
}: FinancialChartsPanelProps) {
  // 1. Processamento para Curva de Tendência (Agrupado por Data)
  const timelineData = useMemo(() => {
    const map: Record<
      string,
      { dateKey: string; label: string; receitas: number; despesas: number; saldo: number }
    > = {};

    const sorted = [...transactions].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    sorted.forEach((t) => {
      const d = new Date(t.date);
      const dateKey = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      const amount = Number(t.amount || 0);

      if (!map[dateKey]) {
        map[dateKey] = { dateKey, label, receitas: 0, despesas: 0, saldo: 0 };
      }

      if (t.type === 'INCOME') {
        map[dateKey].receitas += amount;
      } else {
        map[dateKey].despesas += amount;
      }
      map[dateKey].saldo = map[dateKey].receitas - map[dateKey].despesas;
    });

    return Object.values(map);
  }, [transactions]);

  // 2. Composição da Receita (Mão de Obra vs. Peças vs. Outros)
  const revenueSplitData = useMemo(() => {
    let labor = 0;
    let parts = 0;
    let other = 0;

    transactions
      .filter((t) => t.type === 'INCOME')
      .forEach((t) => {
        const l = Number(t.laborAmount || 0);
        const p = Number(t.partsAmount || 0);
        if (l > 0 || p > 0) {
          labor += l;
          parts += p;
        } else {
          other += Number(t.amount || 0);
        }
      });

    return [
      { name: 'Mão de Obra (Serviços)', value: Number(labor.toFixed(2)), color: '#10b981' },
      { name: 'Venda de Peças', value: Number(parts.toFixed(2)), color: '#2563eb' },
      { name: 'Outras Entradas', value: Number(other.toFixed(2)), color: '#f59e0b' },
    ].filter((item) => item.value > 0);
  }, [transactions]);

  // 3. Despesas por Categoria (Para Gráfico de Barras Horizontais)
  const expensesByCategoryData = useMemo(() => {
    const map: Record<string, number> = {};

    transactions
      .filter((t) => t.type === 'EXPENSE')
      .forEach((t) => {
        const catName = categoryLabels[t.category] || t.category || 'Outros';
        map[catName] = (map[catName] || 0) + Number(t.amount || 0);
      });

    return Object.entries(map)
      .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }))
      .sort((a, b) => b.value - a.value);
  }, [transactions, categoryLabels]);

  // 4. Receitas por Meio de Pagamento (PIX, Cartão, Dinheiro, etc.)
  const paymentMethodsData = useMemo(() => {
    const map: Record<string, number> = {};

    transactions
      .filter((t) => t.type === 'INCOME')
      .forEach((t) => {
        const methodName = paymentLabels[t.paymentMethod] || t.paymentMethod || 'Outros';
        map[methodName] = (map[methodName] || 0) + Number(t.amount || 0);
      });

    return Object.entries(map)
      .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }))
      .sort((a, b) => b.value - a.value);
  }, [transactions, paymentLabels]);

  // KPIs Rápidos de Inteligência
  const totalIn = transactions
    .filter((t) => t.type === 'INCOME')
    .reduce((acc, t) => acc + Number(t.amount || 0), 0);

  /* const totalOut = transactions
    .filter((t) => t.type === 'EXPENSE')
    .reduce((acc, t) => acc + Number(t.amount || 0), 0); */

  const osIncomeTransactions = transactions.filter(
    (t) => t.type === 'INCOME' && t.category === 'SERVICE_ORDER',
  );
  const avgTicket =
    osIncomeTransactions.length > 0 ? totalIn / osIncomeTransactions.length : 0;

  if (transactions.length === 0) {
    return (
      <div className="bg-white p-12 rounded-xl border border-slate-200 text-center space-y-2">
        <AlertCircle className="w-8 h-8 text-slate-400 mx-auto" />
        <h3 className="text-base font-bold text-slate-700">
          Sem movimentações financeiras no período selecionado
        </h3>
        <p className="text-xs text-slate-400">
          Altere o filtro de datas acima ou registre lançamentos para visualizar os gráficos de BI.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Mini KPIs Analíticos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase text-slate-400">
              Ticket Médio por Recebimento OS
            </span>
            <p className="text-xl font-extrabold text-slate-900 mt-0.5">{formatBRL(avgTicket)}</p>
            <span className="text-[11px] text-slate-500">
              Baseado em {osIncomeTransactions.length} baixa(s) no período
            </span>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Wallet className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase text-slate-400">
              Maior Fonte de Receita
            </span>
            <p className="text-lg font-extrabold text-emerald-700 mt-0.5 truncate">
              {revenueSplitData[0]?.name || 'N/A'}
            </p>
            <span className="text-[11px] text-slate-500">
              {revenueSplitData[0] ? formatBRL(revenueSplitData[0].value) : 'R$ 0,00'}
            </span>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <ArrowUpRight className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase text-slate-400">
              Maior Centro de Custo / Saída
            </span>
            <p className="text-lg font-extrabold text-red-600 mt-0.5 truncate">
              {expensesByCategoryData[0]?.name || 'Nenhuma despesa'}
            </p>
            <span className="text-[11px] text-slate-500">
              {expensesByCategoryData[0] ? formatBRL(expensesByCategoryData[0].value) : 'R$ 0,00'}
            </span>
          </div>
          <div className="p-3 bg-red-50 text-red-600 rounded-xl">
            <ArrowDownRight className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* GRÁFICO 1: Curva de Evolução Financeira (Entradas vs Saídas por Dia) */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              Curva de Tendência: Entradas vs. Saídas no Período
            </h3>
            <p className="text-xs text-slate-500">
              Acompanhamento diário do faturamento bruto frente aos custos e despesas.
            </p>
          </div>
        </div>

        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={timelineData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="colorReceitas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorDespesas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis
                tickFormatter={(v) => `R$ ${v}`}
                tick={{ fontSize: 11, fill: '#64748b' }}
                width={80}
              />
              <Tooltip
                formatter={(value: any) => [formatBRL(Number(value)), '']}
                contentStyle={{
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  fontSize: '12px',
                  fontWeight: 600,
                }}
              />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
              <Area
                type="monotone"
                dataKey="receitas"
                name="Entradas / Receitas"
                stroke="#10b981"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#colorReceitas)"
              />
              <Area
                type="monotone"
                dataKey="despesas"
                name="Saídas / Custos"
                stroke="#ef4444"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#colorDespesas)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* LINHA DUPLA: Pizza de Receitas (Mão de Obra x Peças) + Pizza de Meios de Pagamento */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* GRÁFICO 2: Donut de Mão de Obra vs Peças */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="border-b pb-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-emerald-600" />
              Origem do Faturamento (Mão de Obra vs. Peças)
            </h3>
            <p className="text-xs text-slate-500">
              Proporção exata entre serviços executados e revenda de peças.
            </p>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={revenueSplitData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={95}
                  paddingAngle={4}
                  dataKey="value"
                  label={({ name, percent }) => `${name}: ${((percent || 0 )* 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {revenueSplitData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: any) => formatBRL(Number(value))} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* GRÁFICO 3: Meios de Pagamento Preferidos dos Clientes */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="border-b pb-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-purple-600" />
              Recebimentos por Forma de Pagamento
            </h3>
            <p className="text-xs text-slate-500">
              Distribuição de caixa entre PIX, Cartões, Dinheiro e Transferências.
            </p>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={paymentMethodsData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={95}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {paymentMethodsData.map((_, index) => (
                    <Cell key={`cell-pay-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: any) => formatBRL(Number(value))} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* GRÁFICO 4: Ranking de Custos e Despesas Operacionais por Categoria */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="border-b pb-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
            Raio-X de Saídas: Custos de Peças (CMV) & Despesas por Categoria
          </h3>
          <p className="text-xs text-slate-500">
            Comparativo direto entre categorias de gastos para controle de margem líquida.
          </p>
        </div>

        {expensesByCategoryData.length === 0 ? (
          <p className="text-xs text-slate-400 py-8 text-center">
            Nenhuma saída ou despesa registrada neste período.
          </p>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={expensesByCategoryData}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  type="number"
                  tickFormatter={(v) => `R$ ${v}`}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={150}
                  tick={{ fontSize: 11, fill: '#1e293b', fontWeight: 600 }}
                />
                <Tooltip
                  formatter={(value: any) => [formatBRL(Number(value)), 'Total Gasto']}
                  contentStyle={{ borderRadius: '10px', fontSize: '12px' }}
                />
                <Bar dataKey="value" name="Valor Gasto" radius={[0, 8, 8, 0]} barSize={26}>
                  {expensesByCategoryData.map((_, index) => (
                    <Cell
                      key={`cell-exp-${index}`}
                      fill={EXPENSE_COLORS[index % EXPENSE_COLORS.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}