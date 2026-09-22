import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { AppShell } from './components/layout/AppShell';
import { useAuth } from './contexts/AuthContext';
import { can } from './lib/permissions';
import type { Permission } from './types/domain';

import { AdminPage } from './pages/AdminPage';
import { ClientsPage } from './pages/ClientsPage';
import { CommercialPage } from './pages/CommercialPage';
import { DashboardPage } from './pages/DashboardPage';
import { DrePage } from './pages/DrePage';
import { EquipmentPage } from './pages/EquipmentPage';
import { FinancialHubPage } from './pages/FinancialHubPage';
import { FiscalPage } from './pages/FiscalPage';
import { FiscalSettingsPage } from './pages/FiscalSettingsPage';
import { LoginPage } from './pages/LoginPage';
import { NewOrderPage } from './pages/NewOrderPage';
import { OrderDetailPage } from './pages/OrderDetailPage';
import { OrderItemsPage } from './pages/OrderItemsPage';
import { OrdersPage } from './pages/OrdersPage';
import { ReportsPage } from './pages/ReportsPage';
import { SchedulePage } from './pages/SchedulePage';
import { StockHistoryPage } from './pages/StockHistoryPage';
import { StockPage } from './pages/StockPage';
import { TechnicalCleaningPage } from './pages/TechnicalCleaningPage';
import { TechnicalSpecialtiesPage } from './pages/TechnicalSpecialtiesPage';
import { TechnicianPage } from './pages/TechnicianPage';

function Guard({
  permission,
  children,
}: {
  permission?: Permission;
  children: ReactNode;
}) {
  const { user, loading } = useAuth();

  if (loading) return <div className="loading">Carregando...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (permission && !can(user, permission)) return <Navigate to="/" replace />;

  return <AppShell>{children}</AppShell>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<Guard><DashboardPage /></Guard>} />
      <Route path="/clientes" element={<Guard permission="clients.view"><ClientsPage /></Guard>} />
      <Route path="/equipamentos" element={<Guard permission="equipment.view"><EquipmentPage /></Guard>} />
      <Route path="/ordens" element={<Guard permission="orders.view"><OrdersPage /></Guard>} />
      <Route path="/ordens/nova" element={<Guard permission="orders.create"><NewOrderPage /></Guard>} />
      <Route path="/ordens/:id/itens" element={<Guard permission="orders.view"><OrderItemsPage /></Guard>} />
      <Route path="/ordens/:id" element={<Guard permission="orders.view"><OrderDetailPage /></Guard>} />
      <Route path="/tecnico" element={<Guard permission="orders.tech"><TechnicianPage /></Guard>} />
      <Route path="/agenda" element={<Guard permission="orders.view"><SchedulePage /></Guard>} />
      <Route path="/limpeza-tecnica" element={<Guard permission="orders.tech"><TechnicalCleaningPage /></Guard>} />
      <Route path="/comercial" element={<Guard permission="orders.commercial"><CommercialPage /></Guard>} />
      <Route path="/estoque" element={<Guard permission="stock.view"><StockPage /></Guard>} />
      <Route path="/estoque/movimentacoes" element={<Guard permission="stock.view"><StockHistoryPage /></Guard>} />
      <Route path="/financeiro" element={<Guard permission="finance.view"><FinancialHubPage /></Guard>} />
      <Route path="/financeiro/dre" element={<Guard permission="finance.dre"><DrePage /></Guard>} />
      <Route path="/fiscal" element={<Guard permission="fiscal.view"><FiscalPage /></Guard>} />
      <Route path="/fiscal/configuracao" element={<Guard permission="fiscal.settings"><FiscalSettingsPage /></Guard>} />
      <Route path="/relatorios" element={<Guard permission="reports.view"><ReportsPage /></Guard>} />
      <Route path="/administracao" element={<Guard permission="settings.manage"><AdminPage /></Guard>} />
      <Route path="/administracao/especialidades" element={<Guard permission="settings.manage"><TechnicalSpecialtiesPage /></Guard>} />
      <Route path="/administracao/permissoes" element={<Guard permission="permissions.manage"><AdminPage permissions /></Guard>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
