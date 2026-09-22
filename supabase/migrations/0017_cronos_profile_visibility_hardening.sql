-- CRONOS / Prime Tech — visibilidade segura da equipe após perfis personalizados
-- Aplicar APÓS 0016_cronos_finance_catalog_quick_create.sql

begin;

-- A migration 0014 restringiu a leitura de profiles a quem gerencia usuários.
-- Comercial, agenda e operação técnica também precisam enxergar o nome dos
-- colegas da MESMA empresa para filas, programação e capacidade operacional.
drop policy if exists profiles_tenant_read on public.profiles;

create policy profiles_tenant_read
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or exists (
    select 1
    from public.user_company_access viewer
    join public.user_company_access target
      on target.company_id = viewer.company_id
     and target.user_id = profiles.id
     and target.active = true
    where viewer.user_id = auth.uid()
      and viewer.active = true
  )
);

-- A edição continua mais restrita: somente quem possui users.manage na empresa
-- do usuário alvo pode alterar seu perfil público.
drop policy if exists profiles_tenant_update on public.profiles;

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

create index if not exists idx_user_company_access_company_active
  on public.user_company_access(company_id, active, user_id);

commit;
