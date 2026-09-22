import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
  CheckCircle2,
  ClipboardCheck,
  PackageCheck,
  PackageMinus,
  PackagePlus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { type FormEvent, useMemo, useState } from 'react';

import { MetricCard } from '../components/ui/MetricCard';
import { PageHeader } from '../components/ui/PageHeader';
import { useAuth } from '../contexts/AuthContext';
import { usePrimeTech } from '../contexts/PrimeTechContext';
import { money, orderCode } from '../lib/formatters';
import { can } from '../lib/permissions';
import { supabase } from '../lib/supabase';
import type { StockItem } from '../types/domain';

type MovementType = 'reserve' | 'release' | 'consume' | 'adjust';

const movementLabels: Record<MovementType, string> = {
  reserve: 'Reservar para OS',
  release: 'Liberar reserva',
  consume: 'Consumir na OS',
  adjust: 'Ajustar saldo',
};

export function StockPage() {
  const { user, mode } = useAuth();
  const {
    stock,
    orders,
    loading,
    error,
    addStockItem,
    refresh,
  } = usePrimeTech();

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState<StockItem | null>(null);
  const [movementType, setMovementType] = useState<MovementType>('reserve');
  const [movementForm, setMovementForm] = useState({
    quantity: '1',
    orderId: '',
    notes: '',
  });
  const [form, setForm] = useState({
    sku: '',
    name: '',
    physical: '0',
    minimum: '0',
    cost: '0',
    sale: '0',
  });

  const totals = useMemo(() => stock.reduce((acc, item) => {
    const physical = Number(item.physical ?? item.quantity ?? 0);
    const reserved = Number(item.reserved ?? item.reserved_quantity ?? 0);
    const minimum = Number(item.minimum ?? item.minimum_quantity ?? 0);
    acc.physical += physical;
    acc.reserved += reserved;
    acc.available += Math.max(physical - reserved, 0);
    acc.value += physical * Number(item.cost_price ?? 0);
    if (physical - reserved <= minimum) acc.critical += 1;
    return acc;
  }, { physical: 0, reserved: 0, available: 0, critical: 0, value: 0 }), [stock]);

  const visibleStock = useMemo(() => {
    const value = search.trim().toLowerCase();
    if (!value) return stock;
    return stock.filter((item) =>
      item.name.toLowerCase().includes(value)
      || item.sku.toLowerCase().includes(value));
  }, [search, stock]);

  const activeOrders = useMemo(
    () => orders.filter((order) => !['delivered', 'cancelled'].includes(order.status)),
    [orders],
  );

  const canReserve = can(user, 'stock.reserve');
  const canConsume = can(user, 'stock.consume');
  const canAdjust = can(user, 'stock.adjust');
  const canMove = canReserve || canConsume || canAdjust;

  function resetForm() {
    setForm({ sku: '', name: '', physical: '0', minimum: '0', cost: '0', sale: '0' });
    setLocalError('');
  }

  function openMovement(item: StockItem, type: MovementType) {
    setSelectedItem(item);
    setMovementType(type);
    setMovementForm({ quantity: type === 'adjust' ? '1' : '1', orderId: '', notes: '' });
    setLocalError('');
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const physical = Number(form.physical.replace(',', '.'));
    const minimum = Number(form.minimum.replace(',', '.'));
    const cost = Number(form.cost.replace(',', '.'));
    const sale = Number(form.sale.replace(',', '.'));

    if (!form.sku.trim() || !form.name.trim()) {
      setLocalError('Informe SKU e nome do item.');
      return;
    }
    if (![physical, minimum, cost, sale].every(Number.isFinite)
      || physical < 0 || minimum < 0 || cost < 0 || sale < 0) {
      setLocalError('Quantidades e valores devem ser números válidos e não negativos.');
      return;
    }

    setSaving(true);
    setLocalError('');
    try {
      await addStockItem({
        sku: form.sku.trim(),
        name: form.name.trim(),
        quantity: physical,
        reserved_quantity: 0,
        minimum_quantity: minimum,
        physical,
        reserved: 0,
        minimum,
        cost_price: cost,
        sale_price: sale,
        active: true,
      });
      resetForm();
      setShowForm(false);
    } catch (cause) {
      setLocalError(cause instanceof Error ? cause.message : 'Não foi possível cadastrar o item.');
    } finally {
      setSaving(false);
    }
  }

  async function submitMovement(event: FormEvent) {
    event.preventDefault();
    if (!selectedItem) return;

    const quantity = Number(movementForm.quantity.replace(',', '.'));
    if (!Number.isFinite(quantity) || quantity === 0) {
      setLocalError('Informe uma quantidade válida e diferente de zero.');
      return;
    }
    if (movementType !== 'adjust' && quantity < 0) {
      setLocalError('A quantidade deve ser maior que zero para esta movimentação.');
      return;
    }
    if (movementType === 'reserve' && !canReserve) {
      setLocalError('Seu perfil não pode reservar estoque.');
      return;
    }
    if ((movementType === 'consume' || movementType === 'release') && !canConsume && !canReserve) {
      setLocalError('Seu perfil não pode consumir ou liberar reservas.');
      return;
    }
    if (movementType === 'adjust' && !canAdjust) {
      setLocalError('Seu perfil não pode ajustar estoque.');
      return;
    }
    if (mode !== 'supabase' || !supabase) {
      setLocalError('Movimentações transacionais exigem o ambiente conectado ao Supabase.');
      return;
    }

    setSaving(true);
    setLocalError('');

    const common = {
      p_stock_item_id: selectedItem.id,
      p_quantity: Math.abs(quantity),
      p_service_order_id: movementForm.orderId || null,
      p_notes: movementForm.notes.trim() || null,
      p_idempotency_key: crypto.randomUUID(),
    };

    try {
      if (movementType === 'reserve') {
        const { error: rpcError } = await supabase.rpc('reserve_stock', common);
        if (rpcError) throw rpcError;
      } else if (movementType === 'release') {
        const { error: rpcError } = await supabase.rpc('release_stock_reservation', common);
        if (rpcError) throw rpcError;
      } else if (movementType === 'consume') {
        const { error: rpcError } = await supabase.rpc('consume_stock', common);
        if (rpcError) throw rpcError;
      } else {
        const { error: rpcError } = await supabase.rpc('adjust_stock', {
          p_stock_item_id: selectedItem.id,
          p_delta: quantity,
          p_notes: movementForm.notes.trim() || null,
          p_idempotency_key: crypto.randomUUID(),
        });
        if (rpcError) throw rpcError;
      }

      await refresh();
      setSelectedItem(null);
    } catch (cause) {
      setLocalError(
        cause instanceof Error
          ? cause.message
          : 'Não foi possível registrar a movimentação de estoque.',
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="empty-state">
        <RefreshCw size={38} />
        <h3>Carregando estoque</h3>
        <p>Conferindo peças e materiais.</p>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Estoque"
        title="Peças e materiais"
        description="Controle por movimentações: saldo físico, reservado, disponível, consumo por OS e ajustes auditáveis."
        actions={(
          <button
            className="primary-button"
            type="button"
            onClick={() => setShowForm((value) => !value)}
          >
            {showForm ? <X /> : <PackagePlus />}
            {showForm ? 'Fechar' : 'Novo item'}
          </button>
        )}
      />

      {(error || localError) && (
        <section className="notice" style={{ marginBottom: 16 }}>
          <AlertTriangle size={20} />
          <div>
            <strong>Não foi possível concluir a operação</strong>
            <p>{localError || error}</p>
          </div>
        </section>
      )}

      {showForm && (
        <section className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-head">
            <div><span className="eyebrow">Cadastro</span><h2>Novo item de estoque</h2></div>
          </div>
          <form onSubmit={(event) => void submit(event)} style={{ display: 'grid', gap: 12 }}>
            <div className="form-grid">
              <label><span>SKU</span><input value={form.sku} onChange={(e) => setForm((v) => ({ ...v, sku: e.target.value }))} placeholder="Ex.: CAP-100UF" /></label>
              <label><span>Descrição</span><input value={form.name} onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))} placeholder="Nome da peça ou material" /></label>
              <label><span>Quantidade inicial</span><input type="number" min="0" step="0.01" value={form.physical} onChange={(e) => setForm((v) => ({ ...v, physical: e.target.value }))} /></label>
              <label><span>Estoque mínimo</span><input type="number" min="0" step="0.01" value={form.minimum} onChange={(e) => setForm((v) => ({ ...v, minimum: e.target.value }))} /></label>
              <label><span>Custo unitário</span><input type="number" min="0" step="0.01" value={form.cost} onChange={(e) => setForm((v) => ({ ...v, cost: e.target.value }))} /></label>
              <label><span>Preço de venda</span><input type="number" min="0" step="0.01" value={form.sale} onChange={(e) => setForm((v) => ({ ...v, sale: e.target.value }))} /></label>
            </div>
            <div className="quick-actions">
              <button type="submit" disabled={saving}>
                <PackagePlus size={16} /> {saving ? 'Salvando...' : 'Cadastrar item'}
              </button>
              <button
                type="button"
                className="ghost-button"
                disabled={saving}
                onClick={() => { resetForm(); setShowForm(false); }}
              >
                Cancelar
              </button>
            </div>
          </form>
        </section>
      )}

      {selectedItem && (
        <section className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-head">
            <div>
              <span className="eyebrow">Movimentação</span>
              <h2>{selectedItem.name}</h2>
              <p className="muted">
                Físico {selectedItem.physical} · Reservado {selectedItem.reserved} · Disponível {Math.max(selectedItem.physical - selectedItem.reserved, 0)}
              </p>
            </div>
            <button type="button" className="ghost-button" onClick={() => setSelectedItem(null)}>
              <X size={16} /> Fechar
            </button>
          </div>

          <form onSubmit={(event) => void submitMovement(event)} style={{ display: 'grid', gap: 12 }}>
            <div className="form-grid">
              <label>
                <span>Tipo de movimentação</span>
                <select value={movementType} onChange={(event) => setMovementType(event.target.value as MovementType)}>
                  {canReserve && <option value="reserve">Reservar para OS</option>}
                  {(canReserve || canConsume) && <option value="release">Liberar reserva</option>}
                  {canConsume && <option value="consume">Consumir na OS</option>}
                  {canAdjust && <option value="adjust">Ajustar saldo</option>}
                </select>
              </label>

              <label>
                <span>{movementType === 'adjust' ? 'Ajuste (+ entrada / - saída)' : 'Quantidade'}</span>
                <input
                  type="number"
                  step="0.01"
                  min={movementType === 'adjust' ? undefined : '0.01'}
                  value={movementForm.quantity}
                  onChange={(event) => setMovementForm((value) => ({ ...value, quantity: event.target.value }))}
                />
              </label>

              {movementType !== 'adjust' && (
                <label>
                  <span>OS vinculada (opcional)</span>
                  <select value={movementForm.orderId} onChange={(event) => setMovementForm((value) => ({ ...value, orderId: event.target.value }))}>
                    <option value="">Sem OS</option>
                    {activeOrders.map((order) => (
                      <option key={order.id} value={order.id}>
                        {orderCode(order.order_number)} · {order.client_name ?? 'Cliente'}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label style={{ gridColumn: movementType === 'adjust' ? '1 / -1' : undefined }}>
                <span>Observação</span>
                <input
                  value={movementForm.notes}
                  onChange={(event) => setMovementForm((value) => ({ ...value, notes: event.target.value }))}
                  placeholder="Motivo, fornecedor, consumo técnico..."
                />
              </label>
            </div>

            <div className="quick-actions">
              <button type="submit" disabled={saving}>
                <ClipboardCheck size={16} />
                {saving ? 'Registrando...' : movementLabels[movementType]}
              </button>
              <button type="button" className="ghost-button" disabled={saving} onClick={() => setSelectedItem(null)}>
                Cancelar
              </button>
            </div>
          </form>
        </section>
      )}

      <div className="metrics-grid">
        <MetricCard label="Itens cadastrados" value={stock.length} icon={Boxes} />
        <MetricCard label="Unidades reservadas" value={totals.reserved} icon={PackageCheck} tone="violet" />
        <MetricCard label="Estoque crítico" value={totals.critical} icon={AlertTriangle} tone="amber" />
        <MetricCard label="Valor em estoque" value={money.format(totals.value)} icon={CheckCircle2} tone="green" />
      </div>

      <section className="panel">
        <div className="panel-head">
          <div>
            <span className="eyebrow">Posição</span>
            <h2>Saldo por item</h2>
          </div>
          <div className="filter-search">
            <Search size={16} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar SKU ou item..." />
          </div>
        </div>

        {visibleStock.length === 0 ? (
          <div className="empty-state">
            <Boxes size={38} />
            <h3>{stock.length ? 'Nenhum item encontrado' : 'Estoque vazio'}</h3>
            <p>{stock.length ? 'Ajuste o termo de busca.' : 'Cadastre o primeiro item para iniciar o controle.'}</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>SKU / item</th>
                  <th>Físico</th>
                  <th>Reservado</th>
                  <th>Disponível</th>
                  <th>Mínimo</th>
                  <th>Custo</th>
                  <th>Venda</th>
                  <th>Situação</th>
                  {canMove && <th>Ações</th>}
                </tr>
              </thead>
              <tbody>
                {visibleStock.map((item) => {
                  const physical = Number(item.physical ?? item.quantity ?? 0);
                  const reserved = Number(item.reserved ?? item.reserved_quantity ?? 0);
                  const minimum = Number(item.minimum ?? item.minimum_quantity ?? 0);
                  const available = physical - reserved;
                  const critical = available <= minimum;

                  return (
                    <tr key={item.id}>
                      <td><strong>{item.name}</strong><small>{item.sku}</small></td>
                      <td>{physical}</td>
                      <td>{reserved}</td>
                      <td><strong>{available}</strong></td>
                      <td>{minimum}</td>
                      <td>{money.format(Number(item.cost_price ?? 0))}</td>
                      <td>{money.format(Number(item.sale_price ?? 0))}</td>
                      <td>
                        <span className={`stock-state ${critical ? 'critical' : 'ok'}`}>
                          {critical ? 'Repor estoque' : 'Normal'}
                        </span>
                      </td>
                      {canMove && (
                        <td>
                          <div className="quick-actions">
                            {canReserve && available > 0 && (
                              <button type="button" title="Reservar" onClick={() => openMovement(item, 'reserve')}>
                                <ArrowDownToLine size={15} />
                              </button>
                            )}
                            {canConsume && physical > 0 && (
                              <button type="button" title="Consumir" onClick={() => openMovement(item, 'consume')}>
                                <PackageMinus size={15} />
                              </button>
                            )}
                            {(canReserve || canConsume) && reserved > 0 && (
                              <button type="button" title="Liberar reserva" onClick={() => openMovement(item, 'release')}>
                                <ArrowUpFromLine size={15} />
                              </button>
                            )}
                            {canAdjust && (
                              <button type="button" title="Ajustar saldo" onClick={() => openMovement(item, 'adjust')}>
                                <SlidersHorizontal size={15} />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
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
