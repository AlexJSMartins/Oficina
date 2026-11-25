// frontend/src/App.tsx
import { lazy, Suspense, useState, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SubscriptionProvider, useSubscription } from './contexts/SubscriptionContext';
import { ToastProvider } from './contexts/ToastContext';
import Header from './components/Header';
import SubscriptionBanner from './components/SubscriptionBanner';

// Rotas Públicas (carregadas sob demanda)
const LandingPage = lazy(() => import('./pages/LandingPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const ClientTrackingPage = lazy(() => import('./pages/client-portal/ClientTrackingPage'));
const SuperAdminConsolePage = lazy(() => import('./pages/super-admin/SuperAdminConsolePage'));

// Rotas Protegidas (carregadas sob demanda)
const ServiceOrdersKanbanPage = lazy(() => import('./pages/admin/ServiceOrdersKanbanPage'));
const MechanicBoardPage = lazy(() => import('./pages/mechanic/MechanicBoardPage'));
const CustomersPage = lazy(() => import('./pages/admin/CustomersPage'));
const InventoryPage = lazy(() => import('./pages/admin/InventoryPage'));
const FinancialPage = lazy(() => import('./pages/admin/FinancialPage'));
const FiscalCenterPage = lazy(() => import('./pages/admin/FiscalCenterPage'));
const TeamPermissionsPage = lazy(() => import('./pages/admin/TeamPermissionsPage'));
const WorkshopSettingsPage = lazy(() => import('./pages/admin/WorkshopSettingsPage'));
const SubscriptionPage = lazy(() => import('./pages/admin/SubscriptionPage'));

function FullScreenLoader() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 flex items-center justify-center">
      <div className="flex items-center gap-3 text-sm font-semibold">
        <span className="w-5 h-5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
        <span>Carregando...</span>
      </div>
    </div>
  );
}

function ContentLoader() {
  return (
    <div className="flex-1 min-h-[50vh] flex items-center justify-center text-slate-500">
      <div className="flex items-center gap-2.5 text-xs font-semibold">
        <span className="w-4 h-4 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
        <span>Carregando módulo...</span>
      </div>
    </div>
  );
}

function ProtectedLayout({
  children,
  permission,
}: {
  children: ReactNode;
  permission?: string;
}) {
  const { user, logout, hasPermission } = useAuth();
  const { isLocked, loading: loadingSub } = useSubscription();
  const location = useLocation();

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem('oficina_sidebar_collapsed') === 'true';
  });

  const handleToggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('oficina_sidebar_collapsed', String(next));
      return next;
    });
  };

  if (!user) return <Navigate to="/login" replace />;

  const isSubscriptionPage = location.pathname.startsWith('/admin/assinatura');

  // PAYWALL PÓS-30 DIAS:
  // Se expirou, o ADMIN vai direto para /admin/assinatura pagar via PIX/Cartão e destravar na hora.
  // Mecânicos/Recepção veem um aviso elegante pedindo ao administrador para regularizar.
  if (!loadingSub && isLocked && !isSubscriptionPage) {
    if (user.role === 'ADMIN') {
      return <Navigate to="/admin/assinatura" replace />;
    }

    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-4 shadow-2xl">
          <div className="w-14 h-14 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 flex items-center justify-center mx-auto text-2xl">
            🔒
          </div>
          <h1 className="text-xl font-extrabold">Acesso Temporariamente Pausado</h1>
          <p className="text-sm text-slate-400">
            O período gratuito ou a assinatura desta oficina expirou. Peça ao administrador da
            oficina para regularizar o plano em <strong>Minha Assinatura</strong> — todos os seus
            dados continuam salvos com segurança.
          </p>
          <button
            type="button"
            onClick={logout}
            className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-red-600 text-white text-xs font-bold transition cursor-pointer"
          >
            Sair da Conta
          </button>
        </div>
      </div>
    );
  }

  if (permission && !hasPermission(permission)) {
    return <Navigate to="/admin" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <Header
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleSidebar}
      />

      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-200 ease-in-out ${
          isSidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64'
        }`}
      >
        <SubscriptionBanner />
        <main className="flex-1 flex flex-col">
          <Suspense fallback={<ContentLoader />}>{children}</Suspense>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SubscriptionProvider>
        <ToastProvider>
          <BrowserRouter>
            <Suspense fallback={<FullScreenLoader />}>
              <Routes>
                {/* Página de Vendas Pública (Landing Page) */}
                <Route path="/" element={<LandingPage />} />

                {/* Rota Pública de Login */}
                <Route path="/login" element={<LoginPage />} />

                {/* Rota Pública de Registro de Oficina */}
                <Route path="/cadastro" element={<RegisterPage />} />

                {/* Rota Pública de Acompanhamento do Cliente */}
                <Route path="/acompanhamento/:token" element={<ClientTrackingPage />} />

                {/* Console Secreto do Super Admin (Terminal Linux + Painel Master) */}
                <Route path="/console" element={<SuperAdminConsolePage />} />

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
                  path="/admin/assinatura"
                  element={
                    <ProtectedLayout>
                      <SubscriptionPage />
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
                  path="/admin/fiscal"
                  element={
                    <ProtectedLayout>
                      <FiscalCenterPage />
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
            </Suspense>
          </BrowserRouter>
        </ToastProvider>
      </SubscriptionProvider>
    </AuthProvider>
  );
}