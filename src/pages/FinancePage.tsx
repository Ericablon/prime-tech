import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  Banknote,
  CheckCircle2,
  CircleDollarSign,
  PlusCircle,
  RefreshCw,
  TrendingUp,
  X,
} from 'lucide-react';
import { type FormEvent, useMemo, useState } from 'react';

import { MetricCard } from '../components/ui/MetricCard';
import { PageHeader } from '../components/ui/PageHeader';
import { usePrimeTech } from '../contexts/PrimeTechContext';
import { money, paymentMethods, shortDate } from '../lib/formatters';

function isCurrentMonth(value: string) {
  const date = new Date(value);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

export function FinancePage({ dre = false }: { dre?: boolean }) {
  const {
    finance,
    installments,
    loading,
    error,
    addFinancialEntry,
    settleInstallment,
  } = usePrimeTech();

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState('');
  const [form, setForm] = useState({
    type: 'income' as 'income' | 'expense',
    category: 'Serviços',
    description: '',
    amount: '',
    occurredAt: new Date().toISOString().slice(0, 10),
    method: 'pix',
  });

  const monthEntries = useMemo(() => finance.filter((entry) => isCurrentMonth(entry.occurred_at)), [finance]);
  const revenues = monthEntries.filter((entry) => entry.type === 'income').reduce((sum, entry) => sum + Number(entry.amount), 0);
  const expenses = monthEntries.filter((entry) => entry.type === 'expense').reduce((sum, entry) => sum + Number(entry.amount), 0);
  const result = revenues - expenses;
  const pendingReceivables = installments.filter((item) => item.type === 'income' && !item.paid_at).reduce((sum, item) => sum + Number(item.amount), 0);
  const pendingPayables = installments.filter((item) => item.type === 'expense' && !item.paid_at).reduce((sum, item) => sum + Number(item.amount), 0);

  const dreGroups = useMemo(() => {
    const groups = new Map<string, { income: number; expense: number }>();
    monthEntries.forEach((entry) => {
      const current = groups.get(entry.category) ?? { income: 0, expense: 0 };
      current[entry.type] += Number(entry.amount);
      groups.set(entry.category, current);
    });
    return Array.from(groups.entries()).sort((a, b) => (b[1].income + b[1].expense) - (a[1].income + a[1].expense));
  }, [monthEntries]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const amount = Number(form.amount.replace(',', '.'));
    if (!form.description.trim() || !form.category.trim()) {
      setLocalError('Informe categoria e descrição do lançamento.');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setLocalError('Informe um valor positivo.');
      return;
    }

    setSaving(true);
    setLocalError('');
    try {
      await addFinancialEntry({
        type: form.type,
        category: form.category.trim(),
        description: form.description.trim(),
        amount,
        occurred_at: new Date(`${form.occurredAt}T12:00:00`).toISOString(),
        payment_method: form.method,
      });
      setForm((current) => ({ ...current, description: '', amount: '' }));
      setShowForm(false);
    } catch (cause) {
      setLocalError(cause instanceof Error ? cause.message : 'Não foi possível registrar o lançamento.');
    } finally {
      setSaving(false);
    }
  }

  async function settle(id: string) {
    setSaving(true);
    setLocalError('');
    try {
      await settleInstallment(id);
    } catch (cause) {
      setLocalError(cause instanceof Error ? cause.message : 'Não foi possível baixar a parcela.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="empty-state"><RefreshCw size={38}/><h3>Carregando Financeiro</h3><p>Consolidando lançamentos e parcelas.</p></div>;
  }

  if (dre) {
    return <>
      <PageHeader eyebrow="Financeiro" title="DRE gerencial" description="Receitas, custos e despesas calculados a partir dos lançamentos do mês atual."/>
      {(error || localError) && <section className="notice" style={{ marginBottom: 16 }}><AlertTriangle size={20}/><div><strong>Falha ao carregar o financeiro</strong><p>{localError || error}</p></div></section>}
      <section className="panel dre">
        <div><span>Receita bruta</span><strong>{money.format(revenues)}</strong></div>
        {dreGroups.filter(([, values]) => values.expense > 0).map(([category, values]) => <div key={category}><span>(-) {category}</span><strong>{money.format(values.expense)}</strong></div>)}
        <div className="dre-result"><span>Resultado do mês</span><strong>{money.format(result)}</strong></div>
      </section>
    </>;
  }

  return <>
    <PageHeader
      eyebrow="Financeiro"
      title="Visão financeira"
      description="Caixa realizado, contas a receber/pagar e baixas de parcelas no mesmo painel."
      actions={<button className="primary-button" type="button" onClick={() => setShowForm((value) => !value)}>{showForm ? <X/> : <PlusCircle/>}{showForm ? 'Fechar' : 'Novo lançamento'}</button>}
    />

    {(error || localError) && <section className="notice" style={{ marginBottom: 16 }}><AlertTriangle size={20}/><div><strong>Não foi possível concluir a operação</strong><p>{localError || error}</p></div></section>}

    {showForm && <section className="panel" style={{ marginBottom: 20 }}>
      <div className="panel-head"><div><span className="eyebrow">Caixa</span><h2>Novo lançamento</h2></div></div>
      <form onSubmit={(event) => void submit(event)} style={{ display: 'grid', gap: 12 }}>
        <div className="form-grid">
          <label><span>Tipo</span><select value={form.type} onChange={(e) => setForm((v) => ({ ...v, type: e.target.value as 'income' | 'expense' }))}><option value="income">Receita</option><option value="expense">Despesa</option></select></label>
          <label><span>Categoria</span><input value={form.category} onChange={(e) => setForm((v) => ({ ...v, category: e.target.value }))}/></label>
          <label><span>Descrição</span><input value={form.description} onChange={(e) => setForm((v) => ({ ...v, description: e.target.value }))}/></label>
          <label><span>Valor</span><input type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => setForm((v) => ({ ...v, amount: e.target.value }))}/></label>
          <label><span>Data</span><input type="date" value={form.occurredAt} onChange={(e) => setForm((v) => ({ ...v, occurredAt: e.target.value }))}/></label>
          <label><span>Forma de pagamento</span><select value={form.method} onChange={(e) => setForm((v) => ({ ...v, method: e.target.value }))}>{Object.entries(paymentMethods).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        </div>
        <div className="quick-actions"><button type="submit" disabled={saving}><CircleDollarSign size={16}/> {saving ? 'Salvando...' : 'Registrar'}</button><button type="button" className="ghost-button" disabled={saving} onClick={() => setShowForm(false)}>Cancelar</button></div>
      </form>
    </section>}

    <div className="metrics-grid">
      <MetricCard label="Receitas no mês" value={money.format(revenues)} icon={ArrowUpCircle} tone="green"/>
      <MetricCard label="Despesas no mês" value={money.format(expenses)} icon={ArrowDownCircle} tone="red"/>
      <MetricCard label="Resultado" value={money.format(result)} icon={TrendingUp}/>
      <MetricCard label="A receber" value={money.format(pendingReceivables)} icon={Banknote} tone="violet"/>
    </div>

    <section className="panel" style={{ marginBottom: 20 }}>
      <div className="panel-head"><div><span className="eyebrow">Parcelas</span><h2>Contas em aberto</h2></div><strong>A pagar: {money.format(pendingPayables)}</strong></div>
      {installments.filter((item) => !item.paid_at).length === 0 ? <div className="empty-state"><CheckCircle2 size={38}/><h3>Nenhuma parcela em aberto</h3></div> : <div className="table-wrap"><table>
        <thead><tr><th>Vencimento</th><th>Descrição</th><th>Tipo</th><th>Parcela</th><th>Valor</th><th>Ação</th></tr></thead>
        <tbody>{installments.filter((item) => !item.paid_at).map((item) => <tr key={item.id}>
          <td>{shortDate.format(new Date(`${item.due_date}T12:00:00`))}</td>
          <td><strong>{item.description}</strong><small>{item.category}</small></td>
          <td>{item.type === 'income' ? 'Receber' : 'Pagar'}</td>
          <td>{item.installment_number}/{item.installment_count}</td>
          <td><strong>{money.format(Number(item.amount))}</strong></td>
          <td><button type="button" className="ghost-button" disabled={saving} onClick={() => void settle(item.id)}><CheckCircle2 size={15}/> Baixar</button></td>
        </tr>)}</tbody>
      </table></div>}
    </section>

    <section className="panel">
      <div className="panel-head"><h2>Movimentações recentes</h2></div>
      {finance.length === 0 ? <div className="empty-state"><Banknote size={38}/><h3>Sem movimentações</h3></div> : <div className="table-wrap"><table>
        <thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Forma</th><th>Valor</th></tr></thead>
        <tbody>{finance.slice(0, 20).map((entry) => <tr key={entry.id}>
          <td>{shortDate.format(new Date(entry.occurred_at))}</td>
          <td>{entry.description}</td><td>{entry.category}</td><td>{entry.payment_method ? paymentMethods[entry.payment_method] ?? entry.payment_method : '—'}</td>
          <td><strong>{entry.type === 'expense' ? '- ' : '+ '}{money.format(Number(entry.amount))}</strong></td>
        </tr>)}</tbody>
      </table></div>}
    </section>
  </>;
}
