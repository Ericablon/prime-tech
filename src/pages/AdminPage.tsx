import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { usePrimeTech } from "../contexts/PrimeTechContext";
import { supabase } from "../lib/supabase";
import type { RoleCode, UserProfile } from "../types/domain";

const roles: Array<{ code: RoleCode; label: string }> = [
  { code: "atendimento", label: "Atendimento" },
  { code: "tecnico", label: "Técnico" },
  { code: "gestor", label: "Gestor" },
];
const permissionGroups = [
  ["Operação", ["Gerenciar clientes", "Gerenciar equipamentos", "Abrir OS", "Editar diagnóstico e orçamento", "Registrar aprovação", "Registrar entrega"]],
  ["Gestão", ["Gerenciar estoque", "Gerenciar financeiro", "Gerenciar fiscal", "Ver relatórios", "Administrar usuários e permissões"]],
] as const;

export function AdminPage() {
  const { mode } = useAuth();
  const { company, updateCompany } = usePrimeTech();
  const [form, setForm] = useState(company);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [notice, setNotice] = useState("");
  const [selectedRole, setSelectedRole] = useState<RoleCode>("atendimento");

  const loadProfiles = async () => {
    if (mode === "supabase" && supabase) {
      const { data } = await supabase.from("profiles").select("id, full_name, role_code, active, created_at").order("full_name");
      setProfiles((data ?? []) as UserProfile[]);
    } else setProfiles([
      { id: "demo-atendimento", full_name: "Atendimento Prime Tech", role_code: "atendimento", active: true },
      { id: "demo-tecnico", full_name: "Técnico Prime Tech", role_code: "tecnico", active: true },
      { id: "demo-gestor", full_name: "Gestor Prime Tech", role_code: "gestor", active: true },
    ]);
  };
  useEffect(() => { void loadProfiles(); }, [mode]);
  const updateProfile = async (profile: UserProfile, change: Partial<UserProfile>) => {
    if (mode === "supabase" && supabase) {
      const { error } = await supabase.from("profiles").update(change).eq("id", profile.id);
      if (error) { setNotice(error.message); return; }
    }
    setProfiles((items) => items.map((item) => item.id === profile.id ? { ...item, ...change } : item));
    setNotice("Perfil atualizado.");
  };
  return <div className="space-y-6">
    <div><h1 className="pt-page-title">Administração</h1><p className="pt-page-subtitle">Usuários, colaboradores, papéis e permissões da Prime Tech.</p></div>
    {notice && <div className="rounded-xl border border-blue-400/30 bg-blue-400/10 px-4 py-3 text-sm">{notice}</div>}
    <section className="pt-card space-y-4"><div><h2 className="pt-section-title">Colaboradores e usuários</h2><p className="pt-section-description">O Gestor controla o papel e o status operacional. Senhas devem ser criadas pelo convite seguro do Supabase Auth.</p></div>{mode === "demo" && <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm">Modo demonstração: alterações ficam apenas no navegador.</div>}<div className="overflow-x-auto"><table className="pt-table"><thead><tr><th>Colaborador</th><th>Papel</th><th>Status</th><th>Ação</th></tr></thead><tbody>{profiles.map((profile) => <tr key={profile.id}><td className="font-medium">{profile.full_name}</td><td><select className="pt-input max-w-44" value={profile.role_code} onChange={(event) => void updateProfile(profile, { role_code: event.target.value as RoleCode })}>{roles.map((role) => <option key={role.code} value={role.code}>{role.label}</option>)}</select></td><td><span className={profile.active === false ? "pt-status pt-status-cancelled" : "pt-status pt-status-approved"}>{profile.active === false ? "Inativo" : "Ativo"}</span></td><td><button className="pt-btn-secondary" onClick={() => void updateProfile(profile, { active: profile.active === false })}>{profile.active === false ? "Reativar" : "Desativar"}</button></td></tr>)}</tbody></table></div></section>
    <section className="grid gap-6 lg:grid-cols-[.8fr_1.2fr]"><div className="pt-card space-y-4"><div><h2 className="pt-section-title">Papéis</h2><p className="pt-section-description">Selecione um papel para revisar seu alcance.</p></div>{roles.map((role) => <button key={role.code} className={`w-full rounded-xl border p-3 text-left ${selectedRole === role.code ? "border-blue-400 bg-blue-400/10" : "border-[var(--border)]"}`} onClick={() => setSelectedRole(role.code)}><strong>{role.label}</strong></button>)}</div><div className="pt-card space-y-4"><h2 className="pt-section-title">Permissões de {roles.find((role) => role.code === selectedRole)?.label}</h2>{permissionGroups.map(([title, items]) => <div key={title}><h3 className="mb-2 text-sm font-semibold">{title}</h3><div className="grid gap-2 sm:grid-cols-2">{items.map((item) => <label key={item} className="flex items-center gap-2 rounded-lg border border-[var(--border)] p-2 text-sm"><input type="checkbox" checked={selectedRole === "gestor"} readOnly />{item}</label>)}</div></div>)}</div></section>
    <form className="pt-card grid gap-4 md:grid-cols-2" onSubmit={async (event) => { event.preventDefault(); await updateCompany(form); setNotice("Dados da empresa salvos."); }}><div className="md:col-span-2"><h2 className="pt-section-title">Dados da empresa</h2><p className="pt-section-description">Usados em documentos, orçamentos e relatórios.</p></div><Field label="Nome fantasia" value={form.trade_name} onChange={(value) => setForm((state) => ({ ...state, trade_name: value }))} /><Field label="Razão social" value={form.legal_name ?? ""} onChange={(value) => setForm((state) => ({ ...state, legal_name: value }))} /><Field label="CNPJ" value={form.document ?? ""} onChange={(value) => setForm((state) => ({ ...state, document: value }))} /><Field label="Telefone" value={form.phone ?? ""} onChange={(value) => setForm((state) => ({ ...state, phone: value }))} /><div className="md:col-span-2"><Field label="Endereço" value={form.address ?? ""} onChange={(value) => setForm((state) => ({ ...state, address: value }))} /></div><div className="md:col-span-2 flex justify-end"><button className="pt-btn-primary">Salvar dados da empresa</button></div></form>
  </div>;
}
function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <div><label className="pt-label">{label}</label><input className="pt-input" value={value} onChange={(event) => onChange(event.target.value)} /></div>; }
