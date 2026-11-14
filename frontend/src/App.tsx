import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import TeamPermissionsPage from './pages/admin/TeamPermissionsPage';
import ServiceOrdersKanbanPage from './pages/admin/ServiceOrdersKanbanPage';
import MechanicBoardPage from './pages/mechanic/MechanicBoardPage';
import ClientTrackingPage from './pages/client-portal/ClientTrackingPage';
import { ToastProvider } from './contexts/ToastContext';
import FinancialPage from './pages/admin/FinancialPage';
import CustomersPage from './pages/admin/CustomersPage';
import WorkshopSettingsPage from './pages/admin/WorkshopSettingsPage';
import InventoryPage from './pages/admin/InventoryPage';
import { 
  LayoutDashboard, 
  Wrench, 
  Users, 
  DollarSign, 
  UserCheck, 
  Package, 
  Settings, 
  LogOut,
  Car
} from 'lucide-react';

function NavigationMenu() {
  const { hasPermission } = useAuth();
  const location = useLocation();

  // Função auxiliar para verificar se o link está ativo
  const isActive = (path: string) => {
    if (path === '/admin') {
      return location.pathname === '/admin' || location.pathname === '/admin/';
    }
    return location.pathname.startsWith(path);
  };

  // Estilo base para os itens do menu
  const getLinkClass = (path: string) => {
    const active = isActive(path);
    return `flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
      active
        ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-500'
        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
    }`;
  };

  return (
    <div className="flex items-center gap-1 overflow-x-auto py-1">
      {hasPermission('orders:view_all') && (
        <Link to="/admin" className={getLinkClass('/admin')}>
          <LayoutDashboard className="w-4 h-4" /> Pátio / OS
        </Link>
      )}

      {hasPermission('orders:diagnosis') && (
        <Link to="/mechanic" className={getLinkClass('/mechanic')}>
          <Wrench className="w-4 h-4" /> Área do Mecânico
        </Link>
      )}

      {hasPermission('customers:manage') && (
        <Link to="/admin/customers" className={getLinkClass('/admin/customers')}>
          <UserCheck className="w-4 h-4" /> Clientes & Veículos
        </Link>
      )}

      {hasPermission('inventory:manage') && (
        <Link to="/estoque" className={getLinkClass('/estoque')}>
          <Package className="w-4 h-4" /> Estoque
        </Link>
      )}

      {hasPermission('financial:manage') && (
        <Link to="/admin/financial" className={getLinkClass('/admin/financial')}>
          <DollarSign className="w-4 h-4" /> Financeiro / DRE
        </Link>
      )}

      {hasPermission('users:manage') && (
        <Link to="/admin/equipe" className={getLinkClass('/admin/equipe')}>
          <Users className="w-4 h-4" /> Equipe
        </Link>
      )}

      {hasPermission('settings:manage') && (
        <Link to="/admin/settings" className={getLinkClass('/admin/settings')}>
          <Settings className="w-4 h-4" /> Configurações
        </Link>
      )}
    </div>
  );
}

function ProtectedLayout({
  children,
  permission,
}: {
  children: React.ReactNode;
  permission?: string;
}) {
  const { user, logout, hasPermission } = useAuth();

  if (!user) return <Navigate to="/login" replace />;
  if (permission && !hasPermission(permission)) {
    return <Navigate to="/admin" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Barra de Navegação Profissional */}
      <nav className="bg-slate-900 text-white px-6 py-2.5 flex items-center justify-between border-b border-slate-800 shadow-md sticky top-0 z-40">
        <div className="flex items-center gap-8">
          {/* Logo / Nome da Oficina */}
          <div className="flex items-center gap-2 font-bold text-blue-400 text-base tracking-wide shrink-0">
            <div className="bg-blue-600 text-white p-1.5 rounded-lg shadow-inner">
              <Car className="w-4 h-4" />
            </div>
            <span>Oficina Pro</span>
          </div>

          {/* Menu de Navegação Horizontal */}
          <NavigationMenu />
        </div>

        {/* Perfil do Usuário e Botão Sair */}
        <div className="flex items-center gap-4 shrink-0 pl-4 border-l border-slate-800">
          <div className="text-right hidden sm:block">
            <span className="text-xs font-bold text-slate-200 block">{user.name}</span>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider">{user.role}</span>
          </div>
          
          <button
            onClick={logout}
            title="Sair do Sistema"
            className="flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-red-600 text-slate-300 hover:text-white px-3 py-2 rounded-lg transition-all font-semibold shadow-sm"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Sair</span>
          </button>
        </div>
      </nav>

      {/* Conteúdo da Página */}
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            {/* Rota Pública de Login */}
            <Route path="/login" element={<LoginPage />} />

            {/* Rota Pública de Acompanhamento do Cliente */}
            <Route path="/acompanhamento/:token" element={<ClientTrackingPage />} />

            {/* Rotas Administrativas e da Oficina */}
            <Route
              path="/admin/equipe"
              element={
                <ProtectedLayout>
                  <TeamPermissionsPage />
                </ProtectedLayout>
              }
            />

            <Route
              path="/admin/*"
              element={
                <ProtectedLayout>
                  <ServiceOrdersKanbanPage />
                </ProtectedLayout>
              }
            />

            <Route
              path="/mechanic/*"
              element={
                <ProtectedLayout>
                  <MechanicBoardPage />
                </ProtectedLayout>
              }
            />

            <Route
              path="/admin/customers"
              element={
                <ProtectedLayout permission="customers:manage">
                  <CustomersPage />
                </ProtectedLayout>
              }
            />

            <Route
              path="/admin/financial"
              element={
                <ProtectedLayout permission="financial:manage">
                  <FinancialPage />
                </ProtectedLayout>
              }
            />
            
            <Route
              path="/admin/settings"
              element={
                <ProtectedLayout>
                  <WorkshopSettingsPage />
                </ProtectedLayout>
              }
            />

            <Route 
              path="/estoque"
              element={
                <ProtectedLayout permission="inventory:manage">
                  <InventoryPage />
                </ProtectedLayout>
              }
            />

            {/* Redirecionamento padrão */}
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}