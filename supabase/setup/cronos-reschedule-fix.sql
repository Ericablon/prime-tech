create or replace function private.validate_appointment() returns trigger language plpgsql security invoker set search_path=public as $$
begin
 perform pg_advisory_xact_lock(hashtext('cronos-schedule'));
 if not exists(select 1 from profiles where id=new.technician_id and active and role_code in ('tecnico','gestor')) then raise exception 'Selecione um técnico ativo'; end if;
 if new.status='scheduled' and exists(select 1 from service_appointments where service_order_id<>new.service_order_id and technician_id=new.technician_id and status='scheduled' and starts_at<new.ends_at and ends_at>new.starts_at) then raise exception 'O técnico já possui um serviço nesse horário'; end if;
 return new;
end $$;
