import { useCallback, useEffect, useState } from 'react';
import {
  FileText,
  Search,
  RefreshCw,
  FileDown,
  FileCode2,
  XCircle,
  FileEdit,
  RotateCcw,
  Archive,
  Eye,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Ban,
  MessageCircle,
  Copy,
  Wrench,
  X,
  Undo2,
  Upload,
} from 'lucide-react';
import { api } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import ServiceOrderFiscalModal from '../../components/fiscal/ServiceOrderFiscalModal';
import InboundXmlImportModal from '../../components/fiscal/InboundXmlImportModal';
import ReturnInvoiceWizardModal from '../../components/fiscal/ReturnInvoiceWizardModal';

type TabKey = 'TODAS' | 'SAIDAS' | 'SERVICOS' | 'DEVOLUCOES' | 'ENTRADAS';

interface FiscalSummary {
  totalEmitidoMes: number;
  autorizadas: number;
  processando: number;
  rejeitadas: number;
  canceladas: number;
  devolucoes: number;
}

const fmtMoney = (v: number) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtDateTimeBr = (iso?: string | null) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const STATUS_BADGE: Record<string, { label: string; classes: string }> = {
  AUTORIZADA: {
    label: 'Autorizada',
    classes: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  },
  PROCESSANDO: {
    label: 'Processando',
    classes: 'bg-amber-100 text-amber-800 border-amber-200',
  },
  REJEITADA: {
    label: 'Rejeitada',
    classes: 'bg-red-100 text-red-800 border-red-200',
  },
  CANCELADA: {
    label: 'Cancelada',
    classes: 'bg-slate-200 text-slate-700 border-slate-300',
  },
  RASCUNHO: {
    label: 'Rascunho',
    classes: 'bg-blue-100 text-blue-800 border-blue-200',
  },
};

export default function FiscalCenterPage() {
  const { showToast } = useToast();

  // Lista e resumo
  const [loading, setLoading] = useState(false);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [summary, setSummary] = useState<FiscalSummary>({
    totalEmitidoMes: 0,
    autorizadas: 0,
    processando: 0,
    rejeitadas: 0,
    canceladas: 0,
    devolucoes: 0,
  });

  // Abas e filtros
  const [activeTab, setActiveTab] = useState<TabKey>('TODAS');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [tipoFilter, setTipoFilter] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Estados de ação por linha
  const [busyId, setBusyId] = useState<string | null>(null);

  // Modais de operação
  const [detailInvoice, setDetailInvoice] = useState<any | null>(null);
  const [cancelTarget, setCancelTarget] = useState<any | null>(null);
  const [cancelJustificativa, setCancelJustificativa] = useState('');
  const [cancelCodigoNfse, setCancelCodigoNfse] = useState<
    'ERRO_EMISSAO' | 'SERVICO_NAO_PRESTADO' | 'DUPLICIDADE' | 'OUTROS'
  >('ERRO_EMISSAO');
  const [cancelMotivoNfse, setCancelMotivoNfse] = useState('');
  const [submittingCancel, setSubmittingCancel] = useState(false);

  const [cceTarget, setCceTarget] = useState<any | null>(null);
  const [cceText, setCceText] = useState('');
  const [submittingCce, setSubmittingCce] = useState(false);

  // Reemissão direto na OS (para notas rejeitadas)
  const [reissueOrderId, setReissueOrderId] = useState<string | null>(null);

  // Exportação em Lote (Contador)
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportPreview, setExportPreview] = useState<{
    count: number;
    totalValue: number;
    items: any[];
  }>({ count: 0, totalValue: 0, items: [] });
  const [loadingExportPreview, setLoadingExportPreview] = useState(false);
  const [exportTipo, setExportTipo] = useState<'ALL' | 'NFE' | 'NFCE' | 'NFSE'>('ALL');
  const [exportIncludePdf, setExportIncludePdf] = useState(true);
  const [exportIncludeCancelled, setExportIncludeCancelled] = useState(false);
  const [exportInicio, setExportInicio] = useState(() => {
    const todayBr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(
      new Date(),
    );
    return `${todayBr.slice(0, 7)}-01`;
  });
  const [exportFim, setExportFim] = useState(() =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date()),
  );
  const [creatingExport, setCreatingExport] = useState(false);

  // Compras (XML) e Devolução
  const [showXmlImportModal, setShowXmlImportModal] = useState(false);
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [returnInboundId, setReturnInboundId] = useState<string | null>(null);
  const [inboundHistory, setInboundHistory] = useState<any[]>([]);
  const [loadingInbound, setLoadingInbound] = useState(false);

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search.trim()) params.search = search.trim();
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      if (activeTab === 'SERVICOS') {
        params.tipo = 'NFSE';
      } else if (activeTab === 'DEVOLUCOES') {
        params.finalidade = 'DEVOLUCAO';
      } else if (tipoFilter !== 'ALL') {
        params.tipo = tipoFilter;
      }

      const { data } = await api.get('/fiscal/invoices', { params });
      let list: any[] = data?.items || (Array.isArray(data) ? data : []);

      if (activeTab === 'SAIDAS') {
        list = list.filter(
          (inv) => (inv.tipo === 'NFE' || inv.tipo === 'NFCE') && inv.finalidade !== 'DEVOLUCAO',
        );
      }

      setInvoices(list);
      if (data?.summary) setSummary(data.summary);
    } catch {
      showToast('Erro ao carregar notas fiscais.', 'error');
    } finally {
      setLoading(false);
    }
  }, [activeTab, search, statusFilter, tipoFilter, startDate, endDate, showToast]);

  const loadInboundHistory = useCallback(async () => {
    setLoadingInbound(true);
    try {
      const { data } = await api.get('/fiscal/returns/inbound-list');
      setInboundHistory(Array.isArray(data) ? data : []);
    } catch {
      setInboundHistory([]);
    } finally {
      setLoadingInbound(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadInvoices();
    }, 250);
    return () => clearTimeout(timer);
  }, [loadInvoices]);

  useEffect(() => {
    if (activeTab === 'ENTRADAS') {
      loadInboundHistory();
    }
  }, [activeTab, loadInboundHistory]);

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('ALL');
    setTipoFilter('ALL');
    setStartDate('');
    setEndDate('');
  };

  // Abrir PDF (sincroniza antes se necessário)
  const handleSyncOrPdf = async (inv: any, openPdf: boolean) => {
    setBusyId(inv.id);
    try {
      const { data } = await api.get(`/fiscal/invoices/${inv.id}/sync-pdf`);
      await loadInvoices();

      if (!openPdf) {
        showToast(
          `Status atualizado: ${data.status}`,
          data.status === 'REJEITADA' ? 'error' : 'success',
        );
        return;
      }

      if (data.pdfBase64) {
        const clean = data.pdfBase64
          .replace(/^data:application\/pdf;base64,/, '')
          .replace(/\s+/g, '');
        const bytes = atob(clean);
        const arr = new Uint8Array(bytes.length);
        for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
        const blobUrl = URL.createObjectURL(new Blob([arr], { type: 'application/pdf' }));
        window.open(blobUrl, '_blank', 'noopener,noreferrer');
      } else if (
        data.linkPdf &&
        /^https?:\/\//i.test(data.linkPdf) &&
        !data.linkPdf.includes('localhost:8000')
      ) {
        window.open(data.linkPdf, '_blank', 'noopener,noreferrer');
      } else if (data.status === 'REJEITADA') {
        showToast(`Nota rejeitada: ${data.motivoRejeicao || 'Consulte os detalhes.'}`, 'error');
      } else {
        showToast('PDF ainda não disponível. Aguarde o processamento.', 'info');
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Erro ao consultar PDF/status.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  // Baixar XML
  const handleDownloadXml = async (inv: any) => {
    setBusyId(inv.id);
    try {
      const { data } = await api.get(`/fiscal/invoices/${inv.id}/xml`);
      const clean = String(data.xmlBase64 || '').replace(/\s+/g, '');
      const xmlText = atob(clean);
      const blob = new Blob([xmlText], { type: 'application/xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.filename || `nota-${inv.numero || inv.id.slice(0, 8)}.xml`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast('XML baixado com sucesso!', 'success');
    } catch (err: any) {
      showToast(err.response?.data?.message || 'XML indisponível para esta nota.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  // Enviar resumo por WhatsApp para o cliente
  const handleSendWhatsApp = (inv: any) => {
    const rawPhone = (inv.customer?.phone || '').replace(/\D/g, '');
    if (!rawPhone) {
      showToast('Cliente não possui telefone cadastrado nesta nota.', 'error');
      return;
    }
    const phone = rawPhone.startsWith('55') ? rawPhone : `55${rawPhone}`;
    const lines = [
      `Olá ${inv.customer?.name || ''}!`,
      `Segue os dados da sua *${inv.tipo}*${inv.numero ? ` nº *${inv.numero}*` : ''}:`,
      inv.serviceOrderNumber ? `• Ordem de Serviço: #${inv.serviceOrderNumber}` : null,
      inv.vehicle
        ? `• Veículo: ${inv.vehicle.brand} ${inv.vehicle.model} (${inv.vehicle.plate})`
        : null,
      `• Valor: *${fmtMoney(inv.valorTotal)}*`,
      inv.chaveAcesso ? `• Chave de Acesso: ${inv.chaveAcesso}` : null,
      inv.linkPdf && !inv.linkPdf.includes('localhost:8000') ? `• PDF: ${inv.linkPdf}` : null,
    ].filter(Boolean);

    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(lines.join('\n'))}`, '_blank');
  };

  // Reprocessar protocolo
  const handleReprocess = async (inv: any) => {
    setBusyId(inv.id);
    try {
      await api.post(`/fiscal/invoices/${inv.id}/reprocess`);
      showToast('Protocolo enviado para reprocessamento na DevNota.', 'info');
      await loadInvoices();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Erro ao reprocessar protocolo.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  // Cancelar nota
  const handleConfirmCancel = async () => {
    if (!cancelTarget) return;
    setSubmittingCancel(true);
    try {
      const payload =
        cancelTarget.tipo === 'NFSE'
          ? {
              codigoCancelamento: cancelCodigoNfse,
              motivoCancelamento: cancelMotivoNfse.trim() || undefined,
            }
          : { justificativa: cancelJustificativa.trim() };

      await api.post(`/fiscal/invoices/${cancelTarget.id}/cancel`, payload);
      showToast('Solicitação de cancelamento registrada com sucesso.', 'success');
      setCancelTarget(null);
      setCancelJustificativa('');
      setCancelMotivoNfse('');
      await loadInvoices();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Erro ao cancelar nota fiscal.', 'error');
    } finally {
      setSubmittingCancel(false);
    }
  };

  // Carta de Correção (CC-e)
  const handleConfirmCce = async () => {
    if (!cceTarget) return;
    setSubmittingCce(true);
    try {
      await api.post(`/fiscal/invoices/${cceTarget.id}/cce`, { correcao: cceText.trim() });
      showToast('Carta de Correção (CC-e) enviada com sucesso!', 'success');
      setCceTarget(null);
      setCceText('');
      await loadInvoices();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Erro ao enviar Carta de Correção.', 'error');
    } finally {
      setSubmittingCce(false);
    }
  };

  // Exportação em Lote (Contador) — busca em tempo real e gera ZIP imediato
  const loadExportPreview = useCallback(async () => {
    setLoadingExportPreview(true);
    try {
      const { data } = await api.get('/fiscal/exports/preview', {
        params: {
          tipo: exportTipo,
          startDate: exportInicio,
          endDate: exportFim,
          includeCancelled: String(exportIncludeCancelled),
        },
      });
      setExportPreview(data || { count: 0, totalValue: 0, items: [] });
    } catch {
      setExportPreview({ count: 0, totalValue: 0, items: [] });
    } finally {
      setLoadingExportPreview(false);
    }
  }, [exportTipo, exportInicio, exportFim, exportIncludeCancelled]);

  useEffect(() => {
    if (!showExportModal) return;
    loadExportPreview();
  }, [showExportModal, loadExportPreview]);

  const openExportModal = () => {
    setShowExportModal(true);
  };

  const handleCreateExport = async () => {
    if (exportPreview.count === 0) {
      showToast('Nenhuma nota encontrada nesse filtro para exportar.', 'error');
      return;
    }
    setCreatingExport(true);
    try {
      const res = await api.post(
        '/fiscal/exports/local-zip',
        {
          tipo: exportTipo,
          startDate: exportInicio,
          endDate: exportFim,
          includePdf: exportIncludePdf,
          includeCancelled: exportIncludeCancelled,
        },
        { responseType: 'blob' },
      );

      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/zip' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `contador-${exportTipo.toLowerCase()}-${exportInicio}_a_${exportFim}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      showToast(
        `Pacote ZIP com ${exportPreview.count} nota(s) baixado com sucesso!`,
        'success',
      );
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Erro ao gerar arquivo ZIP.', 'error');
    } finally {
      setCreatingExport(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast('Copiado para a área de transferência.', 'info');
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2.5">
            <FileText className="w-6 h-6 text-blue-600" />
            <span>Central de Notas Fiscais</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Acompanhe NF-e, NFC-e, NFS-e e Devoluções • Baixe DANFE/XML, emita CC-e, cancele e exporte para o contador
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              loadInvoices();
              if (activeTab === 'ENTRADAS') loadInboundHistory();
            }}
            disabled={loading || loadingInbound}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading || loadingInbound ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </button>

          <button
            type="button"
            onClick={openExportModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-sm cursor-pointer"
          >
            <Archive className="w-4 h-4 text-blue-400" />
            <span>Exportar Lote (Contador)</span>
          </button>

          <button
            type="button"
            onClick={() => setShowXmlImportModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-sm cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>Importar Compra (XML)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setReturnInboundId(null);
              setReturnModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition shadow-sm cursor-pointer"
          >
            <Undo2 className="w-4 h-4" />
            <span>Nova Nota de Devolução</span>
          </button>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
            Autorizado no Mês
          </span>
          <strong className="text-xl font-extrabold text-slate-900 mt-1 block">
            {fmtMoney(summary.totalEmitidoMes)}
          </strong>
        </div>

        <div className="bg-white border border-emerald-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-emerald-700">
            <span className="text-[11px] font-bold uppercase">Autorizadas</span>
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <strong className="text-2xl font-extrabold text-emerald-700 mt-1 block">
            {summary.autorizadas}
          </strong>
        </div>

        <div className="bg-white border border-amber-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-amber-700">
            <span className="text-[11px] font-bold uppercase">Processando</span>
            <Clock className="w-4 h-4" />
          </div>
          <strong className="text-2xl font-extrabold text-amber-700 mt-1 block">
            {summary.processando}
          </strong>
        </div>

        <div className="bg-white border border-red-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-red-700">
            <span className="text-[11px] font-bold uppercase">Rejeitadas</span>
            <AlertTriangle className="w-4 h-4" />
          </div>
          <strong className="text-2xl font-extrabold text-red-700 mt-1 block">
            {summary.rejeitadas}
          </strong>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-slate-600">
            <span className="text-[11px] font-bold uppercase">Cancel. / Devol.</span>
            <Ban className="w-4 h-4" />
          </div>
          <strong className="text-2xl font-extrabold text-slate-800 mt-1 block">
            {summary.canceladas}{' '}
            <span className="text-xs font-semibold text-slate-400">/ {summary.devolucoes} dev.</span>
          </strong>
        </div>
      </div>

      {/* Abas (incluindo Compras / Entradas) */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        {(
          [
            { key: 'TODAS', label: 'Todas as Notas' },
            { key: 'SAIDAS', label: 'Produtos (NF-e / NFC-e)' },
            { key: 'SERVICOS', label: 'Serviços (NFS-e)' },
            { key: 'DEVOLUCOES', label: 'Devoluções' },
            { key: 'ENTRADAS', label: 'Compras / Entradas (XML)' },
          ] as { key: TabKey; label: string }[]
        ).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === tab.key
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Conteúdo Principal: Histórico de Compras (XML) OU Listagem de Notas Emitidas */}
      {activeTab === 'ENTRADAS' ? (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">NF-e Compra</th>
                <th className="py-3 px-4">Fornecedor / CNPJ</th>
                <th className="py-3 px-4">Emissão</th>
                <th className="py-3 px-4 text-right">Valor Total</th>
                <th className="py-3 px-4">Devoluções</th>
                <th className="py-3 px-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loadingInbound ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400">
                    Carregando histórico de compras importadas...
                  </td>
                </tr>
              ) : inboundHistory.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400">
                    Nenhuma nota de compra importada ainda. Clique em &quot;Importar Compra (XML)&quot;.
                  </td>
                </tr>
              ) : (
                inboundHistory.map((inb) => (
                  <tr key={inb.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <strong className="text-slate-900">
                        Nº {inb.numero} • Série {inb.serie}
                      </strong>
                      <div className="font-mono text-[10px] text-slate-400 mt-0.5">
                        {inb.chaveAcesso}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <strong className="text-slate-800 block">{inb.supplierName}</strong>
                      <span className="text-[11px] text-slate-500">{inb.supplierCnpj}</span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                      {fmtDateTimeBr(inb.dataEmissao)}
                    </td>
                    <td className="py-3 px-4 text-right font-extrabold text-slate-900">
                      {fmtMoney(inb.valorTotal)}
                    </td>
                    <td className="py-3 px-4">
                      {inb.returnsCount > 0 ? (
                        <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-bold text-[10px]">
                          {inb.returnsCount} devolução(ões)
                        </span>
                      ) : (
                        <span className="text-slate-400">Nenhuma</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setReturnInboundId(inb.id);
                          setReturnModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold cursor-pointer"
                      >
                        <Undo2 className="w-3.5 h-3.5" />
                        <span>Gerar Devolução</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          {/* Barra de Filtros Compostos */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
            <div className="lg:col-span-4">
              <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                Busca rápida
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Nº nota, OS, cliente, CPF/CNPJ, placa ou chave..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="lg:col-span-2">
              <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white"
              >
                <option value="ALL">Todos os status</option>
                <option value="AUTORIZADA">Autorizada</option>
                <option value="PROCESSANDO">Processando</option>
                <option value="REJEITADA">Rejeitada</option>
                <option value="CANCELADA">Cancelada</option>
              </select>
            </div>

            <div className="lg:col-span-2">
              <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                Modelo
              </label>
              <select
                value={tipoFilter}
                disabled={activeTab === 'SERVICOS'}
                onChange={(e) => setTipoFilter(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white disabled:bg-slate-100"
              >
                <option value="ALL">Todos</option>
                <option value="NFE">NF-e (Peças)</option>
                <option value="NFCE">NFC-e (Cupom)</option>
                <option value="NFSE">NFS-e (Serviço)</option>
              </select>
            </div>

            <div className="lg:col-span-2">
              <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">De</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-2.5 py-2 border border-slate-300 rounded-xl text-xs bg-white"
              />
            </div>

            <div className="lg:col-span-2 flex gap-2">
              <div className="flex-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                  Até
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-2.5 py-2 border border-slate-300 rounded-xl text-xs bg-white"
                />
              </div>
              {(search || statusFilter !== 'ALL' || tipoFilter !== 'ALL' || startDate || endDate) && (
                <button
                  type="button"
                  onClick={clearFilters}
                  title="Limpar filtros"
                  className="self-end px-2.5 py-2 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-600 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Tabela de Notas Emitidas */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4">Documento</th>
                    <th className="py-3 px-4">Emissão</th>
                    <th className="py-3 px-4">Cliente / Veículo / OS</th>
                    <th className="py-3 px-4 text-right">Valor</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading && invoices.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        Carregando documentos fiscais...
                      </td>
                    </tr>
                  ) : invoices.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        Nenhuma nota fiscal encontrada para os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    invoices.map((inv) => {
                      const badge = STATUS_BADGE[inv.status] || {
                        label: inv.status,
                        classes: 'bg-slate-100 text-slate-700 border-slate-200',
                      };
                      const isBusy = busyId === inv.id;

                      return (
                        <tr key={inv.id} className="hover:bg-slate-50/70 transition">
                          {/* Documento */}
                          <td className="py-3 px-4 align-top">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-extrabold px-2 py-0.5 rounded bg-slate-900 text-white text-[10px]">
                                {inv.tipo}
                              </span>
                              {inv.finalidade === 'DEVOLUCAO' && (
                                <span className="font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-800 text-[10px]">
                                  DEVOLUÇÃO
                                </span>
                              )}
                              {inv.ambiente !== 'producao' && (
                                <span className="font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] uppercase">
                                  {inv.ambiente}
                                </span>
                              )}
                            </div>
                            <div className="font-bold text-slate-800 mt-1">
                              {inv.numero ? `Nº ${inv.numero}` : 'Sem número'}
                              {inv.serie ? ` • Série ${inv.serie}` : ''}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              Prot.: {inv.protocolo || '—'}
                            </div>
                          </td>

                          {/* Emissão */}
                          <td className="py-3 px-4 align-top text-slate-600 whitespace-nowrap">
                            {fmtDateTimeBr(inv.createdAt)}
                          </td>

                          {/* Cliente / Veículo / OS */}
                          <td className="py-3 px-4 align-top">
                            <div className="font-bold text-slate-900">
                              {inv.customer?.name || inv.supplierName || 'Consumidor não identificado'}
                            </div>
                            {inv.customer?.document && (
                              <div className="text-[11px] text-slate-500">{inv.customer.document}</div>
                            )}
                            <div className="flex items-center gap-2 mt-1 flex-wrap text-[11px] text-slate-500">
                              {inv.serviceOrderNumber && (
                                <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold">
                                  OS #{inv.serviceOrderNumber}
                                </span>
                              )}
                              {inv.vehicle && (
                                <span>
                                  {inv.vehicle.brand} {inv.vehicle.model} •{' '}
                                  <strong className="font-mono">{inv.vehicle.plate}</strong>
                                </span>
                              )}
                            </div>
                            {inv.status === 'REJEITADA' && inv.motivoRejeicao && (
                              <div className="mt-1.5 text-[11px] text-red-600 bg-red-50 border border-red-100 rounded-lg px-2 py-1 max-w-md">
                                {inv.motivoRejeicao}
                              </div>
                            )}
                            {inv.cartaCorrecao && (
                              <div className="mt-1 text-[10px] text-indigo-700 font-semibold">
                                Possui Carta de Correção (CC-e)
                              </div>
                            )}
                          </td>

                          {/* Valor */}
                          <td className="py-3 px-4 align-top text-right font-extrabold text-slate-900 whitespace-nowrap">
                            {fmtMoney(inv.valorTotal)}
                          </td>

                          {/* Status */}
                          <td className="py-3 px-4 align-top">
                            <span
                              className={`inline-flex items-center px-2.5 py-1 rounded-full border text-[11px] font-bold ${badge.classes}`}
                            >
                              {badge.label}
                            </span>
                          </td>

                          {/* Ações */}
                          <td className="py-3 px-4 align-top">
                            <div className="flex items-center justify-end gap-1 flex-wrap">
                              {/* Sincronizar */}
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleSyncOrPdf(inv, false)}
                                title="Consultar / Sincronizar status na DevNota"
                                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 cursor-pointer"
                              >
                                <RefreshCw className={`w-3.5 h-3.5 ${isBusy ? 'animate-spin' : ''}`} />
                              </button>

                              {/* PDF */}
                              <button
                                type="button"
                                disabled={isBusy || inv.status === 'REJEITADA'}
                                onClick={() => handleSyncOrPdf(inv, true)}
                                title="Visualizar / Baixar PDF (DANFE / DANFSE)"
                                className="p-1.5 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 disabled:opacity-40 cursor-pointer"
                              >
                                <FileDown className="w-3.5 h-3.5" />
                              </button>

                              {/* XML */}
                              <button
                                type="button"
                                disabled={isBusy || inv.status === 'REJEITADA'}
                                onClick={() => handleDownloadXml(inv)}
                                title="Baixar arquivo XML"
                                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 disabled:opacity-40 cursor-pointer"
                              >
                                <FileCode2 className="w-3.5 h-3.5" />
                              </button>

                              {/* WhatsApp */}
                              {inv.status === 'AUTORIZADA' && inv.customer?.phone && (
                                <button
                                  type="button"
                                  onClick={() => handleSendWhatsApp(inv)}
                                  title="Enviar dados da nota por WhatsApp"
                                  className="p-1.5 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 cursor-pointer"
                                >
                                  <MessageCircle className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* CC-e (apenas NF-e autorizada) */}
                              {inv.tipo === 'NFE' && inv.status === 'AUTORIZADA' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCceTarget(inv);
                                    setCceText(inv.cartaCorrecao || '');
                                  }}
                                  title="Emitir Carta de Correção (CC-e)"
                                  className="p-1.5 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 cursor-pointer"
                                >
                                  <FileEdit className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* Reprocessar protocolo */}
                              {(inv.status === 'PROCESSANDO' || inv.status === 'REJEITADA') &&
                                inv.protocolo && (
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => handleReprocess(inv)}
                                    title="Reprocessar protocolo na DevNota"
                                    className="p-1.5 rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-700 cursor-pointer"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                  </button>
                                )}

                              {/* Corrigir e Reemitir na OS (quando rejeitada) */}
                              {inv.status === 'REJEITADA' && inv.serviceOrderId && (
                                <button
                                  type="button"
                                  onClick={() => setReissueOrderId(inv.serviceOrderId)}
                                  title="Corrigir dados e reemitir nota da OS"
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold cursor-pointer"
                                >
                                  <Wrench className="w-3 h-3" />
                                  <span>Corrigir</span>
                                </button>
                              )}

                              {/* Cancelar */}
                              {inv.status === 'AUTORIZADA' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCancelTarget(inv);
                                    setCancelJustificativa('');
                                    setCancelCodigoNfse('ERRO_EMISSAO');
                                    setCancelMotivoNfse('');
                                  }}
                                  title="Cancelar Nota Fiscal"
                                  className="p-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 cursor-pointer"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* Detalhes */}
                              <button
                                type="button"
                                onClick={() => setDetailInvoice(inv)}
                                title="Ver detalhes, chave de acesso e logs"
                                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
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
          </div>
        </>
      )}

      {/* MODAL 1: Detalhes da Nota */}
      {detailInvoice && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-2xl text-xs">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Detalhes da {detailInvoice.tipo}{' '}
                  {detailInvoice.numero ? `Nº ${detailInvoice.numero}` : ''}
                </h3>
                <p className="text-slate-500">Ref.: {detailInvoice.referenciaExterna}</p>
              </div>
              <button
                type="button"
                onClick={() => setDetailInvoice(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <div>
                <span className="text-slate-400 block">Status / Ambiente</span>
                <strong>
                  {detailInvoice.status} ({detailInvoice.ambiente})
                </strong>
              </div>
              <div>
                <span className="text-slate-400 block">Protocolo / UUID DevNota</span>
                <strong className="break-all">
                  {detailInvoice.protocolo || '—'} / {detailInvoice.uuidDevnota || '—'}
                </strong>
              </div>
              <div className="col-span-2">
                <span className="text-slate-400 block">Chave de Acesso</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <code className="font-mono bg-white px-2 py-1 rounded border text-[11px] break-all flex-1">
                    {detailInvoice.chaveAcesso || 'Ainda não gerada'}
                  </code>
                  {detailInvoice.chaveAcesso && (
                    <button
                      type="button"
                      onClick={() => copyToClipboard(detailInvoice.chaveAcesso)}
                      className="p-1.5 rounded-lg border hover:bg-slate-100 cursor-pointer"
                      title="Copiar chave"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {detailInvoice.motivoRejeicao && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-800">
                <strong className="block mb-1">Motivo da Rejeição:</strong>
                {detailInvoice.motivoRejeicao}
              </div>
            )}

            {detailInvoice.cartaCorrecao && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-indigo-900">
                <strong className="block mb-1">Última Carta de Correção (CC-e):</strong>
                {detailInvoice.cartaCorrecao}
              </div>
            )}

            {detailInvoice.retornoApi && (
              <div>
                <span className="font-bold text-slate-600 block mb-1">Último Retorno da API</span>
                <pre className="bg-slate-900 text-slate-200 p-3 rounded-xl overflow-x-auto max-h-48 text-[11px]">
                  {(() => {
                    try {
                      return JSON.stringify(JSON.parse(detailInvoice.retornoApi), null, 2);
                    } catch {
                      return detailInvoice.retornoApi;
                    }
                  })()}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 2: Cancelamento */}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl text-xs">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-red-700 flex items-center gap-2">
                <XCircle className="w-5 h-5" />
                <span>Cancelar {cancelTarget.tipo}</span>
              </h3>
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-slate-600">
              Nota <strong>Nº {cancelTarget.numero || '—'}</strong> • Valor:{' '}
              <strong>{fmtMoney(cancelTarget.valorTotal)}</strong>. Esta operação é irreversível na
              SEFAZ/Prefeitura.
            </p>

            {cancelTarget.tipo === 'NFSE' ? (
              <div className="space-y-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Motivo Legal</label>
                  <select
                    value={cancelCodigoNfse}
                    onChange={(e) => setCancelCodigoNfse(e.target.value as any)}
                    className="w-full px-3 py-2 border rounded-xl bg-white"
                  >
                    <option value="ERRO_EMISSAO">Erro na emissão</option>
                    <option value="SERVICO_NAO_PRESTADO">Serviço não prestado</option>
                    <option value="DUPLICIDADE">Duplicidade da nota</option>
                    <option value="OUTROS">Outros</option>
                  </select>
                </div>
                {cancelCodigoNfse === 'OUTROS' && (
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Descrição do motivo *
                    </label>
                    <textarea
                      rows={3}
                      value={cancelMotivoNfse}
                      onChange={(e) => setCancelMotivoNfse(e.target.value)}
                      placeholder="Descreva o motivo do cancelamento..."
                      className="w-full p-2.5 border rounded-xl"
                    />
                  </div>
                )}
              </div>
            ) : (
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Justificativa (mínimo 15 caracteres) *
                </label>
                <textarea
                  rows={3}
                  maxLength={255}
                  value={cancelJustificativa}
                  onChange={(e) => setCancelJustificativa(e.target.value)}
                  placeholder="Ex: Cancelamento solicitado por erro nos dados do destinatário."
                  className="w-full p-2.5 border rounded-xl"
                />
                <span className="text-[11px] text-slate-400">
                  {cancelJustificativa.trim().length}/255 caracteres
                </span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-semibold cursor-pointer"
              >
                Voltar
              </button>
              <button
                type="button"
                disabled={
                  submittingCancel ||
                  (cancelTarget.tipo !== 'NFSE' && cancelJustificativa.trim().length < 15)
                }
                onClick={handleConfirmCancel}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-bold cursor-pointer"
              >
                {submittingCancel ? 'Cancelando...' : 'Confirmar Cancelamento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Carta de Correção (CC-e) */}
      {cceTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl text-xs">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-indigo-800 flex items-center gap-2">
                <FileEdit className="w-5 h-5" />
                <span>Carta de Correção (CC-e) — NF-e Nº {cceTarget.numero}</span>
              </h3>
              <button
                type="button"
                onClick={() => setCceTarget(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-slate-500">
              A CC-e corrige observações, placa/veículo nas informações complementares ou endereço,
              mas <strong>não pode alterar valores, impostos ou CNPJ</strong>.
            </p>

            <div>
              <label className="font-bold text-slate-700 block mb-1">
                Texto da correção (15 a 1000 caracteres) *
              </label>
              <textarea
                rows={4}
                maxLength={1000}
                value={cceText}
                onChange={(e) => setCceText(e.target.value)}
                placeholder="Ex: Correção da placa informada nos dados adicionais para ABC1D23, sem alteração de valores fiscais."
                className="w-full p-3 border rounded-xl"
              />
              <span className="text-[11px] text-slate-400">
                {cceText.trim().length}/1000 caracteres
              </span>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCceTarget(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={submittingCce || cceText.trim().length < 15}
                onClick={handleConfirmCce}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold cursor-pointer"
              >
                {submittingCce ? 'Enviando...' : 'Transmitir CC-e'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Exportação em Lote (Contador) */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-2xl text-xs">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Archive className="w-5 h-5 text-blue-600" />
                  <span>Exportar Lote para o Contador (.ZIP)</span>
                </h3>
                <p className="text-slate-500">
                  Gera um arquivo .ZIP com os XMLs, PDFs e planilha resumo das notas filtradas.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowExportModal(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border">
              <div>
                <label className="font-bold text-slate-600 block mb-1">Modelo</label>
                <select
                  value={exportTipo}
                  onChange={(e) => setExportTipo(e.target.value as any)}
                  className="w-full px-2.5 py-2 border rounded-lg bg-white"
                >
                  <option value="ALL">Todas (NF-e + NFC-e + NFS-e)</option>
                  <option value="NFSE">Somente NFS-e (Serviço)</option>
                  <option value="NFE">Somente NF-e (Peças)</option>
                  <option value="NFCE">Somente NFC-e (Cupom)</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-600 block mb-1">Data Inicial</label>
                <input
                  type="date"
                  value={exportInicio}
                  onChange={(e) => setExportInicio(e.target.value)}
                  className="w-full px-2.5 py-2 border rounded-lg bg-white"
                />
              </div>

              <div>
                <label className="font-bold text-slate-600 block mb-1">Data Final</label>
                <input
                  type="date"
                  value={exportFim}
                  onChange={(e) => setExportFim(e.target.value)}
                  className="w-full px-2.5 py-2 border rounded-lg bg-white"
                />
              </div>

              <div className="sm:col-span-3 flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="flex flex-wrap items-center gap-4">
                  <label className="inline-flex items-center gap-1.5 text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={exportIncludePdf}
                      onChange={(e) => setExportIncludePdf(e.target.checked)}
                    />
                    <span>Incluir PDFs (DANFE / DANFSE)</span>
                  </label>

                  <label className="inline-flex items-center gap-1.5 text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={exportIncludeCancelled}
                      onChange={(e) => setExportIncludeCancelled(e.target.checked)}
                    />
                    <span>Incluir notas canceladas</span>
                  </label>
                </div>

                <button
                  type="button"
                  disabled={creatingExport || loadingExportPreview || exportPreview.count === 0}
                  onClick={handleCreateExport}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-bold cursor-pointer"
                >
                  {creatingExport
                    ? 'Montando ZIP...'
                    : `Baixar ZIP (${exportPreview.count} nota${exportPreview.count === 1 ? '' : 's'})`}
                </button>
              </div>
            </div>

            {/* Prévia das notas encontradas no filtro */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700">
                  Notas encontradas no período ({exportPreview.count})
                </span>
                <span className="font-extrabold text-slate-900">
                  Total: {fmtMoney(exportPreview.totalValue)}
                </span>
              </div>

              {loadingExportPreview ? (
                <p className="text-slate-400 py-6 text-center">Buscando notas no período...</p>
              ) : exportPreview.items.length === 0 ? (
                <p className="text-slate-400 py-6 text-center border rounded-xl">
                  Nenhuma nota autorizada encontrada nesse período.
                </p>
              ) : (
                <div className="divide-y border rounded-xl max-h-60 overflow-y-auto">
                  {exportPreview.items.map((item) => (
                    <div key={item.id} className="p-2.5 flex items-center justify-between gap-2">
                      <div>
                        <span className="font-extrabold px-1.5 py-0.5 rounded bg-slate-900 text-white text-[10px] mr-2">
                          {item.tipo}
                        </span>
                        <strong className="text-slate-800">
                          {item.numero ? `Nº ${item.numero}` : `Prot. ${item.protocolo || '—'}`}
                        </strong>
                        <span className="text-slate-500 ml-2">{fmtDateTimeBr(item.createdAt)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase text-emerald-700">
                          {item.status}
                        </span>
                        <strong className="text-slate-900">{fmtMoney(item.valorTotal)}</strong>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Reemissão na OS (para notas rejeitadas) */}
      <ServiceOrderFiscalModal
        isOpen={Boolean(reissueOrderId)}
        serviceOrderId={reissueOrderId || ''}
        onClose={() => setReissueOrderId(null)}
        onSuccess={loadInvoices}
      />

      {/* Modal de Importação de Compra (XML) */}
      <InboundXmlImportModal
        isOpen={showXmlImportModal}
        onClose={() => setShowXmlImportModal(false)}
        onImported={() => {
          loadInvoices();
          loadInboundHistory();
        }}
      />

      {/* Modal Assistente de Nota de Devolução */}
      <ReturnInvoiceWizardModal
        isOpen={returnModalOpen}
        initialInboundId={returnInboundId}
        onClose={() => {
          setReturnModalOpen(false);
          setReturnInboundId(null);
        }}
        onSuccess={() => {
          loadInvoices();
          loadInboundHistory();
        }}
      />
    </div>
  );
}