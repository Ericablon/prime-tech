-- Cronos / Prime Tech — expansão operacional inspirada nos padrões maduros do Itamix Operations Hub
-- Aplicar APÓS 0006_cronos_prototype_integrity_fix.sql.
-- Especialidades técnicas, categorias/contas financeiras, DRE, estoque transacional e programação.

begin;

create extension if not exists pgcrypto;

-- ============================================================================
-- 1) ESPECIALIDADES TÉCNICAS
-- ============================================================================

create table if not exists public.technical_specialties (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, code)
);

insert into public.technical_specialties(company_id, code, name, description, sort_order)
select c.id, x.code, x.name, x.description, x.sort_order
from public.companies c
cross join (values
  ('impressoras', 'Impressoras', 'Impressoras, multifuncionais, scanners, plotters e equipamentos de impressão.', 10),
  ('computadores', 'Computadores', 'Desktops, notebooks, workstations, servidores e equipamentos de informática.', 20)
) as x(code, name, description, sort_order)
on conflict (company_id, code) do nothing;

create table if not exists public.profile_technical_specialties (
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  technical_specialty_id uuid not null references public.technical_specialties(id) on delete cascade,
  is_primary boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (company_id, user_id, technical_specialty_id)
);

alter table public.equipment
  add column if not exists technical_specialty_code text;

alter table public.service_orders
  add column if not exists technical_specialty_code text,
  add column if not exists scheduled_duration_minutes integer,
  add column if not exists schedule_notes text;

alter table public.service_orders
  drop constraint if exists service_orders_scheduled_duration_check;
alter table public.service_orders
  add constraint service_orders_scheduled_duration_check
  check (scheduled_duration_minutes is null or scheduled_duration_minutes between 15 and 1440);

create or replace function public.infer_technical_specialty(p_category text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when lower(coalesce(p_category, '')) ~ '(impress|multifunc|plotter|scanner|copiadora)' then 'impressoras'
    when lower(coalesce(p_category, '')) ~ '(comput|notebook|desktop|laptop|pc|workstation|servidor)' then 'computadores'
    else null
  end;
$$;

create or replace function public.validate_equipment_specialty()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.technical_specialty_code is null or btrim(new.technical_specialty_code) = '' then
    new.technical_specialty_code := public.infer_technical_specialty(new.category);
  end if;

  if new.company_id is not null and new.technical_specialty_code is not null and not exists (
    select 1
    from public.technical_specialties s
    where s.company_id = new.company_id
      and s.code = new.technical_specialty_code
      and s.active = true
  ) then
    raise exception 'Especialidade técnica inválida para esta empresa: %', new.technical_specialty_code;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_equipment_specialty on public.equipment;
create trigger validate_equipment_specialty
before insert or update of category, company_id, technical_specialty_code
on public.equipment
for each row execute function public.validate_equipment_specialty();

update public.equipment e
set technical_specialty_code = public.infer_technical_specialty(e.category)
where e.technical_specialty_code is null
  and public.infer_technical_specialty(e.category) is not null;

create or replace function public.validate_order_specialty_and_technician()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_has_mapping boolean;
begin
  if new.technical_specialty_code is null or btrim(new.technical_specialty_code) = '' then
    select coalesce(
      e.technical_specialty_code,
      public.infer_technical_specialty(e.category)
    )
    into new.technical_specialty_code
    from public.equipment e
    where e.id = new.equipment_id;
  end if;

  if new.company_id is not null and new.technical_specialty_code is not null and not exists (
    select 1
    from public.technical_specialties s
    where s.company_id = new.company_id
      and s.code = new.technical_specialty_code
      and s.active = true
  ) then
    raise exception 'Especialidade técnica inválida para esta empresa: %', new.technical_specialty_code;
  end if;

  if new.assigned_technician_id is not null
     and new.company_id is not null
     and new.technical_specialty_code is not null then

    select exists (
      select 1
      from public.profile_technical_specialties pts
      where pts.company_id = new.company_id
        and pts.user_id = new.assigned_technician_id
        and pts.active = true
    ) into v_has_mapping;

    -- Compatibilidade: técnicos sem configuração explícita continuam atribuíveis.
    -- Após configurar especialidades para o técnico, a correspondência passa a ser obrigatória.
    if v_has_mapping and not exists (
      select 1
      from public.profile_technical_specialties pts
      join public.technical_specialties s on s.id = pts.technical_specialty_id
      where pts.company_id = new.company_id
        and pts.user_id = new.assigned_technician_id
        and pts.active = true
        and s.active = true
        and s.code = new.technical_specialty_code
    ) then
      raise exception 'O técnico selecionado não está habilitado para a especialidade %', new.technical_specialty_code;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_order_specialty_and_technician on public.service_orders;
create trigger validate_order_specialty_and_technician
before insert or update of equipment_id, company_id, technical_specialty_code, assigned_technician_id
on public.service_orders
for each row execute function public.validate_order_specialty_and_technician();

update public.service_orders so
set technical_specialty_code = coalesce(
  e.technical_specialty_code,
  public.infer_technical_specialty(e.category)
)
from public.equipment e
where e.id = so.equipment_id
  and so.technical_specialty_code is null;

create index if not exists idx_service_orders_specialty_status
  on public.service_orders(company_id, technical_specialty_code, status);
create index if not exists idx_profile_technical_specialties_user
  on public.profile_technical_specialties(company_id, user_id, active);

alter table public.technical_specialties enable row level security;
alter table public.profile_technical_specialties enable row level security;

drop policy if exists technical_specialties_read on public.technical_specialties;
create policy technical_specialties_read
on public.technical_specialties for select to authenticated
using (private.has_company_access(company_id));

drop policy if exists technical_specialties_manage on public.technical_specialties;
create policy technical_specialties_manage
on public.technical_specialties for all to authenticated
using (private.has_company_permission(company_id, 'settings.manage'))
with check (private.has_company_permission(company_id, 'settings.manage'));

drop policy if exists profile_specialties_read on public.profile_technical_specialties;
create policy profile_specialties_read
on public.profile_technical_specialties for select to authenticated
using (private.has_company_access(company_id));

drop policy if exists profile_specialties_manage on public.profile_technical_specialties;
create policy profile_specialties_manage
on public.profile_technical_specialties for all to authenticated
using (
  private.has_company_permission(company_id, 'users.manage')
  or private.has_company_permission(company_id, 'settings.manage')
)
with check (
  private.has_company_permission(company_id, 'users.manage')
  or private.has_company_permission(company_id, 'settings.manage')
);

-- ============================================================================
-- 2) CONTAS E CATEGORIAS FINANCEIRAS / DRE
-- ============================================================================

create table if not exists public.financial_accounts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  account_type text not null default 'cash'
    check (account_type in ('cash','checking','savings','digital','other')),
  bank_name text,
  agency text,
  account_number text,
  pix_key text,
  opening_balance numeric(14,2) not null default 0,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, name)
);

create table if not exists public.financial_categories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  code text not null,
  name text not null,
  direction text not null check (direction in ('income','expense','both')),
  dre_group text not null check (dre_group in (
    'gross_revenue','deduction','cost_of_sales','operating_expense',
    'financial_expense','other_income','other_expense'
  )),
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, code),
  unique (company_id, name)
);

insert into public.financial_accounts(company_id, name, account_type, opening_balance)
select c.id, 'Caixa Geral', 'cash', 0
from public.companies c
on conflict (company_id, name) do nothing;

insert into public.financial_categories(company_id, code, name, direction, dre_group, sort_order)
select c.id, x.code, x.name, x.direction, x.dre_group, x.sort_order
from public.companies c
cross join (values
  ('servicos', 'Serviços', 'income', 'gross_revenue', 10),
  ('pecas', 'Peças', 'income', 'gross_revenue', 20),
  ('venda_equipamentos', 'Venda de equipamentos', 'income', 'gross_revenue', 30),
  ('outras_receitas', 'Outras receitas', 'income', 'other_income', 90),
  ('impostos_taxas', 'Impostos e taxas', 'expense', 'deduction', 110),
  ('custo_pecas', 'Custo de peças e materiais', 'expense', 'cost_of_sales', 120),
  ('folha_pessoal', 'Folha e pessoal', 'expense', 'operating_expense', 210),
  ('aluguel', 'Aluguel', 'expense', 'operating_expense', 220),
  ('energia', 'Energia', 'expense', 'operating_expense', 230),
  ('internet_telefonia', 'Internet e telefonia', 'expense', 'operating_expense', 240),
  ('transporte', 'Transporte e deslocamento', 'expense', 'operating_expense', 250),
  ('manutencao', 'Manutenção e conservação', 'expense', 'operating_expense', 260),
  ('marketing', 'Marketing e comercial', 'expense', 'operating_expense', 270),
  ('taxas_financeiras', 'Taxas e despesas financeiras', 'expense', 'financial_expense', 310),
  ('outras_despesas', 'Outras despesas', 'expense', 'other_expense', 390)
) as x(code, name, direction, dre_group, sort_order)
on conflict (company_id, code) do nothing;

alter table public.financial_entries
  add column if not exists category_id uuid references public.financial_categories(id) on delete set null,
  add column if not exists account_id uuid references public.financial_accounts(id) on delete set null,
  add column if not exists competence_date date;

alter table public.payment_installments
  add column if not exists category_id uuid references public.financial_categories(id) on delete set null,
  add column if not exists account_id uuid references public.financial_accounts(id) on delete set null,
  add column if not exists competence_date date;

-- Backfill da primeira conta ativa por empresa. Correlated subquery evita referência
-- inválida ao alias da tabela-alvo em FROM LATERAL durante UPDATE.
update public.financial_entries f
set account_id = (
  select fa.id
  from public.financial_accounts fa
  where fa.company_id = f.company_id
    and fa.active = true
  order by fa.created_at, fa.id
  limit 1
)
where f.account_id is null
  and f.company_id is not null;

update public.payment_installments p
set account_id = (
  select fa.id
  from public.financial_accounts fa
  where fa.company_id = p.company_id
    and fa.active = true
  order by fa.created_at, fa.id
  limit 1
)
where p.account_id is null
  and p.company_id is not null;

update public.financial_entries f
set category_id = c.id
from public.financial_categories c
where c.company_id = f.company_id
  and lower(c.name) = lower(f.category)
  and f.category_id is null;

update public.payment_installments p
set category_id = c.id
from public.financial_categories c
where c.company_id = p.company_id
  and lower(c.name) = lower(p.category)
  and p.category_id is null;

update public.financial_entries
set competence_date = occurred_at::date
where competence_date is null;

update public.payment_installments
set competence_date = due_date
where competence_date is null;

create index if not exists idx_financial_entries_company_competence
  on public.financial_entries(company_id, competence_date, type);
create index if not exists idx_financial_entries_category
  on public.financial_entries(company_id, category_id);
create index if not exists idx_payment_installments_company_due
  on public.payment_installments(company_id, due_date, type, paid_at);

create or replace function public.sync_financial_category_name()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_name text;
  v_direction text;
begin
  if new.category_id is null then
    return new;
  end if;

  select c.name, c.direction
  into v_name, v_direction
  from public.financial_categories c
  where c.id = new.category_id
    and c.company_id = new.company_id
    and c.active = true;

  if v_name is null then
    raise exception 'Categoria financeira inválida para esta empresa';
  end if;

  if v_direction <> 'both' and v_direction <> new.type then
    raise exception 'A categoria financeira selecionada não aceita lançamentos do tipo %', new.type;
  end if;

  new.category := v_name;
  return new;
end;
$$;

drop trigger if exists sync_financial_entry_category on public.financial_entries;
create trigger sync_financial_entry_category
before insert or update of category_id, company_id, type
on public.financial_entries
for each row execute function public.sync_financial_category_name();

drop trigger if exists sync_payment_installment_category on public.payment_installments;
create trigger sync_payment_installment_category
before insert or update of category_id, company_id, type
on public.payment_installments
for each row execute function public.sync_financial_category_name();

alter table public.financial_accounts enable row level security;
alter table public.financial_categories enable row level security;

drop policy if exists financial_accounts_read on public.financial_accounts;
create policy financial_accounts_read
on public.financial_accounts for select to authenticated
using (private.has_company_permission(company_id, 'finance.view'));

drop policy if exists financial_accounts_manage on public.financial_accounts;
create policy financial_accounts_manage
on public.financial_accounts for all to authenticated
using (private.has_company_permission(company_id, 'finance.manage'))
with check (private.has_company_permission(company_id, 'finance.manage'));

drop policy if exists financial_categories_read on public.financial_categories;
create policy financial_categories_read
on public.financial_categories for select to authenticated
using (private.has_company_permission(company_id, 'finance.view'));

drop policy if exists financial_categories_manage on public.financial_categories;
create policy financial_categories_manage
on public.financial_categories for all to authenticated
using (private.has_company_permission(company_id, 'finance.manage'))
with check (private.has_company_permission(company_id, 'finance.manage'));

create or replace function public.financial_dre_summary(
  p_company uuid,
  p_start date,
  p_end date
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not private.has_company_permission(p_company, 'finance.dre') then
    raise exception 'Usuário sem permissão para visualizar o DRE';
  end if;

  with base as (
    select
      f.type,
      f.amount,
      coalesce(c.name, f.category) as category_name,
      coalesce(
        c.dre_group,
        case when f.type = 'income' then 'other_income' else 'other_expense' end
      ) as dre_group
    from public.financial_entries f
    left join public.financial_categories c on c.id = f.category_id
    where f.company_id = p_company
      and coalesce(f.competence_date, f.occurred_at::date) between p_start and p_end
  ), by_category as (
    select type, category_name, dre_group, sum(amount)::numeric(14,2) as amount
    from base
    group by type, category_name, dre_group
  )
  select jsonb_build_object(
    'gross_revenue', coalesce((select sum(amount) from base where type='income' and dre_group='gross_revenue'),0),
    'deductions', coalesce((select sum(amount) from base where type='expense' and dre_group='deduction'),0),
    'cost_of_sales', coalesce((select sum(amount) from base where type='expense' and dre_group='cost_of_sales'),0),
    'operating_expenses', coalesce((select sum(amount) from base where type='expense' and dre_group='operating_expense'),0),
    'financial_expenses', coalesce((select sum(amount) from base where type='expense' and dre_group='financial_expense'),0),
    'other_income', coalesce((select sum(amount) from base where type='income' and dre_group='other_income'),0),
    'other_expenses', coalesce((select sum(amount) from base where type='expense' and dre_group='other_expense'),0),
    'income_total', coalesce((select sum(amount) from base where type='income'),0),
    'expense_total', coalesce((select sum(amount) from base where type='expense'),0),
    'result', coalesce((select sum(case when type='income' then amount else -amount end) from base),0),
    'by_category', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'type', type,
          'category', category_name,
          'dre_group', dre_group,
          'amount', amount
        ) order by type, dre_group, category_name
      )
      from by_category
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.financial_dre_summary(uuid,date,date) from public, anon;
grant execute on function public.financial_dre_summary(uuid,date,date) to authenticated;

-- ============================================================================
-- 3) ESTOQUE TRANSACIONAL: RESERVA / LIBERAÇÃO / CONSUMO / AJUSTE
-- ============================================================================

alter table public.stock_movements
  drop constraint if exists stock_movements_movement_type_check;
alter table public.stock_movements
  add constraint stock_movements_movement_type_check
  check (movement_type in ('in','out','adjustment','reserve','release','consume'));

drop policy if exists stock_movements_tenant_insert on public.stock_movements;
create policy stock_movements_tenant_insert
on public.stock_movements for insert to authenticated
with check (
  private.has_company_permission(company_id, 'stock.reserve')
  or private.has_company_permission(company_id, 'stock.consume')
  or private.has_company_permission(company_id, 'stock.adjust')
);

create or replace function public.reserve_stock(
  p_stock_item_id uuid,
  p_quantity numeric,
  p_service_order_id uuid default null,
  p_notes text default null,
  p_idempotency_key text default null
)
returns public.stock_items
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_item public.stock_items;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantidade de reserva deve ser maior que zero';
  end if;

  select * into v_item from public.stock_items where id=p_stock_item_id for update;
  if not found then raise exception 'Item de estoque não encontrado'; end if;

  if not private.has_company_permission(v_item.company_id, 'stock.reserve') then
    raise exception 'Usuário sem permissão para reservar estoque';
  end if;

  if p_idempotency_key is not null and exists (
    select 1 from public.stock_movements
    where company_id=v_item.company_id and idempotency_key=p_idempotency_key
  ) then
    return v_item;
  end if;

  if coalesce(v_item.quantity,0)-coalesce(v_item.reserved_quantity,0) < p_quantity then
    raise exception 'Estoque disponível insuficiente para esta reserva';
  end if;

  update public.stock_items
  set reserved_quantity=coalesce(reserved_quantity,0)+p_quantity,
      updated_at=now()
  where id=p_stock_item_id
  returning * into v_item;

  insert into public.stock_movements(
    stock_item_id, service_order_id, movement_type, quantity, unit_cost,
    notes, created_by, company_id, idempotency_key
  ) values (
    p_stock_item_id, p_service_order_id, 'reserve', p_quantity, v_item.cost_price,
    p_notes, auth.uid(), v_item.company_id, p_idempotency_key
  );

  return v_item;
end;
$$;

create or replace function public.release_stock_reservation(
  p_stock_item_id uuid,
  p_quantity numeric,
  p_service_order_id uuid default null,
  p_notes text default null,
  p_idempotency_key text default null
)
returns public.stock_items
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_item public.stock_items;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantidade deve ser maior que zero';
  end if;

  select * into v_item from public.stock_items where id=p_stock_item_id for update;
  if not found then raise exception 'Item de estoque não encontrado'; end if;

  if not (
    private.has_company_permission(v_item.company_id, 'stock.reserve')
    or private.has_company_permission(v_item.company_id, 'stock.consume')
  ) then
    raise exception 'Usuário sem permissão para liberar reserva';
  end if;

  if p_idempotency_key is not null and exists (
    select 1 from public.stock_movements
    where company_id=v_item.company_id and idempotency_key=p_idempotency_key
  ) then
    return v_item;
  end if;

  if coalesce(v_item.reserved_quantity,0) < p_quantity then
    raise exception 'A quantidade informada é maior que a reserva atual';
  end if;

  update public.stock_items
  set reserved_quantity=greatest(coalesce(reserved_quantity,0)-p_quantity,0),
      updated_at=now()
  where id=p_stock_item_id
  returning * into v_item;

  insert into public.stock_movements(
    stock_item_id, service_order_id, movement_type, quantity, unit_cost,
    notes, created_by, company_id, idempotency_key
  ) values (
    p_stock_item_id, p_service_order_id, 'release', p_quantity, v_item.cost_price,
    p_notes, auth.uid(), v_item.company_id, p_idempotency_key
  );

  return v_item;
end;
$$;

create or replace function public.consume_stock(
  p_stock_item_id uuid,
  p_quantity numeric,
  p_service_order_id uuid default null,
  p_notes text default null,
  p_idempotency_key text default null
)
returns public.stock_items
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_item public.stock_items;
  v_reserved_to_release numeric;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantidade de consumo deve ser maior que zero';
  end if;

  select * into v_item from public.stock_items where id=p_stock_item_id for update;
  if not found then raise exception 'Item de estoque não encontrado'; end if;

  if not private.has_company_permission(v_item.company_id, 'stock.consume') then
    raise exception 'Usuário sem permissão para consumir estoque';
  end if;

  if p_idempotency_key is not null and exists (
    select 1 from public.stock_movements
    where company_id=v_item.company_id and idempotency_key=p_idempotency_key
  ) then
    return v_item;
  end if;

  if coalesce(v_item.quantity,0) < p_quantity then
    raise exception 'Estoque físico insuficiente para este consumo';
  end if;

  v_reserved_to_release := least(coalesce(v_item.reserved_quantity,0), p_quantity);

  update public.stock_items
  set quantity=coalesce(quantity,0)-p_quantity,
      reserved_quantity=greatest(coalesce(reserved_quantity,0)-v_reserved_to_release,0),
      updated_at=now()
  where id=p_stock_item_id
  returning * into v_item;

  insert into public.stock_movements(
    stock_item_id, service_order_id, movement_type, quantity, unit_cost,
    notes, created_by, company_id, idempotency_key
  ) values (
    p_stock_item_id, p_service_order_id, 'consume', p_quantity, v_item.cost_price,
    p_notes, auth.uid(), v_item.company_id, p_idempotency_key
  );

  return v_item;
end;
$$;

create or replace function public.adjust_stock(
  p_stock_item_id uuid,
  p_delta numeric,
  p_notes text default null,
  p_idempotency_key text default null
)
returns public.stock_items
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_item public.stock_items;
  v_new_quantity numeric;
begin
  if p_delta is null or p_delta=0 then
    raise exception 'O ajuste deve ser diferente de zero';
  end if;

  select * into v_item from public.stock_items where id=p_stock_item_id for update;
  if not found then raise exception 'Item de estoque não encontrado'; end if;

  if not private.has_company_permission(v_item.company_id, 'stock.adjust') then
    raise exception 'Usuário sem permissão para ajustar estoque';
  end if;

  if p_idempotency_key is not null and exists (
    select 1 from public.stock_movements
    where company_id=v_item.company_id and idempotency_key=p_idempotency_key
  ) then
    return v_item;
  end if;

  v_new_quantity := coalesce(v_item.quantity,0)+p_delta;
  if v_new_quantity < 0 then
    raise exception 'O ajuste deixaria o estoque físico negativo';
  end if;
  if v_new_quantity < coalesce(v_item.reserved_quantity,0) then
    raise exception 'O ajuste deixaria o estoque físico abaixo da quantidade reservada';
  end if;

  update public.stock_items
  set quantity=v_new_quantity,
      updated_at=now()
  where id=p_stock_item_id
  returning * into v_item;

  insert into public.stock_movements(
    stock_item_id, movement_type, quantity, unit_cost,
    notes, created_by, company_id, idempotency_key
  ) values (
    p_stock_item_id, 'adjustment', abs(p_delta), v_item.cost_price,
    concat(coalesce(p_notes,'Ajuste de estoque'),' | delta=',p_delta),
    auth.uid(), v_item.company_id, p_idempotency_key
  );

  return v_item;
end;
$$;

revoke all on function public.reserve_stock(uuid,numeric,uuid,text,text) from public, anon;
revoke all on function public.release_stock_reservation(uuid,numeric,uuid,text,text) from public, anon;
revoke all on function public.consume_stock(uuid,numeric,uuid,text,text) from public, anon;
revoke all on function public.adjust_stock(uuid,numeric,text,text) from public, anon;

grant execute on function public.reserve_stock(uuid,numeric,uuid,text,text) to authenticated;
grant execute on function public.release_stock_reservation(uuid,numeric,uuid,text,text) to authenticated;
grant execute on function public.consume_stock(uuid,numeric,uuid,text,text) to authenticated;
grant execute on function public.adjust_stock(uuid,numeric,text,text) to authenticated;

-- ============================================================================
-- 4) UPDATED_AT / GRANTS
-- ============================================================================

drop trigger if exists set_technical_specialties_updated_at on public.technical_specialties;
create trigger set_technical_specialties_updated_at
before update on public.technical_specialties
for each row execute function public.set_updated_at();

drop trigger if exists set_financial_accounts_updated_at on public.financial_accounts;
create trigger set_financial_accounts_updated_at
before update on public.financial_accounts
for each row execute function public.set_updated_at();

drop trigger if exists set_financial_categories_updated_at on public.financial_categories;
create trigger set_financial_categories_updated_at
before update on public.financial_categories
for each row execute function public.set_updated_at();

grant select, insert, update, delete on public.technical_specialties to authenticated;
grant select, insert, update, delete on public.profile_technical_specialties to authenticated;
grant select, insert, update, delete on public.financial_accounts to authenticated;
grant select, insert, update, delete on public.financial_categories to authenticated;

commit;
