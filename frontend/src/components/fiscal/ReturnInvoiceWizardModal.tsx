import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  Undo2,
  Upload,
  FileCode2,
  ArrowRight,
  ArrowLeft,
  Send,
  CheckCircle2,
  AlertTriangle,
  Code2,
  PackageMinus,
} from 'lucide-react';
import { api } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import FiscalPreviewSheet from './FiscalPreviewSheet';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialInboundId?: string | null;
  onSuccess?: () => void;
}

const fmtMoney = (v: number) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const QUICK_REASONS = [
  'Peça enviada incorreta pelo fornecedor',
  'Peça apresentou defeito de fabricação',
  'Aplicação incompatível com o veículo do cliente',
  'Embalagem violada ou avaria no transporte',
];

export default function ReturnInvoiceWizardModal({
  isOpen,
  onClose,
  initialInboundId,
  onSuccess,
}: Props) {
  const { showToast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loadingList, setLoadingList] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [emitting, setEmitting] = useState(false);
  const [checkingPdf, setCheckingPdf] = useState(false);

  const [inboundList, setInboundList] = useState<any[]>([]);
  const [prepared, setPrepared] = useState<any>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [reason, setReason] = useState('Peça enviada incorreta pelo fornecedor');
  const [deductFromStock, setDeductFromStock] = useState(true);
  const [createSupplierCredit, setCreateSupplierCredit] = useState(false);

  // Chave de idempotência estável por tentativa de devolução (evita duplicidade se a rede oscilar)
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [previewData, setPreviewData] = useState<any>(null);
  const [showRawJson, setShowRawJson] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [emittedResult, setEmittedResult] = useState<any>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  const resetWizard = () => {
    setStep(1);
    setPrepared(null);
    setRows([]);
    setPreviewData(null);
    setConfirmed(false);
    setShowRawJson(false);
    setEmittedResult(null);
    setPdfUrl(null);
    setIdempotencyKey(`k${Date.now()}`);
  };

  const loadPreparedSource = async (params: { inboundInvoiceId?: string; xmlContent?: string }) => {
    setPreparing(true);
    try {
      const { data } = await api.post('/fiscal/returns/prepare', params);
      setPrepared(data);
      setRows(
        (data.items || []).map((item: any) => ({
          ...item,
          selected: true,
          returnQty: item.quantity,
          catalogItemId: item.matchedCatalogItemId || null,
          cfopDevolucao: item.cfopDevolucao,
        })),
      );
      setIdempotencyKey(`k${Date.now()}`);
      setStep(2);
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Erro ao preparar nota para devolução.', 'error');
    } finally {
      setPreparing(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    resetWizard();

    if (initialInboundId) {
      loadPreparedSource({ inboundInvoiceId: initialInboundId });
      return;
    }

    setLoadingList(true);
    api
      .get('/fiscal/returns/inbound-list')
      .then((res) => setInboundList(Array.isArray(res.data) ? res.data : []))
      .catch(() => setInboundList([]))
      .finally(() => setLoadingList(false));
  }, [isOpen, initialInboundId]);

  if (!isOpen) return null;

  const handleUploadXml = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      await loadPreparedSource({ xmlContent: text });
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const updateRow = (idx: number, patch: Record<string, any>) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const selectedRows = rows.filter((r) => r.selected && Number(r.returnQty) > 0);
  const selectedTotal = selectedRows.reduce(
    (acc, r) => acc + Number(r.returnQty || 0) * Number(r.unitCost || 0),
    0,
  );

  const buildRequestDto = () => ({
    inboundInvoiceId: prepared?.inboundInvoiceId || undefined,
    xmlContent: prepared?.inboundInvoiceId ? undefined : prepared?.xmlContent,
    reason,
    deductFromStock,
    createSupplierCredit,
    idempotencyKey,
    items: rows.map((r) => ({
      index: r.index,
      selected: Boolean(r.selected),
      returnQty: Number(r.returnQty || 0),
      catalogItemId: r.catalogItemId || null,
      cfopDevolucao: r.cfopDevolucao,
    })),
  });

  const handleGoToPreview = async () => {
    if (selectedRows.length === 0) {
      showToast('Marque pelo menos 1 peça para devolver.', 'error');
      return;
    }
    if (reason.trim().length < 5) {
      showToast('Informe o motivo da devolução.', 'error');
      return;
    }

    setLoadingPreview(true);
    setConfirmed(false);
    setEmittedResult(null);
    setPdfUrl(null);
    try {
      const { data } = await api.post('/fiscal/returns/preview', buildRequestDto());
      setPreviewData(data);
      setStep(3);
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Erro ao montar prévia da devolução.', 'error');
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleEmitReturn = async () => {
    if (!previewData?.canEmit || !confirmed) return;
    setEmitting(true);
    try {
      const { data } = await api.post('/fiscal/returns/emit', buildRequestDto());
      setEmittedResult(data);
      showToast(
        data.reused
          ? 'Tentativa anterior recuperada com segurança (sem duplicidade).'
          : `NF-e de Devolução enviada! ${
              data.stockDeductedCount > 0 ? `${data.stockDeductedCount} peça(s) abatida(s) do estoque.` : ''
            }`,
        'success',
      );
      onSuccess?.();
    } catch (err: any) {
      const apiData = err.response?.data;
      const detailed =
        apiData?.errors && typeof apiData.errors === 'object'
          ? Object.entries(apiData.errors)
              .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
              .join(' | ')
          : null;
      showToast(detailed || apiData?.message || 'Erro ao emitir NF-e de Devolução.', 'error');
    } finally {
      setEmitting(false);
    }
  };

  const handleSyncAndOpenPdf = async (invoiceId: string) => {
    setCheckingPdf(true);
    try {
      const { data } = await api.get(`/fiscal/invoices/${invoiceId}/sync-pdf`);
      setEmittedResult((prev: any) => ({ ...prev, invoice: data }));

      if (data.pdfBase64) {
        const clean = data.pdfBase64.replace(/^data:application\/pdf;base64,/, '').replace(/\s+/g, '');
        const bytes = atob(clean);
        const arr = new Uint8Array(bytes.length);
        for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
        const blobUrl = URL.createObjectURL(new Blob([arr], { type: 'application/pdf' }));
        setPdfUrl(blobUrl);
        window.open(blobUrl, '_blank', 'noopener,noreferrer');
      } else if (data.status === 'REJEITADA') {
        showToast(`Nota rejeitada: ${data.motivoRejeicao || 'Verifique os detalhes.'}`, 'error');
      } else {
        showToast('DANFE ainda em processamento. Clique novamente em alguns segundos.', 'info');
      }
    } catch {
      showToast('Erro ao consultar DANFE da devolução.', 'error');
    } finally {
      setCheckingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl max-h-[92vh] overflow-y-auto text-white shadow-2xl">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 sticky top-0 bg-slate-900 z-20">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-600/20 border border-purple-500/40">
              <Undo2 className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h2 className="font-bold text-base">Assistente Rápido de Nota de Devolução (NF-e)</h2>
              <p className="text-xs text-slate-400">
                Passo {step} de 3 —{' '}
                {step === 1
                  ? 'Escolha a Nota de Compra ou suba o XML da autopeças'
                  : step === 2
                  ? 'Marque as peças devolvidas e informe o motivo'
                  : 'Conferência do Pré-DANFE e Transmissão'}
              </p>
            </div>
          </div>

          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 text-xs">
          {/* PASSO 1: SELECIONAR NOTA IMPORTADA OU UPLOAD DE XML */}
          {step === 1 && (
            <div className="space-y-5">
              {/* Upload direto de XML */}
              <div className="bg-slate-950 border-2 border-dashed border-purple-500/40 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Upload className="w-8 h-8 text-purple-400 shrink-0" />
                  <div>
                    <div className="font-bold text-sm text-white">
                      Subir XML da Autopeças na hora (sem precisar importar antes)
                    </div>
                    <p className="text-slate-400 mt-0.5">
                      Lemos fornecedor, chave de 44 dígitos, CFOPs e impostos automaticamente.
                    </p>
                  </div>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xml,text/xml,application/xml"
                  onChange={handleUploadXml}
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={preparing}
                  onClick={() => fileRef.current?.click()}
                  className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold shrink-0 cursor-pointer"
                >
                  {preparing ? 'Lendo XML...' : 'Selecionar Arquivo .XML'}
                </button>
              </div>

              {/* Lista de Notas de Compra já importadas na Sprint 3 */}
              <div className="space-y-2.5">
                <div className="font-bold text-slate-300 uppercase tracking-wider text-[11px]">
                  Ou selecione uma Nota de Compra já importada ({inboundList.length})
                </div>

                {loadingList ? (
                  <p className="text-slate-400 py-8 text-center">Carregando notas de compra...</p>
                ) : inboundList.length === 0 ? (
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 text-center text-slate-400">
                    Nenhuma nota de compra importada ainda. Use o botão acima para subir o XML da autopeças.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
                    {inboundList.map((inb) => (
                      <div
                        key={inb.id}
                        className="p-3.5 flex flex-wrap items-center justify-between gap-3 hover:bg-slate-900/70 transition"
                      >
                        <div>
                          <div className="font-bold text-white flex items-center gap-2">
                            <FileCode2 className="w-4 h-4 text-blue-400" />
                            <span>
                              NF-e Nº {inb.numero} (Série {inb.serie}) — {inb.supplierName}
                            </span>
                            {inb.returnsCount > 0 && (
                              <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[10px]">
                                {inb.returnsCount} devolução(ões) anterior(es)
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            CNPJ: {inb.supplierCnpj} • Emissão:{' '}
                            {new Date(inb.dataEmissao).toLocaleDateString('pt-BR')} • Total:{' '}
                            <strong className="text-emerald-300">{fmtMoney(inb.valorTotal)}</strong>
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={preparing}
                          onClick={() => loadPreparedSource({ inboundInvoiceId: inb.id })}
                          className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <span>Selecionar</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* PASSO 2: SELECIONAR PEÇAS, QUANTIDADES E MOTIVO */}
          {step === 2 && prepared && (
            <div className="space-y-5">
              {/* Resumo da Nota de Origem e Fornecedor */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] uppercase font-bold text-purple-400">
                    Destinatário da Devolução (Fornecedor / Autopeças)
                  </div>
                  <div className="text-sm font-bold text-white mt-0.5">{prepared.supplier.name}</div>
                  <div className="text-slate-400">
                    CNPJ: {prepared.supplier.cnpj} • IE: {prepared.supplier.ie || '—'} •{' '}
                    {prepared.supplier.cidade}/{prepared.supplier.uf}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase text-slate-400">Nota Referenciada (NFref)</div>
                  <div className="font-bold text-white">
                    NF-e Nº {prepared.originalInvoice.numero} • Série {prepared.originalInvoice.serie} (
                    {prepared.originalInvoice.dataEmissaoBr})
                  </div>
                  <div className="font-mono text-[10px] text-slate-400">
                    {prepared.originalInvoice.chaveAcesso}
                  </div>
                </div>
              </div>

              {/* Tabela de Peças */}
              <div className="border border-slate-800 rounded-xl overflow-x-auto bg-slate-950">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-900 border-b border-slate-800 text-[10px] uppercase text-slate-400">
                      <th className="p-3">Dev.</th>
                      <th className="p-3">Peça / Estoque</th>
                      <th className="p-3">CFOP Invertido</th>
                      <th className="p-3 text-center">Qtd Compra</th>
                      <th className="p-3 text-center">Qtd Devolver</th>
                      <th className="p-3 text-right">Subtotal Dev.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {rows.map((row, idx) => {
                      const ratio = row.quantity > 0 ? Number(row.returnQty || 0) / row.quantity : 0;
                      const propIcms = Number(row.icmsValor || 0) * ratio;
                      const propSt = Number(row.icmsStValor || 0) * ratio;
                      const propIpi = Number(row.ipiValor || 0) * ratio;

                      return (
                        <tr key={row.index} className={!row.selected ? 'opacity-40' : ''}>
                          <td className="p-3">
                            <input
                              type="checkbox"
                              checked={row.selected}
                              onChange={(e) => updateRow(idx, { selected: e.target.checked })}
                            />
                          </td>
                          <td className="p-3">
                            <div className="font-bold text-white">{row.name}</div>
                            <div className="text-[10px] text-slate-400">
                              Cód.: {row.codigoFornecedor} • NCM: {row.ncm} • Un.: {row.unidadeMedida}
                              {row.matchedCatalogItemId && (
                                <span className="ml-2 text-emerald-400 font-semibold">
                                  • Em estoque: {row.currentStock} un
                                </span>
                              )}
                            </div>
                            {(propIcms > 0 || propSt > 0 || propIpi > 0) && row.selected && (
                              <div className="text-[10px] text-purple-300 mt-0.5">
                                Impostos proporcionais:
                                {propIcms > 0 ? ` ICMS ${fmtMoney(propIcms)}` : ''}
                                {propSt > 0 ? ` • ST ${fmtMoney(propSt)}` : ''}
                                {propIpi > 0 ? ` • IPI ${fmtMoney(propIpi)}` : ''}
                              </div>
                            )}
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            <span className="text-slate-400 line-through mr-1.5">{row.cfop}</span>
                            <span className="text-slate-500 mr-1.5">→</span>
                            <input
                              maxLength={4}
                              value={row.cfopDevolucao}
                              onChange={(e) =>
                                updateRow(idx, { cfopDevolucao: e.target.value.replace(/\D/g, '') })
                              }
                              className="w-16 px-2 py-1 rounded bg-slate-900 border border-purple-500/50 font-mono font-bold text-purple-300 text-center"
                            />
                          </td>
                          <td className="p-3 text-center text-slate-400">{row.quantity}</td>
                          <td className="p-3 text-center">
                            <input
                              type="number"
                              min={1}
                              max={row.quantity}
                              step="1"
                              disabled={!row.selected}
                              value={row.returnQty}
                              onChange={(e) => {
                                const v = Math.min(row.quantity, Math.max(0, Number(e.target.value)));
                                updateRow(idx, { returnQty: v });
                              }}
                              className="w-20 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-center font-bold text-white"
                            />
                          </td>
                          <td className="p-3 text-right font-bold text-emerald-300 whitespace-nowrap">
                            {row.selected ? fmtMoney(Number(row.returnQty || 0) * Number(row.unitCost || 0)) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Motivo + Opções de Estoque e Financeiro */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                <div>
                  <label className="font-bold text-slate-300 block mb-1.5">
                    Motivo da Devolução (vai automático nas Informações Complementares da NF-e) *
                  </label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {QUICK_REASONS.map((qr) => (
                      <button
                        key={qr}
                        type="button"
                        onClick={() => setReason(qr)}
                        className={`px-2.5 py-1 rounded-lg border text-[11px] cursor-pointer transition ${
                          reason === qr
                            ? 'bg-purple-600/30 border-purple-500 text-white font-semibold'
                            : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                        }`}
                      >
                        {qr}
                      </button>
                    ))}
                  </div>
                  <input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Descreva o motivo da devolução..."
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-800">
                  <div className="flex flex-wrap gap-5">
                    <label className="inline-flex items-center gap-2 text-slate-200 cursor-pointer font-semibold">
                      <input
                        type="checkbox"
                        checked={deductFromStock}
                        onChange={(e) => setDeductFromStock(e.target.checked)}
                      />
                      <PackageMinus className="w-4 h-4 text-amber-400" />
                      <span>Abater quantidade devolvida do estoque atual</span>
                    </label>

                    <label className="inline-flex items-center gap-2 text-slate-200 cursor-pointer font-semibold">
                      <input
                        type="checkbox"
                        checked={createSupplierCredit}
                        onChange={(e) => setCreateSupplierCredit(e.target.checked)}
                      />
                      <span>Lançar crédito com fornecedor no Financeiro</span>
                    </label>
                  </div>

                  <div className="text-right">
                    <span className="text-slate-400 block text-[10px] uppercase">Total a Devolver</span>
                    <strong className="text-lg text-emerald-400">{fmtMoney(selectedTotal)}</strong>
                  </div>
                </div>
              </div>

              {/* Botões Passo 2 */}
              <div className="flex justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Trocar Nota</span>
                </button>

                <button
                  type="button"
                  disabled={loadingPreview || selectedRows.length === 0}
                  onClick={handleGoToPreview}
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-bold inline-flex items-center gap-2 cursor-pointer"
                >
                  <span>{loadingPreview ? 'Montando Prévia...' : 'Visualizar Pré-DANFE de Devolução'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* PASSO 3: PRÉVIA DO DANFE DE DEVOLUÇÃO + TRANSMISSÃO */}
          {step === 3 && previewData && (
            <div className="space-y-4">
              {previewData.errors?.length > 0 && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3.5 text-red-200 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-red-300">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Corrija antes de transmitir:</span>
                  </div>
                  <ul className="list-disc pl-5">
                    {previewData.errors.map((e: string, i: number) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-300">
                  Espelho da NF-e de Devolução (Ambiente:{' '}
                  <strong className="uppercase text-amber-400">{previewData.ambiente}</strong>)
                </span>
                <button
                  type="button"
                  onClick={() => setShowRawJson((p) => !p)}
                  className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-white cursor-pointer"
                >
                  <Code2 className="w-3.5 h-3.5" />
                  <span>{showRawJson ? 'Ocultar JSON técnico' : 'Ver JSON técnico'}</span>
                </button>
              </div>

              <FiscalPreviewSheet
                docType="NFE"
                emitter={previewData.emitter}
                payload={previewData.payload}
                serviceOrder={{ number: `DEV-${previewData.originalInvoice.numero}` }}
              />

              {showRawJson && (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                  <pre className="text-[11px] text-slate-300 overflow-x-auto max-h-52">
                    {JSON.stringify(previewData.payload, null, 2)}
                  </pre>
                </div>
              )}

              {/* Retorno após transmissão */}
              {emittedResult && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 text-emerald-200 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                      <div>
                        <div className="font-bold text-sm">
                          NF-e de Devolução registrada • Status:{' '}
                          <span className="uppercase">{emittedResult.invoice?.status}</span>
                        </div>
                        <div>
                          Protocolo: {emittedResult.invoice?.protocolo || '—'}
                          {emittedResult.invoice?.numero ? ` • Nº ${emittedResult.invoice.numero}` : ''}
                        </div>
                        {emittedResult.invoice?.motivoRejeicao && (
                          <div className="text-red-300 mt-1">{emittedResult.invoice.motivoRejeicao}</div>
                        )}
                      </div>
                    </div>

                    {emittedResult.invoice?.id && (
                      <button
                        type="button"
                        disabled={checkingPdf}
                        onClick={() => handleSyncAndOpenPdf(emittedResult.invoice.id)}
                        className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer"
                      >
                        {checkingPdf ? 'Consultando...' : 'Atualizar Status / Ver DANFE'}
                      </button>
                    )}
                  </div>

                  {pdfUrl && (
                    <a
                      href={pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline font-semibold text-emerald-300 block"
                    >
                      Abrir DANFE de Devolução em nova guia
                    </a>
                  )}
                </div>
              )}

              {/* Aceite + Botão de Emitir */}
              <div className="pt-3 border-t border-slate-800 space-y-4">
                {!emittedResult && (
                  <label className="flex items-start gap-2.5 text-slate-200 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      disabled={!previewData.canEmit}
                      checked={confirmed}
                      onChange={(e) => setConfirmed(e.target.checked)}
                      className="mt-0.5"
                    />
                    <span>
                      Conferi o fornecedor destinatário, a chave referenciada, os CFOPs invertidos e
                      as quantidades devolvidas e autorizo a emissão da <strong>NF-e de Devolução</strong>.
                    </span>
                  </label>
                )}

                <div className="flex justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Voltar e Ajustar</span>
                  </button>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 font-semibold cursor-pointer"
                    >
                      Fechar
                    </button>

                    {!emittedResult && (
                      <button
                        type="button"
                        disabled={emitting || !previewData.canEmit || !confirmed}
                        onClick={handleEmitReturn}
                        className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold inline-flex items-center gap-2 cursor-pointer"
                      >
                        <Send className="w-4 h-4" />
                        <span>
                          {emitting
                            ? 'Transmitindo Devolução...'
                            : `Emitir NF-e de Devolução (${previewData.ambiente})`}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}