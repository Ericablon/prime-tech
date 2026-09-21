-- Cronos SaaS foundation v0.3
-- Apply AFTER the legacy core migration, first in a development/homologation project.
begin;
create extension if not exists pgcrypto;

create table if not exists public.organizations(
 id uuid primary key default gen_random_uuid(), name text not null, slug text not null unique,
 active boolean not null default true, created_at timestamptz not null default now()
);
create table if not exists public.companies(
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict,
 legal_name text not null, trade_name text not null, document text not null, active boolean not null default true,
 created_at timestamptz not null default now(), unique(organization_id,document)
);
create table if not exists public.branches(
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete restrict,
 name text not null, code text not null, active boolean not null default true, created_at timestamptz not null default now(), unique(company_id,code)
);
create table if not exists public.user_company_access(
 user_id uuid not null references auth.users(id) on delete cascade, company_id uuid not null references public.companies(id) on delete cascade,
 branch_id uuid references public.branches(id) on delete cascade, role_code text not null, active boolean not null default true,
 primary key(user_id,company_id,branch_id)
);

alter table public.clients add column if not exists company_id uuid references public.companies(id);
alter table public.equipment add column if not exists company_id uuid references public.companies(id);
alter table public.service_orders add column if not exists company_id uuid references public.companies(id);
alter table public.stock_items add column if not exists company_id uuid references public.companies(id);
alter table public.stock_movements add column if not exists company_id uuid references public.companies(id);
alter table public.financial_entries add column if not exists company_id uuid references public.companies(id);
alter table public.fiscal_documents add column if not exists company_id uuid references public.companies(id);

-- Duplicity guards scoped by company.
drop index if exists clients_document_unique;
create unique index if not exists uq_clients_company_document on public.clients(company_id,document) where document is not null and btrim(document)<>'';
create unique index if not exists uq_equipment_company_serial on public.equipment(company_id,serial_number) where serial_number is not null and btrim(serial_number)<>'';
create unique index if not exists uq_stock_company_sku on public.stock_items(company_id,sku);

-- Prevent more than one active order for the same equipment, except warranty (adjust rule if business needs it).
create unique index if not exists uq_active_order_per_equipment on public.service_orders(company_id,equipment_id)
where status not in ('delivered','cancelled');

-- Inventory becomes movement-ledger based. physical_quantity is a projection, not a manually editable truth.
alter table public.stock_items add column if not exists reserved_quantity numeric(12,3) not null default 0;
alter table public.stock_movements add column if not exists idempotency_key text;
create unique index if not exists uq_stock_movement_idempotency on public.stock_movements(company_id,idempotency_key) where idempotency_key is not null;

create or replace function public.available_stock(p_item uuid) returns numeric language sql stable set search_path=public as $$
 select greatest(coalesce(quantity,0)-coalesce(reserved_quantity,0),0) from public.stock_items where id=p_item;
$$;

-- Commercial/fiscal workflow hardening.
alter table public.fiscal_documents add column if not exists idempotency_key text;
alter table public.fiscal_documents add column if not exists environment text not null default 'homologation';
alter table public.fiscal_documents add column if not exists provider text;
alter table public.fiscal_documents add column if not exists provider_reference text;
alter table public.fiscal_documents add column if not exists protocol text;
create unique index if not exists uq_fiscal_idempotency on public.fiscal_documents(company_id,idempotency_key) where idempotency_key is not null;

create table if not exists public.fiscal_settings(
 id uuid primary key default gen_random_uuid(), company_id uuid not null unique references public.companies(id) on delete cascade,
 environment text not null default 'homologation' check(environment in ('homologation','production')),
 gateway_provider text, nfse_enabled boolean not null default false, nfe_enabled boolean not null default false,
 issue_mode text not null default 'review' check(issue_mode in ('manual','review','after_completion','after_billing')),
 settings jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.fiscal_events(
 id uuid primary key default gen_random_uuid(), fiscal_document_id uuid not null references public.fiscal_documents(id) on delete cascade,
 event_type text not null, status text not null, protocol text, payload jsonb not null default '{}'::jsonb,
 created_by uuid references auth.users(id), created_at timestamptz not null default now()
);

-- Generic audit with tenant context.
alter table public.audit_logs add column if not exists company_id uuid references public.companies(id);
alter table public.audit_logs add column if not exists correlation_id uuid default gen_random_uuid();

-- Important: existing RLS from v0.2 must be replaced in the target database by tenant-aware policies
-- using user_company_access. This migration intentionally does not silently weaken current RLS.
commit;
