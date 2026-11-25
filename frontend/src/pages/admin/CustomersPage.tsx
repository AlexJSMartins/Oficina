// frontend/src/pages/admin/CustomersPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import { api, useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import BulkImportCustomersModal from '../../components/BulkImportCustomersModal';
import ConfirmModal from '../../components/ConfirmModal';
import BudgetModal from '../../components/BudgetModal';
import ServiceOrderFiscalModal from '../../components/fiscal/ServiceOrderFiscalModal';
import { PhoneInput, DocumentInput, PlateInput } from '../../components/MaskedInputs';
import { printWorkshopBudgetPdf } from '../../utils/printBudgetPdf';
import {
  Search,
  UserPlus,
  FileSpreadsheet,
  Car,
  Phone,
  AlertTriangle,
  History,
  Gauge,
  Wrench,
  Calendar,
  MessageCircle,
  Image as ImageIcon,
  CheckCircle2,
  Edit,
  Trash2,
  Printer,
  FileText,
  ClipboardList,
  Copy,
  MapPin,
  Download,
  Users,
  DollarSign,
  ShieldCheck,
  ShieldAlert,
  X,
  Mail,
} from 'lucide-react';

type FilterMode = 'ALL' | 'ALERTS' | 'MISSING_FISCAL';
type SortMode = 'NAME' | 'TOP_SPENDERS' | 'RECENT' | 'LONGEST_ABSENCE';
type DossierTab = 'ORDERS' | 'VEHICLES' | 'MEDIAS';

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  CHECK_IN: { label: 'Entrada', cls: 'bg-slate-100 text-slate-700' },
  IN_DIAGNOSIS: { label: 'Diagnóstico', cls: 'bg-amber-100 text-amber-800' },
  WAITING_APPROVAL: { label: 'Aguard. Aprovação', cls: 'bg-purple-100 text-purple-800' },
  IN_REPAIR: { label: 'Em Reparação', cls: 'bg-blue-100 text-blue-800' },
  READY_FOR_PICKUP: { label: 'Pronto no Pátio', cls: 'bg-emerald-100 text-emerald-800' },
  COMPLETED: { label: 'Finalizada', cls: 'bg-emerald-600 text-white' },
  CANCELED: { label: 'Cancelada', cls: 'bg-red-100 text-red-700' },
};

const fmtMoney = (v?: number) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const hasCompleteFiscalData = (c: any) => {
  const doc = String(c?.document || '').replace(/\D/g, '');
  const cep = String(c?.cep || '').replace(/\D/g, '');
  return (doc.length === 11 || doc.length === 14) && cep.length === 8 && Boolean(c?.logradouro);
};

export default function CustomersPage() {
  const { user, hasPermission } = useAuth();
  const { showToast } = useToast();
  const isMechanic = user?.role === 'MECHANIC';

  const [customers, setCustomers] = useState<any[]>([]);
  const [workshop, setWorkshop] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Busca, Filtros e Ordenação
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('ALL');
  const [sortMode, setSortMode] = useState<SortMode>('NAME');

  // Modais Principais
  const [showNewModal, setShowNewModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedDossier, setSelectedDossier] = useState<any | null>(null);
  const [dossierTab, setDossierTab] = useState<DossierTab>('ORDERS');
  const [dossierVehicleFilter, setDossierVehicleFilter] = useState<string>('ALL');

  // Atalhos integrados (Orçamento / Notas Fiscais / PDF)
  const [budgetOrderId, setBudgetOrderId] = useState<string | null>(null);
  const [fiscalOrderId, setFiscalOrderId] = useState<string | null>(null);
  const [printingOrderId, setPrintingOrderId] = useState<string | null>(null);

  // Modais de Edição
  const [editCustomer, setEditCustomer] = useState<any | null>(null);
  const [editVehicle, setEditVehicle] = useState<any | null>(null);
  const [loadingCep, setLoadingCep] = useState(false);
  const [savingForm, setSavingForm] = useState(false);

  // Formulário Novo Cliente (com endereço fiscal opcional)
  const [newForm, setNewForm] = useState({
    name: '',
    phone: '',
    email: '',
    document: '',
    cep: '',
    logradouro: '',
    numeroEndereco: '',
    complemento: '',
    bairro: '',
    cidade: '',
    uf: '',
    codigoIbge: '',
    plate: '',
    brand: '',
    model: '',
    year: new Date().getFullYear(),
    color: '',
  });

  // Modal de Confirmação Customizado
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    confirmText?: string;
    onConfirm: () => Promise<void> | void;
  } | null>(null);

  const loadCustomers = async (q = search) => {
    setLoading(true);
    try {
      const { data } = await api.get(`/customers${q ? `?search=${encodeURIComponent(q)}` : ''}`);
      setCustomers(Array.isArray(data) ? data : []);
    } catch {
      showToast('Erro ao carregar lista de clientes.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    api
      .get('/settings')
      .then((res) => setWorkshop(res.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => loadCustomers(search), 250);
    return () => clearTimeout(timer);
  }, [search]);

  // Fechar o modal mais ao topo pressionando ESC
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (confirmDialog) setConfirmDialog(null);
      else if (editVehicle) setEditVehicle(null);
      else if (editCustomer) setEditCustomer(null);
      else if (fiscalOrderId) setFiscalOrderId(null);
      else if (budgetOrderId) setBudgetOrderId(null);
      else if (showNewModal) setShowNewModal(false);
      else if (showImportModal) setShowImportModal(false);
      else if (selectedDossier) setSelectedDossier(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    confirmDialog,
    editVehicle,
    editCustomer,
    fiscalOrderId,
    budgetOrderId,
    showNewModal,
    showImportModal,
    selectedDossier,
  ]);

  const handleOpenDossier = async (customerId: string, resetTab = true) => {
    try {
      const { data } = await api.get(`/customers/${customerId}/dossier`);
      setSelectedDossier(data);
      if (resetTab) {
        setDossierTab('ORDERS');
        setDossierVehicleFilter('ALL');
      }
    } catch {
      showToast('Erro ao abrir prontuário do cliente.', 'error');
    }
  };

  // Consulta ViaCEP para preencher endereço + Código IBGE automaticamente
  const lookupCep = async (rawCep: string, target: 'NEW' | 'EDIT') => {
    const cleanCep = rawCep.replace(/\D/g, '').slice(0, 8);
    if (target === 'NEW') {
      setNewForm((p) => ({ ...p, cep: cleanCep }));
    } else {
      setEditCustomer((p: any) => ({ ...p, cep: cleanCep }));
    }

    if (cleanCep.length !== 8) return;

    setLoadingCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await res.json();
      if (data.erro) {
        showToast('CEP não encontrado.', 'error');
        return;
      }

      const patch = {
        logradouro: data.logradouro || '',
        bairro: data.bairro || '',
        cidade: data.localidade || '',
        uf: data.uf || '',
        codigoIbge: data.ibge || '',
      };

      if (target === 'NEW') {
        setNewForm((p) => ({ ...p, ...patch }));
      } else {
        setEditCustomer((p: any) => ({ ...p, ...patch }));
      }
    } catch {
      showToast('Erro ao consultar ViaCEP.', 'error');
    } finally {
      setLoadingCep(false);
    }
  };

  const handleCreateSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingForm(true);
    try {
      const { data: created } = await api.post('/customers', {
        name: newForm.name,
        phone: newForm.phone,
        email: newForm.email || undefined,
        document: newForm.document || undefined,
        vehicle: newForm.plate
          ? {
              plate: newForm.plate,
              brand: newForm.brand,
              model: newForm.model,
              year: Number(newForm.year),
              color: newForm.color || undefined,
            }
          : undefined,
      });

      // Se informou endereço fiscal, salva imediatamente via rota fiscal
      const cleanDoc = newForm.document.replace(/\D/g, '');
      const hasAddress = Boolean(newForm.cep || newForm.logradouro || newForm.cidade);
      if (created?.id && hasAddress) {
        try {
          await api.patch(`/fiscal/customers/${created.id}/fiscal-data`, {
            ...(cleanDoc.length === 11 || cleanDoc.length === 14 ? { document: cleanDoc } : {}),
            cep: newForm.cep,
            logradouro: newForm.logradouro,
            numeroEndereco: newForm.numeroEndereco,
            complemento: newForm.complemento,
            bairro: newForm.bairro,
            cidade: newForm.cidade,
            uf: newForm.uf,
            codigoIbge: newForm.codigoIbge,
          });
        } catch {
          // Cadastro base já foi salvo com sucesso
        }
      }

      showToast('Cliente cadastrado com sucesso!', 'success');
      setShowNewModal(false);
      setNewForm({
        name: '',
        phone: '',
        email: '',
        document: '',
        cep: '',
        logradouro: '',
        numeroEndereco: '',
        complemento: '',
        bairro: '',
        cidade: '',
        uf: '',
        codigoIbge: '',
        plate: '',
        brand: '',
        model: '',
        year: new Date().getFullYear(),
        color: '',
      });
      loadCustomers();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Erro ao cadastrar cliente.', 'error');
    } finally {
      setSavingForm(false);
    }
  };

  const handleUpdateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCustomer) return;
    setSavingForm(true);
    try {
      await api.patch(`/customers/${editCustomer.id}`, {
        name: editCustomer.name,
        phone: editCustomer.phone,
        email: editCustomer.email || null,
        document: editCustomer.document || null,
      });

      // Salva também os dados fiscais (CEP, endereço, IBGE)
      const cleanDoc = String(editCustomer.document || '').replace(/\D/g, '');
      const hasFiscalFields = Boolean(
        editCustomer.cep ||
          editCustomer.logradouro ||
          editCustomer.numeroEndereco ||
          editCustomer.bairro ||
          editCustomer.cidade ||
          editCustomer.uf,
      );

      if (hasFiscalFields) {
        await api.patch(`/fiscal/customers/${editCustomer.id}/fiscal-data`, {
          name: editCustomer.name,
          email: editCustomer.email || '',
          phone: editCustomer.phone,
          ...(cleanDoc.length === 11 || cleanDoc.length === 14 ? { document: cleanDoc } : {}),
          cep: editCustomer.cep || '',
          logradouro: editCustomer.logradouro || '',
          numeroEndereco: editCustomer.numeroEndereco || '',
          complemento: editCustomer.complemento || '',
          bairro: editCustomer.bairro || '',
          cidade: editCustomer.cidade || '',
          uf: editCustomer.uf || '',
          codigoIbge: editCustomer.codigoIbge || '',
        });
      }

      showToast('Dados cadastrais e fiscais do cliente atualizados!', 'success');
      if (selectedDossier?.id === editCustomer.id) {
        await handleOpenDossier(selectedDossier.id, false);
      }
      loadCustomers();
      setEditCustomer(null);
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Erro ao atualizar cliente.', 'error');
    } finally {
      setSavingForm(false);
    }
  };

  const handleUpdateVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editVehicle) return;
    setSavingForm(true);
    try {
      await api.patch(`/customers/vehicle/${editVehicle.id}`, {
        plate: editVehicle.plate,
        brand: editVehicle.brand,
        model: editVehicle.model,
        year: Number(editVehicle.year),
        color: editVehicle.color || null,
      });
      showToast('Dados do veículo atualizados!', 'success');
      if (selectedDossier) await handleOpenDossier(selectedDossier.id, false);
      loadCustomers();
      setEditVehicle(null);
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Erro ao atualizar veículo.', 'error');
    } finally {
      setSavingForm(false);
    }
  };

  const handleDeleteCustomer = (id: string, customerName?: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Excluir Cliente',
      description: `Tem certeza que deseja excluir o cliente ${
        customerName ? `"${customerName}"` : ''
      }? Todos os veículos vinculados a ele e o histórico completo de Ordens de Serviço serão apagados permanentemente.`,
      confirmText: 'Sim, Excluir Cliente',
      onConfirm: async () => {
        try {
          await api.delete(`/customers/${id}`);
          showToast('Cliente excluído com sucesso.', 'success');
          setSelectedDossier(null);
          loadCustomers();
        } catch {
          showToast('Erro ao excluir cliente.', 'error');
        }
      },
    });
  };

  const handleDeleteVehicle = (id: string, vehiclePlate?: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Excluir Veículo',
      description: `Tem certeza que deseja excluir o veículo ${
        vehiclePlate ? `(Placa: ${vehiclePlate})` : ''
      }? Todo o histórico de manutenção, peças e mídias deste carro serão removidos do sistema.`,
      confirmText: 'Sim, Excluir Veículo',
      onConfirm: async () => {
        try {
          await api.delete(`/customers/vehicle/${id}`);
          showToast('Veículo excluído com sucesso.', 'success');
          if (selectedDossier) await handleOpenDossier(selectedDossier.id, false);
          loadCustomers();
        } catch {
          showToast('Erro ao excluir veículo.', 'error');
        }
      },
    });
  };

  const handleQuickPrintPdf = async (orderId: string) => {
    setPrintingOrderId(orderId);
    try {
      const { data } = await api.get(`/service-orders/${orderId}/details`);
      printWorkshopBudgetPdf(data, workshop);
    } catch {
      showToast('Erro ao gerar PDF desta Ordem de Serviço.', 'error');
    } finally {
      setPrintingOrderId(null);
    }
  };

  const copyTrackingLink = (token: string) => {
    const url = `${window.location.origin}/acompanhamento/${token}`;
    navigator.clipboard.writeText(url);
    showToast('Link de acompanhamento copiado!', 'info');
  };

  const openWhatsApp = (phone: string, text: string) => {
    const cleanPhone = String(phone || '').replace(/\D/g, '');
    if (!cleanPhone) {
      showToast('Cliente sem WhatsApp cadastrado.', 'error');
      return;
    }
    const phoneWithCountry = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    window.open(`https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const sendRecallWhatsApp = (customer: any, vehicle?: any) => {
    const carLabel = vehicle
      ? `do seu ${vehicle.brand} ${vehicle.model} (${vehicle.plate})`
      : 'do seu veículo';
    openWhatsApp(
      customer.phone,
      `Olá ${customer.name}, tudo bem? Aqui é da ${
        workshop?.name || 'Oficina'
      }! Notamos no nosso sistema que já completou o período recomendado para a revisão preventiva ${carLabel}. Vamos agendar um horário esta semana para dar uma conferida?`,
    );
  };

  // Exportar carteira filtrada para Excel
  const handleExportExcel = () => {
    const rows = filteredList.map((c) => ({
      Cliente: c.name,
      WhatsApp: c.phone || '',
      Email: c.email || '',
      CPF_CNPJ: c.document || '',
      Cidade_UF: c.cidade ? `${c.cidade}/${c.uf || ''}` : '',
      Placas: (c.vehicles || []).map((v: any) => `${v.plate} (${v.model})`).join(', '),
      Qtd_OS: c.ordersCount || 0,
      Total_Gasto: Number(c.totalSpent || 0),
      Ultima_Visita: c.lastVisitDate ? new Date(c.lastVisitDate).toLocaleDateString('pt-BR') : '',
      Status_Revisao: c.needsMaintenanceAlert ? `Pendente (${c.daysSinceLastVisit} dias)` : 'Em dia',
      Pronto_NFe: hasCompleteFiscalData(c) ? 'SIM' : 'INCOMPLETO',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Clientes_CRM');
    XLSX.writeFile(wb, `Clientes_Oficina_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // KPIs calculados sobre a base carregada
  const stats = useMemo(() => {
    const totalCustomers = customers.length;
    const totalVehicles = customers.reduce((acc, c) => acc + (c.vehicles?.length || 0), 0);
    const alertsCount = customers.filter((c) => c.needsMaintenanceAlert).length;
    const fiscalReadyCount = customers.filter((c) => hasCompleteFiscalData(c)).length;
    const missingFiscalCount = totalCustomers - fiscalReadyCount;
    const totalRevenue = customers.reduce((acc, c) => acc + Number(c.totalSpent || 0), 0);
    const avgTicket = totalCustomers > 0 ? totalRevenue / totalCustomers : 0;

    return {
      totalCustomers,
      totalVehicles,
      alertsCount,
      fiscalReadyCount,
      missingFiscalCount,
      totalRevenue,
      avgTicket,
    };
  }, [customers]);

  // Lista filtrada e ordenada
  const filteredList = useMemo(() => {
    let list = [...customers];

    if (filterMode === 'ALERTS') {
      list = list.filter((c) => c.needsMaintenanceAlert);
    } else if (filterMode === 'MISSING_FISCAL') {
      list = list.filter((c) => !hasCompleteFiscalData(c));
    }

    list.sort((a, b) => {
      if (sortMode === 'TOP_SPENDERS') return Number(b.totalSpent || 0) - Number(a.totalSpent || 0);
      if (sortMode === 'RECENT') {
        const da = a.lastVisitDate ? new Date(a.lastVisitDate).getTime() : 0;
        const db = b.lastVisitDate ? new Date(b.lastVisitDate).getTime() : 0;
        return db - da;
      }
      if (sortMode === 'LONGEST_ABSENCE') {
        return Number(b.daysSinceLastVisit || 0) - Number(a.daysSinceLastVisit || 0);
      }
      return String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR');
    });

    return list;
  }, [customers, filterMode, sortMode]);

  // Dados derivados do Prontuário aberto
  const dossierOrders = useMemo(() => {
    const all = selectedDossier?.serviceOrders || [];
    if (dossierVehicleFilter === 'ALL') return all;
    return all.filter((os: any) => os.vehicleId === dossierVehicleFilter || os.vehicle?.id === dossierVehicleFilter);
  }, [selectedDossier, dossierVehicleFilter]);

  const dossierAllMedias = useMemo(() => {
    const orders = selectedDossier?.serviceOrders || [];
    return orders.flatMap((os: any) =>
      (os.timeline || []).flatMap((t: any) =>
        (t.medias || []).map((m: any) => ({
          ...m,
          orderNumber: os.number,
          plate: os.vehicle?.plate,
          date: t.createdAt || os.entryDate,
          caption: t.description,
        })),
      ),
    );
  }, [selectedDossier]);

  const dossierTotalSpent = useMemo(() => {
    return (selectedDossier?.serviceOrders || [])
      .filter((o: any) => o.status === 'COMPLETED')
      .reduce((acc: number, o: any) => acc + Number(o.totalAmount || 0), 0);
  }, [selectedDossier]);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-600" />
            <span>Clientes & Prontuário de Veículos (CRM)</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Histórico completo de OS, PDFs, notas fiscais, fotos arquivadas, dados fiscais e alertas de revisão programada.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportExcel}
            className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
          >
            <Download className="w-4 h-4" /> Exportar Excel
          </button>

          <button
            type="button"
            onClick={() => setShowImportModal(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" /> Importar Planilha
          </button>

          <button
            type="button"
            onClick={() => setShowNewModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
          >
            <UserPlus className="w-4 h-4" /> Novo Cliente
          </button>
        </div>
      </div>

      {/* Cards de KPIs Interativos */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => setFilterMode('ALL')}
          className={`text-left p-4 rounded-2xl border shadow-xs transition cursor-pointer ${
            filterMode === 'ALL'
              ? 'bg-blue-50/60 border-blue-400 ring-2 ring-blue-100'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Carteira Ativa</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <strong className="text-2xl font-extrabold text-slate-900 mt-1 block">
            {stats.totalCustomers}
          </strong>
          <span className="text-[11px] text-slate-500">{stats.totalVehicles} veículo(s) vinculados</span>
        </button>

        <button
          type="button"
          onClick={() => setFilterMode(filterMode === 'ALERTS' ? 'ALL' : 'ALERTS')}
          className={`text-left p-4 rounded-2xl border shadow-xs transition cursor-pointer ${
            filterMode === 'ALERTS'
              ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-100'
              : 'bg-white border-amber-200 hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between text-amber-700">
            <span className="text-[11px] font-bold uppercase tracking-wider">Revisão Programada</span>
            <AlertTriangle className="w-4 h-4" />
          </div>
          <strong className="text-2xl font-extrabold text-amber-700 mt-1 block">
            {stats.alertsCount}
          </strong>
          <span className="text-[11px] text-amber-800/80">+6 meses / +10.000 km</span>
        </button>

        <button
          type="button"
          onClick={() => setFilterMode(filterMode === 'MISSING_FISCAL' ? 'ALL' : 'MISSING_FISCAL')}
          className={`text-left p-4 rounded-2xl border shadow-xs transition cursor-pointer ${
            filterMode === 'MISSING_FISCAL'
              ? 'bg-indigo-50 border-indigo-400 ring-2 ring-indigo-100'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-indigo-700">
            <span className="text-[11px] font-bold uppercase tracking-wider">Prontos p/ NF-e</span>
            <ShieldCheck className="w-4 h-4" />
          </div>
          <strong className="text-2xl font-extrabold text-slate-900 mt-1 block">
            {stats.fiscalReadyCount}
            <span className="text-xs font-semibold text-slate-400"> / {stats.totalCustomers}</span>
          </strong>
          <span className="text-[11px] text-slate-500">
            {stats.missingFiscalCount} sem CPF/endereço completo
          </span>
        </button>

        <div className="p-4 rounded-2xl border border-emerald-200 bg-white shadow-xs">
          <div className="flex items-center justify-between text-emerald-700">
            <span className="text-[11px] font-bold uppercase tracking-wider">LTV da Carteira</span>
            <DollarSign className="w-4 h-4" />
          </div>
          <strong className="text-xl sm:text-2xl font-extrabold text-emerald-700 mt-1 block">
            {fmtMoney(stats.totalRevenue)}
          </strong>
          <span className="text-[11px] text-slate-500">Média {fmtMoney(stats.avgTicket)} / cliente</span>
        </div>
      </div>

      {/* Barra de Busca, Filtros Rápidos e Ordenação */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            placeholder="Buscar por nome, WhatsApp, CPF/CNPJ, placa ou modelo do veículo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm bg-slate-50 focus:bg-white focus:outline-none focus:border-blue-500 transition"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filterMode}
            onChange={(e) => setFilterMode(e.target.value as FilterMode)}
            className="px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white text-slate-700"
          >
            <option value="ALL">Todos os clientes ({stats.totalCustomers})</option>
            <option value="ALERTS">⚠️ Revisão pendente ({stats.alertsCount})</option>
            <option value="MISSING_FISCAL">📄 Falta CPF/Endereço NF-e ({stats.missingFiscalCount})</option>
          </select>

          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
            className="px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white text-slate-700"
          >
            <option value="NAME">Ordenar: A–Z</option>
            <option value="TOP_SPENDERS">Ordenar: Maiores Clientes (VIP)</option>
            <option value="RECENT">Ordenar: Visita mais recente</option>
            <option value="LONGEST_ABSENCE">Ordenar: Mais tempo sem vir</option>
          </select>
        </div>
      </div>

      {/* Tabela de Clientes */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs sm:text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider border-b border-slate-200">
              <th className="py-3 px-4">Cliente / Contato</th>
              <th className="py-3 px-4">Veículos (Placas)</th>
              <th className="py-3 px-4">Última Visita / KM</th>
              <th className="py-3 px-4">Revisão & Fiscal</th>
              <th className="py-3 px-4 text-right">Total Gasto</th>
              <th className="py-3 px-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && filteredList.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-400">
                  Carregando clientes...
                </td>
              </tr>
            ) : filteredList.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-400">
                  Nenhum cliente ou veículo encontrado para este filtro.
                </td>
              </tr>
            ) : (
              filteredList.map((c) => {
                const fiscalOk = hasCompleteFiscalData(c);
                return (
                  <tr
                    key={c.id}
                    onClick={() => handleOpenDossier(c.id)}
                    className="hover:bg-slate-50/80 cursor-pointer transition"
                  >
                    <td className="py-3.5 px-4 align-top">
                      <div className="font-bold text-slate-900">{c.name}</div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3" /> {c.phone}
                      </div>
                      {c.document && (
                        <div className="text-[11px] text-slate-400 font-mono">{c.document}</div>
                      )}
                    </td>

                    <td className="py-3.5 px-4 align-top">
                      <div className="flex flex-wrap gap-1.5">
                        {(c.vehicles || []).length === 0 ? (
                          <span className="text-xs text-slate-400">Sem veículo</span>
                        ) : (
                          (c.vehicles || []).map((v: any) => (
                            <span
                              key={v.id}
                              className="inline-flex items-center gap-1.5 bg-slate-900 text-white text-[11px] font-mono font-bold px-2 py-0.5 rounded"
                            >
                              {v.plate}
                              <span className="font-sans font-normal text-slate-300 text-[10px]">
                                ({v.model})
                              </span>
                            </span>
                          ))
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 align-top text-xs text-slate-600 whitespace-nowrap">
                      {c.lastVisitDate ? (
                        <>
                          <div className="font-semibold text-slate-800">
                            {new Date(c.lastVisitDate).toLocaleDateString('pt-BR')}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {Number(c.lastKm || 0).toLocaleString('pt-BR')} km • {c.ordersCount} OS
                          </div>
                        </>
                      ) : (
                        <span className="text-slate-400">Sem OS registrada</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 align-top" onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-col gap-1.5 items-start">
                        {c.needsMaintenanceAlert ? (
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-bold">
                              <AlertTriangle className="w-3 h-3 text-amber-600" /> Há {c.daysSinceLastVisit}d
                            </span>
                            <button
                              type="button"
                              onClick={() => sendRecallWhatsApp(c, c.vehicles?.[0])}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-0.5 rounded text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <MessageCircle className="w-3 h-3" /> Avisar
                            </button>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Revisão em dia
                          </span>
                        )}

                        {fiscalOk ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">
                            <ShieldCheck className="w-3 h-3" /> NF-e OK
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                            <ShieldAlert className="w-3 h-3 text-slate-400" /> Cadastro fiscal incompleto
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 align-top text-right font-extrabold text-emerald-700 whitespace-nowrap">
                      {fmtMoney(c.totalSpent)}
                    </td>

                    <td
                      className="py-3.5 px-4 align-top text-right whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            openWhatsApp(c.phone, `Olá ${c.name}, tudo bem? Aqui é da ${workshop?.name || 'Oficina'}!`)
                          }
                          title="Abrir WhatsApp do cliente"
                          className="p-1.5 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 cursor-pointer"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => setEditCustomer({ ...c })}
                          title="Editar dados e endereço fiscal"
                          className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-blue-50 hover:text-blue-600 text-slate-600 cursor-pointer"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenDossier(c.id)}
                          className="px-3 py-1.5 bg-slate-900 hover:bg-blue-600 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                        >
                          Prontuário →
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

      {/* =====================================================================
          TODOS OS MODAIS RENDERIZADOS VIA PORTAL NO document.body (z-[100]+)
          -> Garante que NENHUM modal fique atrás do menu lateral expandido!
         ===================================================================== */}

      {/* MODAL 1: PRONTUÁRIO AUTOMOTIVO COMPLETO (3 ABAS INTERNAS + PDF + NOTAS) */}
      {selectedDossier &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] bg-black/65 backdrop-blur-[1px] flex items-center justify-center p-3 sm:p-5"
            onClick={() => setSelectedDossier(null)}
          >
            <div
              className="bg-white rounded-2xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Cabeçalho Fixo do Prontuário */}
              <div className="px-6 py-4 bg-slate-900 text-white flex flex-wrap items-start justify-between gap-4 shrink-0">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h2 className="text-lg sm:text-xl font-extrabold">{selectedDossier.name}</h2>
                    {hasCompleteFiscalData(selectedDossier) ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold inline-flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" /> Pronto p/ NF-e
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEditCustomer({ ...selectedDossier })}
                        className="px-2 py-0.5 rounded-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <ShieldAlert className="w-3 h-3" /> Completar dados fiscais
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
                    <span className="inline-flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-emerald-400" /> {selectedDossier.phone}
                    </span>
                    {selectedDossier.document && <span>CPF/CNPJ: {selectedDossier.document}</span>}
                    {selectedDossier.email && (
                      <span className="inline-flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5 text-slate-400" /> {selectedDossier.email}
                      </span>
                    )}
                  </div>

                  {selectedDossier.logradouro && (
                    <div className="text-[11px] text-slate-400 flex items-center gap-1">
                      <MapPin className="w-3 h-3 shrink-0" />
                      <span>
                        {selectedDossier.logradouro}, {selectedDossier.numeroEndereco || 'S/N'} —{' '}
                        {selectedDossier.bairro} • {selectedDossier.cidade}/{selectedDossier.uf} (CEP{' '}
                        {selectedDossier.cep})
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      openWhatsApp(
                        selectedDossier.phone,
                        `Olá ${selectedDossier.name}, tudo bem? Aqui é da ${workshop?.name || 'Oficina'}!`,
                      )
                    }
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditCustomer({ ...selectedDossier })}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-blue-600 text-slate-200 transition cursor-pointer"
                    title="Editar Cliente e Endereço Fiscal"
                  >
                    <Edit className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteCustomer(selectedDossier.id, selectedDossier.name)}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-red-600 text-slate-200 transition cursor-pointer"
                    title="Excluir Cliente"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedDossier(null)}
                    className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                    title="Fechar (ESC)"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Barra de Resumo + Abas Internas */}
              <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setDossierTab('ORDERS')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer ${
                      dossierTab === 'ORDERS'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <History className="w-3.5 h-3.5" />
                    Histórico de OS ({selectedDossier.serviceOrders?.length || 0})
                  </button>

                  <button
                    type="button"
                    onClick={() => setDossierTab('VEHICLES')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer ${
                      dossierTab === 'VEHICLES'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Car className="w-3.5 h-3.5" />
                    Veículos ({selectedDossier.vehicleSummaries?.length || 0})
                  </button>

                  <button
                    type="button"
                    onClick={() => setDossierTab('MEDIAS')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer ${
                      dossierTab === 'MEDIAS'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    Galeria de Fotos/Vídeos ({dossierAllMedias.length})
                  </button>
                </div>

                <div className="text-xs font-semibold text-slate-600">
                  Total investido na oficina:{' '}
                  <strong className="text-emerald-700 text-sm">{fmtMoney(dossierTotalSpent)}</strong>
                </div>
              </div>

              {/* Corpo Rolável do Prontuário */}
              <div className="p-6 overflow-y-auto flex-1 space-y-5">
                {/* ABA 1 DO PRONTUÁRIO: HISTÓRICO DE OS (COM PDF, NOTAS, VER OS E FILTRO POR PLACA) */}
                {dossierTab === 'ORDERS' && (
                  <div className="space-y-4">
                    {(selectedDossier.vehicleSummaries || []).length > 1 && (
                      <div className="flex flex-wrap items-center gap-1.5 text-xs">
                        <span className="text-slate-500 font-semibold mr-1">Filtrar por carro:</span>
                        <button
                          type="button"
                          onClick={() => setDossierVehicleFilter('ALL')}
                          className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer ${
                            dossierVehicleFilter === 'ALL'
                              ? 'bg-slate-900 text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          Todos ({selectedDossier.serviceOrders?.length || 0})
                        </button>
                        {(selectedDossier.vehicleSummaries || []).map((v: any) => (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => setDossierVehicleFilter(v.id)}
                            className={`px-2.5 py-1 rounded-lg font-mono font-bold cursor-pointer ${
                              dossierVehicleFilter === v.id
                                ? 'bg-slate-900 text-white'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            }`}
                          >
                            {v.plate} ({v.model})
                          </button>
                        ))}
                      </div>
                    )}

                    {dossierOrders.length === 0 ? (
                      <p className="text-sm text-slate-400 py-10 text-center border rounded-xl">
                        Nenhuma Ordem de Serviço encontrada.
                      </p>
                    ) : (
                      dossierOrders.map((os: any) => {
                        const st = STATUS_BADGE[os.status] || {
                          label: os.status,
                          cls: 'bg-slate-100 text-slate-700',
                        };
                        const osMedias = (os.timeline || []).flatMap((t: any) => t.medias || []);

                        return (
                          <div
                            key={os.id}
                            className="border border-slate-200 rounded-xl p-4 space-y-3 bg-white shadow-xs"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-extrabold text-slate-900 text-sm">
                                  OS #{os.number}
                                </span>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${st.cls}`}>
                                  {st.label}
                                </span>
                                <span className="bg-slate-900 text-white text-[11px] font-mono font-bold px-2 py-0.5 rounded">
                                  {os.vehicle?.plate}
                                </span>
                                <span className="text-xs text-slate-500 flex items-center gap-1">
                                  <Calendar className="w-3.5 h-3.5" />
                                  {new Date(os.entryDate).toLocaleDateString('pt-BR')}
                                </span>
                                <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                                  {Number(os.currentKm || 0).toLocaleString('pt-BR')} km
                                </span>
                              </div>

                              <div className="text-sm font-extrabold text-emerald-700">
                                {fmtMoney(os.totalAmount)}
                              </div>
                            </div>

                            {/* Atalhos Rápidos da OS (Ver OS, PDF, Notas Fiscais, Link) */}
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-xs text-slate-500">
                                Mecânico: <strong className="text-slate-700">{os.mechanic?.name || 'Não atribuído'}</strong>
                              </span>

                              <div className="flex flex-wrap items-center gap-1.5">
                                {hasPermission('budgets:manage') && (
                                  <button
                                    type="button"
                                    onClick={() => setBudgetOrderId(os.id)}
                                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                                  >
                                    <ClipboardList className="w-3.5 h-3.5" /> Ver OS
                                  </button>
                                )}

                                <button
                                  type="button"
                                  disabled={printingOrderId === os.id}
                                  onClick={() => handleQuickPrintPdf(os.id)}
                                  className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                  <span>{printingOrderId === os.id ? 'Gerando...' : 'PDF da OS'}</span>
                                </button>

                                {!isMechanic && (
                                  <button
                                    type="button"
                                    onClick={() => setFiscalOrderId(os.id)}
                                    className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                                  >
                                    <FileText className="w-3.5 h-3.5" /> Notas Fiscais
                                  </button>
                                )}

                                {os.trackingToken && (
                                  <button
                                    type="button"
                                    onClick={() => copyTrackingLink(os.trackingToken)}
                                    title="Copiar link do portal do cliente"
                                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 cursor-pointer"
                                  >
                                    <Copy className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Relato e Laudo */}
                            {(os.customerNotes || os.mechanicNotes) && (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
                                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                                  <strong className="text-slate-700 block mb-0.5">Relato do Cliente:</strong>
                                  <span className="text-slate-600">{os.customerNotes || 'Sem observações'}</span>
                                </div>
                                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                                  <strong className="text-slate-700 block mb-0.5">Laudo Técnico:</strong>
                                  <span className="text-slate-600">{os.mechanicNotes || 'Sem laudo registrado'}</span>
                                </div>
                              </div>
                            )}

                            {/* Peças e Mão de Obra */}
                            {(os.items || []).length > 0 && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                {os.items.map((item: any) => (
                                  <div
                                    key={item.id}
                                    className="flex items-center justify-between text-xs bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100"
                                  >
                                    <span className="flex items-center gap-1.5 font-medium text-slate-800">
                                      <Wrench className="w-3 h-3 text-slate-400 shrink-0" />
                                      <span>
                                        {item.quantity}x {item.description}
                                      </span>
                                    </span>
                                    <span className="font-bold text-slate-700 whitespace-nowrap ml-2">
                                      {fmtMoney(item.totalPrice)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Miniaturas das Mídias da OS */}
                            {osMedias.length > 0 && (
                              <div className="flex gap-2 overflow-x-auto pt-1">
                                {osMedias.map((m: any) => (
                                  <a
                                    key={m.id}
                                    href={m.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="w-16 h-16 rounded-lg border overflow-hidden shrink-0 bg-slate-900"
                                  >
                                    {m.type === 'VIDEO' ? (
                                      <video src={m.url} className="w-full h-full object-cover" />
                                    ) : (
                                      <img src={m.url} alt="Mídia" className="w-full h-full object-cover" />
                                    )}
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {/* ABA 2 DO PRONTUÁRIO: VEÍCULOS E ALERTAS DE REVISÃO */}
                {dossierTab === 'VEHICLES' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(selectedDossier.vehicleSummaries || []).length === 0 ? (
                      <p className="col-span-full text-center text-slate-400 py-10 border rounded-xl">
                        Nenhum veículo cadastrado para este cliente.
                      </p>
                    ) : (
                      (selectedDossier.vehicleSummaries || []).map((v: any) => (
                        <div
                          key={v.id}
                          className={`p-4 rounded-xl border space-y-3 relative ${
                            v.maintenanceAlert?.active
                              ? 'bg-amber-50/70 border-amber-300'
                              : 'bg-slate-50 border-slate-200'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="bg-slate-900 text-white text-xs font-mono font-bold px-2.5 py-1 rounded inline-block mb-1.5">
                                {v.plate}
                              </span>
                              <h3 className="font-bold text-slate-900 text-sm">
                                {v.brand} {v.model} ({v.year})
                              </h3>
                              {v.color && <span className="text-xs text-slate-500">Cor: {v.color}</span>}
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setEditVehicle({ ...v })}
                                className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                                title="Editar Veículo"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteVehicle(v.id, v.plate)}
                                className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                                title="Excluir Veículo"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 text-xs text-slate-600">
                            <span className="flex items-center gap-1 font-semibold">
                              <Gauge className="w-3.5 h-3.5 text-blue-600" />
                              Último KM: {Number(v.lastKm || 0).toLocaleString('pt-BR')} km
                            </span>
                            {v.lastServiceDate && (
                              <span>
                                Última visita: {new Date(v.lastServiceDate).toLocaleDateString('pt-BR')}
                              </span>
                            )}
                          </div>

                          {v.maintenanceAlert?.active ? (
                            <div className="flex items-center justify-between gap-2 bg-amber-100 p-3 rounded-lg border border-amber-200">
                              <div className="text-xs text-amber-900">
                                <strong className="block">⚠️ Alerta de Revisão Preventiva</strong>
                                {v.maintenanceAlert.reason}
                              </div>
                              <button
                                type="button"
                                onClick={() => sendRecallWhatsApp(selectedDossier, v)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1 shrink-0 cursor-pointer"
                              >
                                <MessageCircle className="w-3.5 h-3.5" /> Chamar
                              </button>
                            </div>
                          ) : (
                            <p className="text-xs text-slate-500 bg-white p-2.5 rounded-lg border border-slate-200">
                              Próxima revisão sugerida em{' '}
                              <strong>
                                {Number(v.maintenanceAlert?.nextSuggestedKm || 0).toLocaleString('pt-BR')} km
                              </strong>{' '}
                              ou 6 meses.
                            </p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* ABA 3 DO PRONTUÁRIO: GALERIA COMPLETA DE FOTOS E VÍDEOS */}
                {dossierTab === 'MEDIAS' && (
                  <div>
                    {dossierAllMedias.length === 0 ? (
                      <p className="text-center text-slate-400 py-10 border rounded-xl text-sm">
                        Nenhuma foto ou vídeo arquivado nas ordens de serviço deste cliente.
                      </p>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {dossierAllMedias.map((m: any) => (
                          <a
                            key={m.id}
                            href={m.url}
                            target="_blank"
                            rel="noreferrer"
                            className="group border border-slate-200 rounded-xl overflow-hidden bg-slate-50 hover:border-blue-400 transition"
                          >
                            <div className="aspect-square bg-slate-900 overflow-hidden">
                              {m.type === 'VIDEO' ? (
                                <video src={m.url} className="w-full h-full object-cover" />
                              ) : (
                                <img
                                  src={m.url}
                                  alt={`OS #${m.orderNumber}`}
                                  className="w-full h-full object-cover group-hover:scale-105 transition"
                                />
                              )}
                            </div>
                            <div className="p-2 text-[11px]">
                              <div className="font-bold text-slate-800">
                                OS #{m.orderNumber} • {m.plate}
                              </div>
                              <div className="text-slate-400">
                                {new Date(m.date).toLocaleDateString('pt-BR')}
                              </div>
                            </div>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* MODAL 2: NOVO CLIENTE (COM ENDEREÇO FISCAL + VIACEP) */}
      {showNewModal &&
        createPortal(
          <div
            className="fixed inset-0 z-[105] bg-black/60 backdrop-blur-[1px] flex items-center justify-center p-4"
            onClick={() => setShowNewModal(false)}
          >
            <div
              className="bg-white rounded-2xl max-w-2xl w-full max-h-[92vh] overflow-y-auto p-6 space-y-4 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center border-b pb-3">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-blue-600" />
                  <span>Cadastrar Novo Cliente</span>
                </h2>
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateSingle} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-slate-600">Nome Completo / Razão Social *</label>
                    <input
                      value={newForm.name}
                      onChange={(e) => setNewForm((p) => ({ ...p, name: e.target.value }))}
                      className="w-full mt-1 px-3 py-2 border rounded-lg"
                      required
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-600">WhatsApp *</label>
                    <PhoneInput
                      value={newForm.phone}
                      onChangeValue={(val) => setNewForm((p) => ({ ...p, phone: val }))}
                      className="w-full mt-1 px-3 py-2 border rounded-lg"
                      required
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-600">CPF / CNPJ (para NF-e)</label>
                    <DocumentInput
                      value={newForm.document}
                      onChangeValue={(val) => setNewForm((p) => ({ ...p, document: val }))}
                      className="w-full mt-1 px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-600">E-mail</label>
                    <input
                      type="email"
                      value={newForm.email}
                      onChange={(e) => setNewForm((p) => ({ ...p, email: e.target.value }))}
                      className="w-full mt-1 px-3 py-2 border rounded-lg"
                    />
                  </div>
                </div>

                {/* Endereço Fiscal (Opcional com ViaCEP) */}
                <div className="pt-3 border-t space-y-2.5">
                  <span className="font-bold text-slate-700 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-blue-600" />
                    Endereço Fiscal (Opcional — preenche automático pelo CEP)
                    {loadingCep && <span className="text-blue-600 font-normal">buscando CEP...</span>}
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <input
                      placeholder="CEP (8 dígitos)"
                      maxLength={8}
                      value={newForm.cep}
                      onChange={(e) => lookupCep(e.target.value, 'NEW')}
                      className="px-3 py-2 border rounded-lg"
                    />
                    <input
                      placeholder="Rua / Logradouro"
                      value={newForm.logradouro}
                      onChange={(e) => setNewForm((p) => ({ ...p, logradouro: e.target.value }))}
                      className="sm:col-span-2 px-3 py-2 border rounded-lg"
                    />
                    <input
                      placeholder="Número"
                      value={newForm.numeroEndereco}
                      onChange={(e) => setNewForm((p) => ({ ...p, numeroEndereco: e.target.value }))}
                      className="px-3 py-2 border rounded-lg"
                    />
                    <input
                      placeholder="Bairro"
                      value={newForm.bairro}
                      onChange={(e) => setNewForm((p) => ({ ...p, bairro: e.target.value }))}
                      className="px-3 py-2 border rounded-lg"
                    />
                    <input
                      placeholder="Cidade"
                      value={newForm.cidade}
                      onChange={(e) => setNewForm((p) => ({ ...p, cidade: e.target.value }))}
                      className="px-3 py-2 border rounded-lg"
                    />
                    <input
                      placeholder="UF"
                      maxLength={2}
                      value={newForm.uf}
                      onChange={(e) => setNewForm((p) => ({ ...p, uf: e.target.value.toUpperCase() }))}
                      className="px-3 py-2 border rounded-lg uppercase"
                    />
                    <input
                      placeholder="Complemento"
                      value={newForm.complemento}
                      onChange={(e) => setNewForm((p) => ({ ...p, complemento: e.target.value }))}
                      className="px-3 py-2 border rounded-lg"
                    />
                  </div>
                </div>

                {/* Veículo Inicial */}
                <div className="pt-3 border-t space-y-2.5">
                  <span className="font-bold text-slate-700 flex items-center gap-1.5">
                    <Car className="w-3.5 h-3.5 text-blue-600" /> Vincular Veículo Inicial (Opcional)
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                    <PlateInput
                      placeholder="Placa"
                      value={newForm.plate}
                      onChangeValue={(val) => setNewForm((p) => ({ ...p, plate: val }))}
                      className="px-3 py-2 border rounded-lg font-mono uppercase"
                    />
                    <input
                      placeholder="Marca"
                      value={newForm.brand}
                      onChange={(e) => setNewForm((p) => ({ ...p, brand: e.target.value }))}
                      className="px-3 py-2 border rounded-lg"
                    />
                    <input
                      placeholder="Modelo"
                      value={newForm.model}
                      onChange={(e) => setNewForm((p) => ({ ...p, model: e.target.value }))}
                      className="px-3 py-2 border rounded-lg"
                    />
                    <input
                      type="number"
                      placeholder="Ano"
                      value={newForm.year}
                      onChange={(e) => setNewForm((p) => ({ ...p, year: Number(e.target.value) }))}
                      className="px-3 py-2 border rounded-lg"
                    />
                    <input
                      placeholder="Cor"
                      value={newForm.color}
                      onChange={(e) => setNewForm((p) => ({ ...p, color: e.target.value }))}
                      className="px-3 py-2 border rounded-lg"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t">
                  <button
                    type="button"
                    onClick={() => setShowNewModal(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg font-semibold cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={savingForm}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-bold cursor-pointer"
                  >
                    {savingForm ? 'Salvando...' : 'Salvar Cliente'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body,
        )}

      {/* SUB-MODAL 3: EDITAR CLIENTE + ENDEREÇO FISCAL */}
      {editCustomer &&
        createPortal(
          <div
            className="fixed inset-0 z-[110] bg-black/65 flex items-center justify-center p-4"
            onClick={() => setEditCustomer(null)}
          >
            <div
              className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="text-base font-bold text-slate-900">
                  Editar Cliente & Dados Fiscais
                </h3>
                <button
                  type="button"
                  onClick={() => setEditCustomer(null)}
                  className="text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleUpdateCustomer} className="space-y-3 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">Nome / Razão Social *</label>
                    <input
                      value={editCustomer.name || ''}
                      onChange={(e) => setEditCustomer({ ...editCustomer, name: e.target.value })}
                      className="w-full border px-3 py-2 rounded-lg"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">WhatsApp *</label>
                    <PhoneInput
                      value={editCustomer.phone || ''}
                      onChangeValue={(val) => setEditCustomer({ ...editCustomer, phone: val })}
                      className="w-full border px-3 py-2 rounded-lg"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">CPF / CNPJ</label>
                    <DocumentInput
                      value={editCustomer.document || ''}
                      onChangeValue={(val) => setEditCustomer({ ...editCustomer, document: val })}
                      className="w-full border px-3 py-2 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">E-mail</label>
                    <input
                      type="email"
                      value={editCustomer.email || ''}
                      onChange={(e) => setEditCustomer({ ...editCustomer, email: e.target.value })}
                      className="w-full border px-3 py-2 rounded-lg"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t space-y-2.5">
                  <div className="font-bold text-slate-700 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-blue-600" />
                    <span>Endereço Fiscal (NF-e / NFS-e)</span>
                    {loadingCep && <span className="text-blue-600 font-normal">buscando CEP...</span>}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <input
                      placeholder="CEP"
                      maxLength={8}
                      value={editCustomer.cep || ''}
                      onChange={(e) => lookupCep(e.target.value, 'EDIT')}
                      className="border px-3 py-2 rounded-lg"
                    />
                    <input
                      placeholder="Logradouro"
                      value={editCustomer.logradouro || ''}
                      onChange={(e) => setEditCustomer({ ...editCustomer, logradouro: e.target.value })}
                      className="sm:col-span-2 border px-3 py-2 rounded-lg"
                    />
                    <input
                      placeholder="Número"
                      value={editCustomer.numeroEndereco || ''}
                      onChange={(e) =>
                        setEditCustomer({ ...editCustomer, numeroEndereco: e.target.value })
                      }
                      className="border px-3 py-2 rounded-lg"
                    />
                    <input
                      placeholder="Bairro"
                      value={editCustomer.bairro || ''}
                      onChange={(e) => setEditCustomer({ ...editCustomer, bairro: e.target.value })}
                      className="border px-3 py-2 rounded-lg"
                    />
                    <input
                      placeholder="Cidade"
                      value={editCustomer.cidade || ''}
                      onChange={(e) => setEditCustomer({ ...editCustomer, cidade: e.target.value })}
                      className="border px-3 py-2 rounded-lg"
                    />
                    <input
                      placeholder="UF"
                      maxLength={2}
                      value={editCustomer.uf || ''}
                      onChange={(e) =>
                        setEditCustomer({ ...editCustomer, uf: e.target.value.toUpperCase() })
                      }
                      className="border px-3 py-2 rounded-lg uppercase"
                    />
                    <input
                      placeholder="IBGE (7 díg.)"
                      maxLength={7}
                      value={editCustomer.codigoIbge || ''}
                      onChange={(e) => setEditCustomer({ ...editCustomer, codigoIbge: e.target.value })}
                      className="border px-3 py-2 rounded-lg"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t">
                  <button
                    type="button"
                    onClick={() => setEditCustomer(null)}
                    className="px-4 py-2 bg-slate-100 rounded-lg font-semibold cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={savingForm}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-bold cursor-pointer"
                  >
                    {savingForm ? 'Salvando...' : 'Salvar Alterações'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body,
        )}

      {/* SUB-MODAL 4: EDITAR VEÍCULO */}
      {editVehicle &&
        createPortal(
          <div
            className="fixed inset-0 z-[110] bg-black/65 flex items-center justify-center p-4"
            onClick={() => setEditVehicle(null)}
          >
            <div
              className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b pb-2.5">
                <h3 className="text-base font-bold text-slate-900">Editar Veículo</h3>
                <button
                  type="button"
                  onClick={() => setEditVehicle(null)}
                  className="text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleUpdateVehicle} className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Placa *</label>
                  <PlateInput
                    value={editVehicle.plate || ''}
                    onChangeValue={(val) => setEditVehicle({ ...editVehicle, plate: val })}
                    className="w-full border px-3 py-2 rounded-lg font-mono uppercase"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">Marca *</label>
                    <input
                      value={editVehicle.brand || ''}
                      onChange={(e) => setEditVehicle({ ...editVehicle, brand: e.target.value })}
                      className="w-full border px-3 py-2 rounded-lg"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">Modelo *</label>
                    <input
                      value={editVehicle.model || ''}
                      onChange={(e) => setEditVehicle({ ...editVehicle, model: e.target.value })}
                      className="w-full border px-3 py-2 rounded-lg"
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">Ano *</label>
                    <input
                      type="number"
                      value={editVehicle.year || ''}
                      onChange={(e) => setEditVehicle({ ...editVehicle, year: e.target.value })}
                      className="w-full border px-3 py-2 rounded-lg"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">Cor</label>
                    <input
                      value={editVehicle.color || ''}
                      onChange={(e) => setEditVehicle({ ...editVehicle, color: e.target.value })}
                      className="w-full border px-3 py-2 rounded-lg"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-3 border-t">
                  <button
                    type="button"
                    onClick={() => setEditVehicle(null)}
                    className="px-4 py-2 bg-slate-100 rounded-lg font-semibold cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={savingForm}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold cursor-pointer"
                  >
                    Salvar
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body,
        )}

      {/* SUB-MODAL 5: ORÇAMENTO / DETALHES DA OS (VIA PORTAL ACIMA DO MENU E PRONTUÁRIO) */}
      {budgetOrderId &&
        createPortal(
          <div className="relative z-[115]">
            <BudgetModal
              orderId={budgetOrderId}
              onClose={() => setBudgetOrderId(null)}
              onUpdated={() => {
                if (selectedDossier) handleOpenDossier(selectedDossier.id, false);
                loadCustomers();
              }}
            />
          </div>,
          document.body,
        )}

      {/* SUB-MODAL 6: NOTAS FISCAIS DA OS (VIA PORTAL) */}
      {fiscalOrderId &&
        createPortal(
          <div className="relative z-[115]">
            <ServiceOrderFiscalModal
              isOpen={Boolean(fiscalOrderId)}
              serviceOrderId={fiscalOrderId}
              onClose={() => setFiscalOrderId(null)}
              onSuccess={() => {
                if (selectedDossier) handleOpenDossier(selectedDossier.id, false);
              }}
            />
          </div>,
          document.body,
        )}

      {/* MODAL 7: IMPORTAÇÃO EM LOTE (VIA PORTAL) */}
      {showImportModal &&
        createPortal(
          <div className="relative z-[105]">
            <BulkImportCustomersModal
              onClose={() => setShowImportModal(false)}
              onSuccess={() => loadCustomers()}
            />
          </div>,
          document.body,
        )}

      {/* MODAL 8: CONFIRMAÇÃO DE EXCLUSÃO (VIA PORTAL NO TOPO DE TUDO) */}
      {confirmDialog &&
        createPortal(
          <div className="relative z-[120]">
            <ConfirmModal
              isOpen={confirmDialog.isOpen}
              title={confirmDialog.title}
              description={confirmDialog.description}
              confirmText={confirmDialog.confirmText}
              onConfirm={confirmDialog.onConfirm}
              onClose={() => setConfirmDialog(null)}
            />
          </div>,
          document.body,
        )}
    </div>
  );
}