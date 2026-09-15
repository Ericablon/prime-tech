begin;
create table public.service_appointments (
 id uuid primary key default gen_random_uuid(),
 service_order_id uuid not null unique references public.service_orders(id),
 technician_id uuid not null references public.profiles(id),
 starts_at timestamptz not null,
 ends_at timestamptz not null,
 notes text not null default '',
 status text not null default 'scheduled' check(status in ('scheduled','completed','cancelled')),
 created_at timestamptz not null default now(),
 check(ends_at>starts_at)
);
alter table public.service_appointments enable row level security;
create policy appointments_read on public.service_appointments for select to authenticated using(private.has_permission('orders.view'));
create policy appointments_manage on public.service_appointments for all to authenticated using(private.has_permission('admin.manage')) with check(private.has_permission('admin.manage'));
grant select,insert,update on public.service_appointments to authenticated;
revoke all on public.service_appointments from anon;
create index appointments_technician_time on public.service_appointments(technician_id,starts_at);
create function private.validate_appointment() returns trigger language plpgsql security invoker set search_path=public as $$
begin
 perform pg_advisory_xact_lock(hashtext('cronos-schedule'));
 if not exists(select 1 from profiles where id=new.technician_id and active and role_code in ('tecnico','gestor')) then raise exception 'Selecione um técnico ativo'; end if;
 if new.status='scheduled' and exists(select 1 from service_appointments where service_order_id<>new.service_order_id and technician_id=new.technician_id and status='scheduled' and starts_at<new.ends_at and ends_at>new.starts_at) then raise exception 'O técnico já possui um serviço nesse horário'; end if;
 return new;
end $$;
create trigger appointments_validate before insert or update on public.service_appointments for each row execute function private.validate_appointment();
revoke all on function private.validate_appointment() from public,anon;

create function public.save_technical_quote(p_order_id uuid,p_diagnosis text,p_days integer,p_items jsonb,p_submit boolean,p_expected_updated_at timestamptz)
returns public.service_orders language plpgsql security invoker set search_path=public as $$
declare current_order public.service_orders; result public.service_orders; item jsonb;
begin
 if not private.has_permission('orders.tech') then raise exception 'Sem permissão para elaborar orçamento'; end if;
 select * into current_order from service_orders where id=p_order_id for update;
 if not found then raise exception 'Ordem não encontrada'; end if;
 if current_order.status not in ('waiting_technician','diagnosis') then raise exception 'Este orçamento não pode ser alterado no status atual'; end if;
 if current_order.updated_at is distinct from p_expected_updated_at then raise exception 'A OS foi alterada. Atualize a página antes de salvar'; end if;
 if p_days is null or p_days<1 or p_days>365 then raise exception 'Prazo deve ser entre 1 e 365 dias'; end if;
 if p_items is null or jsonb_typeof(p_items)<>'array' then raise exception 'Itens inválidos'; end if;
 if jsonb_array_length(p_items)>100 then raise exception 'Limite de 100 itens por orçamento'; end if;
 if p_submit and (length(trim(coalesce(p_diagnosis,'')))<3 or jsonb_array_length(p_items)=0) then raise exception 'Informe diagnóstico e ao menos um item'; end if;
 for item in select * from jsonb_array_elements(p_items) loop
  if coalesce(item->>'kind','') not in ('service','part') or length(trim(coalesce(item->>'description','')))=0 or coalesce((item->>'quantity')::numeric,0)<=0 or coalesce((item->>'unit_price')::numeric,-1)<0 then raise exception 'Revise descrição, quantidade e valor dos itens'; end if;
 end loop;
 update service_orders set diagnosis=coalesce(p_diagnosis,''),estimated_days=p_days where id=p_order_id;
 delete from service_order_items where service_order_id=p_order_id;
 insert into service_order_items(service_order_id,kind,description,quantity,unit_price,cost_price)
 select p_order_id,i->>'kind',trim(i->>'description'),(i->>'quantity')::numeric,(i->>'unit_price')::numeric,coalesce((i->>'cost_price')::numeric,0) from jsonb_array_elements(p_items) i;
 if p_submit then perform public.transition_service_order(p_order_id,'waiting_customer','Orçamento técnico enviado'); end if;
 insert into audit_logs(user_id,action,entity_type,entity_id,metadata) values(auth.uid(),case when p_submit then 'quote.submitted' else 'quote.draft_saved' end,'service_order',p_order_id,jsonb_build_object('items',jsonb_array_length(p_items)));
 select * into result from service_orders where id=p_order_id;
 return result;
end $$;
revoke all on function public.save_technical_quote(uuid,text,integer,jsonb,boolean,timestamptz) from public,anon;
grant execute on function public.save_technical_quote(uuid,text,integer,jsonb,boolean,timestamptz) to authenticated;
commit;

