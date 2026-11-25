import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard,
  Wrench,
  Users,
  DollarSign,
  UserCheck,
  Package,
  Settings,
  LogOut,
  Car,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  FileText,
  CreditCard,
} from 'lucide-react';

interface HeaderProps {
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function Header({ isCollapsed = false, onToggleCollapse }: HeaderProps) {
  const { user, logout, hasPermission } = useAuth();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Fecha o menu mobile automaticamente sempre que mudar de rota
  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  const isActive = (path: string) => {
    if (path === '/admin') {
      return location.pathname === '/admin' || location.pathname === '/admin/';
    }
    return location.pathname.startsWith(path);
  };

  const getLinkClass = (path: string) => {
    const active = isActive(path);
    return `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
      isCollapsed ? 'lg:justify-center lg:px-0' : ''
    } ${
      active
        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20 ring-1 ring-blue-500'
        : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
    }`;
  };

  const navItems = [
    
    {
      to: '/admin',
      label: 'Pátio / OS',
      icon: LayoutDashboard,
      visible: hasPermission('orders:view_all'),
    },
    {
      to: '/admin/assinatura',
      label: 'Minha Assinatura',
      icon: CreditCard,
      visible: user?.role === 'ADMIN',
    },
    {
      to: '/mechanic',
      label: 'Área do Mecânico',
      icon: Wrench,
      visible: hasPermission('orders:diagnosis'),
    },
    {
      to: '/admin/customers',
      label: 'Clientes & Veículos',
      icon: UserCheck,
      visible: hasPermission('customers:manage'),
    },
    {
      to: '/estoque',
      label: 'Estoque',
      icon: Package,
      visible: hasPermission('inventory:manage'),
    },
    {
      to: '/admin/financial',
      label: 'Financeiro / DRE',
      icon: DollarSign,
      visible: hasPermission('financial:manage'),
    },
    {
      to: '/admin/equipe',
      label: 'Equipe',
      icon: Users,
      visible: hasPermission('users:manage'),
    },

    {
      to: '/admin/fiscal',
      label: 'Notas Fiscais',
      icon: FileText,
      visible: hasPermission('financial:manage') || hasPermission('orders:view_all'),
    },

    {
      to: '/admin/settings',
      label: 'Configurações',
      icon: Settings,
      visible: hasPermission('settings:manage'),
    },
  ];

  return (
    <>
      {/* Barra superior compacta visível APENAS em telas menores (< lg) */}
      <header className="lg:hidden sticky top-0 z-30 bg-slate-900 text-white px-4 py-3 flex items-center justify-between border-b border-slate-800 shadow-md">
        <Link
          to="/admin"
          className="flex items-center gap-2.5 font-bold text-blue-400 text-base tracking-wide"
        >
          <div className="bg-blue-600 text-white p-1.5 rounded-lg shadow-inner">
            <Car className="w-4 h-4" />
          </div>
          <span>Oficina Pro</span>
        </Link>

        <button
          type="button"
          onClick={() => setIsMenuOpen(true)}
          aria-label="Abrir menu"
          className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
        >
          <Menu className="w-6 h-6" />
        </button>
      </header>

      {/* Overlay escuro atrás da gaveta no mobile */}
      {isMenuOpen && (
        <div
          onClick={() => setIsMenuOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* Menu Lateral Esquerdo Fixo */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 ${
          isCollapsed ? 'lg:w-20' : 'lg:w-64'
        } bg-slate-900 text-white border-r border-slate-800 flex flex-col shadow-2xl lg:shadow-none transition-all duration-200 ease-in-out ${
          isMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Botão de Seta para Recolher / Expandir (Desktop) */}
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            title={isCollapsed ? 'Expandir menu' : 'Recolher menu'}
            aria-label={isCollapsed ? 'Expandir menu' : 'Recolher menu'}
            className="hidden lg:flex items-center justify-center w-6 h-6 rounded-full bg-slate-800 hover:bg-blue-600 text-slate-300 hover:text-white border border-slate-700 shadow-md absolute -right-3 top-5 z-50 transition-colors cursor-pointer"
          >
            {isCollapsed ? (
              <ChevronRight className="w-3.5 h-3.5" />
            ) : (
              <ChevronLeft className="w-3.5 h-3.5" />
            )}
          </button>
        )}

        {/* Topo da Sidebar: Logo + Botão fechar (mobile) */}
        <div
          className={`h-16 px-5 flex items-center border-b border-slate-800 shrink-0 ${
            isCollapsed ? 'lg:justify-center lg:px-0' : 'justify-between'
          }`}
        >
          <Link
            to="/admin"
            onClick={() => setIsMenuOpen(false)}
            title="Oficina Pro"
            className="flex items-center gap-2.5 font-bold text-blue-400 text-lg tracking-wide"
          >
            <div className="bg-blue-600 text-white p-2 rounded-xl shadow-inner shrink-0">
              <Car className="w-5 h-5" />
            </div>
            <span className={isCollapsed ? 'lg:hidden' : ''}>Oficina Pro</span>
          </Link>

          <button
            type="button"
            onClick={() => setIsMenuOpen(false)}
            aria-label="Fechar menu"
            className="lg:hidden p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Lista de Navegação Vertical */}
       <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <div
            className={`px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 ${
              isCollapsed ? 'lg:hidden' : ''
            }`}
          >
            Menu Principal
          </div>

          {navItems
            .filter((item) => item.visible)
            .map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  title={isCollapsed ? item.label : undefined}
                  onClick={() => setIsMenuOpen(false)}
                  className={getLinkClass(item.to)}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className={`truncate ${isCollapsed ? 'lg:hidden' : ''}`}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
        </nav>

        {/* Rodapé da Sidebar: Perfil do Usuário + Botão Sair */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40 shrink-0 space-y-3">
          {user && (
            <div
              title={isCollapsed ? `${user.name} (${user.role})` : undefined}
              className={`flex items-center gap-3 px-1 ${
                isCollapsed ? 'lg:justify-center lg:px-0' : ''
              }`}
            >
              <div className="w-9 h-9 rounded-full bg-blue-600/20 border border-blue-500/40 text-blue-300 font-bold text-sm flex items-center justify-center shrink-0 uppercase">
                {user.name?.charAt(0) || 'U'}
              </div>
              <div className={`min-w-0 flex-1 ${isCollapsed ? 'lg:hidden' : ''}`}>
                <span className="text-xs font-bold text-slate-100 block truncate">
                  {user.name}
                </span>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block truncate">
                  {user.role}
                </span>
              </div>
            </div>
          )}

          <button
            type="button"
            title="Sair do Sistema"
            onClick={() => {
              setIsMenuOpen(false);
              logout();
            }}
            className={`w-full flex items-center justify-center gap-2 text-xs bg-slate-800 hover:bg-red-600 text-slate-300 hover:text-white px-3 py-2.5 rounded-xl transition-all font-semibold shadow-sm cursor-pointer ${
              isCollapsed ? 'lg:px-0' : ''
            }`}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span className={isCollapsed ? 'lg:hidden' : ''}>Sair do Sistema</span>
          </button>
        </div>
      </aside>
    </>
  );
}