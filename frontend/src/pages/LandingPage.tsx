// frontend/src/pages/LandingPage.tsx

import {
  Car,
  Wrench,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Check,
  X,
  Zap,
  FileText,
  Undo2,
  MessageCircle,
  Camera,
  TrendingUp,
  Package,
  Users,
  Clock,
  ChevronDown,
  Menu,
  LogIn,
  Star,
  Download,
  AlertTriangle,
  Upload,
  DollarSign,
  Smartphone,
  Award,
  Layers,
} from 'lucide-react';

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../contexts/AuthContext';

// Tipagem do plano público retornado pela API
interface PublicPlan {
  id: string;
  slug: string;
  name: string;
  subtitle?: string | null;
  badge?: string | null;
  isPopular: boolean;
  isCustomContact: boolean;
  whatsappNumber?: string | null;
  whatsappMessage?: string | null;
  monthlyPrice: number;
  annualCashPrice: number;
  annualCardPrice: number;
  maxInstallments: number;
  allowFiscalEmission: boolean;
  maxMonthlyInvoices: number;
  maxUsers: number;
  features: string[];
}

type PreviewTab = 'KANBAN' | 'DEVOLUCAO' | 'PORTAL' | 'FINANCEIRO';

const PREVIEW_TABS: {
  id: PreviewTab;
  label: string;
  tag: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  bullets: string[];
}[] = [
  {
    id: 'KANBAN',
    label: 'Pátio Kanban & OS',
    tag: 'Operação',
    icon: <Layers className="w-4 h-4" />,
    title: 'Visualize todos os carros do pátio em tempo real — do check-in à entrega',
    description:
      'Dê entrada pela placa em 10 segundos (com autopreenchimento e fotos de vistoria), atribua mecânicos, monte orçamentos com peças do estoque e emita a nota fiscal logo após receber.',
    bullets: [
      'Check-in unificado com busca automática de placa e fotos de avarias',
      'Orçamento em PDF com sua logo, cores da oficina e termos de garantia',
      'Ao finalizar o pagamento, o sistema já oferece emitir NF-e / NFS-e em 1 clique',
    ],
  },
  {
    id: 'DEVOLUCAO',
    label: 'Devolução em 30s',
    tag: 'Exclusivo',
    icon: <Undo2 className="w-4 h-4" />,
    title: 'Emita NF-e de Devolução para a autopeças sem errar um único CFOP',
    description:
      'A maior dor de cabeça da oficina resolvida em 3 cliques: escolha a nota de compra já importada ou suba o XML na hora, marque a peça e a quantidade devolvida e transmita.',
    bullets: [
      'Inverte automaticamente o CFOP (5102 → 5202, 5405 → 5411, 6102 → 6202)',
      'Calcula ICMS, ICMS-ST e IPI proporcionalmente em devoluções parciais',
      'Preenche chave referenciada, texto legal nos dados adicionais e abate do estoque',
    ],
  },
  {
    id: 'PORTAL',
    label: 'Portal do Cliente',
    tag: '+42% Aprovação',
    icon: <Smartphone className="w-4 h-4" />,
    title: 'Transparência que faz o cliente aprovar o orçamento sem pechinchar',
    description:
      'O mecânico tira foto ou grava vídeo da peça desgastada direto pelo celular. Com 1 clique no WhatsApp, o cliente acompanha a linha do tempo do carro sem precisar ficar ligando.',
    bullets: [
      'Link público exclusivo por OS — o cliente não precisa baixar aplicativo',
      'Fotos e vídeos em alta qualidade provam a necessidade do serviço',
      'CRM avisa automaticamente quem completou 6 meses ou +10.000 km para recall',
    ],
  },
  {
    id: 'FINANCEIRO',
    label: 'Financeiro, DRE & XML',
    tag: 'Lucro Real',
    icon: <TrendingUp className="w-4 h-4" />,
    title: 'Saiba exatamente quanto sobrou no bolso — descontando peças e comissões',
    description:
      'Importe o XML da autopeças para cadastrar fornecedor e estoque automaticamente. Na saída da OS, o sistema separa receita de peças, mão de obra, CMV e comissão do mecânico.',
    bullets: [
      'DRE automático separando Mão de Obra, Peças, Custo (CMV) e Despesas Fixas',
      'Monitor de peças defeituosas e ranking de qualidade dos fornecedores',
      'Pacote .ZIP mensal com XMLs e PDFs pronto para enviar ao contador em 1 clique',
    ],
  },
];
const FALLBACK_PLANS: PublicPlan[] = [
  {
    id: 'gestao-essencial',
    slug: 'gestao-essencial',
    name: 'Gestão Essencial',
    subtitle: 'Controle total do pátio, clientes, estoque e lucro sem emissão fiscal.',
    badge: null,
    isPopular: false,
    isCustomContact: false,
    monthlyPrice: 99,
    annualCashPrice: 990,
    annualCardPrice: 1128,
    maxInstallments: 12,
    allowFiscalEmission: false,
    maxMonthlyInvoices: 0,
    maxUsers: 5,
    features: [
      'Pátio Kanban completo e Check-in com fotos/vídeos',
      'Portal do Cliente em tempo real via WhatsApp',
      'Orçamentos em PDF com a logo e cores da oficina',
      'CRM + Alerta de Revisão (6 meses / 10k km)',
      'Estoque, Fornecedores e Monitor de Defeitos',
      'Financeiro completo, DRE e Comissões',
    ],
  },
  {
    id: 'fiscal-100',
    slug: 'fiscal-100',
    name: 'Profissional 100',
    subtitle: 'Gestão completa + até 100 notas fiscais por mês com devolução em 30s.',
    badge: null,
    isPopular: false,
    isCustomContact: false,
    monthlyPrice: 189,
    annualCashPrice: 1890,
    annualCardPrice: 2148,
    maxInstallments: 12,
    allowFiscalEmission: true,
    maxMonthlyInvoices: 100,
    maxUsers: 10,
    features: [
      'Tudo do plano Gestão Essencial incluso',
      'Até 100 notas fiscais/mês (NF-e, NFC-e e NFS-e)',
      'Nota de Devolução automática em 30 segundos',
      'Importação de XML de compra para o estoque',
      'Pré-DANFE visual + ZIP mensal para o Contador',
    ],
  },
  {
    id: 'fiscal-300',
    slug: 'fiscal-300',
    name: 'Master 300',
    subtitle: 'O favorito de centros automotivos com alto giro de peças e serviços.',
    badge: 'Mais Escolhido',
    isPopular: true,
    isCustomContact: false,
    monthlyPrice: 299,
    annualCashPrice: 2990,
    annualCardPrice: 3396,
    maxInstallments: 12,
    allowFiscalEmission: true,
    maxMonthlyInvoices: 300,
    maxUsers: 25,
    features: [
      'Tudo do plano Profissional 100 incluso',
      'Até 300 notas fiscais/mês (NF-e, NFC-e, NFS-e e Devoluções)',
      'Até 25 usuários com permissões por cargo',
      'Configuração assistida do Certificado Digital A1',
      'Suporte prioritário no WhatsApp',
    ],
  },
  {
    id: 'personalizado',
    slug: 'personalizado',
    name: 'Personalizado',
    subtitle: 'Para grandes centros automotivos ou redes com mais de 300 notas/mês.',
    badge: '+300 Notas',
    isPopular: false,
    isCustomContact: true,
    whatsappNumber: '5517999999999',
    whatsappMessage:
      'Olá! Quero montar um plano personalizado acima de 300 notas/mês no Oficina Pro.',
    monthlyPrice: 0,
    annualCashPrice: 0,
    annualCardPrice: 0,
    maxInstallments: 12,
    allowFiscalEmission: true,
    maxMonthlyInvoices: 1000,
    maxUsers: 999,
    features: [
      'Cota de notas sob medida (+300 notas/mês)',
      'Usuários e mecânicos ilimitados',
      'Migração assistida de planilhas e estoque',
      'Implantação fiscal dedicada com especialista',
    ],
  },
];

const FAQS = [
  {
    q: 'Preciso cadastrar cartão de crédito para testar os 30 dias grátis?',
    a: 'Não! Você cria a conta da sua oficina em menos de 1 minuto, sem informar cartão de crédito e sem nenhuma cobrança automática. Só escolhe um plano ao final dos 30 dias se amar o sistema.',
  },
  {
    q: 'Já tenho meus clientes, peças e financeiro em planilhas do Excel. Vou perder tudo?',
    a: 'De jeito nenhum. O Oficina Pro possui importador inteligente de Excel/CSV para clientes, veículos, histórico de manutenções, catálogo de peças e lançamentos financeiros — você migra sua base inteira em minutos.',
  },
  {
    q: 'Como funciona a Nota de Devolução em 30 segundos?',
    a: 'Você seleciona a nota de compra já importada (ou sobe o XML da autopeças na hora), marca com checkbox quais peças vai devolver e a quantidade. O sistema inverte o CFOP (5102→5202, 5405→5411), calcula ICMS/ST/IPI proporcionais, vincula a chave de 44 dígitos, gera o Pré-DANFE e transmite.',
  },
  {
    q: 'Os mecânicos conseguem usar no celular dentro da oficina?',
    a: 'Sim! A Área do Mecânico foi feita sob medida para celular. Ele vê apenas os carros atribuídos a ele, tira fotos e grava vídeos das avarias e muda o status do reparo sem ver informações financeiras ou faturamento da oficina.',
  },
  {
    q: 'Preciso ter Certificado Digital A1 para começar a testar?',
    a: 'Não. Você já pode testar todas as telas — inclusive simular emissão de NF-e, NFS-e e Nota de Devolução em modo Sandbox — sem certificado. Quando quiser emitir com validade fiscal na SEFAZ, basta subir seu arquivo A1 (.pfx) nas configurações.',
  },
  {
    q: 'Existe multa de fidelidade se eu decidir cancelar?',
    a: 'Zero fidelidade e zero burocracia. No plano mensal você cancela quando quiser, e seus dados e XMLs ficam disponíveis para exportação.',
  },
];

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activePreview, setActivePreview] = useState<PreviewTab>('KANBAN');
  const [billingCycle, setBillingCycle] = useState<'ANNUAL' | 'MONTHLY'>('ANNUAL');
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const [plans, setPlans] = useState<PublicPlan[]>(FALLBACK_PLANS);

  useEffect(() => {
    api
      .get('/billing/plans')
      .then((res) => {
        if (Array.isArray(res.data) && res.data.length > 0) {
          setPlans(res.data);
        }
      })
      .catch(() => {
        // Mantém fallback se a API estiver indisponível
      });
  }, []);

  const activeTabInfo = PREVIEW_TABS.find((t) => t.id === activePreview) || PREVIEW_TABS[0];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-blue-600 selection:text-white">
      {/* ================================================================
          NAVBAR FIXA COM GLASSMORPHISM
         ================================================================ */}
      <header className="sticky top-0 z-50 bg-slate-950/85 backdrop-blur-md border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Logo */}
          <a href="#topo" className="flex items-center gap-2.5 group">
            <div className="bg-gradient-to-br from-blue-500 to-blue-700 text-white p-2 rounded-xl shadow-lg shadow-blue-600/30 group-hover:scale-105 transition">
              <Car className="w-5 h-5" />
            </div>
            <div className="leading-none">
              <span className="font-extrabold text-lg tracking-tight text-white">
                Oficina <span className="text-blue-400">Pro</span>
              </span>
              <span className="block text-[10px] text-slate-400 font-medium tracking-wider uppercase">
                Gestão & Fiscal Automotivo
              </span>
            </div>
          </a>

          {/* Links Desktop */}
          <nav className="hidden lg:flex items-center gap-7 text-xs font-semibold text-slate-300">
            <a href="#sistema" className="hover:text-white transition">
              Por Dentro do Sistema
            </a>
            <a href="#diferenciais" className="hover:text-white transition">
              Diferenciais
            </a>
            <a href="#antes-depois" className="hover:text-white transition">
              Antes x Depois
            </a>
            <a href="#planos" className="hover:text-white transition">
              Planos e Preços
            </a>
            <a href="#faq" className="hover:text-white transition">
              Dúvidas
            </a>
          </nav>

          {/* Ações Desktop: Entrar + 30 Dias Grátis */}
          <div className="hidden sm:flex items-center gap-2.5">
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-700 hover:border-slate-500 bg-slate-900/80 hover:bg-slate-800 text-slate-200 hover:text-white text-xs font-bold transition"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Entrar</span>
            </Link>
            <Link
              to="/cadastro"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 transition"
            >
              <span>Testar 30 Dias Grátis</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Botão Mobile */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="lg:hidden p-2 rounded-lg text-slate-300 hover:bg-slate-800 cursor-pointer"
            aria-label="Abrir menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Menu Mobile Dropdown */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-slate-900 border-b border-slate-800 px-4 py-4 space-y-3 text-sm">
            <div className="flex flex-col gap-2 text-slate-300 font-medium">
              <a href="#sistema" onClick={() => setMobileMenuOpen(false)} className="py-1.5 hover:text-white">
                Por Dentro do Sistema
              </a>
              <a href="#diferenciais" onClick={() => setMobileMenuOpen(false)} className="py-1.5 hover:text-white">
                Diferenciais
              </a>
              <a href="#antes-depois" onClick={() => setMobileMenuOpen(false)} className="py-1.5 hover:text-white">
                Antes x Depois
              </a>
              <a href="#planos" onClick={() => setMobileMenuOpen(false)} className="py-1.5 hover:text-white">
                Planos e Preços
              </a>
              <a href="#faq" onClick={() => setMobileMenuOpen(false)} className="py-1.5 hover:text-white">
                Dúvidas
              </a>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-800">
              <Link
                to="/login"
                className="py-2.5 text-center rounded-xl border border-slate-700 text-white text-xs font-bold"
              >
                Entrar
              </Link>
              <Link
                to="/cadastro"
                className="py-2.5 text-center rounded-xl bg-blue-600 text-white text-xs font-bold"
              >
                30 Dias Grátis
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ================================================================
          HERO SECTION (ALTA CONVERSÃO)
         ================================================================ */}
      <section id="topo" className="relative overflow-hidden pt-14 pb-20 lg:pt-20 lg:pb-24">
        {/* Glows de fundo */}
        <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[900px] h-[420px] bg-blue-600/20 blur-[130px] rounded-full" />
        <div className="pointer-events-none absolute top-40 right-0 w-[380px] h-[380px] bg-emerald-500/10 blur-[120px] rounded-full" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-4xl mx-auto space-y-6">
            {/* Selo de oferta */}
            <div className="inline-flex flex-wrap items-center justify-center gap-2 bg-blue-500/10 border border-blue-500/30 text-blue-300 px-4 py-1.5 rounded-full text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>EXPERIMENTE GRÁTIS POR 30 DIAS</span>
              <span className="text-slate-500">•</span>
              <span className="text-emerald-300">Sem cartão de crédito</span>
            </div>

            {/* Headline Principal */}
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.1]">
              Pare de perder dinheiro com{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-300 to-emerald-400">
                peça parada, nota travada
              </span>{' '}
              e orçamento ignorado.
            </h1>

            {/* Subheadline */}
            <p className="text-sm sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
              O sistema completo feito para a rotina real da oficina mecânica: controle o pátio no{' '}
              <strong className="text-white">Kanban</strong>, encante o cliente com{' '}
              <strong className="text-white">fotos e vídeos no WhatsApp</strong>, feche o{' '}
              <strong className="text-white">DRE com lucro real</strong> e emita{' '}
              <strong className="text-white">NF-e, NFS-e e Nota de Devolução em 30 segundos</strong>.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <Link
                to="/cadastro"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-extrabold text-sm sm:text-base shadow-xl shadow-blue-600/30 transition transform hover:-translate-y-0.5"
              >
                <span>Começar Meus 30 Dias Grátis</span>
                <ArrowRight className="w-5 h-5" />
              </Link>

              <a
                href="#sistema"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-bold text-sm transition"
              >
                <span>Ver o Sistema Por Dentro</span>
              </a>

              <Link
                to="/login"
                className="sm:hidden w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl border border-slate-800 text-slate-300 font-semibold text-xs"
              >
                <LogIn className="w-4 h-4" />
                <span>Já tenho conta — Entrar</span>
              </Link>
            </div>

            {/* Micro-provas de confiança */}
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-3 text-xs text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Implantação em 5 minutos
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Funciona no celular e PC
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Importe seus clientes do Excel
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Cancele quando quiser
              </span>
            </div>
          </div>

          {/* Métricas de Impacto */}
          <div className="mt-14 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 max-w-5xl mx-auto">
            {[
              {
                value: '30 seg',
                label: 'Para emitir NF-e de Devolução',
                sub: 'CFOP e impostos invertidos sozinhos',
                color: 'text-purple-400',
              },
              {
                value: '+42%',
                label: 'Mais orçamentos aprovados',
                sub: 'Com fotos e vídeos reais no WhatsApp',
                color: 'text-emerald-400',
              },
              {
                value: '1 clique',
                label: 'NF-e + NFS-e direto da OS',
                sub: 'Separa peças e mão de obra na hora',
                color: 'text-blue-400',
              },
              {
                value: '100%',
                label: 'Lucro líquido visível no DRE',
                sub: 'Descontando CMV de peças e comissões',
                color: 'text-amber-400',
              },
            ].map((m) => (
              <div
                key={m.label}
                className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 text-center"
              >
                <div className={`text-2xl sm:text-3xl font-extrabold ${m.color}`}>{m.value}</div>
                <div className="text-xs sm:text-sm font-bold text-white mt-1">{m.label}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">{m.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================
          POR DENTRO DO SISTEMA (IMAGENS / TELAS INTERATIVAS DO SISTEMA)
         ================================================================ */}
      <section id="sistema" className="py-20 bg-slate-900/50 border-y border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-10">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <span className="text-xs font-extrabold uppercase tracking-widest text-blue-400">
              Por Dentro do Oficina Pro
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white">
              Veja as telas reais que aceleram sua oficina todos os dias
            </h2>
            <p className="text-sm text-slate-400">
              Clique nas abas abaixo para explorar cada módulo exatamente como sua equipe vai usar no dia a dia.
            </p>
          </div>

          {/* Seletor de Telas */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            {PREVIEW_TABS.map((tab) => {
              const active = activePreview === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActivePreview(tab.id)}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold border transition cursor-pointer ${
                    active
                      ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/25'
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-md font-extrabold ${
                      active ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {tab.tag}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Container: Descrição à Esquerda + Tela Visual do Sistema à Direita */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Explicação */}
            <div className="lg:col-span-4 space-y-5">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs font-bold">
                {activeTabInfo.icon}
                <span>{activeTabInfo.label}</span>
              </div>

              <h3 className="text-xl sm:text-2xl font-extrabold text-white leading-snug">
                {activeTabInfo.title}
              </h3>

              <p className="text-sm text-slate-300 leading-relaxed">{activeTabInfo.description}</p>

              <ul className="space-y-3 text-xs sm:text-sm text-slate-200">
                {activeTabInfo.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>

              <div className="pt-2">
                <Link
                  to="/cadastro"
                  className="inline-flex items-center gap-2 text-xs font-extrabold text-blue-400 hover:text-blue-300 transition"
                >
                  <span>Testar este módulo grátis por 30 dias</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* Mockup / Imagem Interativa da Tela do Sistema */}
            <div className="lg:col-span-8">
              <div className="rounded-2xl border border-slate-700/80 bg-slate-950 shadow-2xl shadow-blue-950/40 overflow-hidden">
                {/* Barra de Janela do Navegador */}
                <div className="bg-slate-900 border-b border-slate-800 px-4 py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                  </div>
                  
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                    AO VIVO
                  </span>
                </div>

                {/* TELA 1: KANBAN DO PÁTIO */}
                {activePreview === 'KANBAN' && (
                  <div className="p-4 sm:p-5 bg-slate-100 text-slate-900 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-extrabold text-slate-900">
                          Pátio da Oficina — Monitoramento em Tempo Real
                        </div>
                        <div className="text-[11px] text-slate-500">
                          12 veículos ativos • 4 prontos para retirada
                        </div>
                      </div>
                      <span className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-[11px] font-bold">
                        + Dar Entrada (Check-in)
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/* Coluna Diagnóstico */}
                      <div className="bg-slate-200/70 rounded-xl p-2.5 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                            2. Em Diagnóstico
                          </span>
                          <span className="text-[11px] font-bold text-slate-500">3</span>
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-400">#1048</span>
                            <span className="bg-slate-900 text-white font-mono text-[10px] font-bold px-1.5 py-0.5 rounded">
                              FGH4J21
                            </span>
                          </div>
                          <div className="text-xs font-extrabold text-slate-900">
                            VW T-Cross 1.4 TSI (2023)
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Carlos Mendes • Mec.: Rafael
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] bg-blue-50 text-blue-700 px-2 py-1 rounded font-semibold">
                            <Camera className="w-3 h-3" /> 4 fotos e 1 vídeo anexados
                          </div>
                        </div>
                      </div>

                      {/* Coluna Em Reparação */}
                      <div className="bg-slate-200/70 rounded-xl p-2.5 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                            4. Em Reparação
                          </span>
                          <span className="text-[11px] font-bold text-slate-500">5</span>
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-blue-300 ring-2 ring-blue-50 shadow-xs space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-400">#1045</span>
                            <span className="bg-slate-900 text-white font-mono text-[10px] font-bold px-1.5 py-0.5 rounded">
                              BRA2E19
                            </span>
                          </div>
                          <div className="text-xs font-extrabold text-slate-900">
                            Jeep Compass 2.0 (2022)
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Fernanda Lima • Orçamento aprovado
                          </div>
                          <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 px-2 py-1 rounded text-[11px]">
                            <span className="font-semibold text-emerald-900">Total OS</span>
                            <strong className="text-emerald-700">R$ 1.840,00</strong>
                          </div>
                        </div>
                      </div>

                      {/* Coluna Pronto / Entrega */}
                      <div className="bg-slate-200/70 rounded-xl p-2.5 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                            5. Pronto / Entrega
                          </span>
                          <span className="text-[11px] font-bold text-slate-500">4</span>
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-emerald-300 shadow-xs space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-400">#1042</span>
                            <span className="bg-slate-900 text-white font-mono text-[10px] font-bold px-1.5 py-0.5 rounded">
                              QWE9R88
                            </span>
                          </div>
                          <div className="text-xs font-extrabold text-slate-900">
                            Toyota Corolla XEi (2024)
                          </div>
                          <div className="space-y-1 pt-1">
                            <div className="w-full py-1 px-2 rounded bg-blue-600 text-white text-[10px] font-bold text-center">
                              💳 Receber Pagamento & Entregar
                            </div>
                            <div className="w-full py-1 px-2 rounded bg-slate-900 text-white text-[10px] font-bold text-center">
                              Emitir NF-e + NFS-e (1 clique)
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* TELA 2: NOTA DE DEVOLUÇÃO EM 30 SEGUNDOS */}
                {activePreview === 'DEVOLUCAO' && (
                  <div className="p-5 bg-slate-950 text-white space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-purple-600/20 border border-purple-500/40">
                          <Undo2 className="w-4 h-4 text-purple-400" />
                        </div>
                        <div>
                          <div className="font-bold text-sm">
                            Assistente Rápido de Nota de Devolução (NF-e)
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Fornecedor: DISTRIBUIDORA RIO PRETO AUTOPEÇAS • Ref. NF-e Nº 1482
                          </div>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold">
                        Inversão Automática Ativa
                      </span>
                    </div>

                    <div className="border border-slate-800 rounded-xl overflow-hidden text-xs">
                      <table className="w-full text-left">
                        <thead className="bg-slate-900 text-[10px] uppercase text-slate-400">
                          <tr>
                            <th className="p-2.5">Peça</th>
                            <th className="p-2.5">CFOP Automático</th>
                            <th className="p-2.5 text-center">Qtd Dev.</th>
                            <th className="p-2.5 text-right">Impostos Prop.</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/80">
                          <tr>
                            <td className="p-2.5">
                              <div className="font-bold text-white">Pastilha Freio Cobreq N-254</div>
                              <div className="text-[10px] text-slate-400">NCM 87083019 • Estoque: 4 jg</div>
                            </td>
                            <td className="p-2.5 font-mono">
                              <span className="text-slate-500 line-through mr-1">5405</span>
                              <span className="text-purple-300 font-bold bg-purple-500/20 px-1.5 py-0.5 rounded">
                                → 5411
                              </span>
                            </td>
                            <td className="p-2.5 text-center font-bold">2 de 4</td>
                            <td className="p-2.5 text-right text-emerald-300 font-semibold">
                              ST R$ 30,78
                            </td>
                          </tr>
                          <tr>
                            <td className="p-2.5">
                              <div className="font-bold text-white">Filtro de Óleo Mann W712/95</div>
                              <div className="text-[10px] text-slate-400">NCM 84212300 • Estoque: 6 un</div>
                            </td>
                            <td className="p-2.5 font-mono">
                              <span className="text-slate-500 line-through mr-1">5102</span>
                              <span className="text-purple-300 font-bold bg-purple-500/20 px-1.5 py-0.5 rounded">
                                → 5202
                              </span>
                            </td>
                            <td className="p-2.5 text-center font-bold">3 de 6</td>
                            <td className="p-2.5 text-right text-emerald-300 font-semibold">
                              ICMS R$ 13,45
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-xl p-3.5 text-xs">
                      <div className="space-y-1">
                        <div className="text-emerald-400 font-bold flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>[✓] Abater quantidade devolvida do estoque automaticamente</span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Chave referenciada (NFref) e motivo preenchidos nos Dados Adicionais
                        </div>
                      </div>
                      <span className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-extrabold text-xs shadow-lg shadow-emerald-600/20">
                        Emitir NF-e de Devolução →
                      </span>
                    </div>
                  </div>
                )}

                {/* TELA 3: PORTAL DO CLIENTE NO CELULAR */}
                {activePreview === 'PORTAL' && (
                  <div className="p-5 bg-gradient-to-br from-slate-900 to-slate-950 flex flex-col sm:flex-row items-center gap-6">
                    {/* Moldura de Celular */}
                    <div className="w-full max-w-[270px] mx-auto bg-white text-slate-900 rounded-[28px] border-4 border-slate-700 p-4 shadow-2xl space-y-3 shrink-0">
                      <div className="bg-slate-900 text-white rounded-xl p-3 flex items-center justify-between">
                        <div>
                          <div className="text-xs font-extrabold">Auto Center Modelo</div>
                          <div className="text-[10px] text-slate-300">OS #1048 • FGH4J21</div>
                        </div>
                        <span className="text-[9px] bg-amber-400 text-slate-950 font-extrabold px-2 py-0.5 rounded-full">
                          Aguard. Aprovação
                        </span>
                      </div>

                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 space-y-2">
                        <div className="text-[10px] font-bold text-blue-600 uppercase">
                          Diagnóstico do Mecânico
                        </div>
                        <p className="text-[11px] text-slate-700 leading-snug">
                          &quot;Pastilhas dianteiras no ferro e disco com desgaste acentuado. Veja a
                          foto do conjunto desmontado:&quot;
                        </p>
                        <div className="grid grid-cols-2 gap-1.5">
                          <div className="h-14 rounded-lg bg-gradient-to-br from-slate-800 to-slate-700 flex flex-col items-center justify-center text-white text-[10px]">
                            <Camera className="w-4 h-4 text-blue-400 mb-0.5" />
                            <span>Foto Pastilha</span>
                          </div>
                          <div className="h-14 rounded-lg bg-gradient-to-br from-slate-800 to-slate-700 flex flex-col items-center justify-center text-white text-[10px]">
                            <Wrench className="w-4 h-4 text-amber-400 mb-0.5" />
                            <span>Vídeo Disco</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs font-extrabold border-t pt-2">
                        <span>Total Orçamento:</span>
                        <span className="text-emerald-600">R$ 680,00</span>
                      </div>

                      <div className="w-full py-2 rounded-xl bg-emerald-600 text-white text-[11px] font-extrabold text-center flex items-center justify-center gap-1.5">
                        <MessageCircle className="w-3.5 h-3.5" /> Aprovar Serviço pelo WhatsApp
                      </div>
                    </div>

                    {/* Cards explicativos ao lado do celular */}
                    <div className="flex-1 space-y-3 text-xs">
                      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
                        <div className="font-bold text-white flex items-center gap-2">
                          <MessageCircle className="w-4 h-4 text-emerald-400" />
                          <span>Fim das ligações de &quot;meu carro já está pronto?&quot;</span>
                        </div>
                        <p className="text-slate-400">
                          Cada mudança de etapa no Kanban atualiza a linha do tempo do cliente com
                          data, hora e fotos.
                        </p>
                      </div>

                      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
                        <div className="font-bold text-white flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-400" />
                          <span>Recall Automático de Revisão (+6 meses / +10.000 km)</span>
                        </div>
                        <p className="text-slate-400">
                          O CRM destaca clientes no tempo certo da próxima troca de óleo e envia
                          mensagem pronta de retorno no WhatsApp.
                        </p>
                      </div>

                      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
                        <div className="font-bold text-white flex items-center gap-2">
                          <ShieldCheck className="w-4 h-4 text-blue-400" />
                          <span>Proteção Jurídica com Vistoria na Entrada</span>
                        </div>
                        <p className="text-slate-400">
                          Fotos de riscos e avarias no Check-in ficam arquivadas para sempre no
                          prontuário do veículo.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* TELA 4: FINANCEIRO, DRE & ESTOQUE XML */}
                {activePreview === 'FINANCEIRO' && (
                  <div className="p-5 bg-slate-100 text-slate-900 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-extrabold">Financeiro & DRE em Tempo Real</div>
                        <div className="text-[11px] text-slate-500">
                          Competência Novembro • Margem Líquida: 38,4%
                        </div>
                      </div>
                      <span className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-[11px] font-bold inline-flex items-center gap-1.5">
                        <Download className="w-3.5 h-3.5 text-blue-400" /> Baixar ZIP do Contador
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div className="bg-white p-3 rounded-xl border border-slate-200">
                        <span className="text-[10px] font-bold uppercase text-slate-400">
                          Faturamento Bruto
                        </span>
                        <div className="text-base font-extrabold text-slate-900 mt-0.5">
                          R$ 68.420,00
                        </div>
                      </div>
                      <div className="bg-white p-3 rounded-xl border border-slate-200">
                        <span className="text-[10px] font-bold uppercase text-blue-600">
                          Mão de Obra
                        </span>
                        <div className="text-base font-extrabold text-blue-700 mt-0.5">
                          R$ 31.200,00
                        </div>
                      </div>
                      <div className="bg-white p-3 rounded-xl border border-slate-200">
                        <span className="text-[10px] font-bold uppercase text-amber-600">
                          Custo Peças (CMV)
                        </span>
                        <div className="text-base font-extrabold text-amber-700 mt-0.5">
                          - R$ 21.850,00
                        </div>
                      </div>
                      <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200">
                        <span className="text-[10px] font-bold uppercase text-emerald-700">
                          Lucro Líquido Real
                        </span>
                        <div className="text-base font-extrabold text-emerald-700 mt-0.5">
                          R$ 26.270,00
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200 p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                          <Upload className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-bold text-slate-900">
                            Entrada de XML da Autopeças Automatizada
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Cadastra fornecedor, NCM, CFOP, preço de custo e soma no estoque em 1 clique
                          </div>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                        Comissões Calculadas
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================
          PONTOS FORTES E DIFERENCIAIS EXCLUSIVOS
         ================================================================ */}
      <section id="diferenciais" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-12">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <span className="text-xs font-extrabold uppercase tracking-widest text-emerald-400">
              Diferenciais que pagam a mensalidade na primeira semana
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white">
              Feito por quem conhece o dia a dia de uma oficina de verdade
            </h2>
            <p className="text-sm text-slate-400">
              Sem menus confusos de ERP genérico. Cada recurso ataca um gargalo real onde a oficina perde tempo ou dinheiro.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              {
                icon: <Undo2 className="w-5 h-5 text-purple-400" />,
                bg: 'bg-purple-500/10 border-purple-500/30',
                title: 'NF-e de Devolução em 30 Segundos',
                desc: 'Acabe com peças paradas na prateleira esperando o contador fazer nota de devolução. Nosso motor lê o XML de compra, inverte CFOP, calcula impostos proporcionais e emite na hora.',
              },
              {
                icon: <FileText className="w-5 h-5 text-blue-400" />,
                bg: 'bg-blue-500/10 border-blue-500/30',
                title: 'NF-e, NFC-e e NFS-e Direto da OS',
                desc: 'O sistema separa peças (NF-e/NFC-e) e mão de obra (NFS-e) automaticamente, mostra a Prévia do DANFE para conferência e ainda gera o .ZIP mensal pronto para o seu contador.',
              },
              {
                icon: <Package className="w-5 h-5 text-emerald-400" />,
                bg: 'bg-emerald-500/10 border-emerald-500/30',
                title: 'Importação de XML + Ranking de Fornecedores',
                desc: 'Arraste a nota de compra e o estoque sobe sozinho com NCM, CFOP e fornecedor vinculados. Acompanhe ainda quais fornecedores mais dão defeito ou garantia.',
              },
              {
                icon: <Camera className="w-5 h-5 text-cyan-400" />,
                bg: 'bg-cyan-500/10 border-cyan-500/30',
                title: 'Diagnóstico Visual & Portal do Cliente',
                desc: 'Seu mecânico sobe fotos e vídeos das avarias pelo celular. O cliente vê tudo pelo link no WhatsApp, confia no seu trabalho e aprova orçamentos muito mais rápido.',
              },
              {
                icon: <DollarSign className="w-5 h-5 text-amber-400" />,
                bg: 'bg-amber-500/10 border-amber-500/30',
                title: 'DRE Real, Múltiplos Pagamentos e Comissões',
                desc: 'Receba parte no Pix e parte no cartão parcelado em segundos. O DRE desconta automaticamente o custo das peças (CMV) e fecha a comissão exata de cada mecânico.',
              },
              {
                icon: <Users className="w-5 h-5 text-rose-400" />,
                bg: 'bg-rose-500/10 border-rose-500/30',
                title: 'CRM com Alerta de Revisão Programada',
                desc: 'Não espere o cliente lembrar da oficina. O sistema identifica veículos com +6 meses ou +10.000 km sem visita e dispara o convite de revisão no WhatsApp em 1 clique.',
              },
            ].map((item) => (
              <div
                key={item.title}
                className="bg-slate-900/70 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-6 space-y-3 transition"
              >
                <div className={`w-11 h-11 rounded-xl border flex items-center justify-center ${item.bg}`}>
                  {item.icon}
                </div>
                <h3 className="text-base font-extrabold text-white">{item.title}</h3>
                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================
          ANTES X DEPOIS (GANCHO DE VENDA DIRETO)
         ================================================================ */}
      <section id="antes-depois" className="py-20 bg-slate-900/50 border-y border-slate-800/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-10">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="text-xs font-extrabold uppercase tracking-widest text-amber-400">
              A diferença na prática
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white">
              Sua oficina no improviso vs. com o Oficina Pro
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Sem o sistema */}
            <div className="bg-red-950/20 border border-red-900/40 rounded-2xl p-6 sm:p-8 space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 text-red-300 text-xs font-extrabold uppercase">
                <X className="w-3.5 h-3.5" /> Sem o Oficina Pro
              </div>
              <ul className="space-y-3 text-sm text-slate-300">
                {[
                  'Peça errada ou defeituosa fica encostada semanas esperando alguém emitir nota de devolução.',
                  'Cliente desconfia do orçamento porque não viu foto do defeito e pede desconto.',
                  'Você acha que faturou bem no mês, mas não sabe quanto gastou de peça nem qual foi o lucro real.',
                  'Perde horas redigitando nota de peça e nota de serviço em portais lentos da prefeitura/SEFAZ.',
                  'Clientes somem depois do serviço porque ninguém avisa a hora da próxima revisão.',
                ].map((txt) => (
                  <li key={txt} className="flex items-start gap-2.5">
                    <X className="w-4 h-4 text-red-400 shrink-0 mt-1" />
                    <span>{txt}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Com o Oficina Pro */}
            <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-2xl p-6 sm:p-8 space-y-4 shadow-xl shadow-emerald-950/30">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-300 text-xs font-extrabold uppercase">
                <Check className="w-3.5 h-3.5" /> Com o Oficina Pro
              </div>
              <ul className="space-y-3 text-sm text-slate-100">
                {[
                  'NF-e de Devolução pronta em 30 segundos — recupera crédito com a autopeças no mesmo dia.',
                  'Fotos e vídeos profissionais no Portal do Cliente aumentam a confiança e a aprovação.',
                  'DRE em tempo real mostra receita de mão de obra, CMV das peças, comissões e lucro líquido.',
                  'Finalizou o recebimento da OS? Com 1 clique emite NF-e + NFS-e e manda o PDF no WhatsApp.',
                  'Alertas automáticos de 6 meses / 10.000 km trazem o cliente de volta com recorrência.',
                ].map((txt) => (
                  <li key={txt} className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-1" />
                    <span>{txt}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================
          CARDS DE PREÇO (MENSAL / ANUAL + 30 DIAS GRÁTIS)
         ================================================================ */}
      <section id="planos" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-12">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <span className="text-xs font-extrabold uppercase tracking-widest text-blue-400">
              Planos Transparentes
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white">
              Comece hoje com 30 dias grátis. Só pague se aprovar.
            </h2>
            <p className="text-sm text-slate-400">
              Menos que o valor de uma única troca de óleo por mês para ter gestão, controle fiscal e lucro na palma da mão.
            </p>

            {/* Toggle Mensal / Anual */}
            <div className="inline-flex items-center gap-1 bg-slate-900 border border-slate-800 p-1.5 rounded-2xl mt-2">
              <button
                type="button"
                onClick={() => setBillingCycle('MONTHLY')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  billingCycle === 'MONTHLY'
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Mensal
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle('ANNUAL')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5 cursor-pointer ${
                  billingCycle === 'ANNUAL'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>Anual</span>
                <span className="bg-emerald-400 text-slate-950 text-[10px] font-extrabold px-1.5 py-0.5 rounded-md">
                  20% OFF
                </span>
              </button>
            </div>
          </div>

         {/* Grid Dinâmico dos Planos (carregados do banco / painel /console) */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 items-stretch">
            {plans.map((plan) => {
              const installments = plan.maxInstallments || 12;
              const monthlyEquivCash = plan.annualCashPrice / 12;
              const cardInstallmentValue = plan.annualCardPrice / installments;
              const annualSavings = Math.max(0, plan.monthlyPrice * 12 - plan.annualCashPrice);
              const cleanWhats = String(plan.whatsappNumber || '5517999999999').replace(/\D/g, '');
              const whatsUrl = `https://wa.me/${cleanWhats}?text=${encodeURIComponent(
                plan.whatsappMessage ||
                  `Olá! Quero saber mais sobre o plano ${plan.name} do Oficina Pro.`,
              )}`;

              return (
                <div
                  key={plan.id}
                  className={`relative rounded-3xl p-6 flex flex-col justify-between transition ${
                    plan.isPopular
                      ? 'bg-gradient-to-b from-blue-950/90 via-slate-900 to-slate-900 border-2 border-blue-500 shadow-2xl shadow-blue-600/20 xl:-translate-y-2'
                      : 'bg-slate-900/80 border border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {plan.badge && (
                    <div
                      className={`absolute -top-3.5 left-1/2 -translate-x-1/2 text-[10px] font-extrabold uppercase tracking-wider px-3.5 py-1 rounded-full shadow-lg whitespace-nowrap ${
                        plan.isPopular
                          ? 'bg-gradient-to-r from-blue-500 to-emerald-400 text-slate-950'
                          : 'bg-slate-800 border border-slate-700 text-blue-300'
                      }`}
                    >
                      {plan.isPopular ? `⭐ ${plan.badge}` : plan.badge}
                    </div>
                  )}

                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-extrabold text-white">{plan.name}</h3>
                      <p className="text-xs text-slate-400 mt-1 min-h-[34px]">{plan.subtitle}</p>
                    </div>

                    {/* Bloco de Preço */}
                    <div className="pb-4 border-b border-slate-800 min-h-[108px] flex flex-col justify-center">
                      {plan.isCustomContact ? (
                        <div>
                          <div className="text-3xl font-extrabold text-white tracking-tight">
                            Sob Consulta
                          </div>
                          <div className="text-[11px] text-emerald-400 font-semibold mt-1.5">
                            Acima de 300 notas/mês • Fale com nosso time
                          </div>
                        </div>
                      ) : billingCycle === 'MONTHLY' ? (
                        <div>
                          <div className="flex items-baseline gap-1">
                            <span className="text-sm font-semibold text-slate-400">R$</span>
                            <span className="text-4xl font-extrabold text-white tracking-tight">
                              {plan.monthlyPrice.toFixed(0)}
                            </span>
                            <span className="text-xs text-slate-400">/mês</span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-1.5">
                            PIX, Boleto ou Cartão à vista (1x)
                          </div>
                          <div className="text-[11px] text-emerald-400 font-semibold mt-0.5">
                            30 dias grátis sem cartão
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <div className="flex items-baseline gap-1">
                            <span className="text-xs font-bold text-blue-300">{installments}x de</span>
                            <span className="text-sm font-semibold text-slate-400">R$</span>
                            <span className="text-3xl font-extrabold text-white tracking-tight">
                              {cardInstallmentValue.toFixed(2).replace('.', ',')}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-300">
                            no cartão (total R$ {plan.annualCardPrice.toFixed(2).replace('.', ',')})
                          </div>
                          <div className="text-[11px] text-emerald-400 font-semibold">
                            ou R$ {plan.annualCashPrice.toFixed(2).replace('.', ',')} à vista no PIX/Boleto
                            {annualSavings > 0
                              ? ` (eq. R$ ${monthlyEquivCash.toFixed(2).replace('.', ',')}/mês)`
                              : ''}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Selo de Cota Fiscal */}
                    <div
                      className={`text-[11px] font-bold px-3 py-1.5 rounded-lg border text-center ${
                        plan.allowFiscalEmission
                          ? 'bg-blue-500/10 border-blue-500/30 text-blue-300'
                          : 'bg-slate-800/70 border-slate-700 text-slate-400'
                      }`}
                    >
                      {plan.isCustomContact
                        ? 'Emissão Fiscal Personalizada (+300 notas/mês)'
                        : plan.allowFiscalEmission
                        ? `Inclui até ${plan.maxMonthlyInvoices} notas fiscais/mês`
                        : 'Sem emissão de notas fiscais (somente gestão)'}
                    </div>

                    <ul className="space-y-2.5 text-xs text-slate-200">
                      {(plan.features || []).map((feat) => (
                        <li key={feat} className="flex items-start gap-2">
                          <CheckCircle2
                            className={`w-4 h-4 shrink-0 mt-0.5 ${
                              plan.isPopular ? 'text-emerald-400' : 'text-blue-400'
                            }`}
                          />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="pt-6 space-y-2">
                    {plan.isCustomContact ? (
                      <a
                        href={whatsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition"
                      >
                        <MessageCircle className="w-4 h-4" />
                        <span>Falar no WhatsApp</span>
                      </a>
                    ) : (
                      <Link
                        to={`/cadastro?plano=${plan.slug}&ciclo=${billingCycle.toLowerCase()}`}
                        className={`w-full py-3 px-4 rounded-xl font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 transition ${
                          plan.isPopular
                            ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30'
                            : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
                        }`}
                      >
                        <span>Testar 30 Dias Grátis</span>
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    )}
                    <p className="text-[10px] text-center text-slate-500">
                      {plan.isCustomContact
                        ? 'Atendimento comercial direto'
                        : 'Sem cartão de crédito para testar'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Selo Garantia Risco Zero */}
          <div className="max-w-4xl mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shrink-0">
              <Award className="w-8 h-8" />
            </div>
            <div className="flex-1">
              <h4 className="font-extrabold text-white text-base">
                Garantia Risco Zero: 30 Dias Completos no Seu Pátio
              </h4>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                Teste com seus mecânicos, seus clientes reais e suas notas fiscais por 30 dias inteiros. Se não economizar horas da sua semana e aumentar o controle do seu caixa, você simplesmente não assina — sem letra miúda.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================
          PROVA SOCIAL (DEPOIMENTOS)
         ================================================================ */}
      <section className="py-16 bg-slate-900/40 border-y border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-10">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="text-xs font-extrabold uppercase tracking-widest text-blue-400">
              Quem usa aprova
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              Oficinas que profissionalizaram o atendimento e o fiscal
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                name: 'Rodrigo Almeida',
                shop: 'Almeida Auto Mecânica — 4 boxes',
                quote:
                  'Só o módulo de Nota de Devolução já pagou o sistema por um ano inteiro. Antes eu ficava 3 dias esperando o escritório de contabilidade devolver uma pastilha errada; hoje faço em 30 segundos.',
              },
              {
                name: 'Marcelo Henrique',
                shop: 'MH Centro Automotivo — Injeção & Freios',
                quote:
                  'Quando passamos a mandar foto das peças gastas pelo Portal do Cliente no WhatsApp, o cliente parou de questionar preço. Nossa aprovação de orçamentos subiu na mesma semana.',
              },
              {
                name: 'Patrícia Costa',
                shop: 'Costa Motors — Gestão & Financeiro',
                quote:
                  'No final do mês eu clico em Exportar Lote e mando o ZIP com todos os XMLs e PDFs pro contador. E o DRE com custo de peças e comissão dos mecânicos fechou um furo que a gente nem via.',
              },
            ].map((t) => (
              <div
                key={t.name}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex gap-1 text-amber-400">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star key={i} className="w-4 h-4 fill-amber-400" />
                    ))}
                  </div>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed italic">
                    &quot;{t.quote}&quot;
                  </p>
                </div>
                <div className="pt-3 border-t border-slate-800">
                  <div className="font-bold text-white text-sm">{t.name}</div>
                  <div className="text-[11px] text-slate-400">{t.shop}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================
          FAQ (QUEBRA DE OBJEÇÕES)
         ================================================================ */}
      <section id="faq" className="py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 space-y-8">
          <div className="text-center space-y-2">
            <span className="text-xs font-extrabold uppercase tracking-widest text-blue-400">
              Dúvidas Frequentes
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              Tudo o que você precisa saber antes de testar
            </h2>
          </div>

          <div className="space-y-3">
            {FAQS.map((item, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={item.q}
                  className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full px-5 py-4 text-left flex items-center justify-between gap-4 font-bold text-sm text-white hover:bg-slate-800/50 transition cursor-pointer"
                  >
                    <span>{item.q}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${
                        isOpen ? 'rotate-180 text-blue-400' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-4 text-xs sm:text-sm text-slate-400 leading-relaxed border-t border-slate-800/70 pt-3">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ================================================================
          CTA FINAL IRRESISTÍVEL
         ================================================================ */}
      <section className="py-16 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto rounded-3xl bg-gradient-to-br from-blue-600 via-blue-700 to-slate-900 border border-blue-400/30 p-8 sm:p-12 text-center space-y-6 shadow-2xl shadow-blue-900/40 relative overflow-hidden">
          <div className="inline-flex items-center gap-2 bg-white/15 text-white px-3.5 py-1 rounded-full text-xs font-bold">
            <Clock className="w-3.5 h-3.5" />
            <span>Sua oficina organizada ainda hoje</span>
          </div>

          <h2 className="text-2xl sm:text-4xl font-extrabold text-white max-w-2xl mx-auto leading-tight">
            Pronto para ter o controle total do pátio, do caixa e das notas fiscais?
          </h2>

          <p className="text-sm sm:text-base text-blue-100 max-w-xl mx-auto">
            Crie sua conta agora e use o Oficina Pro completo gratuitamente por <strong>30 dias</strong> — sem compromisso e sem cartão de crédito.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link
              to="/cadastro"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-white hover:bg-slate-100 text-slate-950 font-extrabold text-sm sm:text-base shadow-xl transition"
            >
              <Zap className="w-4 h-4 text-blue-600" />
              <span>Ativar Meus 30 Dias Grátis</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              to="/login"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-slate-950/40 hover:bg-slate-950/60 border border-white/25 text-white font-bold text-sm transition"
            >
              <LogIn className="w-4 h-4" />
              <span>Já tenho conta — Entrar</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ================================================================
          RODAPÉ
         ================================================================ */}
      <footer className="border-t border-slate-800/80 py-10 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 font-bold text-slate-300">
            <div className="bg-blue-600 text-white p-1.5 rounded-lg">
              <Car className="w-4 h-4" />
            </div>
            <span>Oficina Pro</span>
            <span className="text-slate-600">•</span>
            <span className="font-normal text-slate-500">
              © {new Date().getFullYear()} Todos os direitos reservados.
            </span>
          </div>

          <div className="flex items-center gap-5 font-semibold">
            <a href="#sistema" className="hover:text-slate-300 transition">
              Funcionalidades
            </a>
            <a href="#planos" className="hover:text-slate-300 transition">
              Planos
            </a>
            <Link to="/login" className="hover:text-slate-300 transition">
              Entrar
            </Link>
            <Link to="/cadastro" className="text-blue-400 hover:text-blue-300 transition">
              30 Dias Grátis
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}