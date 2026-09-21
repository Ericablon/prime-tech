import {
  BarChart3,
  Boxes,
  BriefcaseBusiness,
  ChevronDown,
  CircleDollarSign,
  FileText,
  Gauge,
  Laptop,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  ShieldCheck,
} from 'lucide-react';

import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../../contexts/AuthContext';
import { brandLogo } from '../../lib/brand';
import { can } from '../../lib/permissions';
import type { Permission } from '../../types/domain';

type Child = {
  to: string;
  label: string;
  permission: Permission;
};

type Group = {
  label: string;
  icon: typeof Gauge;
  children: Child[];
};

const groups: Group[] = [
  {
    label: 'Comercial',
    icon: BriefcaseBusiness,
    children: [
      { to: '/comercial', label: 'Visão comercial', permission: 'orders.commercial' },
      { to: '/clientes', label: 'Clientes', permission: 'clients.view' },
      { to: '/equipamentos', label: 'Equipamentos', permission: 'equipment.view' },
      { to: '/ordens/nova', label: 'Nova Ordem de Serviço', permission: 'orders.create' },
      { to: '/ordens', label: 'Ordens de Serviço', permission: 'orders.view' },
    ],
  },
  {
    label: 'Operação Técnica',
    icon: Laptop,
    children: [
      { to: '/tecnico', label: 'Meu painel', permission: 'orders.tech' },
      { to: '/agenda', label: 'Programação técnica', permission: 'orders.view' },
      { to: '/limpeza-tecnica', label: 'Limpeza técnica', permission: 'orders.tech' },
    ],
  },
  {
    label: 'Estoque',
    icon: Boxes,
    children: [
      { to: '/estoque', label: 'Peças e materiais', permission: 'stock.view' },
    ],
  },
  {
    label: 'Financeiro',
    icon: CircleDollarSign,
    children: [
      { to: '/financeiro', label: 'Visão financeira', permission: 'finance.view' },
      { to: '/financeiro/dre', label: 'DRE', permission: 'finance.dre' },
    ],
  },
  {
    label: 'Fiscal',
    icon: FileText,
    children: [
      { to: '/fiscal', label: 'Painel fiscal', permission: 'fiscal.view' },
    ],
  },
  {
    label: 'Relatórios',
    icon: BarChart3,
    children: [
      { to: '/relatorios', label: 'Indicadores', permission: 'reports.view' },
    ],
  },
  {
    label: 'Administração',
    icon: Settings,
    children: [
      { to: '/administracao', label: 'Configurações', permission: 'settings.manage' },
      { to: '/administracao/permissoes', label: 'Perfis e permissões', permission: 'permissions.manage' },
    ],
  },
];

interface SidebarProps {
  mobile?: boolean;
  collapsed?: boolean;
  onNavigate?: () => void;
  onToggleCollapse?: () => void;
}

export function Sidebar({
  mobile = false,
  collapsed = false,
  onNavigate,
  onToggleCollapse,
}: SidebarProps) {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [logoFallback, setLogoFallback] = useState(false);

  useEffect(() => {
    const activeGroup = groups.find((group) =>
      group.children.some(
        (child) =>
          location.pathname === child.to ||
          location.pathname.startsWith(`${child.to}/`),
      ),
    );

    if (!activeGroup) return;

    setOpen((current) => ({
      ...current,
      [activeGroup.label]: true,
    }));
  }, [location.pathname]);

  const renderGroup = (group: Group) => {
    const allowedChildren = group.children.filter((child) =>
      can(user, child.permission),
    );

    if (!allowedChildren.length) return null;

    const expanded = collapsed ? false : open[group.label] ?? false;
    const Icon = group.icon;
    const groupActive = allowedChildren.some(
      (child) =>
        location.pathname === child.to ||
        location.pathname.startsWith(`${child.to}/`),
    );

    return (
      <div className={`nav-group ${groupActive ? 'group-active' : ''}`} key={group.label}>
        <button
          type="button"
          className="nav-group-button"
          title={collapsed ? group.label : undefined}
          onClick={() => {
            if (collapsed && allowedChildren[0]) {
              navigate(allowedChildren[0].to);
              onNavigate?.();
              return;
            }

            setOpen((current) => ({
              ...current,
              [group.label]: !expanded,
            }));
          }}
        >
          <span>
            <span className="nav-icon-box"><Icon size={18} /></span>
            <span className="nav-label">{group.label}</span>
          </span>

          {!collapsed && (
            <ChevronDown
              size={16}
              className={expanded ? 'rotate' : ''}
            />
          )}
        </button>

        {expanded && (
          <div className="nav-children">
            {allowedChildren.map((child) => (
              <NavLink
                key={child.to}
                to={child.to}
                onClick={onNavigate}
                className={({ isActive }) =>
                  `nav-child ${isActive ? 'active' : ''}`
                }
              >
                {child.label}
              </NavLink>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside
      className={`sidebar premium-sidebar ${mobile ? 'sidebar-mobile' : ''} ${collapsed ? 'compact' : ''}`}
    >
      <div className="brand premium-brand">
        <div className="brand-logo-wrap">
          {!logoFallback ? (
            <img
              src={brandLogo}
              alt="Prime Tech"
              className="brand-logo-image"
              onError={() => setLogoFallback(true)}
            />
          ) : (
            <img
              src={`${import.meta.env.BASE_URL}brand/cronos-mark.svg`}
              alt="Cronos"
              className="brand-logo-image fallback"
            />
          )}
        </div>

        <div className="brand-copy">
          <strong>CRONOS</strong>
          <small>Prime Tech</small>
        </div>

        {!mobile && onToggleCollapse && (
          <button
            type="button"
            className="sidebar-collapse-button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          </button>
        )}
      </div>

      <nav className="nav premium-nav">
        <div className="nav-section-title">Visão geral</div>

        <NavLink
          to="/"
          end
          onClick={onNavigate}
          title={collapsed ? 'Dashboard' : undefined}
          className={({ isActive }) =>
            `nav-link ${isActive ? 'active' : ''}`
          }
        >
          <span className="nav-icon-box"><Gauge size={18} /></span>
          <span className="nav-label">Dashboard</span>
        </NavLink>

        <div className="nav-section-title nav-section-spaced">Módulos</div>
        {groups.slice(0, 5).map(renderGroup)}

        <div className="nav-section-title nav-section-spaced">Gestão</div>
        {groups.slice(5).map(renderGroup)}
      </nav>

      <div className="sidebar-foot premium-sidebar-foot">
        <div className="sidebar-foot-icon">
          <ShieldCheck size={16} />
        </div>
        <div className="sidebar-foot-copy">
          <strong>Prime Tech Cronos</strong>
          <span>Tecnologia que impulsiona.</span>
        </div>
      </div>
    </aside>
  );
}
