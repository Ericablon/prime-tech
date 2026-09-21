-- Cronos tenant-aware RBAC / RLS
-- Safe-by-default: rows with company_id NULL become invisible to tenant users until backfilled.
begin;

insert into public.roles(code,name,is_system) values
 ('admin','Administrador',true),('comercial','Comercial',true),('estoque','Estoque',true),('financeiro','Financeiro',true),('fiscal','Fiscal',true)
on conflict(code) do nothing;

insert into public.permissions(code,name) values
 ('orders.commercial','Gerenciar etapa comercial'),('orders.approve','Registrar aprovação comercial'),('orders.deliver','Registrar entrega'),
 ('stock.reserve','Reservar estoque'),('stock.consume','Consumir estoque'),('stock.adjust','Ajustar estoque'),
 ('finance.dre','Visualizar DRE'),('fiscal.issue','Emitir documento fiscal'),('fiscal.cancel','Cancelar documento fiscal'),('fiscal.settings','Configurar fiscal'),
 ('users.manage','Gerenciar usuários'),('permissions.manage','Gerenciar permissões'),('settings.manage','Gerenciar configurações'),('audit.view','Visualizar auditoria')
on conflict(code) do nothing;

-- Default grants. Customize per tenant later with a role template layer if needed.
insert into public.role_permissions(role_code,permission_code)
select 'comercial',code from public.permissions where code in ('dashboard.view','clients.view','equipment.view','orders.view','orders.commercial','orders.approve','stock.view') on conflict do nothing;
insert into public.role_permissions(role_code,permission_code)
select 'estoque',code from public.permissions where code in ('dashboard.view','orders.view','stock.view','stock.reserve','stock.consume','stock.adjust') on conflict do nothing;
insert into public.role_permissions(role_code,permission_code)
select 'financeiro',code from public.permissions where code in ('dashboard.view','orders.view','finance.view','finance.manage','finance.dre','fiscal.view') on conflict do nothing;
insert into public.role_permissions(role_code,permission_code)
select 'fiscal',code from public.permissions where code in ('dashboard.view','orders.view','finance.view','fiscal.view','fiscal.issue','fiscal.cancel','fiscal.settings') on conflict do nothing;
insert into public.role_permissions(role_code,permission_code)
select 'admin',code from public.permissions on conflict do nothing;
insert into public.role_permissions(role_code,permission_code)
select 'gestor',code from public.permissions on conflict do nothing;

create or replace function private.has_company_access(p_company uuid)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.user_company_access u where u.user_id=auth.uid() and u.company_id=p_company and u.active=true);
$$;
create or replace function private.has_company_permission(p_company uuid,p_permission text)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(
   select 1 from public.user_company_access u
   join public.role_permissions rp on rp.role_code=u.role_code
   where u.user_id=auth.uid() and u.company_id=p_company and u.active=true and rp.permission_code=p_permission
 );
$$;
revoke all on function private.has_company_access(uuid),private.has_company_permission(uuid,text) from public,anon;
grant execute on function private.has_company_access(uuid),private.has_company_permission(uuid,text) to authenticated;

alter table public.organizations enable row level security;
alter table public.companies enable row level security;
alter table public.branches enable row level security;
alter table public.user_company_access enable row level security;
alter table public.fiscal_settings enable row level security;
alter table public.fiscal_events enable row level security;

create policy organizations_tenant_read on public.organizations for select to authenticated using(
 exists(select 1 from public.companies c join public.user_company_access u on u.company_id=c.id where c.organization_id=organizations.id and u.user_id=auth.uid() and u.active)
);
create policy companies_tenant_read on public.companies for select to authenticated using(private.has_company_access(id));
create policy branches_tenant_read on public.branches for select to authenticated using(private.has_company_access(company_id));
create policy access_self_read on public.user_company_access for select to authenticated using(user_id=auth.uid() or private.has_company_permission(company_id,'users.manage'));
create policy access_admin_manage on public.user_company_access for all to authenticated using(private.has_company_permission(company_id,'users.manage')) with check(private.has_company_permission(company_id,'users.manage'));

-- Replace legacy non-tenant policies on core tables.
drop policy if exists clients_read on public.clients; drop policy if exists clients_insert on public.clients; drop policy if exists clients_update on public.clients; drop policy if exists clients_delete on public.clients;
create policy clients_tenant_read on public.clients for select to authenticated using(private.has_company_permission(company_id,'clients.view'));
create policy clients_tenant_insert on public.clients for insert to authenticated with check(private.has_company_permission(company_id,'clients.manage'));
create policy clients_tenant_update on public.clients for update to authenticated using(private.has_company_permission(company_id,'clients.manage')) with check(private.has_company_permission(company_id,'clients.manage'));
create policy clients_tenant_delete on public.clients for delete to authenticated using(private.has_company_permission(company_id,'settings.manage'));

drop policy if exists equipment_read on public.equipment; drop policy if exists equipment_insert on public.equipment; drop policy if exists equipment_update on public.equipment; drop policy if exists equipment_delete on public.equipment;
create policy equipment_tenant_read on public.equipment for select to authenticated using(private.has_company_permission(company_id,'equipment.view'));
create policy equipment_tenant_insert on public.equipment for insert to authenticated with check(private.has_company_permission(company_id,'equipment.manage'));
create policy equipment_tenant_update on public.equipment for update to authenticated using(private.has_company_permission(company_id,'equipment.manage')) with check(private.has_company_permission(company_id,'equipment.manage'));

drop policy if exists orders_read on public.service_orders; drop policy if exists orders_insert on public.service_orders; drop policy if exists orders_update on public.service_orders; drop policy if exists orders_delete on public.service_orders;
create policy orders_tenant_read on public.service_orders for select to authenticated using(private.has_company_permission(company_id,'orders.view'));
create policy orders_tenant_insert on public.service_orders for insert to authenticated with check(private.has_company_permission(company_id,'orders.create'));
create policy orders_tenant_update on public.service_orders for update to authenticated using(private.has_company_access(company_id)) with check(private.has_company_access(company_id));
-- Field/status triggers must still enforce action-level transitions; RLS only scopes tenant access.

drop policy if exists stock_read on public.stock_items; drop policy if exists stock_manage on public.stock_items;
create policy stock_tenant_read on public.stock_items for select to authenticated using(private.has_company_permission(company_id,'stock.view'));
create policy stock_tenant_manage on public.stock_items for all to authenticated using(private.has_company_permission(company_id,'stock.adjust')) with check(private.has_company_permission(company_id,'stock.adjust'));
drop policy if exists stock_movements_read on public.stock_movements; drop policy if exists stock_movements_manage on public.stock_movements;
create policy stock_movements_tenant_read on public.stock_movements for select to authenticated using(private.has_company_permission(company_id,'stock.view'));
create policy stock_movements_tenant_insert on public.stock_movements for insert to authenticated with check(
 private.has_company_permission(company_id,'stock.consume') or private.has_company_permission(company_id,'stock.adjust')
);

-- Finance/fiscal are fail-closed by company permission.
drop policy if exists finance_read on public.financial_entries; drop policy if exists finance_manage on public.financial_entries;
create policy finance_tenant_read on public.financial_entries for select to authenticated using(private.has_company_permission(company_id,'finance.view'));
create policy finance_tenant_manage on public.financial_entries for all to authenticated using(private.has_company_permission(company_id,'finance.manage')) with check(private.has_company_permission(company_id,'finance.manage'));
drop policy if exists fiscal_read on public.fiscal_documents; drop policy if exists fiscal_manage on public.fiscal_documents;
create policy fiscal_tenant_read on public.fiscal_documents for select to authenticated using(private.has_company_permission(company_id,'fiscal.view'));
create policy fiscal_tenant_insert on public.fiscal_documents for insert to authenticated with check(private.has_company_permission(company_id,'fiscal.issue'));
create policy fiscal_tenant_update on public.fiscal_documents for update to authenticated using(private.has_company_permission(company_id,'fiscal.issue') or private.has_company_permission(company_id,'fiscal.cancel')) with check(private.has_company_access(company_id));
create policy fiscal_settings_read on public.fiscal_settings for select to authenticated using(private.has_company_permission(company_id,'fiscal.view'));
create policy fiscal_settings_manage on public.fiscal_settings for all to authenticated using(private.has_company_permission(company_id,'fiscal.settings')) with check(private.has_company_permission(company_id,'fiscal.settings'));
create policy fiscal_events_read on public.fiscal_events for select to authenticated using(exists(select 1 from public.fiscal_documents d where d.id=fiscal_document_id and private.has_company_permission(d.company_id,'fiscal.view')));

commit;
