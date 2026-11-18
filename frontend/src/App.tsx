import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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
import Header from './components/Header';
import RegisterPage from './pages/RegisterPage';

function ProtectedLayout({
  children,
  permission,
}: {
  children: React.ReactNode;
  permission?: string;
}) {
  const { user, hasPermission } = useAuth();

  if (!user) return <Navigate to="/login" replace />;
  if (permission && !hasPermission(permission)) {
    return <Navigate to="/admin" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col relative">
      <Header />
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
            
            {/* Rota Pública de Registro de Oficina */}
            <Route path="/cadastro" element={<RegisterPage />} />

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