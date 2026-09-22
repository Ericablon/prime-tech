import {
  ChevronDown,
  LogOut,
  Menu,
  Search,
  X,
} from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { usePrimeTech } from '../../contexts/PrimeTechContext';
import { orderCode } from '../../lib/formatters';
import { Sidebar } from './Sidebar';

type GlobalResult = {
  key: string;
  label: string;
  subtitle: string;
  to: string;
};

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { clients, equipment, orders } = usePrimeTech();
  const navigate = useNavigate();
  const [mobile, setMobile] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [search, setSearch] = useState('');

  const initials = (user?.full_name || 'Usuário')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  const results = useMemo<GlobalResult[]>(() => {
    const term = search.trim().toLowerCase();
    if (term.length < 2) return [];

    const orderResults = orders
      .filter((order) => {
        const text = [
          orderCode(order.order_number),
          String(order.order_number),
          order.client_name,
          order.equipment,
          order.reported_issue,
        ].filter(Boolean).join(' ').toLowerCase();
        return text.includes(term);
      })
      .slice(0, 5)
      .map((order) => ({
        key: `order-${order.id}`,
        label: `${orderCode(order.order_number)} · ${order.client_name ?? 'Cliente'}`,
        subtitle: order.equipment ?? order.reported_issue,
        to: `/ordens/${order.id}`,
      }));

    const clientResults = clients
      .filter((client) => [client.name, client.document, client.phone, client.email]
        .filter(Boolean).join(' ').toLowerCase().includes(term))
      .slice(0, 3)
      .map((client) => ({
        key: `client-${client.id}`,
        label: client.name,
        subtitle: `Cliente · ${client.document || client.phone || 'cadastro'}`,
        to: '/clientes',
      }));

    const equipmentResults = equipment
      .filter((item) => [item.category, item.brand, item.model, item.serial_number]
        .filter(Boolean).join(' ').toLowerCase().includes(term))
      .slice(0, 3)
      .map((item) => ({
        key: `equipment-${item.id}`,
        label: [item.category, item.brand, item.model].filter(Boolean).join(' '),
        subtitle: `Equipamento · ${item.serial_number || 'sem série'}`,
        to: '/equipamentos',
      }));

    return [...orderResults, ...clientResults, ...equipmentResults].slice(0, 8);
  }, [clients, equipment, orders, search]);

  function openResult(result: GlobalResult) {
    setSearch('');
    navigate(result.to);
  }

  return (
    <div className={`app-shell premium-shell ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <div className="desktop-sidebar">
        <Sidebar
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((value) => !value)}
        />
      </div>

      {mobile && (
        <>
          <div className="mobile-overlay" onClick={() => setMobile(false)} />
          <div className="mobile-drawer">
            <button
              className="drawer-close"
              onClick={() => setMobile(false)}
              aria-label="Fechar menu"
            >
              <X />
            </button>
            <Sidebar mobile onNavigate={() => setMobile(false)} />
          </div>
        </>
      )}

      <div className="app-main">
        <header className="topbar premium-topbar">
          <div className="topbar-left">
            <button
              className="menu-button"
              onClick={() => setMobile(true)}
              aria-label="Abrir menu"
            >
              <Menu />
            </button>

            <div className="topbar-context">
              <span>Prime Tech</span>
              <strong>Cronos</strong>
            </div>
          </div>

          <div className="search premium-search" style={{ position: 'relative' }}>
            <Search size={18} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && results[0]) openResult(results[0]);
                if (event.key === 'Escape') setSearch('');
              }}
              placeholder="Busca global: OS, cliente ou equipamento..."
            />
            <kbd>Enter</kbd>

            {search.trim().length >= 2 && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                left: 0,
                right: 0,
                zIndex: 80,
                border: '1px solid var(--line)',
                borderRadius: 14,
                background: '#081322',
                boxShadow: '0 18px 50px rgba(0,0,0,.35)',
                padding: 8,
              }}>
                {results.length ? results.map((result) => (
                  <button
                    key={result.key}
                    type="button"
                    onClick={() => openResult(result)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      gap: 3,
                      padding: '10px 12px',
                      border: 0,
                      borderRadius: 10,
                      background: 'transparent',
                      color: '#fff',
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <strong style={{ fontSize: 13 }}>{result.label}</strong>
                    <small style={{ color: 'var(--muted)' }}>{result.subtitle}</small>
                  </button>
                )) : (
                  <div style={{ padding: 12, color: 'var(--muted)', fontSize: 13 }}>
                    Nenhum resultado encontrado.
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="top-actions">
            <div className="profile-menu-wrap">
              <button
                className="profile-trigger"
                onClick={() => setProfileOpen((value) => !value)}
                aria-expanded={profileOpen}
              >
                <div className="avatar premium-avatar">{initials}</div>
                <div className="profile-trigger-copy">
                  <strong>{user?.full_name || 'Usuário'}</strong>
                  <small>{user?.role_code || 'perfil'}</small>
                </div>
                <ChevronDown size={15} />
              </button>

              {profileOpen && (
                <div className="profile-popover">
                  <div className="profile-popover-head">
                    <div className="avatar premium-avatar large">{initials}</div>
                    <div>
                      <strong>{user?.full_name || 'Usuário'}</strong>
                      <small>{user?.email || user?.role_code}</small>
                    </div>
                  </div>

                  <div className="profile-role-badge">{user?.role_code || 'perfil'}</div>

                  <button
                    type="button"
                    className="profile-action danger"
                    onClick={() => void logout()}
                  >
                    <LogOut size={17} />
                    Sair
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="content premium-content">{children}</main>
      </div>
    </div>
  );
}
