import {
  AlertTriangle,
  CalendarDays,
  CircleDollarSign,
  Printer,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { PrintableReport } from '../components/reports/PrintableReport';
import { MetricCard } from '../components/ui/MetricCard';
import { PageHeader } from '../components/ui/PageHeader';
import { useAuth } from '../contexts/AuthContext';
import { usePrimeTech } from '../contexts/PrimeTechContext';
import {
  dreGroupLabels,
  dreGroupOrder,
  resolveFinancialCategory,
  type DreGroup,
} from '../lib/financeCategories';
import { money } from '../lib/formatters';

const months = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

function dateForEntry(entry: { occurred_at: string; competence_date?: string | null }) {
  return new Date(`${entry.competence_date ?? entry.occurred_at.slice(0, 10)}T12:00:00`);
}

export function DrePage() {
  const { user } = useAuth();
  const { finance, company, loading, error, refresh } = usePrimeTech();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState<number | null>(now.getMonth() + 1);
  const [printOpen, setPrintOpen] = useState(false);

  const filteredEntries = useMemo(
    () => finance.filter((entry) => {
      const date = dateForEntry(entry);
      return date.getFullYear() === year && (month === null || date.getMonth() + 1 === month);
    }),
    [finance, month, year],
  );

  const result = useMemo(() => {
    const groups = new Map<DreGroup, number>();
    const categories = new Map<
      string,
      { category: string; type: 'income' | 'expense'; group: DreGroup; amount: number }
    >();

    for (const entry of filteredEntries) {
      const category = resolveFinancialCategory(entry.category, entry.type);
      groups.set(category.dreGroup, (groups.get(category.dreGroup) ?? 0) + Number(entry.amount));

      const key = `${entry.type}:${category.label}`;
      const current = categories.get(key) ?? {
        category: category.label,
        type: entry.type,
        group: category.dreGroup,
        amount: 0,
      };
      current.amount += Number(entry.amount);
      categories.set(key, current);
    }

    const grossRevenue = groups.get('gross_revenue') ?? 0;
    const otherIncome = groups.get('other_income') ?? 0;
    const deductions = groups.get('deduction') ?? 0;
    const costOfSales = groups.get('cost_of_sales') ?? 0;
    const operatingExpenses = groups.get('operating_expense') ?? 0;
    const financialExpenses = groups.get('financial_expense') ?? 0;
    const otherExpenses = groups.get('other_expense') ?? 0;

    const netRevenue = grossRevenue - deductions;
    const grossProfit = netRevenue - costOfSales;
    const operatingResult = grossProfit
      - operatingExpenses
      - financialExpenses
      + otherIncome
      - otherExpenses;

    return {
      groups,
      categories: Array.from(categories.values()).sort((a, b) => {
        const groupCompare = dreGroupOrder.indexOf(a.group) - dreGroupOrder.indexOf(b.group);
        if (groupCompare !== 0) return groupCompare;
        return a.category.localeCompare(b.category, 'pt-BR');
      }),
      grossRevenue,
      otherIncome,
      deductions,
      netRevenue,
      costOfSales,
      grossProfit,
      operatingExpenses,
      financialExpenses,
      otherExpenses,
      operatingResult,
      margin: netRevenue > 0 ? (operatingResult / netRevenue) * 100 : 0,
    };
  }, [filteredEntries]);

  const periodLabel = month === null ? `Ano ${year}` : `${months[month - 1]} de ${year}`;
  const years = Array.from({ length: 7 }, (_, index) => now.getFullYear() - 4 + index);

  if (loading) {
    return (
      <div className="empty-state">
        <CircleDollarSign size={38} />
        <h3>Carregando DRE</h3>
        <p>Organizando receitas, custos e despesas por categoria.</p>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Financeiro"
        title="DRE gerencial"
        description="Resultado estruturado pelas categorias das entradas e saídas financeiras, com visão por competência."
        actions={(
          <div className="quick-actions">
            <button type="button" className="ghost-button" onClick={() => void refresh()}>
              <RefreshCw size={16} /> Atualizar
            </button>
            <button type="button" className="primary-button" onClick={() => setPrintOpen(true)}>
              <Printer size={16} /> Gerar PDF
            </button>
          </div>
        )}
      />

      {error && (
        <section className="notice" style={{ marginBottom: 16 }}>
          <AlertTriangle size={20} />
          <div>
            <strong>Parte dos dados financeiros pode estar incompleta</strong>
            <p>{error}</p>
          </div>
        </section>
      )}

      <section className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-head" style={{ marginBottom: 0 }}>
          <div>
            <span className="eyebrow">Período</span>
            <h2>{periodLabel}</h2>
          </div>
          <div className="quick-actions">
            <label style={{ display: 'grid', gap: 4 }}>
              <span className="muted">Mês</span>
              <select
                value={month ?? ''}
                onChange={(event) => setMonth(event.target.value ? Number(event.target.value) : null)}
              >
                <option value="">Ano inteiro</option>
                {months.map((label, index) => (
                  <option key={label} value={index + 1}>{label}</option>
                ))}
              </select>
            </label>
            <label style={{ display: 'grid', gap: 4 }}>
              <span className="muted">Ano</span>
              <select value={year} onChange={(event) => setYear(Number(event.target.value))}>
                {years.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
          </div>
        </div>
      </section>

      <div className="metrics-grid">
        <MetricCard
          label="Receita bruta"
          value={money.format(result.grossRevenue)}
          helper={`${filteredEntries.filter((entry) => entry.type === 'income').length} entrada(s) no período`}
          icon={TrendingUp}
          tone="green"
        />
        <MetricCard
          label="Custos + despesas"
          value={money.format(
            result.deductions
              + result.costOfSales
              + result.operatingExpenses
              + result.financialExpenses
              + result.otherExpenses,
          )}
          icon={TrendingDown}
          tone="red"
        />
        <MetricCard
          label="Resultado"
          value={money.format(result.operatingResult)}
          helper={`Margem: ${result.margin.toFixed(1).replace('.', ',')}%`}
          icon={CircleDollarSign}
          tone={result.operatingResult >= 0 ? 'green' : 'red'}
        />
        <MetricCard
          label="Período"
          value={periodLabel}
          helper="Base: competência financeira"
          icon={CalendarDays}
          tone="violet"
        />
      </div>

      <section className="panel dre" style={{ maxWidth: 900 }}>
        <DreRow label="Receita operacional bruta" value={result.grossRevenue} strong />
        <DreRow label="(+) Outras receitas" value={result.otherIncome} />
        <DreRow label="(-) Impostos e deduções" value={result.deductions} negative />
        <DreRow label="= Receita líquida" value={result.netRevenue + result.otherIncome} strong result />
        <DreRow label="(-) Custo de peças e materiais" value={result.costOfSales} negative />
        <DreRow label="= Lucro bruto" value={result.grossProfit + result.otherIncome} strong result />
        <DreRow label="(-) Despesas operacionais" value={result.operatingExpenses} negative />
        <DreRow label="(-) Despesas financeiras" value={result.financialExpenses} negative />
        <DreRow label="(-) Outras despesas" value={result.otherExpenses} negative />
        <DreRow label="= Resultado do período" value={result.operatingResult} strong result />
      </section>

      <section className="panel" style={{ marginTop: 18 }}>
        <div className="panel-head">
          <div>
            <span className="eyebrow">Composição</span>
            <h2>Detalhamento por categoria</h2>
          </div>
        </div>

        {result.categories.length === 0 ? (
          <div className="empty-state">
            <CircleDollarSign size={36} />
            <h3>Sem lançamentos no período</h3>
            <p>Registre entradas e saídas para formar a DRE.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Grupo DRE</th>
                  <th>Categoria</th>
                  <th>Tipo</th>
                  <th>Valor</th>
                </tr>
              </thead>
              <tbody>
                {result.categories.map((row) => (
                  <tr key={`${row.type}-${row.category}`}>
                    <td>{dreGroupLabels[row.group]}</td>
                    <td><strong>{row.category}</strong></td>
                    <td>{row.type === 'income' ? 'Entrada' : 'Saída'}</td>
                    <td><strong>{money.format(row.amount)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <PrintableReport
        open={printOpen}
        onClose={() => setPrintOpen(false)}
        title="DRE Gerencial"
        subtitle="Demonstrativo de resultado por categorias financeiras"
        company={company}
        generatedBy={user?.full_name}
        filters={[{ label: 'Período', value: periodLabel }]}
      >
        <div style={{ marginBottom: 18 }}>
          <strong style={{ fontSize: 15 }}>Resumo do período</strong>
          <p style={{ marginTop: 3, color: '#475569' }}>
            Resultado gerencial calculado pelas categorias cadastradas nas entradas e saídas financeiras.
          </p>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 22 }}>
          <tbody>
            <PrintRow label="Receita operacional bruta" value={result.grossRevenue} />
            <PrintRow label="(+) Outras receitas" value={result.otherIncome} />
            <PrintRow label="(-) Impostos e deduções" value={-result.deductions} />
            <PrintRow label="(-) Custo de peças e materiais" value={-result.costOfSales} />
            <PrintRow label="(-) Despesas operacionais" value={-result.operatingExpenses} />
            <PrintRow label="(-) Despesas financeiras" value={-result.financialExpenses} />
            <PrintRow label="(-) Outras despesas" value={-result.otherExpenses} />
            <PrintRow label="Resultado do período" value={result.operatingResult} strong />
          </tbody>
        </table>

        <strong style={{ fontSize: 14 }}>Detalhamento por categoria</strong>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
          <thead>
            <tr>
              <th style={printTh}>Grupo</th>
              <th style={printTh}>Categoria</th>
              <th style={printTh}>Tipo</th>
              <th style={{ ...printTh, textAlign: 'right' }}>Valor</th>
            </tr>
          </thead>
          <tbody>
            {result.categories.map((row) => (
              <tr key={`${row.type}-${row.category}`}>
                <td style={printTd}>{dreGroupLabels[row.group]}</td>
                <td style={printTd}>{row.category}</td>
                <td style={printTd}>{row.type === 'income' ? 'Entrada' : 'Saída'}</td>
                <td style={{ ...printTd, textAlign: 'right', fontWeight: 700 }}>
                  {money.format(row.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </PrintableReport>
    </>
  );
}

function DreRow({
  label,
  value,
  negative = false,
  strong = false,
  result = false,
}: {
  label: string;
  value: number;
  negative?: boolean;
  strong?: boolean;
  result?: boolean;
}) {
  return (
    <div className={result ? 'dre-result' : undefined}>
      <span style={{ fontWeight: strong ? 800 : 500 }}>{label}</span>
      <strong style={{ color: negative ? 'var(--red)' : undefined }}>{money.format(value)}</strong>
    </div>
  );
}

function PrintRow({ label, value, strong = false }: { label: string; value: number; strong?: boolean }) {
  return (
    <tr>
      <td style={{ padding: '7px 8px', borderBottom: '1px solid #e2e8f0', fontWeight: strong ? 800 : 500 }}>
        {label}
      </td>
      <td style={{ padding: '7px 8px', borderBottom: '1px solid #e2e8f0', textAlign: 'right', fontWeight: strong ? 800 : 700 }}>
        {money.format(value)}
      </td>
    </tr>
  );
}

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
