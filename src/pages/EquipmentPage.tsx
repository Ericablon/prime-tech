import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { usePrimeTech } from "../contexts/PrimeTechContext";
import { can } from "../lib/permissions";

export function EquipmentPage() {
  const { user } = useAuth();
  const { equipment, clients, createEquipment } = usePrimeTech();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ client_id: clients[0]?.id ?? "", category: "Notebook", brand: "", model: "", serial_number: "", accessories: "", notes: "" });
  return <div className="space-y-6"><div className="flex items-end justify-between"><div><h1 className="pt-page-title">Equipamentos</h1><p className="pt-page-subtitle">Prontuário técnico por cliente e número de série.</p></div>{can(user?.role_code, "equipment.manage") && <button className="pt-btn-primary" onClick={() => setOpen((v) => !v)}>+ Novo equipamento</button>}</div>
    {open && <form className="pt-card grid gap-4 md:grid-cols-2" onSubmit={async (e) => { e.preventDefault(); await createEquipment(form); setOpen(false); }}><select className="pt-input" value={form.client_id} onChange={(e) => setForm((s) => ({ ...s, client_id: e.target.value }))}>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select><input className="pt-input" placeholder="Categoria" value={form.category} onChange={(e) => setForm((s) => ({ ...s, category: e.target.value }))} required /><input className="pt-input" placeholder="Marca" value={form.brand} onChange={(e) => setForm((s) => ({ ...s, brand: e.target.value }))} /><input className="pt-input" placeholder="Modelo" value={form.model} onChange={(e) => setForm((s) => ({ ...s, model: e.target.value }))} /><input className="pt-input" placeholder="Número de série" value={form.serial_number} onChange={(e) => setForm((s) => ({ ...s, serial_number: e.target.value }))} /><input className="pt-input" placeholder="Acessórios entregues" value={form.accessories} onChange={(e) => setForm((s) => ({ ...s, accessories: e.target.value }))} /><textarea className="pt-input md:col-span-2" placeholder="Observações / estado físico" value={form.notes} onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))} /><div className="md:col-span-2 flex justify-end"><button className="pt-btn-primary">Salvar equipamento</button></div></form>}
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{equipment.map((eq) => <div className="pt-card" key={eq.id}><p className="text-xs uppercase tracking-wider text-muted">{eq.category}</p><h3 className="mt-1 text-lg font-semibold">{eq.brand} {eq.model}</h3><p className="mt-3 text-sm text-muted">Cliente: {clients.find((c) => c.id === eq.client_id)?.name ?? "—"}</p><p className="mt-1 text-sm text-muted">Série: {eq.serial_number || "—"}</p><p className="mt-1 text-sm text-muted">Acessórios: {eq.accessories || "—"}</p></div>)}</div>
  </div>;
}
