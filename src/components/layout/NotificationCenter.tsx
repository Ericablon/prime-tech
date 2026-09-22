import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  FileWarning,
  PackageSearch,
  UserRound,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../../contexts/AuthContext';
import { usePrimeTech } from '../../contexts/PrimeTechContext';
import { can } from '../../lib/permissions';
import { supabase } from '../../lib/supabase';

type AlertTone = 'danger' | 'warning' | 'info' | 'success';

type OperationalAlert = {
  id: string;
  title: string;
  detail: string;
  tone: AlertTone;
  to: string;
  icon: 'alert' | 'clock' | 'stock' | 'finance' | 'fiscal' | 'user' | 'ok';
};

type FiscalErrorRow = {
  id: string;
  document_type: string;
  error_message?: string | null;
  service_order_id?: string | null;
};

const READ_KEY = 'cronos-notifications-read-v1';

function readStoredIds() {
  try {
    const parsed = JSON.parse(localStorage.getItem(READ_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function daysSince(value: string) {
  return Math.floor((Date.now() - new Date(value).getTime()) / 86400000);
}

function iconFor(type: OperationalAlert['icon']) {
  if (type === 'clock') return <Clock3 size={18} />;
  if (type === 'stock') return <PackageSearch size={18} />;
  if (type === 'finance') return <CircleDollarSign size={18} />;
  if (type === 'fiscal') return <FileWarning size={18} />;
  if (type === 'user') return <UserRound size={18} />;
  if (type === 'ok') return <CheckCircle2 size={18} />;
  return <AlertTriangle size={18} />;
}

export function NotificationCenter() {
  const { user, mode } = useAuth();
  const { orders, stock, installments, companyId } = usePrimeTech();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [readIds, setReadIds] = useState<string[]>(readStoredIds);
  const [fiscalErrors, setFiscalErrors] = useState<FiscalErrorRow[]>([]);

  useEffect(() => {
    if (mode !== 'supabase' || !supabase || !companyId || !can(user, 'fiscal.view')) {
      setFiscalErrors([]);
      return;
    }

    let alive = true;
    void supabase
      .from('fiscal_documents')
      .select('id,document_type,error_message,service_order_id')
      .eq('company_id', companyId)
      .eq('status', 'error')
      .order('updated_at', { ascending: false })
      .limit(8)
      .then(({ data }) => {
        if (alive) setFiscalErrors((data ?? []) as FiscalErrorRow[]);
      });

    return () => { alive = false; };
  }, [companyId, mode, user]);

  const alerts = useMemo<OperationalAlert[]>(() => {
    const result: OperationalAlert[] = [];
    const today = new Date().toISOString().slice(0, 10);

    if (can(user, 'orders.view')) {
      orders
        .filter((order) => !['delivered', 'cancelled'].includes(order.status))
        .forEach((order) => {
          const code = `OS #${String(order.order_number).padStart(6, '0')}`;

          if (order.priority === 'urgent') {
            result.push({
              id: `urgent-${order.id}`,
              title: `${code} urgente`,
              detail: `${order.client_name ?? 'Cliente'} · ${order.equipment ?? 'Equipamento'} requer prioridade imediata.`,
              tone: 'danger',
              to: `/ordens/${order.id}`,
              icon: 'alert',
            });
          }

          if (order.status === 'waiting_customer' && daysSince(order.updated_at) >= 1) {
            result.push({
              id: `followup-${order.id}`,
              title: `Follow-up pendente · ${code}`,
              detail: `Orçamento aguardando cliente há ${Math.max(daysSince(order.updated_at), 1)} dia(s).`,
              tone: 'warning',
              to: '/comercial',
              icon: 'clock',
            });
          }

          if (order.status === 'waiting_part') {
            result.push({
              id: `part-${order.id}`,
              title: `Peça pendente · ${code}`,
              detail: `${order.client_name ?? 'Cliente'} está com a manutenção pausada aguardando peça.`,
              tone: 'warning',
              to: `/ordens/${order.id}`,
              icon: 'stock',
            });
          }

          if (order.status === 'ready_for_pickup') {
            result.push({
              id: `pickup-${order.id}`,
              title: `Pronto para retirada · ${code}`,
              detail: `${order.client_name ?? 'Cliente'} já pode ser avisado para retirada.`,
              tone: 'success',
              to: `/ordens/${order.id}`,
              icon: 'ok',
            });
          }

          if (
            ['approved', 'in_repair', 'waiting_part', 'quality_check'].includes(order.status)
            && !order.assigned_technician_id
          ) {
            result.push({
              id: `no-tech-${order.id}`,
              title: `Sem técnico definido · ${code}`,
              detail: 'A OS está na operação técnica, mas ainda não possui responsável definido.',
              tone: 'warning',
              to: '/agenda',
              icon: 'user',
            });
          }

          if (order.scheduled_at && order.scheduled_at.slice(0, 10) < today && !['ready_for_pickup', 'delivered'].includes(order.status)) {
            result.push({
              id: `schedule-${order.id}`,
              title: `Programação vencida · ${code}`,
              detail: 'A data programada da OS passou e ela ainda não foi liberada.',
              tone: 'danger',
              to: '/agenda',
              icon: 'clock',
            });
          }
        });
    }

    if (can(user, 'stock.view')) {
      stock.forEach((item) => {
        const physical = Number(item.physical ?? item.quantity ?? 0);
        const reserved = Number(item.reserved ?? item.reserved_quantity ?? 0);
        const minimum = Number(item.minimum ?? item.minimum_quantity ?? 0);
        const available = physical - reserved;
        if (available <= minimum) {
          result.push({
            id: `stock-${item.id}`,
            title: `Estoque crítico · ${item.name}`,
            detail: `Disponível ${available} · mínimo ${minimum}.`,
            tone: available <= 0 ? 'danger' : 'warning',
            to: '/estoque',
            icon: 'stock',
          });
        }
      });
    }

    if (can(user, 'finance.view')) {
      installments
        .filter((item) => !item.paid_at && item.due_date <= today)
        .forEach((item) => {
          const overdue = item.due_date < today;
          result.push({
            id: `finance-${item.id}`,
            title: `${item.type === 'income' ? 'Recebimento' : 'Pagamento'} ${overdue ? 'vencido' : 'vence hoje'}`,
            detail: `${item.description} · R$ ${Number(item.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`,
            tone: overdue ? 'danger' : 'warning',
            to: '/financeiro',
            icon: 'finance',
          });
        });
    }

    if (can(user, 'fiscal.view')) {
      fiscalErrors.forEach((item) => {
        result.push({
          id: `fiscal-${item.id}`,
          title: `Erro fiscal · ${String(item.document_type).toUpperCase()}`,
          detail: item.error_message || 'Documento fiscal precisa de revisão.',
          tone: 'danger',
          to: item.service_order_id ? `/ordens/${item.service_order_id}` : '/fiscal',
          icon: 'fiscal',
        });
      });
    }

    const priority: Record<AlertTone, number> = { danger: 0, warning: 1, info: 2, success: 3 };
    return result.sort((a, b) => priority[a.tone] - priority[b.tone]).slice(0, 40);
  }, [fiscalErrors, installments, orders, stock, user]);

  const unread = alerts.filter((alert) => !readIds.includes(alert.id));

  function markCurrentRead() {
    const ids = alerts.map((alert) => alert.id);
    setReadIds(ids);
    localStorage.setItem(READ_KEY, JSON.stringify(ids));
  }

  function openAlert(alert: OperationalAlert) {
    setOpen(false);
    if (!readIds.includes(alert.id)) {
      const next = [...readIds, alert.id];
      setReadIds(next);
      localStorage.setItem(READ_KEY, JSON.stringify(next));
    }
    navigate(alert.to);
  }

  return (
    <div className="notification-wrap">
      <button
        type="button"
        className="icon-button notification-button"
        title="Notificações e alertas"
        aria-label="Abrir notificações"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Bell size={18} />
        {unread.length > 0 && <span className="notification-count">{unread.length > 99 ? '99+' : unread.length}</span>}
      </button>

      {open && (
        <div className="notification-panel">
          <div className="notification-panel-head">
            <div><span className="eyebrow">Central operacional</span><h3>Notificações</h3></div>
            {unread.length > 0 && <button type="button" className="text-button" onClick={markCurrentRead}>Marcar atuais como lidos</button>}
          </div>

          <div className="notification-list">
            {alerts.length === 0 ? (
              <div className="empty-state" style={{ minHeight: 180 }}>
                <CheckCircle2 size={30} />
                <h3>Nenhum alerta agora</h3>
                <p>A operação está sem pendências detectadas.</p>
              </div>
            ) : alerts.map((alert) => (
              <button
                key={alert.id}
                type="button"
                className={`notification-item ${alert.tone}`}
                onClick={() => openAlert(alert)}
                style={{ width: '100%', border: 0, background: readIds.includes(alert.id) ? 'transparent' : undefined, textAlign: 'left', cursor: 'pointer' }}
              >
                {iconFor(alert.icon)}
                <span>
                  <strong>{alert.title}</strong>
                  <small>{alert.detail}</small>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
