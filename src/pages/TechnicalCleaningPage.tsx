import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { PageHeader } from '../components/ui/PageHeader';
import { StatusBadge } from '../components/ui/StatusBadge';
import { usePrimeTech } from '../contexts/PrimeTechContext';
import { orderCode } from '../lib/formatters';
import type { ServiceOrder } from '../types/domain';

type CleaningChecks = {
  exterior: boolean;
  interior: boolean;
  connectors: boolean;
  accessories: boolean;
  identification: boolean;
  finalInspection: boolean;
};

const emptyChecks: CleaningChecks = {
  exterior: false,
  interior: false,
  connectors: false,
  accessories: false,
  identification: false,
  finalInspection: false,
};

const checklist: Array<{ key: keyof CleaningChecks; label: string }> = [
  { key: 'exterior', label: 'Limpeza externa concluída' },
  { key: 'interior', label: 'Limpeza interna/área técnica concluída' },
  { key: 'connectors', label: 'Conectores, cabos e superfícies conferidos' },
  { key: 'accessories', label: 'Acessórios recebidos conferidos' },
  { key: 'identification', label: 'Etiqueta/identificação da OS conferida' },
  { key: 'finalInspection', label: 'Inspeção visual final aprovada' },
];

function isToday(value?: string | null) {
  if (!value) return false;
  const date = new Date(value);
  const today = new Date();
  return date.getFullYear() === today.getFullYear()
    && date.getMonth() === today.getMonth()
    && date.getDate() === today.getDate();
}

export function TechnicalCleaningPage() {
  const {
    orders,
    loading,
    error,
    updateTechnicalStatus,
  } = usePrimeTech();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checks, setChecks] = useState<CleaningChecks>(emptyChecks);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState('');

  const queue = useMemo(
    () => orders.filter((order) =>
      order.status === 'quality_check' || order.technical_status === 'quality_check',
    ),
    [orders],
  );

  const completedToday = orders.filter((order) =>
    isToday(order.technical_completed_at),
  ).length;

  const selectedOrder = queue.find((order) => order.id === selectedId) ?? null;
  const allChecked = Object.values(checks).every(Boolean);

  function openChecklist(order: ServiceOrder) {
    setSelectedId(order.id);
    setChecks(emptyChecks);
    setNote('');
    setLocalError('');
  }

  function closeChecklist() {
    setSelectedId(null);
    setChecks(emptyChecks);
    setNote('');
    setLocalError('');
  }

  async function completeCleaning() {
    if (!selectedOrder) return;
    if (!allChecked) {
      setLocalError('Conclua todos os itens do checklist antes de liberar o equipamento.');
      return;
    }

    setSaving(true);
    setLocalError('');
    try {
      const detail = note.trim() ? ` Observação: ${note.trim()}` : '';
      await updateTechnicalStatus({
        order_id: selectedOrder.id,
        technical_status: 'completed',
        note: `Limpeza técnica, conferência de acessórios e inspeção visual final concluídas.${detail}`,
        estimated_days: selectedOrder.estimated_days ?? null,
      });
      closeChecklist();
    } catch (cause) {
      setLocalError(cause instanceof Error ? cause.message : 'Não foi possível concluir a limpeza técnica.');
    } finally {
      setSaving(false);
    }
  }

  async function returnToMaintenance(order: ServiceOrder) {
    setSaving(true);
    setLocalError('');
    try {
      await updateTechnicalStatus({
        order_id: order.id,
        technical_status: 'in_progress',
        note: 'Equipamento reprovado na inspeção final e devolvido para manutenção.',
        estimated_days: order.estimated_days ?? null,
      });
      closeChecklist();
    } catch (cause) {
      setLocalError(cause instanceof Error ? cause.message : 'Não foi possível devolver a OS para manutenção.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="empty-state"><RefreshCw size={38}/><h3>Carregando limpeza técnica</h3><p>Buscando equipamentos em testes e inspeção final.</p></div>;
  }

  return <>
    <PageHeader
      eyebrow="Operação técnica"
      title="Limpeza técnica"
      description="Checklist final antes da liberação: limpeza, acessórios, identificação e inspeção visual."
    />

    {(error || localError) && <section className="notice" style={{ marginBottom: 16 }}>
      <AlertTriangle size={20}/><div><strong>Não foi possível concluir a operação</strong><p>{localError || error}</p></div>
    </section>}

    <div className="tech-summary">
      <article><Sparkles/><div><strong>{queue.length}</strong><span>Aguardando limpeza</span></div></article>
      <article><ClipboardCheck/><div><strong>{selectedOrder ? Object.values(checks).filter(Boolean).length : 0}/6</strong><span>Checklist atual</span></div></article>
      <article><CheckCircle2/><div><strong>{completedToday}</strong><span>Liberadas hoje</span></div></article>
      <article><ShieldCheck/><div><strong>6</strong><span>Itens obrigatórios</span></div></article>
    </div>

    <section className="panel" style={{ marginTop: 20 }}>
      <div className="panel-head"><div><span className="eyebrow">Fila de qualidade</span><h2>Equipamentos para acabamento final</h2></div></div>

      {queue.length === 0 ? <div className="empty-state"><CheckCircle2 size={38}/><h3>Fila de limpeza em dia</h3><p>Nenhuma OS está aguardando inspeção final neste momento.</p></div> : <div className="cards-list">
        {queue.map((order) => {
          const selected = selectedId === order.id;
          return <article className="work-card" key={order.id}>
            <div className="work-card-top">
              <div><span className="order-number">{orderCode(order.order_number)}</span><h3>{order.client_name ?? 'Cliente não identificado'}</h3><p>{order.equipment ?? 'Equipamento não identificado'}</p></div>
              <StatusBadge status={order.status}/>
            </div>

            {order.technical_update && <div className="notice" style={{ marginTop: 12, marginBottom: 0 }}><FileText size={18}/><div><strong>Última atualização técnica</strong><p>{order.technical_update}</p></div></div>}

            <div className="quick-actions" style={{ marginTop: 14, flexWrap: 'wrap' }}>
              <Link to={`/ordens/${order.id}`} className="ghost-button"><FileText size={15}/> Ver OS</Link>
              <button type="button" onClick={() => selected ? closeChecklist() : openChecklist(order)}><ClipboardCheck size={15}/> {selected ? 'Fechar checklist' : 'Iniciar checklist'}</button>
              <button type="button" className="ghost-button" disabled={saving} onClick={() => void returnToMaintenance(order)}><RotateCcw size={15}/> Reprovar e retornar</button>
            </div>

            {selected && <section className="panel" style={{ marginTop: 16, padding: 16 }}>
              <span className="eyebrow">Checklist obrigatório</span>
              <h3 style={{ marginTop: 4 }}>Conferência para liberação</h3>

              <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
                {checklist.map((item) => <label key={item.key} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={checks[item.key]}
                    onChange={(event) => setChecks((current) => ({ ...current, [item.key]: event.target.checked }))}
                  />
                  <span>{item.label}</span>
                </label>)}
              </div>

              <label style={{ display: 'grid', gap: 6, marginTop: 14 }}>
                <span>Observação final (opcional)</span>
                <textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Registre alguma observação antes da liberação..."/>
              </label>

              <div className="quick-actions" style={{ marginTop: 14, flexWrap: 'wrap' }}>
                <button type="button" disabled={saving || !allChecked} onClick={() => void completeCleaning()}><CheckCircle2 size={16}/> Concluir limpeza e liberar</button>
                <button type="button" className="ghost-button" disabled={saving} onClick={closeChecklist}>Cancelar</button>
              </div>
            </section>}
          </article>;
        })}
      </div>}
    </section>
  </>;
}
