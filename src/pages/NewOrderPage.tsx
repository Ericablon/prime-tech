import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { usePrimeTech } from "../contexts/PrimeTechContext";
import { can } from "../lib/permissions";
import type { Priority } from "../types/domain";

export function NewOrderPage() {
  const { user } = useAuth();
  const { clients, equipment, createOrder } = usePrimeTech();
  const navigate = useNavigate();
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const clientEquipment = equipment.filter((e) => e.client_id === clientId);
  const [equipmentId, setEquipmentId] = useState(clientEquipment[0]?.id ?? "");
  const [intakeType, setIntakeType] = useState("Orçamento");
  const [priority, setPriority] = useState<Priority>("normal");
  const [issue, setIssue] = useState("");

  if (!can(user, "orders.create")) return <Navigate to="/ordens" replace />;

  return <div className="mx-auto max-w-4xl space-y-6"><div><h1 className="pt-page-title">Nova Ordem de Serviço</h1><p className="pt-page-subtitle">Entrada realizada pelo atendimento. O técnico recebe a OS na fila.</p></div>
    <form className="pt-card grid gap-5 md:grid-cols-2" onSubmit={async (e) => {
      e.preventDefault();
      const order = await createOrder({ client_id: clientId, equipment_id: equipmentId, intake_type: intakeType, reported_issue: issue, priority });
      navigate(`/ordens/${order.id}`);
    }}>
      <div><label className="pt-label">Cliente</label><select className="pt-input" value={clientId} onChange={(e) => { const id = e.target.value; setClientId(id); setEquipmentId(equipment.find((eq) => eq.client_id === id)?.id ?? ""); }}>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
      <div><label className="pt-label">Equipamento</label><select className="pt-input" value={equipmentId} onChange={(e) => setEquipmentId(e.target.value)} required>{equipment.filter((eq) => eq.client_id === clientId).map((eq) => <option key={eq.id} value={eq.id}>{eq.category} • {eq.brand} {eq.model}</option>)}</select></div>
      <div><label className="pt-label">Tipo de entrada</label><select className="pt-input" value={intakeType} onChange={(e) => setIntakeType(e.target.value)}><option>Orçamento</option><option>Manutenção</option><option>Garantia</option><option>Avaliação técnica</option></select></div>
      <div><label className="pt-label">Prioridade</label><select className="pt-input" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}><option value="low">Baixa</option><option value="normal">Normal</option><option value="high">Alta</option><option value="urgent">Urgente</option></select></div>
      <div className="md:col-span-2"><label className="pt-label">Problema informado pelo cliente</label><textarea className="pt-input min-h-32" value={issue} onChange={(e) => setIssue(e.target.value)} required /></div>
      <div className="md:col-span-2 flex justify-end"><button className="pt-btn-primary" disabled={!clientId || !equipmentId}>Gerar Ordem de Serviço</button></div>
    </form>
  </div>;
}
