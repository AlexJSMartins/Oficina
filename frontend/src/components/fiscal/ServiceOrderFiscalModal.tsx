// frontend/src/components/fiscal/ServiceOrderFiscalModal.tsx
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  FileText,
  Send,
  AlertTriangle,
  XCircle,
  Code2,
  Layers,
} from 'lucide-react';
import { api } from '@/contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useSubscription } from '../../contexts/SubscriptionContext';
import FiscalPreviewSheet from './FiscalPreviewSheet';
import FiscalUpgradeBanner from './FiscalUpgradeBanner';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  serviceOrderId: string;
  onSuccess?: () => void;
}

type DocType = 'NFSE' | 'NFE' | 'NFCE';

export default function ServiceOrderFiscalModal({
  isOpen,
  onClose,
  serviceOrderId,
  onSuccess,
}: Props) {
  const { showToast } = useToast();
  const {
    subscription,
    allowFiscalEmission,
    isFiscalQuotaExceeded,
    refreshSubscription,
  } = useSubscription();

  const fiscalBlocked = !allowFiscalEmission || isFiscalQuotaExceeded;
  const remainingInvoices = subscription?.entitlements?.invoicesRemaining ?? 0;
  const canAffordBoth = allowFiscalEmission && remainingInvoices >= 2;

  const [loading, setLoading] = useState(false);
  const [emitting, setEmitting] = useState(false);
  const [emittingBoth, setEmittingBoth] = useState(false);
  const [checkingPdfId, setCheckingPdfId] = useState<string | null>(null);
  const [docType, setDocType] = useState<DocType>('NFSE');
  const [partsPreference, setPartsPreference] = useState<'NFE' | 'NFCE'>('NFE');
  const [previewData, setPreviewData] = useState<any>(null);
  const [pdfLinks, setPdfLinks] = useState<Record<string, string>>({});
  const [confirmedReview, setConfirmedReview] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);

  // Formulário rápido para atualizar dados fiscais do cliente
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [loadingCep, setLoadingCep] = useState(false);
  const [customerForm, setCustomerForm] = useState({
    document: '',
    cep: '',
    logradouro: '',
    numeroEndereco: '',
    complemento: '',
    bairro: '',
    cidade: '',
    uf: '',
    codigoIbge: '',
  });

  const loadPreview = useCallback(async () => {
    if (!serviceOrderId) return;
    setLoading(true);
    try {
      const res = await api.get(`/fiscal/from-service-order/${serviceOrderId}/preview`);
      setPreviewData(res.data);
    } catch {
      showToast('Erro ao carregar prévia fiscal da OS.', 'error');
    } finally {
      setLoading(false);
    }
  }, [serviceOrderId, showToast]);

  useEffect(() => {
    if (!isOpen || !serviceOrderId) return;
    setConfirmedReview(false);
    setShowRawJson(false);
    setPdfLinks({});
    loadPreview();
    refreshSubscription();
  }, [isOpen, serviceOrderId, loadPreview, refreshSubscription]);

  // Preenche o formulário rápido sempre que carregar a prévia
  useEffect(() => {
    const c = previewData?.serviceOrder?.customer;
    if (!c) return;
    setCustomerForm({
      document: c.document || '',
      cep: c.cep || '',
      logradouro: c.logradouro || '',
      numeroEndereco: c.numeroEndereco || '',
      complemento: c.complemento || '',
      bairro: c.bairro || '',
      cidade: c.cidade || '',
      uf: c.uf || '',
      codigoIbge: c.codigoIbge || '',
    });
  }, [previewData]);

  // Fecha com ESC quando não estiver transmitindo
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !emitting && !emittingBoth) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, emitting, emittingBoth, onClose]);

  const handleChangeDocType = (type: DocType) => {
    setDocType(type);
    if (type === 'NFE' || type === 'NFCE') {
      setPartsPreference(type);
    }
    setConfirmedReview(false);
  };

  const handleLookupCep = async (cepValue: string) => {
    const clean = cepValue.replace(/\D/g, '');
    setCustomerForm((prev) => ({ ...prev, cep: clean }));
    if (clean.length !== 8) return;

    setLoadingCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const data = await res.json();
      if (data.erro) {
        showToast('CEP não encontrado.', 'error');
        return;
      }
      setCustomerForm((prev) => ({
        ...prev,
        logradouro: data.logradouro || prev.logradouro,
        bairro: data.bairro || prev.bairro,
        cidade: data.localidade || prev.cidade,
        uf: data.uf || prev.uf,
        codigoIbge: data.ibge || prev.codigoIbge,
      }));
    } catch {
      showToast('Não foi possível consultar o CEP automaticamente.', 'error');
    } finally {
      setLoadingCep(false);
    }
  };

  const handleSaveCustomerFiscal = async () => {
    const customerId = previewData?.serviceOrder?.customer?.id;
    if (!customerId) return;
    setSavingCustomer(true);
    try {
      await api.patch(`/fiscal/customers/${customerId}/fiscal-data`, customerForm);
      showToast('Dados fiscais do cliente salvos! NF-e atualizada.', 'success');
      await loadPreview();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Erro ao salvar dados do cliente.', 'error');
    } finally {
      setSavingCustomer(false);
    }
  };

  if (!isOpen) return null;

  const activeDraft = previewData?.drafts?.[docType];
  const blockingErrors: string[] = activeDraft?.errors || [];
  const canEmitCurrent = Boolean(activeDraft?.canEmit);

  const partsInvoice = previewData?.fiscalStatus?.parts;
  const servicesInvoice = previewData?.fiscalStatus?.services;

  const canEmitBoth =
    Boolean(previewData?.drafts?.[partsPreference]?.canEmit) &&
    Boolean(previewData?.drafts?.NFSE?.canEmit);

  const canAuthorizeTransmission = !fiscalBlocked && (canEmitCurrent || canEmitBoth);

  const handleEmitSingle = async () => {
    if (fiscalBlocked || !canEmitCurrent || !confirmedReview) return;
    setEmitting(true);
    try {
      const { data } = await api.post(
        `/fiscal/from-service-order/${serviceOrderId}/emit/${docType}`,
        { payload: activeDraft?.payload },
      );
      showToast(
        `${docType} enviada com sucesso (Protocolo ${data?.invoice?.protocolo || '—'}).`,
        'success',
      );
      setConfirmedReview(false);
      await Promise.all([loadPreview(), refreshSubscription()]);
      onSuccess?.();
    } catch (err: any) {
      const apiData = err.response?.data;
      const detailedErrors =
        apiData?.errors && typeof apiData.errors === 'object'
          ? Object.entries(apiData.errors)
              .map(([field, msgs]) => `${field}: ${Array.isArray(msgs) ? msgs.join(', ') : msgs}`)
              .join(' | ')
          : null;

      const msg =
        detailedErrors ||
        apiData?.message ||
        (Array.isArray(apiData)
          ? apiData.map((item: any) => item.mensagem || item.codigo).join(' | ')
          : null) ||
        'Falha ao emitir documento fiscal.';

      console.error('Erro DevNota:', apiData || err);
      showToast(typeof msg === 'string' ? msg : JSON.stringify(msg), 'error');
    } finally {
      setEmitting(false);
    }
  };

  const handleEmitBoth = async () => {
    if (fiscalBlocked || !canAffordBoth || !canEmitBoth || !confirmedReview) return;
    setEmittingBoth(true);
    try {
      const { data } = await api.post(
        `/fiscal/from-service-order/${serviceOrderId}/emit-both`,
        { partsDocType: partsPreference },
      );

      if (data.parts?.ok && data.services?.ok) {
        showToast(`${partsPreference} (Peças) e NFS-e (Serviços) enviadas com sucesso!`, 'success');
      } else {
        const msgs: string[] = [];
        if (data.parts?.ok) msgs.push(`${partsPreference} enviada`);
        else if (data.parts?.error) msgs.push(`Peças: ${data.parts.error}`);

        if (data.services?.ok) msgs.push('NFS-e enviada');
        else if (data.services?.error) msgs.push(`Serviços: ${data.services.error}`);

        showToast(msgs.join(' | '), data.parts?.ok || data.services?.ok ? 'info' : 'error');
      }

      setConfirmedReview(false);
      await Promise.all([loadPreview(), refreshSubscription()]);
      onSuccess?.();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Erro ao emitir ambas as notas.', 'error');
    } finally {
      setEmittingBoth(false);
    }
  };

  const openBase64PdfInNewTab = (invoiceId: string, rawBase64: string) => {
    const cleanBase64 = rawBase64
      .replace(/^data:application\/pdf;base64,/, '')
      .replace(/\s+/g, '');

    if (!cleanBase64) return;

    const byteChars = atob(cleanBase64);
    const byteNumbers = new Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) {
      byteNumbers[i] = byteChars.charCodeAt(i);
    }
    const blob = new Blob([new Uint8Array(byteNumbers)], { type: 'application/pdf' });
    const blobUrl = URL.createObjectURL(blob);
    setPdfLinks((prev) => ({ ...prev, [invoiceId]: blobUrl }));

    const newTab = window.open(blobUrl, '_blank', 'noopener,noreferrer');
    if (!newTab) {
      showToast('Pop-up bloqueado. Clique no link "Abrir PDF" ao lado da nota.', 'info');
    }
  };

  const handleCheckAndOpenPdf = async (invoiceId: string) => {
    setCheckingPdfId(invoiceId);
    try {
      const { data } = await api.get(`/fiscal/invoices/${invoiceId}/sync-pdf`);
      await loadPreview();

      if (data.pdfBase64) {
        openBase64PdfInNewTab(invoiceId, data.pdfBase64);
      } else if (
        data.linkPdf &&
        /^https?:\/\//i.test(data.linkPdf) &&
        !data.linkPdf.includes('localhost:8000')
      ) {
        setPdfLinks((prev) => ({ ...prev, [invoiceId]: data.linkPdf }));
        window.open(data.linkPdf, '_blank', 'noopener,noreferrer');
      } else if (data.status === 'REJEITADA') {
        showToast(`Nota rejeitada: ${data.motivoRejeicao || 'Verifique os dados.'}`, 'error');
      } else {
        showToast('Nota ainda em processamento na DevNota. Tente novamente em instantes.', 'info');
      }
    } catch {
      showToast('Erro ao consultar PDF da nota.', 'error');
    } finally {
      setCheckingPdfId(null);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[115] bg-black/75 backdrop-blur-[1px] flex items-center justify-center p-4"
      onClick={() => !emitting && !emittingBoth && onClose()}
    >
      <div
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto text-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 sticky top-0 bg-slate-900 z-20">
          <div className="flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-blue-400" />
            <div>
              <h2 className="font-bold text-base">
                Faturamento Fiscal Independente — OS #{previewData?.serviceOrder?.number || '...'}
              </h2>
              <p className="text-xs text-slate-400">
                Peças e Mão de Obra podem ser emitidas separadamente ou juntas • Ambiente:{' '}
                <span className="uppercase font-semibold text-amber-400">
                  {previewData?.ambiente || 'sandbox'}
                </span>
                {allowFiscalEmission && subscription?.entitlements && (
                  <>
                    {' '}
                    • Cota do mês:{' '}
                    <span className="font-semibold text-blue-300">
                      {subscription.entitlements.invoicesUsedThisMonth}/
                      {subscription.entitlements.maxMonthlyInvoices}
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={emitting || emittingBoth}
            onClick={onClose}
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Banner de Upgrade / Limite Fiscal (visível em TRIAL, plano sem fiscal ou cota esgotada) */}
          <FiscalUpgradeBanner compact />

          {loading && !previewData ? (
            <p className="text-sm text-slate-400 py-8 text-center">
              Preparando dados da OS e pré-visualização...
            </p>
          ) : !previewData ? null : (
            <>
              {/* Painel de Status das 2 Frentes da OS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Status Frente Peças */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-xs flex items-center justify-between gap-2">
                  <div>
                    <div className="text-slate-400 font-semibold uppercase text-[10px]">
                      Frente 1 — Peças / Produtos
                    </div>
                    {partsInvoice ? (
                      <div className="mt-1 text-emerald-300 font-bold">
                        {partsInvoice.tipo} • {partsInvoice.status}
                        {partsInvoice.numero ? ` (Nº ${partsInvoice.numero})` : ''}
                      </div>
                    ) : (
                      <div className="mt-1 text-slate-300">
                        {previewData.drafts.NFE.count > 0
                          ? `Pendente • R$ ${Number(previewData.drafts.NFE.total).toFixed(2)}`
                          : 'Sem peças nesta OS'}
                      </div>
                    )}
                  </div>

                  {partsInvoice && (
                    <div className="flex flex-col items-end gap-1">
                      <button
                        type="button"
                        disabled={checkingPdfId === partsInvoice.id}
                        onClick={() => handleCheckAndOpenPdf(partsInvoice.id)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer"
                      >
                        {checkingPdfId === partsInvoice.id ? 'Consultando...' : 'Status / PDF'}
                      </button>
                      {pdfLinks[partsInvoice.id] && (
                        <a
                          href={pdfLinks[partsInvoice.id]}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline text-[11px] text-emerald-300"
                        >
                          Abrir PDF
                        </a>
                      )}
                    </div>
                  )}
                </div>

                {/* Status Frente Serviços */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-xs flex items-center justify-between gap-2">
                  <div>
                    <div className="text-slate-400 font-semibold uppercase text-[10px]">
                      Frente 2 — Mão de Obra / Serviços
                    </div>
                    {servicesInvoice ? (
                      <div className="mt-1 text-emerald-300 font-bold">
                        NFS-e • {servicesInvoice.status}
                        {servicesInvoice.numero ? ` (Nº ${servicesInvoice.numero})` : ''}
                      </div>
                    ) : (
                      <div className="mt-1 text-slate-300">
                        {previewData.drafts.NFSE.count > 0
                          ? `Pendente • R$ ${Number(previewData.drafts.NFSE.total).toFixed(2)}`
                          : 'Sem serviços nesta OS'}
                      </div>
                    )}
                  </div>

                  {servicesInvoice && (
                    <div className="flex flex-col items-end gap-1">
                      <button
                        type="button"
                        disabled={checkingPdfId === servicesInvoice.id}
                        onClick={() => handleCheckAndOpenPdf(servicesInvoice.id)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer"
                      >
                        {checkingPdfId === servicesInvoice.id ? 'Consultando...' : 'Status / PDF'}
                      </button>
                      {pdfLinks[servicesInvoice.id] && (
                        <a
                          href={pdfLinks[servicesInvoice.id]}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline text-[11px] text-emerald-300"
                        >
                          Abrir PDF
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Abas de Pré-visualização por Documento */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {(['NFSE', 'NFE', 'NFCE'] as DocType[]).map((type) => {
                  const draft = previewData.drafts[type];
                  const selected = docType === type;
                  const alreadyEmitted =
                    type === 'NFSE' ? Boolean(servicesInvoice) : Boolean(partsInvoice);

                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => handleChangeDocType(type)}
                      className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                        selected
                          ? 'bg-blue-600/20 border-blue-500 text-white'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm">
                          {type === 'NFSE'
                            ? 'NFS-e (Serviços)'
                            : type === 'NFE'
                            ? 'NF-e (Peças)'
                            : 'NFC-e (Cupom Peças)'}
                        </span>
                        {alreadyEmitted ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold">
                            Emitida
                          </span>
                        ) : draft.canEmit ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-semibold">
                            Pronta
                          </span>
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 font-semibold">
                            Pendência
                          </span>
                        )}
                      </div>
                      <div className="text-xs mt-1">
                        {draft.count} {type === 'NFSE' ? 'serviço(s)' : 'peça(s)'} • R${' '}
                        {Number(draft.total).toFixed(2)}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Erros Bloqueantes da Aba Selecionada */}
              {blockingErrors.length > 0 && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3.5 text-xs text-red-200 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-red-300">
                    <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                    <span>Situação da aba {docType}:</span>
                  </div>
                  <ul className="list-disc pl-5 space-y-0.5">
                    {blockingErrors.map((errMsg, i) => (
                      <li key={i}>{errMsg}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Formulário rápido para completar dados do cliente sem sair do modal */}
              {docType === 'NFE' && (previewData.missingCustomerFields?.length || 0) > 0 && (
                <div className="bg-slate-950 border border-blue-500/40 rounded-xl p-4 space-y-3 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-bold text-blue-300">
                        Completar dados do cliente para emitir NF-e
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Digite o CPF/CNPJ e o CEP — rua, bairro, cidade, UF e IBGE são preenchidos
                        automaticamente.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">CPF / CNPJ *</label>
                      <input
                        type="text"
                        placeholder="Somente números"
                        value={customerForm.document}
                        onChange={(e) =>
                          setCustomerForm((p) => ({ ...p, document: e.target.value }))
                        }
                        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">
                        CEP * {loadingCep && <span className="text-blue-400">(buscando...)</span>}
                      </label>
                      <input
                        type="text"
                        maxLength={9}
                        placeholder="00000000"
                        value={customerForm.cep}
                        onChange={(e) => handleLookupCep(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Número *</label>
                      <input
                        type="text"
                        placeholder="Ex: 123 ou S/N"
                        value={customerForm.numeroEndereco}
                        onChange={(e) =>
                          setCustomerForm((p) => ({ ...p, numeroEndereco: e.target.value }))
                        }
                        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="text-[10px] text-slate-400 block mb-1">Logradouro *</label>
                      <input
                        type="text"
                        value={customerForm.logradouro}
                        onChange={(e) =>
                          setCustomerForm((p) => ({ ...p, logradouro: e.target.value }))
                        }
                        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Bairro *</label>
                      <input
                        type="text"
                        value={customerForm.bairro}
                        onChange={(e) =>
                          setCustomerForm((p) => ({ ...p, bairro: e.target.value }))
                        }
                        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Cidade *</label>
                      <input
                        type="text"
                        value={customerForm.cidade}
                        onChange={(e) =>
                          setCustomerForm((p) => ({ ...p, cidade: e.target.value }))
                        }
                        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">UF *</label>
                      <input
                        type="text"
                        maxLength={2}
                        value={customerForm.uf}
                        onChange={(e) =>
                          setCustomerForm((p) => ({ ...p, uf: e.target.value.toUpperCase() }))
                        }
                        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Cód. IBGE *</label>
                      <input
                        type="text"
                        maxLength={7}
                        value={customerForm.codigoIbge}
                        onChange={(e) =>
                          setCustomerForm((p) => ({ ...p, codigoIbge: e.target.value }))
                        }
                        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={savingCustomer}
                      onClick={handleSaveCustomerFiscal}
                      className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold cursor-pointer"
                    >
                      {savingCustomer ? 'Salvando...' : 'Salvar dados do cliente e atualizar prévia'}
                    </button>
                  </div>
                </div>
              )}

              {/* Avisos Gerais */}
              {previewData.warnings?.length > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 text-xs text-amber-200 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Pontos de atenção:</span>
                  </div>
                  <ul className="list-disc pl-5 space-y-0.5">
                    {previewData.warnings.map((w: string, i: number) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Espelho Visual da Nota */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300">
                    Pré-visualização para conferência ({docType} — Sem Valor Fiscal)
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowRawJson((prev) => !prev)}
                    className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-white cursor-pointer"
                  >
                    <Code2 className="w-3.5 h-3.5" />
                    <span>{showRawJson ? 'Ocultar JSON técnico' : 'Ver JSON técnico'}</span>
                  </button>
                </div>

                <FiscalPreviewSheet
                  docType={docType}
                  emitter={previewData.emitter}
                  payload={activeDraft?.payload}
                  serviceOrder={previewData.serviceOrder}
                />

                {showRawJson && (
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                    <pre className="text-[11px] text-slate-300 overflow-x-auto max-h-52">
                      {JSON.stringify(activeDraft?.payload, null, 2)}
                    </pre>
                  </div>
                )}
              </div>

              {/* Aceite + Botões de Emissão Individual ou Ambas */}
              <div className="pt-3 border-t border-slate-800 space-y-4">
                <label
                  className={`flex items-start gap-2.5 text-xs select-none ${
                    canAuthorizeTransmission
                      ? 'text-slate-200 cursor-pointer'
                      : 'text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <input
                    type="checkbox"
                    disabled={!canAuthorizeTransmission}
                    checked={canAuthorizeTransmission && confirmedReview}
                    onChange={(e) => setConfirmedReview(e.target.checked)}
                    className="mt-0.5 rounded border-slate-600 bg-slate-950 text-blue-600 focus:ring-blue-500"
                  />
                  <span>
                    Conferi os dados da pré-visualização acima e autorizo a transmissão fiscal desta
                    OS.
                  </span>
                </label>

                {canEmitBoth && !fiscalBlocked && !canAffordBoth && (
                  <p className="text-[11px] text-amber-300">
                    Resta apenas {remainingInvoices} nota na sua cota mensal — emita uma nota por
                    vez ou faça upgrade para emitir ambas juntas.
                  </p>
                )}

                <div className="flex flex-wrap items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold cursor-pointer"
                  >
                    Fechar
                  </button>

                  {canEmitBoth && (
                    <button
                      type="button"
                      disabled={
                        fiscalBlocked ||
                        !canAffordBoth ||
                        emitting ||
                        emittingBoth ||
                        !confirmedReview
                      }
                      onClick={handleEmitBoth}
                      className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold flex items-center gap-2 cursor-pointer"
                    >
                      <Layers className="w-4 h-4" />
                      <span>
                        {emittingBoth
                          ? 'Emitindo ambas...'
                          : `Emitir Ambas (${partsPreference} + NFS-e)`}
                      </span>
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={
                      fiscalBlocked ||
                      emitting ||
                      emittingBoth ||
                      !canEmitCurrent ||
                      !confirmedReview
                    }
                    onClick={handleEmitSingle}
                    className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold flex items-center gap-2 cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                    <span>
                      {emitting
                        ? 'Transmitindo...'
                        : `Emitir somente ${docType} (${previewData.ambiente})`}
                    </span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}