import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  Banknote,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  FileText,
  ListPlus,
  PlusCircle,
  Printer,
  Search,
  TrendingUp,
  WalletCards,
  X,
} from 'lucide-react';
import { type FormEvent, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { PrintableReport } from '../components/reports/PrintableReport';
import { MetricCard } from '../components/ui/MetricCard';
import { PageHeader } from '../components/ui/PageHeader';
import { useAuth } from '../contexts/AuthContext';
import { usePrimeTech } from '../contexts/PrimeTechContext';
import { categoriesFor } from '../lib/financeCategories';
import { money, orderCode, paymentMethods, shortDate } from '../lib/formatters';

type View = 'overview' | 'receivable' | 'payable' | 'realized';

function isCurrentMonth(value: string) {
  const date = new Date(value);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

export function FinancialHubPage() {
  const { user } = useAuth();
  const {
    finance,
    installments,
    orders,
    company,
    loading,
    error,
    addFinancialEntry,
    createPaymentPlan,
    settleInstallment,
  } = usePrimeTech();

  const [view, setView] = useState<View>('overview');
  const [showEntryForm, setShowEntryForm] = useState(false);
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState('');
  const [search, setSearch] = useState('');
  const [printOpen, setPrintOpen] = useState(false);

  const [entryForm, setEntryForm] = useState({
    type: 'income' as 'income' | 'expense',
    category: 'Serviços',
    description: '',
    amount: '',
    occurredAt: new Date().toISOString().slice(0, 10),
    method: 'pix',
  });

  const [planForm, setPlanForm] = useState({
    type: 'income' as 'income' | 'expense',
    category: 'Serviços',
    description: '',
    amount: '',
    count: '1',
    firstDue: new Date().toISOString().slice(0, 10),
    method: 'pix',
    orderId: '',
  });

  const monthEntries = useMemo(
    () => finance.filter((entry) => isCurrentMonth(entry.occurred_at)),
    [finance],
  );
  const revenues = monthEntries
    .filter((entry) => entry.type === 'income')
    .reduce((sum, entry) => sum + Number(entry.amount), 0);
  const expenses = monthEntries
    .filter((entry) => entry.type === 'expense')
    .reduce((sum, entry) => sum + Number(entry.amount), 0);
  const result = revenues - expenses;

  const openReceivables = installments.filter((item) => item.type === 'income' && !item.paid_at);
  const openPayables = installments.filter((item) => item.type === 'expense' && !item.paid_at);
  const pendingReceivables = openReceivables.reduce((sum, item) => sum + Number(item.amount), 0);
  const pendingPayables = openPayables.reduce((sum, item) => sum + Number(item.amount), 0);

  const overdueReceivables = openReceivables.filter((item) => item.due_date < new Date().toISOString().slice(0, 10));
  const overduePayables = openPayables.filter((item) => item.due_date < new Date().toISOString().slice(0, 10));

  const eligibleOrders = useMemo(
    () => orders.filter((order) =>
      ['approved', 'in_repair', 'waiting_part', 'quality_check', 'ready_for_pickup', 'delivered'].includes(order.status)),
    [orders],
  );

  const visibleInstallments = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    const base = view === 'receivable'
      ? openReceivables
      : view === 'payable'
        ? openPayables
        : installments.filter((item) => !item.paid_at);

    if (!normalized) return base;

    return base.filter((item) =>
      item.description.toLowerCase().includes(normalized)
      || item.category.toLowerCase().includes(normalized)
      || item.payment_method.toLowerCase().includes(normalized));
  }, [installments, openPayables, openReceivables, search, view]);

  const visibleEntries = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return finance;

    return finance.filter((entry) =>
      entry.description.toLowerCase().includes(normalized)
      || entry.category.toLowerCase().includes(normalized)
      || (entry.payment_method ?? '').toLowerCase().includes(normalized));
  }, [finance, search]);

  function setEntryType(type: 'income' | 'expense') {
    const first = categoriesFor(type)[0]?.label ?? '';
    setEntryForm((current) => ({ ...current, type, category: first }));
  }

  function setPlanType(type: 'income' | 'expense') {
    const first = categoriesFor(type)[0]?.label ?? '';
    setPlanForm((current) => ({ ...current, type, category: first }));
  }

  async function submitEntry(event: FormEvent) {
    event.preventDefault();
    const amount = Number(entryForm.amount.replace(',', '.'));

    if (!entryForm.description.trim() || !entryForm.category) {
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
        type: entryForm.type,
        category: entryForm.category,
        description: entryForm.description.trim(),
        amount,
        occurred_at: new Date(`${entryForm.occurredAt}T12:00:00`).toISOString(),
        competence_date: entryForm.occurredAt,
        payment_method: entryForm.method,
      });
      setEntryForm((current) => ({ ...current, description: '', amount: '' }));
      setShowEntryForm(false);
    } catch (cause) {
      setLocalError(cause instanceof Error ? cause.message : 'Não foi possível registrar o lançamento.');
    } finally {
      setSaving(false);
    }
  }

  async function submitPlan(event: FormEvent) {
    event.preventDefault();
    const amount = Number(planForm.amount.replace(',', '.'));
    const count = Number.parseInt(planForm.count, 10);

    if (!planForm.description.trim() || !planForm.category) {
      setLocalError('Informe categoria e descrição da conta.');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setLocalError('Informe um valor positivo.');
      return;
    }
    if (!Number.isFinite(count) || count < 1 || count > 36) {
      setLocalError('Informe entre 1 e 36 parcelas.');
      return;
    }
    if (!planForm.firstDue) {
      setLocalError('Informe o primeiro vencimento.');
      return;
    }

    setSaving(true);
    setLocalError('');
    try {
      await createPaymentPlan({
        request_id: crypto.randomUUID(),
        order_id: planForm.orderId || null,
        type: planForm.type,
        category: planForm.category,
        description: planForm.description.trim(),
        amount,
        count,
        first_due: planForm.firstDue,
        method: planForm.method,
        paid: false,
      });
      setPlanForm((current) => ({ ...current, description: '', amount: '', count: '1', orderId: '' }));
      setShowPlanForm(false);
    } catch (cause) {
      setLocalError(cause instanceof Error ? cause.message : 'Não foi possível criar a conta.');
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
    return (
      <div className="empty-state">
        <WalletCards size={38} />
        <h3>Carregando Financeiro</h3>
        <p>Consolidando caixa, contas a receber e contas a pagar.</p>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Financeiro"
        title="Gestão financeira"
        description="Entradas, saídas, contas a receber/pagar, baixas, categorias gerenciais e DRE em uma visão única."
        actions={(
          <div className="quick-actions">
            <Link to="/financeiro/dre" className="ghost-button">
              <FileText size={16} /> DRE
            </Link>
            <button type="button" className="ghost-button" onClick={() => setPrintOpen(true)}>
              <Printer size={16} /> Relatório
            </button>
            <button
              className="ghost-button"
              type="button"
              onClick={() => {
                setShowPlanForm((value) => !value);
                setShowEntryForm(false);
              }}
            >
              <ListPlus size={16} /> {showPlanForm ? 'Fechar conta' : 'Nova conta'}
            </button>
            <button
              className="primary-button"
              type="button"
              onClick={() => {
                setShowEntryForm((value) => !value);
                setShowPlanForm(false);
              }}
            >
              {showEntryForm ? <X size={16} /> : <PlusCircle size={16} />}
              {showEntryForm ? 'Fechar' : 'Novo lançamento'}
            </button>
          </div>
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

      {showPlanForm && (
        <section className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-head">
            <div><span className="eyebrow">Contas</span><h2>Nova conta / parcelamento</h2></div>
          </div>
          <form onSubmit={(event) => void submitPlan(event)} style={{ display: 'grid', gap: 12 }}>
            <div className="form-grid">
              <label>
                <span>Tipo</span>
                <select value={planForm.type} onChange={(event) => setPlanType(event.target.value as 'income' | 'expense')}>
                  <option value="income">Conta a receber</option>
                  <option value="expense">Conta a pagar</option>
                </select>
              </label>
              <label>
                <span>OS vinculada (opcional)</span>
                <select value={planForm.orderId} onChange={(event) => setPlanForm((value) => ({ ...value, orderId: event.target.value }))}>
                  <option value="">Sem OS</option>
                  {eligibleOrders.map((order) => (
                    <option key={order.id} value={order.id}>
                      {orderCode(order.order_number)} · {order.client_name ?? 'Cliente'}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Categoria</span>
                <select value={planForm.category} onChange={(event) => setPlanForm((value) => ({ ...value, category: event.target.value }))}>
                  {categoriesFor(planForm.type).map((category) => (
                    <option key={category.code} value={category.label}>{category.label}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Descrição</span>
                <input value={planForm.description} onChange={(event) => setPlanForm((value) => ({ ...value, description: event.target.value }))} />
              </label>
              <label>
                <span>Valor total</span>
                <input type="number" min="0.01" step="0.01" value={planForm.amount} onChange={(event) => setPlanForm((value) => ({ ...value, amount: event.target.value }))} />
              </label>
              <label>
                <span>Parcelas</span>
                <input type="number" min="1" max="36" step="1" value={planForm.count} onChange={(event) => setPlanForm((value) => ({ ...value, count: event.target.value }))} />
              </label>
              <label>
                <span>Primeiro vencimento</span>
                <input type="date" value={planForm.firstDue} onChange={(event) => setPlanForm((value) => ({ ...value, firstDue: event.target.value }))} />
              </label>
              <label>
                <span>Forma de pagamento</span>
                <select value={planForm.method} onChange={(event) => setPlanForm((value) => ({ ...value, method: event.target.value }))}>
                  {Object.entries(paymentMethods).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="quick-actions">
              <button type="submit" disabled={saving}>
                <ListPlus size={16} /> {saving ? 'Criando...' : 'Criar conta'}
              </button>
              <button type="button" className="ghost-button" disabled={saving} onClick={() => setShowPlanForm(false)}>
                Cancelar
              </button>
            </div>
          </form>
        </section>
      )}

      {showEntryForm && (
        <section className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-head">
            <div><span className="eyebrow">Realizado</span><h2>Novo lançamento financeiro</h2></div>
          </div>
          <form onSubmit={(event) => void submitEntry(event)} style={{ display: 'grid', gap: 12 }}>
            <div className="form-grid">
              <label>
                <span>Tipo</span>
                <select value={entryForm.type} onChange={(event) => setEntryType(event.target.value as 'income' | 'expense')}>
                  <option value="income">Entrada</option>
                  <option value="expense">Saída</option>
                </select>
              </label>
              <label>
                <span>Categoria</span>
                <select value={entryForm.category} onChange={(event) => setEntryForm((value) => ({ ...value, category: event.target.value }))}>
                  {categoriesFor(entryForm.type).map((category) => (
                    <option key={category.code} value={category.label}>{category.label}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Descrição</span>
                <input value={entryForm.description} onChange={(event) => setEntryForm((value) => ({ ...value, description: event.target.value }))} />
              </label>
              <label>
                <span>Valor</span>
                <input type="number" min="0.01" step="0.01" value={entryForm.amount} onChange={(event) => setEntryForm((value) => ({ ...value, amount: event.target.value }))} />
              </label>
              <label>
                <span>Data / competência</span>
                <input type="date" value={entryForm.occurredAt} onChange={(event) => setEntryForm((value) => ({ ...value, occurredAt: event.target.value }))} />
              </label>
              <label>
                <span>Forma de pagamento</span>
                <select value={entryForm.method} onChange={(event) => setEntryForm((value) => ({ ...value, method: event.target.value }))}>
                  {Object.entries(paymentMethods).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="quick-actions">
              <button type="submit" disabled={saving}>
                <CircleDollarSign size={16} /> {saving ? 'Salvando...' : 'Registrar'}
              </button>
              <button type="button" className="ghost-button" disabled={saving} onClick={() => setShowEntryForm(false)}>
                Cancelar
              </button>
            </div>
          </form>
        </section>
      )}

      <div className="metrics-grid">
        <MetricCard label="Receitas no mês" value={money.format(revenues)} icon={ArrowUpCircle} tone="green" />
        <MetricCard label="Despesas no mês" value={money.format(expenses)} icon={ArrowDownCircle} tone="red" />
        <MetricCard label="Resultado" value={money.format(result)} icon={TrendingUp} tone={result >= 0 ? 'green' : 'red'} />
        <MetricCard label="A receber" value={money.format(pendingReceivables)} helper={`${overdueReceivables.length} vencida(s)`} icon={Banknote} tone="violet" />
      </div>

      <section className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-head" style={{ marginBottom: 0 }}>
          <div>
            <span className="eyebrow">Visões</span>
            <h2>Financeiro operacional</h2>
          </div>
          <div className="quick-actions">
            {([
              ['overview', 'Visão geral'],
              ['receivable', `A receber (${openReceivables.length})`],
              ['payable', `A pagar (${openPayables.length})`],
              ['realized', 'Realizado'],
            ] as Array<[View, string]>).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={view === value ? 'primary-button' : 'ghost-button'}
                onClick={() => setView(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {view !== 'realized' && (
        <section className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-head">
            <div>
              <span className="eyebrow">Contas</span>
              <h2>
                {view === 'receivable' ? 'Contas a receber' : view === 'payable' ? 'Contas a pagar' : 'Contas em aberto'}
              </h2>
            </div>
            <strong>
              A receber: {money.format(pendingReceivables)} · A pagar: {money.format(pendingPayables)}
            </strong>
          </div>

          <div className="filters">
            <div className="filter-search">
              <Search size={16} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar descrição, categoria ou pagamento..." />
            </div>
          </div>

          {visibleInstallments.length === 0 ? (
            <div className="empty-state">
              <CheckCircle2 size={38} />
              <h3>Nenhuma conta nesta visão</h3>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Vencimento</th>
                    <th>Descrição</th>
                    <th>Tipo</th>
                    <th>Parcela</th>
                    <th>Pagamento</th>
                    <th>Valor</th>
                    <th>Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleInstallments.map((item) => {
                    const overdue = !item.paid_at && item.due_date < new Date().toISOString().slice(0, 10);
                    return (
                      <tr key={item.id}>
                        <td>
                          <strong style={{ color: overdue ? 'var(--red)' : undefined }}>
                            {shortDate.format(new Date(`${item.due_date}T12:00:00`))}
                          </strong>
                          {overdue && <small>Vencida</small>}
                        </td>
                        <td><strong>{item.description}</strong><small>{item.category}</small></td>
                        <td>{item.type === 'income' ? 'Receber' : 'Pagar'}</td>
                        <td>{item.installment_number}/{item.installment_count}</td>
                        <td>{paymentMethods[item.payment_method as keyof typeof paymentMethods] ?? item.payment_method}</td>
                        <td><strong>{money.format(Number(item.amount))}</strong></td>
                        <td>
                          <button type="button" className="ghost-button" disabled={saving} onClick={() => void settle(item.id)}>
                            <CheckCircle2 size={15} /> Baixar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {(view === 'realized' || view === 'overview') && (
        <section className="panel">
          <div className="panel-head">
            <div><span className="eyebrow">Realizado</span><h2>Entradas e saídas</h2></div>
          </div>
          {view === 'realized' && (
            <div className="filters">
              <div className="filter-search">
                <Search size={16} />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar lançamento..." />
              </div>
            </div>
          )}
          {visibleEntries.length === 0 ? (
            <div className="empty-state"><CircleDollarSign size={38} /><h3>Sem lançamentos realizados</h3></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Tipo</th><th>Pagamento</th><th>Valor</th></tr>
                </thead>
                <tbody>
                  {visibleEntries.slice(0, view === 'overview' ? 12 : 200).map((entry) => (
                    <tr key={entry.id}>
                      <td>{shortDate.format(new Date(entry.occurred_at))}</td>
                      <td><strong>{entry.description}</strong></td>
                      <td>{entry.category}</td>
                      <td>{entry.type === 'income' ? 'Entrada' : 'Saída'}</td>
                      <td>{entry.payment_method ? (paymentMethods[entry.payment_method as keyof typeof paymentMethods] ?? entry.payment_method) : '—'}</td>
                      <td><strong style={{ color: entry.type === 'income' ? 'var(--green)' : 'var(--red)' }}>{money.format(Number(entry.amount))}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <PrintableReport
        open={printOpen}
        onClose={() => setPrintOpen(false)}
        title="Relatório Financeiro"
        subtitle="Resumo gerencial do mês atual"
        company={company}
        generatedBy={user?.full_name}
        filters={[{ label: 'Competência', value: new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) }]}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 20 }}>
          <PrintKpi label="Receitas" value={money.format(revenues)} />
          <PrintKpi label="Despesas" value={money.format(expenses)} />
          <PrintKpi label="Resultado" value={money.format(result)} />
          <PrintKpi label="A receber" value={money.format(pendingReceivables)} />
        </div>

        <h3 style={{ fontSize: 14, marginBottom: 7 }}>Contas em aberto</h3>
        <table style={printTable}>
          <thead>
            <tr><th style={printTh}>Vencimento</th><th style={printTh}>Descrição</th><th style={printTh}>Tipo</th><th style={{ ...printTh, textAlign: 'right' }}>Valor</th></tr>
          </thead>
          <tbody>
            {installments.filter((item) => !item.paid_at).map((item) => (
              <tr key={item.id}>
                <td style={printTd}>{shortDate.format(new Date(`${item.due_date}T12:00:00`))}</td>
                <td style={printTd}>{item.description}<br /><small>{item.category}</small></td>
                <td style={printTd}>{item.type === 'income' ? 'Receber' : 'Pagar'}</td>
                <td style={{ ...printTd, textAlign: 'right' }}>{money.format(Number(item.amount))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </PrintableReport>

      <section className="panel" style={{ marginTop: 16 }}>
        <div className="mini-kpis">
          <div><span>{overdueReceivables.length}</span><small>Recebíveis vencidos</small></div>
          <div><span>{overduePayables.length}</span><small>Pagáveis vencidos</small></div>
          <div><span>{money.format(pendingReceivables - pendingPayables)}</span><small>Saldo projetado</small></div>
        </div>
      </section>
    </>
  );
}

function PrintKpi({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: '1px solid #dbe3ee', borderRadius: 7, padding: 10 }}>
      <div style={{ color: '#64748b', fontSize: 10, textTransform: 'uppercase' }}>{label}</div>
      <strong style={{ display: 'block', marginTop: 3, fontSize: 14 }}>{value}</strong>
    </div>
  );
}

const printTable = { width: '100%', borderCollapse: 'collapse' as const };
const printTh = {
  padding: '7px 8px',
  borderBottom: '1px solid #cbd5e1',
  color: '#475569',
  textAlign: 'left' as const,
  fontSize: 10,
  textTransform: 'uppercase' as const,
};
const printTd = { padding: '7px 8px', borderBottom: '1px solid #e2e8f0' };
