import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type RoleCode = 'admin' | 'gestor' | 'atendimento' | 'comercial' | 'tecnico' | 'estoque' | 'financeiro' | 'fiscal';

type RequestBody = {
  action: 'invite' | 'reset' | 'update';
  companyId: string;
  email?: string;
  userId?: string;
  fullName?: string;
  roleCode?: RoleCode;
  accessProfileId?: string | null;
  active?: boolean;
  redirectTo?: string;
};

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return json({ error: 'Ambiente Supabase incompleto.' }, 500);
    }

    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'Sessão não informada.' }, 401);

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: authData, error: authError } = await callerClient.auth.getUser(token);
    if (authError || !authData.user) return json({ error: 'Sessão inválida.' }, 401);

    const body = await req.json() as RequestBody;
    if (!body.companyId) return json({ error: 'Empresa obrigatória.' }, 400);

    const { data: callerAccess, error: accessError } = await admin
      .from('user_company_access')
      .select('role_code, active')
      .eq('user_id', authData.user.id)
      .eq('company_id', body.companyId)
      .eq('active', true)
      .limit(1)
      .maybeSingle();
    if (accessError) throw accessError;
    if (!callerAccess) return json({ error: 'Usuário sem acesso à empresa.' }, 403);

    const { data: directPermission, error: directPermissionError } = await callerClient.rpc(
      'has_company_permission_public',
      { p_company: body.companyId, p_permission: 'users.manage' },
    );

    let canManage = directPermission === true && !directPermissionError;
    if (!canManage) {
      const { data: permission, error: permissionError } = await admin
        .from('role_permissions')
        .select('permission_code')
        .eq('role_code', String(callerAccess.role_code))
        .eq('permission_code', 'users.manage')
        .maybeSingle();
      if (permissionError) throw permissionError;
      canManage = Boolean(permission);
    }
    if (!canManage) return json({ error: 'Seu perfil não pode gerenciar usuários.' }, 403);

    const allowedRoles: RoleCode[] = ['admin','gestor','atendimento','comercial','tecnico','estoque','financeiro','fiscal'];

    async function resolveProfile() {
      const requestedRole = body.roleCode ?? 'atendimento';
      if (!allowedRoles.includes(requestedRole)) throw new Error('Perfil base inválido.');

      if (!body.accessProfileId) {
        return { roleCode: requestedRole, accessProfileId: null as string | null };
      }

      const { data: profile, error: profileError } = await admin
        .from('access_profiles')
        .select('id,base_role_code,active')
        .eq('id', body.accessProfileId)
        .eq('company_id', body.companyId)
        .maybeSingle();
      if (profileError) throw profileError;
      if (!profile || !profile.active) throw new Error('Perfil personalizado inválido ou inativo.');

      const baseRole = String(profile.base_role_code) as RoleCode;
      if (!allowedRoles.includes(baseRole)) throw new Error('Tipo operacional do perfil é inválido.');
      return { roleCode: baseRole, accessProfileId: String(profile.id) };
    }

    if (body.action === 'reset') {
      const email = body.email?.trim().toLowerCase();
      if (!email) return json({ error: 'E-mail obrigatório.' }, 400);
      const redirectTo = body.redirectTo?.trim() || undefined;
      const { error } = await admin.auth.resetPasswordForEmail(email, redirectTo ? { redirectTo } : undefined);
      if (error) throw error;
      return json({ ok: true, message: 'Recuperação de senha enviada.' });
    }

    if (body.action === 'update') {
      if (!body.userId || !body.fullName?.trim()) {
        return json({ error: 'Usuário e nome são obrigatórios.' }, 400);
      }

      const resolved = await resolveProfile();
      const { data: targetAccess, error: targetError } = await admin
        .from('user_company_access')
        .select('role_code,access_profile_id,active')
        .eq('user_id', body.userId)
        .eq('company_id', body.companyId)
        .limit(1)
        .maybeSingle();
      if (targetError) throw targetError;
      if (!targetAccess) return json({ error: 'Usuário não está vinculado a esta empresa.' }, 404);

      const nextActive = body.active !== false;
      if (body.userId === authData.user.id) {
        const changedAccess = String(targetAccess.role_code) !== resolved.roleCode
          || String(targetAccess.access_profile_id ?? '') !== String(resolved.accessProfileId ?? '')
          || Boolean(targetAccess.active) !== nextActive;
        if (changedAccess) {
          return json({ error: 'Você pode editar seu nome, mas não pode alterar ou desativar o próprio acesso.' }, 409);
        }
      }

      const { error: authUpdateError } = await admin.auth.admin.updateUserById(body.userId, {
        user_metadata: { full_name: body.fullName.trim(), role_code: resolved.roleCode },
        app_metadata: { role_code: resolved.roleCode },
      });
      if (authUpdateError) throw authUpdateError;

      const { error: profileUpdateError } = await admin
        .from('profiles')
        .update({
          full_name: body.fullName.trim(),
          role_code: resolved.roleCode,
          active: nextActive,
          updated_at: new Date().toISOString(),
        })
        .eq('id', body.userId);
      if (profileUpdateError) throw profileUpdateError;

      const { error: companyAccessError } = await admin
        .from('user_company_access')
        .update({
          role_code: resolved.roleCode,
          access_profile_id: resolved.accessProfileId,
          active: nextActive,
        })
        .eq('user_id', body.userId)
        .eq('company_id', body.companyId);
      if (companyAccessError) throw companyAccessError;

      return json({ ok: true, message: 'Usuário atualizado com sucesso.' });
    }

    if (body.action !== 'invite') return json({ error: 'Ação inválida.' }, 400);

    const email = body.email?.trim().toLowerCase();
    if (!email || !body.fullName?.trim()) {
      return json({ error: 'Nome e e-mail são obrigatórios.' }, 400);
    }

    const resolved = await resolveProfile();

    const { data: branch, error: branchError } = await admin
      .from('branches')
      .select('id')
      .eq('company_id', body.companyId)
      .eq('active', true)
      .order('created_at')
      .limit(1)
      .maybeSingle();
    if (branchError) throw branchError;
    if (!branch?.id) return json({ error: 'A empresa não possui uma unidade ativa para vincular o usuário.' }, 409);

    const inviteOptions: { data: Record<string, unknown>; redirectTo?: string } = {
      data: { full_name: body.fullName.trim(), role_code: resolved.roleCode },
    };
    if (body.redirectTo?.trim()) inviteOptions.redirectTo = body.redirectTo.trim();

    const { data: invite, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, inviteOptions);
    if (inviteError) throw inviteError;
    if (!invite.user) return json({ error: 'O Supabase não retornou o usuário convidado.' }, 500);

    await admin.auth.admin.updateUserById(invite.user.id, {
      app_metadata: { role_code: resolved.roleCode },
      user_metadata: { full_name: body.fullName.trim(), role_code: resolved.roleCode },
    });

    const { error: profileError } = await admin.from('profiles').upsert({
      id: invite.user.id,
      full_name: body.fullName.trim(),
      email,
      role_code: resolved.roleCode,
      active: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });
    if (profileError) throw profileError;

    const { error: companyAccessError } = await admin.from('user_company_access').upsert({
      user_id: invite.user.id,
      company_id: body.companyId,
      branch_id: branch.id,
      role_code: resolved.roleCode,
      access_profile_id: resolved.accessProfileId,
      active: true,
    }, { onConflict: 'user_id,company_id,branch_id' });
    if (companyAccessError) throw companyAccessError;

    return json({
      ok: true,
      userId: invite.user.id,
      message: 'Usuário criado e convite enviado por e-mail.',
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Falha ao gerenciar usuário.';
    return json({ error: message }, 400);
  }
});
