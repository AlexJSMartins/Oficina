// frontend/src/pages/admin/ServiceOrdersKanbanPage.tsx
import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
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
  Printer,
  FileText,
  User,
  ClipboardList,
  X,
  Camera,
  Film,
  Image as ImageIcon,
  Trash2,
} from 'lucide-react';

import BudgetModal from '../../components/BudgetModal';
import SettleOrderModal from '../../components/SettleOrderModal';
import CustomerHistoryModal from '../../components/CustomerHistoryModal';
import ServiceOrderFiscalModal from '../../components/fiscal/ServiceOrderFiscalModal';
import { PlateInput, PhoneInput } from '../../components/MaskedInputs';
import { printWorkshopBudgetPdf } from '../../utils/printBudgetPdf';

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
  customerId?: string;
  totalAmount?: number;
  customer: { id?: string; name: string; phone: string };
  vehicle: { plate: string; brand: string; model: string; year: number; color?: string };
  mechanic?: { id: string; name: string };
  transactions?: { id: string; type: string; category?: string }[];
}

const COLUMNS = [
  { id: 'CHECK_IN', title: '1. Entrada / Recepção', badge: 'bg-slate-200 text-slate-800' },
  { id: 'IN_DIAGNOSIS', title: '2. Em Diagnóstico', badge: 'bg-amber-100 text-amber-800' },
  { id: 'WAITING_APPROVAL', title: '3. Aguard. Aprovação', badge: 'bg-purple-100 text-purple-800' },
  { id: 'IN_REPAIR', title: '4. Em Reparação', badge: 'bg-blue-100 text-blue-800' },
  { id: 'READY_FOR_PICKUP', title: '5. Pronto / Aguard. Cliente', badge: 'bg-emerald-100 text-emerald-800' },
];

const fmtMoney = (v?: number) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function ServiceOrdersKanbanPage() {
  const { user, hasPermission } = useAuth();
  const { showToast } = useToast();

  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [mechanics, setMechanics] = useState<{ id: string; name: string }[]>([]);
  const [workshop, setWorkshop] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Abas unificadas: Pátio Ativo vs. Histórico & Finalizados (ou Meus Serviços Realizados p/ mecânico)
  const [viewMode, setViewMode] = useState<'KANBAN' | 'HISTORY'>('KANBAN');
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [printingOrderId, setPrintingOrderId] = useState<string | null>(null);

  // Filtros da aba Histórico / Serviços Realizados
  const today = new Date();
  const tzOffset = today.getTimezoneOffset() * 60000;
  const localTodayISO = new Date(today.getTime() - tzOffset).toISOString().split('T')[0];

  const isMechanic = user?.role === 'MECHANIC';
  const [historyDateFilter, setHistoryDateFilter] = useState<'ALL' | 'DAY' | 'MONTH'>(
    isMechanic ? 'DAY' : 'ALL',
  );
  const [historyDate, setHistoryDate] = useState(localTodayISO);
  const [historyMonth, setHistoryMonth] = useState(localTodayISO.slice(0, 7));
  const [historyStatusFilter, setHistoryStatusFilter] = useState<'ALL' | 'COMPLETED' | 'READY_FOR_PICKUP'>(
    isMechanic ? 'ALL' : 'COMPLETED',
  );
  const [historyMechanicFilter, setHistoryMechanicFilter] = useState('');

  // Modais integrados
  const [budgetOrderId, setBudgetOrderId] = useState<string | null>(null);
  const [settleOrder, setSettleOrder] = useState<ServiceOrder | null>(null);
  const [fiscalOrderId, setFiscalOrderId] = useState<string | null>(null);
  const [historyCustomerId, setHistoryCustomerId] = useState<string | null>(null);

  // Modal Pós-Finalização (pergunta imediatamente se deseja emitir as notas fiscais / PDF)
  const [postFinalizeOrder, setPostFinalizeOrder] = useState<ServiceOrder | null>(null);

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
  // Observações do cliente e mecânico
  const [customerNotes, setCustomerNotes] = useState('');
  const [mechanicId, setMechanicId] = useState('');
 // Upload de fotos e vídeos do check-in
  const [checkInFiles, setCheckInFiles] = useState<File[]>([]);
  const [checkInMediaNote, setCheckInMediaNote] = useState('');
  const [submittingCheckIn, setSubmittingCheckIn] = useState(false);
  const checkInFileInputRef = useRef<HTMLInputElement | null>(null);

  // Controle de cards expandidos e filtros do Kanban
  const [expandedCardIds, setExpandedCardIds] = useState<Record<string, boolean>>({});
  const [kanbanSearch, setKanbanSearch] = useState('');
  const [selectedMechanicFilter, setSelectedMechanicFilter] = useState('');
  const [kanbanStatusFilter, setKanbanStatusFilter] = useState('');

  const toggleExpand = (id: string) => {
    setExpandedCardIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const loadData = async () => {
    try {
      const [ordersRes, mechRes] = await Promise.all([
        api.get('/service-orders'),
        api.get('/service-orders/mechanics'),
      ]);
      setOrders(ordersRes.data || []);
      setMechanics(mechRes.data || []);
    } catch {
      showToast('Erro ao carregar ordens de serviço.', 'error');
    }
  };

  useEffect(() => {
    loadData();
    api
      .get('/settings')
      .then((res) => setWorkshop(res.data))
      .catch(() => { });
  }, []);

  // Imprime/Baixa o PDF da OS em 1 clique buscando os itens completos da OS
  const handleQuickPrintPdf = async (orderId: string) => {
    setPrintingOrderId(orderId);
    try {
      const { data } = await api.get(`/service-orders/${orderId}/details`);
      printWorkshopBudgetPdf(data, workshop);
    } catch {
      showToast('Não foi possível gerar o PDF desta Ordem de Serviço.', 'error');
    } finally {
      setPrintingOrderId(null);
    }
  };

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

  const handleSelectCheckInFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selected = Array.from(e.target.files);
      setCheckInFiles((prev) => [...prev, ...selected].slice(0, 10));
      e.target.value = '';
    }
  };

  const removeCheckInFile = (indexToRemove: number) => {
    setCheckInFiles((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleCheckInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingCheckIn(true);
    try {
      const { data: createdOrder } = await api.post('/service-orders/check-in', {
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

      // Se o usuário anexou fotos/vídeos opcionais na entrada, aproveita a rota de mídias da OS
      let mediaUploadFailed = false;
      if (checkInFiles.length > 0 && createdOrder?.id) {
        try {
          const formData = new FormData();
          checkInFiles.forEach((file) => formData.append('files', file));
          formData.append(
            'description',
            checkInMediaNote.trim() ||
              'Registro de fotos/vídeos realizado na entrada do veículo (Check-in).',
          );
          await api.post(`/service-orders/${createdOrder.id}/media`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        } catch {
          mediaUploadFailed = true;
        }
      }

      setIsModalOpen(false);
      setPlate('');
      setBrand('');
      setModel('');
      setColor('');
      setCustomerName('');
      setCustomerPhone('');
      setCurrentKm('');
      setCustomerNotes('');
      setMechanicId('');
      setCheckInFiles([]);
      setCheckInMediaNote('');

      showToast(
        mediaUploadFailed
          ? 'Check-in realizado, mas houve erro ao enviar as fotos (você pode anexar depois no diagnóstico).'
          : checkInFiles.length > 0
          ? `Check-in realizado e ${checkInFiles.length} mídia(s) anexada(s) com sucesso!`
          : 'Check-in realizado com sucesso!',
        mediaUploadFailed ? 'info' : 'success',
      );
      loadData();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Erro ao realizar check-in.', 'error');
    } finally {
      setSubmittingCheckIn(false);
    }
  };

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

  // Avançar Status (com proteção financeira e prompt de emissão fiscal ao finalizar)
  const advanceStatus = async (order: ServiceOrder) => {
    const currentIndex = COLUMNS.findIndex((c) => c.id === order.status);
    const nextStatus =
      currentIndex < COLUMNS.length - 1 ? COLUMNS[currentIndex + 1].id : 'COMPLETED';

    // Se estiver na última coluna (Pronto) e clicar em "Finalizar":
    // Se ainda não houve baixa financeira e há valor > 0, abre o modal de pagamento primeiro
    if (nextStatus === 'COMPLETED' && !isMechanic) {
      const hasIncome = (order.transactions || []).some((t) => t.type === 'INCOME');
      if (!hasIncome && Number(order.totalAmount || 0) > 0 && hasPermission('financial:manage')) {
        setSettleOrder(order);
        return;
      }
    }

    await api.patch(`/service-orders/${order.id}/status`, { status: nextStatus });

    if (isMechanic && nextStatus === 'READY_FOR_PICKUP') {
      showToast(
        `OS #${order.number} enviada para Pronto / Aguard. Cliente e movida para Meus Serviços Realizados!`,
        'success',
      );
    }

    await loadData();

    // Se finalizou a OS para o cliente, pergunta imediatamente se quer gerar as notas fiscais / PDF
    if (nextStatus === 'COMPLETED' && !isMechanic) {
      setPostFinalizeOrder(order);
    }
  };

  // Voltar Status ou Reabrir OS finalizada
  const revertStatus = async (order: ServiceOrder) => {
    if (order.status === 'COMPLETED') {
      await api.patch(`/service-orders/${order.id}/status`, {
        status: 'READY_FOR_PICKUP',
        description: 'OS reaberta para o pátio.',
      });
      showToast(`OS #${order.number} reaberta no pátio (Pronto / Aguard. Cliente).`, 'info');
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

  const copyTrackingLink = (order: ServiceOrder) => {
    const url = `${window.location.origin}/acompanhamento/${order.trackingToken}`;
    navigator.clipboard.writeText(url);
    setCopiedId(order.id);
    showToast('Link do portal copiado!', 'info');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const shareViaWhatsApp = (order: ServiceOrder) => {
    const url = `${window.location.origin}/acompanhamento/${order.trackingToken}`;
    const cleanPhone = order.customer.phone.replace(/\D/g, '');
    const phoneWithCountry = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    const text = encodeURIComponent(
      `Olá ${order.customer.name}! Acompanhe o serviço do seu ${order.vehicle.brand} ${order.vehicle.model} (Placa ${order.vehicle.plate}) na nossa oficina pelo link:\n\n${url}`,
    );
    window.open(`https://wa.me/${phoneWithCountry}?text=${text}`, '_blank');
  };

  const visibleColumns = isMechanic
    ? COLUMNS.filter((c) => c.id !== 'READY_FOR_PICKUP')
    : COLUMNS;

  const displayedColumns = kanbanStatusFilter
    ? visibleColumns.filter((c) => c.id === kanbanStatusFilter)
    : visibleColumns;

  // Lista unificada da aba Histórico & Finalizados (ou Meus Serviços Realizados p/ mecânico)
  const historyOrders = orders.filter((o) => {
    const isHistoryCandidate = o.status === 'READY_FOR_PICKUP' || o.status === 'COMPLETED';
    if (!isHistoryCandidate) return false;

    const orderMechId = o.mechanic?.id || o.mechanicId;
    if (isMechanic && orderMechId && orderMechId !== user?.id) {
      return false;
    }

    if (historyStatusFilter !== 'ALL' && o.status !== historyStatusFilter) {
      return false;
    }

    if (!isMechanic && historyMechanicFilter && orderMechId !== historyMechanicFilter) {
      return false;
    }

    if (historyDateFilter !== 'ALL') {
      const referenceDate = new Date(o.exitDate || o.updatedAt || o.entryDate);
      const localDateStr = new Date(
        referenceDate.getTime() - referenceDate.getTimezoneOffset() * 60000,
      ).toISOString();

      const matchesDate =
        historyDateFilter === 'DAY'
          ? localDateStr.startsWith(historyDate)
          : localDateStr.startsWith(historyMonth);
      if (!matchesDate) return false;
    }

    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      const matchesText =
        String(o.number).includes(q) ||
        o.vehicle.plate.toLowerCase().includes(q) ||
        o.customer.name.toLowerCase().includes(q) ||
        o.vehicle.model.toLowerCase().includes(q) ||
        o.vehicle.brand.toLowerCase().includes(q);
      if (!matchesText) return false;
    }

    return true;
  });

  const activeCount = orders.filter((o) =>
    isMechanic
      ? o.status !== 'READY_FOR_PICKUP' &&
      o.status !== 'COMPLETED' &&
      o.status !== 'CANCELED'
      : o.status !== 'COMPLETED' && o.status !== 'CANCELED',
  ).length;

  const historyBadgeCount = orders.filter((o) => {
    const orderMechId = o.mechanic?.id || o.mechanicId;
    if (isMechanic) {
      return (
        (o.status === 'READY_FOR_PICKUP' || o.status === 'COMPLETED') &&
        (!orderMechId || orderMechId === user?.id)
      );
    }
    return o.status === 'COMPLETED';
  }).length;

  return (
    <div className="w-full min-w-0 p-4 sm:p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Cabeçalho + Alternador de Visão (2 abas limpas) */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
            Pátio da Oficina (Monitoramento em Tempo Real)
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Controle de entrada, recebimento, emissão de notas fiscais, PDFs e histórico completo dos clientes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="bg-slate-200 p-1 rounded-lg flex flex-wrap items-center gap-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setViewMode('KANBAN')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md transition whitespace-nowrap cursor-pointer ${viewMode === 'KANBAN'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              <LayoutGrid className="w-3.5 h-3.5 shrink-0" />
              Pátio Ativo ({activeCount})
            </button>

            <button
              type="button"
              onClick={() => setViewMode('HISTORY')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md transition whitespace-nowrap cursor-pointer ${viewMode === 'HISTORY'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              {isMechanic ? (
                <>
                  <Wrench className="w-3.5 h-3.5 shrink-0" />
                  Meus Serviços Realizados ({historyBadgeCount})
                </>
              ) : (
                <>
                  <History className="w-3.5 h-3.5 shrink-0" />
                  Histórico & Finalizados ({historyBadgeCount})
                </>
              )}
            </button>
          </div>

          {hasPermission('orders:checkin') && (
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium text-xs sm:text-sm shadow-sm transition whitespace-nowrap cursor-pointer"
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
              placeholder="Pesquisar por placa, modelo, cliente ou nº da OS no pátio..."
              value={kanbanSearch}
              onChange={(e) => setKanbanSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:bg-white transition"
            />
          </div>

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

      {/* VISÃO 1: QUADRO KANBAN DO PÁTIO */}
      {viewMode === 'KANBAN' && (
        <div
          className={`grid grid-cols-1 ${displayedColumns.length === 1
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
                String(o.number).includes(query) ||
                o.vehicle.plate.toLowerCase().includes(query) ||
                o.vehicle.model.toLowerCase().includes(query) ||
                o.vehicle.brand.toLowerCase().includes(query) ||
                o.customer.name.toLowerCase().includes(query);

              const orderMechId = o.mechanic?.id || o.mechanicId;
              if (isMechanic && orderMechId && orderMechId !== user?.id) return false;

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
                  const customerId = order.customer?.id || order.customerId;

                  return (
                    <div
                      key={order.id}
                      className={`bg-white p-3.5 rounded-xl shadow-sm border transition-all duration-200 space-y-2.5 min-w-0 ${isExpanded
                          ? 'border-blue-400 ring-2 ring-blue-50'
                          : 'border-slate-200 hover:border-slate-300'
                        }`}
                    >
                      {/* Cabeçalho do Card */}
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-xs font-bold text-slate-500">#{order.number}</span>
                          <span className="bg-slate-900 text-white text-[11px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0">
                            {order.vehicle.plate}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => toggleExpand(order.id)}
                          className="text-slate-400 hover:text-slate-700 p-1 rounded-md hover:bg-slate-100 flex items-center gap-1 text-[11px] font-medium transition shrink-0 cursor-pointer"
                        >
                          <span>{isExpanded ? 'Recolher' : 'Detalhes'}</span>
                          <svg
                            className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''
                              }`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </div>

                      {/* Dados básicos */}
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

                      {/* Seletor de Mecânico */}
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
                              &quot;{order.customerNotes}&quot;
                            </p>
                          )}

                          {/* Botão de Orçamento / Peças */}
                          {hasPermission('budgets:manage') && (
                            <button
                              type="button"
                              onClick={() => setBudgetOrderId(order.id)}
                              className="w-full flex items-center justify-between gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer"
                            >
                              <span className="flex items-center gap-1 truncate">
                                <DollarSign className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> Orçamento / Peças
                              </span>
                              <span className="font-bold shrink-0">{fmtMoney(order.totalAmount)}</span>
                            </button>
                          )}

                          {/* Atalhos rápidos: PDF da OS + Histórico do Cliente */}
                          <div className="grid grid-cols-2 gap-1.5">
                            <button
                              type="button"
                              disabled={printingOrderId === order.id}
                              onClick={() => handleQuickPrintPdf(order.id)}
                              className="flex items-center justify-center gap-1 text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-800 py-1.5 px-2 rounded-lg font-semibold transition cursor-pointer"
                            >
                              <Printer className="w-3.5 h-3.5 shrink-0" />
                              <span>{printingOrderId === order.id ? 'Gerando...' : 'PDF da OS'}</span>
                            </button>

                            {customerId && hasPermission('customers:manage') && (
                              <button
                                type="button"
                                onClick={() => setHistoryCustomerId(customerId)}
                                className="flex items-center justify-center gap-1 text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-800 py-1.5 px-2 rounded-lg font-semibold transition cursor-pointer"
                              >
                                <User className="w-3.5 h-3.5 shrink-0" />
                                <span>Histórico</span>
                              </button>
                            )}
                          </div>

                          {/* Ações exclusivas da última coluna (Pagamento + Nota Fiscal) */}
                          {isLastColumn && (
                            <div className="space-y-1.5">
                              {hasPermission('financial:manage') && (
                                <button
                                  type="button"
                                  onClick={() => setSettleOrder(order)}
                                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-1.5 px-3 rounded-lg text-xs font-bold shadow-sm transition cursor-pointer"
                                >
                                  💳 Receber Pagamento & Entregar
                                </button>
                              )}

                              {!isMechanic && (
                                <button
                                  type="button"
                                  onClick={() => setFiscalOrderId(order.id)}
                                  className="w-full bg-slate-900 hover:bg-slate-800 text-white py-1.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                                >
                                  <FileText className="w-3.5 h-3.5 text-blue-400" />
                                  <span>Emitir / Consultar Notas</span>
                                </button>
                              )}
                            </div>
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
                                  className="flex-1 min-w-[90px] flex items-center justify-center gap-1 text-[11px] bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 py-1 px-2 rounded font-medium transition cursor-pointer"
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
                                  className="flex items-center justify-center gap-1 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white py-1 px-2.5 rounded font-medium transition cursor-pointer"
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
                              className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded flex items-center gap-1 font-medium transition cursor-pointer"
                            >
                              <ArrowLeft className="w-3 h-3 shrink-0" /> Voltar
                            </button>
                          ) : (
                            <div />
                          )}

                          <button
                            type="button"
                            onClick={() => advanceStatus(order)}
                            className={`text-[11px] text-white px-2.5 py-1 rounded flex items-center gap-1 font-medium transition cursor-pointer ${realColIndex === visibleColumns.length - 1
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

      {/* VISÃO 2 UNIFICADA: HISTÓRICO & FINALIZADOS (Cards em telas menores + Tabela em telas largas) */}
      {viewMode === 'HISTORY' && (
        <div className="w-full min-w-0 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Cabeçalho e Filtros Responsivos */}
          <div className="p-4 border-b border-slate-200 space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-bold text-slate-800 flex items-center gap-2 text-sm sm:text-base">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span className="break-words">
                    {isMechanic
                      ? `Meus Serviços Realizados (${historyOrders.length})`
                      : `Histórico de Ordens Finalizadas & Realizadas (${historyOrders.length})`}
                  </span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Consulte a OS, baixe o PDF, acesse o histórico do cliente ou emita/consulte as notas fiscais em 1 clique.
                </p>
              </div>

              <div className="relative w-full lg:w-72 shrink-0">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  placeholder="Buscar por OS, placa, modelo ou cliente..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-lg text-sm"
                />
              </div>
            </div>

            {/* Filtros agrupados em grid responsivo (sem estourar largura no mobile) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap items-center gap-2.5 pt-1 text-xs">
              <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200 w-full sm:w-auto">
                <Calendar className="w-3.5 h-3.5 text-slate-500 ml-1 shrink-0" />
                <select
                  value={historyDateFilter}
                  onChange={(e) => setHistoryDateFilter(e.target.value as any)}
                  className="flex-1 sm:flex-none px-2 py-1 border border-slate-300 rounded-md bg-white font-semibold text-slate-700 min-w-0"
                >
                  <option value="ALL">Todo o Período</option>
                  <option value="DAY">Por Dia</option>
                  <option value="MONTH">Por Mês</option>
                </select>

                {historyDateFilter === 'DAY' && (
                  <input
                    type="date"
                    value={historyDate}
                    onChange={(e) => setHistoryDate(e.target.value)}
                    className="flex-1 sm:flex-none px-2 py-1 border border-slate-300 rounded-md bg-white font-medium min-w-0"
                  />
                )}
                {historyDateFilter === 'MONTH' && (
                  <input
                    type="month"
                    value={historyMonth}
                    onChange={(e) => setHistoryMonth(e.target.value)}
                    className="flex-1 sm:flex-none px-2 py-1 border border-slate-300 rounded-md bg-white font-medium min-w-0"
                  />
                )}
              </div>

              <select
                value={historyStatusFilter}
                onChange={(e) => setHistoryStatusFilter(e.target.value as any)}
                className="w-full sm:w-auto max-w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white font-semibold text-slate-700"
              >
                <option value="COMPLETED">Somente Finalizados / Entregues</option>
                <option value="READY_FOR_PICKUP">Somente Prontos (Aguard. Retirada)</option>
                <option value="ALL">Todos Realizados (Prontos + Entregues)</option>
              </select>

              {!isMechanic && (
                <select
                  value={historyMechanicFilter}
                  onChange={(e) => setHistoryMechanicFilter(e.target.value)}
                  className="w-full sm:w-auto max-w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white font-semibold text-slate-700"
                >
                  <option value="">👤 Todos os Mecânicos</option>
                  {mechanics.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* VISÃO CARDS — Celular, Tablet e Notebooks compactos (< xl) — ZERO scroll lateral */}
          <div className="xl:hidden divide-y divide-slate-100">
            {historyOrders.length === 0 ? (
              <div className="py-10 px-4 text-center text-sm text-slate-400">
                Nenhuma ordem encontrada para os filtros selecionados.
              </div>
            ) : (
              historyOrders.map((order) => {
                const customerId = order.customer?.id || order.customerId;
                return (
                  <div key={order.id} className="p-4 space-y-3 hover:bg-slate-50/70 transition">
                    {/* Linha 1: OS + Status + Valor Total */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2 min-w-0">
                        <span className="font-bold text-slate-900 text-sm">#{order.number}</span>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            order.status === 'COMPLETED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {order.status === 'COMPLETED' ? 'Entregue' : 'Pronto no Pátio'}
                        </span>
                      </div>
                      <span className="font-extrabold text-slate-900 text-sm shrink-0">
                        {fmtMoney(order.totalAmount)}
                      </span>
                    </div>

                    {/* Linha 2: Veículo + Placa */}
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="bg-slate-900 text-white text-[11px] font-mono font-bold px-2 py-0.5 rounded shrink-0">
                        {order.vehicle.plate}
                      </span>
                      <span className="font-semibold text-slate-800 break-words">
                        {order.vehicle.brand} {order.vehicle.model} ({order.vehicle.year})
                      </span>
                      <span className="text-[11px] text-slate-400">
                        • {Number(order.currentKm || 0).toLocaleString('pt-BR')} km
                      </span>
                    </div>

                    {/* Linha 3: Cliente, Mecânico e Datas agrupados */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50 rounded-lg p-2.5 border border-slate-100 text-xs">
                      <div className="min-w-0 space-y-0.5">
                        <div className="font-semibold text-slate-900 truncate">
                          {order.customer.name}
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1">
                          <Phone className="w-3 h-3 shrink-0 text-slate-400" />
                          <span className="truncate">{order.customer.phone}</span>
                        </div>
                        {order.mechanic?.name && (
                          <div className="text-[11px] text-slate-500 flex items-center gap-1">
                            <Wrench className="w-3 h-3 shrink-0 text-slate-400" />
                            <span className="truncate">Mecânico: {order.mechanic.name}</span>
                          </div>
                        )}
                      </div>

                      <div className="sm:text-right space-y-0.5 text-[11px]">
                        <div className="font-semibold text-emerald-700">
                          Conclusão:{' '}
                          {new Date(
                            order.exitDate || order.updatedAt || order.entryDate,
                          ).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                        </div>
                        <div className="text-slate-400">
                          Entrada: {new Date(order.entryDate).toLocaleDateString('pt-BR')}
                        </div>
                      </div>
                    </div>

                    {/* Linha 4: Ações Rápidas agrupadas com quebra automática */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      {hasPermission('budgets:manage') && (
                        <button
                          type="button"
                          onClick={() => setBudgetOrderId(order.id)}
                          className="flex-1 sm:flex-none px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold inline-flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <ClipboardList className="w-3.5 h-3.5 shrink-0" />
                          <span>OS</span>
                        </button>
                      )}

                      <button
                        type="button"
                        disabled={printingOrderId === order.id}
                        onClick={() => handleQuickPrintPdf(order.id)}
                        className="flex-1 sm:flex-none px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold inline-flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5 shrink-0" />
                        <span>{printingOrderId === order.id ? '...' : 'PDF'}</span>
                      </button>

                      {!isMechanic && (
                        <button
                          type="button"
                          onClick={() => setFiscalOrderId(order.id)}
                          className="flex-1 sm:flex-none px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold inline-flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5 shrink-0" />
                          <span>Notas</span>
                        </button>
                      )}

                      {customerId && hasPermission('customers:manage') && (
                        <button
                          type="button"
                          onClick={() => setHistoryCustomerId(customerId)}
                          className="flex-1 sm:flex-none px-2.5 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold inline-flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <User className="w-3.5 h-3.5 shrink-0" />
                          <span>Cliente</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => shareViaWhatsApp(order)}
                        title="Enviar link do portal no WhatsApp"
                        className="px-2.5 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold inline-flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <MessageCircle className="w-3.5 h-3.5 shrink-0" />
                      </button>

                      {hasPermission('orders:diagnosis') && (
                        <button
                          type="button"
                          onClick={() => revertStatus(order)}
                          title={
                            order.status === 'COMPLETED'
                              ? 'Reabrir OS e devolver para o pátio'
                              : 'Devolver veículo para Em Reparação'
                          }
                          className="px-2.5 py-1.5 rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold inline-flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* VISÃO TABELA — Apenas Desktop largo (>= xl) */}
          <div className="hidden xl:block overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-[11px] uppercase border-b border-slate-200">
                  <th className="py-3 px-4">OS / Status</th>
                  <th className="py-3 px-4">Veículo / Placa</th>
                  <th className="py-3 px-4">Cliente / Mecânico</th>
                  <th className="py-3 px-4">Conclusão / Entrega</th>
                  <th className="py-3 px-4 text-right">Valor Total</th>
                  <th className="py-3 px-4 text-right">Ações Rápidas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {historyOrders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-400">
                      Nenhuma ordem encontrada para os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  historyOrders.map((order) => {
                    const customerId = order.customer?.id || order.customerId;
                    return (
                      <tr key={order.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 align-top">
                          <div className="font-bold text-slate-900">#{order.number}</div>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold mt-1 ${
                              order.status === 'COMPLETED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {order.status === 'COMPLETED' ? 'Entregue' : 'Pronto no Pátio'}
                          </span>
                        </td>

                        <td className="py-3 px-4 align-top">
                          <span className="bg-slate-900 text-white text-[11px] font-mono font-bold px-2 py-0.5 rounded mr-2">
                            {order.vehicle.plate}
                          </span>
                          <span className="font-semibold text-slate-800">
                            {order.vehicle.brand} {order.vehicle.model} ({order.vehicle.year})
                          </span>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            KM: {Number(order.currentKm || 0).toLocaleString('pt-BR')} km
                          </div>
                        </td>

                        <td className="py-3 px-4 align-top">
                          <div className="font-semibold text-slate-900">{order.customer.name}</div>
                          <div className="text-[11px] text-slate-500">{order.customer.phone}</div>
                          {order.mechanic?.name && (
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              Mecânico: {order.mechanic.name}
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-4 align-top text-xs text-slate-600 whitespace-nowrap">
                          <div className="font-medium text-emerald-700">
                            {new Date(
                              order.exitDate || order.updatedAt || order.entryDate,
                            ).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Entrada: {new Date(order.entryDate).toLocaleDateString('pt-BR')}
                          </div>
                        </td>

                        <td className="py-3 px-4 align-top text-right font-extrabold text-slate-900 whitespace-nowrap">
                          {fmtMoney(order.totalAmount)}
                        </td>

                        <td className="py-3 px-4 align-top text-right">
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            {hasPermission('budgets:manage') && (
                              <button
                                type="button"
                                onClick={() => setBudgetOrderId(order.id)}
                                title="Abrir detalhes, peças e laudo da OS"
                                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                              >
                                <ClipboardList className="w-3.5 h-3.5" />
                                <span>OS</span>
                              </button>
                            )}

                            <button
                              type="button"
                              disabled={printingOrderId === order.id}
                              onClick={() => handleQuickPrintPdf(order.id)}
                              title="Baixar / Imprimir PDF da Ordem de Serviço"
                              className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>{printingOrderId === order.id ? '...' : 'PDF'}</span>
                            </button>

                            {!isMechanic && (
                              <button
                                type="button"
                                onClick={() => setFiscalOrderId(order.id)}
                                title="Emitir ou consultar NF-e, NFC-e e NFS-e desta OS"
                                className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                <span>Notas</span>
                              </button>
                            )}

                            {customerId && hasPermission('customers:manage') && (
                              <button
                                type="button"
                                onClick={() => setHistoryCustomerId(customerId)}
                                title="Ver prontuário e todas as OS anteriores do cliente"
                                className="px-2.5 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                              >
                                <User className="w-3.5 h-3.5" />
                                <span>Cliente</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => shareViaWhatsApp(order)}
                              title="Enviar link do portal no WhatsApp"
                              className="p-1.5 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 cursor-pointer"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                            </button>

                            {hasPermission('orders:diagnosis') && (
                              <button
                                type="button"
                                onClick={() => revertStatus(order)}
                                title={
                                  order.status === 'COMPLETED'
                                    ? 'Reabrir OS e devolver para o pátio'
                                    : 'Devolver veículo para Em Reparação'
                                }
                                className="p-1.5 rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800 cursor-pointer"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
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
      )}

      {/* MODAL PÓS-FINALIZAÇÃO: Pergunta se deseja emitir as Notas Fiscais / PDF */}
      {postFinalizeOrder && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl text-center">
            <div className="flex justify-end -mt-2 -mr-2">
              <button
                type="button"
                onClick={() => setPostFinalizeOrder(null)}
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto -mt-4">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-lg font-extrabold text-slate-900">
                OS #{postFinalizeOrder.number} Finalizada!
              </h3>
              <p className="text-xs text-slate-600 mt-1">
                <strong>
                  {postFinalizeOrder.vehicle.brand} {postFinalizeOrder.vehicle.model} (
                  {postFinalizeOrder.vehicle.plate})
                </strong>{' '}
                — {postFinalizeOrder.customer.name}
              </p>
              <p className="text-sm font-extrabold text-emerald-700 mt-1">
                Valor: {fmtMoney(postFinalizeOrder.totalAmount)}
              </p>
              <p className="text-xs text-slate-500 mt-2">
                Deseja emitir as Notas Fiscais (NF-e / NFC-e / NFS-e) ou baixar o PDF da ordem agora?
              </p>
            </div>

            <div className="space-y-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  const targetId = postFinalizeOrder.id;
                  setPostFinalizeOrder(null);
                  setFiscalOrderId(targetId);
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                <span>Sim, Emitir / Consultar Notas Fiscais</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickPrintPdf(postFinalizeOrder.id)}
                  className="py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>PDF da OS</span>
                </button>

                <button
                  type="button"
                  onClick={() => shareViaWhatsApp(postFinalizeOrder)}
                  className="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setPostFinalizeOrder(null)}
                className="w-full py-2 text-xs text-slate-500 hover:text-slate-800 font-semibold cursor-pointer"
              >
                Agora não (posso emitir depois em Histórico & Finalizados)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Orçamento / Detalhes da OS */}
      {budgetOrderId && (
        <BudgetModal
          orderId={budgetOrderId}
          onClose={() => setBudgetOrderId(null)}
          onUpdated={loadData}
        />
      )}

      {/* Modal de Baixa Financeira — ao concluir, pergunta automaticamente se deseja emitir as notas */}
      {settleOrder && (
        <SettleOrderModal
          order={settleOrder}
          onClose={() => setSettleOrder(null)}
          onSuccess={async () => {
            const finalized = settleOrder;
            setSettleOrder(null);
            await loadData();
            if (!isMechanic && finalized) {
              setPostFinalizeOrder(finalized);
            }
          }}
        />
      )}

      {/* Modal de Emissão / Consulta Fiscal da OS */}
      <ServiceOrderFiscalModal
        isOpen={Boolean(fiscalOrderId)}
        serviceOrderId={fiscalOrderId || ''}
        onClose={() => setFiscalOrderId(null)}
        onSuccess={loadData}
      />

      {/* Modal de Prontuário / Histórico Completo do Cliente */}
      {historyCustomerId && (
        <CustomerHistoryModal
          customerId={historyCustomerId}
          onClose={() => setHistoryCustomerId(null)}
          onPrintOrderPdf={handleQuickPrintPdf}
          onOpenOrderBudget={
            hasPermission('budgets:manage')
              ? (id) => {
                setHistoryCustomerId(null);
                setBudgetOrderId(id);
              }
              : undefined
          }
          onOpenOrderFiscal={
            !isMechanic
              ? (id) => {
                setHistoryCustomerId(null);
                setFiscalOrderId(id);
              }
              : undefined
          }
        />
      )}

   {/* Modal de Entrada de Veículo (Check-in) via Portal */}
      {isModalOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[105] bg-black/60 backdrop-blur-[1px] flex items-center justify-center p-4"
            onClick={() => !submittingCheckIn && setIsModalOpen(false)}
          >
            <div
              className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl max-h-[92vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b pb-3">
                <h2 className="text-lg font-bold text-slate-900">
                  Check-in: Entrada de Veículo na Oficina
                </h2>
                <button
                  type="button"
                  disabled={submittingCheckIn}
                  onClick={() => setIsModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-5 h-5" />
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
                        className="px-3 bg-slate-100 border rounded-lg hover:bg-slate-200 cursor-pointer"
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
                      <option value="">Sem mecânico (Atendimento ADM / Definir depois)</option>
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

                {/* Seção Opcional: Fotos e Vídeos de Entrada (Vistoria / Avarias) */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Camera className="w-4 h-4 text-blue-600" />
                      <span>Fotos / Vídeos de Entrada — Vistoria (Opcional)</span>
                    </label>
                    <span className="text-[11px] text-slate-400">
                      {checkInFiles.length}/10 arquivo(s)
                    </span>
                  </div>

                  <input
                    ref={checkInFileInputRef}
                    type="file"
                    multiple
                    accept="image/*,video/*"
                    onChange={handleSelectCheckInFiles}
                    className="hidden"
                  />

                  <button
                    type="button"
                    onClick={() => checkInFileInputRef.current?.click()}
                    className="w-full py-2.5 px-3 border-2 border-dashed border-blue-300 bg-white hover:bg-blue-50/60 text-blue-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> Anexar Fotos ou Vídeos do Veículo (Riscos, Painel, Avarias)
                  </button>

                  {checkInFiles.length > 0 && (
                    <div className="space-y-2">
                      <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                        {checkInFiles.map((f, idx) => (
                          <div
                            key={`${f.name}-${idx}`}
                            className="flex items-center justify-between bg-white px-3 py-1.5 rounded-lg border border-slate-200 text-xs"
                          >
                            <div className="flex items-center gap-2 truncate pr-2">
                              {f.type.startsWith('video/') ? (
                                <Film className="w-4 h-4 text-purple-600 shrink-0" />
                              ) : (
                                <ImageIcon className="w-4 h-4 text-blue-600 shrink-0" />
                              )}
                              <span className="truncate font-medium text-slate-700">{f.name}</span>
                              <span className="text-[10px] text-slate-400 shrink-0">
                                ({(f.size / (1024 * 1024)).toFixed(1)} MB)
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeCheckInFile(idx)}
                              className="text-red-500 hover:text-red-700 p-1 shrink-0 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>

                      <input
                        placeholder="Observação das fotos de entrada (ex: Risco no para-choque dianteiro)..."
                        value={checkInMediaNote}
                        onChange={(e) => setCheckInMediaNote(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
                      />
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t">
                  <button
                    type="button"
                    disabled={submittingCheckIn}
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submittingCheckIn}
                    className="px-5 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-medium rounded-lg cursor-pointer"
                  >
                    {submittingCheckIn
                      ? checkInFiles.length > 0
                        ? `Salvando OS e enviando ${checkInFiles.length} mídia(s)...`
                        : 'Gerando OS...'
                      : 'Confirmar Entrada e Gerar OS'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}