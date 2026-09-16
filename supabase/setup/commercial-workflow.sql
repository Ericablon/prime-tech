begin;
alter table public.equipment add column technical_number bigint generated always as identity;
create unique index equipment_technical_number_key on public.equipment(technical_number);
drop policy appointments_manage on public.service_appointments;
create policy appointments_manage on public.service_appointments for all to authenticated using(private.has_permission('orders.customer_approval')) with check(private.has_permission('orders.customer_approval'));
create policy profiles_schedule_read on public.profiles for select to authenticated using(private.has_permission('orders.customer_approval') and active and role_code in ('tecnico','gestor'));
update public.roles set name='Comercial' where code='atendimento';
insert into public.role_permissions(role_code,permission_code) values ('atendimento','finance.view'),('atendimento','finance.manage') on conflict do nothing;

create or replace function public.enforce_order_status_transition() returns trigger language plpgsql security invoker set search_path=public as $$
declare allowed boolean;
begin
 if new.status=old.status then return new; end if;
 allowed := (private.has_permission('orders.tech') and (
  (old.status='waiting_technician' and new.status in ('diagnosis','budget_ready')) or
  (old.status='diagnosis' and new.status='budget_ready') or
  (old.status='approved' and new.status='in_repair') or
  (old.status='in_repair' and new.status in ('waiting_part','ready_for_pickup')) or
  (old.status='waiting_part' and new.status='in_repair')))
  or (private.has_permission('orders.customer_approval') and (
  (old.status='budget_ready' and new.status in ('waiting_customer','diagnosis')) or
  (old.status='waiting_customer' and new.status in ('approved','cancelled','diagnosis'))))
  or (private.has_permission('orders.delivery') and old.status='ready_for_pickup' and new.status='delivered')
  or (private.has_permission('orders.create') and old.status='triage' and new.status='waiting_technician');
 if not coalesce(allowed,false) then raise exception 'Transição não permitida: % → %',old.status,new.status; end if;
 if new.status='approved' then new.approval_status:='approved'; new.approved_at:=now();
 elsif new.status='cancelled' then new.approval_status:='rejected';
 elsif new.status='delivered' then new.closed_at:=now(); end if;
 return new;
end $$;

drop policy order_items_write on public.service_order_items;
create policy order_items_write on public.service_order_items for all to authenticated
using(private.has_permission('orders.tech') or (private.has_permission('orders.customer_approval') and exists(select 1 from public.service_orders o where o.id=service_order_id and o.status='budget_ready')))
with check(private.has_permission('orders.tech') or (private.has_permission('orders.customer_approval') and exists(select 1 from public.service_orders o where o.id=service_order_id and o.status='budget_ready')));

create or replace function public.save_technical_quote(p_order_id uuid,p_diagnosis text,p_days integer,p_items jsonb,p_submit boolean,p_expected_updated_at timestamptz)
returns public.service_orders language plpgsql security invoker set search_path=public as $$
declare current_order public.service_orders; result public.service_orders; item jsonb; commercial boolean;
begin
 select * into current_order from service_orders where id=p_order_id for update;
 if not found then raise exception 'Ordem não encontrada'; end if;
 commercial := current_order.status='budget_ready' and private.has_permission('orders.customer_approval');
 if not commercial and not (private.has_permission('orders.tech') and current_order.status in ('waiting_technician','diagnosis')) then raise exception 'Sem permissão para editar este orçamento nesta etapa'; end if;
 if current_order.updated_at is distinct from p_expected_updated_at then raise exception 'A OS foi alterada. Atualize antes de salvar'; end if;
 if p_days is null or p_days<1 or p_days>365 then raise exception 'Prazo deve ser entre 1 e 365 dias'; end if;
 if p_items is null or jsonb_typeof(p_items)<>'array' then raise exception 'Itens inválidos'; end if;
 if jsonb_array_length(p_items)>100 then raise exception 'Limite de 100 itens'; end if;
 if p_submit and (length(trim(coalesce(case when commercial then current_order.diagnosis else p_diagnosis end,'')))<3 or jsonb_array_length(p_items)=0) then raise exception 'Informe diagnóstico e itens'; end if;
 for item in select * from jsonb_array_elements(p_items) loop
  if coalesce(item->>'kind','') not in ('service','part') or length(trim(coalesce(item->>'description','')))=0 or coalesce((item->>'quantity')::numeric,0)<=0 or coalesce((item->>'unit_price')::numeric,-1)<0 then raise exception 'Itens inválidos'; end if;
 end loop;
 if not commercial then update service_orders set diagnosis=coalesce(p_diagnosis,''),estimated_days=p_days where id=p_order_id; end if;
 delete from service_order_items where service_order_id=p_order_id;
 insert into service_order_items(service_order_id,kind,description,quantity,unit_price,cost_price)
 select p_order_id,i->>'kind',trim(i->>'description'),(i->>'quantity')::numeric,(i->>'unit_price')::numeric,coalesce((i->>'cost_price')::numeric,0) from jsonb_array_elements(p_items) i;
 if p_submit then perform transition_service_order(p_order_id,case when commercial then 'waiting_customer' else 'budget_ready' end,case when commercial then 'Comercial registrou envio do orçamento ao cliente' else 'Avaliação concluída; orçamento enviado ao Comercial' end); end if;
 insert into audit_logs(user_id,action,entity_type,entity_id) values(auth.uid(),'quote.saved','service_order',p_order_id);
 select * into result from service_orders where id=p_order_id; return result;
end $$;

create table public.payment_installments (
 id uuid primary key default gen_random_uuid(), plan_id uuid not null, installment_number integer not null,
 installment_count integer not null check(installment_count between 1 and 36),
 service_order_id uuid references public.service_orders(id), type text not null check(type in ('income','expense')),
 category text not null, description text not null, amount numeric(12,2) not null check(amount>0), due_date date not null,
 payment_method text not null check(payment_method in ('cash','pix','credit_card','debit_card','boleto','transfer')),
 paid_at timestamptz, created_by uuid not null references public.profiles(id), created_at timestamptz not null default now(),
 unique(plan_id,installment_number),check(installment_number between 1 and installment_count)
);
alter table public.payment_installments enable row level security;
grant select,insert,update on public.payment_installments to authenticated;
revoke all on public.payment_installments from anon;
create policy installments_read on public.payment_installments for select to authenticated using(private.has_permission('finance.view'));
create policy installments_create on public.payment_installments for insert to authenticated with check(private.has_permission('finance.manage') and created_by=auth.uid());
create policy installments_update on public.payment_installments for update to authenticated using(private.has_permission('finance.manage')) with check(private.has_permission('finance.manage'));
create index installments_order_idx on public.payment_installments(service_order_id);
create index installments_due_idx on public.payment_installments(due_date) where paid_at is null;
alter table public.financial_entries add column installment_id uuid unique references public.payment_installments(id);

create function private.guard_installment() returns trigger language plpgsql security invoker set search_path=public as $$
declare total numeric; allocated numeric;
begin
 if tg_op='UPDATE' then
  if (to_jsonb(new)-'paid_at') is distinct from (to_jsonb(old)-'paid_at') then raise exception 'As condições registradas não podem ser alteradas'; end if;
  if old.paid_at is not null and new.paid_at is distinct from old.paid_at then raise exception 'Parcela já liquidada'; end if;
 elsif new.service_order_id is not null and new.type='income' then
  select total_amount into total from service_orders where id=new.service_order_id and status in ('approved','in_repair','waiting_part','ready_for_pickup','delivered') for update;
  if not found then raise exception 'Registre a aprovação antes das condições de pagamento'; end if;
  select coalesce(sum(amount),0) into allocated from payment_installments where service_order_id=new.service_order_id and type='income';
  allocated:=allocated+coalesce((select sum(amount) from financial_entries where service_order_id=new.service_order_id and type='income' and installment_id is null),0);
  if allocated+new.amount>total then raise exception 'Valor excede o saldo da OS'; end if;
 end if;
 return new;
end $$;
create trigger guard_installment before insert or update on public.payment_installments for each row execute function private.guard_installment();
create function private.post_installment() returns trigger language plpgsql security invoker set search_path=public as $$
begin
 if new.paid_at is not null then
  insert into financial_entries(type,category,description,amount,occurred_at,service_order_id,payment_method,created_by,installment_id)
  values(new.type,new.category,new.description||' ('||new.installment_number||'/'||new.installment_count||')',new.amount,new.paid_at,new.service_order_id,new.payment_method,auth.uid(),new.id) on conflict(installment_id) do nothing;
 end if; return new;
end $$;
create trigger post_installment after insert or update on public.payment_installments for each row execute function private.post_installment();

create function public.create_payment_plan(p_request_id uuid,p_order_id uuid,p_type text,p_category text,p_description text,p_amount numeric,p_count integer,p_first_due date,p_method text,p_paid boolean default false)
returns void language plpgsql security invoker set search_path=public as $$
declare n integer; cents bigint; piece numeric; due date;
begin
 if not private.has_permission('finance.manage') then raise exception 'Sem permissão financeira'; end if;
 if p_request_id is null then raise exception 'Identificador obrigatório'; end if;
 perform pg_advisory_xact_lock(hashtext(p_request_id::text));
 if exists(select 1 from payment_installments where plan_id=p_request_id) then return; end if;
 if p_amount is null or p_amount<=0 or p_amount<>round(p_amount,2) or p_count is null or p_count not between 1 and 36 or p_amount*100<p_count or p_first_due is null or length(trim(coalesce(p_description,'')))<3 or length(trim(coalesce(p_category,'')))=0 then raise exception 'Revise valor, parcelas, data e descrição'; end if;
 if p_paid and p_count<>1 then raise exception 'Baixe cada parcela após confirmar o recebimento'; end if;
 cents:=(p_amount*100)::bigint;
 for n in 1..p_count loop
  piece:=(cents/p_count+case when n<=cents%p_count then 1 else 0 end)::numeric/100;
  due:=(p_first_due+make_interval(months=>n-1))::date;
  insert into payment_installments(plan_id,installment_number,installment_count,service_order_id,type,category,description,amount,due_date,payment_method,paid_at,created_by)
  values(p_request_id,n,p_count,p_order_id,p_type,p_category,p_description,piece,due,p_method,case when p_paid then now() else null end,auth.uid());
 end loop;
end $$;
create function public.settle_installment(p_id uuid) returns void language plpgsql security invoker set search_path=public as $$
begin
 if not private.has_permission('finance.manage') then raise exception 'Sem permissão financeira'; end if;
 perform 1 from payment_installments where id=p_id for update;
 if not found then raise exception 'Parcela não encontrada'; end if;
 update payment_installments set paid_at=now() where id=p_id and paid_at is null;
end $$;
create function public.record_order_contact(p_order_id uuid,p_notes text) returns void language plpgsql security invoker set search_path=public as $$
declare s text;
begin
 if not private.has_permission('orders.customer_approval') then raise exception 'Sem permissão comercial'; end if;
 if length(trim(coalesce(p_notes,'')))<3 then raise exception 'Descreva o contato com o cliente'; end if;
 select status into s from service_orders where id=p_order_id;
 if not found then raise exception 'OS não encontrada'; end if;
 insert into service_order_status_history(service_order_id,from_status,to_status,notes,changed_by) values(p_order_id,s,s,'Contato comercial: '||trim(p_notes),auth.uid());
end $$;
revoke all on function private.guard_installment(),private.post_installment() from public,anon;
revoke all on function public.create_payment_plan(uuid,uuid,text,text,text,numeric,integer,date,text,boolean),public.settle_installment(uuid),public.record_order_contact(uuid,text) from public,anon;
grant execute on function public.create_payment_plan(uuid,uuid,text,text,text,numeric,integer,date,text,boolean),public.settle_installment(uuid),public.record_order_contact(uuid,text) to authenticated;
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

  if p_new_status='ready_for_pickup' and length(trim(coalesce(p_notes,'')))<3 then raise exception 'Descreva o serviço executado'; end if;
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


commit;


