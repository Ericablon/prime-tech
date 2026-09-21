import {
  BarChart3,
  Boxes,
  BriefcaseBusiness,
  ChevronDown,
  CircleDollarSign,
  FileText,
  Gauge,
  Laptop,
  Settings,
  ShieldCheck,
} from 'lucide-react';

import {
  useEffect,
  useState,
} from 'react';

import {
  NavLink,
  useLocation,
} from 'react-router-dom';

import { useAuth } from '../../contexts/AuthContext';
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
      {
        to: '/comercial',
        label: 'Visão comercial',
        permission: 'orders.commercial',
      },
      {
        to: '/clientes',
        label: 'Clientes',
        permission: 'clients.view',
      },
      {
        to: '/equipamentos',
        label: 'Equipamentos',
        permission: 'equipment.view',
      },
      {
        to: '/ordens/nova',
        label: 'Nova Ordem de Serviço',
        permission: 'orders.create',
      },
      {
        to: '/ordens',
        label: 'Ordens de Serviço',
        permission: 'orders.view',
      },
    ],
  },

  {
    label: 'Operação Técnica',
    icon: Laptop,
    children: [
      {
        to: '/tecnico',
        label: 'Meu painel',
        permission: 'orders.tech',
      },
      {
        to: '/agenda',
        label: 'Programação técnica',
        permission: 'orders.view',
      },
    ],
  },

  {
    label: 'Estoque',
    icon: Boxes,
    children: [
      {
        to: '/estoque',
        label: 'Peças e materiais',
        permission: 'stock.view',
      },
    ],
  },

  {
    label: 'Financeiro',
    icon: CircleDollarSign,
    children: [
      {
        to: '/financeiro',
        label: 'Visão financeira',
        permission: 'finance.view',
      },
      {
        to: '/financeiro/dre',
        label: 'DRE',
        permission: 'finance.dre',
      },
    ],
  },

  {
    label: 'Fiscal',
    icon: FileText,
    children: [
      {
        to: '/fiscal',
        label: 'Painel fiscal',
        permission: 'fiscal.view',
      },
    ],
  },

  {
    label: 'Relatórios',
    icon: BarChart3,
    children: [
      {
        to: '/relatorios',
        label: 'Indicadores',
        permission: 'reports.view',
      },
    ],
  },

  {
    label: 'Administração',
    icon: Settings,
    children: [
      {
        to: '/administracao',
        label: 'Configurações',
        permission: 'settings.manage',
      },
      {
        to: '/administracao/permissoes',
        label: 'Perfis e permissões',
        permission: 'permissions.manage',
      },
    ],
  },
];

interface SidebarProps {
  mobile?: boolean;
  onNavigate?: () => void;
}

export function Sidebar({
  mobile = false,
  onNavigate,
}: SidebarProps) {
  const { user } = useAuth();
  const location = useLocation();

  const [open, setOpen] = useState<Record<string, boolean>>({});

  const logoUrl = `${import.meta.env.BASE_URL}brand/prime-tech-logo.jpeg`;

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

  return (
    <aside
      className={`sidebar ${mobile ? 'sidebar-mobile' : ''}`}
    >
      <div className="brand">
        <div
          className="brand-mark"
          style={{
            overflow: 'hidden',
            background: '#ffffff',
          }}
        >
          <img
            src={logoUrl}
            alt="Prime Tech"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              display: 'block',
            }}
          />
        </div>

        <div>
          <strong>CRONOS</strong>
          <small>Prime Tech</small>
        </div>
      </div>

      <nav className="nav">
        <NavLink
          to="/"
          end
          onClick={onNavigate}
          className={({ isActive }) =>
            `nav-link ${isActive ? 'active' : ''}`
          }
        >
          <Gauge size={18} />
          <span>Dashboard</span>
        </NavLink>

        {groups.map((group) => {
          const allowedChildren = group.children.filter((child) =>
            can(user, child.permission),
          );

          if (!allowedChildren.length) {
            return null;
          }

          const expanded = open[group.label] ?? false;
          const Icon = group.icon;

          return (
            <div
              className="nav-group"
              key={group.label}
            >
              <button
                type="button"
                className="nav-group-button"
                onClick={() =>
                  setOpen((current) => ({
                    ...current,
                    [group.label]: !expanded,
                  }))
                }
              >
                <span>
                  <Icon size={18} />
                  {group.label}
                </span>

                <ChevronDown
                  size={16}
                  className={expanded ? 'rotate' : ''}
                />
              </button>

              {expanded && (
                <div className="nav-children">
                  {allowedChildren.map((child) => (
                    <NavLink
                      key={child.to}
                      to={child.to}
                      onClick={onNavigate}
                      className={({ isActive }) =>
                        `nav-child ${
                          isActive ? 'active' : ''
                        }`
                      }
                    >
                      {child.label}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="sidebar-foot">
        <ShieldCheck size={15} />
        <span>Ambiente seguro · Cronos</span>
      </div>
    </aside>
  );
}
