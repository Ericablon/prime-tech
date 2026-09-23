-- CRONOS / Prime Tech — equipamento descrito diretamente na OS
-- A OS passa a guardar uma fotografia dos dados recebidos no balcão.
-- O cadastro permanente de Equipamentos deixa de ser obrigatório para abrir uma OS.
-- Aplicar APÓS 0018.

begin;

alter table public.service_orders
  add column if not exists equipment_description text,
  add column if not exists equipment_serial_number text,
  add column if not exists equipment_accessories text,
  add column if not exists equipment_notes text;

alter table public.equipment
  add column if not exists is_order_snapshot boolean not null default false;

-- Preserva as OS antigas copiando o equipamento que estava vinculado no momento da migração.
update public.service_orders so
set
  equipment_description = coalesce(
    nullif(btrim(so.equipment_description), ''),
    nullif(btrim(concat_ws(' ', e.category, e.brand, e.model)), ''),
    'Equipamento não identificado'
  ),
  equipment_serial_number = coalesce(so.equipment_serial_number, e.serial_number),
  equipment_accessories = coalesce(so.equipment_accessories, e.accessories),
  equipment_notes = coalesce(so.equipment_notes, e.notes)
from public.equipment e
where e.id = so.equipment_id;

update public.service_orders
set equipment_description = 'Equipamento não identificado'
where nullif(btrim(equipment_description), '') is null;

alter table public.service_orders
  alter column equipment_description set not null;

create index if not exists idx_equipment_order_snapshot
  on public.equipment(company_id, is_order_snapshot)
  where is_order_snapshot = true;

-- Para manter compatibilidade com todas as telas atuais, service_orders.equipment_id
-- continua preenchido. Quando a recepção apenas descreve o equipamento, o banco cria
-- um registro interno invisível ao cadastro normal. Série, acessórios e estado físico
-- ficam congelados na própria OS e não dependem desse registro interno.
create or replace function public.prepare_service_order_equipment_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_equipment public.equipment%rowtype;
  v_description text;
begin
  v_description := nullif(btrim(new.equipment_description), '');

  if new.equipment_id is null then
    if v_description is null then
      raise exception 'Informe a descrição do equipamento recebido.';
    end if;

    insert into public.equipment (
      company_id,
      client_id,
      category,
      technical_specialty_code,
      created_by,
      is_order_snapshot
    ) values (
      new.company_id,
      new.client_id,
      v_description,
      new.technical_specialty_code,
      auth.uid(),
      true
    )
    returning * into v_equipment;

    new.equipment_id := v_equipment.id;
  else
    select *
      into v_equipment
      from public.equipment
     where id = new.equipment_id;

    if not found then
      raise exception 'Equipamento informado não foi encontrado.';
    end if;

    if v_equipment.client_id is distinct from new.client_id then
      raise exception 'O equipamento informado não pertence ao cliente da OS.';
    end if;

    if new.company_id is not null
       and v_equipment.company_id is not null
       and v_equipment.company_id is distinct from new.company_id then
      raise exception 'O equipamento informado pertence a outra empresa.';
    end if;

    new.equipment_description := coalesce(
      v_description,
      nullif(btrim(concat_ws(' ', v_equipment.category, v_equipment.brand, v_equipment.model)), ''),
      'Equipamento não identificado'
    );
    new.equipment_serial_number := coalesce(new.equipment_serial_number, v_equipment.serial_number);
    new.equipment_accessories := coalesce(new.equipment_accessories, v_equipment.accessories);
    new.equipment_notes := coalesce(new.equipment_notes, v_equipment.notes);
  end if;

  new.equipment_description := btrim(new.equipment_description);
  new.equipment_serial_number := nullif(upper(btrim(coalesce(new.equipment_serial_number, ''))), '');
  new.equipment_accessories := nullif(btrim(coalesce(new.equipment_accessories, '')), '');
  new.equipment_notes := nullif(btrim(coalesce(new.equipment_notes, '')), '');

  return new;
end;
$$;

drop trigger if exists prepare_service_order_equipment_snapshot on public.service_orders;
create trigger prepare_service_order_equipment_snapshot
before insert on public.service_orders
for each row execute function public.prepare_service_order_equipment_snapshot();

commit;
