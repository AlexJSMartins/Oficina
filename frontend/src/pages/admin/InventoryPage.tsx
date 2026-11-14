// frontend/src/pages/admin/InventoryPage.tsx
import React, { useEffect, useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { api } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import ConfirmModal from '../../components/ConfirmModal';
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
} from 'lucide-react';

export default function InventoryPage() {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<'PARTS' | 'SERVICES' | 'SUPPLIERS' | 'DEFECTS'>('PARTS');
  const [inventory, setInventory] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);

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
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Catálogo de Peças, Estoque, Serviços & Fornecedores
          </h1>
          <p className="text-sm text-slate-500">
            Controle automático de estoque, tabela de mão de obra, ranking de fornecedores e peças com defeito.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleImportExcel}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
          >
            <Upload className="w-4 h-4" /> Importar Excel
          </button>

          <button
            onClick={handleExportExcel}
            className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
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
            onClick={() => setActiveTab('PARTS')}
            className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition ${
              activeTab === 'PARTS' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            <Package className="w-4 h-4 text-blue-600" /> Peças & Estoque ({parts.length})
          </button>

          <button
            onClick={() => setActiveTab('SERVICES')}
            className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition ${
              activeTab === 'SERVICES' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            <Wrench className="w-4 h-4 text-emerald-600" /> Serviços Padrão ({services.length})
          </button>

          <button
            onClick={() => setActiveTab('SUPPLIERS')}
            className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition ${
              activeTab === 'SUPPLIERS' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            <Truck className="w-4 h-4 text-purple-600" /> Fornecedores & Ranking ({suppliers.length})
          </button>

          <button
            onClick={() => setActiveTab('DEFECTS')}
            className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition ${
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
              onClick={() => openSupplierForm()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4" /> Novo Fornecedor
            </button>
          ) : activeTab === 'SERVICES' ? (
            <button
              onClick={() => openItemForm('LABOR')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4" /> Novo Serviço Padrão
            </button>
          ) : (
            <button
              onClick={() => openItemForm('PART')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4" /> Cadastrar Nova Peça
            </button>
          )}
        </div>
      </div>

      {/* Barra de Busca e Filtros (Para Peças e Serviços) */}
      {(activeTab === 'PARTS' || activeTab === 'SERVICES') && (
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              placeholder="Buscar por código, nome da peça, serviço ou fornecedor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border rounded-lg text-xs bg-slate-50 focus:bg-white"
            />
          </div>

          {activeTab === 'PARTS' && (
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <select
                value={selectedSupplierFilter}
                onChange={(e) => setSelectedSupplierFilter(e.target.value)}
                className="px-3 py-2 border rounded-lg text-xs bg-white font-semibold"
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
                className={`px-3 py-2 rounded-lg text-xs font-bold border flex items-center gap-1.5 transition ${
                  onlyLowStock
                    ? 'bg-amber-500 text-white border-amber-600'
                    : 'bg-amber-50 text-amber-900 border-amber-200'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" /> Estoque Baixo ({lowStockCount})
              </button>
            </div>
          )}
        </div>
      )}

      {/* ABA 1: PEÇAS E ESTOQUE */}
      {activeTab === 'PARTS' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase border-b">
                <th className="py-3 px-4">Código / Peça</th>
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
                        <span className="font-bold text-slate-900">{p.name}</span>
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
                          {p.stock} un
                        </span>
                        <span className="block text-[10px] text-slate-400 mt-0.5">
                          Mín: {p.minStock}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-slate-600">
                        R$ {Number(p.costPrice).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right">
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
                            onClick={() => {
                              setStockModalItem(p);
                              setStockQty('1');
                              setStockNewCost(String(p.costPrice || ''));
                            }}
                            title="Dar Entrada de Estoque (Compra)"
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded"
                          >
                            <ArrowUpCircle className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => {
                              setDefectModalItem(p);
                              setDefectQty('1');
                              setDefectReason('');
                              setDeductFromStock(true);
                            }}
                            title="Registrar Peça com Defeito / Garantia"
                            className="p-1.5 text-amber-600 hover:bg-amber-50 rounded"
                          >
                            <AlertTriangle className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => openItemForm('PART', p)}
                            title="Editar Peça"
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                          >
                            <Edit className="w-4 h-4" />
                          </button>

                          <button
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
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded"
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
      )}

      {/* ABA 2: TABELA DE SERVIÇOS PADRÃO (MÃO DE OBRA) */}
      {activeTab === 'SERVICES' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
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
                          onClick={() => openItemForm('LABOR', s)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
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
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded"
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
                    onClick={() => {
                      setSelectedSupplierFilter(sup.id);
                      setActiveTab('PARTS');
                    }}
                    className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    <Eye className="w-3.5 h-3.5" /> Ver Peças e Valores →
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openSupplierForm(sup)}
                      className="p-1.5 text-slate-500 hover:text-blue-600 rounded"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
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
                      className="p-1.5 text-slate-400 hover:text-red-600 rounded"
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
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b bg-slate-50">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Histórico Detalhado de Baixas por Defeito / Garantia ({defectMovements.length})
              </h3>
            </div>
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
                {defectMovements.map((m) => (
                  <tr key={m.id}>
                    <td className="py-2.5 px-4 text-slate-500">
                      {new Date(m.createdAt).toLocaleString('pt-BR')}
                    </td>
                    <td className="py-2.5 px-4 font-bold text-slate-900">{m.item?.name}</td>
                    <td className="py-2.5 px-4 text-slate-600">
                      {m.item?.supplier?.name || '-'}
                    </td>
                    <td className="py-2.5 px-4 font-bold text-red-600">-{m.quantity} un</td>
                    <td className="py-2.5 px-4 text-slate-700">{m.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: CADASTRAR / EDITAR PEÇA OU SERVIÇO */}
      {showItemModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-bold text-slate-900">
                {editingItem ? 'Editar Item do Catálogo' : 'Novo Item no Catálogo'}
              </h3>
              <button onClick={() => setShowItemModal(false)} className="text-slate-400 font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setItemType('PART')}
                  className={`py-2 rounded-lg font-bold border ${
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
                  className={`py-2 rounded-lg font-bold border ${
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

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowItemModal(false)}
                  className="px-4 py-2 bg-slate-100 rounded-lg font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold"
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
                onClick={() => setShowSupplierModal(false)}
                className="text-slate-400 font-bold"
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
                  className="px-4 py-2 bg-slate-100 rounded-lg font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold"
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
                  className="px-4 py-2 bg-slate-100 rounded-lg font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold"
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
                  className="px-4 py-2 bg-slate-100 rounded-lg font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-red-600 text-white rounded-lg font-bold"
                >
                  Confirmar Defeito
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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