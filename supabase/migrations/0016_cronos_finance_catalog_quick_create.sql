-- CRONOS / Prime Tech — catálogo financeiro dinâmico + vínculos em lançamentos/parcelas
-- Aplicar APÓS 0015_cronos_custom_profile_storage_policies.sql
-- Compatível com bases em que partes das migrations 0002/0005/0007 não foram aplicadas.

begin;

-- ============================================================================
-- 1) GARANTE A BASE FINANCEIRA LEGADA / TENANT
-- ============================================================================

-- O Cronos antigo já pode ter payment_installments, porém sem company_id.
-- Se a tabela não existir, cria a estrutura mínima usada pelo frontend atual.
create table if not exists public.payment_installments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete restrict,
  plan_id uuid not null,
  installment_number integer not null,
  installment_count integer not null check (installment_count between 1 and 36),
  service_order_id uuid references public.service_orders(id) on delete restrict,
  type text not null check (type in ('income','expense')),
  category text not null,
  description text not null,
  amount numeric(12,2) not null check (amount > 0),
  due_date date not null,
  payment_method text not null,
  paid_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (plan_id, installment_number),
  check (installment_number between 1 and installment_count)
);

-- Garante colunas tenant/financeiras antes de qualquer UPDATE que as utilize.
alter table public.financial_entries
  add column if not exists company_id uuid references public.companies(id),
  add column if not exists installment_id uuid;

alter table public.payment_installments
  add column if not exists company_id uuid references public.companies(id) on delete restrict;

-- Backfill tenant a partir da OS vinculada.
update public.financial_entries f
set company_id = so.company_id
from public.service_orders so
where f.company_id is null
  and f.service_order_id = so.id
  and so.company_id is not null;

update public.payment_installments p
set company_id = so.company_id
from public.service_orders so
where p.company_id is null
  and p.service_order_id = so.id
  and so.company_id is not null;

-- Para registros sem OS, só associa automaticamente quando o criador pertence
-- a exatamente uma empresa ativa. Casos ambíguos permanecem sem tenant.
update public.financial_entries f
set company_id = (
  select u.company_id
  from public.user_company_access u
  where u.user_id = f.created_by
    and u.active = true
  order by u.company_id
  limit 1
)
where f.company_id is null
  and f.created_by is not null
  and 1 = (
    select count(distinct u.company_id)
    from public.user_company_access u
    where u.user_id = f.created_by
      and u.active = true
  );

update public.payment_installments p
set company_id = (
  select u.company_id
  from public.user_company_access u
  where u.user_id = p.created_by
    and u.active = true
  order by u.company_id
  limit 1
)
where p.company_id is null
  and p.created_by is not null
  and 1 = (
    select count(distinct u.company_id)
    from public.user_company_access u
    where u.user_id = p.created_by
      and u.active = true
  );

-- ============================================================================
-- 2) CATÁLOGO DE CONTAS E CATEGORIAS
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

-- FK de installment_id pode não existir em instalações antigas.
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

create unique index if not exists uq_financial_entries_installment
on public.financial_entries(installment_id)
where installment_id is not null;

-- Define conta padrão e tenta mapear categorias legadas pelo nome.
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

-- ============================================================================
-- 3) SINCRONIZA NOME DA CATEGORIA
-- ============================================================================

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

-- ============================================================================
-- 4) RLS / GRANTS
-- ============================================================================

alter table public.financial_accounts enable row level security;
alter table public.financial_categories enable row level security;
alter table public.payment_installments enable row level security;

grant select, insert, update, delete on public.financial_accounts to authenticated;
grant select, insert, update, delete on public.financial_categories to authenticated;
grant select, insert, update on public.payment_installments to authenticated;
revoke all on public.financial_accounts, public.financial_categories, public.payment_installments from anon;

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

drop policy if exists installments_read on public.payment_installments;
drop policy if exists installments_create on public.payment_installments;
drop policy if exists installments_update on public.payment_installments;
drop policy if exists installments_tenant_read on public.payment_installments;
drop policy if exists installments_tenant_insert on public.payment_installments;
drop policy if exists installments_tenant_update on public.payment_installments;

create policy installments_tenant_read
on public.payment_installments for select to authenticated
using (company_id is not null and private.has_company_permission(company_id, 'finance.view'));

create policy installments_tenant_insert
on public.payment_installments for insert to authenticated
with check (
  company_id is not null
  and created_by = auth.uid()
  and private.has_company_permission(company_id, 'finance.manage')
);

create policy installments_tenant_update
on public.payment_installments for update to authenticated
using (company_id is not null and private.has_company_permission(company_id, 'finance.manage'))
with check (company_id is not null and private.has_company_permission(company_id, 'finance.manage'));

-- ============================================================================
-- 5) DRE
-- ============================================================================

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
-- 6) FORMAS DE PAGAMENTO E BAIXA DE PARCELA
-- ============================================================================

alter table public.payment_installments
  drop constraint if exists payment_installments_payment_method_check;

alter table public.payment_installments
  add constraint payment_installments_payment_method_check
  check (payment_method in (
    'cash','pix','credit_card','debit_card','boleto','transfer','store_credit','check','other'
  ));

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
      category_id,
      account_id,
      competence_date,
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
      new.category_id,
      new.account_id,
      coalesce(new.competence_date, new.due_date),
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

revoke all on function private.post_installment() from public, anon;

drop trigger if exists post_installment on public.payment_installments;
create trigger post_installment
after insert or update on public.payment_installments
for each row execute function private.post_installment();

-- ============================================================================
-- 7) PLANO DE PAGAMENTO COM CATEGORIA / CONTA
-- ============================================================================

drop function if exists public.create_payment_plan(
  uuid, uuid, text, text, text, numeric, integer, date, text, boolean
);

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
  p_paid boolean default false,
  p_category_id uuid default null,
  p_account_id uuid default null
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
  v_category_name text;
  v_category_direction text;
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

  if p_type not in ('income','expense') then
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
  then
    raise exception 'Revise valor, parcelas, data e descrição';
  end if;

  if p_method not in (
    'cash','pix','credit_card','debit_card','boleto','transfer','store_credit','check','other'
  ) then
    raise exception 'Forma de pagamento inválida';
  end if;

  if p_paid and p_count <> 1 then
    raise exception 'Baixe cada parcela após confirmar o pagamento';
  end if;

  if p_order_id is not null then
    select * into v_order
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

  if p_category_id is not null then
    select c.name, c.direction
    into v_category_name, v_category_direction
    from public.financial_categories c
    where c.id = p_category_id
      and c.company_id = v_company
      and c.active = true;

    if not found then
      raise exception 'Categoria financeira inválida para esta empresa';
    end if;

    if v_category_direction <> 'both' and v_category_direction <> p_type then
      raise exception 'A categoria financeira não aceita este tipo de lançamento';
    end if;
  else
    v_category_name := trim(coalesce(p_category, ''));
  end if;

  if length(v_category_name) = 0 then
    raise exception 'Categoria financeira obrigatória';
  end if;

  if p_account_id is not null and not exists (
    select 1
    from public.financial_accounts a
    where a.id = p_account_id
      and a.company_id = v_company
      and a.active = true
  ) then
    raise exception 'Conta financeira inválida para esta empresa';
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

    v_due := (p_first_due + make_interval(months => v_n - 1))::date;

    insert into public.payment_installments (
      company_id,
      plan_id,
      installment_number,
      installment_count,
      service_order_id,
      type,
      category,
      category_id,
      account_id,
      competence_date,
      description,
      amount,
      due_date,
      payment_method,
      paid_at,
      created_by
    ) values (
      v_company,
      p_request_id,
      v_n,
      p_count,
      p_order_id,
      p_type,
      v_category_name,
      p_category_id,
      p_account_id,
      v_due,
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

revoke all on function public.create_payment_plan(
  uuid,uuid,text,text,text,numeric,integer,date,text,boolean,uuid,uuid
) from public, anon;

grant execute on function public.create_payment_plan(
  uuid,uuid,text,text,text,numeric,integer,date,text,boolean,uuid,uuid
) to authenticated;

commit;
