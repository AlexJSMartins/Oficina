import React, { useEffect, useState, useRef } from 'react';
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
  const [orders, setOrders] = useState<any[]>([]);

  // Controle de Abas e Filtros
  const [viewMode, setViewMode] = useState<'PATIO' | 'MY_SERVICES'>('PATIO');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Filtros de Data para Serviços Realizados
  const today = new Date();
  const tzOffset = today.getTimezoneOffset() * 60000;
  const localTodayISO = new Date(today.getTime() - tzOffset).toISOString().split('T')[0];

  const [mechanicFilterType, setMechanicFilterType] = useState<'DAY' | 'MONTH'>('DAY');
  const [mechanicFilterDate, setMechanicFilterDate] = useState(localTodayISO);
  const [mechanicFilterMonth, setMechanicFilterMonth] = useState(localTodayISO.slice(0, 7));

  // Modais e Upload
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [comment, setComment] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadMyOrders = async () => {
    const { data } = await api.get('/service-orders');
    setOrders(data);
  };

  useEffect(() => {
    loadMyOrders();
  }, []);

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    await api.patch(`/service-orders/${orderId}/status`, {
      status: newStatus,
    });
    if (newStatus === 'READY_FOR_PICKUP') {
      showToast('OS movida para a aba de Serviços Realizados!', 'success');
    }
    loadMyOrders();
  };

  const revertStatus = async (order: any) => {
    await api.patch(`/service-orders/${order.id}/status`, {
      status: 'IN_REPAIR',
      description: 'Veículo devolvido para reparação pelo mecânico.',
    });
    loadMyOrders();
    showToast('OS devolvida para o Pátio!', 'success');
  };

  const handleSelectFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setFiles((prev) => [...prev, ...newFiles]);
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
    } catch (err) {
      showToast('Erro ao enviar diagnóstico.', 'error');
    } finally {
      setUploading(false);
    }
  };

  // Filtragem da Lista do Pátio (Oculta veículos prontos)
  const activeOrders = orders.filter((o) => {
    if (o.status === 'READY_FOR_PICKUP' || o.status === 'COMPLETED' || o.status === 'CANCELED') return false;

    // Apenas OS atribuídas ao mecânico atual ou sem mecânico (se for política da oficina)
    const isMine = (o.mechanic?.id || o.mechanicId) === user?.id;
    if (!isMine) return false;

    const matchesSearch =
      !searchTerm ||
      o.vehicle.plate.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.vehicle.model.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = !statusFilter || o.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Filtragem da Lista de Realizados (Apenas os que chegaram em READY_FOR_PICKUP ou COMPLETED)
  const doneOrders = orders.filter((o) => {
    const isFinished = o.status === 'READY_FOR_PICKUP' || o.status === 'COMPLETED';
    if (!isFinished) return false;

    const isMine = (o.mechanic?.id || o.mechanicId) === user?.id;
    if (!isMine) return false;

    const referenceDate = new Date(o.exitDate || o.updatedAt || o.entryDate);
    const localDateStr = new Date(referenceDate.getTime() - referenceDate.getTimezoneOffset() * 60000).toISOString();
    
    const matchesDate = mechanicFilterType === 'DAY'
      ? localDateStr.startsWith(mechanicFilterDate)
      : localDateStr.startsWith(mechanicFilterMonth);

    const matchesSearch =
      !searchTerm ||
      o.vehicle.plate.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.vehicle.model.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesDate && matchesSearch;
  });

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4 pb-20">
      {/* Cabeçalho */}
      <div className="flex items-center gap-2 bg-slate-900 text-white p-4 rounded-xl">
        <Wrench className="w-6 h-6 text-blue-400" />
        <div>
          <h1 className="font-bold">Área do Mecânico</h1>
          <p className="text-xs text-slate-400">Olá, {user?.name}</p>
        </div>
      </div>

      {/* Abas */}
      <div className="flex items-center gap-2 bg-slate-200 p-1 rounded-xl">
        <button
          onClick={() => { setViewMode('PATIO'); setSearchTerm(''); setStatusFilter(''); }}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition ${
            viewMode === 'PATIO' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
          }`}
        >
          <LayoutGrid className="w-4 h-4" /> Meus Carros no Pátio
        </button>
        <button
          onClick={() => { setViewMode('MY_SERVICES'); setSearchTerm(''); }}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition ${
            viewMode === 'MY_SERVICES' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" /> Realizados
        </button>
      </div>

      {/* ABA 1: CARROS NO PÁTIO */}
      {viewMode === 'PATIO' && (
        <div className="space-y-4">
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                placeholder="Buscar placa ou modelo..."
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
              <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-slate-500 text-sm">
                Nenhum veículo no seu pátio.
              </div>
            ) : (
              activeOrders.map((o) => {
                const cfg = STATUS_CONFIG[o.status] || { label: o.status, badge: 'bg-slate-200 text-slate-800' };
                
                return (
                  <div key={o.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="bg-slate-900 text-white font-mono text-xs px-2.5 py-0.5 rounded font-bold">
                        {o.vehicle.plate}
                      </span>
                      <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full ${cfg.badge}`}>
                        {cfg.label}
                      </span>
                    </div>

                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">
                        {o.vehicle.brand} {o.vehicle.model}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5 italic">
                        "{o.customerNotes || 'Nenhuma observação da recepção'}"
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                      <button
                        onClick={() => { setSelectedOrder(o); setFiles([]); setComment(''); }}
                        className="flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-xs font-medium transition"
                      >
                        <Camera className="w-4 h-4" /> Diagnóstico / Fotos
                      </button>

                      <select
                        value={o.status}
                        onChange={(e) => handleStatusChange(o.id, e.target.value)}
                        className="bg-slate-50 text-slate-800 text-xs font-bold px-2 py-2 rounded-lg border border-slate-300 text-center"
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
                <div key={o.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 space-y-2 relative">
                  <div className="flex justify-between items-start">
                    <div>
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
                      Entregue: {new Date(o.updatedAt || o.entryDate).toLocaleString('pt-BR')}
                    </p>
                    
                    {o.status === 'READY_FOR_PICKUP' && (
                      <button
                        onClick={() => revertStatus(o)}
                        className="text-[10px] uppercase font-bold tracking-wider text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2 py-1 rounded-md flex items-center gap-1 transition"
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

      {/* Modal para Adicionar Múltiplas Fotos/Vídeos */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
          <div className="bg-white rounded-t-2xl sm:rounded-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-bold text-slate-900">Anexar Mídias — OS #{selectedOrder.number}</h3>
              <button onClick={() => setSelectedOrder(null)} className="text-slate-400 font-bold">✕</button>
            </div>

            <form onSubmit={handleUploadMedia} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2">
                  Fotos e Vídeos Selecionados ({files.length})
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
                  className="w-full py-3 px-4 border-2 border-dashed border-blue-300 bg-blue-50/50 hover:bg-blue-50 text-blue-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition"
                >
                  <Plus className="w-4 h-4" /> Selecionar Fotos ou Vídeos
                </button>

                {files.length > 0 && (
                  <div className="mt-3 space-y-2 max-h-40 overflow-y-auto pr-1">
                    {files.map((f, index) => (
                      <div key={index} className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 text-xs">
                        <div className="flex items-center gap-2 truncate pr-2">
                          {f.type.startsWith('video/') ? (
                            <Film className="w-4 h-4 text-purple-600 shrink-0" />
                          ) : (
                            <ImageIcon className="w-4 h-4 text-blue-600 shrink-0" />
                          )}
                          <span className="truncate font-medium text-slate-700">{f.name}</span>
                        </div>
                        <button type="button" onClick={() => removeFile(index)} className="text-red-500 hover:text-red-700 p-1 shrink-0">
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
                className="w-full bg-blue-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg text-sm flex items-center justify-center gap-2 transition"
              >
                {uploading ? (
                  `Enviando ${files.length > 0 ? files.length + ' arquivo(s)...' : 'diagnóstico...'}`
                ) : (
                  <><Send className="w-4 h-4" /> Enviar Diagnóstico e Fotos</>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}