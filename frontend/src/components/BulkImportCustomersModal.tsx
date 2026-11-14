import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { api } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Download } from 'lucide-react';

interface BulkImportCustomersModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const SYSTEM_FIELDS = [
  { key: 'customerName', label: 'Nome do Cliente *', synonyms: ['nome', 'cliente', 'proprietario', 'proprietário', 'responsavel', 'name'] },
  { key: 'customerPhone', label: 'Telefone / WhatsApp *', synonyms: ['telefone', 'celular', 'whatsapp', 'whats', 'fone', 'contato', 'tel', 'phone'] },
  { key: 'plate', label: 'Placa do Veículo *', synonyms: ['placa', 'veiculo', 'veículo', 'carro', 'plate'] },
  { key: 'brand', label: 'Marca (Ex: VW, Fiat)', synonyms: ['marca', 'montadora', 'fabricante', 'brand'] },
  { key: 'model', label: 'Modelo (Ex: Gol 1.6)', synonyms: ['modelo', 'carro', 'model', 'veiculo modelo'] },
  { key: 'year', label: 'Ano do Veículo', synonyms: ['ano', 'ano modelo', 'fabricacao', 'year'] },
  { key: 'color', label: 'Cor', synonyms: ['cor', 'color'] },
  { key: 'km', label: 'Quilometragem (KM)', synonyms: ['km', 'quilometragem', 'hodometro', 'odometro', 'km atual'] },
  { key: 'serviceDate', label: 'Data da Manutenção', synonyms: ['data', 'data servico', 'data os', 'entrada', 'realizado em', 'date'] },
  { key: 'serviceDescription', label: 'Serviço / Manutenção Realizada', synonyms: ['servico', 'serviço', 'manutencao', 'manutenção', 'descricao', 'descrição', 'defeito', 'relato', 'historico', 'observacao'] },
  { key: 'partsUsed', label: 'Peças Trocadas', synonyms: ['pecas', 'peças', 'itens', 'produtos', 'material'] },
  { key: 'totalAmount', label: 'Valor Total Pago (R$)', synonyms: ['valor', 'total', 'preco', 'preço', 'valor total', 'custo', 'pago'] },
  { key: 'customerDocument', label: 'CPF / CNPJ', synonyms: ['cpf', 'cnpj', 'documento', 'doc'] },
  { key: 'customerEmail', label: 'E-mail', synonyms: ['email', 'e-mail'] },
] as const;

export default function BulkImportCustomersModal({ onClose, onSuccess }: BulkImportCustomersModalProps) {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, any>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);

  // Lê o arquivo Excel/CSV e faz o mapeamento automático inteligente das colunas
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

      // Auto-Mapeamento Inteligente baseado em sinônimos (ignora acentos e maiúsculas)
      const normalize = (s: string) =>
        s
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .trim();

      const autoMap: Record<string, string> = {};
      for (const field of SYSTEM_FIELDS) {
        const matchedHeader = detectedHeaders.find((h) => {
          const normH = normalize(h);
          return field.synonyms.some((syn) => normH === normalize(syn) || normH.includes(normalize(syn)));
        });
        if (matchedHeader) {
          autoMap[field.key] = matchedHeader;
        }
      }
      setMapping(autoMap);
    };
    reader.readAsBinaryString(file);
  };

  // Baixar planilha modelo pronta para facilitar caso a oficina queira um exemplo
  const handleDownloadTemplate = () => {
    const sample = [
      {
        Cliente: 'Carlos Eduardo',
        WhatsApp: '17991112233',
        Placa: 'ABC1D23',
        Marca: 'Volkswagen',
        Modelo: 'Gol 1.6 MSI',
        Ano: 2020,
        KM: 65000,
        Data: '15/01/2026',
        Servico: 'Troca de óleo 5W40 e revisão de freios',
        Pecas: '4L Óleo Sintético, Filtro de Óleo, Pastilhas Dianteiras',
        Valor: '580,00',
      },
    ];
    const ws = XLSX.utils.json_to_sheet(sample);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Clientes_Historico');
    XLSX.writeFile(wb, 'Modelo_Importacao_OficinaPro.xlsx');
  };

  const handleConfirmImport = async () => {
    if (!mapping.customerName && !mapping.plate) {
      showToast('Vincule pelo menos a coluna de Nome do Cliente ou Placa do Veículo.', 'error');
      return;
    }

    setImporting(true);
    try {
      const formattedRows = rawRows.map((row) => {
        const item: Record<string, any> = {};
        for (const field of SYSTEM_FIELDS) {
          const excelCol = mapping[field.key];
          if (excelCol && row[excelCol] !== undefined) {
            item[field.key] = row[excelCol];
          }
        }
        return item;
      });

      const { data } = await api.post('/customers/bulk-import', { rows: formattedRows });
      showToast(
        `Importado! ${data.stats.customersCreatedOrUpdated} clientes, ${data.stats.vehiclesProcessed} veículos e ${data.stats.historyOrdersCreated} manutenções históricas.`,
        'success',
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Erro ao importar planilha.', 'error');
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
              Importar Clientes, Veículos e Histórico via Planilha (Excel / CSV)
            </h2>
            <p className="text-xs text-slate-500">
              Suba a planilha antiga da oficina. O sistema adapta os nomes das colunas automaticamente.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 font-bold text-lg">
            ✕
          </button>
        </div>

        {/* Upload ou Botão de Planilha Modelo */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
          <div className="text-xs text-slate-600 space-y-1">
            <p className="font-bold text-slate-800">Aceita qualquer nomenclatura de coluna (.xlsx, .xls ou .csv)</p>
            <p>Se um cliente tiver várias manutenções na planilha, todas serão agrupadas na mesma placa!</p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" /> Baixar Exemplo
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
              <Upload className="w-3.5 h-3.5" /> Selecionar Planilha
            </button>
          </div>
        </div>

        {/* Mapeador De/Para de Colunas */}
        {headers.length > 0 && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl flex items-center gap-2 text-xs text-blue-900">
              <AlertCircle className="w-4 h-4 text-blue-600 shrink-0" />
              <span>
                Detectamos <strong>{rawRows.length} linhas</strong> na sua planilha. Confira abaixo se as colunas da
                sua planilha foram associadas corretamente aos campos do sistema:
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border">
              {SYSTEM_FIELDS.map((field) => (
                <div key={field.key}>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">{field.label}</label>
                  <select
                    value={mapping[field.key] || ''}
                    onChange={(e) => setMapping((prev) => ({ ...prev, [field.key]: e.target.value }))}
                    className={`w-full px-2.5 py-1.5 border rounded-lg text-xs font-medium ${
                      mapping[field.key]
                        ? 'bg-emerald-50 border-emerald-400 text-emerald-950 font-bold'
                        : 'bg-white border-slate-300 text-slate-500'
                    }`}
                  >
                    <option value="">-- Ignorar / Não tem na planilha --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        Coluna: "{h}"
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            {/* Pré-visualização das primeiras 3 linhas */}
            <div>
              <h4 className="text-xs font-bold uppercase text-slate-500 mb-2">
                Pré-visualização dos dados mapeados (Primeiras 3 linhas)
              </h4>
              <div className="border rounded-xl overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600">
                      <th className="p-2">Cliente</th>
                      <th className="p-2">Telefone</th>
                      <th className="p-2">Placa</th>
                      <th className="p-2">Veículo</th>
                      <th className="p-2">KM</th>
                      <th className="p-2">Manutenção / Peças</th>
                      <th className="p-2">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rawRows.slice(0, 3).map((r, i) => (
                      <tr key={i}>
                        <td className="p-2 font-semibold">{r[mapping.customerName] || '-'}</td>
                        <td className="p-2">{r[mapping.customerPhone] || '-'}</td>
                        <td className="p-2 font-mono font-bold">{r[mapping.plate] || '-'}</td>
                        <td className="p-2">
                          {r[mapping.brand] || ''} {r[mapping.model] || '-'}
                        </td>
                        <td className="p-2">{r[mapping.km] || '0'}</td>
                        <td className="p-2 truncate max-w-xs">
                          {r[mapping.serviceDescription] || r[mapping.partsUsed] || '-'}
                        </td>
                        <td className="p-2 font-bold text-emerald-700">{r[mapping.totalAmount] || '-'}</td>
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
            {importing ? 'Importando Histórico...' : `Importar ${rawRows.length} Registro(s) Agora`}
          </button>
        </div>
      </div>
    </div>
  );
}