import React, { useState, useEffect } from 'react';
import { api } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import {
  CreditCard,
  Banknote,
  QrCode,
  FileCode,
  Plus,
  Trash2,
  CheckCircle2,
  Wallet,
  ArrowLeft,
} from 'lucide-react';

interface SettleOrderModalProps {
  order: any;
  onClose: () => void;
  onSuccess: () => void;
}

interface PaymentEntry {
  id: string;
  paymentMethod: 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'CASH' | 'BOLETO' | 'TRANSFER';
  methodLabel: string;
  amount: number;
  installments: number;
  customLabel?: string;
}

const METHODS = [
  { id: 'PIX', label: 'PIX', icon: QrCode },
  { id: 'CREDIT_CARD', label: 'Cartão Crédito', icon: CreditCard },
  { id: 'DEBIT_CARD', label: 'Cartão Débito', icon: CreditCard },
  { id: 'CASH', label: 'Dinheiro', icon: Banknote },
  { id: 'BOLETO', label: 'Boleto', icon: FileCode },
  { id: 'TRANSFER', label: 'Outro / Digitar', icon: Wallet },
] as const;

export default function SettleOrderModal({ order, onClose, onSuccess }: SettleOrderModalProps) {
  const { showToast } = useToast();
  const orderTotal = Number(order.totalAmount || 0);

  // Controle de Etapas: 1 = Lançamento de Valores | 2 = Confirmação Final
  const [step, setStep] = useState<1 | 2>(1);

  const [payments, setPayments] = useState<PaymentEntry[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<PaymentEntry['paymentMethod']>('PIX');
  const [customText, setCustomText] = useState('');
  const [isInstallment, setIsInstallment] = useState(false);
  const [installments, setInstallments] = useState(2);
  const [currentAmount, setCurrentAmount] = useState(orderTotal.toFixed(2));
  const [submitting, setSubmitting] = useState(false);

  const totalAdded = payments.reduce((acc, p) => acc + p.amount, 0);
  const remaining = Math.max(0, Number((orderTotal - totalAdded).toFixed(2)));

  useEffect(() => {
    setCurrentAmount(remaining > 0 ? remaining.toFixed(2) : '0.00');
  }, [remaining]);

  const handleAddPaymentPart = () => {
    const val = Number(currentAmount);
    if (!val || val <= 0) {
      showToast('Informe um valor válido maior que zero.', 'error');
      return;
    }
    if (val > remaining + 0.05) {
      showToast(`O valor informado ultrapassa o saldo restante de R$ ${remaining.toFixed(2)}.`, 'error');
      return;
    }
    if (selectedMethod === 'TRANSFER' && !customText.trim()) {
      showToast('Digite qual foi a forma de pagamento personalizada.', 'error');
      return;
    }

    const methodObj = METHODS.find((m) => m.id === selectedMethod)!;
    const newEntry: PaymentEntry = {
      id: Math.random().toString(36).substring(2, 9),
      paymentMethod: selectedMethod,
      methodLabel: selectedMethod === 'TRANSFER' ? customText.trim() : methodObj.label,
      amount: val,
      installments: isInstallment ? installments : 1,
      customLabel: selectedMethod === 'TRANSFER' ? customText.trim() : undefined,
    };

    setPayments((prev) => [...prev, newEntry]);
    setCustomText('');
    setIsInstallment(false);
    setInstallments(2);
  };

  const handleRemovePart = (id: string) => {
    setPayments((prev) => prev.filter((p) => p.id !== id));
  };

  // Botão "Avançar" - Valida se tudo está preenchido antes de ir para a Etapa 2
  const handleGoToConfirm = () => {
    let currentPayments = [...payments];

    // Se a pessoa não clicou no botão "Adicionar Forma" mas o valor já bate
    if (currentPayments.length === 0) {
      const val = Number(currentAmount);
      if (Math.abs(val - orderTotal) > 0.05) {
        showToast('Clique em "+ Adicionar" para dividir o valor em mais de uma forma.', 'error');
        return;
      }
      if (selectedMethod === 'TRANSFER' && !customText.trim()) {
        showToast('Digite qual foi a forma de pagamento personalizada.', 'error');
        return;
      }

      const methodObj = METHODS.find((m) => m.id === selectedMethod)!;
      currentPayments = [
        {
          id: 'single',
          paymentMethod: selectedMethod,
          methodLabel: selectedMethod === 'TRANSFER' ? customText.trim() : methodObj.label,
          amount: val,
          installments: isInstallment ? installments : 1,
          customLabel: selectedMethod === 'TRANSFER' ? customText.trim() : undefined,
        },
      ];
      setPayments(currentPayments);
    } else if (remaining > 0.05) {
      showToast(`Ainda faltam R$ ${remaining.toFixed(2)} para completar o valor da OS.`, 'error');
      return;
    }

    // Tudo certo? Vai para a Etapa 2 de Confirmação!
    setStep(2);
  };

  // Botão Final do Passo 2 que realmente envia para o banco de dados
  const handleFinalSubmit = async () => {
    setSubmitting(true);
    try {
      await api.post(`/financial/settle-order/${order.id}`, {
        payments: payments.map((p) => ({
          paymentMethod: p.paymentMethod,
          amount: p.amount,
          installments: p.installments,
          customLabel: p.customLabel,
        })),
      });

      showToast(`OS #${order.number} recebida e lançada no Fluxo de Caixa!`, 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Erro ao registrar recebimento.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl max-h-[92vh] overflow-y-auto">
        
        {/* Cabeçalho */}
        <div className="flex justify-between items-center border-b pb-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {step === 1 ? `Receber Pagamento — OS #${order.number}` : `Confirmar Baixa — OS #${order.number}`}
            </h2>
            <p className="text-xs text-slate-500">
              {order.vehicle.brand} {order.vehicle.model} ({order.vehicle.plate}) • {order.customer.name}
            </p>
          </div>
          {/* O "X" superior só fecha de vez se o usuário realmente quiser cancelar a operação inteira */}
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 font-bold text-lg">
            ✕
          </button>
        </div>

        {/* ===================== ETAPA 1: LANÇAMENTOS ===================== */}
        {step === 1 && (
          <>
            <div className="grid grid-cols-3 gap-2 bg-slate-900 text-white p-4 rounded-xl text-center">
              <div>
                <span className="text-[10px] uppercase text-slate-400 block">Total da OS</span>
                <span className="text-base font-extrabold text-white">R$ {orderTotal.toFixed(2)}</span>
              </div>
              <div className="border-x border-slate-700">
                <span className="text-[10px] uppercase text-slate-400 block">Já Lançado</span>
                <span className="text-base font-extrabold text-emerald-400">
                  R$ {totalAdded.toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-slate-400 block">Falta Receber</span>
                <span className={`text-base font-extrabold ${remaining > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  R$ {remaining.toFixed(2)}
                </span>
              </div>
            </div>

            {remaining > 0 && (
              <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  1. Selecione a Forma de Pagamento
                </label>

                <div className="grid grid-cols-3 gap-2">
                  {METHODS.map((m) => {
                    const Icon = m.icon;
                    const active = selectedMethod === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setSelectedMethod(m.id)}
                        className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-semibold gap-1 transition ${
                          active
                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{m.label}</span>
                      </button>
                    );
                  })}
                </div>

                {selectedMethod === 'TRANSFER' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Qual foi a forma?</label>
                    <input
                      placeholder="Ex: Cheque, Permuta, TED..."
                      value={customText}
                      onChange={(e) => setCustomText(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-xs bg-white"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Condição</label>
                    <div className="grid grid-cols-2 gap-1 bg-white p-1 rounded-lg border">
                      <button
                        type="button"
                        onClick={() => setIsInstallment(false)}
                        className={`py-1.5 rounded-md text-xs font-bold ${!isInstallment ? 'bg-slate-900 text-white' : 'text-slate-600'}`}
                      >
                        À Vista
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsInstallment(true)}
                        className={`py-1.5 rounded-md text-xs font-bold ${isInstallment ? 'bg-slate-900 text-white' : 'text-slate-600'}`}
                      >
                        Parcelado
                      </button>
                    </div>
                  </div>

                  {isInstallment ? (
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Nº de Parcelas</label>
                      <select
                        value={installments}
                        onChange={(e) => setInstallments(Number(e.target.value))}
                        className="w-full px-3 py-2 border rounded-lg text-xs bg-white font-semibold"
                      >
                        {Array.from({ length: 11 }, (_, i) => i + 2).map((n) => (
                          <option key={n} value={n}>
                            {n}x de R$ {(Number(currentAmount || 0) / n).toFixed(2)}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Valor do Pagamento</label>
                      <input
                        type="number"
                        step="0.01"
                        value={currentAmount}
                        onChange={(e) => setCurrentAmount(e.target.value)}
                        className="w-full px-3 py-2 border border-blue-400 rounded-lg text-xs font-bold bg-white"
                      />
                    </div>
                  )}
                </div>

                {isInstallment && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Valor a Parcelar (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={currentAmount}
                      onChange={(e) => setCurrentAmount(e.target.value)}
                      className="w-full px-3 py-2 border border-blue-400 rounded-lg text-xs font-bold bg-white"
                    />
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleAddPaymentPart}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                >
                  <Plus className="w-4 h-4" /> Adicionar Forma de Pagamento
                </button>
              </div>
            )}

            {payments.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase text-slate-500">Formas de Pagamento Selecionadas</h3>
                <div className="divide-y border rounded-xl overflow-hidden text-xs">
                  {payments.map((p) => (
                    <div key={p.id} className="p-3 flex justify-between items-center bg-emerald-50/40">
                      <div>
                        <span className="font-bold text-slate-800">{p.methodLabel}</span>
                        <span className="text-slate-500 ml-2">
                          {p.installments > 1 ? `(${p.installments}x de R$ ${(p.amount / p.installments).toFixed(2)})` : '(À vista)'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-extrabold text-emerald-700">R$ {p.amount.toFixed(2)}</span>
                        <button type="button" onClick={() => handleRemovePart(p.id)} className="text-red-500 hover:text-red-700">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t">
              <button type="button" onClick={onClose} className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold">
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleGoToConfirm}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition"
              >
                Avançar p/ Resumo <CheckCircle2 className="w-4 h-4" />
              </button>
            </div>
          </>
        )}

        {/* ===================== ETAPA 2: RESUMO E CONFIRMAÇÃO FINAL ===================== */}
        {step === 2 && (
          <div className="space-y-5">
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl">
              <h3 className="text-sm font-bold text-amber-900 mb-1">Confirmação de Baixa</h3>
              <p className="text-xs text-amber-800">
                Você está prestes a fechar a OS e registrar os seguintes recebimentos no Caixa:
              </p>
            </div>

            <div className="divide-y border rounded-xl overflow-hidden text-sm">
              {payments.map((p) => (
                <div key={p.id} className="p-3 flex justify-between items-center bg-slate-50">
                  <div>
                    <span className="font-bold text-slate-800 block">{p.methodLabel}</span>
                    <span className="text-xs text-slate-500">
                      {p.installments > 1 ? `${p.installments}x sem juros` : 'Pagamento à vista'}
                    </span>
                  </div>
                  <span className="font-extrabold text-slate-900">R$ {p.amount.toFixed(2)}</span>
                </div>
              ))}
              <div className="p-3 bg-emerald-50 flex justify-between items-center">
                <span className="font-bold text-emerald-900 uppercase text-xs">Total Lançado</span>
                <span className="font-extrabold text-emerald-700 text-lg">R$ {totalAdded.toFixed(2)}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t">
              {/* O "Cancelar" aqui não fecha tudo, ele VOLTA para a Etapa 1 mantendo tudo salvo! */}
              <button
                type="button"
                disabled={submitting}
                onClick={() => setStep(1)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" /> Voltar / Editar
              </button>
              
              <button
                type="button"
                disabled={submitting}
                onClick={handleFinalSubmit}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition"
              >
                <CheckCircle2 className="w-4 h-4" />
                {submitting ? 'Processando...' : 'Confirmar & Finalizar OS'}
              </button>
            </div>
          </div>
        )}
        
      </div>
    </div>
  );
}