import { AlertTriangle } from "lucide-react";
import { usePrimeTech } from "../contexts/PrimeTechContext";
import { money } from "../lib/formatters";

export function StockPage() {
  const { stock } = usePrimeTech();
  return <div className="space-y-6"><div><h1 className="pt-page-title">Estoque / Peças</h1><p className="pt-page-subtitle">Base pronta para entradas, saídas e baixa automática por OS.</p></div><div className="pt-card overflow-x-auto"><table className="pt-table"><thead><tr><th>SKU</th><th>Item</th><th>Qtd.</th><th>Mínimo</th><th>Custo</th><th>Venda</th><th>Situação</th></tr></thead><tbody>{stock.map((item) => <tr key={item.id}><td>{item.sku}</td><td className="font-medium">{item.name}</td><td>{item.quantity}</td><td>{item.minimum_quantity}</td><td>{money.format(item.cost_price)}</td><td>{money.format(item.sale_price)}</td><td>{item.quantity <= item.minimum_quantity ? <span className="inline-flex items-center gap-1 text-amber-400"><AlertTriangle size={15} /> Repor</span> : "OK"}</td></tr>)}</tbody></table></div></div>;
}
