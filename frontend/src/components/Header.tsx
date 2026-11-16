import { useState } from 'react';
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
  X
} from 'lucide-react';

export default function Header() {
  const { user, logout, hasPermission } = useAuth();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Função auxiliar para verificar se o link está ativo
  const isActive = (path: string) => {
    if (path === '/admin') {
      return location.pathname === '/admin' || location.pathname === '/admin/';
    }
    return location.pathname.startsWith(path);
  };

  // Estilo base para os itens do menu (com fechamento automático do menu mobile ao clicar)
  const getLinkClass = (path: string) => {
    const active = isActive(path);
    return `flex items-center gap-2 px-4 py-3 lg:px-3 lg:py-2 rounded-lg text-sm lg:text-xs font-semibold transition-all ${
      active
        ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-500'
        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
    }`;
  };

  const handleLinkClick = () => {
    setIsMenuOpen(false);
  };

  return (
    <nav className="bg-slate-900 text-white px-4 lg:px-6 py-2.5 flex items-center justify-between border-b border-slate-800 shadow-md sticky top-0 z-50">
      
      {/* Logo / Nome da Oficina */}
      <div className="flex items-center gap-2 font-bold text-blue-400 text-base tracking-wide shrink-0">
        <div className="bg-blue-600 text-white p-1.5 rounded-lg shadow-inner">
          <Car className="w-4 h-4" />
        </div>
        <span>Oficina Pro</span>
      </div>

      {/* Botão Hambúrguer para Mobile */}
      <button 
        className="lg:hidden p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg"
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        aria-label="Alternar menu"
      >
        {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Menu de Navegação e Perfil */}
      <div className={`
        absolute lg:static top-[60px] left-0 w-full lg:w-auto bg-slate-900 lg:bg-transparent
        flex-col lg:flex-row items-stretch lg:items-center gap-2 lg:gap-8
        border-b lg:border-none border-slate-800 p-4 lg:p-0
        transition-all duration-200 ease-in-out origin-top
        ${isMenuOpen ? 'flex' : 'hidden lg:flex'}
      `}>
        
        {/* Links de Navegação */}
        <div className="flex flex-col lg:flex-row gap-1 lg:overflow-x-auto lg:py-1">
          {hasPermission('orders:view_all') && (
            <Link to="/admin" className={getLinkClass('/admin')} onClick={handleLinkClick}>
              <LayoutDashboard className="w-4 h-4" /> Pátio / OS
            </Link>
          )}

          {hasPermission('orders:diagnosis') && (
            <Link to="/mechanic" className={getLinkClass('/mechanic')} onClick={handleLinkClick}>
              <Wrench className="w-4 h-4" /> Área do Mecânico
            </Link>
          )}

          {hasPermission('customers:manage') && (
            <Link to="/admin/customers" className={getLinkClass('/admin/customers')} onClick={handleLinkClick}>
              <UserCheck className="w-4 h-4" /> Clientes & Veículos
            </Link>
          )}

          {hasPermission('inventory:manage') && (
            <Link to="/estoque" className={getLinkClass('/estoque')} onClick={handleLinkClick}>
              <Package className="w-4 h-4" /> Estoque
            </Link>
          )}

          {hasPermission('financial:manage') && (
            <Link to="/admin/financial" className={getLinkClass('/admin/financial')} onClick={handleLinkClick}>
              <DollarSign className="w-4 h-4" /> Financeiro / DRE
            </Link>
          )}

          {hasPermission('users:manage') && (
            <Link to="/admin/equipe" className={getLinkClass('/admin/equipe')} onClick={handleLinkClick}>
              <Users className="w-4 h-4" /> Equipe
            </Link>
          )}

          {hasPermission('settings:manage') && (
            <Link to="/admin/settings" className={getLinkClass('/admin/settings')} onClick={handleLinkClick}>
              <Settings className="w-4 h-4" /> Configurações
            </Link>
          )}
        </div>

        {/* Separador em Mobile */}
        <hr className="lg:hidden border-slate-800 my-2" />

        {/* Perfil do Usuário e Botão Sair */}
        <div className="flex items-center justify-between lg:justify-start gap-4 lg:pl-4 lg:border-l border-slate-800">
          {user && (
            <div className="text-left lg:text-right">
              <span className="text-sm lg:text-xs font-bold text-slate-200 block">{user.name}</span>
              <span className="text-xs lg:text-[10px] text-slate-400 uppercase tracking-wider">{user.role}</span>
            </div>
          )}
          
          <button
            onClick={() => {
              handleLinkClick();
              logout();
            }}
            title="Sair do Sistema"
            className="flex items-center gap-2 text-sm lg:text-xs bg-slate-800 hover:bg-red-600 text-slate-300 hover:text-white px-4 py-2 lg:px-3 rounded-lg transition-all font-semibold shadow-sm"
          >
            <LogOut className="w-4 h-4 lg:w-3.5 lg:h-3.5" />
            <span>Sair</span>
          </button>
        </div>
      </div>
    </nav>
  );
}