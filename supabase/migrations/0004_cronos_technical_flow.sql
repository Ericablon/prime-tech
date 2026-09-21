-- ============================================================
-- CRONOS • Technical / Commercial workflow
-- Migration 0004
--
-- Depends on:
--   0001_prime_tech_core.sql
--   0002_cronos_saas_foundation.sql
--   0003_cronos_tenant_rbac.sql
-- ============================================================

begin;

-- ============================================================
-- 1. Harmonização de permissões
-- ============================================================

insert into public.role_permissions (
  role_code,
  permission_code
)
select
  'atendimento',
  code
from public.permissions
where code in (
  'orders.commercial',
  'orders.approve',
  'orders.deliver'
)
on conflict do nothing;

insert into public.role_permissions (
  role_code,
  permission_code
)
select
  'comercial',
  code
from public.permissions
where code in (
  'clients.view',
  'clients.manage',
  'equipment.view',
  'equipment.manage',
  'orders.view',
  'orders.create',
  'orders.commercial',
  'orders.approve',
  'orders.deliver',
  'stock.view'
)
on conflict do nothing;

-- Garante que Gestor/Admin recebam qualquer permissão
-- adicionada antes ou nesta etapa.
insert into public.role_permissions (
  role_code,
  permission_code
)
select
  'gestor',
  code
from public.permissions
on conflict do nothing;

insert into public.role_permissions (
  role_code,
  permission_code
)
select
  'admin',
  code
from public.permissions
on conflict do nothing;

-- ============================================================
-- 2. Campos do fluxo técnico
-- ============================================================

alter table public.service_orders
  add column if not exists technical_status text;

alter table public.service_orders
  add column if not exists technical_update text;

alter table public.service_orders
  add column if not exists pause_reason text;

alter table public.service_orders
  add column if not exists pause_notes text;

alter table public.service_orders
  add column if not exists technical_started_at timestamptz;

alter table public.service_orders
  add column if not exists technical_paused_at timestamptz;

alter table public.service_orders
  add column if not exists technical_resumed_at timestamptz;

alter table public.service_orders
  add column if not exists technical_completed_at timestamptz;

alter table public.service_orders
  add column if not exists quality_checked_at timestamptz;

-- ============================================================
-- 3. Backfill do estado técnico
-- ============================================================

update public.service_orders
set technical_status =
  case
    when status = 'waiting_technician'
      then 'waiting_start'

    when status = 'diagnosis'
      then 'in_progress'

    when status in (
      'budget_ready',
      'ready_for_commercial',
      'waiting_customer',
      'approved'
    )
      then 'waiting_start'

    when status = 'in_repair'
      then 'in_progress'

    when status = 'waiting_part'
      then 'paused'

    when status = 'quality_check'
      then 'quality_check'

    when status in (
      'ready_for_pickup',
      'delivered'
    )
      then 'completed'

    else 'not_started'
  end
where technical_status is null;

update public.service_orders
set pause_reason = 'waiting_part'
where status = 'waiting_part'
  and pause_reason is null;

alter table public.service_orders
  alter column technical_status
  set default 'not_started';

alter table public.service_orders
  alter column technical_status
  set not null;

-- ============================================================
-- 4. Constraints
-- ============================================================

alter table public.service_orders
  drop constraint if exists service_orders_status_check;

alter table public.service_orders
  add constraint service_orders_status_check
  check (
    status in (
      'triage',
      'waiting_technician',
      'diagnosis',
      'budget_ready',
      'ready_for_commercial',
      'waiting_customer',
      'approved',
      'in_repair',
      'waiting_part',
      'quality_check',
      'ready_for_pickup',
      'delivered',
      'cancelled',
      'warranty'
    )
  );

alter table public.service_orders
  drop constraint if exists service_orders_technical_status_check;

alter table public.service_orders
  add constraint service_orders_technical_status_check
  check (
    technical_status in (
      'not_started',
      'waiting_start',
      'in_progress',
      'paused',
      'waiting_part',
      'quality_check',
      'completed'
    )
  );

alter table public.service_orders
  drop constraint if exists service_orders_pause_reason_check;

alter table public.service_orders
  add constraint service_orders_pause_reason_check
  check (
    pause_reason is null
    or pause_reason in (
      'waiting_part',
      'waiting_customer',
      'waiting_supplier',
      'additional_approval',
      'third_party',
      'observation',
      'technical_issue',
      'other'
    )
  );

-- ============================================================
-- 5. Helper de permissão compatível com SaaS + legado
-- ============================================================

create or replace function private.order_has_permission(
  p_company uuid,
  p_permission text,
  p_legacy_permission text default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    case
      when p_company is not null then
        private.has_company_permission(
          p_company,
          p_permission
        )
        or (
          p_legacy_permission is not null
          and private.has_company_permission(
            p_company,
            p_legacy_permission
          )
        )

      else
        private.has_permission(
          p_permission
        )
        or (
          p_legacy_permission is not null
          and private.has_permission(
            p_legacy_permission
          )
        )
    end;
$$;

revoke all
on function private.order_has_permission(
  uuid,
  text,
  text
)
from public, anon;

grant execute
on function private.order_has_permission(
  uuid,
  text,
  text
)
to authenticated;

-- ============================================================
-- 6. Proteção de campos da OS
-- ============================================================

create or replace function public.enforce_order_field_permissions()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_can_tech boolean;
  v_can_commercial boolean;
  v_can_approve boolean;
begin
  v_can_tech :=
    private.order_has_permission(
      new.company_id,
      'orders.tech'
    );

  v_can_commercial :=
    private.order_has_permission(
      new.company_id,
      'orders.commercial'
    );

  v_can_approve :=
    private.order_has_permission(
      new.company_id,
      'orders.approve',
      'orders.customer_approval'
    );

  if (
    new.diagnosis
      is distinct from old.diagnosis

    or new.technical_notes
      is distinct from old.technical_notes

    or new.estimated_days
      is distinct from old.estimated_days

    or new.technical_status
      is distinct from old.technical_status

    or new.technical_update
      is distinct from old.technical_update

    or new.pause_reason
      is distinct from old.pause_reason

    or new.pause_notes
      is distinct from old.pause_notes

    or new.technical_started_at
      is distinct from old.technical_started_at

    or new.technical_paused_at
      is distinct from old.technical_paused_at

    or new.technical_resumed_at
      is distinct from old.technical_resumed_at

    or new.technical_completed_at
      is distinct from old.technical_completed_at

    or new.quality_checked_at
      is distinct from old.quality_checked_at
  )
  and not v_can_tech then
    raise exception
      'Usuário sem permissão para alterar a operação técnica';
  end if;

  if (
    new.approval_status
      is distinct from old.approval_status

    or new.approval_notes
      is distinct from old.approval_notes

    or new.approved_at
      is distinct from old.approved_at
  )
  and not v_can_approve then
    raise exception
      'Usuário sem permissão para registrar decisão comercial';
  end if;

  if (
    new.assigned_technician_id
      is distinct from old.assigned_technician_id
  )
  and not (
    v_can_commercial
    or v_can_tech
  ) then
    raise exception
      'Usuário sem permissão para atribuir técnico';
  end if;

  return new;
end;
$$;

drop trigger if exists
  enforce_order_fields
on public.service_orders;

create trigger enforce_order_fields
before update
on public.service_orders
for each row
execute function
  public.enforce_order_field_permissions();

-- ============================================================
-- 7. Fluxo permitido de status
-- ============================================================

create or replace function public.enforce_order_status_transition()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_allowed boolean := false;

  v_can_create boolean;
  v_can_tech boolean;
  v_can_commercial boolean;
  v_can_approve boolean;
  v_can_deliver boolean;
begin
  if new.status = old.status then
    return new;
  end if;

  v_can_create :=
    private.order_has_permission(
      new.company_id,
      'orders.create'
    );

  v_can_tech :=
    private.order_has_permission(
      new.company_id,
      'orders.tech'
    );

  v_can_commercial :=
    private.order_has_permission(
      new.company_id,
      'orders.commercial'
    );

  v_can_approve :=
    private.order_has_permission(
      new.company_id,
      'orders.approve',
      'orders.customer_approval'
    );

  v_can_deliver :=
    private.order_has_permission(
      new.company_id,
      'orders.deliver',
      'orders.delivery'
    );

  -- Entrada / atendimento
  v_allowed :=
    v_can_create
    and old.status = 'triage'
    and new.status = 'waiting_technician';

  -- Operação técnica
  v_allowed :=
    v_allowed
    or (
      v_can_tech
      and (
        (
          old.status = 'waiting_technician'
          and new.status in (
            'diagnosis',
            'ready_for_commercial',
            'waiting_customer'
          )
        )

        or (
          old.status = 'diagnosis'
          and new.status in (
            'budget_ready',
            'ready_for_commercial',
            'waiting_customer'
          )
        )

        or (
          old.status = 'approved'
          and new.status = 'in_repair'
        )

        or (
          old.status = 'in_repair'
          and new.status in (
            'waiting_part',
            'quality_check',
            'ready_for_pickup'
          )
        )

        or (
          old.status = 'waiting_part'
          and new.status in (
            'in_repair',
            'quality_check',
            'ready_for_pickup'
          )
        )

        or (
          old.status = 'quality_check'
          and new.status in (
            'in_repair',
            'waiting_part',
            'ready_for_pickup'
          )
        )
      )
    );

  -- Comercial monta/envia orçamento
  v_allowed :=
    v_allowed
    or (
      v_can_commercial
      and (
        (
          old.status in (
            'budget_ready',
            'ready_for_commercial'
          )
          and new.status =
            'waiting_customer'
        )

        or (
          old.status =
            'waiting_customer'
          and new.status =
            'ready_for_commercial'
        )
      )
    );

  -- Aprovação do cliente
  v_allowed :=
    v_allowed
    or (
      v_can_approve
      and old.status =
        'waiting_customer'
      and new.status in (
        'approved',
        'cancelled'
      )
    );

  -- Entrega
  v_allowed :=
    v_allowed
    or (
      v_can_deliver
      and old.status =
        'ready_for_pickup'
      and new.status =
        'delivered'
    );

  if not v_allowed then
    raise exception
      'Transição de status não permitida: % -> %',
      old.status,
      new.status;
  end if;

  if new.status = 'approved' then
    new.approval_status :=
      'approved';

    new.approved_at :=
      coalesce(
        new.approved_at,
        now()
      );

  elsif
    new.status = 'cancelled'
    and old.status =
      'waiting_customer'
  then
    new.approval_status :=
      'rejected';

  elsif
    new.status = 'delivered'
  then
    new.closed_at :=
      coalesce(
        new.closed_at,
        now()
      );
  end if;

  return new;
end;
$$;

drop trigger if exists
  enforce_order_status
on public.service_orders;

create trigger enforce_order_status
before update of status
on public.service_orders
for each row
execute function
  public.enforce_order_status_transition();

-- ============================================================
-- 8. RLS tenant-aware para itens e histórico
-- ============================================================

drop policy if exists
  order_items_read
on public.service_order_items;

drop policy if exists
  order_items_write
on public.service_order_items;

drop policy if exists
  order_items_tenant_read
on public.service_order_items;

drop policy if exists
  order_items_tenant_write
on public.service_order_items;

create policy order_items_tenant_read
on public.service_order_items
for select
to authenticated
using (
  exists (
    select 1
    from public.service_orders so
    where so.id =
      service_order_items.service_order_id
      and private.order_has_permission(
        so.company_id,
        'orders.view'
      )
  )
);

create policy order_items_tenant_write
on public.service_order_items
for all
to authenticated
using (
  exists (
    select 1
    from public.service_orders so
    where so.id =
      service_order_items.service_order_id
      and (
        private.order_has_permission(
          so.company_id,
          'orders.tech'
        )
        or private.order_has_permission(
          so.company_id,
          'orders.commercial'
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.service_orders so
    where so.id =
      service_order_items.service_order_id
      and (
        private.order_has_permission(
          so.company_id,
          'orders.tech'
        )
        or private.order_has_permission(
          so.company_id,
          'orders.commercial'
        )
      )
  )
);

drop policy if exists
  order_history_read
on public.service_order_status_history;

drop policy if exists
  order_history_insert
on public.service_order_status_history;

drop policy if exists
  order_history_tenant_read
on public.service_order_status_history;

drop policy if exists
  order_history_tenant_insert
on public.service_order_status_history;

create policy order_history_tenant_read
on public.service_order_status_history
for select
to authenticated
using (
  exists (
    select 1
    from public.service_orders so
    where so.id =
      service_order_status_history.service_order_id
      and private.order_has_permission(
        so.company_id,
        'orders.view'
      )
  )
);

create policy order_history_tenant_insert
on public.service_order_status_history
for insert
to authenticated
with check (
  exists (
    select 1
    from public.service_orders so
    where so.id =
      service_order_status_history.service_order_id
      and (
        private.order_has_permission(
          so.company_id,
          'orders.tech'
        )
        or private.order_has_permission(
          so.company_id,
          'orders.commercial'
        )
        or private.order_has_permission(
          so.company_id,
          'orders.approve',
          'orders.customer_approval'
        )
        or private.order_has_permission(
          so.company_id,
          'orders.deliver',
          'orders.delivery'
        )
      )
  )
);

-- ============================================================
-- 9. RPC de transição tenant-aware
-- ============================================================

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
  select *
  into v_old
  from public.service_orders
  where id = p_order_id
  for update;

  if not found then
    raise exception
      'Ordem de Serviço não encontrada';
  end if;

  if not private.order_has_permission(
    v_old.company_id,
    'orders.view'
  ) then
    raise exception
      'Usuário sem acesso à Ordem de Serviço';
  end if;

  update public.service_orders
  set
    status = p_new_status,

    approval_notes =
      case
        when p_new_status in (
          'approved',
          'cancelled'
        )
          then coalesce(
            p_notes,
            approval_notes
          )
        else approval_notes
      end,

    updated_at = now()

  where id = p_order_id
  returning *
  into v_new;

  insert into
    public.service_order_status_history (
      service_order_id,
      from_status,
      to_status,
      notes,
      changed_by
    )
  values (
    p_order_id,
    v_old.status,
    v_new.status,
    p_notes,
    auth.uid()
  );

  return v_new;
end;
$$;

-- ============================================================
-- 10. RPC usado pelo diagnóstico técnico
-- ============================================================

create or replace function public.save_technical_quote(
  p_order_id uuid,
  p_diagnosis text,
  p_days integer,
  p_items jsonb,
  p_submit boolean default true,
  p_expected_updated_at timestamptz default null
)
returns public.service_orders
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_old public.service_orders;
  v_new public.service_orders;
  v_target_status text;
begin
  select *
  into v_old
  from public.service_orders
  where id = p_order_id
  for update;

  if not found then
    raise exception
      'Ordem de Serviço não encontrada';
  end if;

  if not private.order_has_permission(
    v_old.company_id,
    'orders.tech'
  ) then
    raise exception
      'Usuário sem permissão técnica';
  end if;

  if p_expected_updated_at is not null
     and v_old.updated_at
       is distinct from
       p_expected_updated_at
  then
    raise exception
      'A Ordem de Serviço foi atualizada por outro usuário. Atualize a tela e tente novamente.';
  end if;

  if coalesce(
    btrim(p_diagnosis),
    ''
  ) = '' then
    raise exception
      'Informe o diagnóstico técnico';
  end if;

  if p_days is not null
     and p_days < 0
  then
    raise exception
      'Prazo técnico inválido';
  end if;

  v_target_status :=
    case
      when p_submit
        then 'ready_for_commercial'
      else 'diagnosis'
    end;

  update public.service_orders
  set
    diagnosis =
      btrim(p_diagnosis),

    estimated_days =
      p_days,

    status =
      v_target_status,

    technical_status =
      case
        when p_submit
          then 'waiting_start'
        else 'in_progress'
      end,

    technical_update =
      case
        when p_submit
          then
            'Diagnóstico concluído e enviado ao Comercial.'
        else
            'Diagnóstico técnico atualizado.'
      end,

    technical_started_at =
      case
        when not p_submit
          then coalesce(
            technical_started_at,
            now()
          )
        else technical_started_at
      end,

    updated_at = now()

  where id = p_order_id;

  delete from
    public.service_order_items
  where service_order_id =
    p_order_id;

  insert into
    public.service_order_items (
      service_order_id,
      kind,
      description,
      quantity,
      unit_price,
      cost_price,
      stock_item_id
    )
  select
    p_order_id,
    item.kind,
    item.description,
    coalesce(
      item.quantity,
      1
    ),
    coalesce(
      item.unit_price,
      0
    ),
    item.cost_price,
    item.stock_item_id
  from jsonb_to_recordset(
    coalesce(
      p_items,
      '[]'::jsonb
    )
  ) as item (
    kind text,
    description text,
    quantity numeric,
    unit_price numeric,
    cost_price numeric,
    stock_item_id uuid
  );

  select *
  into v_new
  from public.service_orders
  where id = p_order_id;

  if v_old.status
     is distinct from
     v_new.status
  then
    insert into
      public.service_order_status_history (
        service_order_id,
        from_status,
        to_status,
        notes,
        changed_by
      )
    values (
      p_order_id,
      v_old.status,
      v_new.status,
      case
        when p_submit
          then
            'Diagnóstico concluído e encaminhado ao Comercial.'
        else
            'Diagnóstico técnico atualizado.'
      end,
      auth.uid()
    );
  end if;

  return v_new;
end;
$$;

-- ============================================================
-- 11. Grants
-- ============================================================

revoke execute
on function public.transition_service_order(
  uuid,
  text,
  text
)
from public, anon;

grant execute
on function public.transition_service_order(
  uuid,
  text,
  text
)
to authenticated;

revoke execute
on function public.save_technical_quote(
  uuid,
  text,
  integer,
  jsonb,
  boolean,
  timestamptz
)
from public, anon;

grant execute
on function public.save_technical_quote(
  uuid,
  text,
  integer,
  jsonb,
  boolean,
  timestamptz
)
to authenticated;

commit;
