import { AlertTriangle, CheckCircle2, KeyRound, MailPlus, RefreshCw, ShieldCheck, UserPlus, Users } from 'lucide-react';
import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

import { PageHeader } from '../components/ui/PageHeader';
import { useAuth } from '../contexts/AuthContext';
import { usePrimeTech } from '../contexts/PrimeTechContext';
import { useSessionDraft } from '../hooks/useSessionDraft';
import { supabase } from '../lib/supabase';
import type { RoleCode } from '../types/domain';

type UserRow = {
  userId: string;
  fullName: string;
  email: string;
  roleCode: RoleCode;
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

const emptyInvite = { fullName: '', email: '', roleCode: 'tecnico' as RoleCode };

export function UsersPage() {
  const { mode } = useAuth();
  const { companyId } = usePrimeTech();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [invite, setInvite, clearInvite] = useSessionDraft('admin-user-invite', emptyInvite);

  const load = useCallback(async () => {
    if (mode !== 'supabase' || !supabase || !companyId) {
      setRows([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const { data: access, error: accessError } = await supabase
        .from('user_company_access')
        .select('user_id, role_code, active')
        .eq('company_id', companyId)
        .order('role_code');
      if (accessError) throw accessError;

      const ids = [...new Set((access ?? []).map((item) => String(item.user_id)))];
      if (!ids.length) {
        setRows([]);
        return;
      }

      let profiles: Array<{ id: string; full_name?: string | null; email?: string | null }> = [];
      const profileResult = await supabase.from('profiles').select('id, full_name, email').in('id', ids);
      if (profileResult.error) {
        const fallback = await supabase.from('profiles').select('id, full_name').in('id', ids);
        if (fallback.error) throw fallback.error;
        profiles = (fallback.data ?? []) as Array<{ id: string; full_name?: string | null; email?: string | null }>;
      } else {
        profiles = (profileResult.data ?? []) as Array<{ id: string; full_name?: string | null; email?: string | null }>;
      }

      const profileById = new Map(profiles.map((profile) => [String(profile.id), profile]));
      setRows((access ?? []).map((item) => {
        const profile = profileById.get(String(item.user_id));
        return {
          userId: String(item.user_id),
          fullName: String(profile?.full_name ?? 'Usuário'),
          email: String(profile?.email ?? ''),
          roleCode: String(item.role_code) as RoleCode,
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
    if (invokeError) throw invokeError;
    const result = data as { error?: string; message?: string } | null;
    if (result?.error) throw new Error(result.error);
    return result;
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
        redirectTo,
      });
      clearInvite();
      setSuccess(result?.message ?? 'Convite enviado.');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível criar o usuário.');
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
      description="Crie usuários, defina o perfil de trabalho e envie convite ou recuperação de senha sem compartilhar senhas."
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

    <section className="panel" style={{ marginBottom: 20 }}>
      <div className="panel-head"><div><span className="eyebrow">Novo acesso</span><h2>Convidar usuário</h2></div><MailPlus /></div>
      <form onSubmit={(event) => void submitInvite(event)} style={{ display: 'grid', gap: 14 }}>
        <div className="form-grid">
          <label><span>Nome completo</span><input value={invite.fullName} onChange={(e) => setInvite((v) => ({ ...v, fullName: e.target.value }))} placeholder="Nome do colaborador" /></label>
          <label><span>E-mail</span><input type="email" value={invite.email} onChange={(e) => setInvite((v) => ({ ...v, email: e.target.value }))} placeholder="usuario@empresa.com.br" /></label>
          <label><span>Perfil</span><select value={invite.roleCode} onChange={(e) => setInvite((v) => ({ ...v, roleCode: e.target.value as RoleCode }))}>{selectableRoles.map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}</select></label>
        </div>
        <div className="notice" style={{ marginBottom: 0 }}><ShieldCheck size={18} /><div><strong>Sem senha compartilhada</strong><p>O usuário recebe o convite por e-mail e cria a própria senha na tela segura do Cronos.</p></div></div>
        <div className="quick-actions"><button type="submit" disabled={busy}><UserPlus size={16} /> {busy ? 'Enviando...' : 'Criar usuário e enviar convite'}</button></div>
      </form>
    </section>

    <section className="panel">
      <div className="panel-head"><div><span className="eyebrow">Equipe</span><h2>Acessos cadastrados</h2></div></div>
      {loading ? <div className="empty-state"><RefreshCw size={38} /><h3>Carregando usuários</h3></div> : rows.length === 0 ? <div className="empty-state"><Users size={38} /><h3>Nenhum usuário encontrado</h3></div> : <div className="table-wrap"><table>
        <thead><tr><th>Usuário</th><th>E-mail</th><th>Perfil</th><th>Status</th><th>Ações</th></tr></thead>
        <tbody>{rows.map((row) => <tr key={`${row.userId}-${row.roleCode}`}>
          <td><strong>{row.fullName}</strong></td>
          <td>{row.email || '—'}</td>
          <td>{roleLabels[row.roleCode] ?? row.roleCode}</td>
          <td><span className={`stock-state ${row.active ? 'ok' : 'critical'}`}>{row.active ? 'Ativo' : 'Inativo'}</span></td>
          <td><button type="button" className="ghost-button" disabled={busy || !row.email} onClick={() => void resetPassword(row)}><KeyRound size={15} /> Enviar redefinição</button></td>
        </tr>)}</tbody>
      </table></div>}
    </section>
  </>;
}
