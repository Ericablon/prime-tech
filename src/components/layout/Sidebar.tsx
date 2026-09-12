import { brandLogo } from "../../lib/brand";
import {
  Boxes,
  Building2,
  CalendarDays,
  FileBarChart,
  FileText,
  Gauge,
  Laptop,
  ReceiptText,
  Settings,
  Users,
  Wrench,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { can, type Permission } from "../../lib/permissions";

const items: Array<{ to: string; label: string; icon: typeof Gauge; permission: Permission }> = [
  { to: "/", label: "Dashboard", icon: Gauge, permission: "dashboard.view" },
  { to: "/ordens", label: "Ordens de Serviço", icon: Wrench, permission: "orders.view" },
  { to: "/clientes", label: "Clientes", icon: Users, permission: "clients.view" },
  { to: "/equipamentos", label: "Equipamentos", icon: Laptop, permission: "equipment.view" },
  { to: "/estoque", label: "Estoque / Peças", icon: Boxes, permission: "stock.view" },
  { to: "/financeiro", label: "Financeiro", icon: ReceiptText, permission: "finance.view" },
  { to: "/fiscal", label: "Fiscal", icon: FileText, permission: "fiscal.view" },
  { to: "/agenda", label: "Agenda", icon: CalendarDays, permission: "orders.view" },
  { to: "/relatorios", label: "Relatórios", icon: FileBarChart, permission: "reports.view" },
  { to: "/administracao", label: "Administração", icon: Settings, permission: "admin.manage" },
];

export function Sidebar() {
  const { user } = useAuth();
  return (
    <aside className="pt-sidebar">
      <div className="pt-sidebar-brand">
        <div className="pt-logo-frame overflow-hidden">
          <img src={brandLogo} alt="Prime Tech" className="h-full w-full object-cover" />
        </div>
        <div>
          <div className="font-semibold tracking-[0.2em] text-white">PRIME TECH</div>
          <div className="text-xs text-slate-400">Assistência Técnica</div>
        </div>
      </div>

      <nav className="mt-3 flex-1 overflow-y-auto pb-6">
        {items.filter((item) => can(user?.role_code, item.permission)).map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => `pt-nav-item ${isActive ? "pt-nav-item-active" : ""}`}>
            <Icon size={18} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-white/10 p-4 text-xs text-slate-400">
        <div className="flex items-center gap-2"><Building2 size={14} /> Tecnologia que impulsiona.</div>
      </div>
    </aside>
  );
}
