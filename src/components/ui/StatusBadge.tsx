import type { OrderStatus } from '../../types/domain';
const labels:Record<OrderStatus,string>={triage:'Triagem',waiting_technician:'Aguardando técnico',diagnosis:'Diagnóstico',ready_for_commercial:'Pronto p/ comercial',waiting_customer:'Aguardando cliente',approved:'Aprovado',waiting_part:'Aguardando peça',in_repair:'Em execução',quality_check:'Qualidade',ready_for_pickup:'Pronto para entrega',delivered:'Entregue',cancelled:'Cancelado',warranty:'Garantia'};
export function StatusBadge({status}:{status:OrderStatus}){return <span className={`status status-${status}`}>{labels[status]}</span>}
