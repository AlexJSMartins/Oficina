//src/pages/admin/TeamPermissionsPage.tsx
import React, { useEffect, useState } from 'react';
import { api, type User } from '../../contexts/AuthContext';
import { ShieldCheck, UserPlus, Check, Edit2, Percent } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';

const AVAILABLE_PERMISSIONS = [
  { id: 'customers:manage', label: 'Cadastrar Clientes e Veículos', group: 'Recepção' },
  { id: 'orders:checkin', label: 'Abrir Ordem de Serviço (Check-in)', group: 'Recepção' },
  { id: 'orders:diagnosis', label: 'Diagnóstico, Mudar Status e Subir Fotos/Vídeos', group: 'Oficina' },
  { id: 'orders:view_all', label: 'Visualizar Todas as OS do Pátio', group: 'Oficina' },
  { id: 'budgets:manage', label: 'Montar Orçamentos, Preços e Gerar PDF', group: 'Comercial' },
  { id: 'financial:cashflow', label: 'Contas a Pagar/Receber (Baixa de Caixa)', group: 'Financeiro' },
  { id: 'financial:dre', label: 'Relatórios Financeiros e Lucro (DRE)', group: 'Financeiro' },
  { id: 'users:manage', label: 'Gerenciar Equipe e Permissões', group: 'Administração' },
];

const ROLE_PRESETS: Record<string, string[]> = {
  MECHANIC: ['orders:diagnosis'],
  RECEPTIONIST: ['customers:manage', 'orders:checkin', 'orders:view_all', 'budgets:manage', 'financial:cashflow'],
  ADMIN: AVAILABLE_PERMISSIONS.map((p) => p.id),
};

export default function TeamPermissionsPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'MECHANIC' | 'RECEPTIONIST' | 'ADMIN'>('MECHANIC');
  const [commissionRate, setCommissionRate] = useState<number | string>(''); // Estado para a comissão
  const [selectedPerms, setSelectedPerms] = useState<string[]>(ROLE_PRESETS.MECHANIC);
  
  // Estado para edição inline da comissão na lista
  const [editingCommissionId, setEditingCommissionId] = useState<string | null>(null);
  const [tempCommissionRate, setTempCommissionRate] = useState<number | string>('');

  const { showToast } = useToast();

  const loadUsers = async () => {
    try {
      const { data } = await api.get('/auth/users');
      setUsers(data);
    } catch {
      showToast('Erro ao carregar lista de funcionários.', 'error');
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleRoleChange = (newRole: 'MECHANIC' | 'RECEPTIONIST' | 'ADMIN') => {
    setRole(newRole);
    setSelectedPerms(ROLE_PRESETS[newRole]);
    if (newRole !== 'MECHANIC') {
      setCommissionRate(''); // Zera a comissão se não for mecânico
    }
  };

  const toggleFormPerm = (permId: string) => {
    setSelectedPerms((prev) =>
      prev.includes(permId) ? prev.filter((p) => p !== permId) : [...prev, permId]
    );
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/auth/users', { 
        name, 
        email, 
        password, 
        role, 
        permissions: selectedPerms,
        commissionRate: commissionRate !== '' ? Number(commissionRate) : 0 // Envia a comissão se houver
      });
      setName('');
      setEmail('');
      setPassword('');
      setCommissionRate('');
      setRole('MECHANIC');
      setSelectedPerms(ROLE_PRESETS.MECHANIC);
      showToast('Funcionário cadastrado com sucesso!', 'success');
      loadUsers();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Erro ao cadastrar funcionário.', 'error');
    }
  };

  const toggleExistingUserPerm = async (u: User, permId: string) => {
    const newPerms = u.permissions.includes(permId)
      ? u.permissions.filter((p) => p !== permId)
      : [...u.permissions, permId];

    try {
      await api.patch(`/auth/users/${u.id}`, { permissions: newPerms });
      loadUsers();
    } catch {
      showToast('Erro ao atualizar permissão.', 'error');
    }
  };

  const handleSaveCommissionRate = async (userId: string) => {
    try {
      const rateToSave = tempCommissionRate === '' ? 0 : Number(tempCommissionRate);
      await api.patch(`/auth/users/${userId}`, { commissionRate: rateToSave });
      showToast('Comissão atualizada com sucesso!', 'success');
      setEditingCommissionId(null);
      loadUsers();
    } catch {
      showToast('Erro ao alterar comissão.', 'error');
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div className="flex items-center gap-3">
        <ShieldCheck className="w-8 h-8 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Equipe e Privilégios de Acesso</h1>
          <p className="text-sm text-slate-500">
            Defina o cargo base, comissões de produtividade e marque os checkboxes personalizados para cada acesso.
          </p>
        </div>
      </div>

      {/* Formulário de Novo Funcionário */}
      <form onSubmit={handleCreateUser} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-5">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <UserPlus className="w-5 h-5 text-blue-600" /> Cadastrar Novo Funcionário
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <input
            placeholder="Nome completo"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm"
            required
          />
          <input
            type="email"
            placeholder="E-mail de acesso"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm"
            required
          />
          <input
            type="password"
            placeholder="Senha inicial"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm"
            required
          />
          <select
            value={role}
            onChange={(e) => handleRoleChange(e.target.value as any)}
            className="px-3 py-2 border rounded-lg text-sm bg-white font-medium"
          >
            <option value="MECHANIC">Cargo: Mecânico</option>
            <option value="RECEPTIONIST">Cargo: Recepção / Secretária</option>
            <option value="ADMIN">Cargo: Administrador</option>
          </select>

          {/* Campo de Comissão condicional para o Mecânico */}
          {role === 'MECHANIC' ? (
            <div className="relative">
              <input
                type="number"
                placeholder="Comissão Padrão %"
                value={commissionRate}
                onChange={(e) => setCommissionRate(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm font-medium"
                title="Deixe em branco ou 0 para não pagar comissão padrão."
              />
              <Percent className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>
          ) : (
            <div className="bg-slate-50 border rounded-lg px-3 py-2 text-xs text-slate-400 flex items-center">
              Sem comissão direta
            </div>
          )}
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
            Privilégios deste Funcionário (Checkboxes Personalizados)
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {AVAILABLE_PERMISSIONS.map((perm) => (
              <label
                key={perm.id}
                className="flex items-start gap-2.5 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer text-sm"
              >
                <input
                  type="checkbox"
                  checked={role === 'ADMIN' || selectedPerms.includes(perm.id)}
                  disabled={role === 'ADMIN'}
                  onChange={() => toggleFormPerm(perm.id)}
                  className="mt-1 rounded text-blue-600"
                />
                <div>
                  <span className="font-medium text-slate-800 block">{perm.label}</span>
                  <span className="text-xs text-slate-400">{perm.group}</span>
                </div>
              </label>
            ))}
          </div>
        </div>

        <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-medium">
          Salvar Funcionário
        </button>
      </form>

      {/* Lista de Funcionários com Edição Rápida de Checkboxes e Comissão */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-800">Funcionários Cadastrados</h2>
        {users.map((u) => (
          <div key={u.id} className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div>
                <h3 className="font-bold text-slate-900">{u.name}</h3>
                <p className="text-xs text-slate-500">{u.email}</p>
              </div>
              
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                  {u.role}
                </span>

                {/* Bloco de Edição Rápida da Comissão (Apenas para Mecânicos ou Cargos com Comissão) */}
                {u.role === 'MECHANIC' && (
                  <div className="flex items-center gap-1.5 bg-blue-50/50 px-2 py-1 rounded-lg border border-blue-100">
                    <span className="text-xs font-bold text-slate-500">Comissão:</span>
                    {editingCommissionId === u.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          autoFocus
                          value={tempCommissionRate}
                          onChange={(e) => setTempCommissionRate(e.target.value)}
                          className="w-16 px-1.5 py-1 text-center border rounded text-xs font-bold"
                        />
                        <button onClick={() => handleSaveCommissionRate(u.id)} className="text-emerald-600 p-1 hover:bg-emerald-100 rounded transition">
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div
                        className="flex items-center gap-1.5 group cursor-pointer"
                        onClick={() => { setEditingCommissionId(u.id); setTempCommissionRate(u.commissionRate || 0); }}
                      >
                        <span className="text-xs font-extrabold text-blue-700 border-b border-blue-300 border-dashed pb-0.5">
                          {(u.commissionRate || 0)}%
                        </span>
                        <Edit2 className="w-3 h-4 text-red-800 group-hover:text-emerald-600 transition" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
              {AVAILABLE_PERMISSIONS.map((perm) => {
                const checked = u.role === 'ADMIN' || u.permissions.includes(perm.id);
                return (
                  <label
                    key={perm.id}
                    className={`flex items-center gap-2 p-2 rounded border text-xs cursor-pointer ${
                      checked ? 'bg-blue-50/50 border-blue-200 text-blue-950' : 'border-slate-100 text-slate-500'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={u.role === 'ADMIN'}
                      onChange={() => toggleExistingUserPerm(u, perm.id)}
                    />
                    <span>{perm.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}