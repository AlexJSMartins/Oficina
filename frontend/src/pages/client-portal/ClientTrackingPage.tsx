// frontend/src/pages/client-portal/ClientTrackingPage.tsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { CheckCircle2, XCircle, Receipt, FileText } from 'lucide-react';
import { printWorkshopBudgetPdf } from '../../utils/printBudgetPdf';

const STATUS_LABELS: Record<string, string> = {
  CHECK_IN: 'Entrada / Recepção',
  IN_DIAGNOSIS: 'Em Diagnóstico Técnico',
  WAITING_APPROVAL: 'Aguardando Aprovação do Orçamento',
  IN_REPAIR: 'Em Reparação na Oficina',
  READY_FOR_PICKUP: 'Veículo Pronto para Retirada',
  COMPLETED: 'Serviço Finalizado e Entregue',
};

export default function ClientTrackingPage() {
  const { token } = useParams();
  const { showToast } = useToast();

  const [data, setData] = useState<any>(null);
  const [workshop, setWorkshop] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadTracking = () => {
    api
      .get(`/portal/tracking/${token}`)
      .then((res) => setData(res.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadTracking();
    api
      .get('/settings')
      .then((res) => setWorkshop(res.data))
      .catch(() => {});
  }, [token]);

  const handleDecision = async (approved: boolean) => {
    let reason = '';
    if (!approved) {
      reason = prompt('Conte-nos qual dúvida ou ajuste você gostaria no orçamento:') || '';
      if (!reason) return;
    }

    setSubmitting(true);
    try {
      await api.post(`/portal/tracking/${token}/decision`, { approved, reason });
      showToast(
        approved
          ? 'Orçamento aprovado com sucesso! Obrigado.'
          : 'Sua solicitação de ajuste foi enviada para a oficina.',
        'success',
      );
      loadTracking();
    } catch {
      showToast('Não foi possível registrar sua resposta.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClientPrintBudget = () => {
    printWorkshopBudgetPdf(data, workshop);
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500">
        Carregando informações do seu veículo...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 text-center text-red-500">
        Ordem de serviço não encontrada ou link inválido.
      </div>
    );
  }

  const cleanTimeline = (data.timeline || []).filter((item: any, index: number, arr: any[]) => {
    if (index === 0) return true;
    const prev = arr[index - 1];
    const isSameStatusAndDesc =
      item.status === prev.status &&
      item.description === prev.description &&
      (!item.medias || item.medias.length === 0);
    return !isSameStatusAndDesc;
  });

  const showBudgetCard =
    data.status === 'WAITING_APPROVAL' ||
    Number(data.totalAmount) > 0 ||
    (data.items && data.items.length > 0);

  const primaryColor = workshop?.primaryColor || '#0f172a';
  const secondaryColor = workshop?.secondaryColor || '#16a34a';

  return (
    <div className="max-w-xl mx-auto p-4 space-y-6 pb-12">
      {/* Topo / Dados da Oficina e do Carro com Identidade Visual */}
      <div
        style={{ backgroundColor: primaryColor }}
        className="text-white p-6 rounded-2xl shadow-lg space-y-4 transition-colors"
      >
        <div className="flex justify-between items-start gap-3">
          <div className="flex items-center gap-3">
            {workshop?.logoUrl && (
              <img
                src={workshop.logoUrl}
                alt="Logo da Oficina"
                className="h-12 w-auto bg-white p-1.5 rounded-xl object-contain shrink-0"
              />
            )}
            <div>
              <span className="text-[11px] uppercase tracking-wider opacity-80 font-bold block">
                {workshop?.name || 'Painel de Acompanhamento'}
              </span>
              {workshop?.slogan && (
                <span className="text-[11px] opacity-70 block">{workshop.slogan}</span>
              )}
            </div>
          </div>

          <span className="bg-white/20 border border-white/25 font-mono text-xs px-2.5 py-1 rounded-lg font-bold shrink-0">
            OS #{data.number}
          </span>
        </div>

        <div className="pt-1">
          <h1 className="text-xl font-bold">
            {data.vehicle.brand} {data.vehicle.model} ({data.vehicle.year})
          </h1>
          <p className="text-xs opacity-80 font-mono mt-0.5">
            Placa: {data.vehicle.plate} • Cliente: {data.customer?.name}
          </p>
        </div>

        <div className="pt-3 border-t border-white/15 flex justify-between items-center text-xs">
          <span>
            Status Atual:{' '}
            <strong className="underline decoration-white/40 underline-offset-4">
              {STATUS_LABELS[data.status] || data.status}
            </strong>
          </span>
          <span className="opacity-90 font-semibold">KM: {data.currentKm} km</span>
        </div>
      </div>

      {/* Card de Orçamento, Visualização de Cobrança e Botões de Aprovação */}
      {showBudgetCard && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border-2 border-emerald-500/30 space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <h2 className="font-bold text-slate-900 text-sm uppercase tracking-wider flex items-center gap-2">
              <Receipt className="w-5 h-5 text-emerald-600" /> Orçamento & Cobrança
            </h2>
            <button
              onClick={handleClientPrintBudget}
              className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition"
            >
              <FileText className="w-3.5 h-3.5 text-blue-600" /> Ver Orçamento (PDF)
            </button>
          </div>

          {data.items && data.items.length > 0 ? (
            <div className="divide-y border rounded-xl overflow-hidden text-xs">
              {data.items.map((item: any) => (
                <div key={item.id} className="p-3 flex justify-between items-center bg-slate-50/50">
                  <div>
                    <span className="font-semibold text-slate-800 block">{item.description}</span>
                    <span className="text-[11px] text-slate-400">
                      {item.type === 'PART' ? 'Peça' : 'Mão de Obra'} • {item.quantity}x R${' '}
                      {Number(item.unitPrice).toFixed(2)}
                    </span>
                  </div>
                  <span className="font-bold text-slate-900">
                    R$ {Number(item.totalPrice).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic">
              Orçamento fechado para execução do serviço.
            </p>
          )}

          {Number(data.discount) > 0 && (
            <div className="text-right text-xs text-emerald-600 font-medium">
              Desconto aplicado: - R$ {Number(data.discount).toFixed(2)}
            </div>
          )}

          <div className="flex items-center justify-between bg-emerald-50 px-4 py-3 rounded-xl border border-emerald-200">
            <span className="text-xs font-bold uppercase text-emerald-950">Valor Total:</span>
            <span
              style={{ color: secondaryColor }}
              className="text-lg font-extrabold"
            >
              R$ {Number(data.totalAmount || 0).toFixed(2)}
            </span>
          </div>

          {/* Botões de Aprovação Online pelo Cliente */}
          {data.status === 'WAITING_APPROVAL' && (
            <div className="bg-purple-50 border border-purple-200 p-4 rounded-xl space-y-3">
              <p className="text-xs font-bold text-purple-950 text-center">
                Autoriza a execução do serviço conforme o orçamento acima?
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  disabled={submitting}
                  onClick={() => handleDecision(true)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white py-3 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition"
                >
                  <CheckCircle2 className="w-4 h-4" /> Aprovar Orçamento
                </button>
                <button
                  disabled={submitting}
                  onClick={() => handleDecision(false)}
                  className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 py-3 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                >
                  <XCircle className="w-4 h-4 text-red-500" /> Pedir Ajuste
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Linha do Tempo de Atualizações */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-6">
        <h2 className="font-bold text-slate-900 text-sm uppercase tracking-wider">
          Linha do Tempo do Veículo
        </h2>

        <div className="space-y-6 relative before:absolute before:inset-0 before:left-3 before:w-0.5 before:bg-slate-200">
          {cleanTimeline.map((item: any) => (
            <div key={item.id} className="relative pl-8 space-y-3">
              <div
                style={{ backgroundColor: primaryColor }}
                className="absolute left-1.5 -translate-x-1/2 w-3.5 h-3.5 rounded-full border-2 border-white ring-4 ring-slate-100"
              />

              <div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-900">
                    {STATUS_LABELS[item.status] || item.status}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {new Date(item.createdAt).toLocaleString('pt-BR')}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1">{item.description}</p>
              </div>

              {item.medias && item.medias.length > 0 && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {item.medias.map((media: any) => (
                    <a
                      key={media.id}
                      href={media.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded-lg overflow-hidden border border-slate-200 bg-slate-100"
                    >
                      {media.type === 'VIDEO' ? (
                        <video
                          src={media.url}
                          className="w-full h-32 object-cover bg-black"
                          controls
                        />
                      ) : (
                        <img
                          src={media.url}
                          alt="Foto da OS"
                          className="w-full h-32 object-cover hover:scale-105 transition"
                        />
                      )}
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}