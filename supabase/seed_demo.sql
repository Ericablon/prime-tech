-- Dados opcionais para homologação.
-- Rode somente depois de criar pelo menos um usuário e atribuir perfil.
-- Não usar em produção sem revisar.

insert into public.stock_items (sku, name, quantity, minimum_quantity, cost_price, sale_price)
values
  ('SSD-480', 'SSD 480 GB', 8, 3, 155, 220),
  ('FONTE-19V', 'Fonte Notebook 19V', 3, 2, 80, 145),
  ('ROLETE-L3250', 'Kit rolete Epson L3250', 1, 2, 45, 90)
on conflict (sku) do nothing;
