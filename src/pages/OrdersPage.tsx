import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { usePrimeTech } from "../contexts/PrimeTechContext";
import { can } from "../lib/permissions";
import { money, orderCode, shortDate } from "../lib/formatters";
import { StatusBadge } from "../components/ui/StatusBadge";

export function OrdersPage() {
  const { user } = useAuth();
  const { orders, clients, equipment } = usePrimeTech();

  return <div className="space-y-6">
    <div className="flex items-end justify-between"><div><h1 className="pt-page-title">Ordens de Serviço</h1><p className="pt-page-subtitle">Fluxo de entrada, orçamento, manutenção e entrega.</p></div>{can(user, "orders.create") && <Link to="/ordens/nova" className="pt-btn-primary">+ Nova OS</Link>}</div>
    <div className="pt-card overflow-x-auto"><table className="pt-table"><thead><tr><th>OS</th><th>Cliente</th><th>Equipamento</th><th>Entrada</th><th>Valor</th><th>Status</th><th>Data</th></tr></thead><tbody>
      {orders.map((o) => {
        const client = clients.find((c) => c.id === o.client_id);
        const eq = equipment.find((e) => e.id === o.equipment_id);
        return <tr key={o.id}><td><Link to={`/ordens/${o.id}`} className="font-semibold text-blue-400">{orderCode(o.order_number)}</Link></td><td>{client?.name ?? "—"}</td><td>{[eq?.category, eq?.brand, eq?.model].filter(Boolean).join(" • ")}</td><td>{o.intake_type}</td><td>{money.format(o.total_amount)}</td><td><StatusBadge status={o.status} /></td><td>{shortDate.format(new Date(o.created_at))}</td></tr>;
      })}
    </tbody></table></div>
  </div>;
}
