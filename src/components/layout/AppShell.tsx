import {
  Bell,
  ChevronDown,
  LogOut,
  Menu,
  Search,
  UserRound,
  X,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Sidebar } from './Sidebar';

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [mobile, setMobile] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const initials = (user?.full_name || 'Usuário')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

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

          <div className="search premium-search">
            <Search size={18} />
            <input placeholder="Busca global: OS, cliente ou equipamento..." />
            <kbd>⌘ K</kbd>
          </div>

          <div className="top-actions">
            <button className="icon-button" aria-label="Notificações">
              <Bell size={18} />
              <span className="dot" />
            </button>

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

                  <button type="button" className="profile-action">
                    <UserRound size={17} />
                    Meu perfil
                  </button>
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
