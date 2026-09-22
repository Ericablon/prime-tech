import {
  AlertTriangle,
  Boxes,
  Building2,
  CheckCircle2,
  FileCog,
  Landmark,
  PackageSearch,
  PlusCircle,
  RefreshCw,
  Save,
  Wrench,
} from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useState } from 'react';

import { PageHeader } from '../components/ui/PageHeader';
import { useAuth } from '../contexts/AuthContext';
import { usePrimeTech } from '../contexts/PrimeTechContext';
import { can } from '../lib/permissions';
import { supabase } from '../lib/supabase';
import type { CompanySettings, StockItem } from '../types/domain';

type FiscalSettingsRow = {
  id?: string;
  company_id: string;
  environment: 'homologation' | 'production';
  gateway_provider: string | null;
  nfse_enabled: boolean;
  nfe_enabled: boolean;
  nfce_enabled: boolean;
  nfse_national_enabled: boolean;
  nfse_mode: 'national' | 'municipal';
  issue_mode: 'manual' | 'review' | 'after_completion' | 'after_billing';
  nfe_series?: string | null;
  nfce_series?: string | null;
  nfse_series?: string | null;
  send_customer_email: boolean;
  production_confirmed: boolean;
  default_nature_operation: string;
  default_freight_mode: string;
  default_buyer_presence: string;
  settings?: Record<string, unknown>;
};

type ServiceRule = {
  id: string;
  name: string;
  national_tax_code?: string | null;
  municipal_service_code?: string | null;
  lc116_code?: string | null;
  cnae?: string | null;
  iss_rate?: number | null;
  active: boolean;
};

const blankSettings = (companyId: string): FiscalSettingsRow => ({
  company_id: companyId,
  environment: 'homologation',
  gateway_provider: 'focus_nfe',
  nfse_enabled: true,
  nfe_enabled: true,
  nfce_enabled: false,
  nfse_national_enabled: true,
  nfse_mode: 'national',
  issue_mode: 'review',
  nfe_series: '',
  nfce_series: '',
  nfse_series: '',
  send_customer_email: true,
  production_confirmed: false,
  default_nature_operation: 'VENDA DE MERCADORIA',
  default_freight_mode: '9',
  default_buyer_presence: '1',
  settings: {},
});

export function FiscalSettingsPage() {
  const { user, mode } = useAuth();
  const { companyId, company, stock, updateCompany, refresh } = usePrimeTech();
  const canManage = can(user, 'fiscal.settings');

  const [settings, setSettings] = useState<FiscalSettingsRow | null>(null);
  const [rules, setRules] = useState<ServiceRule[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<StockItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [companyForm, setCompanyForm] = useState({
    legalName: company.legal_name ?? '',
    document: company.document ?? '',
    stateRegistration: company.state_registration ?? '',
    municipalRegistration: company.municipal_registration ?? '',
    taxRegime: company.tax_regime ?? '',
    street: company.street ?? '',
    number: company.address_number ?? '',
    complement: company.address_complement ?? '',
    district: company.district ?? '',
    city: company.city ?? '',
    cityCode: company.city_code ?? '',
    state: company.state ?? 'BA',
    postalCode: company.postal_code ?? '',
  });

  const [productForm, setProductForm] = useState({
    ncm: '', cest: '', unit: 'UN', origin: '0', cfopInternal: '', cfopInterstate: '',
    icms: '', pis: '', cofins: '', ipi: '', ibsCbsSituation: '', ibsCbsClassification: '',
  });

  const [serviceForm, setServiceForm] = useState({
    name: '', nationalTaxCode: '', municipalServiceCode: '', lc116: '', cnae: '', issRate: '',
    issTaxation: '1', ibsCbsSituation: '', ibsCbsClassification: '',
  });

  useEffect(() => {
    setCompanyForm({
      legalName: company.legal_name ?? '',
      document: company.document ?? '',
      stateRegistration: company.state_registration ?? '',
      municipalRegistration: company.municipal_registration ?? '',
      taxRegime: company.tax_regime ?? '',
      street: company.street ?? '',
      number: company.address_number ?? '',
      complement: company.address_complement ?? '',
      district: company.district ?? '',
      city: company.city ?? '',
      cityCode: company.city_code ?? '',
      state: company.state ?? 'BA',
      postalCode: company.postal_code ?? '',
    });
  }, [company]);

  useEffect(() => {
    const client = supabase;
    const activeCompanyId = companyId;
    if (mode !== 'supabase' || !client || !activeCompanyId) {
      setSettings(activeCompanyId ? blankSettings(activeCompanyId) : null);
      setLoading(false);
      return;
    }

    let alive = true;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const [settingsResult, rulesResult] = await Promise.all([
          client.from('fiscal_settings').select('*').eq('company_id', activeCompanyId).maybeSingle(),
          client.from('fiscal_service_rules').select('*').eq('company_id', activeCompanyId).order('name'),
        ]);
        if (settingsResult.error) throw settingsResult.error;
        if (rulesResult.error) throw rulesResult.error;
        if (!alive) return;
        setSettings((settingsResult.data as FiscalSettingsRow | null) ?? blankSettings(activeCompanyId));
        setRules((rulesResult.data ?? []) as ServiceRule[]);
      } catch (cause) {
        if (alive) setError(cause instanceof Error ? cause.message : 'Não foi possível carregar a configuração fiscal.');
      } finally {
        if (alive) setLoading(false);
      }
    }
    void load();
    return () => { alive = false; };
  }, [companyId, mode]);

  const incompleteProducts = useMemo(
    () => stock.filter((item) => item.active !== false && (!item.ncm || !item.cfop_internal || !item.cfop_interstate || !item.icms_situation || !item.pis_situation || !item.cofins_situation)),
    [stock],
  );

  function beginProduct(item: StockItem) {
    setSelectedProduct(item);
    setProductForm({
      ncm: item.ncm ?? '', cest: item.cest ?? '', unit: item.commercial_unit ?? 'UN', origin: item.tax_origin ?? '0',
      cfopInternal: item.cfop_internal ?? '', cfopInterstate: item.cfop_interstate ?? '', icms: item.icms_situation ?? '',
      pis: item.pis_situation ?? '', cofins: item.cofins_situation ?? '', ipi: item.ipi_situation ?? '',
      ibsCbsSituation: item.ibs_cbs_situation ?? '', ibsCbsClassification: item.ibs_cbs_classification ?? '',
    });
  }

  async function saveCompany(event: FormEvent) {
    event.preventDefault();
    if (!canManage) return;
    setSaving(true); setError(''); setSuccess('');
    try {
      await updateCompany({
        legal_name: companyForm.legalName.trim() || null,
        document: companyForm.document.replace(/\D/g, '') || null,
        state_registration: companyForm.stateRegistration.trim() || null,
        municipal_registration: companyForm.municipalRegistration.trim() || null,
        tax_regime: (companyForm.taxRegime || null) as CompanySettings['tax_regime'],
        street: companyForm.street.trim() || null,
        address_number: companyForm.number.trim() || null,
        address_complement: companyForm.complement.trim() || null,
        district: companyForm.district.trim() || null,
        city: companyForm.city.trim() || null,
        city_code: companyForm.cityCode.replace(/\D/g, '') || null,
        state: companyForm.state.toUpperCase().trim() || null,
        postal_code: companyForm.postalCode.replace(/\D/g, '') || null,
      });
      setSuccess('Cadastro fiscal da empresa salvo.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar o emitente.');
    } finally { setSaving(false); }
  }

  async function saveSettings(event: FormEvent) {
    event.preventDefault();
    const client = supabase;
    if (!canManage || !settings || !companyId || !client) return;
    if (settings.environment === 'production' && !settings.production_confirmed) {
      setError('Confirme explicitamente a emissão real antes de selecionar produção.');
      return;
    }
    setSaving(true); setError(''); setSuccess('');
    try {
      const payload = { ...settings, company_id: companyId, gateway_provider: 'focus_nfe' };
      delete payload.id;
      const { data, error: saveError } = await client.from('fiscal_settings').upsert(payload, { onConflict: 'company_id' }).select().single();
      if (saveError) throw saveError;
      setSettings(data as FiscalSettingsRow);
      setSuccess('Configuração do emissor salva.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar o emissor.');
    } finally { setSaving(false); }
  }

  async function saveProduct(event: FormEvent) {
    event.preventDefault();
    const client = supabase;
    if (!canManage || !selectedProduct || !client) return;
    setSaving(true); setError(''); setSuccess('');
    try {
      const { error: saveError } = await client.from('stock_items').update({
        ncm: productForm.ncm.replace(/\D/g, '') || null,
        cest: productForm.cest.replace(/\D/g, '') || null,
        commercial_unit: productForm.unit.trim().toUpperCase() || 'UN',
        tax_origin: productForm.origin.trim() || '0',
        cfop_internal: productForm.cfopInternal.replace(/\D/g, '') || null,
        cfop_interstate: productForm.cfopInterstate.replace(/\D/g, '') || null,
        icms_situation: productForm.icms.trim() || null,
        pis_situation: productForm.pis.trim() || null,
        cofins_situation: productForm.cofins.trim() || null,
        ipi_situation: productForm.ipi.trim() || null,
        ibs_cbs_situation: productForm.ibsCbsSituation.trim() || null,
        ibs_cbs_classification: productForm.ibsCbsClassification.trim() || null,
      }).eq('id', selectedProduct.id);
      if (saveError) throw saveError;
      await refresh();
      setSelectedProduct(null);
      setSuccess('Tributação do produto salva.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar o produto fiscal.');
    } finally { setSaving(false); }
  }

  async function addServiceRule(event: FormEvent) {
    event.preventDefault();
    const client = supabase;
    if (!canManage || !companyId || !client) return;
    if (!serviceForm.name.trim()) return setError('Informe o nome da regra de serviço.');
    setSaving(true); setError(''); setSuccess('');
    try {
      const parsedRate = serviceForm.issRate ? Number(serviceForm.issRate.replace(',', '.')) : null;
      const { data, error: saveError } = await client.from('fiscal_service_rules').insert({
        company_id: companyId,
        name: serviceForm.name.trim(),
        national_tax_code: serviceForm.nationalTaxCode.replace(/\D/g, '') || null,
        municipal_service_code: serviceForm.municipalServiceCode.trim() || null,
        lc116_code: serviceForm.lc116.trim() || null,
        cnae: serviceForm.cnae.replace(/\D/g, '') || null,
        iss_rate: parsedRate !== null && Number.isFinite(parsedRate) ? parsedRate : null,
        iss_taxation: serviceForm.issTaxation || '1',
        ibs_cbs_situation: serviceForm.ibsCbsSituation.trim() || null,
        ibs_cbs_classification: serviceForm.ibsCbsClassification.trim() || null,
      }).select().single();
      if (saveError) throw saveError;
      setRules((current) => [...current, data as ServiceRule].sort((a, b) => a.name.localeCompare(b.name)));
      setServiceForm({ name: '', nationalTaxCode: '', municipalServiceCode: '', lc116: '', cnae: '', issRate: '', issTaxation: '1', ibsCbsSituation: '', ibsCbsClassification: '' });
      setSuccess('Regra fiscal de serviço cadastrada.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível cadastrar a regra.');
    } finally { setSaving(false); }
  }

  if (loading || !settings) return <div className="empty-state"><RefreshCw size={38} /><h3>Carregando configuração fiscal</h3></div>;

  const companyReady = Boolean(companyForm.legalName && companyForm.document && companyForm.taxRegime && companyForm.cityCode && companyForm.state && companyForm.postalCode);

  return <>
    <PageHeader eyebrow="Fiscal" title="Configuração para emissão de notas" description="Emitente, produtos, serviços e gateway necessários para NF-e, NFC-e e NFS-e. CNPJ e credenciais podem ser concluídos depois." />

    {(error || success) && <section className="notice" style={{ marginBottom: 16 }}>{error ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />}<div><strong>{error ? 'Atenção' : 'Salvo'}</strong><p>{error || success}</p></div></section>}

    <div className="metrics-grid">
      <article className={`metric-card ${companyReady ? 'green' : 'amber'}`}><div className="metric-icon"><Building2 /></div><span>Emitente</span><strong>{companyReady ? 'Pronto' : 'Pendente'}</strong><small>CNPJ pode ser informado depois</small></article>
      <article className={`metric-card ${incompleteProducts.length ? 'amber' : 'green'}`}><div className="metric-icon"><Boxes /></div><span>Produtos pendentes</span><strong>{incompleteProducts.length}</strong><small>NCM / CFOP / tributação</small></article>
      <article className={`metric-card ${rules.length ? 'green' : 'amber'}`}><div className="metric-icon"><Wrench /></div><span>Regras de serviço</span><strong>{rules.length}</strong><small>Para NFS-e</small></article>
      <article className={`metric-card ${settings.environment === 'production' ? 'red' : ''}`}><div className="metric-icon"><Landmark /></div><span>Ambiente</span><strong>{settings.environment === 'production' ? 'Produção' : 'Homologação'}</strong><small>Focus NFe</small></article>
    </div>

    <section className="panel" style={{ marginBottom: 20 }}>
      <div className="panel-head"><div><span className="eyebrow">Emitente</span><h2>Cadastro fiscal da Prime Tech</h2></div><Building2 /></div>
      <form onSubmit={(event) => void saveCompany(event)} style={{ display: 'grid', gap: 14 }}>
        <div className="form-grid">
          <label><span>Razão social</span><input value={companyForm.legalName} onChange={(e) => setCompanyForm((v) => ({ ...v, legalName: e.target.value }))} /></label>
          <label><span>CNPJ / CPF</span><input value={companyForm.document} onChange={(e) => setCompanyForm((v) => ({ ...v, document: e.target.value }))} placeholder="Pode preencher depois" /></label>
          <label><span>Inscrição Estadual</span><input value={companyForm.stateRegistration} onChange={(e) => setCompanyForm((v) => ({ ...v, stateRegistration: e.target.value }))} /></label>
          <label><span>Inscrição Municipal</span><input value={companyForm.municipalRegistration} onChange={(e) => setCompanyForm((v) => ({ ...v, municipalRegistration: e.target.value }))} /></label>
          <label><span>Regime tributário</span><select value={companyForm.taxRegime ?? ''} onChange={(e) => setCompanyForm((v) => ({ ...v, taxRegime: e.target.value as CompanySettings['tax_regime'] }))}><option value="">Selecione</option><option value="simples_nacional">Simples Nacional</option><option value="simples_excesso">Simples — excesso sublimite</option><option value="regime_normal">Regime normal</option><option value="mei">MEI</option></select></label>
          <label><span>CEP</span><input value={companyForm.postalCode} onChange={(e) => setCompanyForm((v) => ({ ...v, postalCode: e.target.value }))} /></label>
          <label><span>Logradouro</span><input value={companyForm.street} onChange={(e) => setCompanyForm((v) => ({ ...v, street: e.target.value }))} /></label>
          <label><span>Número</span><input value={companyForm.number} onChange={(e) => setCompanyForm((v) => ({ ...v, number: e.target.value }))} /></label>
          <label><span>Complemento</span><input value={companyForm.complement} onChange={(e) => setCompanyForm((v) => ({ ...v, complement: e.target.value }))} /></label>
          <label><span>Bairro</span><input value={companyForm.district} onChange={(e) => setCompanyForm((v) => ({ ...v, district: e.target.value }))} /></label>
          <label><span>Município</span><input value={companyForm.city} onChange={(e) => setCompanyForm((v) => ({ ...v, city: e.target.value }))} /></label>
          <label><span>Código IBGE</span><input value={companyForm.cityCode} onChange={(e) => setCompanyForm((v) => ({ ...v, cityCode: e.target.value }))} /></label>
          <label><span>UF</span><input maxLength={2} value={companyForm.state} onChange={(e) => setCompanyForm((v) => ({ ...v, state: e.target.value.toUpperCase() }))} /></label>
        </div>
        {canManage && <button type="submit" disabled={saving}><Save size={16} /> Salvar emitente</button>}
      </form>
    </section>

    <section className="panel" style={{ marginBottom: 20 }}>
      <div className="panel-head"><div><span className="eyebrow">Gateway</span><h2>Emissor fiscal</h2></div><FileCog /></div>
      <form onSubmit={(event) => void saveSettings(event)} style={{ display: 'grid', gap: 14 }}>
        <div className="form-grid">
          <label><span>Provedor</span><input value="Focus NFe" disabled /></label>
          <label><span>Ambiente</span><select value={settings.environment} onChange={(e) => setSettings((v) => v ? ({ ...v, environment: e.target.value as FiscalSettingsRow['environment'] }) : v)}><option value="homologation">Homologação / testes</option><option value="production">Produção / valor fiscal</option></select></label>
          <label><span>NFS-e</span><select value={settings.nfse_mode} onChange={(e) => setSettings((v) => v ? ({ ...v, nfse_mode: e.target.value as FiscalSettingsRow['nfse_mode'] }) : v)}><option value="national">NFS-e Nacional</option><option value="municipal">NFS-e municipal</option></select></label>
          <label><span>Modo de emissão</span><select value={settings.issue_mode} onChange={(e) => setSettings((v) => v ? ({ ...v, issue_mode: e.target.value as FiscalSettingsRow['issue_mode'] }) : v)}><option value="review">Revisar antes</option><option value="manual">Manual</option><option value="after_completion">Após conclusão</option><option value="after_billing">Após faturamento</option></select></label>
          <label><span>Série NF-e</span><input value={settings.nfe_series ?? ''} onChange={(e) => setSettings((v) => v ? ({ ...v, nfe_series: e.target.value }) : v)} /></label>
          <label><span>Série NFC-e</span><input value={settings.nfce_series ?? ''} onChange={(e) => setSettings((v) => v ? ({ ...v, nfce_series: e.target.value }) : v)} /></label>
          <label><span>Série NFS-e</span><input value={settings.nfse_series ?? ''} onChange={(e) => setSettings((v) => v ? ({ ...v, nfse_series: e.target.value }) : v)} /></label>
          <label><span>Natureza padrão</span><input value={settings.default_nature_operation} onChange={(e) => setSettings((v) => v ? ({ ...v, default_nature_operation: e.target.value }) : v)} /></label>
        </div>
        <div className="quick-actions" style={{ flexWrap: 'wrap' }}>
          <label className="ghost-button"><input type="checkbox" checked={settings.nfe_enabled} onChange={(e) => setSettings((v) => v ? ({ ...v, nfe_enabled: e.target.checked }) : v)} /> NF-e</label>
          <label className="ghost-button"><input type="checkbox" checked={settings.nfce_enabled} onChange={(e) => setSettings((v) => v ? ({ ...v, nfce_enabled: e.target.checked }) : v)} /> NFC-e</label>
          <label className="ghost-button"><input type="checkbox" checked={settings.nfse_enabled} onChange={(e) => setSettings((v) => v ? ({ ...v, nfse_enabled: e.target.checked }) : v)} /> NFS-e</label>
          {settings.environment === 'production' && <label className="ghost-button"><input type="checkbox" checked={settings.production_confirmed} onChange={(e) => setSettings((v) => v ? ({ ...v, production_confirmed: e.target.checked }) : v)} /> Confirmo emissão real</label>}
        </div>
        {canManage && <button type="submit" disabled={saving}><Save size={16} /> Salvar emissor</button>}
      </form>
      <div className="notice" style={{ marginTop: 14 }}><FileCog size={18} /><div><strong>Credencial fora do navegador</strong><p>Os tokens do provedor serão configurados somente como secrets da função de backend.</p></div></div>
    </section>

    <section className="panel" style={{ marginBottom: 20 }}>
      <div className="panel-head"><div><span className="eyebrow">Mercadorias</span><h2>Classificação fiscal dos produtos</h2></div><PackageSearch /></div>
      <div className="table-wrap"><table><thead><tr><th>Produto</th><th>NCM</th><th>CFOP interno</th><th>CFOP interestadual</th><th>ICMS</th><th>PIS/COFINS</th><th>Situação</th><th>Ação</th></tr></thead><tbody>
        {stock.filter((item) => item.active !== false).map((item) => {
          const ready = Boolean(item.ncm && item.cfop_internal && item.cfop_interstate && item.icms_situation && item.pis_situation && item.cofins_situation);
          return <tr key={item.id}><td><strong>{item.name}</strong><small>{item.sku}</small></td><td>{item.ncm || '—'}</td><td>{item.cfop_internal || '—'}</td><td>{item.cfop_interstate || '—'}</td><td>{item.icms_situation || '—'}</td><td>{item.pis_situation || '—'} / {item.cofins_situation || '—'}</td><td><span className={`stock-state ${ready ? 'ok' : 'critical'}`}>{ready ? 'Pronto' : 'Pendente'}</span></td><td><button type="button" className="ghost-button" onClick={() => beginProduct(item)}>Configurar</button></td></tr>;
        })}
      </tbody></table></div>
    </section>

    {selectedProduct && <section className="panel" style={{ marginBottom: 20 }}>
      <div className="panel-head"><div><span className="eyebrow">Produto fiscal</span><h2>{selectedProduct.name}</h2></div><button type="button" className="ghost-button" onClick={() => setSelectedProduct(null)}>Fechar</button></div>
      <form onSubmit={(event) => void saveProduct(event)} style={{ display: 'grid', gap: 14 }}><div className="form-grid">
        <label><span>NCM</span><input value={productForm.ncm} onChange={(e) => setProductForm((v) => ({ ...v, ncm: e.target.value }))} /></label>
        <label><span>CEST</span><input value={productForm.cest} onChange={(e) => setProductForm((v) => ({ ...v, cest: e.target.value }))} /></label>
        <label><span>Unidade</span><input value={productForm.unit} onChange={(e) => setProductForm((v) => ({ ...v, unit: e.target.value }))} /></label>
        <label><span>Origem</span><input value={productForm.origin} onChange={(e) => setProductForm((v) => ({ ...v, origin: e.target.value }))} /></label>
        <label><span>CFOP dentro do estado</span><input value={productForm.cfopInternal} onChange={(e) => setProductForm((v) => ({ ...v, cfopInternal: e.target.value }))} /></label>
        <label><span>CFOP interestadual</span><input value={productForm.cfopInterstate} onChange={(e) => setProductForm((v) => ({ ...v, cfopInterstate: e.target.value }))} /></label>
        <label><span>CST/CSOSN ICMS</span><input value={productForm.icms} onChange={(e) => setProductForm((v) => ({ ...v, icms: e.target.value }))} /></label>
        <label><span>CST PIS</span><input value={productForm.pis} onChange={(e) => setProductForm((v) => ({ ...v, pis: e.target.value }))} /></label>
        <label><span>CST COFINS</span><input value={productForm.cofins} onChange={(e) => setProductForm((v) => ({ ...v, cofins: e.target.value }))} /></label>
        <label><span>CST IPI</span><input value={productForm.ipi} onChange={(e) => setProductForm((v) => ({ ...v, ipi: e.target.value }))} /></label>
        <label><span>IBS/CBS situação</span><input value={productForm.ibsCbsSituation} onChange={(e) => setProductForm((v) => ({ ...v, ibsCbsSituation: e.target.value }))} /></label>
        <label><span>IBS/CBS classificação</span><input value={productForm.ibsCbsClassification} onChange={(e) => setProductForm((v) => ({ ...v, ibsCbsClassification: e.target.value }))} /></label>
      </div>{canManage && <button type="submit" disabled={saving}><Save size={16} /> Salvar produto fiscal</button>}</form>
    </section>}

    <section className="panel">
      <div className="panel-head"><div><span className="eyebrow">Serviços</span><h2>Regras fiscais para NFS-e</h2></div><Wrench /></div>
      {canManage && <form onSubmit={(event) => void addServiceRule(event)} style={{ display: 'grid', gap: 14, marginBottom: 18 }}><div className="form-grid">
        <label><span>Nome da regra</span><input value={serviceForm.name} onChange={(e) => setServiceForm((v) => ({ ...v, name: e.target.value }))} placeholder="Ex.: Limpeza de cabeçote" /></label>
        <label><span>Código tributação nacional ISS</span><input value={serviceForm.nationalTaxCode} onChange={(e) => setServiceForm((v) => ({ ...v, nationalTaxCode: e.target.value }))} /></label>
        <label><span>Código municipal</span><input value={serviceForm.municipalServiceCode} onChange={(e) => setServiceForm((v) => ({ ...v, municipalServiceCode: e.target.value }))} /></label>
        <label><span>Item LC 116</span><input value={serviceForm.lc116} onChange={(e) => setServiceForm((v) => ({ ...v, lc116: e.target.value }))} /></label>
        <label><span>CNAE</span><input value={serviceForm.cnae} onChange={(e) => setServiceForm((v) => ({ ...v, cnae: e.target.value }))} /></label>
        <label><span>ISS (%)</span><input type="number" min="0" max="100" step="0.01" value={serviceForm.issRate} onChange={(e) => setServiceForm((v) => ({ ...v, issRate: e.target.value }))} /></label>
        <label><span>Tributação ISS</span><input value={serviceForm.issTaxation} onChange={(e) => setServiceForm((v) => ({ ...v, issTaxation: e.target.value }))} /></label>
        <label><span>IBS/CBS situação</span><input value={serviceForm.ibsCbsSituation} onChange={(e) => setServiceForm((v) => ({ ...v, ibsCbsSituation: e.target.value }))} /></label>
        <label><span>IBS/CBS classificação</span><input value={serviceForm.ibsCbsClassification} onChange={(e) => setServiceForm((v) => ({ ...v, ibsCbsClassification: e.target.value }))} /></label>
      </div><button type="submit" disabled={saving}><PlusCircle size={16} /> Adicionar regra</button></form>}
      {rules.length === 0 ? <div className="empty-state"><Wrench size={38} /><h3>Nenhuma regra cadastrada</h3><p>Cadastre os serviços usados pela Prime Tech.</p></div> : <div className="table-wrap"><table><thead><tr><th>Regra</th><th>Cód. nacional</th><th>Cód. municipal</th><th>LC 116</th><th>CNAE</th><th>ISS</th></tr></thead><tbody>{rules.map((rule) => <tr key={rule.id}><td><strong>{rule.name}</strong></td><td>{rule.national_tax_code || '—'}</td><td>{rule.municipal_service_code || '—'}</td><td>{rule.lc116_code || '—'}</td><td>{rule.cnae || '—'}</td><td>{rule.iss_rate == null ? '—' : `${rule.iss_rate}%`}</td></tr>)}</tbody></table></div>}
    </section>
  </>;
}
