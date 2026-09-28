import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Buffer } from 'node:buffer';
import { X509Certificate } from 'node:crypto';
import {
  buildDpsFromJson,
  consultarNfse,
  extrairErros,
  gzipBase64,
  gunzipBase64,
  loadPfxFromBuffer,
  signDps,
  transmitirDpsCompactada,
  verifyDps,
} from 'npm:@useinvio/nfse-sdk@2.2.0';

type Action = 'certificate_info' | 'issue' | 'status' | 'cancel';
type AnyRow = Record<string, any>;

type Body = {
  action: Action;
  documentId?: string;
  companyId?: string;
  certificatePassword?: string;
  reason?: string;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const NFS_BASE = {
  homologation: 'https://sefin.producaorestrita.nfse.gov.br/SefinNacional',
  production: 'https://sefin.nfse.gov.br/SefinNacional',
} as const;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function digits(value?: string | null) {
  return String(value ?? '').replace(/\D/g, '');
}

function text(value: unknown) {
  return String(value ?? '').trim();
}

function toMoney(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number.toFixed(2) : '0.00';
}

function dateIso(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function subjectField(subject: string, field: string) {
  const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = subject.match(new RegExp(`(?:^|\\n|,)${escaped}=([^\\n,]+)`, 'i'));
  return match?.[1]?.trim() ?? null;
}

function extractCertificateDocument(certificate: X509Certificate) {
  const source = `${certificate.subject}\n${certificate.subjectAltName ?? ''}`;
  const chunks = source.match(/[0-9.\/-]{11,24}/g) ?? [];
  const normalized = chunks.map(digits);
  return normalized.find((value) => value.length === 14)
    ?? normalized.find((value) => value.length === 11)
    ?? null;
}

function extractAccessKey(body: AnyRow, xml?: string | null) {
  const direct = text(body?.chaveAcesso ?? body?.ChaveAcesso);
  if (direct) return digits(direct);
  return xml?.match(/Id=["']NFS(\d{50})["']/)?.[1] ?? null;
}

function extractNumber(xml?: string | null) {
  if (!xml) return null;
  return xml.match(/<nNFSe>([^<]+)<\/nNFSe>/i)?.[1]
    ?? xml.match(/<nNFS-e>([^<]+)<\/nNFS-e>/i)?.[1]
    ?? null;
}

function withoutCompressedXml(payload: unknown) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return payload;
  const clean = { ...(payload as AnyRow) };
  delete clean.nfseXmlGZipB64;
  delete clean.NfseXmlGZipB64;
  return clean;
}

function providerError(payload: unknown, status: number) {
  const errors = extrairErros(payload);
  if (errors.length) {
    return errors.map((item) => [item.Codigo, item.Descricao, item.Complemento].filter(Boolean).join(' · ')).join(' | ');
  }
  if (typeof payload === 'string' && payload.trim()) return payload.trim();
  return `SEFIN Nacional respondeu HTTP ${status}`;
}

function taxProfile(company: AnyRow, settings: AnyRow) {
  const extras = (settings.settings ?? {}) as AnyRow;
  const override = text(extras.nfse_op_simp_nac);
  let opSimpNac = override;

  if (!opSimpNac) {
    if (company.tax_regime === 'mei') opSimpNac = '2';
    else if (company.tax_regime === 'simples_nacional') opSimpNac = '3';
    else if (company.tax_regime === 'regime_normal') opSimpNac = '1';
  }

  if (!['1', '2', '3'].includes(opSimpNac)) {
    throw new Error('Confirme em Configuração fiscal a opção do Simples Nacional da NFS-e (1, 2 ou 3).');
  }

  const profile: AnyRow = {
    opSimpNac,
    regEspTrib: text(extras.nfse_reg_esp_trib) || '0',
  };

  if (opSimpNac === '3') {
    const regApTribSN = text(extras.nfse_reg_ap_trib_sn);
    if (!['1', '2', '3'].includes(regApTribSN)) {
      throw new Error('Para empresa do Simples Nacional, informe em Configuração fiscal o regime de apuração da NFS-e (1, 2 ou 3).');
    }
    profile.regApTribSN = regApTribSN;
  }

  return profile;
}

function buildTomador(client: AnyRow) {
  const document = digits(client.document);
  if (![11, 14].includes(document.length)) {
    throw new Error('O cliente precisa ter CPF ou CNPJ válido para a NFS-e.');
  }

  const tomador: AnyRow = {
    ...(document.length === 14 ? { CNPJ: document } : { CPF: document }),
    xNome: text(client.name),
  };

  const cityCode = digits(client.city_code);
  const postalCode = digits(client.postal_code);
  if (
    cityCode.length === 7 && postalCode.length === 8
    && text(client.street) && text(client.address_number) && text(client.district)
  ) {
    tomador.end = {
      endNac: { cMun: cityCode, CEP: postalCode },
      xLgr: text(client.street),
      nro: text(client.address_number),
      ...(text(client.address_complement) ? { xCpl: text(client.address_complement) } : {}),
      xBairro: text(client.district),
    };
  }

  if (digits(client.phone)) tomador.fone = digits(client.phone);
  if (text(client.email)) tomador.email = text(client.email);
  return tomador;
}

function buildDpsPayload(
  company: AnyRow,
  client: AnyRow,
  settings: AnyRow,
  document: AnyRow,
  items: AnyRow[],
  dpsNumber: number,
) {
  if (!items.length) throw new Error('A NFS-e não possui serviços preparados.');

  const cityCode = digits(company.city_code);
  if (cityCode.length !== 7) throw new Error('Informe o código IBGE de 7 dígitos da empresa em Configuração fiscal.');

  const companyDocument = digits(company.document);
  if (![11, 14].includes(companyDocument.length)) throw new Error('Informe o CPF/CNPJ do emitente em Configuração fiscal.');

  const first = items[0];
  const nationalTaxCode = digits(first.national_tax_code);
  if (nationalTaxCode.length !== 6) {
    throw new Error('A regra fiscal do serviço precisa ter Código de Tributação Nacional com 6 dígitos.');
  }

  const issTaxation = text(first.iss_taxation);
  if (!['1', '2', '3', '4'].includes(issTaxation)) {
    throw new Error('A regra fiscal do serviço precisa informar a tributação do ISSQN (1, 2, 3 ou 4).');
  }

  const extras = (settings.settings ?? {}) as AnyRow;
  const withholding = text(extras.nfse_iss_withholding);
  if (!['1', '2', '3'].includes(withholding)) {
    throw new Error('Informe em Configuração fiscal a retenção do ISSQN (1, 2 ou 3).');
  }

  const total = items.reduce((sum, item) => sum + Number(item.total_amount ?? 0), 0);
  if (!(total > 0)) throw new Error('O valor dos serviços da NFS-e deve ser maior que zero.');

  const description = items
    .map((item) => `${text(item.description)} (${Number(item.quantity ?? 1)} x R$ ${toMoney(item.unit_price)})`)
    .join(' | ');

  const profile = taxProfile(company, settings);
  const serie = text(settings.nfse_series) || '1';
  if (!/^\d{1,5}$/.test(serie)) throw new Error('A série da DPS deve ser numérica e ter até 5 dígitos.');

  const prestador: AnyRow = {
    ...(companyDocument.length === 14 ? { cnpj: companyDocument } : { cpf: companyDocument }),
    cLocEmi: cityCode,
    serie,
    opSimpNac: profile.opSimpNac,
    regEspTrib: profile.regEspTrib,
  };
  if (profile.regApTribSN) prestador.regApTribSN = profile.regApTribSN;

  const tribMun: AnyRow = {
    tribISSQN: issTaxation,
    tpRetISSQN: withholding,
  };

  // No Simples Nacional a alíquota pode ser calculada/validada pelo ambiente
  // nacional. Só enviamos pAliq quando a configuração fiscal optar por isso.
  const configuredIssRate = extras.nfse_send_iss_rate === true ? Number(first.iss_rate) : NaN;
  if (Number.isFinite(configuredIssRate) && configuredIssRate > 0) {
    tribMun.pAliq = configuredIssRate.toFixed(2);
  }

  const payload: AnyRow = {
    ambiente: document.environment === 'production' ? 'producao' : 'restrita',
    prestador,
    servico: {
      cTribNac: nationalTaxCode,
      xDescServ: description,
      cLocPrestacao: digits(client.city_code || company.city_code),
      ...(digits(first.extra_payload?.cNBS).length === 9 ? { cNBS: digits(first.extra_payload.cNBS) } : {}),
    },
    emissao: {
      nDPS: String(dpsNumber),
      serie,
      valores: { vServ: total.toFixed(2) },
      tomador: buildTomador(client),
      tributacaoMunicipal: tribMun,
      totTrib: { indTotTrib: text(extras.nfse_ind_tot_trib) || '0' },
    },
  };

  return payload;
}

async function getCertificate(
  admin: ReturnType<typeof createClient>,
  company: AnyRow,
  suppliedPassword?: string,
) {
  const { data: certificate, error: certificateError } = await admin
    .from('fiscal_certificates')
    .select('*')
    .eq('company_id', company.company_id)
    .maybeSingle();

  if (certificateError) throw certificateError;
  if (!certificate) throw new Error('Nenhum certificado A1 foi armazenado para esta empresa.');

  const { data: blob, error: downloadError } = await admin.storage
    .from('fiscal-certificates')
    .download(certificate.storage_path);
  if (downloadError || !blob) throw new Error(downloadError?.message ?? 'Não foi possível ler o certificado A1 armazenado.');

  const secretPassword = Deno.env.get('CRONOS_A1_PASSWORD');
  const hasExplicitPassword = suppliedPassword !== undefined;
  const password = hasExplicitPassword ? suppliedPassword! : (secretPassword ?? '');

  let material;
  try {
    material = loadPfxFromBuffer(Buffer.from(await blob.arrayBuffer()), password);
  } catch (cause) {
    if (!hasExplicitPassword && secretPassword === undefined) {
      throw new Error('O A1 está armazenado, mas precisa da senha para ser desbloqueado. Informe a senha nesta emissão ou configure o secret CRONOS_A1_PASSWORD.');
    }
    throw new Error('Não foi possível desbloquear o certificado A1. Confira a senha informada.');
  }

  const x509 = new X509Certificate(material.certPem);
  const validFrom = dateIso(x509.validFrom);
  const validUntil = dateIso(x509.validTo);
  const now = Date.now();
  const start = validFrom ? Date.parse(validFrom) : NaN;
  const end = validUntil ? Date.parse(validUntil) : NaN;

  if (Number.isFinite(start) && start > now) throw new Error('O certificado A1 ainda não está válido.');
  if (Number.isFinite(end) && end < now) {
    await admin.from('fiscal_certificates').update({
      status: 'expired', valid_from: validFrom, valid_until: validUntil,
      last_validated_at: new Date().toISOString(), last_error: 'Certificado expirado', updated_at: new Date().toISOString(),
    }).eq('id', certificate.id);
    throw new Error('O certificado A1 está expirado.');
  }

  const certificateDocument = extractCertificateDocument(x509);
  const companyDocument = digits(company.document);
  if (certificateDocument && companyDocument && certificateDocument !== companyDocument) {
    await admin.from('fiscal_certificates').update({
      status: 'error', certificate_document: certificateDocument,
      subject_name: x509.subject, issuer_name: x509.issuer, serial_number: x509.serialNumber,
      valid_from: validFrom, valid_until: validUntil, last_validated_at: new Date().toISOString(),
      last_error: 'Documento do certificado não corresponde ao emitente cadastrado', updated_at: new Date().toISOString(),
    }).eq('id', certificate.id);
    throw new Error(`O CPF/CNPJ do certificado (${certificateDocument}) não corresponde ao emitente cadastrado (${companyDocument}).`);
  }

  const commonName = subjectField(x509.subject, 'CN');
  const metadata = {
    status: 'ready',
    certificate_document: certificateDocument,
    subject_name: x509.subject,
    issuer_name: x509.issuer,
    serial_number: x509.serialNumber,
    valid_from: validFrom,
    valid_until: validUntil,
    last_validated_at: new Date().toISOString(),
    last_error: null,
    updated_at: new Date().toISOString(),
  };

  await admin.from('fiscal_certificates').update(metadata).eq('id', certificate.id);

  // O certificado só preenche o que é seguro derivar dele. Regime tributário,
  // IM, endereço e códigos de serviço continuam sendo dados fiscais cadastrados.
  if (!companyDocument && certificateDocument?.length === 14) {
    await admin.from('company_settings').update({ document: certificateDocument }).eq('company_id', company.company_id);
  }
  if (!text(company.legal_name) && commonName) {
    await admin.from('company_settings').update({ legal_name: commonName.replace(/:\d{11,14}$/, '').trim() }).eq('company_id', company.company_id);
  }

  return { certificate, material, x509, metadata, commonName };
}

async function saveXml(
  admin: ReturnType<typeof createClient>,
  companyId: string,
  documentId: string,
  xml: string,
) {
  const path = `${companyId}/nfse/${documentId}.xml`;
  const { error } = await admin.storage.from('fiscal-documents').upload(
    path,
    new Blob([xml], { type: 'application/xml' }),
    { upsert: true, contentType: 'application/xml' },
  );
  if (error) throw error;
  return path;
}

function nfseXmlFromBody(body: AnyRow) {
  const compressed = text(body?.nfseXmlGZipB64 ?? body?.NfseXmlGZipB64);
  return compressed ? gunzipBase64(compressed) : null;
}

async function recordEvent(
  admin: ReturnType<typeof createClient>,
  documentId: string,
  userId: string,
  eventType: string,
  status: string,
  payload: unknown,
  protocol?: string | null,
) {
  await admin.from('fiscal_events').insert({
    fiscal_document_id: documentId,
    event_type: eventType,
    status,
    protocol: protocol ?? null,
    payload,
    created_by: userId,
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Sessão ausente' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRole) return json({ error: 'Ambiente Supabase incompleto na Edge Function' }, 503);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ error: 'Sessão inválida' }, 401);

  let body: Body;
  try { body = await req.json(); } catch { return json({ error: 'JSON inválido' }, 400); }
  if (!['certificate_info', 'issue', 'status', 'cancel'].includes(body.action)) return json({ error: 'Ação inválida' }, 400);

  try {
    // -----------------------------------------------------------------------
    // Leitura/validação do A1 sem persistir senha.
    // -----------------------------------------------------------------------
    if (body.action === 'certificate_info') {
      if (!body.companyId) return json({ error: 'Empresa não informada' }, 400);
      const { data: allowed, error: permissionError } = await userClient.rpc('has_fiscal_permission', {
        p_company_id: body.companyId,
        p_permission: 'fiscal.settings',
      });
      if (permissionError) throw permissionError;
      if (!allowed) return json({ error: 'Seu perfil não pode validar o certificado fiscal.' }, 403);

      const { data: company, error: companyError } = await admin.from('company_settings').select('*').eq('company_id', body.companyId).single();
      if (companyError || !company) throw new Error(companyError?.message ?? 'Empresa não encontrada');

      const certificateResult = await getCertificate(admin, company, body.certificatePassword);
      return json({
        ok: true,
        status: 'ready',
        commonName: certificateResult.commonName,
        document: certificateResult.metadata.certificate_document,
        issuer: certificateResult.metadata.issuer_name,
        serialNumber: certificateResult.metadata.serial_number,
        validFrom: certificateResult.metadata.valid_from,
        validUntil: certificateResult.metadata.valid_until,
      });
    }

    if (!body.documentId) return json({ error: 'Documento fiscal não informado' }, 400);

    const { data: document, error: documentError } = await userClient
      .from('fiscal_documents')
      .select('*')
      .eq('id', body.documentId)
      .single();
    if (documentError || !document) return json({ error: documentError?.message ?? 'Documento fiscal não encontrado' }, 404);

    const requiredPermission = body.action === 'cancel' ? 'fiscal.cancel' : body.action === 'issue' ? 'fiscal.issue' : 'fiscal.view';
    const { data: allowed, error: permissionError } = await userClient.rpc('has_fiscal_permission', {
      p_company_id: document.company_id,
      p_permission: requiredPermission,
    });
    if (permissionError) throw permissionError;
    if (!allowed) return json({ error: 'Seu perfil não possui permissão para esta ação fiscal.' }, 403);

    const [settingsResult, companyResult, orderResult, itemsResult] = await Promise.all([
      admin.from('fiscal_settings').select('*').eq('company_id', document.company_id).single(),
      admin.from('company_settings').select('*').eq('company_id', document.company_id).single(),
      admin.from('service_orders').select('*').eq('id', document.service_order_id).single(),
      admin.from('fiscal_document_items').select('*').eq('fiscal_document_id', document.id).order('line_number'),
    ]);

    const queryError = settingsResult.error ?? companyResult.error ?? orderResult.error ?? itemsResult.error;
    const settings = settingsResult.data;
    const company = companyResult.data;
    const order = orderResult.data;
    const items = itemsResult.data ?? [];
    if (queryError || !settings || !company || !order) throw new Error(queryError?.message ?? 'Dados fiscais incompletos');

    if (document.document_type !== 'nfse') {
      return json({ error: 'A emissão direta neste estágio está habilitada somente para NFS-e Nacional. NF-e/NFC-e permanecem desabilitadas.' }, 400);
    }
    if (settings.gateway_provider !== 'nfse_nacional' || settings.nfse_mode !== 'national') {
      return json({ error: 'Configure o emissor como NFS-e Nacional direta antes de transmitir.' }, 400);
    }
    if (document.environment === 'production' && !settings.production_confirmed) {
      return json({ error: 'Produção fiscal ainda não foi confirmada na configuração.' }, 400);
    }

    const { data: client, error: clientError } = await admin.from('clients').select('*').eq('id', order.client_id).single();
    if (clientError || !client) throw new Error(clientError?.message ?? 'Cliente não encontrado');

    const certificateResult = await getCertificate(admin, company, body.certificatePassword);
    const pfx = certificateResult.material;
    const environment = document.environment === 'production' ? 'producao' : 'restrita';

    if (body.action === 'cancel') {
      return json({
        error: 'Cancelamento direto da NFS-e Nacional ainda não foi habilitado no Cronos. A emissão e a consulta já usam a SEFIN diretamente; o evento de cancelamento será homologado separadamente para não enviar evento fiscal incorreto.',
      }, 501);
    }

    if (body.action === 'status') {
      const accessKey = digits(document.access_key ?? document.provider_reference);
      if (accessKey.length !== 50) return json({ error: 'Documento sem chave de acesso válida para consulta.' }, 400);

      const result = await consultarNfse(accessKey, pfx, environment);
      if (result.status < 200 || result.status >= 300) {
        throw Object.assign(new Error(providerError(result.body, result.status)), { providerPayload: result.body });
      }

      const providerPayload = result.body as AnyRow;
      const xml = nfseXmlFromBody(providerPayload);
      const xmlPath = xml ? await saveXml(admin, document.company_id, document.id, xml) : document.xml_path;
      const returnedKey = extractAccessKey(providerPayload, xml) ?? accessKey;
      const number = extractNumber(xml) ?? document.number;

      await admin.from('fiscal_documents').update({
        status: 'authorized',
        provider: 'sefin_nacional',
        provider_status: 'authorized',
        provider_reference: returnedKey,
        access_key: returnedKey,
        number,
        xml_path: xmlPath,
        xml_url: null,
        response_payload: withoutCompressedXml(providerPayload),
        error_message: null,
        last_synced_at: new Date().toISOString(),
      }).eq('id', document.id);

      await recordEvent(admin, document.id, userData.user.id, 'status', 'authorized', withoutCompressedXml(providerPayload));
      return json({ ok: true, status: 'authorized', accessKey: returnedKey, number });
    }

    if (!['draft', 'error'].includes(document.status)) {
      return json({ error: `Documento não pode ser emitido no status ${document.status}` }, 409);
    }

    const { data: dpsNumber, error: sequenceError } = await userClient.rpc('next_fiscal_dps_number', {
      p_company_id: document.company_id,
    });
    if (sequenceError || !dpsNumber) throw new Error(sequenceError?.message ?? 'Não foi possível reservar o número da DPS');

    const dpsPayload = buildDpsPayload(company, client, settings, document, items, Number(dpsNumber));
    const built = buildDpsFromJson(dpsPayload);
    const signedXml = signDps(built.xml, built.id, pfx);
    if (!verifyDps(signedXml, pfx.certPem)) throw new Error('A assinatura digital da DPS não pôde ser verificada.');

    const compressed = gzipBase64(signedXml);
    const result = await transmitirDpsCompactada(compressed, pfx, environment);
    if (result.status < 200 || result.status >= 300) {
      throw Object.assign(new Error(providerError(result.body, result.status)), { providerPayload: result.body });
    }

    const providerPayload = result.body as AnyRow;
    const xml = nfseXmlFromBody(providerPayload);
    if (!xml) {
      throw Object.assign(new Error('A SEFIN respondeu sem o XML autorizado da NFS-e.'), { providerPayload });
    }

    const accessKey = extractAccessKey(providerPayload, xml);
    if (!accessKey || accessKey.length !== 50) {
      throw Object.assign(new Error('A NFS-e foi recebida, mas a chave de acesso não pôde ser identificada.'), { providerPayload });
    }

    const xmlPath = await saveXml(admin, document.company_id, document.id, xml);
    const number = extractNumber(xml);
    const now = new Date().toISOString();

    await admin.from('fiscal_documents').update({
      status: 'authorized',
      provider: 'sefin_nacional',
      provider_status: 'authorized',
      provider_reference: accessKey,
      reference: built.id,
      access_key: accessKey,
      number,
      series: text(settings.nfse_series) || '1',
      request_payload: dpsPayload,
      response_payload: withoutCompressedXml(providerPayload),
      xml_path: xmlPath,
      xml_url: null,
      pdf_path: null,
      pdf_url: null,
      error_message: null,
      issued_at: now,
      last_synced_at: now,
    }).eq('id', document.id);

    await recordEvent(admin, document.id, userData.user.id, 'issue', 'authorized', {
      dpsId: built.id,
      accessKey,
      response: withoutCompressedXml(providerPayload),
    });

    return json({ ok: true, status: 'authorized', accessKey, number, dpsId: built.id });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Falha na integração fiscal';
    const providerPayload = (cause as AnyRow)?.providerPayload ?? {};

    if (body.documentId) {
      const { data: current } = await admin.from('fiscal_documents').select('status').eq('id', body.documentId).maybeSingle();
      const nextStatus = body.action === 'issue' ? 'error' : current?.status;
      await admin.from('fiscal_documents').update({
        ...(nextStatus ? { status: nextStatus } : {}),
        error_message: message,
        response_payload: withoutCompressedXml(providerPayload),
        last_synced_at: new Date().toISOString(),
      }).eq('id', body.documentId);

      await recordEvent(admin, body.documentId, userData.user.id, `${body.action}_error`, 'error', {
        message,
        provider: withoutCompressedXml(providerPayload),
      });
    }

    return json({ error: message, provider: withoutCompressedXml(providerPayload) }, 502);
  }
});
