import {
  AlertTriangle,
  CheckCircle2,
  Edit3,
  KeyRound,
  MailPlus,
  RefreshCw,
  Save,
  ShieldCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

import { PageHeader } from '../components/ui/PageHeader';
import { useAuth } from '../contexts/AuthContext';
import { usePrimeTech } from '../contexts/PrimeTechContext';
import { useSessionDraft } from '../hooks/useSessionDraft';
import { supabase } from '../lib/supabase';
import type { RoleCode } from '../types/domain';

type AccessProfile = {
  id: string;
  name: string;
  base_role_code: RoleCode;
  active: boolean;
};

type UserRow = {
  userId: string;
  fullName: string;
  email: string;
  roleCode: RoleCode;
  accessProfileId: string | null;
  accessProfileName: string | null;
  active: boolean;
};

type InviteDraft = {
  fullName: string;
  email: string;
  roleCode: RoleCode;
  accessProfileId: string;
};

type EditDraft = {
  userId: string;
  fullName: string;
  email: string;
  roleCode: RoleCode;
  accessProfileId: string;
  active: boolean;
};

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

const selectableRoles: RoleCode[] = ['gestor','comercial','atendimento','tecnico','estoque','financeiro','fiscal','admin'];
const emptyInvite: InviteDraft = { fullName: '', email: '', roleCode: 'tecnico', accessProfileId: '' };

export function UsersPage() {
  const { mode, user } = useAuth();
  const { companyId } = usePrimeTech();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [profiles, setProfiles] = useState<AccessProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [invite, setInvite, clearInvite] = useSessionDraft<InviteDraft>('admin-user-invite', emptyInvite);
  const [editing, setEditing] = useState<EditDraft | null>(null);
  const [passwordTarget, setPasswordTarget] = useState<UserRow | null>(null);
  const [managerPassword, setManagerPassword] = useState('');
  const [managerPasswordConfirm, setManagerPasswordConfirm] = useState('');

  const load = useCallback(async () => {
    if (mode !== 'supabase' || !supabase || !companyId) {
      setRows([]);
      setProfiles([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      let accessData: Array<{ user_id: string; role_code: string; active: boolean; access_profile_id?: string | null }> = [];
      const modernAccess = await supabase
        .from('user_company_access')
        .select('user_id,role_code,active,access_profile_id')
        .eq('company_id', companyId)
        .order('role_code');

      if (!modernAccess.error) {
        accessData = (modernAccess.data ?? []) as typeof accessData;
      } else {
        const legacyAccess = await supabase
          .from('user_company_access')
          .select('user_id,role_code,active')
          .eq('company_id', companyId)
          .order('role_code');
        if (legacyAccess.error) throw legacyAccess.error;
        accessData = (legacyAccess.data ?? []) as typeof accessData;
      }

      let loadedProfiles: AccessProfile[] = [];
      const profilesResult = await supabase
        .from('access_profiles')
        .select('id,name,base_role_code,active')
        .eq('company_id', companyId)
        .order('name');
      if (!profilesResult.error) loadedProfiles = (profilesResult.data ?? []) as AccessProfile[];
      setProfiles(loadedProfiles);
      const profileById = new Map(loadedProfiles.map((profile) => [profile.id, profile]));

      const ids = [...new Set(accessData.map((item) => String(item.user_id)))];
      if (!ids.length) {
        setRows([]);
        return;
      }

      let profileData: Array<{ id: string; full_name?: string | null; email?: string | null }> = [];
      const publicProfiles = await supabase.from('profiles').select('id,full_name,email').in('id', ids);
      if (publicProfiles.error) {
        const fallback = await supabase.from('profiles').select('id,full_name').in('id', ids);
        if (fallback.error) throw fallback.error;
        profileData = (fallback.data ?? []) as typeof profileData;
      } else {
        profileData = (publicProfiles.data ?? []) as typeof profileData;
      }

      const publicById = new Map(profileData.map((profile) => [String(profile.id), profile]));
      setRows(accessData.map((item) => {
        const publicProfile = publicById.get(String(item.user_id));
        const accessProfileId = item.access_profile_id ? String(item.access_profile_id) : null;
        const custom = accessProfileId ? profileById.get(accessProfileId) : undefined;
        return {
          userId: String(item.user_id),
          fullName: String(publicProfile?.full_name ?? 'Usuário'),
          email: String(publicProfile?.email ?? ''),
          roleCode: String(item.role_code) as RoleCode,
          accessProfileId,
          accessProfileName: custom?.name ?? null,
          active: Boolean(item.active),
        };
      }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível carregar os usuários.');
    } finally {
      setLoading(false);
    }
  }, [companyId, mode]);

  useEffect(() => { void load(); }, [load]);

  const counts = useMemo(() => ({
    total: rows.length,
    active: rows.filter((row) => row.active).length,
    tech: rows.filter((row) => row.roleCode === 'tecnico' && row.active).length,
  }), [rows]);

  async function invoke(body: Record<string, unknown>) {
    if (!supabase || !companyId) throw new Error('Supabase ou empresa ativa indisponível.');
    const { data, error: invokeError } = await supabase.functions.invoke('admin-users', {
      body: { ...body, companyId },
    });
    if (invokeError) {
      throw new Error(
        invokeError.message.includes('Failed to send')
          ? 'A Edge Function admin-users ainda não está publicada no Supabase.'
          : invokeError.message,
      );
    }
    const result = data as { error?: string; message?: string } | null;
    if (result?.error) throw new Error(result.error);
    return result;
  }

  function applyProfile(profileId: string, target: 'invite' | 'edit') {
    const profile = profiles.find((item) => item.id === profileId);
    if (target === 'invite') {
      setInvite((current) => ({
        ...current,
        accessProfileId: profileId,
        roleCode: profile?.base_role_code ?? current.roleCode,
      }));
      return;
    }
    setEditing((current) => current ? {
      ...current,
      accessProfileId: profileId,
      roleCode: profile?.base_role_code ?? current.roleCode,
    } : current);
  }

  async function submitInvite(event: FormEvent) {
    event.preventDefault();
    if (!invite.fullName.trim() || !invite.email.trim()) {
      setError('Informe nome e e-mail do novo usuário.');
      return;
    }

    setBusy(true); setError(''); setSuccess('');
    try {
      const redirectTo = `${window.location.origin}${import.meta.env.BASE_URL}redefinir-senha`;
      const result = await invoke({
        action: 'invite',
        fullName: invite.fullName.trim(),
        email: invite.email.trim().toLowerCase(),
        roleCode: invite.roleCode,
        accessProfileId: invite.accessProfileId || null,
        redirectTo,
      });
      clearInvite();
      setInvite(emptyInvite);
      setSuccess(result?.message ?? 'Convite enviado.');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível criar o usuário.');
    } finally { setBusy(false); }
  }

  function openEdit(row: UserRow) {
    setPasswordTarget(null);
    setEditing({
      userId: row.userId,
      fullName: row.fullName,
      email: row.email,
      roleCode: row.roleCode,
      accessProfileId: row.accessProfileId ?? '',
      active: row.active,
    });
    setError('');
    setSuccess('');
  }

  async function saveEdit(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    if (!editing.fullName.trim()) {
      setError('Informe o nome do usuário.');
      return;
    }

    setBusy(true); setError(''); setSuccess('');
    try {
      const result = await invoke({
        action: 'update',
        userId: editing.userId,
        fullName: editing.fullName.trim(),
        roleCode: editing.roleCode,
        accessProfileId: editing.accessProfileId || null,
        active: editing.active,
      });
      setEditing(null);
      setSuccess(result?.message ?? 'Usuário atualizado.');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível atualizar o usuário.');
    } finally { setBusy(false); }
  }

  function openPassword(row: UserRow) {
    if (row.userId === user?.id) {
      setError('Para alterar sua própria senha, use o menu do seu perfil no topo do Cronos.');
      return;
    }
    if (row.roleCode === 'admin' && user?.role_code !== 'admin') {
      setError('Somente um administrador pode definir diretamente a senha de outro administrador.');
      return;
    }
    setEditing(null);
    setPasswordTarget(row);
    setManagerPassword('');
    setManagerPasswordConfirm('');
    setError('');
    setSuccess('');
  }

  function closePassword() {
    setPasswordTarget(null);
    setManagerPassword('');
    setManagerPasswordConfirm('');
  }

  async function setUserPassword(event: FormEvent) {
    event.preventDefault();
    if (!passwordTarget) return;
    if (managerPassword.length < 8) {
      setError('A nova senha deve ter pelo menos 8 caracteres.');
      return;
    }
    if (managerPassword !== managerPasswordConfirm) {
      setError('A confirmação da senha não confere.');
      return;
    }

    setBusy(true); setError(''); setSuccess('');
    try {
      const result = await invoke({
        action: 'set_password',
        userId: passwordTarget.userId,
        password: managerPassword,
      });
      const name = passwordTarget.fullName;
      closePassword();
      setSuccess(result?.message ?? `Senha de ${name} atualizada.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível definir a nova senha.');
    } finally { setBusy(false); }
  }

  async function resetPassword(row: UserRow) {
    if (!row.email) {
      setError('Este usuário ainda não possui e-mail disponível no perfil.');
      return;
    }
    setBusy(true); setError(''); setSuccess('');
    try {
      const redirectTo = `${window.location.origin}${import.meta.env.BASE_URL}redefinir-senha`;
      const result = await invoke({ action: 'reset', email: row.email, redirectTo });
      setSuccess(result?.message ?? `Recuperação enviada para ${row.email}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível enviar a recuperação.');
    } finally { setBusy(false); }
  }

  return <>
    <PageHeader
      eyebrow="Administração"
      title="Usuários e acessos"
      description="Crie, edite, ative ou desative usuários, associe perfis e gerencie credenciais de acesso."
      actions={<button type="button" className="ghost-button" onClick={() => void load()} disabled={loading}><RefreshCw size={16} /> Atualizar</button>}
    />

    {(error || success) && <section className="notice" style={{ marginBottom: 16 }}>
      {error ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />}
      <div><strong>{error ? 'Atenção' : 'Tudo certo'}</strong><p>{error || success}</p></div>
    </section>}

    <div className="metrics-grid">
      <article className="metric-card"><div className="metric-icon"><Users /></div><span>Usuários</span><strong>{counts.total}</strong><small>Vinculados à empresa</small></article>
      <article className="metric-card green"><div className="metric-icon"><ShieldCheck /></div><span>Ativos</span><strong>{counts.active}</strong><small>Acesso habilitado</small></article>
      <article className="metric-card"><div className="metric-icon"><UserPlus /></div><span>Técnicos</span><strong>{counts.tech}</strong><small>Perfis técnicos ativos</small></article>
    </div>

    {editing && (
      <section className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-head"><div><span className="eyebrow">Editar usuário</span><h2>{editing.fullName}</h2></div><button type="button" className="ghost-button" onClick={() => setEditing(null)}><X size={15} /> Fechar</button></div>
        <form onSubmit={(event) => void saveEdit(event)} style={{ display: 'grid', gap: 14 }}>
          <div className="form-grid">
            <label><span>Nome completo</span><input value={editing.fullName} onChange={(event) => setEditing((value) => value ? { ...value, fullName: event.target.value } : value)} /></label>
            <label><span>E-mail</span><input value={editing.email} disabled /></label>
            <label><span>Perfil personalizado</span><select value={editing.accessProfileId} onChange={(event) => applyProfile(event.target.value, 'edit')}><option value="">Usar perfil padrão</option>{profiles.filter((profile) => profile.active).map((profile) => <option key={profile.id} value={profile.id}>{profile.name} · base {roleLabels[profile.base_role_code]}</option>)}</select></label>
            {!editing.accessProfileId && <label><span>Perfil padrão</span><select value={editing.roleCode} disabled={editing.userId === user?.id} onChange={(event) => setEditing((value) => value ? { ...value, roleCode: event.target.value as RoleCode } : value)}>{selectableRoles.map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}</select></label>}
            <label className="ghost-button" style={{ alignSelf: 'end', justifyContent: 'flex-start' }}><input type="checkbox" checked={editing.active} disabled={editing.userId === user?.id} onChange={(event) => setEditing((value) => value ? { ...value, active: event.target.checked } : value)} /> Acesso ativo</label>
          </div>
          {editing.userId === user?.id && <div className="notice" style={{ marginBottom: 0 }}><ShieldCheck size={18} /><div><strong>Seu próprio acesso está protegido</strong><p>Você pode alterar seu nome, mas não pode trocar o próprio perfil ou desativar sua conta por esta tela.</p></div></div>}
          <div className="quick-actions"><button type="submit" className="primary-button" disabled={busy}><Save size={16} /> {busy ? 'Salvando...' : 'Salvar usuário'}</button></div>
        </form>
      </section>
    )}

    {passwordTarget && (
      <section className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-head">
          <div><span className="eyebrow">Credencial interna</span><h2>Definir senha de {passwordTarget.fullName}</h2><p className="muted">{passwordTarget.email || 'Usuário sem e-mail exibido'}</p></div>
          <button type="button" className="ghost-button" onClick={closePassword}><X size={15} /> Fechar</button>
        </div>
        <form onSubmit={(event) => void setUserPassword(event)} style={{ display: 'grid', gap: 14 }}>
          <div className="form-grid">
            <label><span>Nova senha</span><input type="password" minLength={8} autoComplete="new-password" value={managerPassword} onChange={(event) => setManagerPassword(event.target.value)} required /></label>
            <label><span>Confirmar nova senha</span><input type="password" minLength={8} autoComplete="new-password" value={managerPasswordConfirm} onChange={(event) => setManagerPasswordConfirm(event.target.value)} required /></label>
          </div>
          <div className="notice" style={{ marginBottom: 0 }}><KeyRound size={18} /><div><strong>Senha definida pelo gestor</strong><p>Informe a nova senha ao usuário por um canal seguro. O Cronos nunca exibe a senha atual.</p></div></div>
          <div className="quick-actions"><button type="submit" className="primary-button" disabled={busy || managerPassword.length < 8 || managerPassword !== managerPasswordConfirm}><Save size={16} /> {busy ? 'Alterando...' : 'Definir nova senha'}</button><button type="button" className="ghost-button" onClick={closePassword}>Cancelar</button></div>
        </form>
      </section>
    )}

    <section className="panel" style={{ marginBottom: 20 }}>
      <div className="panel-head"><div><span className="eyebrow">Novo acesso</span><h2>Convidar usuário</h2></div><MailPlus /></div>
      <form onSubmit={(event) => void submitInvite(event)} style={{ display: 'grid', gap: 14 }}>
        <div className="form-grid">
          <label><span>Nome completo</span><input value={invite.fullName} onChange={(e) => setInvite((v) => ({ ...v, fullName: e.target.value }))} placeholder="Nome do colaborador" /></label>
          <label><span>E-mail</span><input type="email" value={invite.email} onChange={(e) => setInvite((v) => ({ ...v, email: e.target.value }))} placeholder="usuario@empresa.com.br" /></label>
          <label><span>Perfil personalizado</span><select value={invite.accessProfileId ?? ''} onChange={(event) => applyProfile(event.target.value, 'invite')}><option value="">Usar perfil padrão</option>{profiles.filter((profile) => profile.active).map((profile) => <option key={profile.id} value={profile.id}>{profile.name} · base {roleLabels[profile.base_role_code]}</option>)}</select></label>
          {!invite.accessProfileId && <label><span>Perfil padrão</span><select value={invite.roleCode} onChange={(e) => setInvite((v) => ({ ...v, roleCode: e.target.value as RoleCode }))}>{selectableRoles.map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}</select></label>}
        </div>
        <div className="notice" style={{ marginBottom: 0 }}><ShieldCheck size={18} /><div><strong>Sem senha compartilhada no convite</strong><p>O fluxo de convite por e-mail continua disponível; a definição direta de senha é uma opção administrativa separada.</p></div></div>
        <div className="quick-actions"><button type="submit" disabled={busy}><UserPlus size={16} /> {busy ? 'Enviando...' : 'Criar usuário e enviar convite'}</button></div>
      </form>
    </section>

    <section className="panel">
      <div className="panel-head"><div><span className="eyebrow">Equipe</span><h2>Acessos cadastrados</h2></div></div>
      {loading ? <div className="empty-state"><RefreshCw size={38} /><h3>Carregando usuários</h3></div> : rows.length === 0 ? <div className="empty-state"><Users size={38} /><h3>Nenhum usuário encontrado</h3></div> : <div className="table-wrap"><table>
        <thead><tr><th>Usuário</th><th>E-mail</th><th>Perfil</th><th>Tipo operacional</th><th>Status</th><th>Ações</th></tr></thead>
        <tbody>{rows.map((row) => <tr key={`${row.userId}-${row.roleCode}`}>
          <td><strong>{row.fullName}</strong></td>
          <td>{row.email || '—'}</td>
          <td><strong>{row.accessProfileName ?? roleLabels[row.roleCode] ?? row.roleCode}</strong><small>{row.accessProfileName ? 'Personalizado' : 'Padrão'}</small></td>
          <td>{roleLabels[row.roleCode] ?? row.roleCode}</td>
          <td><span className={`stock-state ${row.active ? 'ok' : 'critical'}`}>{row.active ? 'Ativo' : 'Inativo'}</span></td>
          <td><div className="quick-actions">
            <button type="button" className="ghost-button" disabled={busy} onClick={() => openEdit(row)}><Edit3 size={15} /> Editar</button>
            {row.userId !== user?.id && !(row.roleCode === 'admin' && user?.role_code !== 'admin') && <button type="button" className="ghost-button" disabled={busy} onClick={() => openPassword(row)}><KeyRound size={15} /> Definir senha</button>}
            <button type="button" className="ghost-button" disabled={busy || !row.email} onClick={() => void resetPassword(row)}><MailPlus size={15} /> Enviar recuperação</button>
          </div></td>
        </tr>)}</tbody>
      </table></div>}
    </section>
  </>;
}
