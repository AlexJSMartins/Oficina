import React, { useRef, useState } from 'react';
import {
  X,
  Upload,
  Truck,
  CheckCircle2,
  PlusCircle,
  AlertTriangle,
  PackageCheck,
} from 'lucide-react';
import { api } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onImported?: () => void;
}

const fmtMoney = (v: number) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function InboundXmlImportModal({ isOpen, onClose, onImported }: Props) {
  const { showToast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [parsing, setParsing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [rawXml, setRawXml] = useState('');
  const [parsedData, setParsedData] = useState<any>(null);

  // Switches globais
  const [linkSupplierToParts, setLinkSupplierToParts] = useState(true);
  const [addToStock, setAddToStock] = useState(true);
  const [createFinancialExpense, setCreateFinancialExpense] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'BOLETO' | 'PIX' | 'CREDIT_CARD' | 'TRANSFER'>('BOLETO');

  // Itens editáveis na tela de revisão
  const [reviewItems, setReviewItems] = useState<any[]>([]);

  if (!isOpen) return null;

  const resetState = () => {
    setRawXml('');
    setParsedData(null);
    setReviewItems([]);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleXmlUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setParsing(true);
    try {
      const text = await file.text();
      setRawXml(text);

      const { data } = await api.post('/fiscal/inbound/parse-xml', { xmlContent: text });
      setParsedData(data);
      setReviewItems(
        (data.items || []).map((item: any) => ({
          importItem: true,
          action: item.suggestedAction,
          catalogItemId: item.matchedCatalogItemId || '',
          code: item.codigoFornecedor,
          codigoFornecedor: item.codigoFornecedor,
          ean: item.ean,
          name: item.name,
          ncm: item.ncm,
          cest: item.cest,
          cfopEntrada: item.cfop,
          unidadeMedida: item.unidadeMedida,
          quantity: item.quantity,
          unitCost: item.unitCost,
          salePrice: item.suggestedSalePrice,
          matchReason: item.matchReason,
          matchedCurrentStock: item.matchedCurrentStock,
        })),
      );
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Erro ao ler o arquivo XML da nota.', 'error');
      resetState();
    } finally {
      setParsing(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const updateRow = (idx: number, patch: Record<string, any>) => {
    setReviewItems((prev) => prev.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  };

  const handleConfirmImport = async () => {
    if (!parsedData) return;
    setConfirming(true);
    try {
      const { data } = await api.post('/fiscal/inbound/confirm-import', {
        xmlContent: rawXml,
        chaveAcesso: parsedData.invoice.chaveAcesso,
        numero: parsedData.invoice.numero,
        serie: parsedData.invoice.serie,
        dataEmissao: parsedData.invoice.dataEmissao,
        valorTotal: parsedData.invoice.valorTotal,
        supplier: parsedData.supplier,
        linkSupplierToParts,
        addToStock,
        createFinancialExpense,
        paymentMethod,
        items: reviewItems,
      });

      showToast(
        `Importação concluída! ${data.createdPartsCount} peça(s) criada(s), ${data.updatedPartsCount} atualizada(s).`,
        'success',
      );
      onImported?.();
      handleClose();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Erro ao confirmar entrada da nota.', 'error');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[92vh] overflow-y-auto shadow-2xl text-xs">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <PackageCheck className="w-5 h-5 text-blue-600" />
              <span>Importar Nota de Compra (XML da Autopeças)</span>
            </h2>
            <p className="text-slate-500">
              Identifica/cadastra o fornecedor automaticamente, dá entrada no estoque com NCM/CFOP e salva a base para devoluções.
            </p>
          </div>
          <button type="button" onClick={handleClose} className="text-slate-400 hover:text-slate-700 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Passo 1: Upload do XML */}
          {!parsedData ? (
            <div className="border-2 border-dashed border-slate-300 rounded-2xl p-10 text-center space-y-3 bg-slate-50">
              <Upload className="w-10 h-10 text-blue-600 mx-auto" />
              <div className="font-bold text-sm text-slate-800">
                Selecione o arquivo .XML da NF-e enviada pela autopeças
              </div>
              <p className="text-slate-500 max-w-md mx-auto">
                Lemos automaticamente o fornecedor, chave de acesso (44 dígitos), peças, quantidades, custos unitários, NCM e impostos.
              </p>
              <input
                ref={fileRef}
                type="file"
                accept=".xml,text/xml,application/xml"
                onChange={handleXmlUpload}
                className="hidden"
              />
              <button
                type="button"
                disabled={parsing}
                onClick={() => fileRef.current?.click()}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer"
              >
                {parsing ? 'Lendo XML...' : 'Selecionar Arquivo XML'}
              </button>
            </div>
          ) : (
            <>
              {/* Alerta de nota já importada */}
              {parsedData.alreadyImported && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 text-red-800 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 shrink-0 text-red-600" />
                  <span>
                    <strong>Atenção:</strong> Esta NF-e (Chave {parsedData.invoice.chaveAcesso}) já foi importada anteriormente no sistema.
                  </span>
                </div>
              )}

              {/* Card do Fornecedor Identificado */}
              <div className="bg-slate-900 text-white rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-xl bg-blue-600/20 border border-blue-500/30">
                    <Truck className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <strong className="text-sm">{parsedData.supplier.name}</strong>
                      {parsedData.supplier.status === 'EXISTING' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                          <CheckCircle2 className="w-3 h-3" /> Fornecedor já cadastrado (Vinculado)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/25 text-blue-200 text-[10px] font-bold">
                          <PlusCircle className="w-3 h-3" /> Novo Fornecedor (Será cadastrado automaticamente)
                        </span>
                      )}
                    </div>
                    <div className="text-slate-300 mt-1">
                      CNPJ: <strong>{parsedData.supplier.cnpj}</strong> • IE: {parsedData.supplier.ie || '—'} •{' '}
                      {parsedData.supplier.cidade}/{parsedData.supplier.uf}
                    </div>
                    <div className="text-slate-400 text-[11px] mt-0.5">
                      NF-e Nº <strong>{parsedData.invoice.numero}</strong> (Série {parsedData.invoice.serie}) • Total:{' '}
                      <strong className="text-emerald-300">{fmtMoney(parsedData.invoice.valorTotal)}</strong>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={resetState}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold cursor-pointer"
                >
                  Trocar XML
                </button>
              </div>

              {/* Switches de comportamento */}
              <div className="bg-slate-50 border rounded-xl p-3.5 flex flex-wrap items-center gap-5">
                <label className="inline-flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={linkSupplierToParts}
                    onChange={(e) => setLinkSupplierToParts(e.target.checked)}
                  />
                  <span>Cadastrar/Vincular Fornecedor às peças</span>
                </label>

                <label className="inline-flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={addToStock}
                    onChange={(e) => setAddToStock(e.target.checked)}
                  />
                  <span>Adicionar ao estoque automaticamente</span>
                </label>

                <label className="inline-flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={createFinancialExpense}
                    onChange={(e) => setCreateFinancialExpense(e.target.checked)}
                  />
                  <span>Lançar despesa no Financeiro</span>
                </label>

                {createFinancialExpense && (
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    className="px-2.5 py-1 border rounded-lg bg-white"
                  >
                    <option value="BOLETO">Boleto</option>
                    <option value="PIX">PIX</option>
                    <option value="CREDIT_CARD">Cartão Crédito</option>
                    <option value="TRANSFER">Transferência</option>
                  </select>
                )}
              </div>

              {/* Tabela de Revisão dos Itens */}
              <div className="border rounded-xl overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b text-[10px] uppercase text-slate-500">
                      <th className="p-2.5">Imp.</th>
                      <th className="p-2.5">Peça no XML (NCM / Cód.)</th>
                      <th className="p-2.5">Ação no Estoque</th>
                      <th className="p-2.5 text-center">Qtd</th>
                      <th className="p-2.5 text-right">Custo Un.</th>
                      <th className="p-2.5 text-right">Venda Sugerida</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {reviewItems.map((row, idx) => (
                      <tr key={idx} className={!row.importItem ? 'opacity-45 bg-slate-50' : ''}>
                        <td className="p-2.5">
                          <input
                            type="checkbox"
                            checked={row.importItem}
                            onChange={(e) => updateRow(idx, { importItem: e.target.checked })}
                          />
                        </td>

                        <td className="p-2.5">
                          <input
                            value={row.name}
                            onChange={(e) => updateRow(idx, { name: e.target.value })}
                            className="w-full font-bold text-slate-900 border border-transparent hover:border-slate-300 focus:border-blue-500 rounded px-1.5 py-0.5"
                          />
                          <div className="text-[10px] text-slate-500 px-1.5">
                            Cód. Forn.: <strong>{row.codigoFornecedor}</strong> • NCM: {row.ncm} • Un: {row.unidadeMedida}
                            {row.matchReason && (
                              <span className="ml-2 text-emerald-700 font-semibold">
                                • Vínculo sugerido ({row.matchReason})
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="p-2.5 min-w-[230px]">
                          <select
                            value={row.action === 'LINK' ? row.catalogItemId : '__CREATE__'}
                            onChange={(e) => {
                              if (e.target.value === '__CREATE__') {
                                updateRow(idx, { action: 'CREATE', catalogItemId: '' });
                              } else {
                                updateRow(idx, { action: 'LINK', catalogItemId: e.target.value });
                              }
                            }}
                            className="w-full px-2 py-1.5 border rounded-lg bg-white text-[11px]"
                          >
                            <option value="__CREATE__">➕ Criar nova peça no estoque</option>
                            {(parsedData.catalogOptions || []).map((opt: any) => (
                              <option key={opt.id} value={opt.id}>
                                🔗 Vincular: {opt.name} (Saldo: {opt.stock})
                              </option>
                            ))}
                          </select>
                        </td>

                        <td className="p-2.5 text-center font-bold">
                          {row.quantity}
                        </td>

                        <td className="p-2.5 text-right font-semibold text-slate-700 whitespace-nowrap">
                          {fmtMoney(row.unitCost)}
                        </td>

                        <td className="p-2.5 text-right">
                          <input
                            type="number"
                            step="0.01"
                            value={row.salePrice}
                            onChange={(e) => updateRow(idx, { salePrice: Number(e.target.value) })}
                            className="w-24 text-right px-2 py-1 border rounded-lg font-bold text-blue-700"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Rodapé */}
              <div className="flex justify-end gap-3 pt-2 border-t">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={confirming || parsedData.alreadyImported}
                  onClick={handleConfirmImport}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold cursor-pointer"
                >
                  {confirming
                    ? 'Processando entrada...'
                    : `Confirmar Importação (${reviewItems.filter((r) => r.importItem).length} itens)`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}