import { useEffect, useState } from 'react';
import { api } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Users, Target, Award, DollarSign, ChevronDown, ChevronUp, Edit2, Check, Banknote } from 'lucide-react';

interface MechanicCommissionsPanelProps {
  dateFilterMode: 'MONTH' | 'CUSTOM';
  month: number;
  year: number;
  startDate: string;
  endDate: string;
}

export default function MechanicCommissionsPanel({
  dateFilterMode,
  month,
  year,
  startDate,
  endDate,
}: MechanicCommissionsPanelProps) {
  const { showToast } = useToast();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expandedMech, setExpandedMech] = useState<string | null>(null);

  // Estados de edição de taxa inline
  const [editingOsId, setEditingOsId] = useState<string | null>(null);
  const [tempRate, setTempRate] = useState<number | string>('');

  const loadProductivity = async () => {
    setLoading(true);
    try {
      const query = dateFilterMode === 'CUSTOM'
        ? `startDate=${startDate}&endDate=${endDate}`
        : `month=${month}&year=${year}`;
      const res = await api.get(`/financial/productivity?${query}`);
      setData(res.data);
    } catch {
      showToast('Erro ao carregar comissões.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProductivity();
  }, [dateFilterMode, month, year, startDate, endDate]);

  const handleSaveCommissionRate = async (orderId: string) => {
    try {
      const rateToSave = tempRate === '' ? null : Number(tempRate);
      await api.patch(`/service-orders/${orderId}/commission`, { rate: rateToSave });
      showToast('Comissão ajustada para esta OS.', 'success');
      setEditingOsId(null);
      loadProductivity();
    } catch {
      showToast('Erro ao alterar comissão.', 'error');
    }
  };

  const handlePayCommission = async (mech: any) => {
    if (!confirm(`Deseja lançar no fluxo de caixa o pagamento de R$ ${mech.commissionOwed.toFixed(2)} para ${mech.name}?`)) return;
    
    try {
      await api.post('/financial/transactions', {
        type: 'EXPENSE',
        category: 'SALARY',
        description: `Pagamento de Comissão - ${mech.name} (Ref: Filtro Atual)`,
        amount: mech.commissionOwed,
        paymentMethod: 'PIX',
      });
      showToast(`Pagamento lançado no caixa para ${mech.name}!`, 'success');
    } catch {
      showToast('Erro ao lançar pagamento no caixa.', 'error');
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500 animate-pulse">Calculando produtividade...</div>;
  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Cards KPI de Equipe */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg"><Target className="w-6 h-6" /></div>
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase">Mão de Obra Gerada (Equipe)</p>
            <p className="text-2xl font-extrabold text-blue-700 mt-0.5">R$ {data.totalLaborTeam.toFixed(2)}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-red-50 text-red-600 rounded-lg"><DollarSign className="w-6 h-6" /></div>
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase">Comissões a Pagar no Período</p>
            <p className="text-2xl font-extrabold text-red-600 mt-0.5">R$ {data.totalCommissions.toFixed(2)}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-500 rounded-lg"><Award className="w-6 h-6" /></div>
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase">Mecânico Destaque</p>
            <p className="text-lg font-extrabold text-amber-600 mt-0.5 truncate">
              {data.mechanics.length > 0 ? data.mechanics[0].name : 'Nenhum'}
            </p>
          </div>
        </div>
      </div>

      {/* Lista de Mecânicos */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-slate-50 flex items-center gap-2">
          <Users className="w-5 h-5 text-slate-600" />
          <h2 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Desempenho por Mecânico</h2>
        </div>

        <div className="divide-y divide-slate-100">
          {data.mechanics.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">Nenhum serviço finalizado com mecânico atribuído neste período.</div>
          ) : (
            data.mechanics.map((mech: any, index: number) => {
              const isExpanded = expandedMech === mech.id;
              const contributionPct = data.totalLaborTeam > 0 ? (mech.laborRevenue / data.totalLaborTeam) * 100 : 0;

              return (
                <div key={mech.id} className="flex flex-col">
                  {/* Linha Resumo do Mecânico */}
                  <div className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition ${isExpanded ? 'bg-blue-50/30' : 'hover:bg-slate-50'}`}>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {index === 0 && <Award className="w-4 h-4 text-amber-500" />}
                        <h3 className="font-bold text-slate-900 text-base">{mech.name}</h3>
                        <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold border">
                          Taxa Padrão: {mech.defaultRate}%
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-slate-500 mt-1.5 font-medium">
                        <span>{mech.osCount} OS Finalizadas</span>
                        <span>Mão de Obra Gerada: <strong className="text-emerald-700">R$ {mech.laborRevenue.toFixed(2)}</strong></span>
                      </div>
                      
                      {/* Barra de Contribuição */}
                      <div className="w-full sm:w-64 h-1.5 bg-slate-100 rounded-full overflow-hidden mt-2.5">
                        <div style={{ width: `${contributionPct}%` }} className="bg-blue-500 h-full rounded-full" />
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-6 shrink-0 border-t sm:border-t-0 pt-3 sm:pt-0 mt-3 sm:mt-0">
                      <div className="text-left sm:text-right">
                        <p className="text-[11px] font-bold text-slate-400 uppercase">Comissão a Receber</p>
                        <p className="text-xl font-extrabold text-slate-900">R$ {mech.commissionOwed.toFixed(2)}</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button onClick={() => handlePayCommission(mech)} title="Lançar pagamento no DRE" className="bg-slate-900 hover:bg-emerald-600 text-white p-2 rounded-lg transition shadow-sm">
                          <Banknote className="w-4 h-4" />
                        </button>
                        <button onClick={() => setExpandedMech(isExpanded ? null : mech.id)} className="bg-slate-100 hover:bg-slate-200 text-slate-600 p-2 rounded-lg transition">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Tabela Expandida com as OS do Mecânico */}
                  {isExpanded && (
                    <div className="bg-slate-50 border-t border-slate-100 p-4 shadow-inner">
                      <h4 className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-3">Detalhamento por Ordem de Serviço</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-slate-200 text-slate-400">
                              <th className="py-2 px-3 font-semibold">OS / Veículo</th>
                              <th className="py-2 px-3 font-semibold">Data Finalização</th>
                              <th className="py-2 px-3 font-semibold text-right">Mão de Obra</th>
                              <th className="py-2 px-3 font-semibold text-center">Taxa (%)</th>
                              <th className="py-2 px-3 font-semibold text-right">Comissão R$</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200/60">
                            {mech.orders.map((os: any) => (
                              <tr key={os.id} className="hover:bg-slate-100/50">
                                <td className="py-2.5 px-3">
                                  <span className="font-bold text-slate-700 block">OS #{os.number}</span>
                                  <span className="text-[10px] text-slate-500">{os.plate} • {os.car}</span>
                                </td>
                                <td className="py-2.5 px-3 text-slate-500">{new Date(os.exitDate).toLocaleDateString('pt-BR')}</td>
                                <td className="py-2.5 px-3 text-right font-medium text-emerald-700">R$ {os.laborTotal.toFixed(2)}</td>
                                <td className="py-2.5 px-3 text-center">
                                  {editingOsId === os.id ? (
                                    <div className="flex items-center justify-center gap-1">
                                      <input
                                        type="number"
                                        autoFocus
                                        value={tempRate}
                                        onChange={(e) => setTempRate(e.target.value)}
                                        className="w-16 px-1.5 py-1 text-center border rounded text-xs"
                                      />
                                      <button onClick={() => handleSaveCommissionRate(os.id)} className="text-emerald-600 p-1 hover:bg-emerald-50 rounded">
                                        <Check className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-center gap-2 group cursor-pointer" onClick={() => { setEditingOsId(os.id); setTempRate(os.activeRate); }}>
                                      <span className={`font-bold ${os.activeRate !== mech.defaultRate ? 'text-amber-600 border-b border-amber-300 border-dashed pb-0.5' : 'text-slate-600'}`}>
                                        {os.activeRate}%
                                      </span>
                                      <Edit2 className="w-3 h-4 text-red-800 group-hover:text-emerald-600" />
                                    </div>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-right font-bold text-slate-900">R$ {os.commission.toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}