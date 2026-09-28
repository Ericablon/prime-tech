-- CRONOS / Prime Tech — trava do modo NFS-e Nacional direta
-- Aplicar APÓS 0020_cronos_nfse_nacional_direct.sql.
--
-- Objetivo:
--   • impedir que uma tela antiga volte a gravar Focus NFe como gateway;
--   • manter NFS-e Nacional como único emissor ativo nesta fase;
--   • manter NF-e/NFC-e desativadas até a integração direta com a SEFAZ.

begin;

update public.fiscal_settings
set gateway_provider = 'nfse_nacional',
    nfse_enabled = true,
    nfse_national_enabled = true,
    nfse_mode = 'national',
    nfe_enabled = false,
    nfce_enabled = false,
    updated_at = now();

create or replace function public.enforce_nfse_nacional_direct_settings()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.gateway_provider := 'nfse_nacional';
  new.nfse_enabled := true;
  new.nfse_national_enabled := true;
  new.nfse_mode := 'national';
  new.nfe_enabled := false;
  new.nfce_enabled := false;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_enforce_nfse_nacional_direct_settings on public.fiscal_settings;
create trigger trg_enforce_nfse_nacional_direct_settings
before insert or update on public.fiscal_settings
for each row
execute function public.enforce_nfse_nacional_direct_settings();

commit;
