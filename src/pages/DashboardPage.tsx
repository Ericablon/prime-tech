import { BadgeDollarSign, Boxes, CircleCheckBig, Clock3, MonitorCog, Wrench } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { usePrimeTech } from "../contexts/PrimeTechContext";
import { StatCard } from "../components/ui/StatCard";
import { StatusBadge } from "../components/ui/StatusBadge";
import { money, orderCode } from "../lib/formatters";

export function DashboardPage() {
  const { user } = useAuth();
  const { orders, finance, stock } = usePrimeTech();
  const role = user!.role_code;
  const waitingTech = orders.filter((o) => o.status === "waiting_technician").length;
  const waitingCustomer = orders.filter((o) => o.status === "waiting_customer").length;
  const repair = orders.filter((o) => o.status === "in_repair").length;
  const ready = orders.filter((o) => o.status === "ready_for_pickup").length;
  const revenue = finance.filter((f) => f.type === "income").reduce((a, b) => a + b.amount, 0);
  const expenses = finance.filter((f) => f.type === "expense").reduce((a, b) => a + b.amount, 0);
  const lowStock = stock.filter((s) => s.quantity <= s.minimum_quantity).length;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div><h1 className="pt-page-title">Dashboard</h1><p className="pt-page-subtitle">Visão operacional da Prime Tech para o perfil {role}.</p></div>
        {(role === "atendimento" || role === "gestor") ? <Link to="/ordens/nova" className="pt-btn-primary">+ Nova Ordem de Serviço</Link> : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {role === "atendimento" && <>
          <StatCard label="Aguardando técnico" value={waitingTech} icon={<Wrench size={20} />} />
          <StatCard label="Aguardando cliente" value={waitingCustomer} icon={<Clock3 size={20} />} />
          <StatCard label="Em manutenção" value={repair} icon={<MonitorCog size={20} />} />
          <StatCard label="Prontos para retirada" value={ready} icon={<CircleCheckBig size={20} />} />
        </>}
        {role === "tecnico" && <>
          <StatCard label="Fila de diagnóstico" value={waitingTech} icon={<Wrench size={20} />} />
          <StatCard label="Orçamentos aguardando cliente" value={waitingCustomer} icon={<Clock3 size={20} />} />
          <StatCard label="Em manutenção" value={repair} icon={<MonitorCog size={20} />} />
          <StatCard label="Aguardando peça" value={orders.filter((o) => o.status === "waiting_part").length} icon={<Boxes size={20} />} />
        </>}
        {role === "gestor" && <>
          <StatCard label="Receitas registradas" value={money.format(revenue)} icon={<BadgeDollarSign size={20} />} />
          <StatCard label="Resultado simplificado" value={money.format(revenue - expenses)} icon={<BadgeDollarSign size={20} />} />
          <StatCard label="OS em aberto" value={orders.filter((o) => !["delivered", "cancelled"].includes(o.status)).length} icon={<Wrench size={20} />} />
          <StatCard label="Estoque crítico" value={lowStock} icon={<Boxes size={20} />} />
        </>}
      </div>

      <section className="pt-card">
        <div className="mb-4 flex items-center justify-between"><div><h2 className="pt-section-title">Ordens recentes</h2><p className="pt-section-description">Acompanhe o fluxo ponta a ponta.</p></div><Link className="text-sm text-blue-400 hover:underline" to="/ordens">Ver todas</Link></div>
        <div className="overflow-x-auto">
          <table className="pt-table">
            <thead><tr><th>OS</th><th>Entrada</th><th>Problema</th><th>Valor</th><th>Status</th></tr></thead>
            <tbody>{orders.slice(0, 6).map((o) => <tr key={o.id}><td><Link className="font-semibold text-blue-400" to={`/ordens/${o.id}`}>{orderCode(o.order_number)}</Link></td><td>{o.intake_type}</td><td className="max-w-md truncate">{o.reported_issue}</td><td>{money.format(o.total_amount)}</td><td><StatusBadge status={o.status} /></td></tr>)}</tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
