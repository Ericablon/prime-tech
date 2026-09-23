import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Gauge,
  MessageSquareText,
  PackagePlus,
  PhoneCall,
  Send,
  UserRound,
  Wrench,
  XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { MetricCard } from '../components/ui/MetricCard';
import { PageHeader } from '../components/ui/PageHeader';
import { StatusBadge } from '../components/ui/StatusBadge';
import { usePrimeTech } from '../contexts/PrimeTechContext';
import { money, orderCode } from '../lib/formatters';
import type { ServiceOrder } from '../types/domain';

function isToday(value?: string | null) {
  if (!value) return false;
  const date = new Date(value);
  const today = new Date();
  return date.getFullYear() === today.getFullYear()
    && date.getMonth() === today.getMonth()
    && date.getDate() === today.getDate();
}

function total(order: ServiceOrder) {
  return Number(order.total_amount ?? order.quote_total ?? 0);
}

function workloadDays(order: ServiceOrder) {
  return Math.max(Number(order.estimated_days ?? 1), 1);
}

function workloadLabel(days: number) {
  if (days <= 1) return 'até 1 dia estimado';
  return `aprox. ${days} dias de carga`;
}

export function CommercialPage() {
  const {
    orders,
    loading,
    error,
    transitionOrder,
    recordContact,
  } = usePrimeTech();
  const [searchParams] = useSearchParams();
  const focusedOrderId = searchParams.get('os');

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [contactNote, setContactNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState('');

  const queue = useMemo(
    () => orders.filter((order) =>
      ['ready_for_commercial', 'budget_ready', 'waiting_customer'].includes(order.status),
    ),
    [orders],
  );

  useEffect(() => {
    if (!focusedOrderId || !queue.some((order) => order.id === focusedOrderId)) return;
    const timer = window.setTimeout(() => {
      document.getElementById(`commercial-order-${focusedOrderId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [focusedOrderId, queue]);

  const technicalDemand = useMemo(() => {
    const technicalStatuses = ['waiting_technician', 'diagnosis', 'approved', 'in_repair', 'waiting_part', 'quality_check'];
    const active = orders.filter((order) => technicalStatuses.includes(order.status));
    const groups = new Map<string, {
      key: string;
      name: string;
      orders: ServiceOrder[];
      days: number;
      urgent: number;
    }>();

    active.forEach((order) => {
      const key = order.assigned_technician_id || 'unassigned';
      const name = order.technician || 'Sem técnico definido';
      const current = groups.get(key) ?? { key, name, orders: [], days: 0, urgent: 0 };
      current.orders.push(order);
      current.days += workloadDays(order);
      if (order.priority === 'urgent' || order.priority === 'high') current.urgent += 1;
      groups.set(key, current);
    });

    return Array.from(groups.values()).sort((a, b) => {
      if (a.key === 'unassigned') return -1;
      if (b.key === 'unassigned') return 1;
      return b.days - a.days;
    });
  }, [orders]);

  const waitingCustomer = orders.filter((order) => order.status === 'waiting_customer');
  const approvedToday = orders.filter((order) =>
    order.approval_status === 'approved' && isToday(order.approved_at),
  ).length;
  const negotiationValue = waitingCustomer.reduce((sum, order) => sum + total(order), 0);
  const totalTechnicalDays = technicalDemand.reduce((sum, item) => sum + item.days, 0);
  const unassignedDemand = technicalDemand.find((item) => item.key === 'unassigned')?.orders.length ?? 0;

  async function move(order: ServiceOrder, status: 'waiting_customer' | 'approved' | 'cancelled', note: string) {
    setSaving(true);
    setLocalError('');
    try {
      await transitionOrder(order.id, status, note);
      setSelectedId(null);
      setContactNote('');
    } catch (cause) {
      setLocalError(cause instanceof Error ? cause.message : 'Não foi possível atualizar a negociação.');
    } finally {
      setSaving(false);
    }
  }

  async function saveContact(order: ServiceOrder) {
    if (!contactNote.trim()) {
      setLocalError('Informe a observação do contato.');
      return;
    }
    setSaving(true);
    setLocalError('');
    try {
      await recordContact(order.id, contactNote.trim());
      setSelectedId(null);
      setContactNote('');
    } catch (cause) {
      setLocalError(cause instanceof Error ? cause.message : 'Não foi possível registrar o contato.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="empty-state"><Clock3 size={38}/><h3>Carregando Comercial</h3><p>Buscando diagnósticos, capacidade técnica e negociações atualizadas.</p></div>;
  }

  return <>
    <PageHeader
      eyebrow="Comercial"
      title="Funil de orçamentos"
      description="Diagnóstico, orçamento e decisão do cliente com visão da demanda técnica para apoiar prazos mais realistas."
    />

    {(error || localError) && <section className="notice" style={{ marginBottom: 16 }}>
      <AlertTriangle size={20}/><div><strong>Não foi possível concluir a operação</strong><p>{localError || error}</p></div>
    </section>}

    {focusedOrderId && !queue.some((order) => order.id === focusedOrderId) && (
      <section className="notice" style={{ marginBottom: 16 }}>
        <CheckCircle2 size={20}/><div><strong>A OS indicada não está mais na fila Comercial</strong><p>Ela pode ter sido aprovada, recusada ou avançado para outra etapa. <Link to={`/ordens/${focusedOrderId}`}>Abrir a OS</Link>.</p></div>
      </section>
    )}

    <div className="metrics-grid">
      <MetricCard label="Prontos para orçamento" value={orders.filter((o) => ['ready_for_commercial', 'budget_ready'].includes(o.status)).length} icon={MessageSquareText}/>
      <MetricCard label="Aguardando cliente" value={waitingCustomer.length} icon={Clock3} tone="amber"/>
      <MetricCard label="Aprovados hoje" value={approvedToday} icon={CheckCircle2} tone="green"/>
      <MetricCard label="Em negociação" value={money.format(negotiationValue)} icon={CircleDollarSign} tone="violet"/>
    </div>

    <section className="panel" style={{ marginBottom: 20 }}>
      <div className="panel-head">
        <div><span className="eyebrow">Capacidade operacional</span><h2>Demanda dos técnicos</h2></div>
        <div className="quick-actions">
          <span className="ghost-button"><Gauge size={16}/> {totalTechnicalDays} dia(s) estimados</span>
          <span className="ghost-button"><UserRound size={16}/> {unassignedDemand} sem técnico</span>
          <Link to="/agenda" className="ghost-button">Abrir programação</Link>
        </div>
      </div>

      <div className="notice" style={{ marginTop: 0, marginBottom: 14 }}>
        <Clock3 size={18}/>
        <div><strong>Referência para o Comercial</strong><p>A carga abaixo soma os prazos técnicos informados nas OS abertas. É uma estimativa operacional para orientar o atendimento, não um prazo prometido ao cliente.</p></div>
      </div>

      {technicalDemand.length === 0 ? (
        <div className="empty-state" style={{ minHeight: 180 }}><CheckCircle2 size={34}/><h3>Sem demanda técnica aberta</h3></div>
      ) : (
        <div className="tech-demand-grid">
          {technicalDemand.map((item) => (
            <article className="tech-demand-card" key={item.key}>
              <strong>{item.name}</strong>
              <span>{item.orders.length} OS</span>
              <small>{workloadLabel(item.days)}{item.urgent ? ` · ${item.urgent} alta/urgente` : ''}</small>
              <div style={{ marginTop: 10, display: 'grid', gap: 5 }}>
                {item.orders.slice(0, 3).map((order) => (
                  <Link key={order.id} to={`/ordens/${order.id}`} style={{ color: 'var(--blue2)', fontSize: 11 }}>
                    {orderCode(order.order_number)} · {order.client_name ?? 'Cliente'}
                  </Link>
                ))}
                {item.orders.length > 3 && <small>+ {item.orders.length - 3} outra(s) OS</small>}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>

    <section className="panel">
      <div className="panel-head">
        <div><span className="eyebrow">Fila comercial</span><h2>Prioridades de atendimento</h2></div>
        <span className="ghost-button"><BellRing size={16}/> {queue.length} pendência(s)</span>
      </div>

      {queue.length === 0 ? <div className="empty-state"><CheckCircle2 size={38}/><h3>Fila comercial em dia</h3><p>Não há orçamentos aguardando ação.</p></div> : <div className="cards-list">
        {queue.map((order) => {
          const amount = total(order);
          const waiting = order.status === 'waiting_customer';
          const selected = selectedId === order.id;
          const focused = focusedOrderId === order.id;
          return <article id={`commercial-order-${order.id}`} className="commercial-card" key={order.id} style={focused ? { outline: '2px solid var(--blue2)', outlineOffset: 3 } : undefined}>
            <div>
              <span className="order-number">{orderCode(order.order_number)}{focused ? ' · OS selecionada' : ''}</span>
              <h3>{order.client_name ?? 'Cliente não identificado'}</h3>
              <p>{order.equipment ?? 'Equipamento não identificado'}</p>
              <small>{order.diagnosis ?? 'Diagnóstico técnico ainda não informado.'}</small>
              {order.technical_update && <small style={{ display: 'block', marginTop: 6 }}>Técnico: {order.technical_update}</small>}
              <small style={{ display: 'block', marginTop: 8, color: 'var(--blue2)' }}><Wrench size={12} style={{ verticalAlign: 'middle', marginRight: 5 }}/>Prazo técnico informado: {order.estimated_days == null ? 'a confirmar' : `${order.estimated_days} dia(s)`}</small>
            </div>

            <div className="commercial-right">
              <StatusBadge status={order.status}/>
              <strong>{amount > 0 ? money.format(amount) : 'Orçamento sem valor'}</strong>
              <Link to={`/ordens/${order.id}/itens`} className="ghost-button"><PackagePlus size={15}/> Itens / orçamento</Link>
              <Link to={`/ordens/${order.id}/documentos`} className="ghost-button">Imprimir OS / orçamento</Link>
              <Link to={`/ordens/${order.id}`} className="ghost-button">Abrir OS</Link>
              {!waiting && <button className="primary-button small" disabled={saving} onClick={() => void move(order, 'waiting_customer', 'Orçamento enviado ao cliente pelo Comercial.')}><Send size={15}/> Enviar orçamento</button>}
              {waiting && <>
                <button className="primary-button small" disabled={saving} onClick={() => void move(order, 'approved', 'Orçamento aprovado pelo cliente.')}><CheckCircle2 size={15}/> Aprovar</button>
                <button className="ghost-button" disabled={saving} onClick={() => { setSelectedId(selected ? null : order.id); setContactNote(''); }}><PhoneCall size={15}/> Registrar contato</button>
                <button className="ghost-button" disabled={saving} onClick={() => void move(order, 'cancelled', 'Orçamento recusado pelo cliente.')}><XCircle size={15}/> Recusado</button>
              </>}
            </div>

            {selected && <div style={{ gridColumn: '1 / -1', marginTop: 12 }}>
              <textarea rows={3} value={contactNote} onChange={(event) => setContactNote(event.target.value)} placeholder="Ex.: cliente pediu retorno amanhã às 14h..." style={{ width: '100%' }}/>
              <div className="quick-actions" style={{ marginTop: 8 }}>
                <button type="button" disabled={saving} onClick={() => void saveContact(order)}><PhoneCall size={15}/> Salvar contato</button>
                <button type="button" className="ghost-button" disabled={saving} onClick={() => { setSelectedId(null); setContactNote(''); }}>Cancelar</button>
              </div>
            </div>}
          </article>;
        })}
      </div>}
    </section>
  </>;
}
