import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { api } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Download } from 'lucide-react';

interface BulkImportFinancialModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const FINANCIAL_FIELDS = [
  {
    key: 'description',
    label: 'Descrição / Histórico do Custo *',
    synonyms: ['descricao', 'descrição', 'historico', 'histórico', 'lancamento', 'lançamento', 'despesa', 'item', 'fornecedor', 'nome'],
  },
  {
    key: 'amount',
    label: 'Valor (R$) *',
    synonyms: ['valor', 'quantia', 'total', 'preco', 'preço', 'custo', 'pago', 'amount', 'r$'],
  },
  {
    key: 'date',
    label: 'Data do Lançamento',
    synonyms: ['data', 'vencimento', 'pagamento', 'dia', 'date', 'realizado em'],
  },
  {
    key: 'category',
    label: 'Categoria (Peças, Aluguel, Luz, Salário...)',
    synonyms: ['categoria', 'grupo', 'classificacao', 'classificação', 'centro de custo', 'setor'],
  },
  {
    key: 'type',
    label: 'Tipo (Saída/Despesa ou Entrada)',
    synonyms: ['tipo', 'natureza', 'operacao', 'operação', 'entrada/saida', 'fluxo'],
  },
  {
    key: 'paymentMethod',
    label: 'Meio de Pagamento (PIX, Boleto, Cartão...)',
    synonyms: ['forma', 'meio', 'pagamento', 'forma de pagamento', 'metodo', 'método', 'banco'],
  },
] as const;

export default function BulkImportFinancialModal({
  onClose,
  onSuccess,
}: BulkImportFinancialModalProps) {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, any>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [defaultType, setDefaultType] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');
  const [importing, setImporting] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const workbook = XLSX.read(bstr, { type: 'binary' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];

      const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });
      if (jsonData.length === 0) {
        showToast('A planilha selecionada está vazia.', 'error');
        return;
      }

      const detectedHeaders = Object.keys(jsonData[0]);
      setHeaders(detectedHeaders);
      setRawRows(jsonData);

      const normalize = (s: string) =>
        s
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .trim();

      const autoMap: Record<string, string> = {};
      for (const field of FINANCIAL_FIELDS) {
        const matchedHeader = detectedHeaders.find((h) => {
          const normH = normalize(h);
          return field.synonyms.some(
            (syn) => normH === normalize(syn) || normH.includes(normalize(syn)),
          );
        });
        if (matchedHeader) {
          autoMap[field.key] = matchedHeader;
        }
      }
      setMapping(autoMap);
    };
    reader.readAsBinaryString(file);
  };

  const handleDownloadTemplate = () => {
    const sample = [
      {
        Data: '05/11/2026',
        Descricao: 'Aluguel do Galpão da Oficina',
        Categoria: 'Aluguel',
        Tipo: 'Saída',
        Valor: '3500,00',
        Pagamento: 'Boleto',
      },
      {
        Data: '08/11/2026',
        Descricao: 'Compra de Lote de Óleo 5W30 e Filtros - Auto Peças',
        Categoria: 'Peças',
        Tipo: 'Saída',
        Valor: '1850,50',
        Pagamento: 'PIX',
      },
      {
        Data: '10/11/2026',
        Descricao: 'Conta de Energia Elétrica CPFL',
        Categoria: 'Luz / Água',
        Tipo: 'Saída',
        Valor: '640,00',
        Pagamento: 'PIX',
      },
      {
        Data: '15/11/2026',
        Descricao: 'Adiantamento Quinzenal Mecânicos',
        Categoria: 'Salários',
        Tipo: 'Saída',
        Valor: '2400,00',
        Pagamento: 'Transferência',
      },
    ];
    const ws = XLSX.utils.json_to_sheet(sample);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Custos_Oficina');
    XLSX.writeFile(wb, 'Modelo_Custos_Financeiro_OficinaPro.xlsx');
  };

  const handleConfirmImport = async () => {
    if (!mapping.description || !mapping.amount) {
      showToast('Vincule pelo menos as colunas de Descrição e Valor.', 'error');
      return;
    }

    setImporting(true);
    try {
      const formattedRows = rawRows.map((row) => {
        const item: Record<string, any> = {};
        for (const field of FINANCIAL_FIELDS) {
          const excelCol = mapping[field.key];
          if (excelCol && row[excelCol] !== undefined) {
            item[field.key] = row[excelCol];
          }
        }
        if (!item.type) {
          item.type = defaultType === 'EXPENSE' ? 'Saída' : 'Entrada';
        }
        return item;
      });

      const { data } = await api.post('/financial/bulk-import', { rows: formattedRows });
      showToast(
        `Importação concluída! ${data.stats.importedCount} lançamentos registrados no DRE.`,
        'success',
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Erro ao importar planilha de custos.', 'error');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-4xl w-full p-6 space-y-5 shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b pb-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
              Importar Planilha de Custos, Despesas e Lançamentos (Excel / CSV)
            </h2>
            <p className="text-xs text-slate-500">
              Suba a planilha de controle da oficina. O sistema identifica categorias (Peças, Aluguel, Luz, Salários) e atualiza o DRE.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 font-bold text-lg">
            ✕
          </button>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
          <div className="text-xs text-slate-600 space-y-1">
            <p className="font-bold text-slate-800">
              Suporta arquivos .xlsx, .xls e .csv com qualquer nome de coluna
            </p>
            <p>
              Se a planilha não tiver coluna de "Tipo", defina ao lado se os itens são Custos/Saídas ou Entradas.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <select
              value={defaultType}
              onChange={(e) => setDefaultType(e.target.value as 'EXPENSE' | 'INCOME')}
              className="px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold bg-white text-slate-700"
            >
              <option value="EXPENSE">Padrão: Custos / Despesas (Saída)</option>
              <option value="INCOME">Padrão: Receitas (Entrada)</option>
            </select>

            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" /> Baixar Modelo
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm"
            >
              <Upload className="w-3.5 h-3.5" /> Escolher Planilha
            </button>
          </div>
        </div>

        {headers.length > 0 && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl flex items-center gap-2 text-xs text-blue-900">
              <AlertCircle className="w-4 h-4 text-blue-600 shrink-0" />
              <span>
                Encontramos <strong>{rawRows.length} lançamentos</strong> na planilha. Confira o vínculo das colunas abaixo:
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border">
              {FINANCIAL_FIELDS.map((field) => (
                <div key={field.key}>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {field.label}
                  </label>
                  <select
                    value={mapping[field.key] || ''}
                    onChange={(e) =>
                      setMapping((prev) => ({ ...prev, [field.key]: e.target.value }))
                    }
                    className={`w-full px-2.5 py-1.5 border rounded-lg text-xs font-medium ${
                      mapping[field.key]
                        ? 'bg-emerald-50 border-emerald-400 text-emerald-950 font-bold'
                        : 'bg-white border-slate-300 text-slate-500'
                    }`}
                  >
                    <option value="">-- Ignorar / Automático --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        Coluna: "{h}"
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase text-slate-500 mb-2">
                Prévia dos primeiros 4 lançamentos da planilha
              </h4>
              <div className="border rounded-xl overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600">
                      <th className="p-2.5">Data</th>
                      <th className="p-2.5">Descrição</th>
                      <th className="p-2.5">Categoria</th>
                      <th className="p-2.5">Pagamento</th>
                      <th className="p-2.5 text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rawRows.slice(0, 4).map((r, i) => (
                      <tr key={i}>
                        <td className="p-2.5">{r[mapping.date] || 'Hoje'}</td>
                        <td className="p-2.5 font-semibold">{r[mapping.description] || '-'}</td>
                        <td className="p-2.5">{r[mapping.category] || 'Auto-detectar'}</td>
                        <td className="p-2.5">{r[mapping.paymentMethod] || 'PIX'}</td>
                        <td className="p-2.5 text-right font-bold text-slate-900">
                          {r[mapping.amount] || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-3 border-t">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={importing || rawRows.length === 0}
            onClick={handleConfirmImport}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm"
          >
            <CheckCircle2 className="w-4 h-4" />
            {importing ? 'Processando Planilha...' : `Importar ${rawRows.length} Lançamento(s)`}
          </button>
        </div>
      </div>
    </div>
  );
}