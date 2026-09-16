import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { usePrimeTech } from "../contexts/PrimeTechContext";
import { can } from "../lib/permissions";
import { money, orderCode, equipmentCode } from "../lib/formatters";
import { StatusBadge } from "../components/ui/StatusBadge";
const queues: Record<string,{label:string;statuses:string[]}>= {
 all:{label:"Todas",statuses:[]}, evaluation:{label:"Técnico · avaliações",statuses:["waiting_technician","diagnosis"]},
 commercial:{label:"Comercial · orçamentos",statuses:["budget_ready"]}, customer:{label:"Aguardando cliente",statuses:["waiting_customer"]},
 repair:{label:"Técnico · manutenção",statuses:["approved","in_repair","waiting_part"]}, delivery:{label:"Comercial · entrega",statuses:["ready_for_pickup"]}, closed:{label:"Finalizadas",statuses:["delivered","cancelled"]}
};
export function OrdersPage(){
 const {user}=useAuth();const {orders,clients,equipment,refresh}=usePrimeTech();
 const [queue,setQueue]=useState(user?.role_code==="tecnico"?"evaluation":user?.role_code==="atendimento"?"commercial":"all");const [search,setSearch]=useState("");
 const filtered=orders.filter(o=>{const eq=equipment.find(e=>e.id===o.equipment_id),c=clients.find(c=>c.id===o.client_id);return (!queues[queue].statuses.length||queues[queue].statuses.includes(o.status))&&[orderCode(o.order_number),equipmentCode(eq?.technical_number),c?.name,eq?.category,eq?.brand,eq?.serial_number,o.reported_issue].join(" ").toLocaleLowerCase().includes(search.toLocaleLowerCase());});
 return <div className="space-y-5"><header className="flex flex-wrap gap-3 items-end justify-between"><div><h1 className="pt-page-title">Comercial e oficina</h1><p className="pt-page-subtitle">Entrada → avaliação → Comercial → aprovação → manutenção → pagamento e entrega.</p></div><div className="flex gap-2"><button className="pt-btn-secondary" onClick={()=>void refresh().catch(()=>{})}>Atualizar filas</button>{can(user,"orders.create")&&<Link to="/ordens/nova" className="pt-btn-primary">+ Entrada de equipamento</Link>}</div></header>
 <div className="flex flex-wrap gap-2">{Object.entries(queues).map(([key,q])=><button key={key} className={queue===key?"pt-btn-primary":"pt-btn-secondary"} onClick={()=>setQueue(key)}>{q.label} ({orders.filter(o=>!q.statuses.length||q.statuses.includes(o.status)).length})</button>)}</div>
 <input className="pt-input" aria-label="Buscar OS ou equipamento" placeholder="Buscar TEC-0001, OS, cliente, série ou problema…" value={search} onChange={e=>setSearch(e.target.value)}/>
 <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filtered.map(o=>{const eq=equipment.find(e=>e.id===o.equipment_id);return <Link className="pt-card block space-y-3" key={o.id} to={`/ordens/${o.id}`}><div className="flex flex-wrap gap-2 justify-between"><strong>{orderCode(o.order_number)}</strong><StatusBadge status={o.status}/></div><h2 className="font-semibold">{equipmentCode(eq?.technical_number)} · {eq?.category} {eq?.brand} {eq?.model}</h2><p>{clients.find(c=>c.id===o.client_id)?.name}</p><p className="text-sm text-muted whitespace-pre-wrap">{o.reported_issue}</p><p className="text-sm">{o.intake_type} · {money.format(o.total_amount)}</p><span className="text-blue-400 text-sm">Abrir atendimento →</span></Link>;})}</div>{!filtered.length&&<p className="pt-card">Nenhuma OS nesta fila. Use as outras etapas ou atualize as filas.</p>}
 </div>;
}
