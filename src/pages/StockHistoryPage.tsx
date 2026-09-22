import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowLeft,
  ArrowUpCircle,
  Boxes,
  CalendarDays,
  RefreshCw,
  Search,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { PageHeader } from '../components/ui/PageHeader';
import { useAuth } from '../contexts/AuthContext';
import { usePrimeTech } from '../contexts/PrimeTechContext';
import { dateTime, money, orderCode } from '../lib/formatters';
import { supabase } from '../lib/supabase';

type Movement = {
  id: string;
  stock_item_id: string;
  service_order_id?: string | null;
  movement_type: string;
  quantity: number;
  unit_cost?: number | null;
  notes?: string | null;
  created_at: string;
  balance_after?: number | null;
  reserved_after?: number | null;
  source?: string | null;
};

const movementLabels: Record<string, string> = {
  in: 'Entrada',
  out: 'Saída',
  adjustment: 'Ajuste',
  reserve: 'Reserva',
  release: 'Liberação',
  consume: 'Consumo / baixa',
};

function inputDate(date: Date) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10);
}

export function StockHistoryPage() {
  const { mode } = useAuth();
  const { companyId, stock, orders } = usePrimeTech();

  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [type, setType] = useState('all');
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(1);
    return inputDate(date);
  });
  const [endDate, setEndDate] = useState(() => inputDate(new Date()));

  useEffect(() => {
    const client = supabase;

    if (mode !== 'supabase' || !client || !companyId) {
      setMovements([]);
      setLoading(false);
      return;
    }

    const activeClient = client;
    let alive = true;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const { data, error: loadError } = await activeClient
          .from('stock_movements')
          .select('id, stock_item_id, service_order_id, movement_type, quantity, unit_cost, notes, created_at, balance_after, reserved_after, source')
          .eq('company_id', companyId)
          .order('created_at', { ascending: false })
          .limit(1000);

        if (loadError) throw loadError;
        if (alive) setMovements((data ?? []) as Movement[]);
      } catch (cause) {
        if (alive) {
          setError(cause instanceof Error ? cause.message : 'Não foi possível carregar o histórico do estoque.');
        }
      } finally {
        if (alive) setLoading(false);
      }
    }

    void load();
    return () => {
      alive = false;
    };
  }, [companyId, mode]);

  const visible = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    const start = startDate ? new Date(`${startDate}T00:00:00`).getTime() : Number.NEGATIVE_INFINITY;
    const end = endDate ? new Date(`${endDate}T23:59:59.999`).getTime() : Number.POSITIVE_INFINITY;

    return movements.filter((movement) => {
      const created = new Date(movement.created_at).getTime();
      if (created < start || created > end) return false;

      if (type !== 'all') {
        if (type === 'outputs') {
          if (!['out', 'consume'].includes(movement.movement_type)) return false;
        } else if (type !== movement.movement_type) {
          return false;
        }
      }

      if (!normalized) return true;

      const item = stock.find((candidate) => candidate.id === movement.stock_item_id);
      const order = orders.find((candidate) => candidate.id === movement.service_order_id);
      const haystack = [
        item?.name,
        item?.sku,
        order ? orderCode(order.order_number) : '',
        movement.notes,
        movementLabels[movement.movement_type],
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalized);
    });
  }, [endDate, movements, orders, search, startDate, stock, type]);

  const entries = visible
    .filter((movement) => movement.movement_type === 'in')
    .reduce((sum, movement) => sum + Number(movement.quantity), 0);
  const outputs = visible
    .filter((movement) => ['out', 'consume'].includes(movement.movement_type))
    .reduce((sum, movement) => sum + Number(movement.quantity), 0);
  const outputValue = visible
    .filter((movement) => ['out', 'consume'].includes(movement.movement_type))
    .reduce((sum, movement) => sum + Number(movement.quantity) * Number(movement.unit_cost ?? 0), 0);

  return (
    <>
      <PageHeader
        eyebrow="Estoque"
        title="Histórico de movimentações"
        description="Entradas, saídas, reservas, liberações e consumos vinculados às Ordens de Serviço, organizados por data."
        actions={<Link to="/estoque" className="ghost-button"><ArrowLeft size={16} /> Voltar ao estoque</Link>}
      />

      {error && (
        <section className="notice" style={{ marginBottom: 16 }}>
          <AlertTriangle size={20} />
          <div><strong>Histórico indisponível</strong><p>{error}</p></div>
        </section>
      )}

      <div className="metrics-grid">
        <article className="metric-card green">
          <div className="metric-icon"><ArrowDownCircle /></div>
          <span>Entradas no filtro</span><strong>{entries}</strong><small>Unidades registradas</small>
        </article>
        <article className="metric-card red">
          <div className="metric-icon"><ArrowUpCircle /></div>
          <span>Saídas / consumo</span><strong>{outputs}</strong><small>Unidades baixadas</small>
        </article>
        <article className="metric-card violet">
          <div className="metric-icon"><Boxes /></div>
          <span>Custo das saídas</span><strong>{money.format(outputValue)}</strong><small>Com base no custo registrado</small>
        </article>
        <article className="metric-card">
          <div className="metric-icon"><CalendarDays /></div>
          <span>Movimentações</span><strong>{visible.length}</strong><small>No período selecionado</small>
        </article>
      </div>

      <section className="panel">
        <div className="panel-head">
          <div><span className="eyebrow">Auditoria</span><h2>Movimentações</h2></div>
        </div>

        <div className="form-grid" style={{ marginBottom: 16 }}>
          <label>
            <span>De</span>
            <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </label>
          <label>
            <span>Até</span>
            <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </label>
          <label>
            <span>Movimento</span>
            <select value={type} onChange={(event) => setType(event.target.value)}>
              <option value="all">Todos</option>
              <option value="in">Somente entradas</option>
              <option value="outputs">Somente saídas</option>
              <option value="consume">Consumo de OS</option>
              <option value="reserve">Reservas</option>
              <option value="release">Liberações</option>
              <option value="adjustment">Ajustes legados</option>
            </select>
          </label>
          <label>
            <span>Buscar</span>
            <div className="filter-search">
              <Search size={16} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Item, SKU, OS ou observação..." />
            </div>
          </label>
        </div>

        {loading ? (
          <div className="empty-state"><RefreshCw size={38} /><h3>Carregando movimentações</h3></div>
        ) : visible.length === 0 ? (
          <div className="empty-state"><Boxes size={38} /><h3>Nenhuma movimentação encontrada</h3><p>Ajuste os filtros ou registre uma entrada/saída.</p></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Item</th>
                  <th>Movimento</th>
                  <th>Quantidade</th>
                  <th>OS</th>
                  <th>Saldo após</th>
                  <th>Observação</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((movement) => {
                  const item = stock.find((candidate) => candidate.id === movement.stock_item_id);
                  const order = orders.find((candidate) => candidate.id === movement.service_order_id);
                  const isOutput = ['out', 'consume'].includes(movement.movement_type);
                  const isInput = movement.movement_type === 'in';

                  return (
                    <tr key={movement.id}>
                      <td>{dateTime.format(new Date(movement.created_at))}</td>
                      <td><strong>{item?.name ?? 'Item não localizado'}</strong><small>{item?.sku ?? movement.stock_item_id}</small></td>
                      <td>
                        <span className={`stock-state ${isOutput ? 'critical' : isInput ? 'ok' : ''}`}>
                          {movementLabels[movement.movement_type] ?? movement.movement_type}
                        </span>
                      </td>
                      <td><strong>{Number(movement.quantity)}</strong></td>
                      <td>
                        {order ? (
                          <Link to={`/ordens/${order.id}`} className="back-link">{orderCode(order.order_number)}</Link>
                        ) : '—'}
                      </td>
                      <td>{movement.balance_after == null ? '—' : Number(movement.balance_after)}</td>
                      <td>{movement.notes || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}