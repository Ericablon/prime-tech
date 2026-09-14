-- PRIME TECH • Core schema
-- Execute em um NOVO projeto Supabase, separado dos demais projetos.
-- O frontend usa apenas ANON KEY. Nunca exponha SERVICE_ROLE no navegador.

begin;
create extension if not exists pgcrypto;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- =========================================================
-- Helpers
-- =========================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =========================================================
-- RBAC: roles + permissions
-- =========================================================
create table if not exists public.roles (
  code text primary key,
  name text not null,
  is_system boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.permissions (
  code text primary key,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.role_permissions (
  role_code text not null references public.roles(code) on delete cascade,
  permission_code text not null references public.permissions(code) on delete cascade,
  primary key (role_code, permission_code)
);

insert into public.roles (code, name, is_system) values
  ('atendimento', 'Atendimento', true),
  ('tecnico', 'Técnico', true),
  ('gestor', 'Gestor', true)
on conflict (code) do nothing;

insert into public.permissions (code, name) values
  ('dashboard.view', 'Visualizar dashboard'),
  ('clients.view', 'Visualizar clientes'),
  ('clients.manage', 'Gerenciar clientes'),
  ('equipment.view', 'Visualizar equipamentos'),
  ('equipment.manage', 'Gerenciar equipamentos'),
  ('orders.view', 'Visualizar ordens de serviço'),
  ('orders.create', 'Criar ordens de serviço'),
  ('orders.tech', 'Executar diagnóstico/manutenção'),
  ('orders.customer_approval', 'Registrar aprovação do cliente'),
  ('orders.delivery', 'Registrar entrega'),
  ('stock.view', 'Visualizar estoque'),
  ('stock.manage', 'Gerenciar estoque'),
  ('finance.view', 'Visualizar financeiro'),
  ('finance.manage', 'Gerenciar financeiro'),
  ('fiscal.view', 'Visualizar fiscal'),
  ('fiscal.manage', 'Gerenciar fiscal'),
  ('reports.view', 'Visualizar relatórios'),
  ('admin.manage', 'Administrar sistema')
on conflict (code) do nothing;

insert into public.role_permissions (role_code, permission_code)
select 'atendimento', code from public.permissions where code in (
  'dashboard.view','clients.view','clients.manage','equipment.view','equipment.manage',
  'orders.view','orders.create','orders.customer_approval','orders.delivery','stock.view'
)
on conflict do nothing;

insert into public.role_permissions (role_code, permission_code)
select 'tecnico', code from public.permissions where code in (
  'dashboard.view','clients.view','equipment.view','orders.view','orders.tech','stock.view'
)
on conflict do nothing;

insert into public.role_permissions (role_code, permission_code)
select 'gestor', code from public.permissions
on conflict do nothing;

-- =========================================================
-- Profiles
-- =========================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role_code text not null default 'atendimento' references public.roles(code),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role_code, active, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email, ''), '@', 1)),
    case
      when new.raw_app_meta_data->>'role_code' in ('atendimento','tecnico','gestor')
        then new.raw_app_meta_data->>'role_code'
      else 'atendimento'
    end,
    coalesce(new.raw_app_meta_data->>'role_code' in ('atendimento','tecnico','gestor'), false), new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure private.handle_new_user();

create or replace function private.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role_code from public.profiles where id = auth.uid() and active = true;
$$;

create or replace function private.has_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    join public.role_permissions rp on rp.role_code = p.role_code
    where p.id = auth.uid()
      and p.active = true
      and rp.permission_code = p_permission
  );
$$;

-- =========================================================
-- Company / brand settings
-- =========================================================
create table if not exists public.company_settings (
  id uuid primary key default gen_random_uuid(),
  trade_name text not null default 'Prime Tech',
  legal_name text,
  document text,
  state_registration text,
  municipal_registration text,
  phone text,
  whatsapp text,
  email text,
  address text,
  instagram text,
  logo_url text,
  budget_validity_days integer not null default 7 check (budget_validity_days > 0),
  warranty_text text,
  footer_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.company_settings (trade_name, logo_url, footer_text)
select 'Prime Tech', '/brand/prime-tech-logo.jpeg', 'Tecnologia que impulsiona.'
where not exists (select 1 from public.company_settings);

-- =========================================================
-- CRM + equipment
-- =========================================================
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  person_type text not null default 'pf' check (person_type in ('pf','pj')),
  name text not null,
  document text,
  phone text,
  email text,
  address text,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists clients_document_unique
on public.clients (document)
where document is not null and btrim(document) <> '';

create table if not exists public.equipment (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete restrict,
  category text not null,
  brand text,
  model text,
  serial_number text,
  accessories text,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists equipment_client_idx on public.equipment(client_id);
create index if not exists equipment_serial_idx on public.equipment(serial_number);

-- =========================================================
-- Service Orders
-- =========================================================
create table if not exists public.service_orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint generated always as identity unique,
  client_id uuid not null references public.clients(id) on delete restrict,
  equipment_id uuid not null references public.equipment(id) on delete restrict,
  assigned_technician_id uuid references public.profiles(id) on delete set null,
  intake_type text not null default 'Orçamento',
  status text not null default 'waiting_technician' check (status in (
    'triage','waiting_technician','diagnosis','budget_ready','waiting_customer','approved',
    'in_repair','waiting_part','ready_for_pickup','delivered','cancelled','warranty'
  )),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  reported_issue text not null,
  diagnosis text,
  technical_notes text,
  approval_status text not null default 'pending' check (approval_status in ('pending','approved','rejected')),
  approval_notes text,
  approved_at timestamptz,
  estimated_days integer,
  total_services numeric(12,2) not null default 0,
  total_parts numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null default 0,
  opened_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz
);

create index if not exists service_orders_status_idx on public.service_orders(status);
create index if not exists service_orders_client_idx on public.service_orders(client_id);
create index if not exists service_orders_equipment_idx on public.service_orders(equipment_id);
create index if not exists service_orders_technician_idx on public.service_orders(assigned_technician_id);

create table if not exists public.service_order_items (
  id uuid primary key default gen_random_uuid(),
  service_order_id uuid not null references public.service_orders(id) on delete cascade,
  kind text not null check (kind in ('service','part')),
  description text not null,
  quantity numeric(12,3) not null default 1 check (quantity > 0),
  unit_price numeric(12,2) not null default 0 check (unit_price >= 0),
  cost_price numeric(12,2) check (cost_price is null or cost_price >= 0),
  stock_item_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.service_order_status_history (
  id uuid primary key default gen_random_uuid(),
  service_order_id uuid not null references public.service_orders(id) on delete cascade,
  from_status text,
  to_status text not null,
  notes text,
  changed_by uuid references public.profiles(id),
  changed_at timestamptz not null default now()
);

create index if not exists order_history_order_idx on public.service_order_status_history(service_order_id, changed_at);

create or replace function public.recalculate_service_order_totals()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_order_id uuid;
begin
  v_order_id := coalesce(new.service_order_id, old.service_order_id);

  update public.service_orders so
  set total_services = coalesce((
        select sum(quantity * unit_price) from public.service_order_items
        where service_order_id = v_order_id and kind = 'service'
      ), 0),
      total_parts = coalesce((
        select sum(quantity * unit_price) from public.service_order_items
        where service_order_id = v_order_id and kind = 'part'
      ), 0),
      total_amount = coalesce((
        select sum(quantity * unit_price) from public.service_order_items
        where service_order_id = v_order_id
      ), 0),
      updated_at = now()
  where id = v_order_id;

  return coalesce(new, old);
end;
$$;

drop trigger if exists recalc_order_totals on public.service_order_items;
create trigger recalc_order_totals
after insert or update or delete on public.service_order_items
for each row execute function public.recalculate_service_order_totals();

create or replace function public.enforce_order_field_permissions()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_role text;
begin
  v_role := private.current_role();

  if v_role = 'gestor' then
    return new;
  end if;

  if (new.diagnosis is distinct from old.diagnosis
      or new.technical_notes is distinct from old.technical_notes
      or new.estimated_days is distinct from old.estimated_days)
     and not private.has_permission('orders.tech') then
    raise exception 'Somente Técnico ou Gestor pode alterar diagnóstico técnico';
  end if;

  if (new.approval_status is distinct from old.approval_status
      or new.approval_notes is distinct from old.approval_notes
      or new.approved_at is distinct from old.approved_at)
     and not private.has_permission('orders.customer_approval') then
    -- Gestor já retornou acima. Alterações automáticas durante ação de atendimento também passam.
    raise exception 'Somente Atendimento ou Gestor pode registrar a decisão do cliente';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_order_fields on public.service_orders;
create trigger enforce_order_fields
before update on public.service_orders
for each row execute function public.enforce_order_field_permissions();

create or replace function public.enforce_order_status_transition()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_role text;
  v_allowed boolean := false;
begin
  if new.status = old.status then
    return new;
  end if;

  v_role := private.current_role();

  if v_role = 'gestor' then
    v_allowed := true;
  else
    v_allowed := (private.has_permission('orders.customer_approval') and old.status = 'waiting_customer' and new.status in ('approved','cancelled'))
      or (private.has_permission('orders.delivery') and old.status = 'ready_for_pickup' and new.status = 'delivered')
      or (private.has_permission('orders.create') and old.status = 'triage' and new.status = 'waiting_technician');
    v_allowed := v_allowed or (private.has_permission('orders.tech') and ((old.status = 'waiting_technician' and new.status in ('diagnosis','waiting_customer'))
      or (old.status = 'diagnosis' and new.status = 'waiting_customer')
      or (old.status = 'approved' and new.status = 'in_repair')
      or (old.status = 'in_repair' and new.status in ('waiting_part','ready_for_pickup'))
      or (old.status = 'waiting_part' and new.status in ('in_repair','ready_for_pickup'))));
  end if;

  if not v_allowed then
    raise exception 'Transição de status não permitida para o perfil %: % -> %', coalesce(v_role,'sem perfil'), old.status, new.status;
  end if;

  if new.status = 'approved' then
    new.approval_status := 'approved';
    new.approved_at := coalesce(new.approved_at, now());
  elsif new.status = 'cancelled' and old.status = 'waiting_customer' then
    new.approval_status := 'rejected';
  elsif new.status = 'delivered' then
    new.closed_at := coalesce(new.closed_at, now());
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_order_status on public.service_orders;
create trigger enforce_order_status
before update of status on public.service_orders
for each row execute function public.enforce_order_status_transition();

create or replace function public.transition_service_order(
  p_order_id uuid,
  p_new_status text,
  p_notes text default null
)
returns public.service_orders
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_old public.service_orders;
  v_new public.service_orders;
begin
  select * into v_old from public.service_orders where id = p_order_id for update;
  if not found then
    raise exception 'Ordem de serviço não encontrada';
  end if;

  if not private.has_permission('orders.view') then
    raise exception 'Usuário sem permissão para acessar ordens de serviço';
  end if;

  update public.service_orders
  set status = p_new_status,
      approval_notes = case when p_new_status in ('approved','cancelled') then coalesce(p_notes, approval_notes) else approval_notes end,
      updated_at = now()
  where id = p_order_id
  returning * into v_new;

  insert into public.service_order_status_history (service_order_id, from_status, to_status, notes, changed_by)
  values (p_order_id, v_old.status, v_new.status, p_notes, auth.uid());

  return v_new;
end;
$$;

grant execute on function public.transition_service_order(uuid, text, text) to authenticated;

-- =========================================================
-- Inventory
-- =========================================================
create table if not exists public.stock_items (
  id uuid primary key default gen_random_uuid(),
  sku text unique not null,
  name text not null,
  description text,
  quantity numeric(12,3) not null default 0,
  minimum_quantity numeric(12,3) not null default 0,
  cost_price numeric(12,2) not null default 0,
  sale_price numeric(12,2) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.service_order_items
  add constraint service_order_items_stock_item_fk
  foreign key (stock_item_id) references public.stock_items(id) on delete set null;

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  stock_item_id uuid not null references public.stock_items(id) on delete restrict,
  service_order_id uuid references public.service_orders(id) on delete set null,
  movement_type text not null check (movement_type in ('in','out','adjustment')),
  quantity numeric(12,3) not null check (quantity > 0),
  unit_cost numeric(12,2),
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- =========================================================
-- Finance
-- =========================================================
create table if not exists public.cash_sessions (
  id uuid primary key default gen_random_uuid(),
  opened_by uuid not null references public.profiles(id),
  opened_at timestamptz not null default now(),
  opening_balance numeric(12,2) not null default 0,
  closed_by uuid references public.profiles(id),
  closed_at timestamptz,
  closing_balance numeric(12,2),
  status text not null default 'open' check (status in ('open','closed')),
  notes text
);

create table if not exists public.financial_entries (
  id uuid primary key default gen_random_uuid(),
  service_order_id uuid references public.service_orders(id) on delete set null,
  cash_session_id uuid references public.cash_sessions(id) on delete set null,
  type text not null check (type in ('income','expense')),
  category text not null,
  description text not null,
  amount numeric(12,2) not null check (amount >= 0),
  payment_method text,
  occurred_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- =========================================================
-- Fiscal documents (metadata only; emission is server-side)
-- =========================================================
create table if not exists public.fiscal_documents (
  id uuid primary key default gen_random_uuid(),
  service_order_id uuid references public.service_orders(id) on delete set null,
  document_type text not null check (document_type in ('nfse','nfe','nfce')),
  status text not null default 'draft' check (status in ('draft','processing','authorized','cancelled','error')),
  external_id text,
  access_key text,
  number text,
  series text,
  total_amount numeric(12,2),
  xml_path text,
  pdf_path text,
  error_message text,
  issued_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- Audit
-- =========================================================
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- =========================================================
-- Updated_at triggers
-- =========================================================
do $$
declare
  t text;
begin
  foreach t in array array['profiles','company_settings','clients','equipment','service_orders','stock_items','fiscal_documents']
  loop
    execute format('drop trigger if exists set_%I_updated_at on public.%I', t, t);
    execute format('create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;

-- =========================================================
-- RLS
-- =========================================================
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.profiles enable row level security;
alter table public.company_settings enable row level security;
alter table public.clients enable row level security;
alter table public.equipment enable row level security;
alter table public.service_orders enable row level security;
alter table public.service_order_items enable row level security;
alter table public.service_order_status_history enable row level security;
alter table public.stock_items enable row level security;
alter table public.stock_movements enable row level security;
alter table public.cash_sessions enable row level security;
alter table public.financial_entries enable row level security;
alter table public.fiscal_documents enable row level security;
alter table public.audit_logs enable row level security;

-- Reference tables
create policy roles_read on public.roles for select to authenticated using (private.current_role() is not null);
create policy permissions_read on public.permissions for select to authenticated using (private.current_role() is not null);
create policy role_permissions_read on public.role_permissions for select to authenticated using (private.current_role() is not null);
create policy role_permissions_admin_all on public.role_permissions for all to authenticated using (private.has_permission('admin.manage')) with check (private.has_permission('admin.manage'));

-- Profiles
create policy profiles_read on public.profiles for select to authenticated using (id = auth.uid() or private.has_permission('admin.manage'));
create policy profiles_admin_all on public.profiles for update to authenticated using (private.has_permission('admin.manage')) with check (private.has_permission('admin.manage'));

-- Company
create policy company_read on public.company_settings for select to authenticated using (private.current_role() is not null);
create policy company_admin_all on public.company_settings for all to authenticated using (private.has_permission('admin.manage')) with check (private.has_permission('admin.manage'));

-- Clients
create policy clients_read on public.clients for select to authenticated using (private.has_permission('clients.view'));
create policy clients_insert on public.clients for insert to authenticated with check (private.has_permission('clients.manage'));
create policy clients_update on public.clients for update to authenticated using (private.has_permission('clients.manage')) with check (private.has_permission('clients.manage'));
create policy clients_delete on public.clients for delete to authenticated using (private.has_permission('admin.manage'));

-- Equipment
create policy equipment_read on public.equipment for select to authenticated using (private.has_permission('equipment.view'));
create policy equipment_insert on public.equipment for insert to authenticated with check (private.has_permission('equipment.manage'));
create policy equipment_update on public.equipment for update to authenticated using (private.has_permission('equipment.manage')) with check (private.has_permission('equipment.manage'));
create policy equipment_delete on public.equipment for delete to authenticated using (private.has_permission('admin.manage'));

-- Orders
create policy orders_read on public.service_orders for select to authenticated using (private.has_permission('orders.view'));
create policy orders_insert on public.service_orders for insert to authenticated with check (private.has_permission('orders.create'));
create policy orders_update on public.service_orders for update to authenticated using (
  private.has_permission('orders.tech') or private.has_permission('orders.customer_approval') or private.has_permission('orders.delivery') or private.has_permission('admin.manage')
) with check (
  private.has_permission('orders.tech') or private.has_permission('orders.customer_approval') or private.has_permission('orders.delivery') or private.has_permission('admin.manage')
);
create policy orders_delete on public.service_orders for delete to authenticated using (private.has_permission('admin.manage'));

-- Order items/history
create policy order_items_read on public.service_order_items for select to authenticated using (private.has_permission('orders.view'));
create policy order_items_write on public.service_order_items for all to authenticated using (private.has_permission('orders.tech') or private.has_permission('admin.manage')) with check (private.has_permission('orders.tech') or private.has_permission('admin.manage'));
create policy order_history_read on public.service_order_status_history for select to authenticated using (private.has_permission('orders.view'));
create policy order_history_insert on public.service_order_status_history for insert to authenticated with check (private.has_permission('orders.view'));

-- Stock
create policy stock_read on public.stock_items for select to authenticated using (private.has_permission('stock.view'));
create policy stock_manage on public.stock_items for all to authenticated using (private.has_permission('stock.manage')) with check (private.has_permission('stock.manage'));
create policy stock_movements_read on public.stock_movements for select to authenticated using (private.has_permission('stock.view'));
create policy stock_movements_manage on public.stock_movements for all to authenticated using (private.has_permission('stock.manage') or private.has_permission('orders.tech')) with check (private.has_permission('stock.manage') or private.has_permission('orders.tech'));

-- Finance
create policy cash_read on public.cash_sessions for select to authenticated using (private.has_permission('finance.view'));
create policy cash_manage on public.cash_sessions for all to authenticated using (private.has_permission('finance.manage')) with check (private.has_permission('finance.manage'));
create policy finance_read on public.financial_entries for select to authenticated using (private.has_permission('finance.view'));
create policy finance_manage on public.financial_entries for all to authenticated using (private.has_permission('finance.manage')) with check (private.has_permission('finance.manage'));

-- Fiscal
create policy fiscal_read on public.fiscal_documents for select to authenticated using (private.has_permission('fiscal.view'));
create policy fiscal_manage on public.fiscal_documents for all to authenticated using (private.has_permission('fiscal.manage')) with check (private.has_permission('fiscal.manage'));

-- Audit
create policy audit_read on public.audit_logs for select to authenticated using (private.has_permission('admin.manage'));
create policy audit_insert on public.audit_logs for insert to authenticated with check (auth.uid() = user_id or private.has_permission('admin.manage'));

-- Basic grants. RLS remains the actual access gate.
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
-- Administrative changes are atomic and cannot remove the management role.
alter table public.profiles add column email text;
alter table public.profiles add column job_title text;
alter table public.profiles add column phone text;

create or replace function public.save_role_permissions(p_role text, p_permissions text[])
returns void language plpgsql security invoker set search_path = public as $$
begin
  if not private.has_permission('admin.manage') then raise exception 'Acesso negado'; end if;
  if p_role not in ('atendimento','tecnico') then raise exception 'O papel Gestor é protegido'; end if;
  if p_permissions is null or 'admin.manage' = any(p_permissions) then raise exception 'Permissões inválidas'; end if;
  if exists(select 1 from unnest(p_permissions) p where not exists(select 1 from public.permissions where code=p)) then raise exception 'Permissão desconhecida'; end if;
  perform pg_advisory_xact_lock(hashtext('prime-tech-permissions'));
  delete from public.role_permissions where role_code=p_role;
  insert into public.role_permissions(role_code,permission_code)
  select p_role, p from (select distinct unnest(p_permissions) p union select 'dashboard.view') q;
  insert into public.audit_logs(user_id,action,entity_type,metadata)
  values(auth.uid(),'permissions.updated','role',jsonb_build_object('role',p_role,'permissions',p_permissions));
end $$;

create or replace function private.protect_administration()
returns trigger language plpgsql security invoker set search_path=public as $$
begin
  if tg_table_name='profiles' then
    if auth.uid() is not null and old.id=auth.uid() and
      (new.role_code is distinct from old.role_code or new.active is distinct from old.active)
      then raise exception 'Você não pode alterar seu próprio acesso'; end if;
    if old.active and old.role_code='gestor' and (not new.active or new.role_code<>'gestor') then
      perform pg_advisory_xact_lock(hashtext('prime-tech-managers'));
      if not exists(select 1 from public.profiles where active and role_code='gestor' and id<>old.id)
        then raise exception 'Mantenha ao menos um Gestor ativo'; end if;
    end if;
    return new;
  end if;
  if tg_op<>'INSERT' and old.role_code='gestor' then raise exception 'Permissões do Gestor são protegidas'; end if;
  if tg_op<>'DELETE' and (new.role_code='gestor' or new.permission_code='admin.manage') then raise exception 'Administração é exclusiva do Gestor'; end if;
  return coalesce(new,old);
end $$;
create trigger protect_profile_access before update on public.profiles for each row execute function private.protect_administration();
create trigger protect_role_permissions before insert or update or delete on public.role_permissions for each row execute function private.protect_administration();

create index on public.service_order_items(service_order_id);
revoke all on all functions in schema private from public,anon;
grant execute on function private.current_role(),private.has_permission(text) to authenticated;
revoke execute on all functions in schema public from public,anon;
grant execute on function public.transition_service_order(uuid,text,text),public.save_role_permissions(text,text[]) to authenticated;
revoke all on all tables in schema public from anon;
commit;
