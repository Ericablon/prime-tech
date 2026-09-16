begin;
alter policy order_items_write on public.service_order_items
using(exists(select 1 from public.service_orders o where o.id=service_order_id and ((private.has_permission('orders.tech') and o.status in ('waiting_technician','diagnosis')) or (private.has_permission('orders.customer_approval') and o.status='budget_ready'))))
with check(exists(select 1 from public.service_orders o where o.id=service_order_id and ((private.has_permission('orders.tech') and o.status in ('waiting_technician','diagnosis')) or (private.has_permission('orders.customer_approval') and o.status='budget_ready'))));
commit;
