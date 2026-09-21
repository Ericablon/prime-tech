-- One installation per company. Apply once, after commercial-workflow.sql.
begin;
create table public.auxiliary_catalogs (
 id uuid primary key default gen_random_uuid(),
 kind text not null check(kind in ('equipment_category','brand','intake_type','supplier','purchase_type','finance_category','payment_method','payment_term','service')),
 code text not null default gen_random_uuid()::text,
 name text not null check(length(trim(name)) between 1 and 300),
 details jsonb not null default '{}' check(jsonb_typeof(details)='object'),
 active boolean not null default true,
 unique(kind,code)
);
create unique index auxiliary_catalogs_name on public.auxiliary_catalogs(kind,lower(trim(name)));
alter table public.auxiliary_catalogs enable row level security;
revoke all on public.auxiliary_catalogs from anon,authenticated;
grant select,insert,update on public.auxiliary_catalogs to authenticated;
create function private.can_manage_catalog(k text) returns boolean language sql stable security invoker set search_path=public as $$
 select private.has_permission('admin.manage') or case when k in ('supplier','purchase_type','finance_category','payment_method','payment_term') then private.has_permission('finance.manage') when k='service' then private.has_permission('orders.tech') or private.has_permission('orders.customer_approval') else private.has_permission('equipment.manage') end;
$$;
create policy catalog_read on public.auxiliary_catalogs for select to authenticated using(private.has_permission('orders.view') or private.has_permission('finance.view'));
create policy catalog_insert on public.auxiliary_catalogs for insert to authenticated with check(private.can_manage_catalog(kind));
create policy catalog_update on public.auxiliary_catalogs for update to authenticated using(private.can_manage_catalog(kind)) with check(private.can_manage_catalog(kind));
create function private.guard_catalog() returns trigger language plpgsql security invoker set search_path=public as $$
begin
 if tg_op='UPDATE' and (new.id<>old.id or new.kind<>old.kind or new.code<>old.code) then raise exception 'Identificação do cadastro não pode ser alterada'; end if;
 if new.kind='payment_term' and (coalesce(new.details->>'installments','') !~ '^[0-9]+$' or (new.details->>'installments')::numeric not between 1 and 36) then raise exception 'Informe de 1 a 36 parcelas'; end if;
 if new.kind='service' and (coalesce(new.details->>'price','') !~ '^[0-9]+(\.[0-9]{1,2})?$') then raise exception 'Preço de serviço inválido'; end if;
 return new;
end $$;
create trigger guard_catalog before insert or update on public.auxiliary_catalogs for each row execute function private.guard_catalog();
insert into public.auxiliary_catalogs(kind,code,name,details) values
 ('equipment_category','notebook','Notebook','{}'),('equipment_category','desktop','Desktop','{}'),('equipment_category','celular','Celular','{}'),
 ('brand','dell','Dell','{}'),('brand','lenovo','Lenovo','{}'),('brand','samsung','Samsung','{}'),
 ('intake_type','orcamento','Orçamento','{}'),('intake_type','manutencao','Manutenção','{}'),('intake_type','garantia','Garantia','{}'),('intake_type','avaliacao','Avaliação técnica','{}'),
 ('purchase_type','pecas','Compra de peças','{}'),('purchase_type','consumo','Material de consumo','{}'),
 ('finance_category','servicos','Serviços de assistência','{}'),('finance_category','vendas','Vendas','{}'),('finance_category','compras','Compras','{}'),('finance_category','despesas','Despesas operacionais','{}'),
 ('payment_method','cash','Dinheiro','{}'),('payment_method','pix','Pix','{}'),('payment_method','credit_card','Cartão de crédito','{}'),('payment_method','debit_card','Cartão de débito','{}'),('payment_method','boleto','Boleto','{}'),('payment_method','transfer','Transferência','{}'),
 ('payment_term','avista','À vista','{"installments":1}'),('payment_term','3x','3 parcelas mensais','{"installments":3}'),('service','diagnostico','Avaliação técnica','{"price":0}');
-- Preserve labels already in use.
insert into public.auxiliary_catalogs(kind,code,name)
select 'equipment_category',gen_random_uuid()::text,category from (select distinct trim(category) category from equipment where length(trim(category))>0) s on conflict do nothing;
insert into public.auxiliary_catalogs(kind,code,name)
select 'brand',gen_random_uuid()::text,brand from (select distinct trim(brand) brand from equipment where length(trim(brand))>0) s on conflict do nothing;
alter table public.payment_installments drop constraint payment_installments_payment_method_check;
create function private.validate_payment_method() returns trigger language plpgsql security invoker set search_path=public as $$
begin
 if tg_op='INSERT' or new.payment_method is distinct from old.payment_method then
  if not exists(select 1 from auxiliary_catalogs where kind='payment_method' and code=new.payment_method and active) then raise exception 'Selecione uma forma de pagamento ativa'; end if;
 end if; return new;
end $$;
create trigger validate_installment_method before insert or update on public.payment_installments for each row execute function private.validate_payment_method();

create table public.daily_cash_closings (
 id uuid primary key default gen_random_uuid(), business_date date not null unique,
 opening_amount numeric(12,2) not null check(opening_amount>=0), counted_cash numeric(12,2) not null check(counted_cash>=0),
 income numeric(12,2) not null, expense numeric(12,2) not null, expected_cash numeric(12,2) not null, difference numeric(12,2) not null,
 payment_summary jsonb not null, notes text not null default '', closed_by uuid not null references profiles(id), closed_at timestamptz not null default now()
);
alter table public.daily_cash_closings enable row level security;
revoke all on public.daily_cash_closings from anon,authenticated;
grant select,insert on public.daily_cash_closings to authenticated;
create policy cash_closings_read on public.daily_cash_closings for select to authenticated using(private.has_permission('finance.view'));
create policy cash_closings_insert on public.daily_cash_closings for insert to authenticated with check(private.has_permission('finance.manage') and closed_by=auth.uid());
create index financial_entries_business_day on public.financial_entries (((occurred_at at time zone 'America/Sao_Paulo')::date));
create function private.guard_closed_day() returns trigger language plpgsql security invoker set search_path=public as $$
declare d date; old_d date;
begin
 -- One lock serializes postings with the closing snapshot, including payments from installments.
 perform pg_advisory_xact_lock(7261901);
 if tg_op<>'INSERT' then old_d:=(old.occurred_at at time zone 'America/Sao_Paulo')::date; end if;
 if tg_op<>'DELETE' then
  d:=(new.occurred_at at time zone 'America/Sao_Paulo')::date;
  if d>(now() at time zone 'America/Sao_Paulo')::date then raise exception 'Lançamentos recebidos/pagos não podem ter data futura'; end if;
  if new.amount<=0 then raise exception 'Informe um valor positivo'; end if;
 end if;
 if exists(select 1 from daily_cash_closings where business_date in(d,old_d)) then raise exception 'Caixa deste dia já foi fechado. Registre ajustes em um dia aberto.'; end if;
 if tg_op='DELETE' then return old; end if; return new;
end $$;
create trigger guard_closed_day before insert or update or delete on public.financial_entries for each row execute function private.guard_closed_day();
create function private.calculate_cash_closing() returns trigger language plpgsql security invoker set search_path=public as $$
declare cash_in numeric; cash_out numeric;
begin
 if not private.has_permission('finance.manage') then raise exception 'Sem permissão financeira'; end if;
 perform pg_advisory_xact_lock(7261901);
 if new.business_date>(now() at time zone 'America/Sao_Paulo')::date then raise exception 'Não é possível fechar um dia futuro'; end if;
 select coalesce(sum(amount) filter(where type='income'),0),coalesce(sum(amount) filter(where type='expense'),0),coalesce(sum(amount) filter(where type='income' and payment_method='cash'),0),coalesce(sum(amount) filter(where type='expense' and payment_method='cash'),0)
 into new.income,new.expense,cash_in,cash_out from financial_entries where (occurred_at at time zone 'America/Sao_Paulo')::date=new.business_date;
 new.expected_cash:=new.opening_amount+cash_in-cash_out;new.difference:=new.counted_cash-new.expected_cash;
 if new.difference<>0 and length(trim(new.notes))<3 then raise exception 'Justifique a diferença na conferência'; end if;
 select coalesce(jsonb_agg(to_jsonb(s)),'[]') into new.payment_summary from (select coalesce(payment_method,'unclassified') method, sum(amount) filter(where type='income') income,sum(amount) filter(where type='expense') expense from financial_entries where (occurred_at at time zone 'America/Sao_Paulo')::date=new.business_date group by payment_method) s;
 new.closed_by:=auth.uid();new.closed_at:=now();return new;
end $$;
create trigger calculate_cash_closing before insert on public.daily_cash_closings for each row execute function private.calculate_cash_closing();
create function public.close_daily_cash(p_date date,p_opening numeric,p_counted numeric,p_notes text) returns uuid language plpgsql security invoker set search_path=public as $$
declare result uuid;
begin
 insert into daily_cash_closings(business_date,opening_amount,counted_cash,notes) values(p_date,p_opening,p_counted,coalesce(p_notes,'')) returning id into result;return result;
end $$;
revoke all on function public.close_daily_cash(date,numeric,numeric,text) from public,anon;
grant execute on function public.close_daily_cash(date,numeric,numeric,text) to authenticated;
commit;
