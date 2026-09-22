import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type RoleCode = 'admin' | 'gestor' | 'atendimento' | 'comercial' | 'tecnico' | 'estoque' | 'financeiro' | 'fiscal';

type RequestBody = {
  action: 'invite' | 'reset';
  companyId: string;
  email: string;
  fullName?: string;
  roleCode?: RoleCode;
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
    const email = body.email?.trim().toLowerCase();
    if (!body.companyId || !email) return json({ error: 'Empresa e e-mail são obrigatórios.' }, 400);

    const { data: access, error: accessError } = await admin
      .from('user_company_access')
      .select('role_code, active')
      .eq('user_id', authData.user.id)
      .eq('company_id', body.companyId)
      .eq('active', true)
      .limit(1)
      .maybeSingle();
    if (accessError) throw accessError;
    if (!access) return json({ error: 'Usuário sem acesso à empresa.' }, 403);

    const { data: permission, error: permissionError } = await admin
      .from('role_permissions')
      .select('permission_code')
      .eq('role_code', String(access.role_code))
      .eq('permission_code', 'users.manage')
      .maybeSingle();
    if (permissionError) throw permissionError;
    if (!permission) return json({ error: 'Seu perfil não pode gerenciar usuários.' }, 403);

    if (body.action === 'reset') {
      const redirectTo = body.redirectTo?.trim() || undefined;
      const { error } = await admin.auth.resetPasswordForEmail(email, redirectTo ? { redirectTo } : undefined);
      if (error) throw error;
      return json({ ok: true, message: 'Recuperação de senha enviada.' });
    }

    if (body.action !== 'invite') return json({ error: 'Ação inválida.' }, 400);

    const roleCode = body.roleCode ?? 'atendimento';
    const allowedRoles: RoleCode[] = ['admin','gestor','atendimento','comercial','tecnico','estoque','financeiro','fiscal'];
    if (!allowedRoles.includes(roleCode)) return json({ error: 'Perfil inválido.' }, 400);
    if (!body.fullName?.trim()) return json({ error: 'Informe o nome do usuário.' }, 400);

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
      data: { full_name: body.fullName.trim(), role_code: roleCode },
    };
    if (body.redirectTo?.trim()) inviteOptions.redirectTo = body.redirectTo.trim();

    const { data: invite, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, inviteOptions);
    if (inviteError) throw inviteError;
    if (!invite.user) return json({ error: 'O Supabase não retornou o usuário convidado.' }, 500);

    await admin.auth.admin.updateUserById(invite.user.id, {
      app_metadata: { role_code: roleCode },
      user_metadata: { full_name: body.fullName.trim(), role_code: roleCode },
    });

    const { error: profileError } = await admin.from('profiles').upsert({
      id: invite.user.id,
      full_name: body.fullName.trim(),
      email,
      role_code: roleCode,
      active: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });
    if (profileError) throw profileError;

    const { error: companyAccessError } = await admin.from('user_company_access').upsert({
      user_id: invite.user.id,
      company_id: body.companyId,
      branch_id: branch.id,
      role_code: roleCode,
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
