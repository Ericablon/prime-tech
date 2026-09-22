import type { ReactNode } from 'react';
import { Navigate, Outlet, Route, Routes } from 'react-router-dom';

import { AppShell } from './components/layout/AppShell';
import { useAuth } from './contexts/AuthContext';
import { can } from './lib/permissions';
import type { Permission } from './types/domain';

import { AccessProfilesPage } from './pages/AccessProfilesPage';
import { AdminPage } from './pages/AdminPage';
import { ClientsPage } from './pages/ClientsPage';
import { CommercialPage } from './pages/CommercialPage';
import { DashboardPage } from './pages/DashboardPage';
import { DrePage } from './pages/DrePage';
import { EquipmentPage } from './pages/EquipmentPage';
import { FinancialHubPage } from './pages/FinancialHubPage';
import { FiscalPage } from './pages/FiscalPage';
import { FiscalSettingsPage } from './pages/FiscalSettingsPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { LoginPage } from './pages/LoginPage';
import { NewOrderPage } from './pages/NewOrderPage';
import { OrderDetailPage } from './pages/OrderDetailPage';
import { OrderItemsPage } from './pages/OrderItemsPage';
import { OrdersPage } from './pages/OrdersPage';
import { ReportsPage } from './pages/ReportsPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { SchedulePage } from './pages/SchedulePage';
import { StockHistoryPage } from './pages/StockHistoryPage';
import { StockPage } from './pages/StockPage';
import { TechnicalCleaningPage } from './pages/TechnicalCleaningPage';
import { TechnicalSpecialtiesPage } from './pages/TechnicalSpecialtiesPage';
import { TechnicianPage } from './pages/TechnicianPage';
import { UsersPage } from './pages/UsersPage';

function ProtectedLayout() {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading">Carregando...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <AppShell><Outlet /></AppShell>;
}

function PermissionGuard({ permission, children }: { permission: Permission; children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!can(user, permission)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/recuperar-senha" element={<ForgotPasswordPage />} />
      <Route path="/redefinir-senha" element={<ResetPasswordPage />} />

      <Route path="/" element={<ProtectedLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="clientes" element={<PermissionGuard permission="clients.view"><ClientsPage /></PermissionGuard>} />
        <Route path="equipamentos" element={<PermissionGuard permission="equipment.view"><EquipmentPage /></PermissionGuard>} />
        <Route path="ordens" element={<PermissionGuard permission="orders.view"><OrdersPage /></PermissionGuard>} />
        <Route path="ordens/nova" element={<PermissionGuard permission="orders.create"><NewOrderPage /></PermissionGuard>} />
        <Route path="ordens/:id/itens" element={<PermissionGuard permission="orders.view"><OrderItemsPage /></PermissionGuard>} />
        <Route path="ordens/:id" element={<PermissionGuard permission="orders.view"><OrderDetailPage /></PermissionGuard>} />
        <Route path="tecnico" element={<PermissionGuard permission="orders.tech"><TechnicianPage /></PermissionGuard>} />
        <Route path="agenda" element={<PermissionGuard permission="orders.view"><SchedulePage /></PermissionGuard>} />
        <Route path="limpeza-tecnica" element={<PermissionGuard permission="orders.tech"><TechnicalCleaningPage /></PermissionGuard>} />
        <Route path="comercial" element={<PermissionGuard permission="orders.commercial"><CommercialPage /></PermissionGuard>} />
        <Route path="estoque" element={<PermissionGuard permission="stock.view"><StockPage /></PermissionGuard>} />
        <Route path="estoque/movimentacoes" element={<PermissionGuard permission="stock.view"><StockHistoryPage /></PermissionGuard>} />
        <Route path="financeiro" element={<PermissionGuard permission="finance.view"><FinancialHubPage /></PermissionGuard>} />
        <Route path="financeiro/dre" element={<PermissionGuard permission="finance.dre"><DrePage /></PermissionGuard>} />
        <Route path="fiscal" element={<PermissionGuard permission="fiscal.view"><FiscalPage /></PermissionGuard>} />
        <Route path="fiscal/configuracao" element={<PermissionGuard permission="fiscal.settings"><FiscalSettingsPage /></PermissionGuard>} />
        <Route path="relatorios" element={<PermissionGuard permission="reports.view"><ReportsPage /></PermissionGuard>} />
        <Route path="administracao" element={<PermissionGuard permission="settings.manage"><AdminPage /></PermissionGuard>} />
        <Route path="administracao/usuarios" element={<PermissionGuard permission="users.manage"><UsersPage /></PermissionGuard>} />
        <Route path="administracao/especialidades" element={<PermissionGuard permission="settings.manage"><TechnicalSpecialtiesPage /></PermissionGuard>} />
        <Route path="administracao/permissoes" element={<PermissionGuard permission="permissions.manage"><AccessProfilesPage /></PermissionGuard>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
