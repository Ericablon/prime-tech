import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { usePrimeTech } from "../contexts/PrimeTechContext";
import { supabase } from "../lib/supabase";
import { defaultPermissions, type Permission } from "../lib/permissions";
import type { RoleCode, UserProfile } from "../types/domain";

const roles: Array<{ code: RoleCode; label: string }> = [
  { code: "atendimento", label: "Comercial" }, { code: "tecnico", label: "Técnico" }, { code: "gestor", label: "Gestor" },
];
const labels: Record<Permission, string> = {
  "dashboard.view": "Acessar painel", "clients.view": "Ver clientes", "clients.manage": "Gerenciar clientes",
  "equipment.view": "Ver equipamentos", "equipment.manage": "Gerenciar equipamentos", "orders.view": "Ver ordens de serviço",
  "orders.create": "Abrir OS", "orders.tech": "Diagnóstico e manutenção", "orders.customer_approval": "Registrar aprovação",
  "orders.delivery": "Registrar entrega", "stock.view": "Ver estoque", "stock.manage": "Gerenciar estoque",
  "finance.view": "Ver financeiro", "finance.manage": "Gerenciar financeiro", "fiscal.view": "Ver fiscal",
  "fiscal.manage": "Gerenciar fiscal", "reports.view": "Ver relatórios", "admin.manage": "Administrar usuários e permissões",
};
const fields = [
  ["trade_name", "Nome fantasia"], ["legal_name", "Razão social"], ["document", "CNPJ"],
  ["state_registration", "Inscrição estadual"], ["municipal_registration", "Inscrição municipal"],
  ["phone", "Telefone"], ["whatsapp", "WhatsApp"], ["email", "E-mail"], ["address", "Endereço"],
  ["instagram", "Instagram"], ["logo_url", "Endereço da logo"], ["warranty_text", "Texto de garantia"], ["footer_text", "Rodapé dos documentos"],
] as const;
type Grants = Record<RoleCode, Permission[]>;
const message = (error: unknown) => error && typeof error === "object" && "message" in error ? String(error.message) : "Não foi possível salvar. Tente novamente.";

export function AdminPage() {
  const { mode, user } = useAuth();
  const { company, updateCompany } = usePrimeTech();
  const [form, setForm] = useState(company);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [grants, setGrants] = useState<Grants>(defaultPermissions);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [selectedRole, setSelectedRole] = useState<RoleCode>("atendimento");
  const [search, setSearch] = useState("");
  useEffect(() => { setForm(company); }, [company]);
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        if (mode === "supabase" && supabase) {
          const [people, permissions] = await Promise.all([
            supabase.from("profiles").select("id,full_name,role_code,active,email,job_title,phone,created_at").order("full_name"),
            supabase.from("role_permissions").select("role_code,permission_code"),
          ]);
          if (people.error) throw people.error;
          if (permissions.error) throw permissions.error;
          if (!active) return;
          setProfiles(people.data as UserProfile[]);
          const next: Grants = { atendimento: [], tecnico: [], gestor: [] };
          for (const grant of permissions.data) next[grant.role_code as RoleCode]?.push(grant.permission_code as Permission);
          setGrants(next);
        } else {
          setProfiles(roles.map((role) => ({ id: `demo-${role.code}`, full_name: `${role.label} Prime Tech`, role_code: role.code, active: true })));
        }
        if (active) setLoaded(true);
      } catch (error) { if (active) setNotice(message(error)); }
    }
    void load();
    return () => { active = false; };
  }, [mode]);
  async function updateProfile(profile: UserProfile, change: Partial<UserProfile>) {
    setBusy(true); setNotice("");
    try {
      let updated = { ...profile, ...change };
      if (mode === "supabase" && supabase) {
        const result = await supabase.from("profiles").update(change).eq("id", profile.id).select("id,full_name,role_code,active,email,job_title,phone,created_at").single();
        if (result.error) throw result.error;
        updated = result.data as UserProfile;
      }
      setProfiles((items) => items.map((item) => item.id === profile.id ? updated : item));
      setNotice(mode === "demo" ? "Demonstração atualizada nesta tela." : "Colaborador atualizado.");
    } catch (error) { setNotice(message(error)); } finally { setBusy(false); }
  }
  function toggle(permission: Permission, checked: boolean) {
    setGrants((current) => {
      const next = new Set(current[selectedRole]);
      if (checked) {
        next.add(permission);
        const [module] = permission.split(".");
        if (module === "orders" || permission.endsWith(".manage")) next.add(`${module}.view` as Permission);
      } else {
        next.delete(permission);
        if (permission.endsWith(".view")) for (const code of next) if (code.split(".")[0] === permission.split(".")[0]) next.delete(code);
      }
      return { ...current, [selectedRole]: [...next] };
    });
  }
  async function savePermissions() {
    setBusy(true); setNotice("");
    try {
      if (mode === "supabase" && supabase) {
        const { error } = await supabase.rpc("save_role_permissions", { p_role: selectedRole, p_permissions: grants[selectedRole] });
        if (error) throw error;
      }
      setNotice(mode === "demo" ? "Simulação nesta tela. Entre no ambiente conectado para salvar permissões reais." : "Permissões salvas. O banco já aplica os novos acessos.");
    } catch (error) { setNotice(message(error)); } finally { setBusy(false); }
  }
  return <div className="space-y-6">
    <div><h1 className="pt-page-title">Administração</h1><p className="pt-page-subtitle">Colaboradores, usuários e permissões da Prime Tech.</p></div>
    {notice && <div role="status" className="rounded-xl border border-blue-400/30 bg-blue-400/10 px-4 py-3 text-sm">{notice}</div>}
    {mode === "demo" && <p className="rounded-xl bg-amber-400/10 p-4 text-sm">Demonstração: as alterações de acesso são uma simulação e duram apenas nesta tela.</p>}
    <section className="pt-card space-y-4">
      <div><h2 className="pt-section-title">Colaboradores e usuários</h2><p className="pt-section-description">Novos acessos são cadastrados no Supabase Auth durante esta fase de desenvolvimento. Depois, o Gestor define o papel e ativa o colaborador aqui.</p></div>
      <label className="block"><span className="pt-label">Buscar colaborador</span><input className="pt-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nome ou e-mail" /></label>
      <div className="overflow-x-auto"><table className="pt-table"><thead><tr><th>Colaborador</th><th>Papel</th><th>Status</th><th>Ação</th></tr></thead><tbody>
        {profiles.filter((profile) => `${profile.full_name} ${profile.email ?? ""}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())).map((profile) => <tr key={profile.id}>
          <td><strong>{profile.full_name}</strong><small className="block text-muted">{profile.email || "E-mail não informado"}</small>{profile.job_title && <small className="block">{profile.job_title}</small>}</td>
          <td><select aria-label={`Papel de ${profile.full_name}`} className="pt-input max-w-44" disabled={busy || profile.id === user?.id} value={profile.role_code} onChange={(e) => void updateProfile(profile, { role_code: e.target.value as RoleCode })}>{roles.map((role) => <option key={role.code} value={role.code}>{role.label}</option>)}</select></td>
          <td>{profile.active ? "Ativo" : "Pendente / inativo"}</td>
          <td><button className="pt-btn-secondary" disabled={busy || profile.id === user?.id} onClick={() => void updateProfile(profile, { active: !profile.active })}>{profile.id === user?.id ? "Seu acesso" : profile.active ? "Desativar" : "Ativar"}</button></td>
        </tr>)}
        {!profiles.length && <tr><td colSpan={4}>{loaded ? "Nenhum colaborador cadastrado." : "Carregando colaboradores…"}</td></tr>}
      </tbody></table></div>
    </section>
    <section className="pt-card space-y-4"><div><h2 className="pt-section-title">Permissões por papel</h2><p className="pt-section-description">As mudanças afetam todos os colaboradores do papel selecionado.</p></div>
      <div className="flex flex-wrap gap-2">{roles.map((role) => <button key={role.code} disabled={busy} className={selectedRole === role.code ? "pt-btn-primary" : "pt-btn-secondary"} onClick={() => setSelectedRole(role.code)}>{role.label}</button>)}</div>
      {selectedRole === "gestor" && <p className="text-sm text-muted">O Gestor mantém acesso completo à administração.</p>}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{(Object.keys(labels) as Permission[]).map((permission) => <label key={permission} className="flex items-center gap-2 rounded-lg border border-[var(--border)] p-3 text-sm"><input type="checkbox" disabled={!loaded || busy || selectedRole === "gestor" || permission === "admin.manage" || permission === "dashboard.view"} checked={grants[selectedRole].includes(permission)} onChange={(e) => toggle(permission, e.target.checked)} />{labels[permission]}</label>)}</div>
      {selectedRole !== "gestor" && <button className="pt-btn-primary" disabled={!loaded || busy} onClick={() => void savePermissions()}>Salvar permissões</button>}
    </section>
    <form className="pt-card grid gap-4 md:grid-cols-2" onSubmit={async (event) => {
      event.preventDefault(); setBusy(true); setNotice("");
      try { await updateCompany(form); setNotice("Dados da empresa salvos."); } catch (error) { setNotice(message(error)); } finally { setBusy(false); }
    }}>
      <div className="md:col-span-2"><h2 className="pt-section-title">Dados da empresa</h2><p className="pt-section-description">Usados nos documentos, orçamentos e relatórios.</p></div>
      {fields.map(([key, label]) => <label key={key}><span className="pt-label">{label}</span><input className="pt-input" required={key === "trade_name"} value={form[key] ?? ""} onChange={(e) => setForm((current) => ({ ...current, [key]: e.target.value }))} /></label>)}
      <label><span className="pt-label">Validade do orçamento (dias)</span><input className="pt-input" type="number" min="1" max="365" required value={form.budget_validity_days} onChange={(e) => setForm((current) => ({ ...current, budget_validity_days: Number(e.target.value) }))} /></label>
      <div className="md:col-span-2 flex justify-end"><button disabled={busy} className="pt-btn-primary">Salvar dados da empresa</button></div>
    </form>
  </div>;
}

