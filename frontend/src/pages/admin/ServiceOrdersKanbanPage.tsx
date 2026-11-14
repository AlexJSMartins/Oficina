//src/pages/admin/ServiceOrdersKanbanPage.tsx
import React, { useEffect, useState } from 'react';
import { api, useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import {
  Plus,
  Car,
  Phone,
  Gauge,
  ExternalLink,
  ArrowRight,
  ArrowLeft,
  Search,
  Copy,
  Check,
  MessageCircle,
  CheckCircle2,
  LayoutGrid,
  History,
  RotateCcw,
  DollarSign,
  Wrench,
  Calendar,
} from 'lucide-react';

import BudgetModal from '../../components/BudgetModal';
import SettleOrderModal from '../../components/SettleOrderModal';
import { PlateInput, PhoneInput } from '../../components/MaskedInputs';

export interface ServiceOrder {
  id: string;
  number: number;
  trackingToken: string;
  status: string;
  entryDate: string;
  updatedAt?: string;
  exitDate?: string;
  currentKm: number;
  fuelLevel?: string;
  customerNotes?: string;
  mechanicId?: string;
  totalAmount?: number;
  customer: { name: string; phone: string };
  vehicle: { plate: string; brand: string; model: string; year: number; color?: string };
  mechanic?: { id: string; name: string };
}

const COLUMNS = [
  { id: 'CHECK_IN', title: '1. Entrada / Recepção', badge: 'bg-slate-200 text-slate-800' },
  { id: 'IN_DIAGNOSIS', title: '2. Em Diagnóstico', badge: 'bg-amber-100 text-amber-800' },
  { id: 'WAITING_APPROVAL', title: '3. Aguard. Aprovação', badge: 'bg-purple-100 text-purple-800' },
  { id: 'IN_REPAIR', title: '4. Em Reparação', badge: 'bg-blue-100 text-blue-800' },
  { id: 'READY_FOR_PICKUP', title: '5. Pronto / Aguard. Cliente', badge: 'bg-emerald-100 text-emerald-800' },
];

export default function ServiceOrdersKanbanPage() {
  const { user, hasPermission } = useAuth();
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [mechanics, setMechanics] = useState<{ id: string; name: string }[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { showToast } = useToast();

  // Controle de Abas (Pátio Ativo vs. Finalizados vs. Serviços Realizados pelo Mecânico) e Busca
  const [viewMode, setViewMode] = useState<'KANBAN' | 'COMPLETED' | 'MY_SERVICES'>('KANBAN');
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Filtros de Data para a aba de Serviços Realizados (Dia ou Mês)
  const today = new Date();
  const tzOffset = today.getTimezoneOffset() * 60000;
  const localTodayISO = new Date(today.getTime() - tzOffset).toISOString().split('T')[0];

  const [mechanicFilterType, setMechanicFilterType] = useState<'DAY' | 'MONTH'>('DAY');
  const [mechanicFilterDate, setMechanicFilterDate] = useState(localTodayISO);
  const [mechanicFilterMonth, setMechanicFilterMonth] = useState(localTodayISO.slice(0, 7));

  // Controle de Modal de Orçamento (Budget)
  const [budgetOrderId, setBudgetOrderId] = useState<string | null>(null);

  // Campos do Check-in
  const [plate, setPlate] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [color, setColor] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [currentKm, setCurrentKm] = useState('');
  const [fuelLevel, setFuelLevel] = useState('1/2');
  const [customerNotes, setCustomerNotes] = useState('');
  const [mechanicId, setMechanicId] = useState('');

  // Controle de Modal de Baixa Financeira (Settle Order)
  const [settleOrder, setSettleOrder] = useState<any | null>(null);

  // Controle de quais cards estão expandidos no Kanban
  const [expandedCardIds, setExpandedCardIds] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedCardIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Estados para Filtros e Busca no Kanban
  const [kanbanSearch, setKanbanSearch] = useState('');
  const [selectedMechanicFilter, setSelectedMechanicFilter] = useState('');
  const [kanbanStatusFilter, setKanbanStatusFilter] = useState('');

  const loadData = async () => {
    const [ordersRes, mechRes] = await Promise.all([
      api.get('/service-orders'),
      api.get('/service-orders/mechanics'),
    ]);
    setOrders(ordersRes.data);
    setMechanics(mechRes.data);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleLookupPlate = async () => {
    if (plate.length < 7) return;
    try {
      const { data } = await api.get(`/service-orders/lookup-plate?plate=${plate}`);
      if (data) {
        setBrand(data.brand);
        setModel(data.model);
        setYear(data.year);
        setColor(data.color || '');
        setCustomerName(data.customer.name);
        setCustomerPhone(data.customer.phone);
      }
    } catch {
      // Veículo novo
    }
  };

  const handleCheckInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post('/service-orders/check-in', {
      plate,
      brand,
      model,
      year: Number(year),
      color,
      customerName,
      customerPhone,
      currentKm: Number(currentKm),
      fuelLevel,
      customerNotes,
      mechanicId: mechanicId || undefined,
    });
    setIsModalOpen(false);
    setPlate('');
    setBrand('');
    setModel('');
    setCustomerName('');
    setCustomerPhone('');
    setCurrentKm('');
    setCustomerNotes('');
    showToast('Check-in realizado com sucesso!', 'success');
    loadData();
  };

  // Atribuir ou trocar o mecânico responsável direto pelo card da OS
  const handleAssignMechanic = async (orderId: string, newMechanicId: string) => {
    try {
      await api.patch(`/service-orders/${orderId}/mechanic`, {
        mechanicId: newMechanicId || null,
      });
      showToast('Mecânico responsável atualizado com sucesso!', 'success');
      loadData();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Erro ao atualizar mecânico da OS.', 'error');
    }
  };

  // Avançar Status
  const advanceStatus = async (order: ServiceOrder) => {
    const currentIndex = COLUMNS.findIndex((c) => c.id === order.status);
    const nextStatus =
      currentIndex < COLUMNS.length - 1 ? COLUMNS[currentIndex + 1].id : 'COMPLETED';
    await api.patch(`/service-orders/${order.id}/status`, { status: nextStatus });

    if (user?.role === 'MECHANIC' && nextStatus === 'READY_FOR_PICKUP') {
      showToast(
        `OS #${order.number} enviada para Pronto / Aguard. Cliente e movida para Serviços Realizados!`,
        'success',
      );
    }

    loadData();
  };

  // Voltar Status (Caso alguém avance sem querer ou precise reabrir uma OS finalizada)
  const revertStatus = async (order: ServiceOrder) => {
    if (order.status === 'COMPLETED') {
      await api.patch(`/service-orders/${order.id}/status`, {
        status: 'READY_FOR_PICKUP',
        description: 'OS reaberta para o pátio.',
      });
      loadData();
      return;
    }

    const currentIndex = COLUMNS.findIndex((c) => c.id === order.status);
    if (currentIndex > 0) {
      const prevStatus = COLUMNS[currentIndex - 1].id;
     await api.patch(`/service-orders/${order.id}/status`, {
        status: prevStatus,
        description: `Status retornado para ${COLUMNS[currentIndex - 1].title}`,
      });
      loadData();
    }
  };

  // Copiar Link do Portal do Cliente
  const copyTrackingLink = (order: ServiceOrder) => {
    const url = `${window.location.origin}/acompanhamento/${order.trackingToken}`;
    navigator.clipboard.writeText(url);
    setCopiedId(order.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Enviar Link Manualmente pelo WhatsApp Web / App
  const shareViaWhatsApp = (order: ServiceOrder) => {
    const url = `${window.location.origin}/acompanhamento/${order.trackingToken}`;
    const cleanPhone = order.customer.phone.replace(/\D/g, '');
    const phoneWithCountry = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    const text = encodeURIComponent(
      `Olá ${order.customer.name}! Acompanhe em tempo real o serviço do seu ${order.vehicle.brand} ${order.vehicle.model} (Placa ${order.vehicle.plate}) na nossa oficina pelo link:\n\n${url}`,
    );
    window.open(`https://wa.me/${phoneWithCountry}?text=${text}`, '_blank');
  };

  // Verifica se o usuário logado é Mecânico para ocultar a coluna 5 (Pronto / Aguard. Cliente) do Kanban dele
  const isMechanic = user?.role === 'MECHANIC';
  const visibleColumns = isMechanic
    ? COLUMNS.filter((c) => c.id !== 'READY_FOR_PICKUP')
    : COLUMNS;

  // Filtra as colunas exibidas caso o usuário selecione um status específico no dropdown
  const displayedColumns = kanbanStatusFilter
    ? visibleColumns.filter((c) => c.id === kanbanStatusFilter)
    : visibleColumns;

  const completedOrders = orders.filter(
    (o) =>
      o.status === 'COMPLETED' &&
      (o.vehicle.plate.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.vehicle.model.toLowerCase().includes(searchTerm.toLowerCase())),
  );

  // Lista de Serviços Realizados (Carros que já chegaram em READY_FOR_PICKUP ou COMPLETED) filtrados por Dia ou Mês
  const mechanicDoneOrders = orders.filter((o) => {
    const isFinishedByMechanic =
      o.status === 'READY_FOR_PICKUP' || o.status === 'COMPLETED';
    if (!isFinishedByMechanic) return false;

    const orderMechId = o.mechanic?.id || o.mechanicId;
    if (isMechanic && orderMechId && orderMechId !== user?.id) {
      return false;
    }

    const referenceDate = new Date(o.exitDate || o.updatedAt || o.entryDate);
    const localDateStr = new Date(
      referenceDate.getTime() - referenceDate.getTimezoneOffset() * 60000,
    ).toISOString();

    const matchesDate =
      mechanicFilterType === 'DAY'
        ? localDateStr.startsWith(mechanicFilterDate)
        : localDateStr.startsWith(mechanicFilterMonth);

    const matchesText =
      !searchTerm ||
      o.vehicle.plate.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.vehicle.model.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesDate && matchesText;
  });

  const activeCount = orders.filter((o) =>
    isMechanic
      ? o.status !== 'READY_FOR_PICKUP' &&
        o.status !== 'COMPLETED' &&
        o.status !== 'CANCELED'
      : o.status !== 'COMPLETED' && o.status !== 'CANCELED',
  ).length;

  const completedCount = orders.filter((o) => o.status === 'COMPLETED').length;

  const mechanicDoneTotalCount = orders.filter((o) => {
    const isFinished = o.status === 'READY_FOR_PICKUP' || o.status === 'COMPLETED';
    const orderMechId = o.mechanic?.id || o.mechanicId;
    return isFinished && (!isMechanic || !orderMechId || orderMechId === user?.id);
  }).length;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Cabeçalho + Alternador de Visão */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
            Pátio da Oficina (Monitoramento em Tempo Real)
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Controle de entrada, compartilhamento de link com o cliente e histórico de finalizados.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Abas Pátio vs Serviços Realizados vs Finalizados */}
          <div className="bg-slate-200 p-1 rounded-lg flex flex-wrap items-center gap-1 text-xs font-semibold">
            <button
              onClick={() => setViewMode('KANBAN')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition whitespace-nowrap ${
                viewMode === 'KANBAN'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5 shrink-0" />
              Pátio Ativo ({activeCount})
            </button>

            <button
              onClick={() => setViewMode('MY_SERVICES')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition whitespace-nowrap ${
                viewMode === 'MY_SERVICES'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Wrench className="w-3.5 h-3.5 shrink-0" />
              Serviços Realizados ({mechanicDoneTotalCount})
            </button>

            {!isMechanic && (
              <button
                onClick={() => setViewMode('COMPLETED')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition whitespace-nowrap ${
                  viewMode === 'COMPLETED'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <History className="w-3.5 h-3.5 shrink-0" />
                Finalizados ({completedCount})
              </button>
            )}
          </div>

          {hasPermission('orders:checkin') && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium text-xs sm:text-sm shadow-sm transition whitespace-nowrap"
            >
              <Plus className="w-4 h-4 shrink-0" /> Dar Entrada (Check-in)
            </button>
          )}
        </div>
      </div>

      {/* Barra de Busca e Filtros do Kanban */}
      {viewMode === 'KANBAN' && (
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-3 items-center">
          <div className={`relative w-full ${isMechanic ? 'lg:col-span-8' : 'lg:col-span-6'}`}>
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              placeholder="Pesquisar por placa, modelo ou cliente no pátio..."
              value={kanbanSearch}
              onChange={(e) => setKanbanSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:bg-white transition"
            />
          </div>

          {/* Menu Dropdown para filtrar por Status no Kanban */}
          <div className={`w-full ${isMechanic ? 'lg:col-span-4' : 'lg:col-span-3'}`}>
            <select
              value={kanbanStatusFilter}
              onChange={(e) => setKanbanStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white font-medium"
            >
              <option value="">📋 Todos os Status (Colunas)</option>
              {visibleColumns.map((col) => (
                <option key={col.id} value={col.id}>
                  {col.title}
                </option>
              ))}
            </select>
          </div>

          {!isMechanic && (
            <div className="w-full md:col-span-2 lg:col-span-3">
              <select
                value={selectedMechanicFilter}
                onChange={(e) => setSelectedMechanicFilter(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white font-medium"
              >
                <option value="">👤 Todos os Mecânicos</option>
                {mechanics.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* VISÃO 1: QUADRO KANBAN DO PÁTIO (TOTALMENTE RESPONSIVO) */}
      {viewMode === 'KANBAN' && (
        <div
          className={`grid grid-cols-1 ${
            displayedColumns.length === 1
              ? 'max-w-xl'
              : isMechanic
              ? 'sm:grid-cols-2 xl:grid-cols-4'
              : 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5'
          } gap-4 items-start`}
        >
          {displayedColumns.map((col) => {
            const realColIndex = visibleColumns.findIndex((c) => c.id === col.id);

            const colOrders = orders.filter((o) => {
              const matchesColumn = o.status === col.id;

              const query = kanbanSearch.toLowerCase();
              const matchesSearch =
                o.vehicle.plate.toLowerCase().includes(query) ||
                o.vehicle.model.toLowerCase().includes(query) ||
                o.vehicle.brand.toLowerCase().includes(query) ||
                o.customer.name.toLowerCase().includes(query);

              const orderMechId = o.mechanic?.id || o.mechanicId;

              if (isMechanic && orderMechId && orderMechId !== user?.id) {
                return false;
              }

              const matchesMechanic = selectedMechanicFilter
                ? orderMechId === selectedMechanicFilter
                : true;

              return matchesColumn && matchesSearch && matchesMechanic;
            });

            return (
              <div
                key={col.id}
                className="bg-slate-100 rounded-xl p-3 space-y-3 min-h-[50vh] xl:min-h-[72vh] min-w-0"
              >
                <div className="flex items-center justify-between gap-2 px-1">
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full truncate ${col.badge}`}>
                    {col.title}
                  </span>
                  <span className="text-xs font-bold text-slate-500 shrink-0">{colOrders.length}</span>
                </div>

                {colOrders.map((order) => {
                  const isExpanded = !!expandedCardIds[order.id];
                  const isLastColumn = col.id === 'READY_FOR_PICKUP';

                  return (
                    <div
                      key={order.id}
                      className={`bg-white p-3.5 rounded-xl shadow-sm border transition-all duration-200 space-y-2.5 min-w-0 ${
                        isExpanded
                          ? 'border-blue-400 ring-2 ring-blue-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {/* Cabeçalho compacto do Card + Botão de Seta para Expandir/Recolher */}
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-xs font-bold text-slate-500">#{order.number}</span>
                          <span className="bg-slate-900 text-white text-[11px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0">
                            {order.vehicle.plate}
                          </span>
                        </div>

                        <button
                          onClick={() => toggleExpand(order.id)}
                          className="text-slate-400 hover:text-slate-700 p-1 rounded-md hover:bg-slate-100 flex items-center gap-1 text-[11px] font-medium transition shrink-0"
                          title={isExpanded ? 'Recolher card' : 'Expandir card'}
                        >
                          <span>{isExpanded ? 'Recolher' : 'Detalhes'}</span>
                          <svg
                            className={`w-3.5 h-3.5 transition-transform duration-200 ${
                              isExpanded ? 'rotate-180' : ''
                            }`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 9l-7 7-7-7"
                            />
                          </svg>
                        </button>
                      </div>

                      {/* Informações Básicas */}
                      <div className="min-w-0">
                        <h3 className="font-bold text-slate-900 text-xs flex items-center gap-1.5 truncate">
                          <Car className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span className="truncate">
                            {order.vehicle.brand} {order.vehicle.model} ({order.vehicle.year})
                          </span>
                        </h3>
                        <p className="text-[11px] text-slate-600 mt-0.5 flex items-center gap-1 truncate">
                          <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">
                            {order.customer.name} • {order.customer.phone}
                          </span>
                        </p>
                      </div>

                      {/* Seletor Rápido para Escolher ou Trocar o Mecânico Responsável */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 text-[11px] min-w-0">
                        <span className="text-slate-500 font-semibold flex items-center gap-1 shrink-0">
                          <Wrench className="w-3 h-3 text-slate-400" /> Mecânico:
                        </span>
                        <select
                          value={order.mechanic?.id || order.mechanicId || ''}
                          onChange={(e) => handleAssignMechanic(order.id, e.target.value)}
                          disabled={!hasPermission('orders:diagnosis') && !hasPermission('orders:checkin')}
                          className="bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md text-slate-700 py-1 px-2 font-medium flex-1 min-w-0 truncate focus:ring-1 focus:ring-blue-500 transition cursor-pointer"
                        >
                          <option value="">Definir mecânico...</option>
                          {mechanics.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* CONTEÚDO EXPANSÍVEL */}
                      {isExpanded && (
                        <div className="space-y-2.5 pt-2 border-t border-slate-100 animate-fadeIn">
                          <p className="text-[11px] text-slate-500 flex items-center gap-1 flex-wrap">
                            <Gauge className="w-3 h-3 text-slate-400 shrink-0" /> {order.currentKm} km • Tanque:{' '}
                            {order.fuelLevel || 'N/I'}
                          </p>

                          {order.customerNotes && (
                            <p className="text-[11px] bg-slate-50 p-2 rounded border border-slate-100 text-slate-600 italic break-words">
                              "{order.customerNotes}"
                            </p>
                          )}

                          {/* Botão de Orçamento / Peças */}
                          {hasPermission('budgets:manage') && (
                            <button
                              type="button"
                              onClick={() => setBudgetOrderId(order.id)}
                              className="w-full flex items-center justify-between gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 px-3 py-1.5 rounded-lg text-xs font-semibold transition"
                            >
                              <span className="flex items-center gap-1 truncate">
                                <DollarSign className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> Orçamento / Peças
                              </span>
                              <span className="font-bold shrink-0">
                                R$ {Number(order.totalAmount || 0).toFixed(2)}
                              </span>
                            </button>
                          )}

                          {/* Botão de Baixa Financeira (Apenas na última coluna) */}
                          {order.status === 'READY_FOR_PICKUP' && hasPermission('financial:manage') && (
                            <button
                              type="button"
                              onClick={() => setSettleOrder(order)}
                              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-1.5 px-3 rounded-lg text-xs font-bold shadow-sm transition"
                            >
                              💳 Receber Pagamento & Entregar
                            </button>
                          )}

                          {/* PAINEL DO CLIENTE */}
                          {!isLastColumn && (
                            <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 space-y-1.5">
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                                Painel do Cliente
                              </span>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => copyTrackingLink(order)}
                                  title="Copiar link de acompanhamento"
                                  className="flex-1 min-w-[90px] flex items-center justify-center gap-1 text-[11px] bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 py-1 px-2 rounded font-medium transition"
                                >
                                  {copiedId === order.id ? (
                                    <>
                                      <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                                      <span className="text-emerald-600">Copiado!</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3 h-3 shrink-0" /> Link
                                    </>
                                  )}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => shareViaWhatsApp(order)}
                                  title="Enviar link manualmente no WhatsApp"
                                  className="flex items-center justify-center gap-1 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white py-1 px-2.5 rounded font-medium transition"
                                >
                                  <MessageCircle className="w-3 h-3 shrink-0" /> WhatsApp
                                </button>

                                <a
                                  href={`/acompanhamento/${order.trackingToken}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  title="Abrir painel do cliente em nova aba"
                                  className="p-1 text-slate-500 hover:text-blue-600 border border-slate-200 bg-white rounded shrink-0"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Botões de Voltar e Avançar Etapa */}
                      {hasPermission('orders:diagnosis') && (
                        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                          {realColIndex > 0 ? (
                            <button
                              type="button"
                              onClick={() => revertStatus(order)}
                              title="Voltar para a etapa anterior"
                              className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded flex items-center gap-1 font-medium transition"
                            >
                              <ArrowLeft className="w-3 h-3 shrink-0" /> Voltar
                            </button>
                          ) : (
                            <div />
                          )}

                          <button
                            type="button"
                            onClick={() => advanceStatus(order)}
                            className={`text-[11px] text-white px-2.5 py-1 rounded flex items-center gap-1 font-medium transition ${
                              realColIndex === visibleColumns.length - 1
                                ? 'bg-emerald-600 hover:bg-emerald-700'
                                : 'bg-slate-900 hover:bg-blue-600'
                            }`}
                          >
                            {realColIndex === visibleColumns.length - 1 ? (
                              <>
                                {isMechanic ? 'Concluir Reparo' : 'Finalizar'}{' '}
                                <CheckCircle2 className="w-3 h-3 shrink-0" />
                              </>
                            ) : (
                              <>
                                Avançar <ArrowRight className="w-3 h-3 shrink-0" />
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {/* VISÃO 2: SERVIÇOS REALIZADOS (HISTÓRICO DO MECÂNICO COM FILTRO POR DIA OU MÊS) */}
      {viewMode === 'MY_SERVICES' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h2 className="font-bold text-slate-800 flex items-center gap-2">
                <Wrench className="w-5 h-5 text-blue-600" />
                Serviços Realizados ({mechanicDoneOrders.length} encontrados no período)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Veículos que já tiveram o reparo concluído (Pronto / Aguard. Cliente ou Entregues).
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex flex-wrap items-center gap-2 bg-slate-100 p-1.5 rounded-lg border border-slate-200">
                <Calendar className="w-4 h-4 text-slate-500 ml-1" />
                <select
                  value={mechanicFilterType}
                  onChange={(e) => setMechanicFilterType(e.target.value as 'DAY' | 'MONTH')}
                  className="px-2.5 py-1 border border-slate-300 rounded-md text-xs bg-white font-semibold text-slate-700"
                >
                  <option value="DAY">Filtrar por Dia</option>
                  <option value="MONTH">Filtrar por Mês</option>
                </select>

                {mechanicFilterType === 'DAY' ? (
                  <input
                    type="date"
                    value={mechanicFilterDate}
                    onChange={(e) => setMechanicFilterDate(e.target.value)}
                    className="px-2.5 py-1 border border-slate-300 rounded-md text-xs bg-white font-medium"
                  />
                ) : (
                  <input
                    type="month"
                    value={mechanicFilterMonth}
                    onChange={(e) => setMechanicFilterMonth(e.target.value)}
                    className="px-2.5 py-1 border border-slate-300 rounded-md text-xs bg-white font-medium"
                  />
                )}
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  placeholder="Placa, cliente ou modelo..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-lg text-sm"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase border-b border-slate-200">
                  <th className="py-3 px-4">OS</th>
                  <th className="py-3 px-4">Veículo / Placa</th>
                  <th className="py-3 px-4">Cliente</th>
                  <th className="py-3 px-4">Status Atual</th>
                  <th className="py-3 px-4">Entrada</th>
                  <th className="py-3 px-4">Conclusão / Saída</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {mechanicDoneOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      Nenhum serviço realizado encontrado para a data ou mês selecionado.
                    </td>
                  </tr>
                ) : (
                  mechanicDoneOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-bold text-slate-700">#{order.number}</td>
                      <td className="py-3 px-4">
                        <span className="bg-slate-900 text-white text-xs font-mono font-bold px-2 py-0.5 rounded mr-2">
                          {order.vehicle.plate}
                        </span>
                        <span className="font-medium text-slate-800">
                          {order.vehicle.brand} {order.vehicle.model} ({order.vehicle.year})
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-800">{order.customer.name}</div>
                        <div className="text-xs text-slate-400">{order.customer.phone}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            order.status === 'COMPLETED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {order.status === 'COMPLETED'
                            ? 'Finalizado / Entregue'
                            : 'Pronto / Aguard. Cliente'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-500">
                        {new Date(order.entryDate).toLocaleString('pt-BR')}
                      </td>
                      <td className="py-3 px-4 text-xs text-emerald-700 font-medium">
                        {new Date(
                          order.exitDate || order.updatedAt || order.entryDate,
                        ).toLocaleString('pt-BR')}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {hasPermission('orders:diagnosis') &&
                            order.status === 'READY_FOR_PICKUP' && (
                              <button
                                onClick={() => revertStatus(order)}
                                title="Devolver veículo para Em Reparação"
                                className="text-xs bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 px-2.5 py-1 rounded flex items-center gap-1 font-medium"
                              >
                                <RotateCcw className="w-3 h-3" /> Voltar p/ Reparo
                              </button>
                            )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VISÃO 3: LISTA DE SERVIÇOS FINALIZADOS (GERAL DA OFICINA) */}
      {viewMode === 'COMPLETED' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="font-bold text-slate-800 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              Histórico de Veículos Finalizados e Entregues
            </h2>
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                placeholder="Buscar por placa, cliente ou modelo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-lg text-sm"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase border-b border-slate-200">
                  <th className="py-3 px-4">OS</th>
                  <th className="py-3 px-4">Veículo / Placa</th>
                  <th className="py-3 px-4">Cliente</th>
                  <th className="py-3 px-4">Entrada</th>
                  <th className="py-3 px-4">Saída / Entrega</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {completedOrders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      Nenhum serviço finalizado encontrado.
                    </td>
                  </tr>
                ) : (
                  completedOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-bold text-slate-700">#{order.number}</td>
                      <td className="py-3 px-4">
                        <span className="bg-slate-900 text-white text-xs font-mono font-bold px-2 py-0.5 rounded mr-2">
                          {order.vehicle.plate}
                        </span>
                        <span className="font-medium text-slate-800">
                          {order.vehicle.brand} {order.vehicle.model}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-800">{order.customer.name}</div>
                        <div className="text-xs text-slate-400">{order.customer.phone}</div>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-500">
                        {new Date(order.entryDate).toLocaleString('pt-BR')}
                      </td>
                      <td className="py-3 px-4 text-xs text-emerald-700 font-medium">
                        {order.exitDate ? new Date(order.exitDate).toLocaleString('pt-BR') : '-'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => copyTrackingLink(order)}
                            className="text-xs border border-slate-200 px-2.5 py-1 rounded hover:bg-slate-100 flex items-center gap-1"
                          >
                            <Copy className="w-3 h-3" />
                            {copiedId === order.id ? 'Copiado!' : 'Link'}
                          </button>
                          {hasPermission('orders:diagnosis') && (
                            <button
                              onClick={() => revertStatus(order)}
                              title="Reabrir OS e devolver para o pátio"
                              className="text-xs bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 px-2.5 py-1 rounded flex items-center gap-1 font-medium"
                            >
                              <RotateCcw className="w-3 h-3" /> Reabrir no Pátio
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal de Orçamento (Budget) para a OS selecionada */}
      {budgetOrderId && (
        <BudgetModal
          orderId={budgetOrderId}
          onClose={() => setBudgetOrderId(null)}
          onUpdated={loadData}
        />
      )}

      {/* Modal de Baixa Financeira (Settle Order) para a OS selecionada */}
      {settleOrder && (
        <SettleOrderModal
          order={settleOrder}
          onClose={() => setSettleOrder(null)}
          onSuccess={loadData}
        />
      )}

      {/* Modal de Entrada de Veículo (Check-in) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 space-y-5 shadow-xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-lg font-bold">Check-in: Entrada de Veículo na Oficina</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCheckInSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600">Placa do Veículo *</label>
                  <div className="flex gap-1 mt-1">
                    <PlateInput
                      placeholder="ABC1D23"
                      value={plate}
                      onChangeValue={(val) => setPlate(val)}
                      onBlur={handleLookupPlate}
                      className="w-full px-3 py-2 border rounded-lg text-sm font-mono uppercase"
                      required
                    />
                    <button
                      type="button"
                      onClick={handleLookupPlate}
                      title="Buscar placa"
                      className="px-3 bg-slate-100 border rounded-lg hover:bg-slate-200"
                    >
                      <Search className="w-4 h-4 text-slate-600" />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Marca *</label>
                  <input
                    placeholder="Ex: Volkswagen"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Modelo *</label>
                  <input
                    placeholder="Ex: Gol 1.6"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600">Ano *</label>
                  <input
                    type="number"
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                    className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Cor</label>
                  <input
                    placeholder="Prata"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">KM Atual *</label>
                  <input
                    type="number"
                    placeholder="85000"
                    value={currentKm}
                    onChange={(e) => setCurrentKm(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Combustível</label>
                  <select
                    value={fuelLevel}
                    onChange={(e) => setFuelLevel(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border rounded-lg text-sm bg-white"
                  >
                    <option value="Reserva">Reserva</option>
                    <option value="1/4">1/4</option>
                    <option value="1/2">1/2</option>
                    <option value="3/4">3/4</option>
                    <option value="Cheio">Tanque Cheio</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600">Nome do Cliente *</label>
                  <input
                    placeholder="João da Silva"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">WhatsApp do Cliente *</label>
                  <PhoneInput
                    placeholder="(17) 99999-9999"
                    value={customerPhone}
                    onChangeValue={(val) => setCustomerPhone(val)}
                    className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Mecânico Responsável</label>
                  <select
                    value={mechanicId}
                    onChange={(e) => setMechanicId(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border rounded-lg text-sm bg-white"
                  >
                    <option value="">Definir depois</option>
                    {mechanics.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600">
                  Relato do Cliente / Sintomas
                </label>
                <textarea
                  rows={2}
                  placeholder="Ex: Barulho na suspensão dianteira ao passar em lombada e revisão de freios..."
                  value={customerNotes}
                  onChange={(e) => setCustomerNotes(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg"
                >
                  Confirmar Entrada e Gerar OS
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}