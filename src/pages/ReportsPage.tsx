import {
  BarChart3,
  CheckCircle2,
  Clock,
  Gauge,
  Printer,
  TrendingUp,
  Wrench,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { PrintableReport } from '../components/reports/PrintableReport';
import { MetricCard } from '../components/ui/MetricCard';
import { PageHeader } from '../components/ui/PageHeader';
import { StatusBadge } from '../components/ui/StatusBadge';
import { useAuth } from '../contexts/AuthContext';
import { usePrimeTech } from '../contexts/PrimeTechContext';
import { money } from '../lib/formatters';
import { technicalSpecialtyLabel } from '../lib/technicalSpecialties';
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

function orderValue(order: ServiceOrder) {
  return Number(order.total_amount ?? order.quote_total ?? 0);
}

function inDateRange(value: string, from: string, to: string) {
  const date = value.slice(0, 10);
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
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

export function ReportsPage() {
  const { user } = useAuth();
  const {
    orders,
    history,
    finance,
    stock,
    company,
    loading,
    error,
  } = usePrimeTech();

  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const today = now.toISOString().slice(0, 10);

  const [from, setFrom] = useState(firstDay);
  const [to, setTo] = useState(today);
  const [specialty, setSpecialty] = useState('all');
  const [printOpen, setPrintOpen] = useState(false);

  const filteredOrders = useMemo(
    () => orders.filter((order) => {
      if (!inDateRange(order.created_at, from, to)) return false;
      return specialty === 'all' || order.technical_specialty_code === specialty;
    }),
    [from, orders, specialty, to],
  );

  const orderIds = useMemo(
    () => new Set(filteredOrders.map((order) => order.id)),
    [filteredOrders],
  );

  const filteredHistory = useMemo(
    () => history.filter((item) => orderIds.has(item.service_order_id)),
    [history, orderIds],
  );

  const filteredFinance = useMemo(
    () => finance.filter((entry) => inDateRange(entry.occurred_at, from, to)),
    [finance, from, to],
  );

  const diagnosisHours = useMemo(() => (
    filteredOrders.flatMap((order) => {
      const event = filteredHistory
        .filter((item) => item.service_order_id === order.id
          && ['ready_for_commercial', 'budget_ready', 'waiting_customer'].includes(item.to_status))
        .sort((a, b) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime())[0];

      const value = hoursBetween(order.created_at, event?.changed_at);
      return value === null ? [] : [value];
    })
  ), [filteredHistory, filteredOrders]);

  const totalHours = useMemo(
    () => filteredOrders.flatMap((order) => {
      const value = hoursBetween(order.created_at, order.closed_at);
      return value === null ? [] : [value];
    }),
    [filteredOrders],
  );

  const decided = filteredOrders.filter((order) =>
    order.approval_status === 'approved' || order.approval_status === 'rejected');
  const approved = decided.filter((order) => order.approval_status === 'approved');
  const approvalRate = decided.length ? (approved.length / decided.length) * 100 : 0;

  const warranty = filteredOrders.filter((order) =>
    order.status === 'warranty'
    || order.intake_type?.trim().toLowerCase().includes('garantia'));
  const warrantyRate = filteredOrders.length ? (warranty.length / filteredOrders.length) * 100 : 0;

  const statusRows = statusOrder
    .map((status) => {
      const items = filteredOrders.filter((order) => order.status === status);
      return {
        status,
        count: items.length,
        value: items.reduce((sum, order) => sum + orderValue(order), 0),
      };
    })
    .filter((item) => item.count > 0);

  const openOrders = filteredOrders.filter((order) => !['delivered', 'cancelled'].includes(order.status));
  const technicalQueue = openOrders.filter((order) =>
    ['waiting_technician', 'diagnosis', 'approved', 'in_repair', 'waiting_part', 'quality_check'].includes(order.status));
  const commercialQueue = openOrders.filter((order) =>
    ['ready_for_commercial', 'budget_ready', 'waiting_customer'].includes(order.status));
  const commercialValue = commercialQueue.reduce((sum, order) => sum + orderValue(order), 0);

  const specialtyRows = useMemo(() => {
    const groups = new Map<string, { count: number; open: number; value: number; approved: number }>();

    filteredOrders.forEach((order) => {
      const code = order.technical_specialty_code ?? 'nao_definida';
      const current = groups.get(code) ?? { count: 0, open: 0, value: 0, approved: 0 };
      current.count += 1;
      current.value += orderValue(order);
      if (!['delivered', 'cancelled'].includes(order.status)) current.open += 1;
      if (order.approval_status === 'approved') current.approved += 1;
      groups.set(code, current);
    });

    return Array.from(groups.entries())
      .map(([code, values]) => ({ code, ...values }))
      .sort((a, b) => b.count - a.count);
  }, [filteredOrders]);

  const criticalStock = stock.filter(
    (item) => Number(item.physical) - Number(item.reserved) <= Number(item.minimum),
  ).length;

  const realizedIncome = filteredFinance
    .filter((entry) => entry.type === 'income')
    .reduce((sum, entry) => sum + Number(entry.amount), 0);
  const realizedExpense = filteredFinance
    .filter((entry) => entry.type === 'expense')
    .reduce((sum, entry) => sum + Number(entry.amount), 0);

  const filters = [
    { label: 'Período', value: `${from || 'início'} até ${to || 'hoje'}` },
    { label: 'Especialidade', value: specialty === 'all' ? 'Todas' : technicalSpecialtyLabel(specialty) },
  ];

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
        description="Visão detalhada da operação, comercial, especialidades, estoque e financeiro com exportação em PDF."
        actions={(
          <button type="button" className="primary-button" onClick={() => setPrintOpen(true)}>
            <Printer size={16} /> Gerar PDF
          </button>
        )}
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

      <section className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-head" style={{ marginBottom: 0 }}>
          <div>
            <span className="eyebrow">Filtros</span>
            <h2>Recorte do relatório</h2>
          </div>
          <div className="quick-actions" style={{ alignItems: 'end' }}>
            <label style={{ display: 'grid', gap: 4 }}>
              <span className="muted">De</span>
              <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
            </label>
            <label style={{ display: 'grid', gap: 4 }}>
              <span className="muted">Até</span>
              <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
            </label>
            <label style={{ display: 'grid', gap: 4 }}>
              <span className="muted">Especialidade</span>
              <select value={specialty} onChange={(event) => setSpecialty(event.target.value)}>
                <option value="all">Todas</option>
                <option value="impressoras">Impressoras</option>
                <option value="computadores">Computadores</option>
              </select>
            </label>
          </div>
        </div>
      </section>

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
            <div><span>{filteredOrders.filter((order) => order.status === 'quality_check').length}</span><small>Em testes</small></div>
            <div><span>{filteredOrders.filter((order) => order.status === 'ready_for_pickup').length}</span><small>Prontas para retirada</small></div>
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
            <div><span>{money.format(realizedIncome)}</span><small>Receitas no período</small></div>
            <div><span>{money.format(realizedIncome - realizedExpense)}</span><small>Resultado realizado</small></div>
          </div>
        </section>
      </div>

      <div className="dashboard-grid" style={{ marginTop: 20 }}>
        <section className="panel">
          <div className="panel-head">
            <div>
              <span className="eyebrow">Especialidades</span>
              <h2>Distribuição técnica</h2>
            </div>
          </div>

          {specialtyRows.length === 0 ? (
            <div className="empty-state">
              <CheckCircle2 size={36} />
              <h3>Sem OS no período</h3>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Especialidade</th>
                    <th>OS</th>
                    <th>Abertas</th>
                    <th>Aprovadas</th>
                    <th>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {specialtyRows.map((row) => (
                    <tr key={row.code}>
                      <td><strong>{technicalSpecialtyLabel(row.code)}</strong></td>
                      <td>{row.count}</td>
                      <td>{row.open}</td>
                      <td>{row.approved}</td>
                      <td>{money.format(row.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel-head">
            <div>
              <span className="eyebrow">Pipeline</span>
              <h2>Status das OS</h2>
            </div>
            <span className="ghost-button"><Wrench size={16} /> {filteredOrders.length} OS</span>
          </div>

          {statusRows.length === 0 ? (
            <div className="empty-state">
              <CheckCircle2 size={38} />
              <h3>Sem dados para consolidar</h3>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Qtd.</th>
                    <th>Valor</th>
                    <th>%</th>
                  </tr>
                </thead>
                <tbody>
                  {statusRows.map((row) => (
                    <tr key={row.status}>
                      <td><StatusBadge status={row.status} /></td>
                      <td><strong>{row.count}</strong></td>
                      <td>{money.format(row.value)}</td>
                      <td>
                        {filteredOrders.length
                          ? `${((row.count / filteredOrders.length) * 100).toFixed(1).replace('.', ',')}%`
                          : '0,0%'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <PrintableReport
        open={printOpen}
        onClose={() => setPrintOpen(false)}
        title="Relatório Gerencial Consolidado"
        subtitle="Operação, comercial, especialidades e resultado financeiro"
        company={company}
        generatedBy={user?.full_name}
        filters={filters}
      >
        <PrintSummary
          orders={filteredOrders.length}
          technicalQueue={technicalQueue.length}
          commercialQueue={commercialQueue.length}
          approvalRate={approvalRate}
          realizedIncome={realizedIncome}
          realizedExpense={realizedExpense}
        />

        <PrintTableTitle>Distribuição por especialidade</PrintTableTitle>
        <table style={printTable}>
          <thead>
            <tr>
              <th style={printTh}>Especialidade</th>
              <th style={printTh}>OS</th>
              <th style={printTh}>Abertas</th>
              <th style={printTh}>Aprovadas</th>
              <th style={{ ...printTh, textAlign: 'right' }}>Valor</th>
            </tr>
          </thead>
          <tbody>
            {specialtyRows.map((row) => (
              <tr key={row.code}>
                <td style={printTd}>{technicalSpecialtyLabel(row.code)}</td>
                <td style={printTd}>{row.count}</td>
                <td style={printTd}>{row.open}</td>
                <td style={printTd}>{row.approved}</td>
                <td style={{ ...printTd, textAlign: 'right' }}>{money.format(row.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <PrintTableTitle>Distribuição por status</PrintTableTitle>
        <table style={printTable}>
          <thead>
            <tr>
              <th style={printTh}>Status</th>
              <th style={printTh}>Quantidade</th>
              <th style={{ ...printTh, textAlign: 'right' }}>Valor</th>
            </tr>
          </thead>
          <tbody>
            {statusRows.map((row) => (
              <tr key={row.status}>
                <td style={printTd}>{row.status.replace(/_/g, ' ')}</td>
                <td style={printTd}>{row.count}</td>
                <td style={{ ...printTd, textAlign: 'right' }}>{money.format(row.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </PrintableReport>
    </>
  );
}

function PrintSummary({
  orders,
  technicalQueue,
  commercialQueue,
  approvalRate,
  realizedIncome,
  realizedExpense,
}: {
  orders: number;
  technicalQueue: number;
  commercialQueue: number;
  approvalRate: number;
  realizedIncome: number;
  realizedExpense: number;
}) {
  const cards = [
    ['OS no período', String(orders)],
    ['Fila técnica', String(technicalQueue)],
    ['Fila comercial', String(commercialQueue)],
    ['Aprovação', `${approvalRate.toFixed(1).replace('.', ',')}%`],
    ['Receitas', money.format(realizedIncome)],
    ['Resultado', money.format(realizedIncome - realizedExpense)],
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 22 }}>
      {cards.map(([label, value]) => (
        <div key={label} style={{ border: '1px solid #dbe3ee', borderRadius: 7, padding: 10 }}>
          <div style={{ color: '#64748b', fontSize: 10, textTransform: 'uppercase' }}>{label}</div>
          <strong style={{ display: 'block', marginTop: 3, fontSize: 15 }}>{value}</strong>
        </div>
      ))}
    </div>
  );
}

function PrintTableTitle({ children }: { children: React.ReactNode }) {
  return <h3 style={{ margin: '18px 0 7px', fontSize: 14 }}>{children}</h3>;
}

const printTable = {
  width: '100%',
  borderCollapse: 'collapse' as const,
};

const printTh = {
  padding: '7px 8px',
  borderBottom: '1px solid #cbd5e1',
  color: '#475569',
  textAlign: 'left' as const,
  fontSize: 10,
  textTransform: 'uppercase' as const,
};

const printTd = {
  padding: '7px 8px',
  borderBottom: '1px solid #e2e8f0',
};
