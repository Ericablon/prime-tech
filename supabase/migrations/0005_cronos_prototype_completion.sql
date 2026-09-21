-- ============================================================
-- CRONOS • Prototype completion / tenant hardening
-- Migration 0005
--
-- Depends on:
--   0001_prime_tech_core.sql
--   0002_cronos_saas_foundation.sql
--   0003_cronos_tenant_rbac.sql
--   0004_cronos_technical_flow.sql
--
-- Goal:
--   - make the runtime independent from optional setup scripts;
--   - scope company settings and finance installments by tenant;
--   - persist technical scheduling used by the frontend;
--   - keep legacy single-company installations usable;
--   - preserve idempotency when old setup scripts were already applied.
-- ============================================================

begin;

-- ============================================================
-- 1. Legacy single-company bootstrap
-- ============================================================

-- Every company needs at least one branch so user_company_access can
-- always point to a valid unit.
insert into public.branches (
  company_id,
  name,
  code,
  active
)
select
  c.id,
  'Matriz',
  'MATRIZ',
  true
from public.companies c
where not exists (
  select 1
  from public.branches b
  where b.company_id = c.id
)
on conflict do nothing;

-- If this is a legacy installation with exactly one company, migrate
-- existing profiles to that tenant only when they still have no access row.
do $$
declare
  v_company uuid;
  v_branch uuid;
  v_company_count integer;
begin
  select count(*)
  into v_company_count
  from public.companies
  where active = true;

  if v_company_count = 1 then
    select id
    into v_company
    from public.companies
    where active = true
    order by created_at, id
    limit 1;

    select id
    into v_branch
    from public.branches
    where company_id = v_company
      and active = true
    order by created_at, id
    limit 1;

    if v_branch is not null then
      insert into public.user_company_access (
        user_id,
        company_id,
        branch_id,
        role_code,
        active
      )
      select
        p.id,
        v_company,
        v_branch,
        p.role_code,
        p.active
      from public.profiles p
      where not exists (
        select 1
        from public.user_company_access u
        where u.user_id = p.id
          and u.company_id = v_company
      )
      on conflict do nothing;
    end if;
  end if;
end $$;

-- ============================================================
-- 2. Tenant-aware company settings
-- ============================================================

alter table public.company_settings
  add column if not exists company_id uuid
  references public.companies(id) on delete cascade;

-- Reuse the legacy row when there is only one company.
do $$
declare
  v_company uuid;
  v_company_count integer;
begin
  select count(*)
  into v_company_count
  from public.companies
  where active = true;

  if v_company_count = 1 then
    select id
    into v_company
    from public.companies
    where active = true
    order by created_at, id
    limit 1;

    update public.company_settings
    set company_id = v_company
    where company_id is null;
  end if;
end $$;

-- Ensure each company has its own settings row.
insert into public.company_settings (
  company_id,
  trade_name,
  legal_name,
  document,
  logo_url,
  budget_validity_days,
  footer_text
)
select
  c.id,
  c.trade_name,
  c.legal_name,
  c.document,
  '/brand/prime-tech-logo.jpeg',
  7,
  'Tecnologia que impulsiona.'
from public.companies c
where not exists (
  select 1
  from public.company_settings s
  where s.company_id = c.id
);

create unique index if not exists
  uq_company_settings_company
on public.company_settings(company_id)
where company_id is not null;

alter table public.company_settings enable row level security;

drop policy if exists company_read on public.company_settings;
drop policy if exists company_admin_all on public.company_settings;
drop policy if exists company_settings_tenant_read on public.company_settings;
drop policy if exists company_settings_tenant_insert on public.company_settings;
drop policy if exists company_settings_tenant_update on public.company_settings;
drop policy if exists company_settings_tenant_delete on public.company_settings;

create policy company_settings_tenant_read
on public.company_settings
for select
to authenticated
using (
  company_id is not null
  and private.has_company_access(company_id)
);

create policy company_settings_tenant_insert
on public.company_settings
for insert
to authenticated
with check (
  company_id is not null
  and private.has_company_permission(company_id, 'settings.manage')
);

create policy company_settings_tenant_update
on public.company_settings
for update
to authenticated
using (
  company_id is not null
  and private.has_company_permission(company_id, 'settings.manage')
)
with check (
  company_id is not null
  and private.has_company_permission(company_id, 'settings.manage')
);

create policy company_settings_tenant_delete
on public.company_settings
for delete
to authenticated
using (
  company_id is not null
  and private.has_company_permission(company_id, 'settings.manage')
);

-- Same-company users may read names used in technical scheduling and OS UI.
drop policy if exists profiles_read on public.profiles;
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

-- ============================================================
-- 3. Equipment code and technical scheduling
-- ============================================================

alter table public.equipment
  add column if not exists technical_number bigint generated always as identity;

create unique index if not exists
  uq_equipment_technical_number
on public.equipment(technical_number);

alter table public.service_orders
  add column if not exists scheduled_at timestamptz;

create index if not exists
  service_orders_schedule_idx
on public.service_orders(company_id, scheduled_at)
where scheduled_at is not null;

create or replace function private.guard_service_order_schedule()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.scheduled_at is not distinct from old.scheduled_at then
    return new;
  end if;

  if not (
    private.order_has_permission(new.company_id, 'orders.commercial')
    or private.order_has_permission(new.company_id, 'orders.tech')
  ) then
    raise exception 'Usuário sem permissão para alterar a programação técnica';
  end if;

  if new.scheduled_at is not null
     and new.assigned_technician_id is not null
     and exists (
       select 1
       from public.service_orders other
       where other.id <> new.id
         and other.company_id = new.company_id
         and other.assigned_technician_id = new.assigned_technician_id
         and other.scheduled_at = new.scheduled_at
         and other.status not in ('delivered', 'cancelled')
     )
  then
    raise exception 'O técnico já possui uma OS programada para este horário';
  end if;

  return new;
end;
$$;

revoke all
on function private.guard_service_order_schedule()
from public, anon;

drop trigger if exists guard_service_order_schedule
on public.service_orders;

create trigger guard_service_order_schedule
before update of scheduled_at, assigned_technician_id
on public.service_orders
for each row
execute function private.guard_service_order_schedule();

-- ============================================================
-- 4. Payment installments used by the Finance module
-- ============================================================

create table if not exists public.payment_installments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete restrict,
  plan_id uuid not null,
  installment_number integer not null,
  installment_count integer not null check(installment_count between 1 and 36),
  service_order_id uuid references public.service_orders(id) on delete restrict,
  type text not null check(type in ('income', 'expense')),
  category text not null,
  description text not null,
  amount numeric(12,2) not null check(amount > 0),
  due_date date not null,
  payment_method text not null check(payment_method in ('cash','pix','credit_card','debit_card','boleto','transfer')),
  paid_at timestamptz,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(plan_id, installment_number),
  check(installment_number between 1 and installment_count)
);

alter table public.payment_installments
  add column if not exists company_id uuid
  references public.companies(id) on delete restrict;

-- Backfill tenant from linked OS first.
update public.payment_installments pi
set company_id = so.company_id
from public.service_orders so
where pi.company_id is null
  and pi.service_order_id = so.id
  and so.company_id is not null;

-- For standalone legacy entries, backfill only when the creator belongs
-- to exactly one active company; otherwise leave the row fail-closed.
update public.payment_installments pi
set company_id = (
  select u.company_id
  from public.user_company_access u
  where u.user_id = pi.created_by
    and u.active = true
  order by u.company_id
  limit 1
)
where pi.company_id is null
  and 1 = (
    select count(distinct u.company_id)
    from public.user_company_access u
    where u.user_id = pi.created_by
      and u.active = true
  );

alter table public.payment_installments enable row level security;

grant select, insert, update
on public.payment_installments
to authenticated;

revoke all
on public.payment_installments
from anon;

drop policy if exists installments_read on public.payment_installments;
drop policy if exists installments_create on public.payment_installments;
drop policy if exists installments_update on public.payment_installments;
drop policy if exists installments_tenant_read on public.payment_installments;
drop policy if exists installments_tenant_insert on public.payment_installments;
drop policy if exists installments_tenant_update on public.payment_installments;

create policy installments_tenant_read
on public.payment_installments
for select
to authenticated
using (
  company_id is not null
  and private.has_company_permission(company_id, 'finance.view')
);

create policy installments_tenant_insert
on public.payment_installments
for insert
to authenticated
with check (
  company_id is not null
  and created_by = auth.uid()
  and private.has_company_permission(company_id, 'finance.manage')
);

create policy installments_tenant_update
on public.payment_installments
for update
to authenticated
using (
  company_id is not null
  and private.has_company_permission(company_id, 'finance.manage')
)
with check (
  company_id is not null
  and private.has_company_permission(company_id, 'finance.manage')
);

create index if not exists payment_installments_company_due_idx
on public.payment_installments(company_id, due_date)
where paid_at is null;

create index if not exists payment_installments_order_idx
on public.payment_installments(service_order_id);

alter table public.financial_entries
  add column if not exists installment_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'financial_entries_installment_id_fkey'
      and conrelid = 'public.financial_entries'::regclass
  ) then
    alter table public.financial_entries
      add constraint financial_entries_installment_id_fkey
      foreign key (installment_id)
      references public.payment_installments(id)
      on delete restrict;
  end if;
end $$;

create unique index if not exists
  uq_financial_entries_installment
on public.financial_entries(installment_id)
where installment_id is not null;

create or replace function private.guard_installment()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_order public.service_orders;
  v_allocated numeric;
begin
  if tg_op = 'UPDATE' then
    if (to_jsonb(new) - 'paid_at')
       is distinct from
       (to_jsonb(old) - 'paid_at')
    then
      raise exception 'As condições registradas não podem ser alteradas';
    end if;

    if old.paid_at is not null
       and new.paid_at is distinct from old.paid_at
    then
      raise exception 'Parcela já liquidada';
    end if;

    return new;
  end if;

  if new.company_id is null then
    raise exception 'Empresa obrigatória para a parcela';
  end if;

  if not private.has_company_permission(new.company_id, 'finance.manage') then
    raise exception 'Usuário sem permissão financeira nesta empresa';
  end if;

  if new.service_order_id is not null then
    select *
    into v_order
    from public.service_orders
    where id = new.service_order_id
    for update;

    if not found then
      raise exception 'Ordem de Serviço não encontrada';
    end if;

    if v_order.company_id is distinct from new.company_id then
      raise exception 'A OS pertence a outra empresa';
    end if;

    if new.type = 'income' then
      if v_order.status not in (
        'approved',
        'in_repair',
        'waiting_part',
        'quality_check',
        'ready_for_pickup',
        'delivered'
      ) then
        raise exception 'Registre a aprovação antes das condições de pagamento';
      end if;

      select
        coalesce(sum(amount), 0)
      into v_allocated
      from public.payment_installments
      where service_order_id = new.service_order_id
        and type = 'income';

      v_allocated := v_allocated + coalesce((
        select sum(amount)
        from public.financial_entries
        where service_order_id = new.service_order_id
          and type = 'income'
          and installment_id is null
      ), 0);

      if v_allocated + new.amount > v_order.total_amount then
        raise exception 'Valor excede o saldo da OS';
      end if;
    end if;
  end if;

  return new;
end;
$$;

revoke all
on function private.guard_installment()
from public, anon;

drop trigger if exists guard_installment
on public.payment_installments;

create trigger guard_installment
before insert or update
on public.payment_installments
for each row
execute function private.guard_installment();

create or replace function private.post_installment()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.paid_at is not null
     and (tg_op = 'INSERT' or old.paid_at is null)
  then
    insert into public.financial_entries (
      company_id,
      type,
      category,
      description,
      amount,
      occurred_at,
      service_order_id,
      payment_method,
      created_by,
      installment_id
    )
    values (
      new.company_id,
      new.type,
      new.category,
      new.description || ' (' || new.installment_number || '/' || new.installment_count || ')',
      new.amount,
      new.paid_at,
      new.service_order_id,
      new.payment_method,
      auth.uid(),
      new.id
    )
    on conflict (installment_id) do nothing;
  end if;

  return new;
end;
$$;

revoke all
on function private.post_installment()
from public, anon;

drop trigger if exists post_installment
on public.payment_installments;

create trigger post_installment
after insert or update
on public.payment_installments
for each row
execute function private.post_installment();

-- ============================================================
-- 5. Finance/commercial RPCs used by the frontend
-- ============================================================

create or replace function public.create_payment_plan(
  p_request_id uuid,
  p_order_id uuid,
  p_type text,
  p_category text,
  p_description text,
  p_amount numeric,
  p_count integer,
  p_first_due date,
  p_method text,
  p_paid boolean default false
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_company uuid;
  v_company_count integer;
  v_order public.service_orders;
  v_n integer;
  v_cents bigint;
  v_base bigint;
  v_remainder bigint;
  v_piece numeric;
  v_due date;
begin
  if p_request_id is null then
    raise exception 'Identificador obrigatório';
  end if;

  if p_type not in ('income', 'expense') then
    raise exception 'Tipo financeiro inválido';
  end if;

  if p_amount is null
     or p_amount <= 0
     or p_amount <> round(p_amount, 2)
     or p_count is null
     or p_count not between 1 and 36
     or p_amount * 100 < p_count
     or p_first_due is null
     or length(trim(coalesce(p_description, ''))) < 3
     or length(trim(coalesce(p_category, ''))) = 0
  then
    raise exception 'Revise valor, parcelas, data, categoria e descrição';
  end if;

  if p_method not in ('cash','pix','credit_card','debit_card','boleto','transfer') then
    raise exception 'Forma de pagamento inválida';
  end if;

  if p_paid and p_count <> 1 then
    raise exception 'Baixe cada parcela após confirmar o pagamento';
  end if;

  if p_order_id is not null then
    select *
    into v_order
    from public.service_orders
    where id = p_order_id;

    if not found then
      raise exception 'Ordem de Serviço não encontrada';
    end if;

    v_company := v_order.company_id;
  else
    select count(distinct u.company_id)
    into v_company_count
    from public.user_company_access u
    where u.user_id = auth.uid()
      and u.active = true
      and private.has_company_permission(u.company_id, 'finance.manage');

    if v_company_count <> 1 then
      raise exception 'Não foi possível determinar a empresa ativa para este lançamento';
    end if;

    select u.company_id
    into v_company
    from public.user_company_access u
    where u.user_id = auth.uid()
      and u.active = true
      and private.has_company_permission(u.company_id, 'finance.manage')
    order by u.company_id
    limit 1;
  end if;

  if v_company is null
     or not private.has_company_permission(v_company, 'finance.manage')
  then
    raise exception 'Usuário sem permissão financeira nesta empresa';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_request_id::text));

  if exists (
    select 1
    from public.payment_installments
    where plan_id = p_request_id
  ) then
    return;
  end if;

  v_cents := round(p_amount * 100)::bigint;
  v_base := v_cents / p_count;
  v_remainder := v_cents % p_count;

  for v_n in 1..p_count loop
    v_piece := (
      v_base + case when v_n <= v_remainder then 1 else 0 end
    )::numeric / 100;

    v_due := (
      p_first_due + make_interval(months => v_n - 1)
    )::date;

    insert into public.payment_installments (
      company_id,
      plan_id,
      installment_number,
      installment_count,
      service_order_id,
      type,
      category,
      description,
      amount,
      due_date,
      payment_method,
      paid_at,
      created_by
    )
    values (
      v_company,
      p_request_id,
      v_n,
      p_count,
      p_order_id,
      p_type,
      trim(p_category),
      trim(p_description),
      v_piece,
      v_due,
      p_method,
      case when p_paid then now() else null end,
      auth.uid()
    );
  end loop;
end;
$$;

create or replace function public.settle_installment(
  p_id uuid
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_company uuid;
begin
  select company_id
  into v_company
  from public.payment_installments
  where id = p_id
  for update;

  if not found then
    raise exception 'Parcela não encontrada';
  end if;

  if v_company is null
     or not private.has_company_permission(v_company, 'finance.manage')
  then
    raise exception 'Usuário sem permissão financeira nesta empresa';
  end if;

  update public.payment_installments
  set paid_at = now()
  where id = p_id
    and paid_at is null;
end;
$$;

create or replace function public.record_order_contact(
  p_order_id uuid,
  p_notes text
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_order public.service_orders;
begin
  if length(trim(coalesce(p_notes, ''))) < 3 then
    raise exception 'Descreva o contato com o cliente';
  end if;

  select *
  into v_order
  from public.service_orders
  where id = p_order_id;

  if not found then
    raise exception 'Ordem de Serviço não encontrada';
  end if;

  if not (
    private.order_has_permission(v_order.company_id, 'orders.commercial')
    or private.order_has_permission(
      v_order.company_id,
      'orders.approve',
      'orders.customer_approval'
    )
  ) then
    raise exception 'Usuário sem permissão comercial nesta empresa';
  end if;

  insert into public.service_order_status_history (
    service_order_id,
    from_status,
    to_status,
    notes,
    changed_by
  )
  values (
    p_order_id,
    v_order.status,
    v_order.status,
    'Contato comercial: ' || trim(p_notes),
    auth.uid()
  );
end;
$$;

revoke all
on function public.create_payment_plan(
  uuid, uuid, text, text, text, numeric,
  integer, date, text, boolean
)
from public, anon;

revoke all
on function public.settle_installment(uuid)
from public, anon;

revoke all
on function public.record_order_contact(uuid, text)
from public, anon;

grant execute
on function public.create_payment_plan(
  uuid, uuid, text, text, text, numeric,
  integer, date, text, boolean
)
to authenticated;

grant execute
on function public.settle_installment(uuid)
to authenticated;

grant execute
on function public.record_order_contact(uuid, text)
to authenticated;

commit;
