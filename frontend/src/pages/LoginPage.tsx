import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import {
  Car,
  Mail,
  Lock,
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const loggedUser = await login(email, password);
      if (loggedUser.role === 'MECHANIC') {
        navigate('/mechanic');
      } else {
        navigate('/admin');
      }
    } catch {
      const msg = 'E-mail ou senha inválidos. Verifique suas credenciais.';
      setError(msg);
      showToast('E-mail ou senha inválidos.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col lg:flex-row">
      {/* Coluna Esquerda: Apresentação do Sistema */}
      <div className="lg:w-5/12 bg-gradient-to-br from-blue-900 via-slate-900 to-slate-950 p-8 lg:p-12 flex flex-col justify-between text-white border-b lg:border-b-0 lg:border-r border-slate-800">
        <div>
          <div className="flex items-center gap-3 font-bold text-blue-400 text-xl tracking-wide mb-10">
            <div className="bg-blue-600 text-white p-2 rounded-xl shadow-lg">
              <Car className="w-6 h-6" />
            </div>
            <span>Oficina Pro</span>
          </div>

          <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 text-blue-300 px-3 py-1 rounded-full text-xs font-semibold mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Gestão Inteligente para Centros Automotivos</span>
          </div>

          <h1 className="text-3xl lg:text-4xl font-extrabold leading-tight mb-4">
            Bem-vindo de volta ao painel da sua oficina.
          </h1>
          <p className="text-slate-300 text-sm lg:text-base mb-8">
            Acompanhe o pátio em tempo real, envie diagnósticos com vídeos pelo WhatsApp e tenha controle total do seu estoque, comissões e caixa.
          </p>

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-sm">Pátio e Ordens de Serviço no Kanban</h3>
                <p className="text-xs text-slate-400">
                  Visualize rapidamente cada veículo do check-in até a entrega final.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-sm">Financeiro, DRE e Comissões Automáticas</h3>
                <p className="text-xs text-slate-400">
                  Lucro real descontando custo de peças (CMV) e cálculo automático da equipe.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-sm">Ambiente Multi-Empresa Isolado</h3>
                <p className="text-xs text-slate-400">
                  Acesso criptografado com permissões granulares para administradores, recepção e mecânicos.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-slate-800/80 text-xs text-slate-400">
          Sua oficina ainda não usa o Oficina Pro?{' '}
          <Link to="/cadastro" className="text-blue-400 hover:text-blue-300 font-semibold underline">
            Criar conta grátis agora
          </Link>
        </div>
      </div>

      {/* Coluna Direita: Card de Login */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 bg-slate-950">
        <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-2xl p-6 lg:p-8 shadow-2xl">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-white mb-1">Acessar Sistema</h2>
            <p className="text-xs text-slate-400">
              Entre com seu e-mail e senha para abrir o ambiente da sua oficina.
            </p>
          </div>

          {error && (
            <div className="mb-5 bg-red-500/10 border border-red-500/30 text-red-300 px-4 py-3 rounded-xl text-xs font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                E-mail de Acesso
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  placeholder="seu@email.com.br"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-slate-300">
                  Senha
                </label>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 transition-all text-sm cursor-pointer"
            >
              {loading ? (
                'Autenticando...'
              ) : (
                <>
                  <span>Entrar no Sistema</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Rodapé com CTA para Cadastro */}
          <div className="mt-6 pt-6 border-t border-slate-800 text-center">
            <p className="text-xs text-slate-400">
              Ainda não tem acesso para sua oficina?
            </p>
            <Link
              to="/cadastro"
              className="mt-2 inline-flex items-center justify-center gap-1.5 text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors"
            >
              <span>Cadastre sua oficina gratuitamente</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}