-- Corrige o bloqueio de itens da OS para permitir que a automação atualize
-- apenas os campos internos de reserva/consumo após a aprovação.

begin;

drop trigger if exists lock_order_inventory_items_after_approval on public.service_order_items;
drop trigger if exists lock_order_inventory_item_updates on public.service_order_items;
drop trigger if exists lock_order_inventory_item_delete on public.service_order_items;

create trigger lock_order_inventory_item_updates
before update of kind, description, quantity, unit_price, cost_price, stock_item_id
on public.service_order_items
for each row execute function public.lock_order_inventory_items_after_approval();

create trigger lock_order_inventory_item_delete
before delete on public.service_order_items
for each row execute function public.lock_order_inventory_items_after_approval();

commit;