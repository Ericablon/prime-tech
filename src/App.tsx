import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { useAuth } from "./contexts/AuthContext";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { OrdersPage } from "./pages/OrdersPage";
import { NewOrderPage } from "./pages/NewOrderPage";
import { OrderDetailPage } from "./pages/OrderDetailPage";
import { ClientsPage } from "./pages/ClientsPage";
import { EquipmentPage } from "./pages/EquipmentPage";
import { StockPage } from "./pages/StockPage";
import { FinancePage } from "./pages/FinancePage";
import { FiscalPage } from "./pages/FiscalPage";
import { ReportsPage } from "./pages/ReportsPage";
import { AdminPage } from "./pages/AdminPage";
import { SchedulePage } from "./pages/SchedulePage";
import { OrderDocument } from "./documents/OrderDocument";
import { can, type Permission } from "./lib/permissions";

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="grid min-h-screen place-items-center">Carregando…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <AppShell>{children}</AppShell>;
}

function PermissionRoute({ permission, children }: { permission: Permission; children: React.ReactNode }) {
  const { user } = useAuth();
  if (!can(user, permission)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function DocumentRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/documentos/os/:id" element={<DocumentRoute><PermissionRoute permission="orders.view"><OrderDocument /></PermissionRoute></DocumentRoute>} />
    <Route path="/" element={<Protected><DashboardPage /></Protected>} />
    <Route path="/ordens" element={<Protected><PermissionRoute permission="orders.view"><OrdersPage /></PermissionRoute></Protected>} />
    <Route path="/ordens/nova" element={<Protected><PermissionRoute permission="orders.create"><NewOrderPage /></PermissionRoute></Protected>} />
    <Route path="/ordens/:id" element={<Protected><PermissionRoute permission="orders.view"><OrderDetailPage /></PermissionRoute></Protected>} />
    <Route path="/clientes" element={<Protected><PermissionRoute permission="clients.view"><ClientsPage /></PermissionRoute></Protected>} />
    <Route path="/equipamentos" element={<Protected><PermissionRoute permission="equipment.view"><EquipmentPage /></PermissionRoute></Protected>} />
    <Route path="/estoque" element={<Protected><PermissionRoute permission="stock.view"><StockPage /></PermissionRoute></Protected>} />
    <Route path="/financeiro" element={<Protected><PermissionRoute permission="finance.view"><FinancePage /></PermissionRoute></Protected>} />
    <Route path="/fiscal" element={<Protected><PermissionRoute permission="fiscal.view"><FiscalPage /></PermissionRoute></Protected>} />
    <Route path="/agenda" element={<Protected><PermissionRoute permission="orders.view"><SchedulePage /></PermissionRoute></Protected>} />
    <Route path="/relatorios" element={<Protected><PermissionRoute permission="reports.view"><ReportsPage /></PermissionRoute></Protected>} />
    <Route path="/administracao" element={<Protected><PermissionRoute permission="admin.manage"><AdminPage /></PermissionRoute></Protected>} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>;
}
