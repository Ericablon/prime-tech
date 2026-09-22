-- CRONOS / Prime Tech — fundação completa para emissão fiscal
-- Aplicar APÓS 0010_stock_opening_balance_history.sql
--
-- Esta migration prepara o banco para NF-e, NFC-e e NFS-e/NFS-e Nacional.
-- Credenciais do provedor fiscal NUNCA ficam no banco: devem ser secrets da Edge Function.

begin;

-- ============================================================================
-- 1) CADASTRO FISCAL DA EMPRESA
-- ============================================================================

alter table public.company_settings
  add column if not exists tax_regime text,
  add column if not exists street text,
  add column if not exists address_number text,
  add column if not exists address_complement text,
  add column if not exists district text,
  add column if not exists city text,
  add column if not exists city_code text,
  add column if not exists state text,
  add column if not exists postal_code text,
  add column if not exists country_code text not null default '1058',
  add column if not exists country_name text not null default 'Brasil';

alter table public.company_settings
  drop constraint if exists company_settings_tax_regime_check;
alter table public.company_settings
  add constraint company_settings_tax_regime_check
  check (
    tax_regime is null
    or tax_regime in ('simples_nacional','simples_excesso','regime_normal','mei')
  );

-- ============================================================================
-- 2) CADASTRO FISCAL DO CLIENTE / DESTINATÁRIO
-- ============================================================================

alter table public.clients
  add column if not exists state_registration text,
  add column if not exists municipal_registration text,
  add column if not exists ie_indicator text not null default '9',
  add column if not exists street text,
  add column if not exists address_number text,
  add column if not exists address_complement text,
  add column if not exists district text,
  add column if not exists city text,
  add column if not exists city_code text,
  add column if not exists state text,
  add column if not exists postal_code text,
  add column if not exists country_code text not null default '1058',
  add column if not exists country_name text not null default 'Brasil';

alter table public.clients
  drop constraint if exists clients_ie_indicator_check;
alter table public.clients
  add constraint clients_ie_indicator_check
  check (ie_indicator in ('1','2','9'));

-- ============================================================================
-- 3) CADASTRO FISCAL DOS PRODUTOS DO ESTOQUE
-- ============================================================================

alter table public.stock_items
  add column if not exists barcode text,
  add column if not exists ncm text,
  add column if not exists cest text,
  add column if not exists commercial_unit text not null default 'UN',
  add column if not exists tax_origin text not null default '0',
  add column if not exists cfop_internal text,
  add column if not exists cfop_interstate text,
  add column if not exists icms_situation text,
  add column if not exists pis_situation text,
  add column if not exists cofins_situation text,
  add column if not exists ipi_situation text,
  add column if not exists ibs_cbs_situation text,
  add column if not exists ibs_cbs_classification text,
  add column if not exists ibs_cbs_payload jsonb not null default '{}'::jsonb;

create index if not exists idx_stock_items_company_ncm
  on public.stock_items(company_id, ncm)
  where ncm is not null;

-- ============================================================================
-- 4) REGRAS FISCAIS DE SERVIÇOS
-- ============================================================================

create table if not exists public.fiscal_service_rules (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  national_tax_code text,
  municipal_service_code text,
  lc116_code text,
  cnae text,
  iss_rate numeric(8,4),
  iss_taxation text not null default '1',
  ibs_cbs_situation text,
  ibs_cbs_classification text,
  extra_payload jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, name)
);

alter table public.fiscal_service_rules
  drop constraint if exists fiscal_service_rules_iss_rate_check;
alter table public.fiscal_service_rules
  add constraint fiscal_service_rules_iss_rate_check
  check (iss_rate is null or (iss_rate >= 0 and iss_rate <= 100));

-- Snapshot/override fiscal no item da OS. Isso evita que uma alteração futura no
-- cadastro do produto mude o documento que já estava sendo faturado.
alter table public.service_order_items
  add column if not exists fiscal_service_rule_id uuid references public.fiscal_service_rules(id) on delete set null,
  add column if not exists fiscal_ncm text,
  add column if not exists fiscal_cest text,
  add column if not exists fiscal_cfop text,
  add column if not exists fiscal_unit text,
  add column if not exists fiscal_tax_origin text,
  add column if not exists fiscal_icms_situation text,
  add column if not exists fiscal_pis_situation text,
  add column if not exists fiscal_cofins_situation text,
  add column if not exists fiscal_ipi_situation text,
  add column if not exists fiscal_ibs_cbs_situation text,
  add column if not exists fiscal_ibs_cbs_classification text,
  add column if not exists fiscal_extra_payload jsonb not null default '{}'::jsonb;

-- ============================================================================
-- 5) CONFIGURAÇÃO DO EMISSOR
-- ============================================================================

alter table public.fiscal_settings
  add column if not exists nfce_enabled boolean not null default false,
  add column if not exists nfse_national_enabled boolean not null default true,
  add column if not exists nfse_mode text not null default 'national',
  add column if not exists nfe_series text,
  add column if not exists nfce_series text,
  add column if not exists nfse_series text,
  add column if not exists provider_company_id text,
  add column if not exists send_customer_email boolean not null default true,
  add column if not exists production_confirmed boolean not null default false,
  add column if not exists default_nature_operation text not null default 'VENDA DE MERCADORIA',
  add column if not exists default_freight_mode text not null default '9',
  add column if not exists default_buyer_presence text not null default '1';

alter table public.fiscal_settings
  drop constraint if exists fiscal_settings_nfse_mode_check;
alter table public.fiscal_settings
  add constraint fiscal_settings_nfse_mode_check
  check (nfse_mode in ('national','municipal'));

-- O provedor padrão desta implementação é Focus NFe. A coluna permanece aberta
-- para permitir outro adapter no futuro sem alterar o restante do Cronos.
update public.fiscal_settings
set gateway_provider = coalesce(gateway_provider, 'focus_nfe')
where gateway_provider is null;

-- ============================================================================
-- 6) DOCUMENTO FISCAL + SNAPSHOT DOS ITENS/PAGAMENTOS
-- ============================================================================

alter table public.fiscal_documents
  add column if not exists reference text,
  add column if not exists provider_status text,
  add column if not exists request_payload jsonb not null default '{}'::jsonb,
  add column if not exists response_payload jsonb not null default '{}'::jsonb,
  add column if not exists xml_url text,
  add column if not exists pdf_url text,
  add column if not exists last_synced_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancellation_reason text;

create unique index if not exists uq_fiscal_document_reference
  on public.fiscal_documents(company_id, reference)
  where reference is not null;

create unique index if not exists uq_fiscal_active_order_type
  on public.fiscal_documents(company_id, service_order_id, document_type)
  where service_order_id is not null
    and status in ('draft','processing','authorized');

create table if not exists public.fiscal_document_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  fiscal_document_id uuid not null references public.fiscal_documents(id) on delete cascade,
  service_order_item_id uuid references public.service_order_items(id) on delete set null,
  stock_item_id uuid references public.stock_items(id) on delete set null,
  service_rule_id uuid references public.fiscal_service_rules(id) on delete set null,
  line_number integer not null,
  kind text not null check (kind in ('service','part')),
  sku text,
  description text not null,
  quantity numeric(12,3) not null,
  unit_price numeric(12,2) not null,
  total_amount numeric(12,2) not null,
  ncm text,
  cest text,
  cfop text,
  unit_code text,
  tax_origin text,
  icms_situation text,
  pis_situation text,
  cofins_situation text,
  ipi_situation text,
  national_tax_code text,
  municipal_service_code text,
  lc116_code text,
  cnae text,
  iss_rate numeric(8,4),
  iss_taxation text,
  ibs_cbs_situation text,
  ibs_cbs_classification text,
  extra_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(fiscal_document_id, line_number)
);

create table if not exists public.fiscal_document_payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  fiscal_document_id uuid not null references public.fiscal_documents(id) on delete cascade,
  payment_method text not null,
  fiscal_code text not null default '99',
  amount numeric(12,2) not null check (amount >= 0),
  installments integer,
  created_at timestamptz not null default now()
);

create table if not exists public.fiscal_payment_method_mappings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  payment_method text not null,
  fiscal_code text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, payment_method)
);

insert into public.fiscal_payment_method_mappings(company_id, payment_method, fiscal_code)
select c.id, x.method, x.code
from public.companies c
cross join (values
  ('cash','01'),
  ('credit_card','03'),
  ('debit_card','04'),
  ('boleto','15'),
  ('pix','17'),
  ('transfer','18'),
  ('crediario','99'),
  ('check','02'),
  ('other','99')
) as x(method, code)
on conflict (company_id, payment_method) do nothing;

-- ============================================================================
-- 7) VALIDAÇÃO FISCAL DA OS
-- ============================================================================

create or replace function public.fiscal_order_readiness(
  p_order_id uuid,
  p_document_type text
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, private
as $$
declare
  v_order public.service_orders;
  v_company public.company_settings;
  v_client public.clients;
  v_settings public.fiscal_settings;
  v_issues jsonb := '[]'::jsonb;
  v_item_count integer := 0;
  v_total numeric := 0;
begin
  if p_document_type not in ('nfe','nfce','nfse') then
    raise exception 'Tipo de documento fiscal inválido';
  end if;

  select * into v_order
  from public.service_orders
  where id = p_order_id;

  if not found then
    raise exception 'Ordem de Serviço não encontrada';
  end if;

  if not private.has_company_permission(v_order.company_id, 'fiscal.view') then
    raise exception 'Usuário sem permissão para visualizar a validação fiscal';
  end if;

  select * into v_company
  from public.company_settings
  where company_id = v_order.company_id
  limit 1;

  select * into v_client
  from public.clients
  where id = v_order.client_id;

  select * into v_settings
  from public.fiscal_settings
  where company_id = v_order.company_id;

  if v_company.document is null or btrim(v_company.document) = '' then
    v_issues := v_issues || jsonb_build_array('CNPJ/CPF da empresa não informado');
  end if;
  if v_company.legal_name is null or btrim(v_company.legal_name) = '' then
    v_issues := v_issues || jsonb_build_array('Razão social da empresa não informada');
  end if;
  if v_company.tax_regime is null then
    v_issues := v_issues || jsonb_build_array('Regime tributário da empresa não informado');
  end if;
  if v_company.street is null or v_company.city is null or v_company.state is null or v_company.postal_code is null then
    v_issues := v_issues || jsonb_build_array('Endereço fiscal da empresa incompleto');
  end if;
  if v_company.city_code is null or btrim(v_company.city_code) = '' then
    v_issues := v_issues || jsonb_build_array('Código IBGE do município da empresa não informado');
  end if;

  if v_client.document is null or btrim(v_client.document) = '' then
    v_issues := v_issues || jsonb_build_array('CPF/CNPJ do cliente não informado');
  end if;

  if p_document_type in ('nfe','nfce') then
    if v_company.state_registration is null or btrim(v_company.state_registration) = '' then
      v_issues := v_issues || jsonb_build_array('Inscrição Estadual da empresa não informada');
    end if;

    if v_client.street is null or v_client.city is null or v_client.state is null or v_client.postal_code is null then
      v_issues := v_issues || jsonb_build_array('Endereço fiscal do cliente incompleto');
    end if;

    select count(*), coalesce(sum(soi.quantity * soi.unit_price),0)
      into v_item_count, v_total
    from public.service_order_items soi
    left join public.stock_items si on si.id = soi.stock_item_id
    where soi.service_order_id = p_order_id
      and soi.kind = 'part'
      and soi.stock_item_id is not null;

    if v_item_count = 0 then
      v_issues := v_issues || jsonb_build_array('A OS não possui produto/peça para emissão de NF-e/NFC-e');
    end if;

    if exists (
      select 1
      from public.service_order_items soi
      left join public.stock_items si on si.id = soi.stock_item_id
      where soi.service_order_id = p_order_id
        and soi.kind = 'part'
        and (
          coalesce(soi.fiscal_ncm, si.ncm) is null
          or coalesce(soi.fiscal_unit, si.commercial_unit) is null
          or coalesce(
            soi.fiscal_cfop,
            case when coalesce(v_company.state,'') = coalesce(v_client.state,'')
              then si.cfop_internal else si.cfop_interstate end
          ) is null
          or coalesce(soi.fiscal_icms_situation, si.icms_situation) is null
          or coalesce(soi.fiscal_pis_situation, si.pis_situation) is null
          or coalesce(soi.fiscal_cofins_situation, si.cofins_situation) is null
        )
    ) then
      v_issues := v_issues || jsonb_build_array('Existem produtos sem NCM/CFOP/unidade/tributação fiscal completa');
    end if;
  else
    select count(*), coalesce(sum(soi.quantity * soi.unit_price),0)
      into v_item_count, v_total
    from public.service_order_items soi
    where soi.service_order_id = p_order_id
      and soi.kind = 'service';

    if v_item_count = 0 then
      v_issues := v_issues || jsonb_build_array('A OS não possui serviço para emissão de NFS-e');
    end if;

    if exists (
      select 1
      from public.service_order_items soi
      left join public.fiscal_service_rules fsr on fsr.id = soi.fiscal_service_rule_id
      where soi.service_order_id = p_order_id
        and soi.kind = 'service'
        and (
          soi.fiscal_service_rule_id is null
          or fsr.id is null
          or (coalesce(v_settings.nfse_mode,'national') = 'national' and fsr.national_tax_code is null)
        )
    ) then
      v_issues := v_issues || jsonb_build_array('Existem serviços sem regra fiscal/código de tributação vinculado');
    end if;
  end if;

  if v_settings.id is null then
    v_issues := v_issues || jsonb_build_array('Configuração fiscal da empresa ainda não foi criada');
  elsif coalesce(v_settings.gateway_provider,'') = '' then
    v_issues := v_issues || jsonb_build_array('Provedor fiscal não configurado');
  end if;

  if p_document_type = 'nfe' and not coalesce(v_settings.nfe_enabled,false) then
    v_issues := v_issues || jsonb_build_array('Emissão de NF-e está desativada');
  elsif p_document_type = 'nfce' and not coalesce(v_settings.nfce_enabled,false) then
    v_issues := v_issues || jsonb_build_array('Emissão de NFC-e está desativada');
  elsif p_document_type = 'nfse' and not coalesce(v_settings.nfse_enabled,false) then
    v_issues := v_issues || jsonb_build_array('Emissão de NFS-e está desativada');
  end if;

  return jsonb_build_object(
    'ready', jsonb_array_length(v_issues) = 0,
    'issues', v_issues,
    'item_count', v_item_count,
    'total_amount', round(v_total,2),
    'document_type', p_document_type
  );
end;
$$;

-- ============================================================================
-- 8) PREPARAÇÃO/CONGELAMENTO DO DOCUMENTO ANTES DE ENVIAR AO PROVEDOR
-- ============================================================================

create or replace function public.prepare_fiscal_document(
  p_order_id uuid,
  p_document_type text
)
returns public.fiscal_documents
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  v_order public.service_orders;
  v_company public.company_settings;
  v_client public.clients;
  v_doc public.fiscal_documents;
  v_readiness jsonb;
  v_total numeric(12,2);
  v_id uuid := gen_random_uuid();
  v_reference text;
begin
  if p_document_type not in ('nfe','nfce','nfse') then
    raise exception 'Tipo de documento fiscal inválido';
  end if;

  select * into v_order
  from public.service_orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Ordem de Serviço não encontrada';
  end if;

  if not private.has_company_permission(v_order.company_id, 'fiscal.issue') then
    raise exception 'Usuário sem permissão para preparar documento fiscal';
  end if;

  select * into v_doc
  from public.fiscal_documents
  where company_id = v_order.company_id
    and service_order_id = p_order_id
    and document_type = p_document_type
    and status in ('draft','processing','authorized')
  order by created_at desc
  limit 1;

  if found then
    return v_doc;
  end if;

  v_readiness := public.fiscal_order_readiness(p_order_id, p_document_type);
  if not coalesce((v_readiness->>'ready')::boolean, false) then
    raise exception 'Documento fiscal não está pronto: %', v_readiness->'issues';
  end if;

  select * into v_company
  from public.company_settings
  where company_id = v_order.company_id
  limit 1;

  select * into v_client
  from public.clients
  where id = v_order.client_id;

  if p_document_type in ('nfe','nfce') then
    select coalesce(sum(quantity * unit_price),0)::numeric(12,2)
      into v_total
    from public.service_order_items
    where service_order_id = p_order_id and kind = 'part';
  else
    select coalesce(sum(quantity * unit_price),0)::numeric(12,2)
      into v_total
    from public.service_order_items
    where service_order_id = p_order_id and kind = 'service';
  end if;

  v_reference := lower(concat('cronos', v_order.order_number, p_document_type, substr(replace(v_id::text,'-',''),1,12)));

  insert into public.fiscal_documents(
    id, company_id, service_order_id, document_type, status, environment,
    provider, reference, idempotency_key, total_amount, created_by,
    request_payload
  )
  select
    v_id, v_order.company_id, p_order_id, p_document_type, 'draft',
    coalesce(fs.environment,'homologation'), coalesce(fs.gateway_provider,'focus_nfe'),
    v_reference, v_reference, v_total, auth.uid(),
    jsonb_build_object(
      'order_number', v_order.order_number,
      'company_document', v_company.document,
      'client_document', v_client.document,
      'prepared_at', now()
    )
  from public.fiscal_settings fs
  where fs.company_id = v_order.company_id
  returning * into v_doc;

  if v_doc.id is null then
    raise exception 'Configuração fiscal não encontrada para a empresa';
  end if;

  if p_document_type in ('nfe','nfce') then
    insert into public.fiscal_document_items(
      company_id, fiscal_document_id, service_order_item_id, stock_item_id,
      line_number, kind, sku, description, quantity, unit_price, total_amount,
      ncm, cest, cfop, unit_code, tax_origin, icms_situation, pis_situation,
      cofins_situation, ipi_situation, ibs_cbs_situation, ibs_cbs_classification,
      extra_payload
    )
    select
      v_order.company_id, v_doc.id, soi.id, si.id,
      row_number() over(order by soi.created_at, soi.id), soi.kind, si.sku,
      soi.description, soi.quantity, soi.unit_price, round(soi.quantity * soi.unit_price,2),
      coalesce(soi.fiscal_ncm, si.ncm), coalesce(soi.fiscal_cest, si.cest),
      coalesce(
        soi.fiscal_cfop,
        case when coalesce(v_company.state,'') = coalesce(v_client.state,'')
          then si.cfop_internal else si.cfop_interstate end
      ),
      coalesce(soi.fiscal_unit, si.commercial_unit),
      coalesce(soi.fiscal_tax_origin, si.tax_origin),
      coalesce(soi.fiscal_icms_situation, si.icms_situation),
      coalesce(soi.fiscal_pis_situation, si.pis_situation),
      coalesce(soi.fiscal_cofins_situation, si.cofins_situation),
      coalesce(soi.fiscal_ipi_situation, si.ipi_situation),
      coalesce(soi.fiscal_ibs_cbs_situation, si.ibs_cbs_situation),
      coalesce(soi.fiscal_ibs_cbs_classification, si.ibs_cbs_classification),
      coalesce(si.ibs_cbs_payload,'{}'::jsonb) || coalesce(soi.fiscal_extra_payload,'{}'::jsonb)
    from public.service_order_items soi
    join public.stock_items si on si.id = soi.stock_item_id
    where soi.service_order_id = p_order_id
      and soi.kind = 'part';
  else
    insert into public.fiscal_document_items(
      company_id, fiscal_document_id, service_order_item_id, service_rule_id,
      line_number, kind, description, quantity, unit_price, total_amount,
      national_tax_code, municipal_service_code, lc116_code, cnae,
      iss_rate, iss_taxation, ibs_cbs_situation, ibs_cbs_classification,
      extra_payload
    )
    select
      v_order.company_id, v_doc.id, soi.id, fsr.id,
      row_number() over(order by soi.created_at, soi.id), soi.kind,
      soi.description, soi.quantity, soi.unit_price, round(soi.quantity * soi.unit_price,2),
      fsr.national_tax_code, fsr.municipal_service_code, fsr.lc116_code, fsr.cnae,
      fsr.iss_rate, fsr.iss_taxation,
      coalesce(soi.fiscal_ibs_cbs_situation, fsr.ibs_cbs_situation),
      coalesce(soi.fiscal_ibs_cbs_classification, fsr.ibs_cbs_classification),
      coalesce(fsr.extra_payload,'{}'::jsonb) || coalesce(soi.fiscal_extra_payload,'{}'::jsonb)
    from public.service_order_items soi
    join public.fiscal_service_rules fsr on fsr.id = soi.fiscal_service_rule_id
    where soi.service_order_id = p_order_id
      and soi.kind = 'service';
  end if;

  -- Formas de pagamento da OS. Se houver parcelamento, consolida por método.
  insert into public.fiscal_document_payments(
    company_id, fiscal_document_id, payment_method, fiscal_code, amount, installments
  )
  select
    v_order.company_id,
    v_doc.id,
    p.payment_method,
    coalesce(m.fiscal_code,'99'),
    sum(p.amount)::numeric(12,2),
    max(p.installment_count)
  from public.payment_installments p
  left join public.fiscal_payment_method_mappings m
    on m.company_id = v_order.company_id
   and m.payment_method = p.payment_method
   and m.active = true
  where p.service_order_id = p_order_id
  group by p.payment_method, m.fiscal_code;

  insert into public.fiscal_events(
    fiscal_document_id, event_type, status, payload, created_by
  ) values (
    v_doc.id, 'prepared', 'draft', v_readiness, auth.uid()
  );

  return v_doc;
end;
$$;

-- ============================================================================
-- 9) RLS / TRIGGERS / GRANTS
-- ============================================================================

alter table public.fiscal_service_rules enable row level security;
alter table public.fiscal_document_items enable row level security;
alter table public.fiscal_document_payments enable row level security;
alter table public.fiscal_payment_method_mappings enable row level security;
alter table public.fiscal_settings enable row level security;

-- settings
 drop policy if exists fiscal_settings_read on public.fiscal_settings;
 drop policy if exists fiscal_settings_manage on public.fiscal_settings;
create policy fiscal_settings_read
on public.fiscal_settings for select to authenticated
using (private.has_company_permission(company_id, 'fiscal.view'));
create policy fiscal_settings_manage
on public.fiscal_settings for all to authenticated
using (private.has_company_permission(company_id, 'fiscal.settings'))
with check (private.has_company_permission(company_id, 'fiscal.settings'));

-- service rules
create policy fiscal_service_rules_read
on public.fiscal_service_rules for select to authenticated
using (private.has_company_permission(company_id, 'fiscal.view'));
create policy fiscal_service_rules_manage
on public.fiscal_service_rules for all to authenticated
using (private.has_company_permission(company_id, 'fiscal.settings'))
with check (private.has_company_permission(company_id, 'fiscal.settings'));

-- document snapshots
create policy fiscal_document_items_read
on public.fiscal_document_items for select to authenticated
using (private.has_company_permission(company_id, 'fiscal.view'));
create policy fiscal_document_items_manage
on public.fiscal_document_items for all to authenticated
using (private.has_company_permission(company_id, 'fiscal.issue'))
with check (private.has_company_permission(company_id, 'fiscal.issue'));

create policy fiscal_document_payments_read
on public.fiscal_document_payments for select to authenticated
using (private.has_company_permission(company_id, 'fiscal.view'));
create policy fiscal_document_payments_manage
on public.fiscal_document_payments for all to authenticated
using (private.has_company_permission(company_id, 'fiscal.issue'))
with check (private.has_company_permission(company_id, 'fiscal.issue'));

create policy fiscal_payment_method_mappings_read
on public.fiscal_payment_method_mappings for select to authenticated
using (private.has_company_permission(company_id, 'fiscal.view'));
create policy fiscal_payment_method_mappings_manage
on public.fiscal_payment_method_mappings for all to authenticated
using (private.has_company_permission(company_id, 'fiscal.settings'))
with check (private.has_company_permission(company_id, 'fiscal.settings'));

-- fiscal_events também precisa ficar tenant-aware pela empresa do documento.
alter table public.fiscal_events enable row level security;
drop policy if exists fiscal_events_read on public.fiscal_events;
drop policy if exists fiscal_events_insert on public.fiscal_events;
create policy fiscal_events_read
on public.fiscal_events for select to authenticated
using (
  exists (
    select 1 from public.fiscal_documents fd
    where fd.id = fiscal_events.fiscal_document_id
      and private.has_company_permission(fd.company_id, 'fiscal.view')
  )
);
create policy fiscal_events_insert
on public.fiscal_events for insert to authenticated
with check (
  exists (
    select 1 from public.fiscal_documents fd
    where fd.id = fiscal_events.fiscal_document_id
      and private.has_company_permission(fd.company_id, 'fiscal.issue')
  )
);

-- updated_at
 drop trigger if exists set_fiscal_service_rules_updated_at on public.fiscal_service_rules;
create trigger set_fiscal_service_rules_updated_at
before update on public.fiscal_service_rules
for each row execute function public.set_updated_at();

 drop trigger if exists set_fiscal_payment_method_mappings_updated_at on public.fiscal_payment_method_mappings;
create trigger set_fiscal_payment_method_mappings_updated_at
before update on public.fiscal_payment_method_mappings
for each row execute function public.set_updated_at();

 drop trigger if exists set_fiscal_settings_updated_at on public.fiscal_settings;
create trigger set_fiscal_settings_updated_at
before update on public.fiscal_settings
for each row execute function public.set_updated_at();

revoke all on function public.fiscal_order_readiness(uuid,text) from public, anon;
revoke all on function public.prepare_fiscal_document(uuid,text) from public, anon;
grant execute on function public.fiscal_order_readiness(uuid,text) to authenticated;
grant execute on function public.prepare_fiscal_document(uuid,text) to authenticated;

grant select, insert, update, delete on public.fiscal_service_rules to authenticated;
grant select, insert, update, delete on public.fiscal_document_items to authenticated;
grant select, insert, update, delete on public.fiscal_document_payments to authenticated;
grant select, insert, update, delete on public.fiscal_payment_method_mappings to authenticated;
grant select, insert, update, delete on public.fiscal_settings to authenticated;
grant select, insert on public.fiscal_events to authenticated;

commit;
