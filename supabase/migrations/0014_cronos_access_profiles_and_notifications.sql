-- CRONOS / Prime Tech — perfis de acesso por empresa + overrides de permissões
-- Aplicar APÓS 0013_cronos_users_and_technical_mobile.sql

begin;

-- ============================================================
-- 1) Perfis personalizados por empresa
-- ============================================================
create table if not exists public.access_profiles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  code text not null,
  name text not null,
  base_role_code text not null references public.roles(code) on delete restrict,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, code)
);

create table if not exists public.access_profile_permissions (
  access_profile_id uuid not null references public.access_profiles(id) on delete cascade,
  permission_code text not null references public.permissions(code) on delete cascade,
  primary key(access_profile_id, permission_code)
);

alter table public.user_company_access
  add column if not exists access_profile_id uuid references public.access_profiles(id) on delete set null;

create index if not exists idx_access_profiles_company
  on public.access_profiles(company_id, active, name);
create index if not exists idx_user_company_access_profile
  on public.user_company_access(access_profile_id);

-- ============================================================
-- 2) Override dos perfis padrão por empresa
--    Permite editar Técnico, Comercial, Gestor etc. sem afetar outro tenant.
-- ============================================================
create table if not exists public.company_role_overrides (
  company_id uuid not null references public.companies(id) on delete cascade,
  role_code text not null references public.roles(code) on delete cascade,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key(company_id, role_code)
);

create table if not exists public.company_role_permissions (
  company_id uuid not null references public.companies(id) on delete cascade,
  role_code text not null references public.roles(code) on delete cascade,
  permission_code text not null references public.permissions(code) on delete cascade,
  primary key(company_id, role_code, permission_code),
  foreign key(company_id, role_code)
    references public.company_role_overrides(company_id, role_code)
    on delete cascade
);

-- ============================================================
-- 3) RLS
-- ============================================================
alter table public.access_profiles enable row level security;
alter table public.access_profile_permissions enable row level security;
alter table public.company_role_overrides enable row level security;
alter table public.company_role_permissions enable row level security;

drop policy if exists access_profiles_read on public.access_profiles;
create policy access_profiles_read
on public.access_profiles
for select
to authenticated
using (private.has_company_access(company_id));

drop policy if exists access_profile_permissions_read on public.access_profile_permissions;
create policy access_profile_permissions_read
on public.access_profile_permissions
for select
to authenticated
using (
  exists (
    select 1
    from public.access_profiles p
    where p.id = access_profile_id
      and private.has_company_access(p.company_id)
  )
);

drop policy if exists company_role_overrides_read on public.company_role_overrides;
create policy company_role_overrides_read
on public.company_role_overrides
for select
to authenticated
using (private.has_company_access(company_id));

drop policy if exists company_role_permissions_read on public.company_role_permissions;
create policy company_role_permissions_read
on public.company_role_permissions
for select
to authenticated
using (private.has_company_access(company_id));

-- Perfis públicos: leitura e edição por usuários que gerenciam acessos na mesma empresa.
drop policy if exists profiles_read on public.profiles;
drop policy if exists profiles_admin_all on public.profiles;
drop policy if exists profiles_tenant_read on public.profiles;
drop policy if exists profiles_tenant_update on public.profiles;

create policy profiles_tenant_read
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or exists (
    select 1
    from public.user_company_access target_access
    where target_access.user_id = profiles.id
      and target_access.active = true
      and private.has_company_permission(target_access.company_id, 'users.manage')
  )
);

create policy profiles_tenant_update
on public.profiles
for update
to authenticated
using (
  exists (
    select 1
    from public.user_company_access target_access
    where target_access.user_id = profiles.id
      and private.has_company_permission(target_access.company_id, 'users.manage')
  )
)
with check (
  exists (
    select 1
    from public.user_company_access target_access
    where target_access.user_id = profiles.id
      and private.has_company_permission(target_access.company_id, 'users.manage')
  )
);

-- ============================================================
-- 4) Permissão efetiva por empresa
-- ============================================================
create or replace function private.has_company_permission(p_company uuid, p_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_company_access u
    where u.user_id = auth.uid()
      and u.company_id = p_company
      and u.active = true
      and (
        (
          u.access_profile_id is not null
          and exists (
            select 1
            from public.access_profile_permissions app
            join public.access_profiles ap on ap.id = app.access_profile_id
            where app.access_profile_id = u.access_profile_id
              and ap.company_id = p_company
              and ap.active = true
              and app.permission_code = p_permission
          )
        )
        or
        (
          u.access_profile_id is null
          and exists (
            select 1
            from public.company_role_overrides cro
            join public.company_role_permissions crp
              on crp.company_id = cro.company_id
             and crp.role_code = cro.role_code
            where cro.company_id = p_company
              and cro.role_code = u.role_code
              and crp.permission_code = p_permission
          )
        )
        or
        (
          u.access_profile_id is null
          and not exists (
            select 1
            from public.company_role_overrides cro
            where cro.company_id = p_company
              and cro.role_code = u.role_code
          )
          and exists (
            select 1
            from public.role_permissions rp
            where rp.role_code = u.role_code
              and rp.permission_code = p_permission
          )
        )
      )
  );
$$;

create or replace function private.has_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1
      from public.user_company_access u
      where u.user_id = auth.uid()
        and u.active = true
        and private.has_company_permission(u.company_id, p_permission)
    )
    or (
      not exists (
        select 1
        from public.user_company_access u
        where u.user_id = auth.uid()
          and u.active = true
      )
      and exists (
        select 1
        from public.profiles p
        join public.role_permissions rp on rp.role_code = p.role_code
        where p.id = auth.uid()
          and p.active = true
          and rp.permission_code = p_permission
      )
    );
$$;

revoke all on function private.has_company_permission(uuid,text), private.has_permission(text) from public,anon;
grant execute on function private.has_company_permission(uuid,text), private.has_permission(text) to authenticated;

-- ============================================================
-- 5) RPC segura para editar perfil padrão por empresa
-- ============================================================
create or replace function public.save_company_role_permissions(
  p_company uuid,
  p_role text,
  p_permissions text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not private.has_company_permission(p_company, 'permissions.manage') then
    raise exception 'Acesso negado para editar perfis.';
  end if;

  if not exists(select 1 from public.roles where code = p_role) then
    raise exception 'Perfil base inválido.';
  end if;

  if p_permissions is null or array_length(p_permissions, 1) is null then
    raise exception 'Selecione ao menos uma permissão.';
  end if;

  if exists(
    select 1 from unnest(p_permissions) p
    where not exists(select 1 from public.permissions where code = p)
  ) then
    raise exception 'Permissão desconhecida.';
  end if;

  if p_role = 'admin' and not (
    'dashboard.view' = any(p_permissions)
    and 'users.manage' = any(p_permissions)
    and 'permissions.manage' = any(p_permissions)
    and 'settings.manage' = any(p_permissions)
  ) then
    raise exception 'O Administrador precisa manter dashboard, usuários, permissões e configurações.';
  end if;

  insert into public.company_role_overrides(company_id, role_code, updated_by, updated_at)
  values(p_company, p_role, auth.uid(), now())
  on conflict(company_id, role_code) do update
    set updated_by = excluded.updated_by,
        updated_at = now();

  delete from public.company_role_permissions
  where company_id = p_company
    and role_code = p_role;

  insert into public.company_role_permissions(company_id, role_code, permission_code)
  select p_company, p_role, permission_code
  from (
    select distinct unnest(p_permissions) as permission_code
    union
    select 'dashboard.view'
  ) q;

  insert into public.audit_logs(user_id, company_id, action, entity_type, metadata)
  values(auth.uid(), p_company, 'company_role.permissions.updated', 'role', jsonb_build_object('role', p_role));
end;
$$;

create or replace function public.reset_company_role_permissions(
  p_company uuid,
  p_role text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not private.has_company_permission(p_company, 'permissions.manage') then
    raise exception 'Acesso negado para editar perfis.';
  end if;

  delete from public.company_role_overrides
  where company_id = p_company
    and role_code = p_role;

  insert into public.audit_logs(user_id, company_id, action, entity_type, metadata)
  values(auth.uid(), p_company, 'company_role.permissions.reset', 'role', jsonb_build_object('role', p_role));
end;
$$;

-- ============================================================
-- 6) RPC segura para criar/editar perfis personalizados
-- ============================================================
create or replace function public.save_access_profile(
  p_company uuid,
  p_profile_id uuid,
  p_name text,
  p_base_role text,
  p_permissions text[],
  p_active boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_code text;
begin
  if not private.has_company_permission(p_company, 'permissions.manage') then
    raise exception 'Acesso negado para gerenciar perfis.';
  end if;

  if btrim(coalesce(p_name, '')) = '' then
    raise exception 'Informe o nome do perfil.';
  end if;

  if not exists(select 1 from public.roles where code = p_base_role) then
    raise exception 'Perfil operacional base inválido.';
  end if;

  if p_permissions is null or array_length(p_permissions, 1) is null then
    raise exception 'Selecione ao menos uma permissão.';
  end if;

  if exists(
    select 1 from unnest(p_permissions) p
    where not exists(select 1 from public.permissions where code = p)
  ) then
    raise exception 'Permissão desconhecida.';
  end if;

  if p_profile_id is null then
    v_id := gen_random_uuid();
    v_code := lower(regexp_replace(coalesce(p_name, 'perfil'), '[^a-zA-Z0-9]+', '_', 'g'));
    v_code := trim(both '_' from v_code);
    if v_code = '' then v_code := 'perfil'; end if;
    v_code := v_code || '_' || substr(replace(v_id::text, '-', ''), 1, 6);

    insert into public.access_profiles(id, company_id, code, name, base_role_code, active, created_by)
    values(v_id, p_company, v_code, btrim(p_name), p_base_role, coalesce(p_active, true), auth.uid());
  else
    update public.access_profiles
    set name = btrim(p_name),
        base_role_code = p_base_role,
        active = coalesce(p_active, true),
        updated_at = now()
    where id = p_profile_id
      and company_id = p_company
    returning id into v_id;

    if v_id is null then
      raise exception 'Perfil não encontrado.';
    end if;
  end if;

  delete from public.access_profile_permissions where access_profile_id = v_id;
  insert into public.access_profile_permissions(access_profile_id, permission_code)
  select v_id, permission_code
  from (
    select distinct unnest(p_permissions) as permission_code
    union
    select 'dashboard.view'
  ) q;

  insert into public.audit_logs(user_id, company_id, action, entity_type, entity_id, metadata)
  values(auth.uid(), p_company, 'access_profile.saved', 'access_profile', v_id, jsonb_build_object('name', p_name, 'base_role', p_base_role));

  return v_id;
end;
$$;

-- ============================================================
-- 7) Grant das RPCs
-- ============================================================
revoke execute on function public.save_company_role_permissions(uuid,text,text[]), public.reset_company_role_permissions(uuid,text), public.save_access_profile(uuid,uuid,text,text,text[],boolean) from public,anon;
grant execute on function public.save_company_role_permissions(uuid,text,text[]), public.reset_company_role_permissions(uuid,text), public.save_access_profile(uuid,uuid,text,text,text[],boolean) to authenticated;

commit;
