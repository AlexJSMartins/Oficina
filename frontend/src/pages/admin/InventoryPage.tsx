// frontend/src/pages/admin/InventoryPage.tsx
import React, { useEffect, useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { api } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import ConfirmModal from '../../components/ConfirmModal';
import InboundXmlImportModal from '@/components/fiscal/InboundXmlImportModal';
import { CurrencyInput, PhoneInput, DocumentInput } from '../../components/MaskedInputs';
import {
  Package,
  Wrench,
  Truck,
  AlertOctagon,
  Plus,
  Search,
  AlertTriangle,
  Star,
  Download,
  Upload,
  Edit,
  Trash2,
  ArrowUpCircle,
  Phone,
  Eye,
  FileCode2,
} from 'lucide-react';

export default function InventoryPage() {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<'PARTS' | 'SERVICES' | 'SUPPLIERS' | 'DEFECTS'>('PARTS');
  const [inventory, setInventory] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);

  // Modal de Importação de Nota de Compra (XML)
  const [showXmlImportModal, setShowXmlImportModal] = useState(false);

  // Filtros
  const [search, setSearch] = useState('');
  const [selectedSupplierFilter, setSelectedSupplierFilter] = useState('');
  const [onlyLowStock, setOnlyLowStock] = useState(false);

  // Modais de Item (Peça ou Serviço)
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [itemType, setItemType] = useState<'PART' | 'LABOR'>('PART');
  const [itemCode, setItemCode] = useState('');
  const [itemName, setItemName] = useState('');
  const [itemCostPrice, setItemCostPrice] = useState('');
  const [itemSalePrice, setItemSalePrice] = useState('');
  const [itemStock, setItemStock] = useState('0');
  const [itemMinStock, setItemMinStock] = useState('2');
  const [itemSupplierId, setItemSupplierId] = useState('');

  // Campos fiscais do item (NCM, CEST, CFOP, CSOSN, Unidade, Código no Fornecedor)
  const [itemNcm, setItemNcm] = useState('87089990');
  const [itemCest, setItemCest] = useState('');
  const [itemCfopSaida, setItemCfopSaida] = useState('5102');
  const [itemCsosn, setItemCsosn] = useState('102');
  const [itemUnidade, setItemUnidade] = useState('UN');
  const [itemCodigoFornecedor, setItemCodigoFornecedor] = useState('');

  // Modal de Fornecedor
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<any | null>(null);
  const [supName, setSupName] = useState('');
  const [supPhone, setSupPhone] = useState('');
  const [supEmail, setSupEmail] = useState('');
  const [supDoc, setSupDoc] = useState('');
  const [supRating, setSupRating] = useState('5');

  // Modal de Entrada/Ajuste Rápido de Estoque
  const [stockModalItem, setStockModalItem] = useState<any | null>(null);
  const [stockQty, setStockQty] = useState('1');
  const [stockReason, setStockReason] = useState('Compra / Reposição de Estoque');
  const [stockNewCost, setStockNewCost] = useState('');

  // Modal de Registro de Defeito (Garantia / Peça perdida)
  const [defectModalItem, setDefectModalItem] = useState<any | null>(null);
  const [defectQty, setDefectQty] = useState('1');
  const [defectReason, setDefectReason] = useState('');
  const [deductFromStock, setDeductFromStock] = useState(true);

  // Modal de Confirmação de Exclusão
  const [confirmDelete, setConfirmDelete] = useState<{
    title: string;
    description: string;
    onConfirm: () => Promise<void>;
  } | null>(null);

  const loadData = async () => {
    try {
      const [invRes, supRes] = await Promise.all([
        api.get('/catalog/inventory'),
        api.get('/catalog/suppliers'),
      ]);
      setInventory(invRes.data.items || []);
      setMovements(invRes.data.movements || []);
      setSuppliers(supRes.data || []);
    } catch {
      showToast('Erro ao carregar dados do catálogo e estoque.', 'error');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Abrir modal para criar ou editar Peça/Serviço
  const openItemForm = (type: 'PART' | 'LABOR', itemToEdit?: any) => {
    if (itemToEdit) {
      setEditingItem(itemToEdit);
      setItemType(itemToEdit.type);
      setItemCode(itemToEdit.code || '');
      setItemName(itemToEdit.name);
      setItemCostPrice(String(itemToEdit.costPrice || 0));
      setItemSalePrice(String(itemToEdit.salePrice || 0));
      setItemStock(String(itemToEdit.stock || 0));
      setItemMinStock(String(itemToEdit.minStock || 0));
      setItemSupplierId(itemToEdit.supplierId || '');

      // Carrega os dados fiscais salvos na peça
      setItemNcm(itemToEdit.ncm || '87089990');
      setItemCest(itemToEdit.cest || '');
      setItemCfopSaida(itemToEdit.cfopPadraoSaida || '5102');
      setItemCsosn(itemToEdit.csosn || '102');
      setItemUnidade(itemToEdit.unidadeMedida || 'UN');
      setItemCodigoFornecedor(itemToEdit.codigoFornecedor || '');
    } else {
      setEditingItem(null);
      setItemType(type);
      setItemCode('');
      setItemName('');
      setItemCostPrice('');
      setItemSalePrice('');
      setItemStock('1');
      setItemMinStock('2');
      setItemSupplierId(selectedSupplierFilter || '');

      // Reseta os dados fiscais para o padrão
      setItemNcm('87089990');
      setItemCest('');
      setItemCfopSaida('5102');
      setItemCsosn('102');
      setItemUnidade('UN');
      setItemCodigoFornecedor('');
    }
    setShowItemModal(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      type: itemType,
      code: itemCode,
      name: itemName,
      costPrice: itemType === 'LABOR' ? 0 : Number(itemCostPrice || 0),
      salePrice: Number(itemSalePrice || 0),
      stock: itemType === 'LABOR' ? 0 : Number(itemStock || 0),
      minStock: itemType === 'LABOR' ? 0 : Number(itemMinStock || 0),
      supplierId: itemType === 'LABOR' ? null : itemSupplierId || null,
      // Campos fiscais (aplicados em peças)
      ...(itemType === 'PART'
        ? {
            ncm: itemNcm,
            cest: itemCest,
            cfopPadraoSaida: itemCfopSaida,
            csosn: itemCsosn,
            unidadeMedida: itemUnidade,
            codigoFornecedor: itemCodigoFornecedor,
          }
        : {}),
    };

    try {
      if (editingItem) {
        await api.patch(`/catalog/items/${editingItem.id}`, payload);
        showToast('Item atualizado com sucesso!', 'success');
      } else {
        await api.post('/catalog/items', payload);
        showToast('Item cadastrado no catálogo!', 'success');
      }
      setShowItemModal(false);
      loadData();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Erro ao salvar item.', 'error');
    }
  };

  const openSupplierForm = (sup?: any) => {
    if (sup) {
      setEditingSupplier(sup);
      setSupName(sup.name);
      setSupPhone(sup.phone || '');
      setSupEmail(sup.email || '');
      setSupDoc(sup.document || '');
      setSupRating(String(sup.rating || 5));
    } else {
      setEditingSupplier(null);
      setSupName('');
      setSupPhone('');
      setSupEmail('');
      setSupDoc('');
      setSupRating('5');
    }
    setShowSupplierModal(true);
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: supName,
      phone: supPhone,
      email: supEmail,
      document: supDoc,
      rating: Number(supRating),
    };
    try {
      if (editingSupplier) {
        await api.patch(`/catalog/suppliers/${editingSupplier.id}`, payload);
        showToast('Fornecedor atualizado!', 'success');
      } else {
        await api.post('/catalog/suppliers', payload);
        showToast('Fornecedor cadastrado!', 'success');
      }
      setShowSupplierModal(false);
      loadData();
    } catch {
      showToast('Erro ao salvar fornecedor.', 'error');
    }
  };

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockModalItem) return;
    try {
      await api.post(`/catalog/items/${stockModalItem.id}/stock`, {
        type: 'IN',
        quantity: Number(stockQty),
        reason: stockReason,
        newCostPrice: stockNewCost ? Number(stockNewCost) : undefined,
      });
      showToast('Entrada de estoque registrada!', 'success');
      setStockModalItem(null);
      loadData();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Erro ao ajustar estoque.', 'error');
    }
  };

  const handleRegisterDefect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!defectModalItem) return;
    try {
      await api.post('/catalog/defects', {
        itemId: defectModalItem.id,
        quantity: Number(defectQty),
        reason: defectReason,
        deductFromStock,
      });
      showToast('Peça com defeito registrada no monitor!', 'success');
      setDefectModalItem(null);
      setDefectReason('');
      loadData();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Erro ao registrar defeito.', 'error');
    }
  };

  // Exportar Catálogo para Excel
  const handleExportExcel = () => {
    const rows = inventory.map((i) => ({
      Tipo: i.type === 'PART' ? 'PECA' : 'SERVICO',
      Codigo: i.code || '',
      Nome: i.name,
      Fornecedor: i.supplier?.name || '',
      NCM: i.ncm || '',
      CFOP_Saida: i.cfopPadraoSaida || '',
      CSOSN: i.csosn || '',
      Unidade: i.unidadeMedida || 'UN',
      Preco_Custo: Number(i.costPrice || 0),
      Preco_Venda: Number(i.salePrice || 0),
      Estoque_Atual: Number(i.stock || 0),
      Estoque_Minimo: Number(i.minStock || 0),
      Defeitos_Registrados: Number(i.defects || 0),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Catalogo_Estoque');
    XLSX.writeFile(wb, `Estoque_Catalogo_Oficina_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Importar Planilha Excel
  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(ws, { defval: '' });

        const { data } = await api.post('/catalog/bulk-import', { rows: jsonData });
        showToast(
          `Importação concluída! ${data.createdCount} criados e ${data.updatedCount} atualizados.`,
          'success',
        );
        loadData();
      } catch (err: any) {
        showToast(err.response?.data?.message || 'Erro ao importar planilha.', 'error');
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  // Listas Filtradas
  const parts = inventory.filter((i) => {
    if (i.type !== 'PART') return false;
    const q = search.toLowerCase();
    const matchesSearch =
      i.name.toLowerCase().includes(q) ||
      String(i.code || '').toLowerCase().includes(q) ||
      String(i.ncm || '').toLowerCase().includes(q) ||
      String(i.supplier?.name || '').toLowerCase().includes(q);
    const matchesSupplier = selectedSupplierFilter ? i.supplierId === selectedSupplierFilter : true;
    const matchesLowStock = onlyLowStock ? i.stock <= i.minStock : true;
    return matchesSearch && matchesSupplier && matchesLowStock;
  });

  const services = inventory.filter(
    (i) => i.type === 'LABOR' && i.name.toLowerCase().includes(search.toLowerCase()),
  );

  const defectiveItems = inventory
    .filter((i) => i.defects > 0)
    .sort((a, b) => b.defects - a.defects);

  const defectMovements = movements.filter((m) => m.type === 'DEFECT');

  // KPIs Gerais de Estoque
  const totalCapitalInStock = inventory
    .filter((i) => i.type === 'PART')
    .reduce((acc, i) => acc + Number(i.stock || 0) * Number(i.costPrice || 0), 0);

  const lowStockCount = inventory.filter((i) => i.type === 'PART' && i.stock <= i.minStock).length;

  const totalDefectLoss = defectiveItems.reduce(
    (acc, i) => acc + Number(i.defects || 0) * Number(i.costPrice || 0),
    0,
  );

 return (
    <div className="w-full min-w-0 p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
            Catálogo de Peças, Estoque, Serviços & Fornecedores
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Controle automático de estoque, dados fiscais (NCM/CFOP), entrada por XML, fornecedores e peças com defeito.
          </p>
        </div>


        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowXmlImportModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
          >
            <FileCode2 className="w-4 h-4" /> Importar Nota de Compra (XML)
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleImportExcel}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
          >
            <Upload className="w-4 h-4" /> Importar Excel
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
          >
            <Download className="w-4 h-4" /> Exportar Excel
          </button>
        </div>
      </div>

      {/* Cards de Resumo Rápido */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-bold uppercase text-slate-400">
            Capital Parado em Estoque (Custo)
          </span>
          <p className="text-xl font-extrabold text-slate-900 mt-1">
            R$ {totalCapitalInStock.toFixed(2)}
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-bold uppercase text-amber-600">
            Peças Abaixo do Estoque Mínimo
          </span>
          <p className="text-xl font-extrabold text-amber-600 mt-1">{lowStockCount} itens</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-bold uppercase text-blue-600">
            Fornecedores Homologados
          </span>
          <p className="text-xl font-extrabold text-blue-700 mt-1">{suppliers.length}</p>
        </div>

        <div className="bg-red-50 p-4 rounded-xl border border-red-200 shadow-sm">
          <span className="text-[11px] font-bold uppercase text-red-700">
            Prejuízo c/ Peças Defeituosas
          </span>
          <p className="text-xl font-extrabold text-red-600 mt-1">
            R$ {totalDefectLoss.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Abas de Navegação */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-200 p-1.5 rounded-xl">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('PARTS')}
            className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
              activeTab === 'PARTS' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            <Package className="w-4 h-4 text-blue-600" /> Peças & Estoque ({parts.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('SERVICES')}
            className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
              activeTab === 'SERVICES' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            <Wrench className="w-4 h-4 text-emerald-600" /> Serviços Padrão ({services.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('SUPPLIERS')}
            className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
              activeTab === 'SUPPLIERS' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            <Truck className="w-4 h-4 text-purple-600" /> Fornecedores & Ranking ({suppliers.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('DEFECTS')}
            className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
              activeTab === 'DEFECTS'
                ? 'bg-red-600 text-white shadow-sm'
                : 'text-red-700 hover:bg-red-100'
            }`}
          >
            <AlertOctagon className="w-4 h-4" /> Monitor de Defeitos ({defectiveItems.length})
          </button>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'SUPPLIERS' ? (
            <button
              type="button"
              onClick={() => openSupplierForm()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Novo Fornecedor
            </button>
          ) : activeTab === 'SERVICES' ? (
            <button
              type="button"
              onClick={() => openItemForm('LABOR')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Novo Serviço Padrão
            </button>
          ) : (
            <button
              type="button"
              onClick={() => openItemForm('PART')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Cadastrar Nova Peça
            </button>
          )}
        </div>
      </div>

    
      {/* Barra de Busca e Filtros (Para Peças e Serviços) */}
      {(activeTab === 'PARTS' || activeTab === 'SERVICES') && (
        <div className="w-full min-w-0 bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              placeholder="Buscar por código, NCM, nome da peça, serviço ou fornecedor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border rounded-lg text-xs bg-slate-50 focus:bg-white"
            />
          </div>

          {activeTab === 'PARTS' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex items-center gap-2">
              <select
                value={selectedSupplierFilter}
                onChange={(e) => setSelectedSupplierFilter(e.target.value)}
                className="w-full lg:w-auto max-w-full px-3 py-2 border rounded-lg text-xs bg-white font-semibold"
              >
                <option value="">🚚 Todos os Fornecedores</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => setOnlyLowStock(!onlyLowStock)}
                className={`w-full lg:w-auto justify-center px-3 py-2 rounded-lg text-xs font-bold border flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
                  onlyLowStock
                    ? 'bg-amber-500 text-white border-amber-600'
                    : 'bg-amber-50 text-amber-900 border-amber-200'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Estoque Baixo ({lowStockCount})
              </button>
            </div>
          )}
        </div>
      )}

      {/* ABA 1: PEÇAS E ESTOQUE (Cards em telas menores + Tabela no desktop largo) */}
      {activeTab === 'PARTS' && (
        <div className="w-full min-w-0 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {/* VISÃO CARDS — Celular, Tablet e Notebooks compactos (< xl) */}
          <div className="xl:hidden divide-y divide-slate-100">
            {parts.length === 0 ? (
              <div className="py-10 px-4 text-center text-sm text-slate-400">
                Nenhuma peça encontrada para este filtro.
              </div>
            ) : (
              parts.map((p) => {
                const margin =
                  p.costPrice > 0 ? ((p.salePrice - p.costPrice) / p.costPrice) * 100 : 100;
                return (
                  <div key={p.id} className="p-4 space-y-3 hover:bg-slate-50/70 transition text-xs">
                    {/* Linha 1: Código + Nome + Estoque */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 space-y-0.5">
                        <span className="text-[10px] font-mono font-bold text-slate-400 block">
                          {p.code || 'SEM CÓDIGO'}
                        </span>
                        <h3 className="font-bold text-slate-900 text-sm break-words">{p.name}</h3>
                        <p className="text-[11px] text-slate-500">
                          Fornecedor:{' '}
                          <strong className="text-slate-700">
                            {p.supplier?.name || 'Não vinculado'}
                          </strong>
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full font-bold text-xs ${
                            p.stock <= p.minStock
                              ? 'bg-red-100 text-red-700'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {p.stock} {String(p.unidadeMedida || 'un').toLowerCase()}
                        </span>
                        <span className="block text-[10px] text-slate-400 mt-0.5">
                          Mín: {p.minStock}
                        </span>
                      </div>
                    </div>

                    {/* Linha 2: Dados Fiscais */}
                    <div className="text-[11px] text-slate-500 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100 flex flex-wrap gap-x-3 gap-y-1">
                      <span>
                        NCM: <strong className="text-slate-700">{p.ncm || '87089990'}</strong>
                      </span>
                      <span>CFOP: {p.cfopPadraoSaida || '5102'}</span>
                      <span>CSOSN: {p.csosn || '102'}</span>
                      <span>UN: {p.unidadeMedida || 'UN'}</span>
                    </div>

                    {/* Linha 3: Preços, Margem e Defeitos */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-slate-50 rounded-lg p-2.5 border border-slate-100">
                      <div>
                        <span className="text-[10px] uppercase text-slate-400 font-bold block">
                          Custo
                        </span>
                        <span className="font-semibold text-slate-700">
                          R$ {Number(p.costPrice).toFixed(2)}
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] uppercase text-slate-400 font-bold block">
                          Venda
                        </span>
                        <span className="font-extrabold text-blue-700">
                          R$ {Number(p.salePrice).toFixed(2)}
                        </span>
                        <span className="text-[10px] text-emerald-600 font-semibold block">
                          +{margin.toFixed(0)}% margem
                        </span>
                      </div>

                      <div className="col-span-2 sm:col-span-1 sm:text-right flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 border-slate-200 pt-1.5 sm:pt-0">
                        <span className="text-[10px] uppercase text-slate-400 font-bold">
                          Defeitos
                        </span>
                        {p.defects > 0 ? (
                          <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded font-bold text-[11px]">
                            {p.defects} falha(s)
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">0</span>
                        )}
                      </div>
                    </div>

                    {/* Linha 4: Ações Rápidas */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          setStockModalItem(p);
                          setStockQty('1');
                          setStockNewCost(String(p.costPrice || ''));
                        }}
                        className="flex-1 sm:flex-none px-2.5 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold inline-flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <ArrowUpCircle className="w-3.5 h-3.5 shrink-0" /> Entrada
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setDefectModalItem(p);
                          setDefectQty('1');
                          setDefectReason('');
                          setDeductFromStock(true);
                        }}
                        className="flex-1 sm:flex-none px-2.5 py-1.5 rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold inline-flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Defeito
                      </button>

                      <button
                        type="button"
                        onClick={() => openItemForm('PART', p)}
                        className="px-2.5 py-1.5 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold inline-flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Edit className="w-3.5 h-3.5 shrink-0" /> Editar
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setConfirmDelete({
                            title: 'Excluir Peça do Catálogo',
                            description: `Tem certeza que deseja excluir "${p.name}"?`,
                            onConfirm: async () => {
                              await api.delete(`/catalog/items/${p.id}`);
                              showToast('Peça excluída.', 'success');
                              loadData();
                            },
                          })
                        }
                        title="Excluir Peça"
                        className="p-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* VISÃO TABELA — Desktop largo (>= xl) */}
          <div className="hidden xl:block overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase border-b">
                  <th className="py-3 px-4">Código / Peça / Fiscal</th>
                  <th className="py-3 px-4">Fornecedor</th>
                  <th className="py-3 px-4 text-center">Estoque Atual</th>
                  <th className="py-3 px-4 text-right">Preço Custo</th>
                  <th className="py-3 px-4 text-right">Preço Venda</th>
                  <th className="py-3 px-4 text-center">Defeitos</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {parts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-400">
                      Nenhuma peça encontrada para este filtro.
                    </td>
                  </tr>
                ) : (
                  parts.map((p) => {
                    const margin =
                      p.costPrice > 0 ? ((p.salePrice - p.costPrice) / p.costPrice) * 100 : 100;
                    return (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4">
                          <span className="text-[10px] font-mono font-bold text-slate-400 block">
                            {p.code || 'SEM CÓDIGO'}
                          </span>
                          <span className="font-bold text-slate-900 block">{p.name}</span>
                          <span className="text-[10px] text-slate-500">
                            NCM: <strong>{p.ncm || '87089990'}</strong> • CFOP:{' '}
                            {p.cfopPadraoSaida || '5102'} • CSOSN: {p.csosn || '102'} •{' '}
                            {p.unidadeMedida || 'UN'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-xs font-semibold text-slate-600">
                          {p.supplier?.name || <span className="text-slate-400">Não vinculado</span>}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`px-2.5 py-1 rounded-full font-bold text-xs ${
                              p.stock <= p.minStock
                                ? 'bg-red-100 text-red-700'
                                : 'bg-emerald-100 text-emerald-700'
                            }`}
                          >
                            {p.stock} {String(p.unidadeMedida || 'un').toLowerCase()}
                          </span>
                          <span className="block text-[10px] text-slate-400 mt-0.5">
                            Mín: {p.minStock}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-slate-600 whitespace-nowrap">
                          R$ {Number(p.costPrice).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <span className="font-extrabold text-blue-700 block">
                            R$ {Number(p.salePrice).toFixed(2)}
                          </span>
                          <span className="text-[10px] text-emerald-600 font-semibold">
                            +{margin.toFixed(0)}% margem
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {p.defects > 0 ? (
                            <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded font-bold text-xs">
                              {p.defects} falha(s)
                            </span>
                          ) : (
                            <span className="text-xs text-slate-300">0</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setStockModalItem(p);
                                setStockQty('1');
                                setStockNewCost(String(p.costPrice || ''));
                              }}
                              title="Dar Entrada de Estoque (Compra)"
                              className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded cursor-pointer"
                            >
                              <ArrowUpCircle className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setDefectModalItem(p);
                                setDefectQty('1');
                                setDefectReason('');
                                setDeductFromStock(true);
                              }}
                              title="Registrar Peça com Defeito / Garantia"
                              className="p-1.5 text-amber-600 hover:bg-amber-50 rounded cursor-pointer"
                            >
                              <AlertTriangle className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => openItemForm('PART', p)}
                              title="Editar Peça"
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded cursor-pointer"
                            >
                              <Edit className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                setConfirmDelete({
                                  title: 'Excluir Peça do Catálogo',
                                  description: `Tem certeza que deseja excluir "${p.name}"?`,
                                  onConfirm: async () => {
                                    await api.delete(`/catalog/items/${p.id}`);
                                    showToast('Peça excluída.', 'success');
                                    loadData();
                                  },
                                })
                              }
                              title="Excluir Peça"
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
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
      )}

      
      {/* ABA 2: TABELA DE SERVIÇOS PADRÃO (MÃO DE OBRA) */}
      {activeTab === 'SERVICES' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase border-b">
                <th className="py-3 px-4">Código</th>
                <th className="py-3 px-4">Descrição do Serviço Padrão (Mão de Obra)</th>
                <th className="py-3 px-4 text-right">Valor Tabelado (R$)</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {services.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-10 text-center text-slate-400">
                    Nenhum serviço padrão cadastrado (Ex: Alinhamento, Limpeza de Bicos, Troca de Óleo).
                  </td>
                </tr>
              ) : (
                services.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono text-xs font-bold text-slate-500">
                      {s.code || 'SERV'}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">{s.name}</td>
                    <td className="py-3 px-4 text-right font-extrabold text-emerald-700">
                      R$ {Number(s.salePrice).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openItemForm('LABOR', s)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded cursor-pointer"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setConfirmDelete({
                              title: 'Excluir Serviço Padrão',
                              description: `Deseja remover o serviço "${s.name}" do catálogo?`,
                              onConfirm: async () => {
                                await api.delete(`/catalog/items/${s.id}`);
                                showToast('Serviço removido.', 'success');
                                loadData();
                              },
                            })
                          }
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ABA 3: FORNECEDORES, VALORES E RANKING */}
      {activeTab === 'SUPPLIERS' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {suppliers.length === 0 ? (
            <div className="col-span-full bg-white p-10 rounded-xl border text-center text-slate-400">
              Nenhum fornecedor cadastrado.
            </div>
          ) : (
            suppliers.map((sup, idx) => (
              <div
                key={sup.id}
                className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-purple-100 text-purple-800">
                        #{idx + 1} Ranking
                      </span>
                      <h3 className="text-base font-extrabold text-slate-900 mt-1">{sup.name}</h3>
                    </div>

                    <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg">
                      <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                      <span className="text-xs font-extrabold text-amber-800">
                        {Number(sup.rating || 5).toFixed(1)}
                      </span>
                    </div>
                  </div>

                  <div className="text-xs text-slate-500 space-y-0.5">
                    {sup.phone && (
                      <p className="flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {sup.phone}
                      </p>
                    )}
                    {sup.document && <p>CNPJ/Doc: {sup.document}</p>}
                  </div>

                  {/* Métricas Financeiras e de Qualidade do Fornecedor */}
                  <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
                    <div className="bg-slate-50 p-2.5 rounded-lg border">
                      <span className="text-[10px] text-slate-400 block uppercase font-bold">
                        Peças Vinculadas
                      </span>
                      <span className="font-extrabold text-slate-800">
                        {sup.stats?.partsCount || 0} itens ({sup.stats?.totalStockUnits || 0} un)
                      </span>
                    </div>

                    <div className="bg-slate-50 p-2.5 rounded-lg border">
                      <span className="text-[10px] text-slate-400 block uppercase font-bold">
                        Valor em Estoque
                      </span>
                      <span className="font-extrabold text-emerald-700">
                        R$ {Number(sup.stats?.totalStockValue || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div
                    className={`p-2.5 rounded-lg border text-xs flex items-center justify-between ${
                      sup.stats?.totalDefects > 0
                        ? 'bg-red-50 border-red-200 text-red-800'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    }`}
                  >
                    <span>Índice de Defeitos / Garantias:</span>
                    <strong>
                      {sup.stats?.totalDefects || 0} peça(s) (R${' '}
                      {Number(sup.stats?.defectLossValue || 0).toFixed(2)})
                    </strong>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSupplierFilter(sup.id);
                      setActiveTab('PARTS');
                    }}
                    className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" /> Ver Peças e Valores →
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openSupplierForm(sup)}
                      className="p-1.5 text-slate-500 hover:text-blue-600 rounded cursor-pointer"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setConfirmDelete({
                          title: 'Excluir Fornecedor',
                          description: `Deseja remover o fornecedor "${sup.name}"? As peças dele continuarão no catálogo sem vínculo.`,
                          onConfirm: async () => {
                            await api.delete(`/catalog/suppliers/${sup.id}`);
                            showToast('Fornecedor removido.', 'success');
                            loadData();
                          },
                        })
                      }
                      className="p-1.5 text-slate-400 hover:text-red-600 rounded cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ABA 4: MONITOR DE PEÇAS DEFEITUOSAS QUE SAÍRAM E NÃO VOLTARAM */}
      {activeTab === 'DEFECTS' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {defectiveItems.length === 0 ? (
              <div className="col-span-full bg-white py-10 text-center text-slate-400 rounded-xl border">
                Nenhuma peça com defeito registrada até o momento.
              </div>
            ) : (
              defectiveItems.map((d) => (
                <div
                  key={d.id}
                  className="bg-red-50/70 border border-red-200 p-4 rounded-xl space-y-2 relative"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-mono font-bold text-red-500 uppercase">
                        {d.code || 'SEM CÓDIGO'}
                      </span>
                      <h3 className="font-bold text-slate-900">{d.name}</h3>
                      <p className="text-xs text-slate-600">
                        Fornecedor: <strong>{d.supplier?.name || 'Não informado'}</strong>
                      </p>
                    </div>
                    <span className="bg-red-600 text-white text-xs font-extrabold px-2.5 py-1 rounded-full">
                      {d.defects} c/ defeito
                    </span>
                  </div>

                  <div className="bg-white p-2.5 rounded-lg border border-red-100 text-xs flex justify-between">
                    <span className="text-slate-600">Custo perdido sem retorno:</span>
                    <strong className="text-red-700">
                      R$ {(Number(d.defects) * Number(d.costPrice)).toFixed(2)}
                    </strong>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Histórico de Ocorrências de Defeito */}
         {/* Histórico de Ocorrências de Defeito (Cards < lg + Tabela >= lg) */}
          <div className="w-full min-w-0 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b bg-slate-50">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Histórico Detalhado de Baixas por Defeito / Garantia ({defectMovements.length})
              </h3>
            </div>

            {/* VISÃO CARDS — Mobile/Tablet (< lg) */}
            <div className="lg:hidden divide-y divide-slate-100">
              {defectMovements.length === 0 ? (
                <div className="py-8 px-4 text-center text-xs text-slate-400">
                  Nenhuma ocorrência registrada.
                </div>
              ) : (
                defectMovements.map((m) => (
                  <div key={m.id} className="p-4 space-y-2 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 break-words">{m.item?.name}</div>
                        <div className="text-[11px] text-slate-500">
                          Fornecedor: {m.item?.supplier?.name || '-'}
                        </div>
                      </div>
                      <span className="font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded shrink-0">
                        -{m.quantity} un
                      </span>
                    </div>

                    <p className="text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-100 break-words">
                      {m.reason}
                    </p>

                    <div className="text-[11px] text-slate-400">
                      {new Date(m.createdAt).toLocaleString('pt-BR', {
                        timeZone: 'America/Sao_Paulo',
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* VISÃO TABELA — Desktop (>= lg) */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b text-slate-400 uppercase">
                    <th className="py-2.5 px-4">Data</th>
                    <th className="py-2.5 px-4">Peça</th>
                    <th className="py-2.5 px-4">Fornecedor</th>
                    <th className="py-2.5 px-4">Qtd</th>
                    <th className="py-2.5 px-4">Motivo / Falha Apresentada</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {defectMovements.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        Nenhuma ocorrência registrada.
                      </td>
                    </tr>
                  ) : (
                    defectMovements.map((m) => (
                      <tr key={m.id}>
                        <td className="py-2.5 px-4 text-slate-500 whitespace-nowrap">
                          {new Date(m.createdAt).toLocaleString('pt-BR', {
                            timeZone: 'America/Sao_Paulo',
                          })}
                        </td>
                        <td className="py-2.5 px-4 font-bold text-slate-900">{m.item?.name}</td>
                        <td className="py-2.5 px-4 text-slate-600">
                          {m.item?.supplier?.name || '-'}
                        </td>
                        <td className="py-2.5 px-4 font-bold text-red-600 whitespace-nowrap">
                          -{m.quantity} un
                        </td>
                        <td className="py-2.5 px-4 text-slate-700">{m.reason}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CADASTRAR / EDITAR PEÇA OU SERVIÇO */}
      {showItemModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-xl w-full max-h-[92vh] overflow-y-auto p-6 space-y-4 shadow-xl">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-bold text-slate-900">
                {editingItem ? 'Editar Item do Catálogo' : 'Novo Item no Catálogo'}
              </h3>
              <button
                type="button"
                onClick={() => setShowItemModal(false)}
                className="text-slate-400 hover:text-slate-700 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setItemType('PART')}
                  className={`py-2 rounded-lg font-bold border cursor-pointer ${
                    itemType === 'PART'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-slate-50 text-slate-600'
                  }`}
                >
                  🔧 Peça de Estoque
                </button>
                <button
                  type="button"
                  onClick={() => setItemType('LABOR')}
                  className={`py-2 rounded-lg font-bold border cursor-pointer ${
                    itemType === 'LABOR'
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-slate-50 text-slate-600'
                  }`}
                >
                  👨‍🔧 Serviço Padrão (Mão de Obra)
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-slate-600">Código / SKU</label>
                  <input
                    placeholder="Ex: OL-5W30"
                    value={itemCode}
                    onChange={(e) => setItemCode(e.target.value.toUpperCase())}
                    className="w-full mt-1 px-3 py-2 border rounded-lg font-mono uppercase"
                  />
                </div>
                <div className="col-span-2">
                  <label className="font-semibold text-slate-600">Nome / Descrição *</label>
                  <input
                    placeholder="Ex: Pastilha de Freio Dianteira Cobreq"
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border rounded-lg"
                    required
                  />
                </div>
              </div>

              {itemType === 'PART' && (
                <div>
                  <label className="font-semibold text-slate-600">Fornecedor da Peça</label>
                  <select
                    value={itemSupplierId}
                    onChange={(e) => setItemSupplierId(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border rounded-lg bg-white"
                  >
                    <option value="">-- Sem fornecedor específico --</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                {itemType === 'PART' && (
                  <div>
                    <label className="font-semibold text-slate-600">Preço de Custo (R$) *</label>
                    <CurrencyInput
                      value={itemCostPrice}
                      onChangeValue={(val) => setItemCostPrice(val)}
                      className="w-full mt-1 px-3 py-2 border rounded-lg"
                      required
                    />
                  </div>
                )}
                <div className={itemType === 'LABOR' ? 'col-span-2' : ''}>
                  <label className="font-semibold text-slate-600">Preço de Venda (R$) *</label>
                  <CurrencyInput
                    value={itemSalePrice}
                    onChangeValue={(val) => setItemSalePrice(val)}
                    className="w-full mt-1 px-3 py-2 border rounded-lg font-bold text-emerald-700"
                    required
                  />
                </div>
              </div>

              {itemType === 'PART' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-slate-600">Quantidade em Estoque</label>
                    <input
                      type="number"
                      value={itemStock}
                      onChange={(e) => setItemStock(e.target.value)}
                      className="w-full mt-1 px-3 py-2 border rounded-lg"
                      required
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-600">Alerta de Estoque Mínimo</label>
                    <input
                      type="number"
                      value={itemMinStock}
                      onChange={(e) => setItemMinStock(e.target.value)}
                      className="w-full mt-1 px-3 py-2 border rounded-lg"
                      required
                    />
                  </div>
                </div>
              )}

              {/* Seção Fiscal da Peça (Sprint 2) */}
              {itemType === 'PART' && (
                <div className="border-t pt-3 mt-3 space-y-2.5 text-xs">
                  <div className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                    Dados Fiscais (NF-e / NFC-e)
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="font-semibold text-slate-600 block mb-1">NCM (8 dígitos)</label>
                      <input
                        list="ncm-autopecas"
                        maxLength={8}
                        value={itemNcm}
                        onChange={(e) => setItemNcm(e.target.value.replace(/\D/g, ''))}
                        className="w-full px-2.5 py-2 border rounded-lg"
                      />
                      <datalist id="ncm-autopecas">
                        <option value="87089990">87089990 - Outras partes/acessórios de veículos</option>
                        <option value="87083019">87083019 - Pastilhas / Freios</option>
                        <option value="84212300">84212300 - Filtros de óleo / combustível</option>
                        <option value="84213100">84213100 - Filtros de ar</option>
                        <option value="27101932">27101932 - Óleo lubrificante automotivo</option>
                        <option value="87088000">87088000 - Amortecedores / Suspensão</option>
                        <option value="85111000">85111000 - Velas de ignição</option>
                        <option value="85071090">85071090 - Baterias automotivas</option>
                        <option value="40103100">40103100 - Correias dentadas / V</option>
                      </datalist>
                    </div>

                    <div>
                      <label className="font-semibold text-slate-600 block mb-1">CFOP Saída</label>
                      <select
                        value={itemCfopSaida}
                        onChange={(e) => setItemCfopSaida(e.target.value)}
                        className="w-full px-2.5 py-2 border rounded-lg bg-white"
                      >
                        <option value="5102">5102 - Venda mercadoria (Tributada)</option>
                        <option value="5405">5405 - Venda c/ Subst. Tributária (ST)</option>
                      </select>
                    </div>

                    <div>
                      <label className="font-semibold text-slate-600 block mb-1">CSOSN (Simples)</label>
                      <select
                        value={itemCsosn}
                        onChange={(e) => setItemCsosn(e.target.value)}
                        className="w-full px-2.5 py-2 border rounded-lg bg-white"
                      >
                        <option value="102">102 - Tributada s/ crédito</option>
                        <option value="500">500 - ICMS cobrado por ST</option>
                        <option value="101">101 - Tributada c/ crédito</option>
                      </select>
                    </div>

                    <div>
                      <label className="font-semibold text-slate-600 block mb-1">Unidade</label>
                      <select
                        value={itemUnidade}
                        onChange={(e) => setItemUnidade(e.target.value)}
                        className="w-full px-2.5 py-2 border rounded-lg bg-white"
                      >
                        <option value="UN">UN (Unidade)</option>
                        <option value="PC">PC (Peça)</option>
                        <option value="LT">LT (Litro)</option>
                        <option value="JG">JG (Jogo)</option>
                        <option value="KT">KT (Kit)</option>
                      </select>
                    </div>

                    <div>
                      <label className="font-semibold text-slate-600 block mb-1">CEST (opcional)</label>
                      <input
                        value={itemCest}
                        onChange={(e) => setItemCest(e.target.value.replace(/\D/g, ''))}
                        className="w-full px-2.5 py-2 border rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-slate-600 block mb-1">Cód. no Fornecedor</label>
                      <input
                        value={itemCodigoFornecedor}
                        onChange={(e) => setItemCodigoFornecedor(e.target.value)}
                        className="w-full px-2.5 py-2 border rounded-lg"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowItemModal(false)}
                  className="px-4 py-2 bg-slate-100 rounded-lg font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold cursor-pointer"
                >
                  Salvar no Catálogo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CADASTRAR / EDITAR FORNECEDOR */}
      {showSupplierModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-bold text-slate-900">
                {editingSupplier ? 'Editar Fornecedor' : 'Novo Fornecedor'}
              </h3>
              <button
                type="button"
                onClick={() => setShowSupplierModal(false)}
                className="text-slate-400 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-600">Nome da Autopeças / Fornecedor *</label>
                <input
                  value={supName}
                  onChange={(e) => setSupName(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border rounded-lg"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-600">WhatsApp / Telefone</label>
                  <PhoneInput
                    value={supPhone}
                    onChangeValue={(val) => setSupPhone(val)}
                    className="w-full mt-1 px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-600">Avaliação / Ranking (1 a 5)</label>
                  <select
                    value={supRating}
                    onChange={(e) => setSupRating(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border rounded-lg bg-white font-bold"
                  >
                    <option value="5">⭐⭐⭐⭐⭐ (5.0 - Excelente)</option>
                    <option value="4">⭐⭐⭐⭐ (4.0 - Bom)</option>
                    <option value="3">⭐⭐⭐ (3.0 - Regular)</option>
                    <option value="2">⭐⭐ (2.0 - Ruim)</option>
                    <option value="1">⭐ (1.0 - Crítico)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-600">CNPJ</label>
                  <DocumentInput
                    value={supDoc}
                    onChangeValue={(val) => setSupDoc(val)}
                    className="w-full mt-1 px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-600">E-mail</label>
                  <input
                    value={supEmail}
                    onChange={(e) => setSupEmail(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowSupplierModal(false)}
                  className="px-4 py-2 bg-slate-100 rounded-lg font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold cursor-pointer"
                >
                  Salvar Fornecedor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ENTRADA RÁPIDA DE ESTOQUE */}
      {stockModalItem && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-slate-900">
              Entrada de Estoque: {stockModalItem.name}
            </h3>
            <form onSubmit={handleAdjustStock} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-600">Quantidade Comprada *</label>
                <input
                  type="number"
                  min="1"
                  value={stockQty}
                  onChange={(e) => setStockQty(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border rounded-lg font-bold"
                  required
                />
              </div>
              <div>
                <label className="font-semibold text-slate-600">
                  Atualizar Preço de Custo Unitário (R$)
                </label>
                <CurrencyInput
                  value={stockNewCost}
                  onChangeValue={(val) => setStockNewCost(val)}
                  className="w-full mt-1 px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-600">Observação / Nota Fiscal</label>
                <input
                  value={stockReason}
                  onChange={(e) => setStockReason(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border rounded-lg"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStockModalItem(null)}
                  className="px-4 py-2 bg-slate-100 rounded-lg font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold cursor-pointer"
                >
                  Somar ao Estoque
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REGISTRAR DEFEITO / PEÇA QUE SAIU E NÃO VOLTOU */}
      {defectModalItem && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-red-600 flex items-center gap-2">
              <AlertOctagon className="w-5 h-5" /> Registrar Peça Defeituosa
            </h3>
            <p className="text-xs text-slate-600">
              Peça: <strong>{defectModalItem.name}</strong>
            </p>
            <form onSubmit={handleRegisterDefect} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-600">Quantidade com Defeito *</label>
                <input
                  type="number"
                  min="1"
                  value={defectQty}
                  onChange={(e) => setDefectQty(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border rounded-lg font-bold"
                  required
                />
              </div>
              <div>
                <label className="font-semibold text-slate-600">
                  Qual foi o defeito / Por que não voltou? *
                </label>
                <textarea
                  rows={2}
                  placeholder="Ex: Peça apresentou vazamento na garantia e fornecedor não reembolsou..."
                  value={defectReason}
                  onChange={(e) => setDefectReason(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border rounded-lg"
                  required
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={deductFromStock}
                  onChange={(e) => setDeductFromStock(e.target.checked)}
                />
                <span>Descontar esta unidade do saldo atual da prateleira</span>
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDefectModalItem(null)}
                  className="px-4 py-2 bg-slate-100 rounded-lg font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-red-600 text-white rounded-lg font-bold cursor-pointer"
                >
                  Confirmar Defeito
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: IMPORTAR NOTA DE COMPRA (XML) */}
      <InboundXmlImportModal
        isOpen={showXmlImportModal}
        onClose={() => setShowXmlImportModal(false)}
        onImported={loadData}
      />

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      {confirmDelete && (
        <ConfirmModal
          isOpen={!!confirmDelete}
          title={confirmDelete.title}
          description={confirmDelete.description}
          confirmText="Sim, Excluir"
          onConfirm={confirmDelete.onConfirm}
          onClose={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}