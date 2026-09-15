import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { can } from "../lib/permissions";
import { AlertTriangle } from "lucide-react";
import { usePrimeTech } from "../contexts/PrimeTechContext";
import { money } from "../lib/formatters";

export function StockPage() {
  const { stock, addStockItem } = usePrimeTech(); const { user } = useAuth(); const [notice,setNotice]=useState(""); const [busy,setBusy]=useState(false);
  return <div className="space-y-6"><div><h1 className="pt-page-title">Estoque / Peças</h1><p className="pt-page-subtitle">Cadastro de peças, saldo inicial e valores de referência.</p></div>{notice&&<p className="pt-card" role="status">{notice}</p>}
{can(user,"stock.manage")&&<form className="pt-card grid gap-3 sm:grid-cols-2 lg:grid-cols-3" onSubmit={async e=>{e.preventDefault();const d=new FormData(e.currentTarget);setBusy(true);try{await addStockItem({sku:String(d.get("sku")).trim(),name:String(d.get("name")).trim(),quantity:Number(d.get("quantity")),minimum_quantity:Number(d.get("minimum_quantity")),cost_price:Number(d.get("cost_price")),sale_price:Number(d.get("sale_price"))});setNotice("Peça cadastrada.");}catch(err){setNotice(err&&typeof err==="object"&&"message"in err?String(err.message):"Falha ao cadastrar.");}finally{setBusy(false);}}}>
<div className="sm:col-span-2 lg:col-span-3"><h2 className="pt-section-title">Cadastrar peça</h2></div>
<label><span className="pt-label">Código / SKU</span><input className="pt-input" name="sku" required/></label><label><span className="pt-label">Descrição</span><input className="pt-input" name="name" required/></label>
{[["quantity","Saldo inicial"],["minimum_quantity","Estoque mínimo"],["cost_price","Custo (R$)"],["sale_price","Venda (R$)"]].map(([name,label])=><label key={name}><span className="pt-label">{label}</span><input className="pt-input" name={name} type="number" inputMode="decimal" min="0" step="0.01" defaultValue="0" required/></label>)}
<button className="pt-btn-primary" disabled={busy}>{busy?"Salvando…":"Cadastrar peça"}</button></form>}
<div className="pt-card overflow-x-auto"><table className="pt-table"><thead><tr><th>SKU</th><th>Item</th><th>Qtd.</th><th>Mínimo</th><th>Custo</th><th>Venda</th><th>Situação</th></tr></thead><tbody>{stock.map((item) => <tr key={item.id}><td>{item.sku}</td><td className="font-medium">{item.name}</td><td>{item.quantity}</td><td>{item.minimum_quantity}</td><td>{money.format(item.cost_price)}</td><td>{money.format(item.sale_price)}</td><td>{item.quantity <= item.minimum_quantity ? <span className="inline-flex items-center gap-1 text-amber-400"><AlertTriangle size={15} /> Repor</span> : "OK"}</td></tr>)}</tbody></table></div></div>;
}
