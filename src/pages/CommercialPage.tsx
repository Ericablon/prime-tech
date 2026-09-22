import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  MessageSquareText,
  PackagePlus,
  PhoneCall,
  Send,
  XCircle,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

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

export function CommercialPage() {
  const {
    orders,
    loading,
    error,
    transitionOrder,
    recordContact,
  } = usePrimeTech();

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

  const waitingCustomer = orders.filter((order) => order.status === 'waiting_customer');
  const approvedToday = orders.filter((order) =>
    order.approval_status === 'approved' && isToday(order.approved_at),
  ).length;
  const negotiationValue = waitingCustomer.reduce((sum, order) => sum + total(order), 0);

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
    return <div className="empty-state"><Clock3 size={38}/><h3>Carregando Comercial</h3><p>Buscando diagnósticos e negociações atualizadas.</p></div>;
  }

  return <>
    <PageHeader
      eyebrow="Comercial"
      title="Funil de orçamentos"
      description="Diagnóstico técnico, serviços, produtos do estoque, follow-up e decisão do cliente em um único fluxo."
    />

    {(error || localError) && <section className="notice" style={{ marginBottom: 16 }}>
      <AlertTriangle size={20}/><div><strong>Não foi possível concluir a operação</strong><p>{localError || error}</p></div>
    </section>}

    <div className="metrics-grid">
      <MetricCard label="Prontos para orçamento" value={orders.filter((o) => ['ready_for_commercial', 'budget_ready'].includes(o.status)).length} icon={MessageSquareText}/>
      <MetricCard label="Aguardando cliente" value={waitingCustomer.length} icon={Clock3} tone="amber"/>
      <MetricCard label="Aprovados hoje" value={approvedToday} icon={CheckCircle2} tone="green"/>
      <MetricCard label="Em negociação" value={money.format(negotiationValue)} icon={CircleDollarSign} tone="violet"/>
    </div>

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
          return <article className="commercial-card" key={order.id}>
            <div>
              <span className="order-number">{orderCode(order.order_number)}</span>
              <h3>{order.client_name ?? 'Cliente não identificado'}</h3>
              <p>{order.equipment ?? 'Equipamento não identificado'}</p>
              <small>{order.diagnosis ?? 'Diagnóstico técnico ainda não informado.'}</small>
              {order.technical_update && <small style={{ display: 'block', marginTop: 6 }}>Técnico: {order.technical_update}</small>}
            </div>

            <div className="commercial-right">
              <StatusBadge status={order.status}/>
              <strong>{amount > 0 ? money.format(amount) : 'Orçamento sem valor'}</strong>
              <Link to={`/ordens/${order.id}/itens`} className="ghost-button"><PackagePlus size={15}/> Itens / orçamento</Link>
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
