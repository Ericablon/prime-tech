import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type Action = 'issue' | 'status' | 'cancel';
type FiscalDocumentType = 'nfe' | 'nfce' | 'nfse';

type Body = {
  action: Action;
  documentId: string;
  reason?: string;
};

type AnyRow = Record<string, any>;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function digits(value?: string | null) {
  return String(value ?? '').replace(/\D/g, '');
}

function documentFields(document: string, cnpjKey: string, cpfKey: string) {
  const value = digits(document);
  return value.length === 14 ? { [cnpjKey]: value } : { [cpfKey]: value };
}

function taxRegimeCode(regime?: string | null) {
  if (regime === 'simples_excesso') return 2;
  if (regime === 'regime_normal') return 3;
  return 1;
}

function focusStatus(payload: AnyRow): 'draft' | 'processing' | 'authorized' | 'cancelled' | 'error' {
  const raw = String(payload.status ?? payload.status_sefaz ?? payload.situacao ?? '').toLowerCase();
  if (raw.includes('cancel')) return 'cancelled';
  if (raw.includes('autoriz')) return 'authorized';
  if (raw.includes('process') || raw.includes('fila') || raw.includes('recebid')) return 'processing';
  if (raw.includes('erro') || raw.includes('rejeit') || raw.includes('negad')) return 'error';
  return 'processing';
}

function absoluteUrl(baseUrl: string, value?: string | null) {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return `${baseUrl}${value.startsWith('/') ? '' : '/'}${value}`;
}

function normalizeProviderResult(baseUrl: string, payload: AnyRow) {
  return {
    status: focusStatus(payload),
    providerStatus: String(payload.status ?? payload.status_sefaz ?? payload.situacao ?? ''),
    number: payload.numero ?? payload.numero_nfse ?? payload.numero_nfe ?? null,
    series: payload.serie ?? payload.serie_rps ?? null,
    accessKey: payload.chave_nfe ?? payload.chave_nfce ?? payload.chave ?? null,
    protocol: payload.protocolo ?? payload.protocolo_autorizacao ?? payload.numero_protocolo ?? null,
    xmlUrl: absoluteUrl(baseUrl, payload.caminho_xml_nota_fiscal ?? payload.caminho_xml ?? payload.url_xml ?? payload.xml_url),
    pdfUrl: absoluteUrl(baseUrl, payload.caminho_danfe ?? payload.caminho_danfce ?? payload.url_danfse ?? payload.caminho_pdf ?? payload.url_pdf ?? payload.pdf_url),
    errorMessage: payload.mensagem_sefaz ?? payload.mensagem ?? payload.erro ?? payload.error ?? null,
  };
}

function buildPayments(payments: AnyRow[]) {
  return payments
    .filter((payment) => Number(payment.amount ?? 0) > 0)
    .map((payment) => ({
      forma_pagamento: String(payment.fiscal_code ?? '99'),
      valor_pagamento: Number(payment.amount ?? 0).toFixed(2),
    }));
}

function buildNfePayload(
  documentType: 'nfe' | 'nfce',
  company: AnyRow,
  client: AnyRow,
  settings: AnyRow,
  document: AnyRow,
  items: AnyRow[],
  payments: AnyRow[],
) {
  const isHomologation = document.environment !== 'production';
  const sameState = String(company.state ?? '').toUpperCase() === String(client.state ?? '').toUpperCase();
  const total = items.reduce((sum, item) => sum + Number(item.total_amount ?? 0), 0);
  const now = new Date().toISOString();
  const taxItems = items.map((item, index) => {
    const row: AnyRow = {
      numero_item: String(index + 1),
      codigo_produto: String(item.sku ?? item.stock_item_id ?? index + 1),
      descricao: String(item.description),
      codigo_ncm: digits(item.ncm),
      cfop: digits(item.cfop),
      unidade_comercial: String(item.unit_code ?? 'UN'),
      unidade_tributavel: String(item.unit_code ?? 'UN'),
      quantidade_comercial: String(Number(item.quantity)),
      quantidade_tributavel: String(Number(item.quantity)),
      valor_unitario_comercial: Number(item.unit_price).toFixed(2),
      valor_unitario_tributavel: Number(item.unit_price).toFixed(2),
      valor_bruto: Number(item.total_amount).toFixed(2),
      icms_origem: String(item.tax_origin ?? '0'),
      icms_situacao_tributaria: String(item.icms_situation ?? ''),
      pis_situacao_tributaria: String(item.pis_situation ?? ''),
      cofins_situacao_tributaria: String(item.cofins_situation ?? ''),
    };

    if (item.cest) row.codigo_cest = digits(item.cest);
    if (item.ipi_situation) row.ipi_situacao_tributaria = String(item.ipi_situation);
    if (item.ibs_cbs_situation) row.ibs_cbs_situacao_tributaria = String(item.ibs_cbs_situation);
    if (item.ibs_cbs_classification) row.ibs_cbs_classificacao_tributaria = String(item.ibs_cbs_classification);

    return { ...row, ...(item.extra_payload ?? {}) };
  });

  const payload: AnyRow = {
    natureza_operacao: settings.default_nature_operation ?? 'VENDA DE MERCADORIA',
    data_emissao: now,
    data_entrada_saida: now,
    tipo_documento: 1,
    local_destino: sameState ? 1 : 2,
    finalidade_emissao: 1,
    consumidor_final: 1,
    presenca_comprador: Number(settings.default_buyer_presence ?? 1),
    ...documentFields(company.document, 'cnpj_emitente', 'cpf_emitente'),
    nome_emitente: company.legal_name,
    nome_fantasia_emitente: company.trade_name,
    logradouro_emitente: company.street,
    numero_emitente: company.address_number || 'SN',
    complemento_emitente: company.address_complement || undefined,
    bairro_emitente: company.district,
    municipio_emitente: company.city,
    uf_emitente: company.state,
    cep_emitente: digits(company.postal_code),
    inscricao_estadual_emitente: digits(company.state_registration),
    regime_tributario_emitente: taxRegimeCode(company.tax_regime),
    ...documentFields(client.document, 'cnpj_destinatario', 'cpf_destinatario'),
    nome_destinatario: isHomologation
      ? 'NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL'
      : client.name,
    inscricao_estadual_destinatario: client.state_registration ? digits(client.state_registration) : undefined,
    indicador_inscricao_estadual_destinatario: Number(client.ie_indicator ?? 9),
    logradouro_destinatario: client.street,
    numero_destinatario: client.address_number || 'SN',
    complemento_destinatario: client.address_complement || undefined,
    bairro_destinatario: client.district,
    municipio_destinatario: client.city,
    uf_destinatario: client.state,
    cep_destinatario: digits(client.postal_code),
    pais_destinatario: client.country_name || 'Brasil',
    telefone_destinatario: digits(client.phone),
    valor_frete: 0,
    valor_seguro: 0,
    valor_desconto: 0,
    valor_outras_despesas: 0,
    valor_total: Number(total.toFixed(2)),
    valor_produtos: Number(total.toFixed(2)),
    modalidade_frete: Number(settings.default_freight_mode ?? 9),
    items: taxItems,
  };

  const formasPagamento = buildPayments(payments);
  if (formasPagamento.length) payload.formas_pagamento = formasPagamento;
  if (documentType === 'nfe' && settings.nfe_series) payload.serie = settings.nfe_series;
  if (documentType === 'nfce' && settings.nfce_series) payload.serie = settings.nfce_series;

  return payload;
}

function buildNfseNationalPayload(
  company: AnyRow,
  client: AnyRow,
  settings: AnyRow,
  document: AnyRow,
  items: AnyRow[],
) {
  const first = items[0];
  const total = items.reduce((sum, item) => sum + Number(item.total_amount ?? 0), 0);
  const serviceDescription = items.map((item) => `${item.description} (${Number(item.quantity)} x ${Number(item.unit_price).toFixed(2)})`).join(' | ');
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const simpleCode = company.tax_regime === 'simples_nacional' || company.tax_regime === 'mei' ? '1' : '3';

  const payload: AnyRow = {
    data_emissao: now.toISOString(),
    data_competencia: date,
    emitente_dps: '1',
    codigo_municipio_emissora: digits(company.city_code),
    ...documentFields(company.document, 'cnpj_prestador', 'cpf_prestador'),
    codigo_opcao_simples_nacional: String((settings.settings ?? {}).nfse_simple_code ?? simpleCode),
    regime_especial_tributacao: String((settings.settings ?? {}).nfse_special_regime ?? '0'),
    ...documentFields(client.document, 'cnpj_tomador', 'cpf_tomador'),
    codigo_municipio_prestacao: digits(client.city_code || company.city_code),
    codigo_tributacao_nacional_iss: String(first?.national_tax_code ?? ''),
    descricao_servico: serviceDescription,
    valor_servico: Number(total.toFixed(2)),
    tributacao_iss: Number(first?.iss_taxation ?? 1),
  };

  if (settings.nfse_series) payload.serie_dps = Number(settings.nfse_series) || settings.nfse_series;
  if (first?.ibs_cbs_situation) payload.ibs_cbs_situacao_tributaria = first.ibs_cbs_situation;
  if (first?.ibs_cbs_classification) payload.ibs_cbs_classificacao_tributaria = first.ibs_cbs_classification;
  return { ...payload, ...(first?.extra_payload ?? {}) };
}

function buildNfseMunicipalPayload(
  company: AnyRow,
  client: AnyRow,
  settings: AnyRow,
  items: AnyRow[],
) {
  const first = items[0];
  const total = items.reduce((sum, item) => sum + Number(item.total_amount ?? 0), 0);
  return {
    data_emissao: new Date().toISOString(),
    natureza_operacao: String((settings.settings ?? {}).nfse_nature_operation ?? '1'),
    regime_especial_tributacao: String((settings.settings ?? {}).nfse_special_regime ?? (company.tax_regime === 'mei' ? '5' : '6')),
    optante_simples_nacional: company.tax_regime === 'simples_nacional' || company.tax_regime === 'simples_excesso' || company.tax_regime === 'mei',
    incentivador_cultural: false,
    prestador: {
      cnpj: digits(company.document),
      inscricao_municipal: digits(company.municipal_registration),
      codigo_municipio: digits(company.city_code),
    },
    tomador: {
      ...documentFields(client.document, 'cnpj', 'cpf'),
      razao_social: client.name,
      email: client.email,
      endereco: {
        logradouro: client.street,
        numero: client.address_number || 'SN',
        complemento: client.address_complement,
        bairro: client.district,
        codigo_municipio: digits(client.city_code),
        uf: client.state,
        cep: digits(client.postal_code),
      },
    },
    servico: {
      aliquota: first?.iss_rate == null ? undefined : Number(first.iss_rate),
      discriminacao: items.map((item) => item.description).join(' | '),
      iss_retido: false,
      item_lista_servico: first?.lc116_code || first?.national_tax_code,
      codigo_tributario_municipio: first?.municipal_service_code,
      codigo_cnae: first?.cnae,
      valor_servicos: Number(total.toFixed(2)),
    },
    ...((settings.settings ?? {}).nfse_municipal_extra ?? {}),
  };
}

async function focusRequest(baseUrl: string, token: string, method: string, endpoint: string, body?: unknown) {
  const response = await fetch(`${baseUrl}${endpoint}`, {
    method,
    headers: {
      Authorization: `Basic ${btoa(`${token}:`)}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: body == null ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  let payload: AnyRow;
  try { payload = text ? JSON.parse(text) : {}; } catch { payload = { mensagem: text }; }

  if (!response.ok) {
    const message = payload.mensagem ?? payload.erro ?? payload.error ?? `Focus NFe respondeu HTTP ${response.status}`;
    throw Object.assign(new Error(String(message)), { providerPayload: payload, httpStatus: response.status });
  }
  return payload;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Sessão ausente' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return json({ error: 'Sessão inválida' }, 401);

  let body: Body;
  try { body = await req.json(); } catch { return json({ error: 'JSON inválido' }, 400); }
  if (!body.documentId || !['issue','status','cancel'].includes(body.action)) return json({ error: 'Ação ou documento inválido' }, 400);

  const { data: document, error: documentError } = await supabase
    .from('fiscal_documents')
    .select('*')
    .eq('id', body.documentId)
    .single();
  if (documentError || !document) return json({ error: documentError?.message ?? 'Documento fiscal não encontrado' }, 404);

  const [{ data: settings, error: settingsError }, { data: company, error: companyError }, { data: order, error: orderError }, { data: items, error: itemsError }, { data: payments, error: paymentsError }] = await Promise.all([
    supabase.from('fiscal_settings').select('*').eq('company_id', document.company_id).single(),
    supabase.from('company_settings').select('*').eq('company_id', document.company_id).single(),
    supabase.from('service_orders').select('*').eq('id', document.service_order_id).single(),
    supabase.from('fiscal_document_items').select('*').eq('fiscal_document_id', document.id).order('line_number'),
    supabase.from('fiscal_document_payments').select('*').eq('fiscal_document_id', document.id),
  ]);

  const queryError = settingsError ?? companyError ?? orderError ?? itemsError ?? paymentsError;
  if (queryError || !settings || !company || !order) return json({ error: queryError?.message ?? 'Dados fiscais incompletos' }, 400);

  const { data: client, error: clientError } = await supabase.from('clients').select('*').eq('id', order.client_id).single();
  if (clientError || !client) return json({ error: clientError?.message ?? 'Cliente não encontrado' }, 400);

  if (settings.gateway_provider !== 'focus_nfe') return json({ error: 'Provedor fiscal não suportado por esta função' }, 400);

  const environment = document.environment === 'production' ? 'production' : 'homologation';
  if (environment === 'production' && !settings.production_confirmed) return json({ error: 'Produção fiscal ainda não foi confirmada na configuração' }, 400);

  const token = environment === 'production'
    ? Deno.env.get('FOCUS_NFE_TOKEN_PRODUCTION')
    : Deno.env.get('FOCUS_NFE_TOKEN_HOMOLOGATION');
  if (!token) return json({ error: `Secret do Focus NFe não configurado para ${environment}` }, 503);

  const baseUrl = environment === 'production' ? 'https://api.focusnfe.com.br' : 'https://homologacao.focusnfe.com.br';
  const documentType = document.document_type as FiscalDocumentType;
  const route = documentType === 'nfse' ? (settings.nfse_mode === 'municipal' ? 'nfse' : 'nfsen') : documentType;
  const reference = document.reference ?? document.id.replaceAll('-', '');

  try {
    let providerPayload: AnyRow;
    let requestPayload: AnyRow | undefined;

    if (body.action === 'issue') {
      if (!['draft','error'].includes(document.status)) return json({ error: `Documento não pode ser emitido no status ${document.status}` }, 409);

      if (documentType === 'nfe' || documentType === 'nfce') {
        requestPayload = buildNfePayload(documentType, company, client, settings, document, items ?? [], payments ?? []);
      } else if (settings.nfse_mode === 'municipal') {
        requestPayload = buildNfseMunicipalPayload(company, client, settings, items ?? []);
      } else {
        requestPayload = buildNfseNationalPayload(company, client, settings, document, items ?? []);
      }

      providerPayload = await focusRequest(baseUrl, token, 'POST', `/v2/${route}?ref=${encodeURIComponent(reference)}`, requestPayload);
    } else if (body.action === 'status') {
      providerPayload = await focusRequest(baseUrl, token, 'GET', `/v2/${route}/${encodeURIComponent(reference)}?completa=1`);
    } else {
      if (document.status !== 'authorized') return json({ error: 'Somente documento autorizado pode ser cancelado' }, 409);
      const reason = String(body.reason ?? '').trim();
      if (reason.length < 15 || reason.length > 255) return json({ error: 'A justificativa deve ter entre 15 e 255 caracteres' }, 400);
      providerPayload = await focusRequest(baseUrl, token, 'DELETE', `/v2/${route}/${encodeURIComponent(reference)}`, { justificativa: reason });
    }

    const normalized = normalizeProviderResult(baseUrl, providerPayload);
    const nextStatus = body.action === 'cancel' ? 'cancelled' : normalized.status;
    const updatePayload: AnyRow = {
      status: nextStatus,
      provider_status: normalized.providerStatus,
      response_payload: providerPayload,
      last_synced_at: new Date().toISOString(),
      provider_reference: reference,
      number: normalized.number ?? document.number,
      series: normalized.series ?? document.series,
      access_key: normalized.accessKey ?? document.access_key,
      protocol: normalized.protocol ?? document.protocol,
      xml_url: normalized.xmlUrl ?? document.xml_url,
      pdf_url: normalized.pdfUrl ?? document.pdf_url,
      xml_path: normalized.xmlUrl ?? document.xml_path,
      pdf_path: normalized.pdfUrl ?? document.pdf_path,
      error_message: normalized.errorMessage,
      issued_at: nextStatus === 'authorized' ? (document.issued_at ?? new Date().toISOString()) : document.issued_at,
    };
    if (requestPayload) updatePayload.request_payload = requestPayload;
    if (body.action === 'cancel') {
      updatePayload.cancelled_at = new Date().toISOString();
      updatePayload.cancellation_reason = body.reason;
    }

    const { error: updateError } = await supabase.from('fiscal_documents').update(updatePayload).eq('id', document.id);
    if (updateError) throw updateError;

    await supabase.from('fiscal_events').insert({
      fiscal_document_id: document.id,
      event_type: body.action,
      status: nextStatus,
      protocol: normalized.protocol,
      payload: providerPayload,
      created_by: userData.user.id,
    });

    return json({ ok: true, documentId: document.id, reference, ...normalized, status: nextStatus, provider: providerPayload });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Falha na integração fiscal';
    const providerPayload = (cause as AnyRow)?.providerPayload ?? {};

    await supabase.from('fiscal_documents').update({
      status: body.action === 'cancel' ? document.status : 'error',
      error_message: message,
      response_payload: providerPayload,
      last_synced_at: new Date().toISOString(),
    }).eq('id', document.id);

    await supabase.from('fiscal_events').insert({
      fiscal_document_id: document.id,
      event_type: `${body.action}_error`,
      status: 'error',
      payload: { message, provider: providerPayload },
      created_by: userData.user.id,
    });

    return json({ error: message, provider: providerPayload }, 502);
  }
});
