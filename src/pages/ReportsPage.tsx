import {
  BarChart3,
  CheckCircle2,
  Clock,
  Gauge,
  TrendingUp,
  Wrench,
} from 'lucide-react';
import { useMemo } from 'react';

import { MetricCard } from '../components/ui/MetricCard';
import { PageHeader } from '../components/ui/PageHeader';
import { StatusBadge } from '../components/ui/StatusBadge';
import { usePrimeTech } from '../contexts/PrimeTechContext';
import { money } from '../lib/formatters';
import type { OrderStatus, ServiceOrder } from '../types/domain';

function hoursBetween(start?: string | null, end?: string | null) {
  if (!start || !end) return null;
  const value = (new Date(end).getTime() - new Date(start).getTime()) / 3_600_000;
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function durationLabel(hours: number) {
  if (!hours) return 'Sem histórico suficiente';
  if (hours < 24) return `${hours.toFixed(1).replace('.', ',')} h`;
  return `${(hours / 24).toFixed(1).replace('.', ',')} dias`;
}

const statusOrder: OrderStatus[] = [
  'waiting_technician',
  'diagnosis',
  'ready_for_commercial',
  'waiting_customer',
  'approved',
  'in_repair',
  'waiting_part',
  'quality_check',
  'ready_for_pickup',
  'delivered',
  'cancelled',
  'warranty',
];

function orderValue(order: ServiceOrder) {
  return Number(order.total_amount ?? order.quote_total ?? 0);
}

export function ReportsPage() {
  const {
    orders,
    history,
    finance,
    stock,
    loading,
    error,
  } = usePrimeTech();

  const diagnosisHours = useMemo(() => {
    return orders.flatMap((order) => {
      const event = history
        .filter((item) =>
          item.service_order_id === order.id
          && ['ready_for_commercial', 'budget_ready', 'waiting_customer'].includes(item.to_status),
        )
        .sort((a, b) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime())[0];

      const value = hoursBetween(order.created_at, event?.changed_at);
      return value === null ? [] : [value];
    });
  }, [history, orders]);

  const totalHours = useMemo(
    () => orders.flatMap((order) => {
      const value = hoursBetween(order.created_at, order.closed_at);
      return value === null ? [] : [value];
    }),
    [orders],
  );

  const decided = orders.filter((order) =>
    order.approval_status === 'approved' || order.approval_status === 'rejected',
  );
  const approved = decided.filter((order) => order.approval_status === 'approved');
  const approvalRate = decided.length ? (approved.length / decided.length) * 100 : 0;

  const warranty = orders.filter((order) =>
    order.status === 'warranty'
    || order.intake_type?.trim().toLowerCase().includes('garantia'),
  );
  const warrantyRate = orders.length ? (warranty.length / orders.length) * 100 : 0;

  const statusRows = statusOrder
    .map((status) => {
      const items = orders.filter((order) => order.status === status);
      return {
        status,
        count: items.length,
        value: items.reduce((sum, order) => sum + orderValue(order), 0),
      };
    })
    .filter((item) => item.count > 0);

  const openOrders = orders.filter((order) => !['delivered', 'cancelled'].includes(order.status));
  const technicalQueue = openOrders.filter((order) =>
    ['waiting_technician', 'diagnosis', 'approved', 'in_repair', 'waiting_part', 'quality_check'].includes(order.status),
  );
  const commercialQueue = openOrders.filter((order) =>
    ['ready_for_commercial', 'budget_ready', 'waiting_customer'].includes(order.status),
  );
  const commercialValue = commercialQueue.reduce((sum, order) => sum + orderValue(order), 0);

  const criticalStock = stock.filter(
    (item) => Number(item.physical) - Number(item.reserved) <= Number(item.minimum),
  ).length;

  const realizedIncome = finance
    .filter((entry) => entry.type === 'income')
    .reduce((sum, entry) => sum + Number(entry.amount), 0);
  const realizedExpense = finance
    .filter((entry) => entry.type === 'expense')
    .reduce((sum, entry) => sum + Number(entry.amount), 0);

  if (loading) {
    return (
      <div className="empty-state">
        <BarChart3 size={38} />
        <h3>Carregando indicadores</h3>
        <p>Consolidando o histórico operacional da empresa.</p>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Inteligência"
        title="Relatórios e indicadores"
        description="Indicadores calculados a partir das Ordens de Serviço, histórico, estoque e financeiro reais."
      />

      {error && (
        <section className="notice" style={{ marginBottom: 16 }}>
          <BarChart3 size={20} />
          <div>
            <strong>Parte dos indicadores pode estar incompleta</strong>
            <p>{error}</p>
          </div>
        </section>
      )}

      <div className="metrics-grid">
        <MetricCard
          label="Tempo médio até diagnóstico"
          value={durationLabel(average(diagnosisHours))}
          helper={`${diagnosisHours.length} OS com histórico mensurável`}
          icon={Clock}
        />
        <MetricCard
          label="Tempo médio total"
          value={durationLabel(average(totalHours))}
          helper={`${totalHours.length} OS encerradas`}
          icon={Gauge}
          tone="violet"
        />
        <MetricCard
          label="Taxa de aprovação"
          value={`${approvalRate.toFixed(1).replace('.', ',')}%`}
          helper={`${approved.length} de ${decided.length} decisões`}
          icon={TrendingUp}
          tone="green"
        />
        <MetricCard
          label="Garantia / retorno"
          value={`${warrantyRate.toFixed(1).replace('.', ',')}%`}
          helper={`${warranty.length} OS identificadas como garantia`}
          icon={BarChart3}
          tone="amber"
        />
      </div>

      <div className="dashboard-grid three">
        <section className="panel">
          <div className="panel-head"><h2>Operação técnica</h2></div>
          <div className="mini-kpis">
            <div><span>{technicalQueue.length}</span><small>Na fila técnica</small></div>
            <div><span>{orders.filter((order) => order.status === 'quality_check').length}</span><small>Em testes</small></div>
            <div><span>{orders.filter((order) => order.status === 'ready_for_pickup').length}</span><small>Prontas para retirada</small></div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head"><h2>Comercial</h2></div>
          <div className="mini-kpis">
            <div><span>{commercialQueue.length}</span><small>Pendências comerciais</small></div>
            <div><span>{money.format(commercialValue)}</span><small>Valor no funil</small></div>
            <div><span>{approved.length}</span><small>Aprovações registradas</small></div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head"><h2>Recursos</h2></div>
          <div className="mini-kpis">
            <div><span>{criticalStock}</span><small>Itens críticos</small></div>
            <div><span>{money.format(realizedIncome)}</span><small>Receitas realizadas</small></div>
            <div><span>{money.format(realizedIncome - realizedExpense)}</span><small>Resultado acumulado</small></div>
          </div>
        </section>
      </div>

      <section className="panel" style={{ marginTop: 20 }}>
        <div className="panel-head">
          <div>
            <span className="eyebrow">Pipeline</span>
            <h2>Distribuição das Ordens de Serviço</h2>
          </div>
          <span className="ghost-button"><Wrench size={16} /> {orders.length} OS no histórico</span>
        </div>

        {statusRows.length === 0 ? (
          <div className="empty-state">
            <CheckCircle2 size={38} />
            <h3>Sem dados para consolidar</h3>
            <p>Os indicadores serão preenchidos conforme as OS forem movimentadas.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Quantidade</th>
                  <th>Valor das OS</th>
                  <th>Participação</th>
                </tr>
              </thead>
              <tbody>
                {statusRows.map((row) => (
                  <tr key={row.status}>
                    <td><StatusBadge status={row.status} /></td>
                    <td><strong>{row.count}</strong></td>
                    <td>{money.format(row.value)}</td>
                    <td>
                      {orders.length
                        ? `${((row.count / orders.length) * 100).toFixed(1).replace('.', ',')}%`
                        : '0,0%'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
