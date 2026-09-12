import { usePrimeTech } from "../contexts/PrimeTechContext";
import { money, shortDate } from "../lib/formatters";
import { StatCard } from "../components/ui/StatCard";

export function FinancePage() {
  const { finance } = usePrimeTech();
  const income = finance.filter((f) => f.type === "income").reduce((a, b) => a + b.amount, 0);
  const expense = finance.filter((f) => f.type === "expense").reduce((a, b) => a + b.amount, 0);
  return <div className="space-y-6"><div><h1 className="pt-page-title">Financeiro</h1><p className="pt-page-subtitle">Caixa, entradas, saídas, custos e base para DRE.</p></div><div className="grid gap-4 md:grid-cols-3"><StatCard label="Receitas" value={money.format(income)} /><StatCard label="Despesas" value={money.format(expense)} /><StatCard label="Resultado" value={money.format(income - expense)} /></div><div className="pt-card"><h2 className="pt-section-title">DRE simplificada</h2><div className="mt-4 divide-y divide-border"><div className="flex justify-between py-3"><span>Receita bruta</span><strong>{money.format(income)}</strong></div><div className="flex justify-between py-3"><span>(-) Despesas registradas</span><strong>{money.format(expense)}</strong></div><div className="flex justify-between py-3 text-lg"><span>Resultado</span><strong>{money.format(income - expense)}</strong></div></div></div><div className="pt-card overflow-x-auto"><table className="pt-table"><thead><tr><th>Data</th><th>Tipo</th><th>Categoria</th><th>Descrição</th><th>Valor</th></tr></thead><tbody>{finance.map((f) => <tr key={f.id}><td>{shortDate.format(new Date(f.occurred_at))}</td><td>{f.type === "income" ? "Entrada" : "Saída"}</td><td>{f.category}</td><td>{f.description}</td><td>{money.format(f.amount)}</td></tr>)}</tbody></table></div></div>;
}
