-- CRONOS / Prime Tech — NFS-e Nacional direta, sem provedor pago
-- Aplicar APÓS 0019.
--
-- Esta migration prepara o Cronos para:
--   • usar o A1 privado já armazenado no Supabase;
--   • extrair/registrar metadados do certificado;
--   • reservar numeração de DPS de forma atômica;
--   • armazenar XML autorizado em bucket privado;
--   • transmitir NFS-e Nacional pela Edge Function fiscal-gateway.
--
-- A senha do A1 NÃO é salva no banco. A Edge Function aceita a senha somente
-- durante a chamada ou, opcionalmente, via secret CRONOS_A1_PASSWORD.

begin;

-- ---------------------------------------------------------------------------
-- 1) Certificado A1: metadados extraídos após desbloquear o PKCS#12.
-- ---------------------------------------------------------------------------
alter table public.fiscal_certificates
  add column if not exists subject_name text,
  add column if not exists issuer_name text,
  add column if not exists serial_number text,
  add column if not exists certificate_document text,
  add column if not exists last_validated_at timestamptz;

alter table public.fiscal_certificates
  drop constraint if exists fiscal_certificates_status_check;

alter table public.fiscal_certificates
  add constraint fiscal_certificates_status_check
  check (status in ('stored','ready','provider_synced','expired','revoked','error'));

-- ---------------------------------------------------------------------------
-- 2) NFS-e Nacional direta. NF-e/NFC-e continuam desabilitadas neste estágio.
-- ---------------------------------------------------------------------------
update public.fiscal_settings
set gateway_provider = 'nfse_nacional',
    nfse_enabled = true,
    nfse_national_enabled = true,
    nfse_mode = 'national',
    nfe_enabled = false,
    nfce_enabled = false,
    updated_at = now();

-- ---------------------------------------------------------------------------
-- 3) Sequência própria de DPS por empresa.
-- ---------------------------------------------------------------------------
create table if not exists public.fiscal_dps_sequences (
  company_id uuid primary key references public.companies(id) on delete cascade,
  last_number bigint not null default 0 check (last_number >= 0),
  updated_at timestamptz not null default now()
);

alter table public.fiscal_dps_sequences enable row level security;

drop policy if exists fiscal_dps_sequences_read on public.fiscal_dps_sequences;
create policy fiscal_dps_sequences_read
on public.fiscal_dps_sequences
for select
to authenticated
using (private.has_company_permission(company_id, 'fiscal.view'));

-- Aloca um número sem risco de duas emissões usarem a mesma DPS.
create or replace function public.next_fiscal_dps_number(p_company_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_number bigint;
begin
  if auth.uid() is null then
    raise exception 'Sessão ausente';
  end if;

  if not private.has_company_permission(p_company_id, 'fiscal.issue') then
    raise exception 'Usuário sem permissão para emitir documento fiscal';
  end if;

  insert into public.fiscal_dps_sequences(company_id, last_number, updated_at)
  values (p_company_id, 1, now())
  on conflict (company_id) do update
    set last_number = public.fiscal_dps_sequences.last_number + 1,
        updated_at = now()
  returning last_number into v_number;

  return v_number;
end;
$$;

-- Wrapper público e restrito para a Edge Function validar a ação antes de usar
-- o service role para Storage/integração externa.
create or replace function public.has_fiscal_permission(
  p_company_id uuid,
  p_permission text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
begin
  if auth.uid() is null then
    return false;
  end if;

  if p_permission not in ('fiscal.view','fiscal.issue','fiscal.cancel','fiscal.settings') then
    return false;
  end if;

  return private.has_company_permission(p_company_id, p_permission);
end;
$$;

revoke all on function public.next_fiscal_dps_number(uuid) from public, anon;
revoke all on function public.has_fiscal_permission(uuid,text) from public, anon;
grant execute on function public.next_fiscal_dps_number(uuid) to authenticated;
grant execute on function public.has_fiscal_permission(uuid,text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4) XML fiscal em bucket privado.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'fiscal-documents',
  'fiscal-documents',
  false,
  5242880,
  array['application/xml','text/xml','application/octet-stream']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists fiscal_document_objects_read on storage.objects;
create policy fiscal_document_objects_read
on storage.objects
for select
to authenticated
using (
  bucket_id = 'fiscal-documents'
  and exists (
    select 1
    from public.user_company_access u
    join public.role_permissions rp on rp.role_code = u.role_code
    where u.user_id = auth.uid()
      and u.active = true
      and u.company_id::text = (storage.foldername(name))[1]
      and rp.permission_code in ('fiscal.view','fiscal.issue','fiscal.settings')
  )
);

drop policy if exists fiscal_document_objects_insert on storage.objects;
create policy fiscal_document_objects_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'fiscal-documents'
  and exists (
    select 1
    from public.user_company_access u
    join public.role_permissions rp on rp.role_code = u.role_code
    where u.user_id = auth.uid()
      and u.active = true
      and u.company_id::text = (storage.foldername(name))[1]
      and rp.permission_code = 'fiscal.issue'
  )
);

drop policy if exists fiscal_document_objects_update on storage.objects;
create policy fiscal_document_objects_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'fiscal-documents'
  and exists (
    select 1
    from public.user_company_access u
    join public.role_permissions rp on rp.role_code = u.role_code
    where u.user_id = auth.uid()
      and u.active = true
      and u.company_id::text = (storage.foldername(name))[1]
      and rp.permission_code = 'fiscal.issue'
  )
)
with check (
  bucket_id = 'fiscal-documents'
  and exists (
    select 1
    from public.user_company_access u
    join public.role_permissions rp on rp.role_code = u.role_code
    where u.user_id = auth.uid()
      and u.active = true
      and u.company_id::text = (storage.foldername(name))[1]
      and rp.permission_code = 'fiscal.issue'
  )
);

commit;
