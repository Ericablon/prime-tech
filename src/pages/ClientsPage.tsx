import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { usePrimeTech } from "../contexts/PrimeTechContext";
import { can } from "../lib/permissions";

export function ClientsPage() {
  const { user } = useAuth();
  const { clients, createClient } = usePrimeTech();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ person_type: "pf" as "pf" | "pj", name: "", document: "", phone: "", email: "", address: "" });
  return <div className="space-y-6"><div className="flex items-end justify-between"><div><h1 className="pt-page-title">Clientes</h1><p className="pt-page-subtitle">Cadastro único para histórico de equipamentos e serviços.</p></div>{can(user?.role_code, "clients.manage") && <button className="pt-btn-primary" onClick={() => setOpen((v) => !v)}>+ Novo cliente</button>}</div>
    {open && <form className="pt-card grid gap-4 md:grid-cols-2" onSubmit={async (e) => { e.preventDefault(); await createClient(form); setOpen(false); setForm({ person_type: "pf", name: "", document: "", phone: "", email: "", address: "" }); }}><select className="pt-input" value={form.person_type} onChange={(e) => setForm((s) => ({ ...s, person_type: e.target.value as "pf" | "pj" }))}><option value="pf">Pessoa Física</option><option value="pj">Pessoa Jurídica</option></select><input className="pt-input" placeholder="Nome / Razão social" value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} required /><input className="pt-input" placeholder="CPF / CNPJ" value={form.document} onChange={(e) => setForm((s) => ({ ...s, document: e.target.value }))} /><input className="pt-input" placeholder="Telefone / WhatsApp" value={form.phone} onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))} /><input className="pt-input" placeholder="E-mail" value={form.email} onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))} /><input className="pt-input" placeholder="Endereço" value={form.address} onChange={(e) => setForm((s) => ({ ...s, address: e.target.value }))} /><div className="md:col-span-2 flex justify-end"><button className="pt-btn-primary">Salvar cliente</button></div></form>}
    <div className="pt-card overflow-x-auto"><table className="pt-table"><thead><tr><th>Nome</th><th>Tipo</th><th>Telefone</th><th>E-mail</th><th>Endereço</th></tr></thead><tbody>{clients.map((c) => <tr key={c.id}><td className="font-medium">{c.name}</td><td>{c.person_type === "pf" ? "PF" : "PJ"}</td><td>{c.phone || "—"}</td><td>{c.email || "—"}</td><td>{c.address || "—"}</td></tr>)}</tbody></table></div>
  </div>;
}
