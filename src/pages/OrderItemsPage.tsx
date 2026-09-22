import {
  AlertTriangle,
  ArrowLeft,
  Boxes,
  CheckCircle2,
  PackagePlus,
  PlusCircle,
  Trash2,
  Wrench,
} from 'lucide-react';
import { type FormEvent, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { PageHeader } from '../components/ui/PageHeader';
import { StatusBadge } from '../components/ui/StatusBadge';
import { useAuth } from '../contexts/AuthContext';
import { usePrimeTech } from '../contexts/PrimeTechContext';
import { money, orderCode } from '../lib/formatters';
import { can } from '../lib/permissions';
import { supabase } from '../lib/supabase';

const lockedStatuses = [
  'approved',
  'in_repair',
  'waiting_part',
  'quality_check',
  'ready_for_pickup',
  'delivered',
  'cancelled',
];

export function OrderItemsPage() {
  const { id } = useParams();
  const { user, mode } = useAuth();
  const { orders, stock, loading, refresh } = usePrimeTech();

  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState('');
  const [form, setForm] = useState({
    kind: 'service' as 'service' | 'part',
    stockItemId: '',
    description: '',
    quantity: '1',
    unitPrice: '',
  });

  const order = orders.find((item) => item.id === id);
  const items = order?.items ?? [];

  const canEdit = Boolean(
    order
    && !lockedStatuses.includes(order.status)
    && (can(user, 'orders.commercial') || can(user, 'orders.tech')),
  );

  const totals = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        const total = Number(item.quantity) * Number(item.unit_price);
        if (item.kind === 'service') acc.services += total;
        else acc.parts += total;
        return acc;
      },
      { services: 0, parts: 0 },
    );
  }, [items]);

  const selectedStock = stock.find((item) => item.id === form.stockItemId);

  function changeKind(kind: 'service' | 'part') {
    setLocalError('');
    setForm({
      kind,
      stockItemId: '',
      description: '',
      quantity: '1',
      unitPrice: '',
    });
  }

  function changeStockItem(stockItemId: string) {
    const item = stock.find((candidate) => candidate.id === stockItemId);
    setForm((current) => ({
      ...current,
      stockItemId,
      description: item?.name ?? '',
      unitPrice: item ? String(Number(item.sale_price ?? 0)) : '',
    }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!order || !canEdit) return;

    const quantity = Number(form.quantity.replace(',', '.'));
    const unitPrice = Number(form.unitPrice.replace(',', '.'));

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setLocalError('Informe uma quantidade maior que zero.');
      return;
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      setLocalError('Informe um valor unitário válido.');
      return;
    }
    if (!form.description.trim()) {
      setLocalError('Informe a descrição do item.');
      return;
    }
    if (form.kind === 'part' && !form.stockItemId) {
      setLocalError('Selecione o produto/peça do estoque para permitir a baixa automática.');
      return;
    }
    if (mode !== 'supabase' || !supabase) {
      setLocalError('A composição da OS exige o ambiente conectado ao Supabase.');
      return;
    }

    setSaving(true);
    setLocalError('');

    try {
      const stockItem = form.kind === 'part'
        ? stock.find((item) => item.id === form.stockItemId)
        : undefined;

      const { error } = await supabase
        .from('service_order_items')
        .insert({
          service_order_id: order.id,
          kind: form.kind,
          description: form.description.trim(),
          quantity,
          unit_price: unitPrice,
          cost_price: stockItem ? Number(stockItem.cost_price ?? 0) : null,
          stock_item_id: stockItem?.id ?? null,
        });

      if (error) throw error;

      await refresh();
      setForm({
        kind: form.kind,
        stockItemId: '',
        description: '',
        quantity: '1',
        unitPrice: '',
      });
    } catch (cause) {
      setLocalError(cause instanceof Error ? cause.message : 'Não foi possível adicionar o item à OS.');
    } finally {
      setSaving(false);
    }
  }

  async function removeItem(itemId: string) {
    if (!order || !canEdit || mode !== 'supabase' || !supabase) return;

    setSaving(true);
    setLocalError('');
    try {
      const { error } = await supabase
        .from('service_order_items')
        .delete()
        .eq('id', itemId)
        .eq('service_order_id', order.id);

      if (error) throw error;
      await refresh();
    } catch (cause) {
      setLocalError(cause instanceof Error ? cause.message : 'Não foi possível remover o item da OS.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="empty-state"><Wrench size={38} /><h3>Carregando OS</h3></div>;
  }

  if (!order) {
    return (
      <section className="panel empty-state">
        <AlertTriangle size={38} />
        <h3>Ordem de Serviço não encontrada</h3>
        <Link to="/ordens" className="ghost-button"><ArrowLeft size={16} /> Voltar</Link>
      </section>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Orçamento da OS"
        title={`${orderCode(order.order_number)} · Serviços e produtos`}
        description="Monte a mesma OS com mão de obra e produtos do estoque. Produtos vinculados ao estoque entram no controle automático de reserva e baixa."
        actions={(
          <div className="quick-actions">
            <Link to={`/ordens/${order.id}`} className="ghost-button"><ArrowLeft size={16} /> Ver OS</Link>
            <StatusBadge status={order.status} />
          </div>
        )}
      />

      {localError && (
        <section className="notice" style={{ marginBottom: 16 }}>
          <AlertTriangle size={20} />
          <div><strong>Não foi possível concluir</strong><p>{localError}</p></div>
        </section>
      )}

      <section className="notice" style={{ marginBottom: 20 }}>
        <Boxes size={20} />
        <div>
          <strong>Estoque automático por OS</strong>
          <p>
            Ao aprovar a OS, os produtos do estoque são reservados. Quando a OS é concluída e fica pronta para retirada,
            o saldo físico é baixado automaticamente e a movimentação fica registrada com data e número da OS.
          </p>
        </div>
      </section>

      {canEdit && (
        <section className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-head">
            <div><span className="eyebrow">Composição</span><h2>Adicionar item</h2></div>
          </div>

          <form onSubmit={(event) => void submit(event)} style={{ display: 'grid', gap: 14 }}>
            <div className="form-grid">
              <label>
                <span>Tipo</span>
                <select value={form.kind} onChange={(event) => changeKind(event.target.value as 'service' | 'part')}>
                  <option value="service">Serviço / mão de obra</option>
                  <option value="part">Produto / peça do estoque</option>
                </select>
              </label>

              {form.kind === 'part' && (
                <label>
                  <span>Produto do estoque</span>
                  <select value={form.stockItemId} onChange={(event) => changeStockItem(event.target.value)}>
                    <option value="">Selecione...</option>
                    {stock.filter((item) => item.active !== false).map((item) => {
                      const available = Number(item.physical ?? 0) - Number(item.reserved ?? 0);
                      return (
                        <option key={item.id} value={item.id}>
                          {item.name} · {item.sku} · disponível {available}
                        </option>
                      );
                    })}
                  </select>
                </label>
              )}

              <label>
                <span>Descrição</span>
                <input
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  placeholder={form.kind === 'service' ? 'Ex.: Limpeza de cabeçote' : 'Produto selecionado do estoque'}
                />
              </label>

              <label>
                <span>Quantidade</span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.quantity}
                  onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))}
                />
              </label>

              <label>
                <span>Valor unitário</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.unitPrice}
                  onChange={(event) => setForm((current) => ({ ...current, unitPrice: event.target.value }))}
                />
              </label>

              {form.kind === 'part' && selectedStock && (
                <div className="notice" style={{ marginBottom: 0 }}>
                  <PackagePlus size={18} />
                  <div>
                    <strong>{selectedStock.name}</strong>
                    <p>
                      Físico {selectedStock.physical} · reservado {selectedStock.reserved} · disponível {Math.max(selectedStock.physical - selectedStock.reserved, 0)}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="quick-actions">
              <button type="submit" disabled={saving}>
                <PlusCircle size={16} /> {saving ? 'Adicionando...' : 'Adicionar à OS'}
              </button>
            </div>
          </form>
        </section>
      )}

      {!canEdit && (
        <section className="notice" style={{ marginBottom: 20 }}>
          <CheckCircle2 size={20} />
          <div>
            <strong>Composição bloqueada</strong>
            <p>Após a aprovação, os itens ficam protegidos para garantir a rastreabilidade do orçamento, estoque e financeiro.</p>
          </div>
        </section>
      )}

      <section className="panel">
        <div className="panel-head">
          <div><span className="eyebrow">Itens da OS</span><h2>Orçamento completo</h2></div>
          <strong>{money.format(totals.services + totals.parts)}</strong>
        </div>

        {items.length === 0 ? (
          <div className="empty-state">
            <PackagePlus size={38} />
            <h3>Nenhum item informado</h3>
            <p>Adicione o serviço e os produtos que fazem parte desta OS.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Descrição</th>
                  <th>Qtd.</th>
                  <th>Unitário</th>
                  <th>Total</th>
                  <th>Estoque</th>
                  {canEdit && <th>Ação</th>}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const stockItem = item.stock_item_id
                    ? stock.find((candidate) => candidate.id === item.stock_item_id)
                    : undefined;
                  const available = stockItem
                    ? Number(stockItem.physical ?? 0) - Number(stockItem.reserved ?? 0)
                    : null;

                  return (
                    <tr key={item.id}>
                      <td>{item.kind === 'service' ? 'Serviço' : 'Produto'}</td>
                      <td>
                        <strong>{item.description}</strong>
                        {stockItem && <small>{stockItem.sku}</small>}
                      </td>
                      <td>{Number(item.quantity)}</td>
                      <td>{money.format(Number(item.unit_price))}</td>
                      <td><strong>{money.format(Number(item.quantity) * Number(item.unit_price))}</strong></td>
                      <td>
                        {stockItem ? (
                          <span className={`stock-state ${Number(available) >= Number(item.quantity) ? 'ok' : 'critical'}`}>
                            {Number(available) >= Number(item.quantity) ? `Disponível ${available}` : `Insuficiente · ${available}`}
                          </span>
                        ) : '—'}
                      </td>
                      {canEdit && (
                        <td>
                          <button
                            type="button"
                            className="ghost-button"
                            disabled={saving}
                            onClick={() => void removeItem(item.id)}
                          >
                            <Trash2 size={15} /> Remover
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="mini-kpis" style={{ marginTop: 18 }}>
          <div><span>{money.format(totals.services)}</span><small>Serviços</small></div>
          <div><span>{money.format(totals.parts)}</span><small>Produtos / peças</small></div>
          <div><span>{money.format(totals.services + totals.parts)}</span><small>Total da OS</small></div>
        </div>
      </section>
    </>
  );
}