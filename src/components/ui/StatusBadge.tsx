import type { OrderStatus } from "../../types/domain";

const labels: Record<OrderStatus, string> = {
  triage: "Triagem",
  waiting_technician: "Aguardando técnico",
  diagnosis: "Em diagnóstico",
  budget_ready: "Orçamento no Comercial",
  waiting_customer: "Aguardando cliente",
  approved: "Orçamento aprovado",
  in_repair: "Em manutenção",
  waiting_part: "Aguardando peça",
  ready_for_pickup: "Concluído · Comercial",
  delivered: "Entregue",
  cancelled: "Cancelada",
  warranty: "Em garantia",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <span className={`pt-status pt-status-${status}`}>{labels[status]}</span>;
}
