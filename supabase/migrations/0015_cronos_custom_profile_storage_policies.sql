-- CRONOS / Prime Tech — buckets privados compatíveis com perfis personalizados
-- Aplicar APÓS 0014_cronos_access_profiles_and_notifications.sql

begin;

-- Fotos e anexos técnicos -----------------------------------------------------
drop policy if exists technical_attachment_objects_read on storage.objects;
create policy technical_attachment_objects_read
on storage.objects
for select
to authenticated
using (
  bucket_id = 'technical-attachments'
  and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
  and private.has_company_permission((storage.foldername(name))[1]::uuid, 'orders.view')
);

drop policy if exists technical_attachment_objects_insert on storage.objects;
create policy technical_attachment_objects_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'technical-attachments'
  and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
  and (
    private.has_company_permission((storage.foldername(name))[1]::uuid, 'orders.tech')
    or private.has_company_permission((storage.foldername(name))[1]::uuid, 'orders.commercial')
  )
);

drop policy if exists technical_attachment_objects_delete on storage.objects;
create policy technical_attachment_objects_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'technical-attachments'
  and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
  and (
    private.has_company_permission((storage.foldername(name))[1]::uuid, 'orders.tech')
    or private.has_company_permission((storage.foldername(name))[1]::uuid, 'settings.manage')
  )
);

-- Certificado fiscal A1 -------------------------------------------------------
drop policy if exists fiscal_certificate_objects_read on storage.objects;
create policy fiscal_certificate_objects_read
on storage.objects
for select
to authenticated
using (
  bucket_id = 'fiscal-certificates'
  and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
  and (
    private.has_company_permission((storage.foldername(name))[1]::uuid, 'fiscal.view')
    or private.has_company_permission((storage.foldername(name))[1]::uuid, 'fiscal.settings')
  )
);

drop policy if exists fiscal_certificate_objects_insert on storage.objects;
create policy fiscal_certificate_objects_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'fiscal-certificates'
  and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
  and private.has_company_permission((storage.foldername(name))[1]::uuid, 'fiscal.settings')
);

drop policy if exists fiscal_certificate_objects_update on storage.objects;
create policy fiscal_certificate_objects_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'fiscal-certificates'
  and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
  and private.has_company_permission((storage.foldername(name))[1]::uuid, 'fiscal.settings')
)
with check (
  bucket_id = 'fiscal-certificates'
  and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
  and private.has_company_permission((storage.foldername(name))[1]::uuid, 'fiscal.settings')
);

drop policy if exists fiscal_certificate_objects_delete on storage.objects;
create policy fiscal_certificate_objects_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'fiscal-certificates'
  and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
  and private.has_company_permission((storage.foldername(name))[1]::uuid, 'fiscal.settings')
);

commit;
