// frontend/src/components/BudgetModal.tsx
import React, { useEffect, useState } from 'react';
import { api } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import {
  Plus,
  Trash2,
  Wrench,
  Package,
  Printer,
  CheckCircle2,
  Search,
  Send,
} from 'lucide-react';
import { printWorkshopBudgetPdf } from '../utils/printBudgetPdf';
import { CurrencyInput } from './MaskedInputs';

interface BudgetModalProps {
  orderId: string;
  onClose: () => void;
  onUpdated: () => void;
}

export default function BudgetModal({ orderId, onClose, onUpdated }: BudgetModalProps) {
  const { showToast } = useToast();
  const [order, setOrder] = useState<any>(null);
  const [workshop, setWorkshop] = useState<any>(null);

  // Campos para adicionar novo item ao orçamento
  const [type, setType] = useState<'PART' | 'LABOR'>('PART');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState('');
  const [costPrice, setCostPrice] = useState('');

  // Estados de Autocomplete do Catálogo
  const [catalogResults, setCatalogResults] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Desconto e Notas técnicas da oficina no orçamento
  const [discount, setDiscount] = useState('0');
  const [mechanicNotes, setMechanicNotes] = useState('');
  const [savingBudget, setSavingBudget] = useState(false);

  const loadOrder = async () => {
    try {
      const { data } = await api.get(`/service-orders/${orderId}/details`);
      setOrder(data);
      setDiscount(String(data.discount || 0));
      setMechanicNotes(data.mechanicNotes || '');
    } catch {
      showToast('Erro ao carregar os detalhes do orçamento.', 'error');
      onClose();
    }
  };

  useEffect(() => {
    loadOrder();
    api
      .get('/settings')
      .then((res) => setWorkshop(res.data))
      .catch(() => {});
  }, [orderId]);

  // Busca automática no Catálogo de Estoque e Serviços Padrão
  const handleSearchCatalog = async (text: string) => {
    setDescription(text);
    try {
      const { data } = await api.get(`/catalog/search?q=${encodeURIComponent(text)}`);
      setCatalogResults(Array.isArray(data) ? data : []);
      setShowSuggestions(true);
    } catch {
      setCatalogResults([]);
    }
  };

  const handleSelectCatalogItem = (item: any) => {
    setType(item.type === 'LABOR' ? 'LABOR' : 'PART');
    setDescription(item.name);
    setCostPrice(String(item.costPrice || 0));
    setUnitPrice(String(item.salePrice || 0));
    setQuantity(1);
    setShowSuggestions(false);
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unitPrice || Number(unitPrice) <= 0) {
      showToast('Informe um valor de venda válido.', 'error');
      return;
    }

    try {
      await api.post(`/service-orders/${orderId}/items`, {
        type,
        description,
        quantity: Number(quantity),
        unitPrice: Number(unitPrice),
        costPrice: type === 'PART' ? Number(costPrice || 0) : 0,
      });
      setDescription('');
      setQuantity(1);
      setUnitPrice('');
      setCostPrice('');
      loadOrder();
      onUpdated();
      showToast('Item adicionado e salvo no catálogo automaticamente!', 'success');
    } catch {
      showToast('Erro ao adicionar item no orçamento.', 'error');
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    try {
      await api.patch(`/service-orders/${orderId}/items/${itemId}/remove`);
      loadOrder();
      onUpdated();
    } catch {
      showToast('Erro ao remover item.', 'error');
    }
  };

  const handleSaveBudget = async (sendToApproval: boolean) => {
    setSavingBudget(true);
    try {
      await api.patch(`/service-orders/${orderId}/budget`, {
        discount: Number(discount || 0),
        mechanicNotes,
        sendToApproval,
      });
      showToast(
        sendToApproval
          ? 'Orçamento salvo e OS movida para Aguardando Aprovação!'
          : 'Laudo e desconto salvos com sucesso!',
        'success',
      );
      loadOrder();
      onUpdated();
      if (sendToApproval) onClose();
    } catch {
      showToast('Erro ao salvar orçamento.', 'error');
    } finally {
      setSavingBudget(false);
    }
  };

  const handlePrintPdf = () => {
    printWorkshopBudgetPdf(order, workshop);
  };

  if (!order) return null;

  const parts = (order.items || []).filter((i: any) => i.type === 'PART');
  const labors = (order.items || []).filter((i: any) => i.type === 'LABOR');
  const subtotal = (order.items || []).reduce(
    (acc: number, i: any) => acc + Number(i.totalPrice || 0),
    0,
  );

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-4xl w-full p-6 space-y-5 shadow-2xl max-h-[92vh] overflow-y-auto">
        {/* Cabeçalho */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
              Orçamento & Peças — OS #{order.number}
            </span>
            <h2 className="text-lg font-bold text-slate-900">
              {order.vehicle.brand} {order.vehicle.model} ({order.vehicle.plate}) •{' '}
              {order.customer.name}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrintPdf}
              className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-2 rounded-lg text-xs font-semibold transition"
            >
              <Printer className="w-4 h-4" /> Gerar PDF / Imprimir OS
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 px-2 py-1 text-lg font-bold"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Formulário de Inclusão de Peça ou Mão de Obra com Cadastro Rápido e Máscaras */}
        <form
          onSubmit={handleAddItem}
          className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-500 flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-blue-600" />
              Busque no catálogo ou digite um item novo para cadastro rápido automático
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-2.5">
            <select
              value={type}
              onChange={(e) => setType(e.target.value as 'PART' | 'LABOR')}
              className="px-3 py-2 border rounded-lg text-xs font-bold bg-white"
            >
              <option value="PART">🔧 Peça / Insumo</option>
              <option value="LABOR">👨‍🔧 Mão de Obra</option>
            </select>

            {/* Campo com Autocomplete do Estoque */}
            <div className="sm:col-span-2 relative">
              <input
                placeholder="Nome da peça ou serviço novo..."
                value={description}
                onChange={(e) => handleSearchCatalog(e.target.value)}
                onFocus={() => handleSearchCatalog(description)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                className="w-full px-3 py-2 border border-blue-300 rounded-lg text-xs bg-white font-medium"
                required
              />

              {showSuggestions && catalogResults.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto divide-y divide-slate-100">
                  {catalogResults.map((item) => (
                    <div
                      key={item.id}
                      onMouseDown={() => handleSelectCatalogItem(item)}
                      className="p-2.5 hover:bg-blue-50 cursor-pointer transition flex items-center justify-between gap-2"
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              item.type === 'PART'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {item.type === 'PART' ? 'PEÇA' : 'SERVIÇO'}
                          </span>
                          {item.code && (
                            <span className="text-[10px] font-mono font-bold text-slate-400">
                              [{item.code}]
                            </span>
                          )}
                          <span className="text-xs font-bold text-slate-900">{item.name}</span>
                        </div>

                        <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                          {item.type === 'PART' && (
                            <span
                              className={`font-semibold ${
                                item.stock > 0 ? 'text-emerald-600' : 'text-red-600'
                              }`}
                            >
                              Estoque: {item.stock} un.
                            </span>
                          )}
                          {item.supplier && <span>• Forn: {item.supplier.name}</span>}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-xs font-extrabold text-emerald-700 block">
                          R$ {Number(item.salePrice || 0).toFixed(2)}
                        </span>
                        {item.type === 'PART' && (
                          <span className="text-[10px] text-slate-400">
                            Custo: R$ {Number(item.costPrice || 0).toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <input
              type="number"
              min="1"
              placeholder="Qtd"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="px-3 py-2 border rounded-lg text-xs bg-white"
              required
            />

            {/* Custo Unitário com Máscara R$ */}
            {type === 'PART' ? (
              <CurrencyInput
                placeholder="Custo Unit. (R$)"
                title="Preço de custo da peça para cálculo de lucro no DRE"
                value={costPrice}
                onChangeValue={(val) => setCostPrice(val)}
                className="w-full px-3 py-2 border border-amber-300 bg-amber-50/40 rounded-lg text-xs"
              />
            ) : (
              <div className="px-3 py-2 text-[11px] text-slate-400 flex items-center">
                Mão de Obra
              </div>
            )}

            {/* Venda Unitária com Máscara R$ */}
            <div className="flex gap-1.5">
              <CurrencyInput
                placeholder="Venda Unit. (R$)"
                value={unitPrice}
                onChangeValue={(val) => setUnitPrice(val)}
                className="w-full px-3 py-2 border border-emerald-300 rounded-lg text-xs bg-white font-bold"
                required
              />
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 rounded-lg flex items-center justify-center shrink-0"
                title="Adicionar e cadastrar automaticamente"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </form>

        {/* Tabelas de Peças e Mão de Obra */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Peças */}
          <div className="border rounded-xl p-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Package className="w-4 h-4 text-blue-600" /> Peças e Insumos ({parts.length})
            </h3>
            {parts.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">Nenhuma peça lançada.</p>
            ) : (
              <div className="divide-y text-xs">
                {parts.map((item: any) => (
                  <div key={item.id} className="py-2 flex items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-800">
                        {item.quantity}x {item.description}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Unit: R$ {Number(item.unitPrice).toFixed(2)} | Custo Unit: R${' '}
                        {Number(item.costPrice || 0).toFixed(2)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-bold text-slate-900">
                        R$ {Number(item.totalPrice).toFixed(2)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.id)}
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          


          {/* Mão de Obra */}
          <div className="border rounded-xl p-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Wrench className="w-4 h-4 text-emerald-600" /> Serviços / Mão de Obra ({labors.length})
            </h3>
            {labors.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">Nenhum serviço lançado.</p>
            ) : (
              <div className="divide-y text-xs">
                {labors.map((item: any) => (
                  <div key={item.id} className="py-2 flex items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-800">
                        {item.quantity}x {item.description}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Unit: R$ {Number(item.unitPrice).toFixed(2)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-bold text-slate-900">
                        R$ {Number(item.totalPrice).toFixed(2)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.id)}
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Laudo Técnico Escrito + Desconto com Máscara R$ */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
          <div className="md:col-span-2 space-y-1.5">
            <label className="text-xs font-bold uppercase text-slate-500 block">
              Laudo Técnico / Diagnóstico Escrito (Visível no PDF e no Link do Cliente)
            </label>
            <textarea
              rows={2}
              placeholder="Descreva aqui o diagnóstico técnico detalhado..."
              value={mechanicNotes}
              onChange={(e) => setMechanicNotes(e.target.value)}
              className="w-full p-3 border rounded-xl text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase text-slate-500 block">
              Desconto Especial (R$)
            </label>
            <CurrencyInput
              value={discount}
              onChangeValue={(val) => setDiscount(val)}
              className="w-full px-3 py-2.5 border rounded-xl text-sm font-bold text-amber-700 bg-amber-50/40"
            />
            <p className="text-[11px] text-slate-400">
              Subtotal: R$ {subtotal.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Rodapé com Total Geral e Botões de Ação */}
        <div className="bg-slate-900 text-white p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs text-slate-400 block">Valor Total Final da OS</span>
            <span className="text-2xl font-extrabold text-emerald-400">
              R$ {Math.max(0, subtotal - Number(discount || 0)).toFixed(2)}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={savingBudget}
              onClick={() => handleSaveBudget(false)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Salvar Alterações
            </button>

            <button
              type="button"
              disabled={savingBudget}
              onClick={() => handleSaveBudget(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
            >
              <Send className="w-3.5 h-3.5" />
              Fechar Orçamento & Enviar p/ Aprovação
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}