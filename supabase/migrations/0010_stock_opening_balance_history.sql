-- Registra automaticamente o saldo inicial de qualquer item criado com quantidade > 0.
-- Também simplifica o RPC de cadastro para evitar dupla movimentação.

begin;

create or replace function public.record_stock_opening_balance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.quantity,0) > 0 then
    insert into public.stock_movements(
      stock_item_id, movement_type, quantity, unit_cost,
      notes, created_by, company_id, idempotency_key,
      balance_after, reserved_after, source
    ) values (
      new.id, 'in', new.quantity, new.cost_price,
      'Saldo inicial do cadastro', auth.uid(), new.company_id,
      concat('opening-balance:', new.id),
      new.quantity, coalesce(new.reserved_quantity,0), 'opening_balance'
    )
    on conflict do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists record_stock_opening_balance on public.stock_items;
create trigger record_stock_opening_balance
after insert on public.stock_items
for each row execute function public.record_stock_opening_balance();

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

  return v_item;
end;
$$;

revoke all on function public.create_stock_item_with_balance(uuid,text,text,numeric,numeric,numeric,numeric) from public, anon;
grant execute on function public.create_stock_item_with_balance(uuid,text,text,numeric,numeric,numeric,numeric) to authenticated;

commit;