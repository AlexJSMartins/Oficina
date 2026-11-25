// frontend/src/pages/mechanic/MechanicBoardPage.tsx
import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { api, useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import {
  Wrench,
  Camera,
  Send,
  Plus,
  Trash2,
  Film,
  Image as ImageIcon,
  LayoutGrid,
  CheckCircle2,
  Search,
  RotateCcw,
  UserCheck,
  X,
} from 'lucide-react';

// Mapeamento de status para rótulos amigáveis e cores
const STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  CHECK_IN: { label: 'Check-in (Entrada)', badge: 'bg-slate-200 text-slate-800' },
  IN_DIAGNOSIS: { label: 'Em Diagnóstico', badge: 'bg-amber-100 text-amber-800' },
  WAITING_APPROVAL: { label: 'Aguard. Aprovação', badge: 'bg-purple-100 text-purple-800' },
  IN_REPAIR: { label: 'Em Reparação', badge: 'bg-blue-100 text-blue-800' },
  READY_FOR_PICKUP: { label: 'Pronto / Entregar', badge: 'bg-emerald-100 text-emerald-800' },
  COMPLETED: { label: 'Finalizado / Saiu', badge: 'bg-emerald-100 text-emerald-800' },
};

export default function MechanicBoardPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const isAdmin = user?.role === 'ADMIN';

  const [orders, setOrders] = useState<any[]>([]);
  const [mechanics, setMechanics] = useState<{ id: string; name: string }[]>([]);

  // Controle de Abas e Filtros
  const [viewMode, setViewMode] = useState<'PATIO' | 'MY_SERVICES'>('PATIO');
  // Para o ADM: por padrão exibe OS sem mecânico definido + as dele; pode alternar para ver todas
  const [adminScope, setAdminScope] = useState<'UNASSIGNED_OR_MINE' | 'ALL'>('UNASSIGNED_OR_MINE');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Filtros de Data para Serviços Realizados
  const today = new Date();
  const tzOffset = today.getTimezoneOffset() * 60000;
  const localTodayISO = new Date(today.getTime() - tzOffset).toISOString().split('T')[0];

  const [mechanicFilterType, setMechanicFilterType] = useState<'DAY' | 'MONTH'>('DAY');
  const [mechanicFilterDate, setMechanicFilterDate] = useState(localTodayISO);
  const [mechanicFilterMonth, setMechanicFilterMonth] = useState(localTodayISO.slice(0, 7));

  // Modal de Diagnóstico e Upload
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [comment, setComment] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadMyOrders = async () => {
    try {
      const requests: Promise<any>[] = [api.get('/service-orders')];
      if (isAdmin) requests.push(api.get('/service-orders/mechanics'));
      const [ordersRes, mechRes] = await Promise.all(requests);
      setOrders(ordersRes.data || []);
      if (mechRes) setMechanics(mechRes.data || []);
    } catch {
      showToast('Erro ao carregar veículos do pátio.', 'error');
    }
  };

  useEffect(() => {
    loadMyOrders();
  }, []);

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    try {
      await api.patch(`/service-orders/${orderId}/status`, {
        status: newStatus,
      });
      if (newStatus === 'READY_FOR_PICKUP') {
        showToast('OS movida para a aba de Serviços Realizados!', 'success');
      }
      loadMyOrders();
    } catch {
      showToast('Erro ao atualizar status da OS.', 'error');
    }
  };

  const handleAssignMechanic = async (orderId: string, newMechanicId: string) => {
    try {
      await api.patch(`/service-orders/${orderId}/mechanic`, {
        mechanicId: newMechanicId || null,
      });
      showToast(
        newMechanicId
          ? 'Mecânico atribuído com sucesso!'
          : 'OS voltou para atendimento sem mecânico (ADM).',
        'success',
      );
      loadMyOrders();
    } catch {
      showToast('Erro ao atribuir mecânico.', 'error');
    }
  };

  const revertStatus = async (order: any) => {
    await api.patch(`/service-orders/${order.id}/status`, {
      status: 'IN_REPAIR',
      description: 'Veículo devolvido para reparação.',
    });
    loadMyOrders();
    showToast('OS devolvida para o Pátio!', 'success');
  };

  const handleSelectFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setFiles((prev) => [...prev, ...newFiles].slice(0, 10));
      e.target.value = '';
    }
  };

  const removeFile = (indexToRemove: number) => {
    setFiles((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleUploadMedia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder || (files.length === 0 && comment.trim() === '')) return;

    setUploading(true);
    try {
      if (files.length > 0) {
        const formData = new FormData();
        files.forEach((f) => formData.append('files', f));
        formData.append('description', comment);

        await api.post(`/service-orders/${selectedOrder.id}/media`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } else {
        await api.patch(`/service-orders/${selectedOrder.id}/status`, {
          status: selectedOrder.status,
          description: comment,
        });
      }

      setFiles([]);
      setComment('');
      setSelectedOrder(null);
      showToast('Diagnóstico enviado com sucesso!', 'success');
      loadMyOrders();
    } catch {
      showToast('Erro ao enviar diagnóstico.', 'error');
    } finally {
      setUploading(false);
    }
  };

  // Regra de visibilidade:
  // - Mecânico: vê apenas OS atribuídas a ele.
  // - ADM: vê OS sem mecânico definido (até ele atribuir) + as dele mesmo (ou todas se trocar o filtro).
  const matchesOwnership = (o: any) => {
    const assignedId = o.mechanic?.id || o.mechanicId || null;
    if (isAdmin) {
      if (adminScope === 'ALL') return true;
      return !assignedId || assignedId === user?.id;
    }
    return assignedId === user?.id;
  };

  // Filtragem da Lista do Pátio (Oculta veículos prontos/finalizados)
  const activeOrders = orders.filter((o) => {
    if (o.status === 'READY_FOR_PICKUP' || o.status === 'COMPLETED' || o.status === 'CANCELED') {
      return false;
    }
    if (!matchesOwnership(o)) return false;

    const q = searchTerm.toLowerCase();
    const matchesSearch =
      !q ||
      String(o.number).includes(q) ||
      o.vehicle.plate.toLowerCase().includes(q) ||
      o.vehicle.model.toLowerCase().includes(q) ||
      o.customer?.name?.toLowerCase().includes(q);

    const matchesStatus = !statusFilter || o.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Filtragem da Lista de Realizados
  const doneOrders = orders.filter((o) => {
    const isFinished = o.status === 'READY_FOR_PICKUP' || o.status === 'COMPLETED';
    if (!isFinished) return false;
    if (!matchesOwnership(o)) return false;

    const referenceDate = new Date(o.exitDate || o.updatedAt || o.entryDate);
    const localDateStr = new Date(
      referenceDate.getTime() - referenceDate.getTimezoneOffset() * 60000,
    ).toISOString();

    const matchesDate =
      mechanicFilterType === 'DAY'
        ? localDateStr.startsWith(mechanicFilterDate)
        : localDateStr.startsWith(mechanicFilterMonth);

    const q = searchTerm.toLowerCase();
    const matchesSearch =
      !q ||
      String(o.number).includes(q) ||
      o.vehicle.plate.toLowerCase().includes(q) ||
      o.vehicle.model.toLowerCase().includes(q);

    return matchesDate && matchesSearch;
  });

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4 pb-20">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between gap-2 bg-slate-900 text-white p-4 rounded-xl">
        <div className="flex items-center gap-2.5">
          <Wrench className="w-6 h-6 text-blue-400 shrink-0" />
          <div>
            <h1 className="font-bold">Área do Mecânico & Diagnóstico</h1>
            <p className="text-xs text-slate-400">
              Olá, {user?.name} {isAdmin ? '• Modo ADM (Sem mecânico definido)' : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Filtro de Escopo exclusivo para ADM */}
      {isAdmin && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-2.5 flex items-center justify-between gap-2 text-xs">
          <span className="text-blue-900 font-semibold flex items-center gap-1.5">
            <UserCheck className="w-4 h-4 text-blue-600 shrink-0" />
            Exibição ADM:
          </span>
          <div className="flex gap-1 bg-white p-0.5 rounded-lg border border-blue-200">
            <button
              type="button"
              onClick={() => setAdminScope('UNASSIGNED_OR_MINE')}
              className={`px-2.5 py-1 rounded-md font-bold transition cursor-pointer ${
                adminScope === 'UNASSIGNED_OR_MINE'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Sem mecânico / Meus
            </button>
            <button
              type="button"
              onClick={() => setAdminScope('ALL')}
              className={`px-2.5 py-1 rounded-md font-bold transition cursor-pointer ${
                adminScope === 'ALL'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Todos do Pátio
            </button>
          </div>
        </div>
      )}

      {/* Abas */}
      <div className="flex items-center gap-2 bg-slate-200 p-1 rounded-xl">
        <button
          type="button"
          onClick={() => {
            setViewMode('PATIO');
            setSearchTerm('');
            setStatusFilter('');
          }}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
            viewMode === 'PATIO' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
          }`}
        >
          <LayoutGrid className="w-4 h-4" /> Carros no Pátio ({activeOrders.length})
        </button>
        <button
          type="button"
          onClick={() => {
            setViewMode('MY_SERVICES');
            setSearchTerm('');
          }}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
            viewMode === 'MY_SERVICES' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" /> Realizados ({doneOrders.length})
        </button>
      </div>

      {/* ABA 1: CARROS NO PÁTIO */}
      {viewMode === 'PATIO' && (
        <div className="space-y-4">
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                placeholder="Buscar por OS, placa, modelo ou cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm bg-slate-50"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white font-medium"
            >
              <option value="">📋 Todos os Status</option>
              <option value="CHECK_IN">1. Entrada / Recepção</option>
              <option value="IN_DIAGNOSIS">2. Em Diagnóstico</option>
              <option value="WAITING_APPROVAL">3. Aguard. Aprovação</option>
              <option value="IN_REPAIR">4. Em Reparação</option>
            </select>
          </div>

          <div className="space-y-3">
            {activeOrders.length === 0 ? (
              <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-slate-500 text-sm px-4">
                {isAdmin
                  ? 'Nenhum veículo sem mecânico definido ou atribuído a você no pátio.'
                  : 'Nenhum veículo atribuído a você no pátio.'}
              </div>
            ) : (
              activeOrders.map((o) => {
                const cfg = STATUS_CONFIG[o.status] || {
                  label: o.status,
                  badge: 'bg-slate-200 text-slate-800',
                };
                const assignedId = o.mechanic?.id || o.mechanicId || '';

                return (
                  <div
                    key={o.id}
                    className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 space-y-3"
                  >
                    <div className="flex flex-wrap justify-between items-center gap-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-500">#{o.number}</span>
                        <span className="bg-slate-900 text-white font-mono text-xs px-2.5 py-0.5 rounded font-bold">
                          {o.vehicle.plate}
                        </span>
                        {!assignedId && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                            Sem mecânico (ADM)
                          </span>
                        )}
                      </div>
                      <span
                        className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full ${cfg.badge}`}
                      >
                        {cfg.label}
                      </span>
                    </div>

                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">
                        {o.vehicle.brand} {o.vehicle.model} ({o.vehicle.year})
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5 italic">
                        &quot;{o.customerNotes || 'Nenhuma observação da recepção'}&quot;
                      </p>
                    </div>

                    {/* Se o ADM quiser delegar a um mecânico cadastrado depois */}
                    {isAdmin && mechanics.length > 0 && (
                      <div className="flex items-center gap-2 text-xs pt-1">
                        <span className="text-slate-500 font-semibold shrink-0">Mecânico:</span>
                        <select
                          value={assignedId}
                          onChange={(e) => handleAssignMechanic(o.id, e.target.value)}
                          className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-medium text-slate-700"
                        >
                          <option value="">Sem mecânico (Atendimento ADM)</option>
                          {mechanics.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedOrder(o);
                          setFiles([]);
                          setComment('');
                        }}
                        className="flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-xs font-medium transition cursor-pointer"
                      >
                        <Camera className="w-4 h-4" /> Diagnóstico / Fotos
                      </button>

                      <select
                        value={o.status}
                        onChange={(e) => handleStatusChange(o.id, e.target.value)}
                        className="bg-slate-50 text-slate-800 text-xs font-bold px-2 py-2 rounded-lg border border-slate-300 text-center cursor-pointer"
                      >
                        <option value="CHECK_IN">Check-in</option>
                        <option value="IN_DIAGNOSIS">Em Diagnóstico</option>
                        <option value="WAITING_APPROVAL">Aguard. Aprovação</option>
                        <option value="IN_REPAIR">Em Reparação</option>
                        <option value="READY_FOR_PICKUP">Finalizar / Entregar</option>
                      </select>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ABA 2: SERVIÇOS REALIZADOS */}
      {viewMode === 'MY_SERVICES' && (
        <div className="space-y-4">
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <select
                value={mechanicFilterType}
                onChange={(e) => setMechanicFilterType(e.target.value as 'DAY' | 'MONTH')}
                className="w-1/3 px-2 py-2 border border-slate-300 rounded-lg text-xs bg-slate-50 font-medium"
              >
                <option value="DAY">Dia</option>
                <option value="MONTH">Mês</option>
              </select>

              {mechanicFilterType === 'DAY' ? (
                <input
                  type="date"
                  value={mechanicFilterDate}
                  onChange={(e) => setMechanicFilterDate(e.target.value)}
                  className="w-2/3 px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white font-medium"
                />
              ) : (
                <input
                  type="month"
                  value={mechanicFilterMonth}
                  onChange={(e) => setMechanicFilterMonth(e.target.value)}
                  className="w-2/3 px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white font-medium"
                />
              )}
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                placeholder="Buscar placa finalizada..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm bg-slate-50"
              />
            </div>
          </div>

          <div className="space-y-3">
            {doneOrders.length === 0 ? (
              <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-slate-500 text-sm">
                Nenhum serviço concluído nesta data.
              </div>
            ) : (
              doneOrders.map((o) => (
                <div
                  key={o.id}
                  className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 space-y-2 relative"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <span className="text-xs font-bold text-slate-500 mr-1.5">#{o.number}</span>
                      <span className="bg-slate-900 text-white font-mono text-xs px-2.5 py-0.5 rounded font-bold mr-2">
                        {o.vehicle.plate}
                      </span>
                      <h3 className="font-bold text-slate-900 text-sm inline-block">
                        {o.vehicle.brand} {o.vehicle.model}
                      </h3>
                    </div>
                  </div>

                  <div className="flex justify-between items-end pt-1">
                    <p className="text-xs text-slate-500">
                      Concluído:{' '}
                      {new Date(o.exitDate || o.updatedAt || o.entryDate).toLocaleString('pt-BR')}
                    </p>

                    {o.status === 'READY_FOR_PICKUP' && (
                      <button
                        type="button"
                        onClick={() => revertStatus(o)}
                        className="text-[10px] uppercase font-bold tracking-wider text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2 py-1 rounded-md flex items-center gap-1 transition cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" /> Voltar p/ Reparo
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Modal para Adicionar Múltiplas Fotos/Vídeos (via Portal acima da sidebar) */}
      {selectedOrder &&
        createPortal(
          <div
            className="fixed inset-0 z-[110] bg-black/65 flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={() => setSelectedOrder(null)}
          >
            <div
              className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center border-b pb-2.5">
                <h3 className="font-bold text-slate-900">
                  Diagnóstico & Mídias — OS #{selectedOrder.number} ({selectedOrder.vehicle?.plate})
                </h3>
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleUploadMedia} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-2">
                    Fotos e Vídeos Selecionados ({files.length}/10)
                  </label>

                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*,video/*"
                    onChange={handleSelectFiles}
                    className="hidden"
                  />

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-3 px-4 border-2 border-dashed border-blue-300 bg-blue-50/50 hover:bg-blue-50 text-blue-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> Selecionar Fotos ou Vídeos
                  </button>

                  {files.length > 0 && (
                    <div className="mt-3 space-y-2 max-h-40 overflow-y-auto pr-1">
                      {files.map((f, index) => (
                        <div
                          key={`${f.name}-${index}`}
                          className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 text-xs"
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
                            onClick={() => removeFile(index)}
                            className="text-red-500 hover:text-red-700 p-1 shrink-0 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Laudo / Comentário para o Cliente
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Ex: Fotos das pastilhas desgastadas e vídeo do vazamento..."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className="w-full p-3 border border-slate-300 rounded-lg text-sm"
                  />
                </div>

                <button
                  type="submit"
                  disabled={uploading || (files.length === 0 && comment.trim() === '')}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl text-sm flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  {uploading ? (
                    `Enviando ${
                      files.length > 0 ? `${files.length} arquivo(s)...` : 'diagnóstico...'
                    }`
                  ) : (
                    <>
                      <Send className="w-4 h-4" /> Enviar Diagnóstico e Fotos
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}