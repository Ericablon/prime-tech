import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { can } from "../lib/permissions";
import { usePrimeTech } from "../contexts/PrimeTechContext";
import { money, shortDate } from "../lib/formatters";
import { StatCard } from "../components/ui/StatCard";

export function FinancePage() {
  const { finance, addFinancialEntry, orders } = usePrimeTech();
  const { user } = useAuth();
  const [notice,setNotice]=useState(""); const [busy,setBusy]=useState(false);
  const income = finance.filter((f) => f.type === "income").reduce((a, b) => a + b.amount, 0);
  const expense = finance.filter((f) => f.type === "expense").reduce((a, b) => a + b.amount, 0);
  return <div className="space-y-6"><div><h1 className="pt-page-title">Financeiro</h1><p className="pt-page-subtitle">Caixa, entradas, saídas, custos e base para DRE.</p></div><div className="grid gap-4 md:grid-cols-3"><StatCard label="Receitas" value={money.format(income)} /><StatCard label="Despesas" value={money.format(expense)} /><StatCard label="Resultado" value={money.format(income - expense)} /></div>{notice && <p role="status" className="pt-card">{notice}</p>}
{can(user,"finance.manage") && <form className="pt-card grid gap-3 md:grid-cols-3" onSubmit={async e=>{e.preventDefault();const data=new FormData(e.currentTarget);setBusy(true);try{await addFinancialEntry({type:data.get("type") as "income"|"expense",category:String(data.get("category")),description:String(data.get("description")),amount:Number(data.get("amount")),occurred_at:new Date(String(data.get("date"))+"T12:00:00").toISOString(),service_order_id:String(data.get("order"))||null});setNotice("Lançamento registrado.");}catch(err){setNotice(err&&typeof err==="object"&&"message"in err?String(err.message):"Falha ao registrar.");}finally{setBusy(false);}}}>
<div className="md:col-span-3"><h2 className="pt-section-title">Registrar entrada ou saída</h2></div>
<label><span className="pt-label">Tipo</span><select name="type" className="pt-input"><option value="income">Receita</option><option value="expense">Despesa</option></select></label>
<label><span className="pt-label">Categoria</span><input name="category" className="pt-input" required maxLength={120}/></label>
<label><span className="pt-label">Valor (R$)</span><input name="amount" className="pt-input" type="number" inputMode="decimal" min="0.01" step="0.01" required/></label>
<label><span className="pt-label">Data</span><input name="date" className="pt-input" type="date" defaultValue={new Date().toLocaleDateString("sv-SE")} required/></label>
<label><span className="pt-label">Descrição</span><input name="description" className="pt-input" required maxLength={300}/></label>
<label><span className="pt-label">OS vinculada (opcional)</span><select name="order" className="pt-input"><option value="">Sem vínculo</option>{orders.map(o=><option key={o.id} value={o.id}>OS #{o.order_number}</option>)}</select></label>
<button disabled={busy} className="pt-btn-primary">{busy?"Salvando…":"Registrar lançamento"}</button></form>}
<div className="pt-card"><h2 className="pt-section-title">DRE simplificada</h2><div className="mt-4 divide-y divide-border"><div className="flex justify-between py-3"><span>Receita bruta</span><strong>{money.format(income)}</strong></div><div className="flex justify-between py-3"><span>(-) Despesas registradas</span><strong>{money.format(expense)}</strong></div><div className="flex justify-between py-3 text-lg"><span>Resultado</span><strong>{money.format(income - expense)}</strong></div></div></div><div className="pt-card overflow-x-auto"><table className="pt-table"><thead><tr><th>Data</th><th>Tipo</th><th>Categoria</th><th>Descrição</th><th>Valor</th></tr></thead><tbody>{finance.map((f) => <tr key={f.id}><td>{shortDate.format(new Date(f.occurred_at))}</td><td>{f.type === "income" ? "Entrada" : "Saída"}</td><td>{f.category}</td><td>{f.description}</td><td>{money.format(f.amount)}</td></tr>)}</tbody></table></div></div>;
}
