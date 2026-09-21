import {
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Save,
  Wrench,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { PageHeader } from '../components/ui/PageHeader';
import { StatusBadge } from '../components/ui/StatusBadge';
import { useAuth } from '../contexts/AuthContext';
import { usePrimeTech } from '../contexts/PrimeTechContext';
import { dateTime, orderCode } from '../lib/formatters';
import { can } from '../lib/permissions';
import { supabase } from '../lib/supabase';
import type { ServiceOrder } from '../types/domain';

function inputDate(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10);
}

function inputTime(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(11, 16);
}

export function SchedulePage() {
  const { mode, user } = useAuth();
  const { orders, loading, error, refresh } = usePrimeTech();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState('');

  const canSchedule = can(user, 'orders.commercial') || can(user, 'orders.tech');

  const openOrders = useMemo(
    () => orders
      .filter((order) => !['delivered', 'cancelled'].includes(order.status))
      .sort((a, b) => {
        if (a.scheduled_at && b.scheduled_at) return new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime();
        if (a.scheduled_at) return -1;
        if (b.scheduled_at) return 1;
        return a.order_number - b.order_number;
      }),
    [orders],
  );

  const scheduled = openOrders.filter((order) => Boolean(order.scheduled_at));
  const unscheduled = openOrders.length - scheduled.length;
  const today = new Date();
  const todayCount = scheduled.filter((order) => {
    const value = new Date(order.scheduled_at as string);
    return value.getFullYear() === today.getFullYear()
      && value.getMonth() === today.getMonth()
      && value.getDate() === today.getDate();
  }).length;

  function openEditor(order: ServiceOrder) {
    if (!canSchedule) {
      setLocalError('Seu perfil pode consultar a agenda, mas não pode alterar a programação técnica.');
      return;
    }

    setEditingId(order.id);
    setDate(inputDate(order.scheduled_at));
    setTime(inputTime(order.scheduled_at) || '08:00');
    setLocalError('');
  }

  async function saveSchedule(order: ServiceOrder) {
    if (!canSchedule) {
      setLocalError('Seu perfil não possui permissão para alterar a programação técnica.');
      return;
    }

    if (!date || !time) {
      setLocalError('Informe data e horário da programação.');
      return;
    }
    if (mode !== 'supabase' || !supabase) {
      setLocalError('A alteração da agenda está disponível no ambiente conectado ao Supabase.');
      return;
    }

    setSaving(true);
    setLocalError('');
    try {
      const scheduledAt = new Date(`${date}T${time}:00`).toISOString();
      const { error: updateError } = await supabase
        .from('service_orders')
        .update({ scheduled_at: scheduledAt, updated_at: new Date().toISOString() })
        .eq('id', order.id);

      if (updateError) throw updateError;
      await refresh();
      setEditingId(null);
    } catch (cause) {
      setLocalError(cause instanceof Error ? cause.message : 'Não foi possível salvar a programação.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="empty-state"><CalendarClock size={38}/><h3>Carregando programação</h3><p>Organizando as Ordens de Serviço abertas.</p></div>;
  }

  return <>
    <PageHeader
      eyebrow="Operação técnica"
      title="Programação técnica"
      description="Agenda real das OS, com data, horário, técnico responsável e situação operacional."
    />

    {(error || localError) && <section className="notice" style={{ marginBottom: 16 }}>
      <AlertTriangle size={20}/><div><strong>Não foi possível concluir a operação</strong><p>{localError || error}</p></div>
    </section>}

    <div className="tech-summary">
      <article><CalendarDays/><div><strong>{scheduled.length}</strong><span>Programadas</span></div></article>
      <article><Clock3/><div><strong>{todayCount}</strong><span>Para hoje</span></div></article>
      <article><AlertTriangle/><div><strong>{unscheduled}</strong><span>Sem horário</span></div></article>
      <article><Wrench/><div><strong>{openOrders.length}</strong><span>OS abertas</span></div></article>
    </div>

    <section className="panel" style={{ marginTop: 20 }}>
      {openOrders.length === 0 ? <div className="empty-state"><CheckCircle2 size={38}/><h3>Sem OS abertas</h3><p>A programação técnica está livre.</p></div> : <div className="schedule-list">
        {openOrders.map((order) => {
          const editing = editingId === order.id;
          return <article key={order.id}>
            <div className="schedule-time">
              <Clock3/>
              <strong>{order.scheduled_at ? dateTime.format(new Date(order.scheduled_at)) : 'Sem agenda'}</strong>
            </div>
            <div style={{ minWidth: 0 }}>
              <span>{orderCode(order.order_number)}</span>
              <h3>{order.client_name ?? 'Cliente não identificado'}</h3>
              <p>{order.equipment ?? 'Equipamento não identificado'} · {order.technician ?? 'Técnico a confirmar'}</p>
              <StatusBadge status={order.status}/>

              {editing && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12, alignItems: 'end' }}>
                <label style={{ display: 'grid', gap: 4 }}><span>Data</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)}/></label>
                <label style={{ display: 'grid', gap: 4 }}><span>Horário</span><input type="time" value={time} onChange={(event) => setTime(event.target.value)}/></label>
                <button type="button" disabled={saving} onClick={() => void saveSchedule(order)}><Save size={15}/> Salvar</button>
                <button type="button" className="ghost-button" disabled={saving} onClick={() => setEditingId(null)}>Cancelar</button>
              </div>}
            </div>
            <div style={{ display: 'grid', gap: 8, justifyItems: 'end' }}>
              <CalendarDays className="schedule-icon"/>
              {canSchedule && <button type="button" className="ghost-button" onClick={() => openEditor(order)}><CalendarClock size={15}/> {order.scheduled_at ? 'Reagendar' : 'Programar'}</button>}
              <Link to={`/ordens/${order.id}`} className="ghost-button">Ver OS</Link>
            </div>
          </article>;
        })}
      </div>}
    </section>
  </>;
}
