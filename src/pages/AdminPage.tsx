import {
  Building2,
  CheckCircle2,
  Database,
  KeyRound,
  Save,
  Settings2,
  ShieldCheck,
  Users,
} from 'lucide-react';
import {
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { PageHeader } from '../components/ui/PageHeader';
import { useAuth } from '../contexts/AuthContext';
import { usePrimeTech } from '../contexts/PrimeTechContext';
import { defaultPermissions } from '../lib/permissions';
import { supabase } from '../lib/supabase';
import type { Permission, RoleCode } from '../types/domain';

const roleLabels: Record<RoleCode, string> = {
  admin: 'Administrador',
  gestor: 'Gestor',
  atendimento: 'Atendimento (legado)',
  comercial: 'Comercial',
  tecnico: 'Técnico',
  estoque: 'Estoque',
  financeiro: 'Financeiro',
  fiscal: 'Fiscal',
};

const roleCodes: RoleCode[] = [
  'admin',
  'gestor',
  'comercial',
  'atendimento',
  'tecnico',
  'estoque',
  'financeiro',
  'fiscal',
];

function shortId(value?: string | null) {
  if (!value) return 'Não definido';
  return value.length > 12 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value;
}

export function AdminPage({ permissions = false }: { permissions?: boolean }) {
  const { user, mode } = useAuth();
  const {
    company,
    companyId,
    updateCompany,
  } = usePrimeTech();

  const [serverMatrix, setServerMatrix] = useState<Partial<Record<RoleCode, Permission[]>> | null>(null);
  const [matrixError, setMatrixError] = useState('');
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({
    trade_name: company.trade_name ?? 'Prime Tech',
    legal_name: company.legal_name ?? '',
    document: company.document ?? '',
    phone: company.phone ?? '',
    whatsapp: company.whatsapp ?? '',
    email: company.email ?? '',
    address: company.address ?? '',
    budget_validity_days: String(company.budget_validity_days ?? 7),
    warranty_text: company.warranty_text ?? '',
    footer_text: company.footer_text ?? '',
  });

  useEffect(() => {
    setForm({
      trade_name: company.trade_name ?? 'Prime Tech',
      legal_name: company.legal_name ?? '',
      document: company.document ?? '',
      phone: company.phone ?? '',
      whatsapp: company.whatsapp ?? '',
      email: company.email ?? '',
      address: company.address ?? '',
      budget_validity_days: String(company.budget_validity_days ?? 7),
      warranty_text: company.warranty_text ?? '',
      footer_text: company.footer_text ?? '',
    });
  }, [company]);

  useEffect(() => {
    if (!permissions || mode !== 'supabase' || !supabase) {
      setServerMatrix(null);
      return;
    }

    let alive = true;

    const load = async () => {
      setMatrixError('');
      const { data, error } = await supabase
        .from('role_permissions')
        .select('role_code, permission_code');

      if (!alive) return;

      if (error) {
        setMatrixError(error.message);
        setServerMatrix(null);
        return;
      }

      const next: Partial<Record<RoleCode, Permission[]>> = {};

      (data ?? []).forEach((row) => {
        const role = String(row.role_code) as RoleCode;
        const permission = String(row.permission_code) as Permission;
        if (!roleCodes.includes(role)) return;
        next[role] = [...(next[role] ?? []), permission];
      });

      setServerMatrix(next);
    };

    void load();

    return () => {
      alive = false;
    };
  }, [mode, permissions]);

  const effectivePermissions = useMemo(
    () => user?.permissions ?? defaultPermissions[user?.role_code ?? 'atendimento'],
    [user],
  );

  async function submitSettings(event: FormEvent) {
    event.preventDefault();

    const validity = Number.parseInt(form.budget_validity_days, 10);

    if (!form.trade_name.trim()) {
      setLocalError('Informe o nome da empresa.');
      return;
    }

    if (!Number.isFinite(validity) || validity < 1) {
      setLocalError('A validade do orçamento deve ser de pelo menos 1 dia.');
      return;
    }

    setSaving(true);
    setLocalError('');
    setSuccess('');

    try {
      await updateCompany({
        trade_name: form.trade_name.trim(),
        legal_name: form.legal_name.trim() || null,
        document: form.document.trim() || null,
        phone: form.phone.trim() || null,
        whatsapp: form.whatsapp.trim() || null,
        email: form.email.trim() || null,
        address: form.address.trim() || null,
        budget_validity_days: validity,
        warranty_text: form.warranty_text.trim() || null,
        footer_text: form.footer_text.trim() || null,
      });
      setSuccess('Configurações salvas com sucesso.');
    } catch (cause) {
      setLocalError(
        cause instanceof Error
          ? cause.message
          : 'Não foi possível salvar as configurações.',
      );
    } finally {
      setSaving(false);
    }
  }

  if (permissions) {
    return (
      <>
        <PageHeader
          eyebrow="Segurança"
          title="Perfis e permissões"
          description="Matriz efetiva de acesso. A interface respeita o perfil ativo e o banco reforça o isolamento por empresa via RLS."
        />

        {matrixError && (
          <section className="notice" style={{ marginBottom: 16 }}>
            <ShieldCheck size={20} />
            <div>
              <strong>Matriz do banco indisponível</strong>
              <p>{matrixError}. Exibindo o padrão local como referência.</p>
            </div>
          </section>
        )}

        <section className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-head">
            <div>
              <span className="eyebrow">Contexto ativo</span>
              <h2>{user ? roleLabels[user.role_code] : 'Sem usuário'}</h2>
            </div>
            <span className="ghost-button">
              <ShieldCheck size={16} /> {effectivePermissions.length} permissão(ões)
            </span>
          </div>
          <p className="muted">
            Empresa {shortId(user?.company_id ?? companyId)} · Unidade {shortId(user?.branch_id)} · Organização {shortId(user?.organization_id)}
          </p>
        </section>

        <section className="panel">
          <div className="panel-head">
            <div>
              <span className="eyebrow">RBAC</span>
              <h2>Matriz de papéis</h2>
            </div>
            <span className="ghost-button">
              {serverMatrix ? 'Origem: banco' : 'Origem: padrão do app'}
            </span>
          </div>

          <div className="permission-grid">
            {roleCodes.map((role) => {
              const list = serverMatrix?.[role] ?? defaultPermissions[role];
              const isCurrent = user?.role_code === role;

              return (
                <article key={role}>
                  <ShieldCheck />
                  <div style={{ minWidth: 0 }}>
                    <strong>
                      {roleLabels[role]}
                      {isCurrent ? ' · perfil ativo' : ''}
                    </strong>
                    <small>{list.length} permissões</small>
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 6,
                        marginTop: 10,
                      }}
                    >
                      {list.map((permission) => (
                        <span
                          key={permission}
                          className="stock-state ok"
                          style={{ fontSize: 11 }}
                        >
                          {permission}
                        </span>
                      ))}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Administração"
        title="Configurações do Cronos"
        description="Empresa ativa, identidade operacional e fundação SaaS do ambiente atual."
      />

      {(localError || success) && (
        <section className="notice" style={{ marginBottom: 16 }}>
          {success ? <CheckCircle2 size={20} /> : <Settings2 size={20} />}
          <div>
            <strong>{success ? 'Configuração atualizada' : 'Não foi possível salvar'}</strong>
            <p>{success || localError}</p>
          </div>
        </section>
      )}

      <div className="settings-grid">
        <article>
          <Building2 />
          <h3>{company.trade_name || 'Empresa ativa'}</h3>
          <p>{company.legal_name || 'Razão social não informada'}</p>
          <small>Tenant: {shortId(companyId)}</small>
        </article>

        <article>
          <Users />
          <h3>{user?.full_name || 'Usuário atual'}</h3>
          <p>{user ? roleLabels[user.role_code] : 'Perfil não identificado'}</p>
          <small>Unidade: {shortId(user?.branch_id)}</small>
        </article>

        <article>
          <ShieldCheck />
          <h3>Permissões efetivas</h3>
          <p>{effectivePermissions.length} permissões carregadas no perfil ativo.</p>
          <small>RBAC + RLS por empresa</small>
        </article>

        <article>
          <Database />
          <h3>Isolamento SaaS</h3>
          <p>Organização, empresa e unidade fazem parte do contexto de acesso.</p>
          <small>Organização: {shortId(user?.organization_id)}</small>
        </article>

        <article>
          <KeyRound />
          <h3>Fiscal desacoplado</h3>
          <p>Gateway preparado para NF-e/NFS-e sem armazenar segredo no frontend.</p>
          <small>Emissão real depende do provedor configurado.</small>
        </article>

        <article>
          <Settings2 />
          <h3>Protótipo operacional</h3>
          <p>Comercial, técnico, agenda, estoque, financeiro, fiscal e limpeza integrados.</p>
          <small>Base pronta para evolução multiempresa.</small>
        </article>
      </div>

      <section className="panel" style={{ marginTop: 20 }}>
        <div className="panel-head">
          <div>
            <span className="eyebrow">Empresa</span>
            <h2>Dados e parâmetros</h2>
          </div>
        </div>

        <form onSubmit={(event) => void submitSettings(event)} style={{ display: 'grid', gap: 16 }}>
          <div className="form-grid">
            <label>
              <span>Nome fantasia</span>
              <input value={form.trade_name} onChange={(event) => setForm((value) => ({ ...value, trade_name: event.target.value }))} />
            </label>
            <label>
              <span>Razão social</span>
              <input value={form.legal_name} onChange={(event) => setForm((value) => ({ ...value, legal_name: event.target.value }))} />
            </label>
            <label>
              <span>CPF/CNPJ</span>
              <input value={form.document} onChange={(event) => setForm((value) => ({ ...value, document: event.target.value }))} />
            </label>
            <label>
              <span>Telefone</span>
              <input value={form.phone} onChange={(event) => setForm((value) => ({ ...value, phone: event.target.value }))} />
            </label>
            <label>
              <span>WhatsApp</span>
              <input value={form.whatsapp} onChange={(event) => setForm((value) => ({ ...value, whatsapp: event.target.value }))} />
            </label>
            <label>
              <span>E-mail</span>
              <input type="email" value={form.email} onChange={(event) => setForm((value) => ({ ...value, email: event.target.value }))} />
            </label>
            <label style={{ gridColumn: '1 / -1' }}>
              <span>Endereço</span>
              <input value={form.address} onChange={(event) => setForm((value) => ({ ...value, address: event.target.value }))} />
            </label>
            <label>
              <span>Validade padrão do orçamento (dias)</span>
              <input type="number" min="1" step="1" value={form.budget_validity_days} onChange={(event) => setForm((value) => ({ ...value, budget_validity_days: event.target.value }))} />
            </label>
          </div>

          <label style={{ display: 'grid', gap: 6 }}>
            <span>Texto de garantia</span>
            <textarea rows={3} value={form.warranty_text} onChange={(event) => setForm((value) => ({ ...value, warranty_text: event.target.value }))} />
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span>Rodapé de documentos</span>
            <textarea rows={3} value={form.footer_text} onChange={(event) => setForm((value) => ({ ...value, footer_text: event.target.value }))} />
          </label>

          <div className="quick-actions">
            <button type="submit" disabled={saving}>
              <Save size={16} /> {saving ? 'Salvando...' : 'Salvar configurações'}
            </button>
          </div>
        </form>
      </section>
    </>
  );
}
