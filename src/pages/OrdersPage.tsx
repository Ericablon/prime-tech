import {
  Plus,
  Printer,
  Search,
  Wrench,
} from 'lucide-react';

import {
  useMemo,
  useState,
} from 'react';

import { Link } from 'react-router-dom';

import { PageHeader } from '../components/ui/PageHeader';
import { StatusBadge } from '../components/ui/StatusBadge';

import { useAuth } from '../contexts/AuthContext';
import { usePrimeTech } from '../contexts/PrimeTechContext';

import {
  dateTime,
  orderCode,
} from '../lib/formatters';

import { can } from '../lib/permissions';

import type {
  OrderStatus,
  Priority,
} from '../types/domain';

const statusOptions: Array<{
  value: '' | OrderStatus;
  label: string;
}> = [
  { value: '', label: 'Todos os status' },
  { value: 'waiting_technician', label: 'Aguardando técnico' },
  { value: 'diagnosis', label: 'Diagnóstico' },
  { value: 'ready_for_commercial', label: 'Pronto para comercial' },
  { value: 'waiting_customer', label: 'Aguardando cliente' },
  { value: 'approved', label: 'Aprovado' },
  { value: 'in_repair', label: 'Em manutenção' },
  { value: 'waiting_part', label: 'Aguardando peça' },
  { value: 'quality_check', label: 'Qualidade' },
  { value: 'ready_for_pickup', label: 'Pronto para entrega' },
  { value: 'delivered', label: 'Entregue' },
  { value: 'cancelled', label: 'Cancelado' },
];

const priorityLabels: Record<Priority, string> = {
  low: 'Baixa',
  normal: 'Normal',
  high: 'Alta',
  urgent: 'Urgente',
};

export function OrdersPage() {
  const { user } = useAuth();
  const { orders, loading, error } = usePrimeTech();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'' | OrderStatus>('');

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase();

    return orders.filter((order) => {
      if (status && order.status !== status) return false;
      if (!term) return true;

      const haystack = [
        order.order_number,
        order.client_name,
        order.equipment,
        order.technician,
        order.reported_issue,
        order.diagnosis,
        order.technical_update,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [orders, search, status]);

  return (
    <>
      <PageHeader
        eyebrow="Comercial"
        title="Ordens de Serviço"
        description="Acompanhe o ciclo completo desde a entrada até o diagnóstico, aprovação, manutenção, qualidade e entrega."
        actions={can(user, 'orders.create') ? (
          <Link className="primary-button" to="/ordens/nova">
            <Plus size={17} /> Nova OS
          </Link>
        ) : undefined}
      />

      {error && (
        <section className="notice" style={{ marginBottom: 16 }}>
          <div>
            <strong>Não foi possível carregar todas as Ordens de Serviço</strong>
            <p>{error}</p>
          </div>
        </section>
      )}

      <section className="panel">
        <div className="filters">
          <div className="filter-search">
            <Search size={16} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por OS, cliente, equipamento ou problema"
            />
          </div>

          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as '' | OrderStatus)}
            style={{
              minHeight: 40,
              borderRadius: 10,
              border: '1px solid var(--line)',
              background: 'var(--surface2)',
              color: 'var(--premium-text)',
              padding: '0 12px',
              outline: 'none',
            }}
          >
            {statusOptions.map((option) => (
              <option key={option.value || 'all'} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="empty-state">
            <Wrench size={38} />
            <h3>Carregando Ordens de Serviço</h3>
            <p>Buscando as Ordens de Serviço da empresa.</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="empty-state">
            <Wrench size={38} />
            <h3>Nenhuma Ordem de Serviço encontrada</h3>
            <p>Abra uma nova OS ou altere os filtros da busca.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>OS</th>
                  <th>Cliente</th>
                  <th>Equipamento</th>
                  <th>Técnico</th>
                  <th>Status</th>
                  <th>Prioridade</th>
                  <th>Atualização</th>
                  <th>Documentos</th>
                </tr>
              </thead>

              <tbody>
                {filteredOrders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <Link to={`/ordens/${order.id}`}>
                        <strong style={{ color: 'var(--blue2)' }}>
                          {orderCode(order.order_number)}
                        </strong>
                      </Link>
                      <small>{dateTime.format(new Date(order.created_at))}</small>
                    </td>

                    <td><strong>{order.client_name ?? 'Cliente não identificado'}</strong></td>
                    <td><strong>{order.equipment ?? 'Equipamento não identificado'}</strong></td>
                    <td>{order.technician ?? 'Não definido'}</td>
                    <td>
                      <StatusBadge status={order.status} />
                      {order.technical_status === 'paused' && order.pause_reason && <small>Manutenção pausada</small>}
                    </td>
                    <td><span className={`priority priority-${order.priority}`}>{priorityLabels[order.priority]}</span></td>
                    <td>
                      <strong>{order.technical_update ?? 'Sem atualização técnica'}</strong>
                      <small>Atualizado em {dateTime.format(new Date(order.updated_at))}</small>
                    </td>
                    <td>
                      <Link to={`/ordens/${order.id}/documentos`} className="ghost-button">
                        <Printer size={15} /> OS / Orçamento
                      </Link>
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
