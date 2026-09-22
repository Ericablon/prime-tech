import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Edit3,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldCheck,
  UserCog,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { PageHeader } from '../components/ui/PageHeader';
import { usePrimeTech } from '../contexts/PrimeTechContext';
import { defaultPermissions } from '../lib/permissions';
import { supabase } from '../lib/supabase';
import type { Permission, RoleCode } from '../types/domain';

const roleLabels: Record<RoleCode, string> = {
  admin: 'Administrador',
  gestor: 'Gestor',
  atendimento: 'Atendimento',
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

const permissionCodes = Array.from(
  new Set(Object.values(defaultPermissions).flat()),
) as Permission[];

type AccessProfile = {
  id: string;
  code: string;
  name: string;
  base_role_code: RoleCode;
  active: boolean;
};

type Editor = {
  kind: 'system' | 'custom' | 'new';
  roleCode: RoleCode;
  profileId: string | null;
  name: string;
  active: boolean;
  permissions: Permission[];
};

const emptyEditor: Editor = {
  kind: 'new',
  roleCode: 'tecnico',
  profileId: null,
  name: '',
  active: true,
  permissions: defaultPermissions.tecnico,
};

function groupLabel(permission: Permission) {
  const prefix = permission.split('.')[0];
  const labels: Record<string, string> = {
    dashboard: 'Dashboard',
    clients: 'Clientes',
    equipment: 'Equipamentos',
    orders: 'Ordens de Serviço',
    stock: 'Estoque',
    finance: 'Financeiro',
    fiscal: 'Fiscal',
    reports: 'Relatórios',
    users: 'Usuários',
    permissions: 'Permissões',
    settings: 'Configurações',
    audit: 'Auditoria',
  };
  return labels[prefix] ?? prefix;
}

export function AccessProfilesPage() {
  const { companyId } = usePrimeTech();
  const [profiles, setProfiles] = useState<AccessProfile[]>([]);
  const [profilePermissions, setProfilePermissions] = useState<Record<string, Permission[]>>({});
  const [rolePermissions, setRolePermissions] = useState<Partial<Record<RoleCode, Permission[]>>>({});
  const [roleOverrides, setRoleOverrides] = useState<Set<RoleCode>>(new Set());
  const [permissionLabels, setPermissionLabels] = useState<Record<string, string>>({});
  const [editor, setEditor] = useState<Editor | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    if (!supabase || !companyId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const [
        permissionsResult,
        baseRoleResult,
        overrideResult,
        companyRoleResult,
        profilesResult,
      ] = await Promise.all([
        supabase.from('permissions').select('code,name').in('code', permissionCodes),
        supabase.from('role_permissions').select('role_code,permission_code'),
        supabase.from('company_role_overrides').select('role_code').eq('company_id', companyId),
        supabase.from('company_role_permissions').select('role_code,permission_code').eq('company_id', companyId),
        supabase.from('access_profiles').select('id,code,name,base_role_code,active').eq('company_id', companyId).order('name'),
      ]);

      const firstError = [
        permissionsResult.error,
        baseRoleResult.error,
        overrideResult.error,
        companyRoleResult.error,
        profilesResult.error,
      ].find(Boolean);
      if (firstError) throw firstError;

      const labels: Record<string, string> = {};
      (permissionsResult.data ?? []).forEach((item) => {
        labels[String(item.code)] = String(item.name ?? item.code);
      });
      setPermissionLabels(labels);

      const base = new Map<RoleCode, Permission[]>();
      (baseRoleResult.data ?? []).forEach((item) => {
        const role = String(item.role_code) as RoleCode;
        const permission = String(item.permission_code) as Permission;
        if (!roleCodes.includes(role) || !permissionCodes.includes(permission)) return;
        base.set(role, [...(base.get(role) ?? []), permission]);
      });

      const overrideSet = new Set<RoleCode>(
        (overrideResult.data ?? []).map((item) => String(item.role_code) as RoleCode),
      );
      setRoleOverrides(overrideSet);

      const companyMap = new Map<RoleCode, Permission[]>();
      (companyRoleResult.data ?? []).forEach((item) => {
        const role = String(item.role_code) as RoleCode;
        const permission = String(item.permission_code) as Permission;
        if (!roleCodes.includes(role) || !permissionCodes.includes(permission)) return;
        companyMap.set(role, [...(companyMap.get(role) ?? []), permission]);
      });

      const effective: Partial<Record<RoleCode, Permission[]>> = {};
      roleCodes.forEach((role) => {
        effective[role] = overrideSet.has(role)
          ? companyMap.get(role) ?? []
          : base.get(role) ?? defaultPermissions[role];
      });
      setRolePermissions(effective);

      const loadedProfiles = (profilesResult.data ?? []) as AccessProfile[];
      setProfiles(loadedProfiles);

      if (loadedProfiles.length) {
        const ids = loadedProfiles.map((item) => item.id);
        const { data, error: profilePermissionError } = await supabase
          .from('access_profile_permissions')
          .select('access_profile_id,permission_code')
          .in('access_profile_id', ids);
        if (profilePermissionError) throw profilePermissionError;

        const map: Record<string, Permission[]> = {};
        (data ?? []).forEach((item) => {
          const id = String(item.access_profile_id);
          const permission = String(item.permission_code) as Permission;
          if (!permissionCodes.includes(permission)) return;
          map[id] = [...(map[id] ?? []), permission];
        });
        setProfilePermissions(map);
      } else {
        setProfilePermissions({});
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Não foi possível carregar os perfis.';
      setError(
        message.includes('access_profiles') || message.includes('company_role_overrides')
          ? 'Execute a migration 0014_cronos_access_profiles_and_notifications.sql no Supabase para habilitar perfis editáveis.'
          : message,
      );
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { void load(); }, [load]);

  const groupedPermissions = useMemo(() => {
    const groups = new Map<string, Permission[]>();
    permissionCodes.forEach((permission) => {
      const label = groupLabel(permission);
      groups.set(label, [...(groups.get(label) ?? []), permission]);
    });
    return Array.from(groups.entries());
  }, []);

  function openSystem(roleCode: RoleCode) {
    setEditor({
      kind: 'system',
      roleCode,
      profileId: null,
      name: roleLabels[roleCode],
      active: true,
      permissions: [...(rolePermissions[roleCode] ?? defaultPermissions[roleCode])],
    });
    setError('');
    setSuccess('');
  }

  function openCustom(profile: AccessProfile) {
    setEditor({
      kind: 'custom',
      roleCode: profile.base_role_code,
      profileId: profile.id,
      name: profile.name,
      active: profile.active,
      permissions: [...(profilePermissions[profile.id] ?? defaultPermissions[profile.base_role_code])],
    });
    setError('');
    setSuccess('');
  }

  function openNew(baseRole: RoleCode = 'tecnico') {
    setEditor({
      ...emptyEditor,
      roleCode: baseRole,
      permissions: [...(rolePermissions[baseRole] ?? defaultPermissions[baseRole])],
    });
    setError('');
    setSuccess('');
  }

  function togglePermission(permission: Permission) {
    if (!editor) return;
    setEditor((current) => {
      if (!current) return current;
      const has = current.permissions.includes(permission);
      return {
        ...current,
        permissions: has
          ? current.permissions.filter((item) => item !== permission)
          : [...current.permissions, permission],
      };
    });
  }

  function changeBaseRole(roleCode: RoleCode) {
    if (!editor || editor.kind === 'system') return;
    setEditor({
      ...editor,
      roleCode,
      permissions: [...(rolePermissions[roleCode] ?? defaultPermissions[roleCode])],
    });
  }

  async function save() {
    if (!editor || !supabase || !companyId) return;
    if (editor.permissions.length === 0) {
      setError('Selecione ao menos uma permissão.');
      return;
    }
    if (editor.kind !== 'system' && !editor.name.trim()) {
      setError('Informe o nome do perfil.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');
    try {
      if (editor.kind === 'system') {
        const { error: saveError } = await supabase.rpc('save_company_role_permissions', {
          p_company: companyId,
          p_role: editor.roleCode,
          p_permissions: editor.permissions,
        });
        if (saveError) throw saveError;
        setSuccess(`Perfil ${roleLabels[editor.roleCode]} atualizado somente para esta empresa.`);
      } else {
        const { error: saveError } = await supabase.rpc('save_access_profile', {
          p_company: companyId,
          p_profile_id: editor.profileId,
          p_name: editor.name.trim(),
          p_base_role: editor.roleCode,
          p_permissions: editor.permissions,
          p_active: editor.active,
        });
        if (saveError) throw saveError;
        setSuccess(editor.profileId ? 'Perfil personalizado atualizado.' : 'Novo perfil personalizado criado.');
      }
      setEditor(null);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar o perfil.');
    } finally {
      setSaving(false);
    }
  }

  async function resetSystem(roleCode: RoleCode) {
    if (!supabase || !companyId) return;
    if (!window.confirm(`Restaurar ${roleLabels[roleCode]} para o conjunto padrão de permissões?`)) return;
    setSaving(true);
    setError('');
    try {
      const { error: resetError } = await supabase.rpc('reset_company_role_permissions', {
        p_company: companyId,
        p_role: roleCode,
      });
      if (resetError) throw resetError;
      setSuccess('Permissões padrão restauradas.');
      setEditor(null);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível restaurar o perfil.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Administração"
        title="Perfis e permissões"
        description="Edite os perfis padrão somente nesta empresa ou crie perfis personalizados, mantendo o tipo operacional necessário para cada módulo."
        actions={(
          <div className="quick-actions">
            <button type="button" className="ghost-button" onClick={() => void load()} disabled={loading}><RefreshCw size={16} /> Atualizar</button>
            <button type="button" className="primary-button" onClick={() => openNew()}><Plus size={16} /> Novo perfil</button>
          </div>
        )}
      />

      {(error || success) && (
        <section className="notice" style={{ marginBottom: 16 }}>
          {error ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />}
          <div><strong>{error ? 'Atenção' : 'Configuração salva'}</strong><p>{error || success}</p></div>
        </section>
      )}

      <section className="notice" style={{ marginBottom: 18 }}>
        <ShieldCheck size={20} />
        <div>
          <strong>Perfil operacional x permissões</strong>
          <p>O tipo base mantém o comportamento do módulo — por exemplo, um perfil baseado em Técnico continua entrando nas filas técnicas. As permissões definem o que esse perfil pode visualizar e alterar.</p>
        </div>
      </section>

      {editor && (
        <section className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-head">
            <div>
              <span className="eyebrow">{editor.kind === 'system' ? 'Editar perfil padrão' : editor.profileId ? 'Editar perfil personalizado' : 'Novo perfil personalizado'}</span>
              <h2>{editor.kind === 'system' ? roleLabels[editor.roleCode] : editor.name || 'Novo perfil'}</h2>
            </div>
            <button type="button" className="ghost-button" onClick={() => setEditor(null)}>Fechar</button>
          </div>

          {editor.kind !== 'system' && (
            <div className="form-grid" style={{ marginBottom: 18 }}>
              <label>
                <span>Nome do perfil</span>
                <input value={editor.name} onChange={(event) => setEditor((value) => value ? { ...value, name: event.target.value } : value)} placeholder="Ex.: Técnico sênior" />
              </label>
              <label>
                <span>Tipo operacional base</span>
                <select value={editor.roleCode} onChange={(event) => changeBaseRole(event.target.value as RoleCode)}>
                  {roleCodes.map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}
                </select>
              </label>
              <label className="ghost-button" style={{ alignSelf: 'end', justifyContent: 'flex-start' }}>
                <input type="checkbox" checked={editor.active} onChange={(event) => setEditor((value) => value ? { ...value, active: event.target.checked } : value)} /> Perfil ativo
              </label>
            </div>
          )}

          <div className="permission-editor-groups">
            {groupedPermissions.map(([group, permissions]) => (
              <article className="permission-editor-group" key={group}>
                <strong>{group}</strong>
                <div>
                  {permissions.map((permission) => {
                    const checked = editor.permissions.includes(permission);
                    const locked = editor.kind === 'system' && editor.roleCode === 'admin' && ['dashboard.view','users.manage','permissions.manage','settings.manage'].includes(permission);
                    return (
                      <label key={permission} className={`permission-check ${checked ? 'checked' : ''}`}>
                        <input type="checkbox" checked={checked} disabled={locked} onChange={() => togglePermission(permission)} />
                        <span><b>{permissionLabels[permission] ?? permission}</b><small>{permission}</small></span>
                      </label>
                    );
                  })}
                </div>
              </article>
            ))}
          </div>

          <div className="quick-actions" style={{ marginTop: 18 }}>
            <button type="button" className="primary-button" disabled={saving} onClick={() => void save()}><Save size={16} /> {saving ? 'Salvando...' : 'Salvar perfil'}</button>
            {editor.kind === 'system' && roleOverrides.has(editor.roleCode) && (
              <button type="button" className="ghost-button" disabled={saving} onClick={() => void resetSystem(editor.roleCode)}><RotateCcw size={16} /> Restaurar padrão</button>
            )}
          </div>
        </section>
      )}

      <section className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-head"><div><span className="eyebrow">Perfis padrão</span><h2>Modelos operacionais da empresa</h2></div></div>
        {loading ? <div className="empty-state"><RefreshCw size={38} /><h3>Carregando perfis</h3></div> : (
          <div className="settings-grid">
            {roleCodes.map((role) => (
              <article key={role}>
                <ShieldCheck />
                <h3>{roleLabels[role]}</h3>
                <p>{(rolePermissions[role] ?? defaultPermissions[role]).length} permissões ativas.</p>
                <small>{roleOverrides.has(role) ? 'Personalizado nesta empresa' : 'Usando padrão do Cronos'}</small>
                <div className="quick-actions" style={{ marginTop: 12 }}>
                  <button type="button" className="ghost-button" onClick={() => openSystem(role)}><Edit3 size={15} /> Editar</button>
                  <button type="button" className="ghost-button" onClick={() => openNew(role)}><Copy size={15} /> Criar derivado</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-head"><div><span className="eyebrow">Perfis personalizados</span><h2>Perfis criados para a operação</h2></div><span className="ghost-button"><UserCog size={16} /> {profiles.length}</span></div>
        {profiles.length === 0 ? (
          <div className="empty-state"><UserCog size={38} /><h3>Nenhum perfil personalizado</h3><p>Crie um perfil para combinar um tipo operacional com permissões específicas.</p></div>
        ) : (
          <div className="table-wrap"><table>
            <thead><tr><th>Perfil</th><th>Base operacional</th><th>Permissões</th><th>Status</th><th>Ação</th></tr></thead>
            <tbody>{profiles.map((profile) => (
              <tr key={profile.id}>
                <td><strong>{profile.name}</strong><small>{profile.code}</small></td>
                <td>{roleLabels[profile.base_role_code] ?? profile.base_role_code}</td>
                <td>{(profilePermissions[profile.id] ?? []).length}</td>
                <td><span className={`stock-state ${profile.active ? 'ok' : 'critical'}`}>{profile.active ? 'Ativo' : 'Inativo'}</span></td>
                <td><button type="button" className="ghost-button" onClick={() => openCustom(profile)}><Edit3 size={15} /> Editar</button></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </section>
    </>
  );
}
