-- ============================================================
-- CRONOS • Prototype integrity fixes
-- Migration 0006
--
-- Depends on 0005_cronos_prototype_completion.sql.
-- Safe to run when legacy setup scripts were applied before the migrations.
-- ============================================================

begin;

-- ============================================================
-- 1. Installment posting idempotency
-- ============================================================

-- ON CONFLICT (installment_id) requires a non-partial unique arbiter.
-- NULL values remain allowed multiple times by PostgreSQL semantics.
drop index if exists public.uq_financial_entries_installment;

create unique index if not exists
  uq_financial_entries_installment
on public.financial_entries(installment_id);

-- ============================================================
-- 2. Company settings tenant assignment
-- ============================================================

-- The current frontend upserts the existing settings row by id. When an
-- installation is upgraded from the legacy schema, the proposed INSERT side
-- of the UPSERT may arrive without company_id. Resolve it only when the user
-- has exactly one manageable company; otherwise fail closed.
create or replace function private.assign_company_settings_tenant()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_company uuid;
  v_count integer;
begin
  if new.company_id is not null then
    return new;
  end if;

  select count(distinct u.company_id)
  into v_count
  from public.user_company_access u
  where u.user_id = auth.uid()
    and u.active = true
    and private.has_company_permission(
      u.company_id,
      'settings.manage'
    );

  if v_count <> 1 then
    raise exception
      'Não foi possível determinar a empresa ativa para as configurações';
  end if;

  select u.company_id
  into v_company
  from public.user_company_access u
  where u.user_id = auth.uid()
    and u.active = true
    and private.has_company_permission(
      u.company_id,
      'settings.manage'
    )
  order by u.company_id
  limit 1;

  new.company_id := v_company;

  return new;
end;
$$;

revoke all
on function private.assign_company_settings_tenant()
from public, anon;

grant execute
on function private.assign_company_settings_tenant()
to authenticated;

drop trigger if exists assign_company_settings_tenant
on public.company_settings;

create trigger assign_company_settings_tenant
before insert
on public.company_settings
for each row
execute function private.assign_company_settings_tenant();

commit;
