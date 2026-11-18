import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Car, Building2, User, Mail, Lock, Phone, FileText, ArrowRight, CheckCircle2 } from 'lucide-react';

export default function RegisterPage() {
  const { registerWorkshop } = useAuth();
  const navigate = useNavigate();

  const [workshopName, setWorkshopName] = useState('');
  const [document, setDocument] = useState('');
  const [phone, setPhone] = useState('');
  const [adminName, setAdminName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas digitadas não coincidem.');
      return;
    }

    setLoading(true);
    try {
      await registerWorkshop({
        workshopName,
        document,
        phone,
        adminName,
        email,
        password,
      });
      navigate('/admin');
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          'Não foi possível criar sua conta. Verifique os dados e tente novamente.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col lg:flex-row">
      {/* Coluna Esquerda: Apresentação Comercial para o Lead */}
      <div className="lg:w-5/12 bg-gradient-to-br from-blue-900 via-slate-900 to-slate-950 p-8 lg:p-12 flex flex-col justify-between text-white border-b lg:border-b-0 lg:border-r border-slate-800">
        <div>
          <div className="flex items-center gap-3 font-bold text-blue-400 text-xl tracking-wide mb-10">
            <div className="bg-blue-600 text-white p-2 rounded-xl shadow-lg">
              <Car className="w-6 h-6" />
            </div>
            <span>Oficina Pro</span>
          </div>

          <h1 className="text-3xl lg:text-4xl font-extrabold leading-tight mb-4">
            Crie o ambiente exclusivo da sua oficina em 1 minuto.
          </h1>
          <p className="text-slate-300 text-sm lg:text-base mb-8">
            Gerencie ordens de serviço no Kanban, envie orçamentos no WhatsApp com fotos e vídeos, controle estoque, comissões e emita notas fiscais sem complicação.
          </p>

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-sm">Ambiente 100% Isolado e Seguro</h3>
                <p className="text-xs text-slate-400">
                  Seus clientes, veículos, estoque e financeiro ficam em uma sala exclusiva da sua empresa.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-sm">Acesso para Toda a Sua Equipe</h3>
                <p className="text-xs text-slate-400">
                  Cadastre mecânicos e recepcionistas com permissões personalizadas e cálculo de comissão.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-sm">Portal de Acompanhamento do Cliente</h3>
                <p className="text-xs text-slate-400">
                  Link transparente com a marca da sua oficina para o cliente aprovar orçamentos pelo celular.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-slate-800/80 text-xs text-slate-400">
          Já possui uma conta cadastrada?{' '}
          <Link to="/login" className="text-blue-400 hover:text-blue-300 font-semibold underline">
            Fazer login no sistema
          </Link>
        </div>
      </div>

      {/* Coluna Direita: Formulário de Cadastro */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 bg-slate-950">
        <div className="w-full max-w-lg bg-slate-900/90 border border-slate-800 rounded-2xl p-6 lg:p-8 shadow-2xl">
          <h2 className="text-xl font-bold text-white mb-1">Cadastre sua Oficina</h2>
          <p className="text-xs text-slate-400 mb-6">
            Preencha os dados abaixo para liberar seu acesso de Administrador imediatamente.
          </p>

          {error && (
            <div className="mb-5 bg-red-500/10 border border-red-500/30 text-red-300 px-4 py-3 rounded-xl text-xs font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Dados da Oficina */}
            <div className="space-y-3 pb-3 border-b border-slate-800">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400 block">
                1. Dados da Oficina
              </span>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Nome Fantasia da Oficina *
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    required
                    placeholder="Ex: Auto Center Silva"
                    value={workshopName}
                    onChange={(e) => setWorkshopName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    CNPJ ou CPF (Opcional)
                  </label>
                  <div className="relative">
                    <FileText className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      placeholder="00.000.000/0001-00"
                      value={document}
                      onChange={(e) => setDocument(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    WhatsApp / Telefone *
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      required
                      placeholder="(11) 99999-9999"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Dados do Administrador */}
            <div className="space-y-3 pt-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400 block">
                2. Seus Dados de Acesso (Administrador)
              </span>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Seu Nome Completo *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    required
                    placeholder="Ex: Carlos Silva"
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  E-mail de Acesso *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="email"
                    required
                    placeholder="contato@suaoficina.com.br"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Crie uma Senha *
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                    <input
                      type="password"
                      required
                      placeholder="Mínimo 6 caracteres"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Confirme a Senha *
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                    <input
                      type="password"
                      required
                      placeholder="Repita a senha"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 transition-all text-sm cursor-pointer"
            >
              {loading ? (
                'Criando ambiente da oficina...'
              ) : (
                <>
                  <span>Criar Minha Conta e Acessar Painel</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-slate-400 lg:hidden">
            Já possui uma conta?{' '}
            <Link to="/login" className="text-blue-400 font-semibold underline">
              Fazer login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}