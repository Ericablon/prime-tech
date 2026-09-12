import { Link } from "react-router-dom";
import { usePrimeTech } from "../contexts/PrimeTechContext";
import { orderCode } from "../lib/formatters";

export function ReportsPage() {
  const { orders } = usePrimeTech();
  return <div className="space-y-6"><div><h1 className="pt-page-title">Relatórios e documentos</h1><p className="pt-page-subtitle">Todos os documentos usam a identidade da Prime Tech e dados centralizados da empresa.</p></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{orders.map((order) => <div key={order.id} className="pt-card"><p className="text-xs text-muted">Ordem de Serviço</p><h3 className="mt-1 text-lg font-semibold">{orderCode(order.order_number)}</h3><div className="mt-4 flex gap-2"><Link target="_blank" to={`/documentos/os/${order.id}`} className="pt-btn-primary">Abrir documento</Link><Link to={`/ordens/${order.id}`} className="pt-btn-secondary">Ver OS</Link></div></div>)}</div></div>;
}
