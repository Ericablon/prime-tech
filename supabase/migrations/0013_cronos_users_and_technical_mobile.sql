-- CRONOS / Prime Tech — usuários administráveis + anexos técnicos mobile
-- Aplicar APÓS 0012_cronos_fiscal_certificate_storage.sql

begin;

-- ============================================================
-- 1) Corrige/completa o perfil público usado pelo painel administrativo
-- ============================================================
alter table public.profiles
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists job_title text;

update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id
  and (p.email is null or btrim(p.email) = '');

create index if not exists idx_profiles_email on public.profiles(lower(email));

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role_code, active)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email, ''), '@', 1)),
    new.email,
    case
      when new.raw_user_meta_data->>'role_code' in ('admin','gestor','atendimento','comercial','tecnico','estoque','financeiro','fiscal')
        then new.raw_user_meta_data->>'role_code'
      else 'atendimento'
    end,
    true
  )
  on conflict (id) do update
  set full_name = excluded.full_name,
      email = coalesce(excluded.email, public.profiles.email),
      updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- 2) Fotos/anexos capturados pelo técnico no celular
-- ============================================================
create table if not exists public.service_order_attachments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  service_order_id uuid not null references public.service_orders(id) on delete cascade,
  uploaded_by uuid references auth.users(id) on delete set null,
  kind text not null default 'photo' check (kind in ('photo','document')),
  file_name text not null,
  storage_path text not null,
  mime_type text,
  file_size bigint,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_service_order_attachments_order
  on public.service_order_attachments(company_id, service_order_id, created_at desc);

alter table public.service_order_attachments enable row level security;

drop policy if exists service_order_attachments_read on public.service_order_attachments;
create policy service_order_attachments_read
on public.service_order_attachments
for select
to authenticated
using (private.has_company_permission(company_id, 'orders.view'));

drop policy if exists service_order_attachments_insert on public.service_order_attachments;
create policy service_order_attachments_insert
on public.service_order_attachments
for insert
to authenticated
with check (
  private.has_company_permission(company_id, 'orders.tech')
  or private.has_company_permission(company_id, 'orders.commercial')
);

drop policy if exists service_order_attachments_delete on public.service_order_attachments;
create policy service_order_attachments_delete
on public.service_order_attachments
for delete
to authenticated
using (
  uploaded_by = auth.uid()
  or private.has_company_permission(company_id, 'settings.manage')
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'technical-attachments',
  'technical-attachments',
  false,
  15728640,
  array['image/jpeg','image/png','image/webp','application/pdf']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Caminho: <company_id>/<service_order_id>/<arquivo>
drop policy if exists technical_attachment_objects_read on storage.objects;
create policy technical_attachment_objects_read
on storage.objects
for select
to authenticated
using (
  bucket_id = 'technical-attachments'
  and exists (
    select 1
    from public.user_company_access u
    join public.role_permissions rp on rp.role_code = u.role_code
    where u.user_id = auth.uid()
      and u.active = true
      and u.company_id::text = (storage.foldername(name))[1]
      and rp.permission_code = 'orders.view'
  )
);

drop policy if exists technical_attachment_objects_insert on storage.objects;
create policy technical_attachment_objects_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'technical-attachments'
  and exists (
    select 1
    from public.user_company_access u
    join public.role_permissions rp on rp.role_code = u.role_code
    where u.user_id = auth.uid()
      and u.active = true
      and u.company_id::text = (storage.foldername(name))[1]
      and rp.permission_code in ('orders.tech','orders.commercial')
  )
);

drop policy if exists technical_attachment_objects_delete on storage.objects;
create policy technical_attachment_objects_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'technical-attachments'
  and exists (
    select 1
    from public.user_company_access u
    join public.role_permissions rp on rp.role_code = u.role_code
    where u.user_id = auth.uid()
      and u.active = true
      and u.company_id::text = (storage.foldername(name))[1]
      and rp.permission_code in ('orders.tech','settings.manage')
  )
);

commit;
