import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileClock,
  FilePlus2,
  FileSearch,
  FileText,
  RefreshCw,
  RotateCw,
  Send,
  Settings2,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { MetricCard } from '../components/ui/MetricCard';
import { PageHeader } from '../components/ui/PageHeader';
import { StatusBadge } from '../components/ui/StatusBadge';
import { useAuth } from '../contexts/AuthContext';
import { usePrimeTech } from '../contexts/PrimeTechContext';
import { money, orderCode } from '../lib/formatters';
import { can } from '../lib/permissions';
import { supabase } from '../lib/supabase';
import type { ServiceOrder } from '../types/domain';

type DocumentType = 'nfse' | 'nfe' | 'nfce';
type FiscalStatus = 'draft' | 'processing' | 'authorized' | 'cancelled' | 'error';

type FiscalDocument = {
  id: string;
  service_order_id?: string | null;
  document_type: DocumentType;
  status: FiscalStatus;
  environment?: string | null;
  provider?: string | null;
  provider_reference?: string | null;
  reference?: string | null;
  provider_status?: string | null;
  protocol?: string | null;
  access_key?: string | null;
  number?: string | null;
  series?: string | null;
  total_amount?: number | null;
  error_message?: string | null;
  issued_at?: string | null;
  xml_url?: string | null;
  pdf_url?: string | null;
  xml_path?: string | null;
  pdf_path?: string | null;
  last_synced_at?: string | null;
  cancelled_at?: string | null;
  created_at: string;
};

type FiscalSettings = {
  environment?: 'homologation' | 'production';
  gateway_provider?: string | null;
  nfe_enabled?: boolean;
  nfce_enabled?: boolean;
  nfse_enabled?: boolean;
  nfse_mode?: 'national' | 'municipal';
  production_confirmed?: boolean;
};

const documentLabels: Record<DocumentType, string> = { nfse: 'NFS-e', nfe: 'NF-e', nfce: 'NFC-e' };
const statusLabels: Record<FiscalStatus, string> = {
  draft: 'Rascunho', processing: 'Processando', authorized: 'Autorizada', cancelled: 'Cancelada', error: 'Erro',
};

function totals(order: ServiceOrder) {
  const services = (order.items ?? []).filter((item) => item.kind === 'service').reduce((sum, item) => sum + Number(item.quantity) * Number(item.unit_price), 0);
  const products = (order.items ?? []).filter((item) => item.kind === 'part').reduce((sum, item) => sum + Number(item.quantity) * Number(item.unit_price), 0);
  return { services, products, total: services + products };
}

export function FiscalPage() {
  const { user, mode } = useAuth();
  const { orders, clients, company, companyId, loading, error } = usePrimeTech();

  const [documents, setDocuments] = useState<FiscalDocument[]>([]);
  const [settings, setSettings] = useState<FiscalSettings | null>(null);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [localError, setLocalError] = useState('');
  const [success, setSuccess] = useState('');
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const canIssue = can(user, 'fiscal.issue');
  const canCancel = can(user, 'fiscal.cancel');
  const canSettings = can(user, 'fiscal.settings');

  const loadFiscal = useCallback(async () => {
    const client = supabase;
    const activeCompanyId = companyId;
    if (mode !== 'supabase' || !client || !activeCompanyId) {
      setDocuments([]);
      setSettings(null);
      return;
    }

    setDocumentsLoading(true);
    try {
      const [documentsResult, settingsResult] = await Promise.all([
        client.from('fiscal_documents').select('*').eq('company_id', activeCompanyId).order('created_at', { ascending: false }),
        client.from('fiscal_settings').select('*').eq('company_id', activeCompanyId).maybeSingle(),
      ]);
      if (documentsResult.error) throw documentsResult.error;
      if (settingsResult.error) throw settingsResult.error;
      setDocuments((documentsResult.data ?? []) as FiscalDocument[]);
      setSettings((settingsResult.data as FiscalSettings | null) ?? null);
    } catch (cause) {
      setLocalError(cause instanceof Error ? cause.message : 'Não foi possível carregar o módulo fiscal.');
    } finally {
      setDocumentsLoading(false);
    }
  }, [companyId, mode]);

  useEffect(() => { void loadFiscal(); }, [loadFiscal]);

  const candidates = useMemo(
    () => orders.filter((order) => ['ready_for_pickup', 'delivered'].includes(order.status)),
    [orders],
  );

  const rows = useMemo(() => candidates.map((order) => ({
    order,
    client: clients.find((client) => client.id === order.client_id),
    totals: totals(order),
    documents: documents.filter((document) => document.service_order_id === order.id),
  })), [candidates, clients, documents]);

  const authorized = documents.filter((document) => document.status === 'authorized');
  const pending = documents.filter((document) => ['draft', 'processing'].includes(document.status));
  const errors = documents.filter((document) => document.status === 'error');
  const eligibleAmount = rows.reduce((sum, row) => sum + row.totals.total, 0);

  async function prepare(order: ServiceOrder, documentType: DocumentType) {
    const client = supabase;
    if (!canIssue || mode !== 'supabase' || !client) return setLocalError('Seu perfil não pode preparar documentos fiscais.');

    setBusyId(order.id); setLocalError(''); setSuccess('');
    try {
      const { data, error: rpcError } = await client.rpc('prepare_fiscal_document', {
        p_order_id: order.id,
        p_document_type: documentType,
      });
      if (rpcError) throw rpcError;
      const prepared = data as FiscalDocument | null;
      setSuccess(`${documentLabels[documentType]} preparada. Revise e clique em Emitir quando estiver pronta.`);
      await loadFiscal();
      if (prepared?.id) setBusyId(null);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Não foi possível preparar o documento.';
      setLocalError(message.includes('prepare_fiscal_document') ? 'A migration fiscal 0011 ainda precisa ser aplicada no Supabase.' : message);
    } finally { setBusyId(null); }
  }

  async function gateway(document: FiscalDocument, action: 'issue' | 'status' | 'cancel', reason?: string) {
    const client = supabase;
    if (mode !== 'supabase' || !client) return;
    if (action === 'issue' && !canIssue) return setLocalError('Seu perfil não pode emitir notas.');
    if (action === 'cancel' && !canCancel) return setLocalError('Seu perfil não pode cancelar notas.');
    if (action === 'issue' && document.environment === 'production') {
      const confirmed = window.confirm('Esta emissão está em PRODUÇÃO e terá valor fiscal. Deseja realmente transmitir a nota?');
      if (!confirmed) return;
    }

    setBusyId(document.id); setLocalError(''); setSuccess('');
    try {
      const { data, error: invokeError } = await client.functions.invoke('fiscal-gateway', {
        body: { action, documentId: document.id, reason },
      });
      if (invokeError) throw invokeError;
      const result = data as { error?: string; status?: string; number?: string } | null;
      if (result?.error) throw new Error(result.error);
      setSuccess(
        action === 'issue' ? `Transmissão enviada. Status: ${result?.status ?? 'processando'}.`
          : action === 'status' ? `Situação consultada: ${result?.status ?? 'atualizada'}.`
            : 'Cancelamento solicitado ao provedor fiscal.',
      );
      setCancelId(null); setCancelReason('');
      await loadFiscal();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Falha na integração fiscal.';
      setLocalError(message.includes('Function not found') || message.includes('FunctionsHttpError')
        ? 'A Edge Function fiscal-gateway ainda precisa ser publicada no Supabase e receber o token do provedor.'
        : message);
    } finally { setBusyId(null); }
  }

  if (loading) return <div className="empty-state"><RefreshCw size={38} /><h3>Carregando Fiscal</h3></div>;

  const environment = settings?.environment ?? 'homologation';
  const gatewayReady = settings?.gateway_provider === 'focus_nfe';

  return <>
    <PageHeader
      eyebrow="Fiscal"
      title="Fiscal e notas"
      description="Da OS para NF-e, NFC-e e NFS-e: preparação, transmissão, consulta, XML/PDF e cancelamento."
      actions={canSettings ? <Link to="/fiscal/configuracao" className="ghost-button"><Settings2 size={16} /> Configuração fiscal</Link> : undefined}
    />

    {(error || localError || success) && <section className="notice" style={{ marginBottom: 16 }}>
      {error || localError ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
      <div><strong>{error || localError ? 'Atenção fiscal' : 'Fiscal atualizado'}</strong><p>{error || localError || success}</p></div>
    </section>}

    <div className="metrics-grid">
      <MetricCard label="OS para faturar" value={candidates.length} icon={FileClock} />
      <MetricCard label="Em processamento" value={pending.length} icon={RefreshCw} tone="violet" />
      <MetricCard label="Autorizadas" value={authorized.length} icon={CheckCircle2} tone="green" />
      <MetricCard label="Valor das OS" value={money.format(eligibleAmount)} helper={`${errors.length} documento(s) com erro`} icon={FileText} tone="violet" />
    </div>

    <section className="panel" style={{ marginBottom: 20 }}>
      <div className="panel-head"><div><span className="eyebrow">Ambiente fiscal</span><h2>{environment === 'production' ? 'Produção' : 'Homologação / testes'}</h2></div><span className={`stock-state ${gatewayReady ? 'ok' : 'critical'}`}>{gatewayReady ? 'Focus NFe configurado no sistema' : 'Configuração pendente'}</span></div>
      <div className="fiscal-flow">
        <div className="fiscal-step active"><span>1</span><div><strong>Cadastros</strong><small>Emitente, cliente, NCM/CFOP e serviços.</small></div></div>
        <div className="fiscal-step active"><span>2</span><div><strong>Preparação</strong><small>O banco valida e congela os itens da nota.</small></div></div>
        <div className={`fiscal-step ${gatewayReady ? 'active' : ''}`}><span>3</span><div><strong>Transmissão</strong><small>Edge Function envia ao provedor sem expor o token.</small></div></div>
        <div className="fiscal-step active"><span>4</span><div><strong>Retorno</strong><small>Número, chave, protocolo, XML/PDF e cancelamento.</small></div></div>
      </div>
      {environment !== 'production' && <div className="notice"><ShieldAlert size={19} /><div><strong>Ambiente seguro de homologação</strong><p>Use este ambiente para validar os cadastros e o fluxo antes de habilitar notas com valor fiscal.</p></div></div>}
    </section>

    <section className="panel" style={{ marginBottom: 20 }}>
      <div className="panel-head"><div><span className="eyebrow">Fila fiscal</span><h2>OS prontas para faturamento</h2></div><span className="ghost-button">{rows.length} OS</span></div>
      {rows.length === 0 ? <div className="empty-state"><FileSearch size={38} /><h3>Nenhuma OS pronta para faturamento</h3><p>As OS aparecem aqui em “pronta para retirada” ou “entregue”.</p></div> : <div className="table-wrap"><table>
        <thead><tr><th>OS</th><th>Cliente</th><th>Composição</th><th>Total</th><th>Documentos</th><th>Ações</th></tr></thead>
        <tbody>{rows.map(({ order, client, totals: orderTotals, documents: orderDocuments }) => <tr key={order.id}>
          <td><strong>{orderCode(order.order_number)}</strong><small>{order.equipment ?? 'Equipamento'}</small></td>
          <td><strong>{order.client_name ?? client?.name ?? 'Cliente'}</strong><small>{client?.document || 'CPF/CNPJ pendente'}</small></td>
          <td><small>Serviços: {money.format(orderTotals.services)}</small><small>Produtos: {money.format(orderTotals.products)}</small></td>
          <td><strong>{money.format(orderTotals.total)}</strong></td>
          <td>{orderDocuments.length ? orderDocuments.map((document) => <div key={document.id} style={{ marginBottom: 5 }}><strong>{documentLabels[document.document_type]}</strong><small>{statusLabels[document.status]} · {document.environment ?? 'homologation'}</small></div>) : <span className="muted">Nenhum</span>}</td>
          <td><div className="quick-actions" style={{ flexWrap: 'wrap' }}>
            <Link to={`/ordens/${order.id}`} className="ghost-button"><FileSearch size={15} /> OS</Link>
            {canIssue && orderTotals.services > 0 && !orderDocuments.some((doc) => doc.document_type === 'nfse' && ['draft','processing','authorized'].includes(doc.status)) && <button type="button" disabled={busyId === order.id} onClick={() => void prepare(order, 'nfse')}><FilePlus2 size={15} /> Preparar NFS-e</button>}
            {canIssue && orderTotals.products > 0 && settings?.nfe_enabled !== false && !orderDocuments.some((doc) => doc.document_type === 'nfe' && ['draft','processing','authorized'].includes(doc.status)) && <button type="button" disabled={busyId === order.id} onClick={() => void prepare(order, 'nfe')}><FilePlus2 size={15} /> Preparar NF-e</button>}
            {canIssue && orderTotals.products > 0 && settings?.nfce_enabled === true && !orderDocuments.some((doc) => doc.document_type === 'nfce' && ['draft','processing','authorized'].includes(doc.status)) && <button type="button" disabled={busyId === order.id} onClick={() => void prepare(order, 'nfce')}><FilePlus2 size={15} /> Preparar NFC-e</button>}
          </div></td>
        </tr>)}</tbody>
      </table></div>}
    </section>

    {cancelId && <section className="panel" style={{ marginBottom: 20 }}>
      <div className="panel-head"><div><span className="eyebrow">Cancelamento fiscal</span><h2>Justificativa</h2></div><button type="button" className="ghost-button" onClick={() => { setCancelId(null); setCancelReason(''); }}>Fechar</button></div>
      <textarea rows={3} value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} placeholder="Informe o motivo do cancelamento (mínimo 15 caracteres)." style={{ width: '100%' }} />
      <div className="quick-actions" style={{ marginTop: 10 }}><button type="button" disabled={cancelReason.trim().length < 15 || busyId === cancelId} onClick={() => { const doc = documents.find((item) => item.id === cancelId); if (doc) void gateway(doc, 'cancel', cancelReason.trim()); }}><XCircle size={16} /> Confirmar cancelamento</button></div>
    </section>}

    <section className="panel">
      <div className="panel-head"><div><span className="eyebrow">Documentos fiscais</span><h2>Emissões e histórico</h2></div>{documentsLoading && <span className="muted"><RefreshCw size={14} /> Atualizando</span>}</div>
      {documents.length === 0 ? <div className="empty-state"><FileText size={38} /><h3>Nenhum documento preparado</h3><p>Prepare a nota a partir da fila fiscal acima.</p></div> : <div className="table-wrap"><table>
        <thead><tr><th>Documento</th><th>OS</th><th>Status</th><th>Número / chave</th><th>Valor</th><th>Arquivos</th><th>Ações</th></tr></thead>
        <tbody>{documents.map((document) => {
          const order = orders.find((item) => item.id === document.service_order_id);
          const pdf = document.pdf_url ?? document.pdf_path;
          const xml = document.xml_url ?? document.xml_path;
          return <tr key={document.id}>
            <td><strong>{documentLabels[document.document_type]}</strong><small>{document.environment ?? 'homologation'} · {document.provider ?? 'focus_nfe'}</small></td>
            <td>{order ? orderCode(order.order_number) : '—'}</td>
            <td><span className={`stock-state ${document.status === 'authorized' ? 'ok' : document.status === 'error' ? 'critical' : ''}`}>{statusLabels[document.status]}</span><small>{document.provider_status || document.error_message || ''}</small></td>
            <td><strong>{document.number || '—'}{document.series ? ` / ${document.series}` : ''}</strong><small>{document.access_key || document.protocol || document.reference || document.provider_reference || 'Sem retorno'}</small></td>
            <td>{money.format(Number(document.total_amount ?? 0))}</td>
            <td><div className="quick-actions">{pdf && <a className="ghost-button" href={pdf} target="_blank" rel="noreferrer"><Download size={15} /> PDF</a>}{xml && <a className="ghost-button" href={xml} target="_blank" rel="noreferrer"><Download size={15} /> XML</a>}</div></td>
            <td><div className="quick-actions" style={{ flexWrap: 'wrap' }}>
              {document.status === 'draft' && canIssue && <button type="button" disabled={busyId === document.id} onClick={() => void gateway(document, 'issue')}><Send size={15} /> Emitir</button>}
              {['processing','error','authorized'].includes(document.status) && <button type="button" className="ghost-button" disabled={busyId === document.id} onClick={() => void gateway(document, 'status')}><RotateCw size={15} /> Consultar</button>}
              {document.status === 'authorized' && canCancel && <button type="button" className="ghost-button" disabled={busyId === document.id} onClick={() => { setCancelId(document.id); setCancelReason(''); }}><XCircle size={15} /> Cancelar</button>}
            </div></td>
          </tr>;
        })}</tbody>
      </table></div>}
    </section>
  </>;
}
