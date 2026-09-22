-- Cronos / Prime Tech — estoque automático por OS + rastreabilidade financeira
-- Aplicar APÓS 0007_cronos_business_expansion.sql

begin;

-- =============================================================================
-- 1) RASTREABILIDADE DOS ITENS DA OS NO ESTOQUE
-- =============================================================================

alter table public.service_order_items
  add column if not exists inventory_reserved_quantity numeric(12,3) not null default 0,
  add column if not exists inventory_consumed_quantity numeric(12,3) not null default 0;

alter table public.service_order_items
  drop constraint if exists service_order_items_inventory_reserved_check;
alter table public.service_order_items
  add constraint service_order_items_inventory_reserved_check
  check (inventory_reserved_quantity >= 0);

alter table public.service_order_items
  drop constraint if exists service_order_items_inventory_consumed_check;
alter table public.service_order_items
  add constraint service_order_items_inventory_consumed_check
  check (inventory_consumed_quantity >= 0);

alter table public.stock_movements
  add column if not exists service_order_item_id uuid references public.service_order_items(id) on delete set null,
  add column if not exists balance_after numeric(12,3),
  add column if not exists reserved_after numeric(12,3),
  add column if not exists source text;

create index if not exists idx_stock_movements_company_created
  on public.stock_movements(company_id, created_at desc);
create index if not exists idx_stock_movements_order
  on public.stock_movements(service_order_id, created_at desc);
create index if not exists idx_stock_movements_item
  on public.stock_movements(stock_item_id, created_at desc);

-- Depois que o orçamento foi aprovado, peças/produtos de estoque não podem ser
-- alterados silenciosamente. Isso protege a reserva e a baixa automática.
create or replace function public.lock_order_inventory_items_after_approval()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_status text;
  v_order_id uuid;
begin
  v_order_id := coalesce(new.service_order_id, old.service_order_id);

  select status into v_status
  from public.service_orders
  where id = v_order_id;

  if v_status in (
    'approved','in_repair','waiting_part','quality_check','ready_for_pickup','delivered'
  ) then
    raise exception 'Itens da OS não podem ser alterados após a aprovação. Reabra o orçamento antes de modificar produtos/serviços.';
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists lock_order_inventory_items_after_approval on public.service_order_items;
create trigger lock_order_inventory_items_after_approval
before update or delete on public.service_order_items
for each row execute function public.lock_order_inventory_items_after_approval();

-- Reserva automaticamente os produtos de estoque quando a OS é aprovada e
-- consome o saldo físico quando a execução é concluída.
create or replace function public.reconcile_order_inventory(
  p_order_id uuid,
  p_action text
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_order public.service_orders;
  v_line public.service_order_items;
  v_stock public.stock_items;
  v_needed numeric(12,3);
  v_release numeric(12,3);
begin
  select * into v_order
  from public.service_orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Ordem de Serviço não encontrada';
  end if;

  if p_action not in ('reserve','consume','release') then
    raise exception 'Ação de estoque inválida: %', p_action;
  end if;

  for v_line in
    select *
    from public.service_order_items
    where service_order_id = p_order_id
      and kind = 'part'
      and stock_item_id is not null
    order by stock_item_id, id
  loop
    select * into v_stock
    from public.stock_items
    where id = v_line.stock_item_id
      and company_id = v_order.company_id
    for update;

    if not found then
      raise exception 'Produto de estoque vinculado à OS não foi encontrado';
    end if;

    if p_action = 'reserve' then
      v_needed := greatest(
        coalesce(v_line.quantity,0)
        - coalesce(v_line.inventory_reserved_quantity,0)
        - coalesce(v_line.inventory_consumed_quantity,0),
        0
      );

      if v_needed > 0 then
        if coalesce(v_stock.quantity,0) - coalesce(v_stock.reserved_quantity,0) < v_needed then
          raise exception 'Estoque insuficiente para reservar % unidade(s) de %', v_needed, v_stock.name;
        end if;

        update public.stock_items
        set reserved_quantity = coalesce(reserved_quantity,0) + v_needed,
            updated_at = now()
        where id = v_stock.id
        returning * into v_stock;

        update public.service_order_items
        set inventory_reserved_quantity = coalesce(inventory_reserved_quantity,0) + v_needed
        where id = v_line.id;

        insert into public.stock_movements(
          stock_item_id, service_order_id, service_order_item_id,
          movement_type, quantity, unit_cost, notes, created_by,
          company_id, idempotency_key, balance_after, reserved_after, source
        ) values (
          v_stock.id, p_order_id, v_line.id,
          'reserve', v_needed, v_stock.cost_price,
          'Reserva automática após aprovação da OS', auth.uid(),
          v_order.company_id,
          concat('os-auto-reserve:', p_order_id, ':', v_line.id),
          v_stock.quantity, v_stock.reserved_quantity, 'service_order'
        )
        on conflict do nothing;
      end if;

    elsif p_action = 'consume' then
      v_needed := greatest(
        coalesce(v_line.quantity,0) - coalesce(v_line.inventory_consumed_quantity,0),
        0
      );

      if v_needed > 0 then
        if coalesce(v_stock.quantity,0) < v_needed then
          raise exception 'Estoque físico insuficiente para baixar % unidade(s) de %', v_needed, v_stock.name;
        end if;

        v_release := least(
          coalesce(v_line.inventory_reserved_quantity,0),
          v_needed
        );

        update public.stock_items
        set quantity = coalesce(quantity,0) - v_needed,
            reserved_quantity = greatest(coalesce(reserved_quantity,0) - v_release, 0),
            updated_at = now()
        where id = v_stock.id
        returning * into v_stock;

        update public.service_order_items
        set inventory_consumed_quantity = coalesce(inventory_consumed_quantity,0) + v_needed,
            inventory_reserved_quantity = greatest(coalesce(inventory_reserved_quantity,0) - v_release, 0)
        where id = v_line.id;

        insert into public.stock_movements(
          stock_item_id, service_order_id, service_order_item_id,
          movement_type, quantity, unit_cost, notes, created_by,
          company_id, idempotency_key, balance_after, reserved_after, source
        ) values (
          v_stock.id, p_order_id, v_line.id,
          'consume', v_needed, v_stock.cost_price,
          'Baixa automática da OS concluída', auth.uid(),
          v_order.company_id,
          concat('os-auto-consume:', p_order_id, ':', v_line.id),
          v_stock.quantity, v_stock.reserved_quantity, 'service_order'
        )
        on conflict do nothing;
      end if;

    else
      v_release := coalesce(v_line.inventory_reserved_quantity,0);

      if v_release > 0 then
        update public.stock_items
        set reserved_quantity = greatest(coalesce(reserved_quantity,0) - v_release, 0),
            updated_at = now()
        where id = v_stock.id
        returning * into v_stock;

        update public.service_order_items
        set inventory_reserved_quantity = 0
        where id = v_line.id;

        insert into public.stock_movements(
          stock_item_id, service_order_id, service_order_item_id,
          movement_type, quantity, unit_cost, notes, created_by,
          company_id, idempotency_key, balance_after, reserved_after, source
        ) values (
          v_stock.id, p_order_id, v_line.id,
          'release', v_release, v_stock.cost_price,
          'Liberação automática da reserva da OS', auth.uid(),
          v_order.company_id,
          concat('os-auto-release:', p_order_id, ':', v_line.id),
          v_stock.quantity, v_stock.reserved_quantity, 'service_order'
        )
        on conflict do nothing;
      end if;
    end if;
  end loop;
end;
$$;

revoke all on function public.reconcile_order_inventory(uuid,text) from public, anon, authenticated;

create or replace function public.sync_inventory_on_order_status()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if new.status = old.status then
    return new;
  end if;

  if new.status = 'approved' then
    perform public.reconcile_order_inventory(new.id, 'reserve');
  elsif new.status = 'ready_for_pickup' then
    perform public.reconcile_order_inventory(new.id, 'consume');
  elsif new.status = 'cancelled' then
    perform public.reconcile_order_inventory(new.id, 'release');
  end if;

  return new;
end;
$$;

drop trigger if exists sync_inventory_on_order_status on public.service_orders;
create trigger sync_inventory_on_order_status
after update of status on public.service_orders
for each row execute function public.sync_inventory_on_order_status();

-- =============================================================================
-- 2) ENTRADAS / SAÍDAS MANUAIS COM HISTÓRICO REAL
-- =============================================================================

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
  v_type text;
begin
  if p_delta is null or p_delta = 0 then
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

  v_new_quantity := coalesce(v_item.quantity,0) + p_delta;
  if v_new_quantity < 0 then
    raise exception 'A saída deixaria o estoque físico negativo';
  end if;
  if v_new_quantity < coalesce(v_item.reserved_quantity,0) then
    raise exception 'A saída deixaria o estoque abaixo da quantidade reservada';
  end if;

  v_type := case when p_delta > 0 then 'in' else 'out' end;

  update public.stock_items
  set quantity=v_new_quantity,
      updated_at=now()
  where id=p_stock_item_id
  returning * into v_item;

  insert into public.stock_movements(
    stock_item_id, movement_type, quantity, unit_cost,
    notes, created_by, company_id, idempotency_key,
    balance_after, reserved_after, source
  ) values (
    p_stock_item_id, v_type, abs(p_delta), v_item.cost_price,
    coalesce(p_notes, case when p_delta > 0 then 'Entrada manual' else 'Saída manual' end),
    auth.uid(), v_item.company_id, p_idempotency_key,
    v_item.quantity, v_item.reserved_quantity, 'manual'
  );

  return v_item;
end;
$$;

revoke all on function public.adjust_stock(uuid,numeric,text,text) from public, anon;
grant execute on function public.adjust_stock(uuid,numeric,text,text) to authenticated;

create or replace function public.create_stock_item_with_balance(
  p_company_id uuid,
  p_sku text,
  p_name text,
  p_quantity numeric,
  p_minimum numeric,
  p_cost numeric,
  p_sale numeric
)
returns public.stock_items
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_item public.stock_items;
begin
  if not private.has_company_permission(p_company_id, 'stock.adjust') then
    raise exception 'Usuário sem permissão para cadastrar/ajustar estoque';
  end if;

  if coalesce(p_quantity,0) < 0 or coalesce(p_minimum,0) < 0
     or coalesce(p_cost,0) < 0 or coalesce(p_sale,0) < 0 then
    raise exception 'Quantidades e valores não podem ser negativos';
  end if;

  insert into public.stock_items(
    company_id, sku, name, quantity, reserved_quantity,
    minimum_quantity, cost_price, sale_price, active
  ) values (
    p_company_id, upper(btrim(p_sku)), btrim(p_name), coalesce(p_quantity,0), 0,
    coalesce(p_minimum,0), coalesce(p_cost,0), coalesce(p_sale,0), true
  )
  returning * into v_item;

  if coalesce(p_quantity,0) > 0 then
    insert into public.stock_movements(
      stock_item_id, movement_type, quantity, unit_cost,
      notes, created_by, company_id, idempotency_key,
      balance_after, reserved_after, source
    ) values (
      v_item.id, 'in', p_quantity, v_item.cost_price,
      'Saldo inicial do cadastro', auth.uid(), p_company_id,
      concat('opening-balance:', v_item.id),
      v_item.quantity, 0, 'opening_balance'
    );
  end if;

  return v_item;
end;
$$;

revoke all on function public.create_stock_item_with_balance(uuid,text,text,numeric,numeric,numeric,numeric) from public, anon;
grant execute on function public.create_stock_item_with_balance(uuid,text,text,numeric,numeric,numeric,numeric) to authenticated;

commit;