import {
  ChevronDown,
  LogOut,
  Menu,
  Search,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
  section: string;
};

const moduleResults: GlobalResult[] = [
  { key: 'module-dashboard', label: 'Dashboard', subtitle: 'Visão geral da empresa', to: '/', section: 'Módulos' },
  { key: 'module-clients', label: 'Clientes', subtitle: 'Cadastro, CPF/CNPJ e contatos', to: '/clientes', section: 'Módulos' },
  { key: 'module-equipment', label: 'Equipamentos', subtitle: 'Computadores, impressoras e histórico', to: '/equipamentos', section: 'Módulos' },
  { key: 'module-orders', label: 'Ordens de Serviço', subtitle: 'OS, diagnóstico e execução', to: '/ordens', section: 'Módulos' },
  { key: 'module-commercial', label: 'Comercial', subtitle: 'Orçamentos, aprovação e follow-up', to: '/comercial', section: 'Módulos' },
  { key: 'module-tech', label: 'Operação Técnica', subtitle: 'Fila e execução dos técnicos', to: '/tecnico', section: 'Módulos' },
  { key: 'module-schedule', label: 'Programação Técnica', subtitle: 'Agenda e programação dos técnicos', to: '/agenda', section: 'Módulos' },
  { key: 'module-stock', label: 'Estoque', subtitle: 'Produtos, peças e saldos', to: '/estoque', section: 'Módulos' },
  { key: 'module-stock-history', label: 'Movimentações de Estoque', subtitle: 'Entradas, saídas, reservas e consumo por OS', to: '/estoque/movimentacoes', section: 'Módulos' },
  { key: 'module-finance', label: 'Financeiro', subtitle: 'Entradas, saídas, parcelas e pagamentos', to: '/financeiro', section: 'Módulos' },
  { key: 'module-dre', label: 'DRE', subtitle: 'Resultado por categorias financeiras', to: '/financeiro/dre', section: 'Módulos' },
  { key: 'module-fiscal', label: 'Fiscal e Notas', subtitle: 'NF-e, NFC-e e NFS-e', to: '/fiscal', section: 'Módulos' },
  { key: 'module-fiscal-settings', label: 'Configuração Fiscal', subtitle: 'Emitente, certificado A1 e tributação', to: '/fiscal/configuracao', section: 'Módulos' },
  { key: 'module-reports', label: 'Relatórios', subtitle: 'Relatórios gerenciais e PDF', to: '/relatorios', section: 'Módulos' },
  { key: 'module-admin', label: 'Administração', subtitle: 'Usuários, permissões e configurações', to: '/administracao', section: 'Módulos' },
];

function normalize(value: unknown) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { clients, equipment, orders, stock, finance } = usePrimeTech();
  const navigate = useNavigate();
  const searchRef = useRef<HTMLInputElement>(null);
  const [mobile, setMobile] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  const initials = (user?.full_name || 'Usuário')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  const results = useMemo<GlobalResult[]>(() => {
    const term = normalize(search.trim());
    if (term.length < 1) return [];

    const modules = moduleResults.filter((item) => normalize(`${item.label} ${item.subtitle}`).includes(term));

    const orderResults = orders
      .filter((order) => normalize([
        orderCode(order.order_number),
        order.order_number,
        order.client_name,
        order.equipment,
        order.reported_issue,
        order.diagnosis,
        order.technician,
        order.status,
        order.technical_specialty_code,
      ].filter(Boolean).join(' ')).includes(term))
      .slice(0, 8)
      .map((order) => ({
        key: `order-${order.id}`,
        label: `${orderCode(order.order_number)} · ${order.client_name ?? 'Cliente'}`,
        subtitle: order.equipment ?? order.reported_issue ?? 'Ordem de Serviço',
        to: `/ordens/${order.id}`,
        section: 'Ordens de Serviço',
      }));

    const clientResults = clients
      .filter((client) => normalize([
        client.name,
        client.document,
        client.phone,
        client.email,
        client.city,
        client.state,
      ].filter(Boolean).join(' ')).includes(term))
      .slice(0, 6)
      .map((client) => ({
        key: `client-${client.id}`,
        label: client.name,
        subtitle: `Cliente · ${client.document || client.phone || client.email || 'cadastro'}`,
        to: `/clientes?busca=${encodeURIComponent(client.name)}`,
        section: 'Clientes',
      }));

    const equipmentResults = equipment
      .filter((item) => normalize([
        item.technical_number,
        item.category,
        item.brand,
        item.model,
        item.serial_number,
        item.accessories,
      ].filter(Boolean).join(' ')).includes(term))
      .slice(0, 6)
      .map((item) => ({
        key: `equipment-${item.id}`,
        label: [item.category, item.brand, item.model].filter(Boolean).join(' ') || 'Equipamento',
        subtitle: `Equipamento · ${item.serial_number || `código ${item.technical_number ?? '—'}`}`,
        to: `/equipamentos?busca=${encodeURIComponent(item.serial_number || item.model || item.brand || item.category)}`,
        section: 'Equipamentos',
      }));

    const stockResults = stock
      .filter((item) => normalize([item.sku, item.name, item.barcode, item.ncm].filter(Boolean).join(' ')).includes(term))
      .slice(0, 6)
      .map((item) => ({
        key: `stock-${item.id}`,
        label: `${item.name} · ${item.sku}`,
        subtitle: `Estoque · físico ${item.physical ?? item.quantity ?? 0} · reservado ${item.reserved ?? item.reserved_quantity ?? 0}`,
        to: `/estoque?busca=${encodeURIComponent(item.sku || item.name)}`,
        section: 'Estoque',
      }));

    const financeResults = finance
      .filter((entry) => normalize([
        entry.description,
        entry.category,
        entry.payment_method,
        entry.amount,
        entry.service_order_id,
      ].filter(Boolean).join(' ')).includes(term))
      .slice(0, 5)
      .map((entry) => ({
        key: `finance-${entry.id}`,
        label: entry.description,
        subtitle: `${entry.type === 'income' ? 'Entrada' : 'Saída'} · ${entry.category} · R$ ${Number(entry.amount).toFixed(2)}`,
        to: `/financeiro?busca=${encodeURIComponent(entry.description)}`,
        section: 'Financeiro',
      }));

    return [...orderResults, ...clientResults, ...equipmentResults, ...stockResults, ...financeResults, ...modules].slice(0, 18);
  }, [clients, equipment, finance, orders, search, stock]);

  function openResult(result: GlobalResult) {
    setSearch('');
    navigate(result.to);
  }

  const grouped = useMemo(() => {
    const map = new Map<string, GlobalResult[]>();
    results.forEach((result) => map.set(result.section, [...(map.get(result.section) ?? []), result]));
    return Array.from(map.entries());
  }, [results]);

  return (
    <div className={`app-shell premium-shell ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <div className="desktop-sidebar">
        <Sidebar collapsed={collapsed} onToggleCollapse={() => setCollapsed((value) => !value)} />
      </div>

      {mobile && (
        <>
          <div className="mobile-overlay" onClick={() => setMobile(false)} />
          <div className="mobile-drawer">
            <button className="drawer-close" onClick={() => setMobile(false)} aria-label="Fechar menu"><X /></button>
            <Sidebar mobile onNavigate={() => setMobile(false)} />
          </div>
        </>
      )}

      <div className="app-main">
        <header className="topbar premium-topbar">
          <div className="topbar-left">
            <button className="menu-button" onClick={() => setMobile(true)} aria-label="Abrir menu"><Menu /></button>
            <div className="topbar-context"><span>Prime Tech</span><strong>Cronos</strong></div>
          </div>

          <div className="search premium-search" style={{ position: 'relative' }}>
            <button
              type="button"
              aria-label="Focar busca global"
              title="Pesquisar em todo o Cronos"
              onClick={() => searchRef.current?.focus()}
              style={{ border: 0, background: 'transparent', color: 'inherit', padding: 0, display: 'grid', placeItems: 'center', cursor: 'pointer' }}
            >
              <Search size={18} />
            </button>
            <input
              ref={searchRef}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && results[0]) openResult(results[0]);
                if (event.key === 'Escape') setSearch('');
              }}
              placeholder="Pesquisar OS, cliente, CNPJ, equipamento, produto, financeiro ou módulo..."
            />
            <kbd>Ctrl K</kbd>

            {search.trim().length >= 1 && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0, zIndex: 80,
                maxHeight: 'min(520px, 70vh)', overflowY: 'auto', border: '1px solid var(--line)',
                borderRadius: 14, background: '#081322', boxShadow: '0 18px 50px rgba(0,0,0,.35)', padding: 8,
              }}>
                {results.length ? grouped.map(([section, items]) => (
                  <div key={section} style={{ marginBottom: 6 }}>
                    <div style={{ padding: '7px 10px 4px', color: 'var(--muted)', fontSize: 10, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase' }}>{section}</div>
                    {items.map((result) => (
                      <button
                        key={result.key}
                        type="button"
                        onClick={() => openResult(result)}
                        style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 3, padding: '10px 12px', border: 0, borderRadius: 10, background: 'transparent', color: '#fff', textAlign: 'left', cursor: 'pointer' }}
                      >
                        <strong style={{ fontSize: 13 }}>{result.label}</strong>
                        <small style={{ color: 'var(--muted)' }}>{result.subtitle}</small>
                      </button>
                    ))}
                  </div>
                )) : (
                  <div style={{ padding: 12, color: 'var(--muted)', fontSize: 13 }}>Nenhum resultado encontrado.</div>
                )}
              </div>
            )}
          </div>

          <div className="top-actions">
            <div className="profile-menu-wrap">
              <button className="profile-trigger" onClick={() => setProfileOpen((value) => !value)} aria-expanded={profileOpen}>
                <div className="avatar premium-avatar">{initials}</div>
                <div className="profile-trigger-copy"><strong>{user?.full_name || 'Usuário'}</strong><small>{user?.role_code || 'perfil'}</small></div>
                <ChevronDown size={15} />
              </button>

              {profileOpen && (
                <div className="profile-popover">
                  <div className="profile-popover-head">
                    <div className="avatar premium-avatar large">{initials}</div>
                    <div><strong>{user?.full_name || 'Usuário'}</strong><small>{user?.email || user?.role_code}</small></div>
                  </div>
                  <div className="profile-role-badge">{user?.role_code || 'perfil'}</div>
                  <button type="button" className="profile-action danger" onClick={() => void logout()}><LogOut size={17} /> Sair</button>
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
