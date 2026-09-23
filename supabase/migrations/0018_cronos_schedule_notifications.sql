-- CRONOS / Prime Tech — programação dedicada + notificações persistentes/realtime
-- Aplicar APÓS 0017.

begin;

-- ============================================================================
-- 1) PERMISSÃO ESPECÍFICA PARA PROGRAMAÇÃO TÉCNICA
-- ============================================================================

insert into public.permissions(code, name)
values ('schedule.manage', 'Gerenciar programação técnica')
on conflict (code) do update set name = excluded.name;

-- Alguns ambientes possuem trigger de proteção dos perfis padrão.
do $$
begin
  if exists (
    select 1
    from pg_trigger
    where tgname = 'protect_role_permissions'
      and tgrelid = 'public.role_permissions'::regclass
      and not tgisinternal
  ) then
    execute 'alter table public.role_permissions disable trigger protect_role_permissions';
  end if;
end $$;

insert into public.role_permissions(role_code, permission_code)
select r.code, 'schedule.manage'
from public.roles r
where r.code in ('admin','gestor','comercial','atendimento')
on conflict do nothing;

-- Mantém o comportamento anterior para empresas que já personalizaram esses
-- perfis via override. Técnico passa a apenas visualizar a agenda por padrão;
-- se a empresa quiser que ele programe/reagende, pode conceder schedule.manage.
insert into public.company_role_permissions(company_id, role_code, permission_code)
select cro.company_id, cro.role_code, 'schedule.manage'
from public.company_role_overrides cro
where cro.role_code in ('admin','gestor','comercial','atendimento')
on conflict do nothing;

do $$
begin
  if exists (
    select 1
    from pg_trigger
    where tgname = 'protect_role_permissions'
      and tgrelid = 'public.role_permissions'::regclass
      and not tgisinternal
  ) then
    execute 'alter table public.role_permissions enable trigger protect_role_permissions';
  end if;
end $$;

-- A interface esconde a edição sem a permissão, mas a proteção também precisa
-- existir no banco para impedir atualização direta via API.
create or replace function public.enforce_schedule_permission()
returns trigger
language plpgsql
security invoker
set search_path = public, private
as $$
begin
  if (
    new.scheduled_at is distinct from old.scheduled_at
    or new.scheduled_duration_minutes is distinct from old.scheduled_duration_minutes
    or new.schedule_notes is distinct from old.schedule_notes
    or new.assigned_technician_id is distinct from old.assigned_technician_id
  ) and not private.has_company_permission(new.company_id, 'schedule.manage') then
    raise exception 'Usuário sem permissão para alterar a programação técnica';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_schedule_permission on public.service_orders;
create trigger enforce_schedule_permission
before update on public.service_orders
for each row execute function public.enforce_schedule_permission();

-- ============================================================================
-- 2) ESTADO DE LEITURA DAS NOTIFICAÇÕES POR USUÁRIO / EMPRESA
-- ============================================================================

create table if not exists public.notification_reads (
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  alert_key text not null,
  read_at timestamptz not null default now(),
  primary key (company_id, user_id, alert_key)
);

create index if not exists idx_notification_reads_user_company
  on public.notification_reads(user_id, company_id, read_at desc);

alter table public.notification_reads enable row level security;

drop policy if exists notification_reads_select on public.notification_reads;
create policy notification_reads_select
on public.notification_reads
for select
to authenticated
using (
  user_id = auth.uid()
  and private.has_company_access(company_id)
);

drop policy if exists notification_reads_insert on public.notification_reads;
create policy notification_reads_insert
on public.notification_reads
for insert
to authenticated
with check (
  user_id = auth.uid()
  and private.has_company_access(company_id)
);

drop policy if exists notification_reads_update on public.notification_reads;
create policy notification_reads_update
on public.notification_reads
for update
to authenticated
using (
  user_id = auth.uid()
  and private.has_company_access(company_id)
)
with check (
  user_id = auth.uid()
  and private.has_company_access(company_id)
);

drop policy if exists notification_reads_delete on public.notification_reads;
create policy notification_reads_delete
on public.notification_reads
for delete
to authenticated
using (
  user_id = auth.uid()
  and private.has_company_access(company_id)
);

-- ============================================================================
-- 3) REALTIME
--    O frontend continua funcionando sem realtime; esta publicação apenas faz
--    a central se atualizar imediatamente quando outro usuário altera a operação.
-- ============================================================================

do $$
declare
  v_table text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach v_table in array array[
      'service_orders',
      'stock_items',
      'payment_installments',
      'fiscal_documents',
      'notification_reads'
    ]
    loop
      if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = v_table
      ) then
        execute format('alter publication supabase_realtime add table public.%I', v_table);
      end if;
    end loop;
  end if;
end $$;

commit;
