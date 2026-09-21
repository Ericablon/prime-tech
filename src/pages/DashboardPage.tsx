import {
  AlertTriangle,
  Banknote,
  Boxes,
  BriefcaseBusiness,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  FileCheck2,
  Gauge,
  TrendingUp,
  Wrench,
} from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';

import { MetricCard } from '../components/ui/MetricCard';
import { PageHeader } from '../components/ui/PageHeader';
import { StatusBadge } from '../components/ui/StatusBadge';
import { useAuth } from '../contexts/AuthContext';
import { usePrimeTech } from '../contexts/PrimeTechContext';
import { dateTime, money, orderCode } from '../lib/formatters';
import { can } from '../lib/permissions';
import type { ServiceOrder } from '../types/domain';

function isCurrentMonth(value: string) {
  const date = new Date(value);
  const today = new Date();

  return (
    date.getFullYear() === today.getFullYear()
    && date.getMonth() === today.getMonth()
  );
}

function hoursSince(value?: string | null) {
  if (!value) return 0;
  return Math.max(0, (Date.now() - new Date(value).getTime()) / 3_600_000);
}

const priorityWeight: Record<ServiceOrder['priority'], number> = {
  urgent: 4,
  high: 3,
  normal: 2,
  low: 1,
};

export function DashboardPage() {
  const { user } = useAuth();
  const {
    orders,
    stock,
    finance,
    installments,
    loading,
    error,
  } = usePrimeTech();

  const active = useMemo(
    () => orders.filter((order) => !['delivered', 'cancelled'].includes(order.status)),
    [orders],
  );

  const technical = active.filter((order) =>
    ['diagnosis', 'approved', 'in_repair', 'waiting_part', 'quality_check'].includes(order.status),
  );

  const waitingCustomer = active.filter((order) => order.status === 'waiting_customer');
  const staleFollowups = waitingCustomer.filter((order) => hoursSince(order.updated_at) >= 48);

  const criticalStock = stock.filter(
    (item) => Number(item.physical) - Number(item.reserved) <= Number(item.minimum),
  );

  const monthEntries = finance.filter((entry) => isCurrentMonth(entry.occurred_at));
  const monthRevenue = monthEntries
    .filter((entry) => entry.type === 'income')
    .reduce((sum, entry) => sum + Number(entry.amount), 0);
  const monthExpenses = monthEntries
    .filter((entry) => entry.type === 'expense')
    .reduce((sum, entry) => sum + Number(entry.amount), 0);

  const receivables = installments
    .filter((item) => item.type === 'income' && !item.paid_at)
    .reduce((sum, item) => sum + Number(item.amount), 0);
  const payables = installments
    .filter((item) => item.type === 'expense' && !item.paid_at)
    .reduce((sum, item) => sum + Number(item.amount), 0);

  const negotiationValue = waitingCustomer.reduce(
    (sum, order) => sum + Number(order.total_amount ?? order.quote_total ?? 0),
    0,
  );

  const fiscalReady = orders.filter(
    (order) =>
      ['ready_for_pickup', 'delivered'].includes(order.status)
      && Number(order.total_amount ?? order.quote_total ?? 0) > 0,
  );

  const attention = useMemo(
    () => [...active]
      .sort((a, b) => {
        const priority = priorityWeight[b.priority] - priorityWeight[a.priority];
        if (priority !== 0) return priority;
        return new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
      })
      .slice(0, 8),
    [active],
  );

  const canOrders = can(user, 'orders.view');
  const canCreateOrder = can(user, 'orders.create');
  const canCommercial = can(user, 'orders.commercial');
  const canStock = can(user, 'stock.view');
  const canFinance = can(user, 'finance.view');
  const canFiscal = can(user, 'fiscal.view');

  if (loading) {
    return (
      <div className="empty-state">
        <Gauge size={38} />
        <h3>Carregando centro de comando</h3>
        <p>Consolidando operação, estoque, financeiro e fiscal.</p>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Centro de comando"
        title="Visão geral da operação"
        description="Indicadores reais da empresa ativa, respeitando as permissões de cada perfil."
        actions={
          canCreateOrder ? (
            <Link to="/ordens/nova" className="primary-button">
              + Nova OS
            </Link>
          ) : undefined
        }
      />

      {error && (
        <section className="notice" style={{ marginBottom: 16 }}>
          <AlertTriangle size={20} />
          <div>
            <strong>Alguns dados não puderam ser carregados</strong>
            <p>{error}</p>
          </div>
        </section>
      )}

      <div className="metrics-grid">
        {canOrders && (
          <MetricCard
            label="OS ativas"
            value={active.length}
            helper="Operação atual"
            icon={Wrench}
          />
        )}

        {canOrders && (
          <MetricCard
            label="Em execução técnica"
            value={technical.length}
            helper="Diagnóstico, reparo e testes"
            icon={Gauge}
            tone="violet"
          />
        )}

        {canCommercial && (
          <MetricCard
            label="Aguardando cliente"
            value={waitingCustomer.length}
            helper={`${staleFollowups.length} sem atualização há 48h+`}
            icon={BriefcaseBusiness}
            tone="amber"
          />
        )}

        {canFinance && (
          <MetricCard
            label="Receitas no mês"
            value={money.format(monthRevenue)}
            helper={`Resultado: ${money.format(monthRevenue - monthExpenses)}`}
            icon={CircleDollarSign}
            tone="green"
          />
        )}
      </div>

      <div className="dashboard-grid">
        {canOrders && (
          <section className="panel span-2">
            <div className="panel-head">
              <div>
                <span className="eyebrow">Operação</span>
                <h2>Ordens que exigem atenção</h2>
              </div>
              <Link to="/ordens" className="ghost-button">Ver todas</Link>
            </div>

            {attention.length === 0 ? (
              <div className="empty-state">
                <CheckCircle2 size={38} />
                <h3>Nenhuma OS pendente</h3>
                <p>A operação está sem ordens abertas neste momento.</p>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>OS</th>
                      <th>Cliente / equipamento</th>
                      <th>Técnico</th>
                      <th>Status</th>
                      <th>Última atualização</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attention.map((order) => (
                      <tr key={order.id}>
                        <td>
                          <Link to={`/ordens/${order.id}`}>
                            <strong>{orderCode(order.order_number)}</strong>
                          </Link>
                        </td>
                        <td>
                          <strong>{order.client_name ?? 'Cliente não identificado'}</strong>
                          <small>{order.equipment ?? 'Equipamento não identificado'}</small>
                        </td>
                        <td>{order.technician ?? 'Não atribuído'}</td>
                        <td><StatusBadge status={order.status} /></td>
                        <td>
                          <span className="muted">
                            <Clock3 size={14} />
                            {dateTime.format(new Date(order.updated_at))}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        <aside className="panel">
          <div className="panel-head">
            <div>
              <span className="eyebrow">Alertas</span>
              <h2>Precisa de ação</h2>
            </div>
          </div>

          <div className="alerts">
            {canStock && (
              <div className={`alert ${criticalStock.length ? 'danger' : 'info'}`}>
                <AlertTriangle />
                <div>
                  <strong>{criticalStock.length} item(ns) com estoque crítico</strong>
                  <p>Disponível igual ou abaixo do estoque mínimo.</p>
                </div>
              </div>
            )}

            {canCommercial && (
              <div className={`alert ${staleFollowups.length ? 'warning' : 'info'}`}>
                <BriefcaseBusiness />
                <div>
                  <strong>{staleFollowups.length} follow-up(s) sem atualização</strong>
                  <p>Orçamentos aguardando cliente há pelo menos 48 horas.</p>
                </div>
              </div>
            )}

            {canFiscal && (
              <div className={`alert ${fiscalReady.length ? 'warning' : 'info'}`}>
                <FileCheck2 />
                <div>
                  <strong>{fiscalReady.length} OS para revisão fiscal</strong>
                  <p>Serviços concluídos com valor registrado.</p>
                </div>
              </div>
            )}

            {!canStock && !canCommercial && !canFiscal && (
              <div className="alert info">
                <CheckCircle2 />
                <div>
                  <strong>Sem alertas adicionais para este perfil</strong>
                  <p>O painel mostra somente áreas autorizadas.</p>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>

      <div className="dashboard-grid three">
        {canCommercial && (
          <section className="panel">
            <div className="panel-head"><h2>Comercial</h2></div>
            <div className="mini-kpis">
              <div>
                <span>{money.format(negotiationValue)}</span>
                <small>Em negociação</small>
              </div>
              <div>
                <span>{waitingCustomer.length}</span>
                <small>Aguardando cliente</small>
              </div>
              <div>
                <span>{staleFollowups.length}</span>
                <small>Follow-ups 48h+</small>
              </div>
            </div>
          </section>
        )}

        {canStock && (
          <section className="panel">
            <div className="panel-head"><h2>Estoque</h2></div>
            <div className="mini-kpis">
              <div>
                <span>{stock.reduce((sum, item) => sum + Number(item.physical), 0)}</span>
                <small>Quantidade física</small>
              </div>
              <div>
                <span>{stock.reduce((sum, item) => sum + Number(item.reserved), 0)}</span>
                <small>Reservado</small>
              </div>
              <div>
                <span>{criticalStock.length}</span>
                <small>Itens críticos</small>
              </div>
            </div>
          </section>
        )}

        {canFinance && (
          <section className="panel">
            <div className="panel-head"><h2>Financeiro</h2></div>
            <div className="mini-kpis">
              <div>
                <span>{money.format(receivables)}</span>
                <small>A receber</small>
              </div>
              <div>
                <span>{money.format(payables)}</span>
                <small>A pagar</small>
              </div>
              <div>
                <span>{money.format(receivables - payables)}</span>
                <small>Saldo projetado</small>
              </div>
            </div>
          </section>
        )}
      </div>

      {canFinance && (
        <section className="panel" style={{ marginTop: 20 }}>
          <div className="panel-head">
            <div>
              <span className="eyebrow">Resultado</span>
              <h2>Resumo do mês</h2>
            </div>
            <Link to="/financeiro/dre" className="ghost-button">Abrir DRE</Link>
          </div>
          <div className="mini-kpis">
            <div>
              <span>{money.format(monthRevenue)}</span>
              <small>Receitas realizadas</small>
            </div>
            <div>
              <span>{money.format(monthExpenses)}</span>
              <small>Despesas realizadas</small>
            </div>
            <div>
              <span>{money.format(monthRevenue - monthExpenses)}</span>
              <small>Resultado realizado</small>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
