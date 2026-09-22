-- CRONOS / Prime Tech — armazenamento privado do certificado digital A1
-- Aplicar APÓS 0011_cronos_fiscal_emission_foundation.sql
-- O arquivo A1 fica em bucket PRIVADO. A senha do certificado NÃO é persistida.

begin;

create table if not exists public.fiscal_certificates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null unique references public.companies(id) on delete cascade,
  certificate_type text not null default 'A1' check (certificate_type in ('A1')),
  file_name text not null,
  storage_path text not null,
  file_size bigint,
  status text not null default 'stored' check (status in ('stored','provider_synced','expired','revoked','error')),
  provider_reference text,
  valid_from timestamptz,
  valid_until timestamptz,
  last_error text,
  uploaded_by uuid references auth.users(id) on delete set null,
  uploaded_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.fiscal_certificates enable row level security;

drop policy if exists fiscal_certificates_read on public.fiscal_certificates;
create policy fiscal_certificates_read
on public.fiscal_certificates
for select
to authenticated
using (private.has_company_permission(company_id, 'fiscal.view'));

drop policy if exists fiscal_certificates_manage on public.fiscal_certificates;
create policy fiscal_certificates_manage
on public.fiscal_certificates
for all
to authenticated
using (private.has_company_permission(company_id, 'fiscal.settings'))
with check (private.has_company_permission(company_id, 'fiscal.settings'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'fiscal-certificates',
  'fiscal-certificates',
  false,
  10485760,
  array['application/x-pkcs12','application/pkcs12','application/octet-stream']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Os arquivos seguem o caminho <company_id>/certificate.pfx. As políticas
-- validam a empresa pelo primeiro segmento sem converter texto em UUID.
drop policy if exists fiscal_certificate_objects_read on storage.objects;
create policy fiscal_certificate_objects_read
on storage.objects
for select
to authenticated
using (
  bucket_id = 'fiscal-certificates'
  and exists (
    select 1
    from public.user_company_access u
    join public.role_permissions rp on rp.role_code = u.role_code
    where u.user_id = auth.uid()
      and u.active = true
      and u.company_id::text = (storage.foldername(name))[1]
      and rp.permission_code in ('fiscal.view','fiscal.settings')
  )
);

drop policy if exists fiscal_certificate_objects_insert on storage.objects;
create policy fiscal_certificate_objects_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'fiscal-certificates'
  and exists (
    select 1
    from public.user_company_access u
    join public.role_permissions rp on rp.role_code = u.role_code
    where u.user_id = auth.uid()
      and u.active = true
      and u.company_id::text = (storage.foldername(name))[1]
      and rp.permission_code = 'fiscal.settings'
  )
);

drop policy if exists fiscal_certificate_objects_update on storage.objects;
create policy fiscal_certificate_objects_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'fiscal-certificates'
  and exists (
    select 1
    from public.user_company_access u
    join public.role_permissions rp on rp.role_code = u.role_code
    where u.user_id = auth.uid()
      and u.active = true
      and u.company_id::text = (storage.foldername(name))[1]
      and rp.permission_code = 'fiscal.settings'
  )
)
with check (
  bucket_id = 'fiscal-certificates'
  and exists (
    select 1
    from public.user_company_access u
    join public.role_permissions rp on rp.role_code = u.role_code
    where u.user_id = auth.uid()
      and u.active = true
      and u.company_id::text = (storage.foldername(name))[1]
      and rp.permission_code = 'fiscal.settings'
  )
);

drop policy if exists fiscal_certificate_objects_delete on storage.objects;
create policy fiscal_certificate_objects_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'fiscal-certificates'
  and exists (
    select 1
    from public.user_company_access u
    join public.role_permissions rp on rp.role_code = u.role_code
    where u.user_id = auth.uid()
      and u.active = true
      and u.company_id::text = (storage.foldername(name))[1]
      and rp.permission_code = 'fiscal.settings'
  )
);

commit;
