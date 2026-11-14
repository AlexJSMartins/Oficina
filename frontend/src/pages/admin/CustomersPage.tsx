import React, { useEffect, useState } from 'react';
import { api } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import BulkImportCustomersModal from '../../components/BulkImportCustomersModal';
import ConfirmModal from '../../components/ConfirmModal';
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
} from 'lucide-react';

export default function CustomersPage() {
  const { showToast } = useToast();
  const [customers, setCustomers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [onlyAlerts, setOnlyAlerts] = useState(false);

  // Modais Principais
  const [showNewModal, setShowNewModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedDossier, setSelectedDossier] = useState<any | null>(null);

  // Modais de Edição
  const [editCustomer, setEditCustomer] = useState<any | null>(null);
  const [editVehicle, setEditVehicle] = useState<any | null>(null);

  // Formulário Novo Cliente
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [document, setDocument] = useState('');
  const [plate, setPlate] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());

  // Modal de Confirmação Customizado
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    confirmText?: string;
    onConfirm: () => Promise<void> | void;
  } | null>(null);

  const loadCustomers = async (q = search) => {
    try {
      const { data } = await api.get(`/customers${q ? `?search=${encodeURIComponent(q)}` : ''}`);
      setCustomers(data);
    } catch {
      showToast('Erro ao carregar lista de clientes.', 'error');
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => loadCustomers(search), 250);
    return () => clearTimeout(timer);
  }, [search]);

  const handleOpenDossier = async (customerId: string) => {
    try {
      const { data } = await api.get(`/customers/${customerId}/dossier`);
      setSelectedDossier(data);
    } catch {
      showToast('Erro ao abrir prontuário do cliente.', 'error');
    }
  };

  const handleCreateSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/customers', {
        name,
        phone,
        email,
        document,
        vehicle: plate ? { plate, brand, model, year: Number(year) } : undefined,
      });
      showToast('Cliente cadastrado com sucesso!', 'success');
      setShowNewModal(false);
      setName(''); setPhone(''); setEmail(''); setDocument('');
      setPlate(''); setBrand(''); setModel(''); setYear(new Date().getFullYear());
      loadCustomers();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Erro ao cadastrar cliente.', 'error');
    }
  };

  // Funções de Atualização
  const handleUpdateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.patch(`/customers/${editCustomer.id}`, editCustomer);
      showToast('Dados do cliente atualizados!', 'success');
      handleOpenDossier(selectedDossier.id);
      loadCustomers();
      setEditCustomer(null);
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Erro ao atualizar cliente.', 'error');
    }
  };

  const handleUpdateVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.patch(`/customers/vehicle/${editVehicle.id}`, editVehicle);
      showToast('Dados do veículo atualizados!', 'success');
      handleOpenDossier(selectedDossier.id);
      loadCustomers();
      setEditVehicle(null);
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Erro ao atualizar veículo.', 'error');
    }
  };

  // Funções de Exclusão com Modal Profissional
  const handleDeleteCustomer = (id: string, customerName?: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Excluir Cliente',
      description: `Tem certeza que deseja excluir o cliente ${customerName ? `"${customerName}"` : ''}? Todos os veículos vinculados a ele e o histórico completo de Ordens de Serviço serão apagados permanentemente.`,
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
      description: `Tem certeza que deseja excluir o veículo ${vehiclePlate ? `(Placa: ${vehiclePlate})` : ''}? Todo o histórico de manutenção, peças e mídias deste carro serão removidos do sistema.`,
      confirmText: 'Sim, Excluir Veículo',
      onConfirm: async () => {
        try {
          await api.delete(`/customers/vehicle/${id}`);
          showToast('Veículo excluído com sucesso.', 'success');
          handleOpenDossier(selectedDossier.id);
          loadCustomers();
        } catch {
          showToast('Erro ao excluir veículo.', 'error');
        }
      },
    });
  };

  const sendRecallWhatsApp = (customer: any, vehicle?: any) => {
    const cleanPhone = String(customer.phone || '').replace(/\D/g, '');
    const phoneWithCountry = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    const carLabel = vehicle ? `do seu ${vehicle.brand} ${vehicle.model} (${vehicle.plate})` : 'do seu veículo';
    const text = encodeURIComponent(
      `Olá ${customer.name}, tudo bem? Aqui é da Oficina! Notamos no nosso sistema que já completou o período recomendado para a revisão preventiva ${carLabel}. Vamos agendar um horário esta semana para dar uma conferida?`,
    );
    window.open(`https://wa.me/${phoneWithCountry}?text=${text}`, '_blank');
  };

  const filteredList = onlyAlerts ? customers.filter((c) => c.needsMaintenanceAlert) : customers;
  const alertsCount = customers.filter((c) => c.needsMaintenanceAlert).length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Clientes & Prontuário de Veículos (CRM)</h1>
          <p className="text-sm text-slate-500">
            Histórico completo de manutenções, peças trocadas, fotos antigas e alertas de revisão programada.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setShowImportModal(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm transition"
          >
            <FileSpreadsheet className="w-4 h-4" /> Importar Planilha (Excel/CSV)
          </button>
          <button
            onClick={() => setShowNewModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm transition"
          >
            <UserPlus className="w-4 h-4" /> Novo Cliente
          </button>
        </div>
      </div>

      {/* Busca e Filtros */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            placeholder="Buscar por nome do cliente, WhatsApp, placa ou modelo do carro..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:bg-white transition"
          />
        </div>
        <button
          onClick={() => setOnlyAlerts(!onlyAlerts)}
          className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 border transition shrink-0 ${
            onlyAlerts
              ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
              : 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          Revisão Programada (+6 Meses / +10.000 km) ({alertsCount})
        </button>
      </div>

      {/* Tabela de Clientes */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-xs uppercase border-b border-slate-200">
              <th className="py-3 px-4">Cliente / Contato</th>
              <th className="py-3 px-4">Veículos (Placas)</th>
              <th className="py-3 px-4">Última Visita / KM</th>
              <th className="py-3 px-4">Status de Revisão</th>
              <th className="py-3 px-4">Total Gasto</th>
              <th className="py-3 px-4 text-right">Prontuário</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredList.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-10 text-center text-slate-400">
                  Nenhum cliente ou veículo encontrado.
                </td>
              </tr>
            ) : (
              filteredList.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => handleOpenDossier(c.id)}
                  className="hover:bg-slate-50 cursor-pointer transition"
                >
                  <td className="py-3.5 px-4">
                    <div className="font-bold text-slate-900">{c.name}</div>
                    <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <Phone className="w-3 h-3" /> {c.phone}
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex flex-wrap gap-1.5">
                      {(c.vehicles || []).map((v: any) => (
                        <span
                          key={v.id}
                          className="inline-flex items-center gap-1.5 bg-slate-900 text-white text-xs font-mono font-bold px-2 py-0.5 rounded"
                        >
                          {v.plate}{' '}
                          <span className="font-sans font-normal text-slate-300 text-[11px]">
                            ({v.model})
                          </span>
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-xs text-slate-600">
                    {c.lastVisitDate ? (
                      <>
                        <div className="font-semibold text-slate-800">
                          {new Date(c.lastVisitDate).toLocaleDateString('pt-BR')}
                        </div>
                        <div className="text-slate-400">
                          KM: {c.lastKm} km ({c.ordersCount} OS)
                        </div>
                      </>
                    ) : (
                      <span className="text-slate-400">Sem OS registrada</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                    {c.needsMaintenanceAlert ? (
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-100 text-amber-900 text-[11px] font-bold">
                          <AlertTriangle className="w-3 h-3 text-amber-600" /> Há {c.daysSinceLastVisit} dias
                        </span>
                        <button
                          onClick={() => sendRecallWhatsApp(c, c.vehicles?.[0])}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-1 rounded text-[11px] font-bold flex items-center gap-1"
                        >
                          <MessageCircle className="w-3 h-3" /> Avisar
                        </button>
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Em dia
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 font-extrabold text-emerald-700">
                    R$ {Number(c.totalSpent || 0).toFixed(2)}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button className="px-3 py-1.5 bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 rounded-lg text-xs font-bold transition">
                      Abrir Prontuário →
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL: PRONTUÁRIO AUTOMOTIVO COMPLETO */}
      {selectedDossier && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-40">
          <div className="bg-white rounded-2xl max-w-5xl w-full p-6 space-y-6 shadow-2xl max-h-[92vh] overflow-y-auto">
            {/* Cabeçalho do Prontuário */}
            <div className="flex items-start justify-between border-b pb-4">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-extrabold text-slate-900">{selectedDossier.name}</h2>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setEditCustomer(selectedDossier)}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition"
                      title="Editar Cliente"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteCustomer(selectedDossier.id, selectedDossier.name)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition"
                      title="Excluir Cliente"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  WhatsApp: {selectedDossier.phone} • Documento: {selectedDossier.document || 'Não informado'}
                </p>
              </div>
              <button
                onClick={() => setSelectedDossier(null)}
                className="text-slate-400 hover:text-slate-700 font-bold text-xl"
              >
                ✕
              </button>
            </div>

            {/* Veículos do Cliente */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(selectedDossier.vehicleSummaries || []).map((v: any) => (
                <div
                  key={v.id}
                  className={`p-4 rounded-xl border space-y-2 relative pr-16 ${
                    v.maintenanceAlert?.active ? 'bg-amber-50/70 border-amber-300' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="absolute top-3 right-3 flex items-center gap-1">
                    <button
                      onClick={() => setEditVehicle(v)}
                      className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition"
                      title="Editar Veículo"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteVehicle(v.id, v.plate)}
                      className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition"
                      title="Excluir Veículo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="bg-slate-900 text-white text-xs font-mono font-bold px-2.5 py-1 rounded">
                        {v.plate}
                      </span>
                      <span className="font-bold text-slate-900 text-sm">
                        {v.brand} {v.model} ({v.year})
                      </span>
                    </div>
                    <span className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                      <Gauge className="w-3.5 h-3.5" /> {v.lastKm} km
                    </span>
                  </div>

                  {v.maintenanceAlert?.active ? (
                    <div className="flex items-center justify-between bg-amber-100/80 p-2.5 rounded-lg border border-amber-200">
                      <div className="text-xs text-amber-900">
                        <strong className="block">⚠️ Alerta de Revisão Preventiva:</strong>
                        {v.maintenanceAlert.reason}
                      </div>
                      <button
                        onClick={() => sendRecallWhatsApp(selectedDossier, v)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 shrink-0"
                      >
                        <MessageCircle className="w-3.5 h-3.5" /> Chamar
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">
                      Próxima revisão programada para <strong>{v.maintenanceAlert?.nextSuggestedKm} km</strong> ou 6 meses.
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Histórico Completo de Manutenções */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
                <History className="w-4 h-4 text-blue-600" />
                Histórico Completo de Manutenções ({selectedDossier.serviceOrders?.length || 0} Passagens)
              </h3>
              {(selectedDossier.serviceOrders || []).length === 0 ? (
                <p className="text-sm text-slate-400 py-6 text-center border rounded-xl">
                  Nenhuma Ordem de Serviço registrada para este cliente.
                </p>
              ) : (
                selectedDossier.serviceOrders.map((os: any) => {
                  const allMedias = (os.timeline || []).flatMap((t: any) => t.medias || []);
                  return (
                    <div key={os.id} className="border border-slate-200 rounded-xl p-4 space-y-3 bg-white shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-slate-900 text-sm">OS #{os.number}</span>
                          <span className="bg-slate-900 text-white text-xs font-mono font-bold px-2 py-0.5 rounded">
                            {os.vehicle?.plate}
                          </span>
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {new Date(os.entryDate).toLocaleDateString('pt-BR')}
                          </span>
                          <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                            {os.currentKm} km
                          </span>
                        </div>
                        <div className="text-sm font-extrabold text-emerald-700">
                          Total: R$ {Number(os.totalAmount || 0).toFixed(2)}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        <div className="bg-slate-50 p-2.5 rounded-lg border">
                          <strong className="text-slate-700 block mb-0.5">Relato / Solicitação:</strong>
                          <span className="text-slate-600">{os.customerNotes || 'Sem observações'}</span>
                        </div>
                        <div className="bg-slate-50 p-2.5 rounded-lg border">
                          <strong className="text-slate-700 block mb-0.5">Laudo Técnico / Mecânico:</strong>
                          <span className="text-slate-600">{os.mechanicNotes || 'Sem laudo detalhado'}</span>
                        </div>
                      </div>

                      {(os.items || []).length > 0 && (
                        <div>
                          <span className="text-[11px] font-bold uppercase text-slate-400 block mb-1.5">
                            Peças Trocadas & Mão de Obra
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {os.items.map((item: any) => (
                              <div
                                key={item.id}
                                className="flex items-center justify-between text-xs bg-slate-50 px-3 py-1.5 rounded border"
                              >
                                <span className="flex items-center gap-1.5 font-medium text-slate-800">
                                  <Wrench className="w-3 h-3 text-slate-400" />
                                  {item.quantity}x {item.description}
                                </span>
                                <span className="font-bold text-slate-700">
                                  R$ {Number(item.totalPrice).toFixed(2)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {allMedias.length > 0 && (
                        <div>
                          <span className="text-[11px] font-bold uppercase text-slate-400 flex items-center gap-1 mb-1.5">
                            <ImageIcon className="w-3 h-3" /> Mídias Arquivadas ({allMedias.length})
                          </span>
                          <div className="flex gap-2 overflow-x-auto pb-1">
                            {allMedias.map((m: any) => (
                              <a
                                key={m.id}
                                href={m.url}
                                target="_blank"
                                rel="noreferrer"
                                className="w-20 h-20 rounded-lg border overflow-hidden shrink-0 bg-slate-900 flex items-center justify-center"
                              >
                                {m.type === 'VIDEO' ? (
                                  <video src={m.url} className="w-full h-full object-cover" />
                                ) : (
                                  <img src={m.url} alt="Mídia da OS" className="w-full h-full object-cover" />
                                )}
                              </a>
                            ))}
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
      )}

      {/* SUB-MODAL: EDITAR CLIENTE */}
      {editCustomer && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold border-b pb-2 mb-4">Editar Cliente</h3>
            <form onSubmit={handleUpdateCustomer} className="space-y-3 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-600">Nome</label>
                <input
                  value={editCustomer.name}
                  onChange={(e) => setEditCustomer({ ...editCustomer, name: e.target.value })}
                  className="w-full border px-3 py-2 rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600">WhatsApp</label>
                <input
                  value={editCustomer.phone}
                  onChange={(e) => setEditCustomer({ ...editCustomer, phone: e.target.value })}
                  className="w-full border px-3 py-2 rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600">Documento / E-mail</label>
                <input
                  placeholder="CPF/CNPJ"
                  value={editCustomer.document || ''}
                  onChange={(e) => setEditCustomer({ ...editCustomer, document: e.target.value })}
                  className="w-full border px-3 py-2 rounded-lg mb-2"
                />
                <input
                  placeholder="E-mail"
                  value={editCustomer.email || ''}
                  onChange={(e) => setEditCustomer({ ...editCustomer, email: e.target.value })}
                  className="w-full border px-3 py-2 rounded-lg"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditCustomer(null)}
                  className="px-4 py-2 bg-slate-100 rounded-lg font-semibold"
                >
                  Cancelar
                </button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold">
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUB-MODAL: EDITAR VEÍCULO */}
      {editVehicle && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold border-b pb-2 mb-4">Editar Veículo</h3>
            <form onSubmit={handleUpdateVehicle} className="space-y-3 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-600">Placa</label>
                <input
                  value={editVehicle.plate}
                  onChange={(e) => setEditVehicle({ ...editVehicle, plate: e.target.value.toUpperCase() })}
                  className="w-full border px-3 py-2 rounded-lg font-mono uppercase"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600">Marca e Modelo</label>
                <div className="flex gap-2">
                  <input
                    value={editVehicle.brand}
                    onChange={(e) => setEditVehicle({ ...editVehicle, brand: e.target.value })}
                    className="w-1/2 border px-3 py-2 rounded-lg"
                    placeholder="Marca"
                    required
                  />
                  <input
                    value={editVehicle.model}
                    onChange={(e) => setEditVehicle({ ...editVehicle, model: e.target.value })}
                    className="w-1/2 border px-3 py-2 rounded-lg"
                    placeholder="Modelo"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-600">Ano</label>
                  <input
                    type="number"
                    value={editVehicle.year}
                    onChange={(e) => setEditVehicle({ ...editVehicle, year: e.target.value })}
                    className="w-full border px-3 py-2 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600">Cor</label>
                  <input
                    value={editVehicle.color || ''}
                    onChange={(e) => setEditVehicle({ ...editVehicle, color: e.target.value })}
                    className="w-full border px-3 py-2 rounded-lg"
                    placeholder="Opcional"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditVehicle(null)}
                  className="px-4 py-2 bg-slate-100 rounded-lg font-semibold"
                >
                  Cancelar
                </button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold">
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NOVO CLIENTE */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex justify-between items-center border-b pb-3">
              <h2 className="text-lg font-bold text-slate-900">Cadastrar Novo Cliente</h2>
              <button onClick={() => setShowNewModal(false)} className="text-slate-400 font-bold">
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateSingle} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-600">Nome Completo *</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-600">WhatsApp *</label>
                  <input
                    placeholder="17999999999"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border rounded-lg"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-600">CPF / CNPJ</label>
                  <input
                    value={document}
                    onChange={(e) => setDocument(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-600">E-mail</label>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>
              <div className="pt-2 border-t">
                <span className="font-bold text-slate-700 block mb-2 flex items-center gap-1">
                  <Car className="w-3.5 h-3.5 text-blue-600" /> Vincular Veículo Inicial
                </span>
                <div className="grid grid-cols-2 gap-2.5">
                  <input
                    placeholder="Placa"
                    value={plate}
                    onChange={(e) => setPlate(e.target.value.toUpperCase())}
                    className="px-3 py-2 border rounded-lg font-mono uppercase"
                  />
                  <input
                    placeholder="Marca"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    className="px-3 py-2 border rounded-lg"
                  />
                  <input
                    placeholder="Modelo"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="px-3 py-2 border rounded-lg"
                  />
                  <input
                    type="number"
                    placeholder="Ano"
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                    className="px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-4 py-2 bg-slate-100 rounded-lg font-semibold"
                >
                  Cancelar
                </button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold">
                  Salvar Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: IMPORTAÇÃO EM LOTE */}
      {showImportModal && (
        <BulkImportCustomersModal
          onClose={() => setShowImportModal(false)}
          onSuccess={() => loadCustomers()}
        />
      )}

      {/* MODAL DE CONFIRMAÇÃO */}
      {confirmDialog && (
        <ConfirmModal
          isOpen={confirmDialog.isOpen}
          title={confirmDialog.title}
          description={confirmDialog.description}
          confirmText={confirmDialog.confirmText}
          onConfirm={confirmDialog.onConfirm}
          onClose={() => setConfirmDialog(null)}
        />
      )}
    </div>
  );
}