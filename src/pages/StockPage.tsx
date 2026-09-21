import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  PackageCheck,
  PackagePlus,
  RefreshCw,
  X,
} from 'lucide-react';
import { type FormEvent, useMemo, useState } from 'react';

import { MetricCard } from '../components/ui/MetricCard';
import { PageHeader } from '../components/ui/PageHeader';
import { usePrimeTech } from '../contexts/PrimeTechContext';
import { money } from '../lib/formatters';

export function StockPage() {
  const { stock, loading, error, addStockItem } = usePrimeTech();
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState('');
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
    if (physical - reserved <= minimum) acc.critical += 1;
    return acc;
  }, { physical: 0, reserved: 0, available: 0, critical: 0 }), [stock]);

  function resetForm() {
    setForm({ sku: '', name: '', physical: '0', minimum: '0', cost: '0', sale: '0' });
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
    if (![physical, minimum, cost, sale].every(Number.isFinite) || physical < 0 || minimum < 0 || cost < 0 || sale < 0) {
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

  if (loading) {
    return <div className="empty-state"><RefreshCw size={38}/><h3>Carregando estoque</h3><p>Conferindo peças e materiais.</p></div>;
  }

  return <>
    <PageHeader
      eyebrow="Estoque"
      title="Peças e materiais"
      description="Saldo físico, reservado e disponível, com bloqueio de SKU duplicado e alerta de estoque crítico."
      actions={<button className="primary-button" type="button" onClick={() => setShowForm((value) => !value)}>{showForm ? <X/> : <PackagePlus/>}{showForm ? 'Fechar' : 'Novo item'}</button>}
    />

    {(error || localError) && <section className="notice" style={{ marginBottom: 16 }}>
      <AlertTriangle size={20}/><div><strong>Não foi possível concluir a operação</strong><p>{localError || error}</p></div>
    </section>}

    {showForm && <section className="panel" style={{ marginBottom: 20 }}>
      <div className="panel-head"><div><span className="eyebrow">Cadastro</span><h2>Novo item de estoque</h2></div></div>
      <form onSubmit={(event) => void submit(event)} style={{ display: 'grid', gap: 12 }}>
        <div className="form-grid">
          <label><span>SKU</span><input value={form.sku} onChange={(e) => setForm((v) => ({ ...v, sku: e.target.value }))} placeholder="Ex.: CAP-100UF"/></label>
          <label><span>Descrição</span><input value={form.name} onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))} placeholder="Nome da peça ou material"/></label>
          <label><span>Quantidade inicial</span><input type="number" min="0" step="0.01" value={form.physical} onChange={(e) => setForm((v) => ({ ...v, physical: e.target.value }))}/></label>
          <label><span>Estoque mínimo</span><input type="number" min="0" step="0.01" value={form.minimum} onChange={(e) => setForm((v) => ({ ...v, minimum: e.target.value }))}/></label>
          <label><span>Custo unitário</span><input type="number" min="0" step="0.01" value={form.cost} onChange={(e) => setForm((v) => ({ ...v, cost: e.target.value }))}/></label>
          <label><span>Preço de venda</span><input type="number" min="0" step="0.01" value={form.sale} onChange={(e) => setForm((v) => ({ ...v, sale: e.target.value }))}/></label>
        </div>
        <div className="quick-actions"><button type="submit" disabled={saving}><PackagePlus size={16}/> {saving ? 'Salvando...' : 'Cadastrar item'}</button><button type="button" className="ghost-button" disabled={saving} onClick={() => { resetForm(); setShowForm(false); }}>Cancelar</button></div>
      </form>
    </section>}

    <div className="metrics-grid">
      <MetricCard label="Itens cadastrados" value={stock.length} icon={Boxes}/>
      <MetricCard label="Unidades reservadas" value={totals.reserved} icon={PackageCheck} tone="violet"/>
      <MetricCard label="Estoque crítico" value={totals.critical} icon={AlertTriangle} tone="amber"/>
      <MetricCard label="Unidades disponíveis" value={totals.available} icon={CheckCircle2} tone="green"/>
    </div>

    <section className="panel">
      {stock.length === 0 ? <div className="empty-state"><Boxes size={38}/><h3>Estoque vazio</h3><p>Cadastre o primeiro item para iniciar o controle.</p></div> : <div className="table-wrap"><table>
        <thead><tr><th>SKU / item</th><th>Físico</th><th>Reservado</th><th>Disponível</th><th>Mínimo</th><th>Custo</th><th>Venda</th><th>Situação</th></tr></thead>
        <tbody>{stock.map((item) => {
          const physical = Number(item.physical ?? item.quantity ?? 0);
          const reserved = Number(item.reserved ?? item.reserved_quantity ?? 0);
          const minimum = Number(item.minimum ?? item.minimum_quantity ?? 0);
          const available = physical - reserved;
          const critical = available <= minimum;
          return <tr key={item.id}>
            <td><strong>{item.name}</strong><small>{item.sku}</small></td>
            <td>{physical}</td><td>{reserved}</td><td><strong>{available}</strong></td><td>{minimum}</td>
            <td>{money.format(Number(item.cost_price ?? 0))}</td><td>{money.format(Number(item.sale_price ?? 0))}</td>
            <td><span className={`stock-state ${critical ? 'critical' : 'ok'}`}>{critical ? 'Repor estoque' : 'Normal'}</span></td>
          </tr>;
        })}</tbody>
      </table></div>}
    </section>
  </>;
}
