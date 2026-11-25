import { useEffect, useState } from 'react';
import {
  X,
  User,
  Car,
  Phone,
  FileText,
  Printer,
  ClipboardList,
  AlertTriangle,
  MessageCircle,
  Calendar,
} from 'lucide-react';
import { api } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

interface CustomerHistoryModalProps {
  customerId: string;
  onClose: () => void;
  onPrintOrderPdf: (orderId: string) => void;
  onOpenOrderBudget?: (orderId: string) => void;
  onOpenOrderFiscal?: (orderId: string) => void;
}

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  CHECK_IN: { text: 'Entrada', cls: 'bg-slate-100 text-slate-700' },
  IN_DIAGNOSIS: { text: 'Diagnóstico', cls: 'bg-amber-100 text-amber-800' },
  WAITING_APPROVAL: { text: 'Aguard. Aprovação', cls: 'bg-purple-100 text-purple-800' },
  IN_REPAIR: { text: 'Em Reparação', cls: 'bg-blue-100 text-blue-800' },
  READY_FOR_PICKUP: { text: 'Pronto', cls: 'bg-emerald-100 text-emerald-800' },
  COMPLETED: { text: 'Finalizada', cls: 'bg-emerald-600 text-white' },
  CANCELED: { text: 'Cancelada', cls: 'bg-red-100 text-red-700' },
};

const fmtMoney = (v: number) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function CustomerHistoryModal({
  customerId,
  onClose,
  onPrintOrderPdf,
  onOpenOrderBudget,
  onOpenOrderFiscal,
}: CustomerHistoryModalProps) {
  const { showToast } = useToast();
  const [dossier, setDossier] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get(`/customers/${customerId}/dossier`)
      .then(({ data }) => setDossier(data))
      .catch(() => {
        showToast('Erro ao carregar histórico do cliente.', 'error');
        onClose();
      })
      .finally(() => setLoading(false));
  }, [customerId]);

  const openWhatsApp = (phone?: string, name?: string) => {
    const digits = String(phone || '').replace(/\D/g, '');
    if (!digits) return;
    const full = digits.startsWith('55') ? digits : `55${digits}`;
    window.open(
      `https://wa.me/${full}?text=${encodeURIComponent(`Olá ${name || ''}! Tudo bem?`)}`,
      '_blank',
    );
  };

  const totalSpent = (dossier?.serviceOrders || [])
    .filter((o: any) => o.status === 'COMPLETED')
    .reduce((acc: number, o: any) => acc + Number(o.totalAmount || 0), 0);

  return (
    <div className="fixed inset-0 z-50 bg-black/65 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl text-xs">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                {loading ? 'Carregando prontuário...' : dossier?.name}
              </h2>
              {dossier && (
                <div className="flex flex-wrap items-center gap-3 text-slate-500 mt-0.5">
                  <span className="inline-flex items-center gap-1">
                    <Phone className="w-3 h-3" /> {dossier.phone}
                  </span>
                  {dossier.document && <span>Doc: {dossier.document}</span>}
                  {dossier.email && <span>{dossier.email}</span>}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {dossier?.phone && (
              <button
                type="button"
                onClick={() => openWhatsApp(dossier.phone, dossier.name)}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400">Buscando histórico completo...</div>
        ) : !dossier ? null : (
          <div className="p-6 space-y-6">
            {/* Resumo rápido */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">
                  Veículos Cadastrados
                </span>
                <strong className="text-lg font-extrabold text-slate-900">
                  {(dossier.vehicleSummaries || dossier.vehicles || []).length}
                </strong>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">
                  Total de Passagens (OS)
                </span>
                <strong className="text-lg font-extrabold text-blue-700">
                  {(dossier.serviceOrders || []).length}
                </strong>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5">
                <span className="text-[10px] font-bold uppercase text-emerald-700 block">
                  Total Gasto (Finalizadas)
                </span>
                <strong className="text-lg font-extrabold text-emerald-700">
                  {fmtMoney(totalSpent)}
                </strong>
              </div>
            </div>

            {/* Veículos e Alertas de Revisão */}
            {(dossier.vehicleSummaries || []).length > 0 && (
              <div className="space-y-2">
                <h3 className="font-bold uppercase tracking-wider text-slate-500 text-[11px] flex items-center gap-1.5">
                  <Car className="w-4 h-4 text-blue-600" /> Veículos do Cliente
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {dossier.vehicleSummaries.map((v: any) => (
                    <div
                      key={v.id}
                      className="border border-slate-200 rounded-xl p-3.5 bg-white space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <strong className="text-slate-900 text-sm">
                          {v.brand} {v.model} ({v.year})
                        </strong>
                        <span className="bg-slate-900 text-white font-mono font-bold px-2 py-0.5 rounded text-[11px]">
                          {v.plate}
                        </span>
                      </div>
                      <div className="text-slate-500">
                        Último KM: <strong>{Number(v.lastKm || 0).toLocaleString('pt-BR')} km</strong>
                        {v.lastServiceDate && (
                          <>
                            {' '}
                            • Última visita:{' '}
                            {new Date(v.lastServiceDate).toLocaleDateString('pt-BR')}
                          </>
                        )}
                      </div>
                      {v.maintenanceAlert?.active && (
                        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 text-[11px]">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>{v.maintenanceAlert.reason}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Histórico de Ordens de Serviço */}
            <div className="space-y-2.5">
              <h3 className="font-bold uppercase tracking-wider text-slate-500 text-[11px] flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-blue-600" /> Histórico de Ordens de Serviço (
                {(dossier.serviceOrders || []).length})
              </h3>

              {(dossier.serviceOrders || []).length === 0 ? (
                <p className="text-center text-slate-400 py-8 border rounded-xl">
                  Nenhuma OS registrada para este cliente.
                </p>
              ) : (
                <div className="space-y-3">
                  {dossier.serviceOrders.map((os: any) => {
                    const st = STATUS_LABEL[os.status] || {
                      text: os.status,
                      cls: 'bg-slate-100 text-slate-700',
                    };
                    return (
                      <div
                        key={os.id}
                        className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-2.5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <strong className="text-sm text-slate-900">OS #{os.number}</strong>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${st.cls}`}>
                              {st.text}
                            </span>
                            {os.vehicle && (
                              <span className="text-slate-600 font-semibold">
                                {os.vehicle.brand} {os.vehicle.model} ({os.vehicle.plate}) •{' '}
                                {Number(os.currentKm || 0).toLocaleString('pt-BR')} km
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-slate-500">
                              {new Date(os.entryDate).toLocaleDateString('pt-BR')}
                            </span>
                            <strong className="text-sm text-emerald-700">
                              {fmtMoney(os.totalAmount)}
                            </strong>
                          </div>
                        </div>

                        {os.items && os.items.length > 0 && (
                          <div className="bg-white border border-slate-200 rounded-lg p-2.5 space-y-1">
                            {os.items.map((it: any) => (
                              <div key={it.id} className="flex items-center justify-between gap-2">
                                <span className="text-slate-700">
                                  <span className="text-[10px] font-bold uppercase text-slate-400 mr-1.5">
                                    [{it.type === 'PART' ? 'Peça' : 'Serviço'}]
                                  </span>
                                  {it.quantity}x {it.description}
                                </span>
                                <span className="font-semibold text-slate-800 whitespace-nowrap">
                                  {fmtMoney(it.totalPrice)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                          <span className="text-[11px] text-slate-500">
                            Mecânico: <strong>{os.mechanic?.name || 'Não informado'}</strong>
                          </span>

                          <div className="flex flex-wrap items-center gap-1.5">
                            {onOpenOrderBudget && (
                              <button
                                type="button"
                                onClick={() => onOpenOrderBudget(os.id)}
                                className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold inline-flex items-center gap-1 cursor-pointer"
                              >
                                <ClipboardList className="w-3.5 h-3.5" /> Ver OS
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => onPrintOrderPdf(os.id)}
                              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Printer className="w-3.5 h-3.5" /> PDF da OS
                            </button>
                            {onOpenOrderFiscal && (
                              <button
                                type="button"
                                onClick={() => onOpenOrderFiscal(os.id)}
                                className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold inline-flex items-center gap-1 cursor-pointer"
                              >
                                <FileText className="w-3.5 h-3.5" /> Notas Fiscais
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}