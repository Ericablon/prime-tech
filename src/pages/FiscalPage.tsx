import {
  AlertCircle,
  Building2,
  CheckCircle2,
  FileClock,
  FilePlus2,
  FileSearch,
  FileText,
  RefreshCw,
  Settings2,
  ShieldAlert,
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
import type { Client, ServiceOrder } from '../types/domain';

type FiscalCheck = {
  ready: boolean;
  issues: string[];
};

type FiscalDocument = {
  id: string;
  service_order_id?: string | null;
  document_type: 'nfse' | 'nfe' | 'nfce';
  status: 'draft' | 'processing' | 'authorized' | 'cancelled' | 'error';
  environment?: string | null;
  provider?: string | null;
  provider_reference?: string | null;
  protocol?: string | null;
  access_key?: string | null;
  number?: string | null;
  total_amount?: number | null;
  error_message?: string | null;
  issued_at?: string | null;
  created_at: string;
};

const documentLabels: Record<FiscalDocument['document_type'], string> = {
  nfse: 'NFS-e',
  nfe: 'NF-e',
  nfce: 'NFC-e',
};

const fiscalStatusLabels: Record<FiscalDocument['status'], string> = {
  draft: 'Rascunho',
  processing: 'Processando',
  authorized: 'Autorizada',
  cancelled: 'Cancelada',
  error: 'Erro',
};

function orderTotal(order: ServiceOrder) {
  return Number(order.total_amount ?? order.quote_total ?? 0);
}

function validateOrder(
  order: ServiceOrder,
  client: Client | undefined,
  companyDocument?: string | null,
): FiscalCheck {
  const issues: string[] = [];

  if (!companyDocument?.trim()) issues.push('CNPJ/CPF da empresa não configurado');
  if (!client?.document?.trim()) issues.push('CPF/CNPJ do cliente ausente');
  if (orderTotal(order) <= 0) issues.push('OS sem valor faturável');
  if (!(order.items ?? []).length) issues.push('OS sem itens discriminados');

  return { ready: issues.length === 0, issues };
}

export function FiscalPage() {
  const { user, mode } = useAuth();
  const {
    orders,
    clients,
    company,
    companyId,
    loading,
    error,
  } = usePrimeTech();

  const [documents, setDocuments] = useState<FiscalDocument[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState('');
  const [success, setSuccess] = useState('');

  const canIssue = can(user, 'fiscal.issue');

  const loadDocuments = useCallback(async () => {
    if (mode !== 'supabase' || !supabase || !companyId) {
      setDocuments([]);
      return;
    }

    setDocumentsLoading(true);
    try {
      const { data, error: fiscalError } = await supabase
        .from('fiscal_documents')
        .select('id, service_order_id, document_type, status, environment, provider, provider_reference, protocol, access_key, number, total_amount, error_message, issued_at, created_at')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });
      if (fiscalError) throw fiscalError;
      setDocuments((data ?? []) as FiscalDocument[]);
    } catch (cause) {
      setLocalError(
        cause instanceof Error
          ? cause.message
          : 'Não foi possível carregar os documentos fiscais.',
      );
    } finally {
      setDocumentsLoading(false);
    }
  }, [companyId, mode]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  const candidates = useMemo(
    () => orders.filter((order) => ['ready_for_pickup', 'delivered'].includes(order.status)),
    [orders],
  );

  const rows = useMemo(
    () => candidates.map((order) => {
      const client = clients.find((item) => item.id === order.client_id);
      return {
        order,
        client,
        check: validateOrder(order, client, company.document),
        documents: documents.filter((document) => document.service_order_id === order.id),
      };
    }),
    [candidates, clients, company.document, documents],
  );

  const ready = rows.filter((row) => row.check.ready);
  const withIssues = rows.filter((row) => !row.check.ready);
  const eligibleAmount = ready.reduce((sum, row) => sum + orderTotal(row.order), 0);
  const authorized = documents.filter((document) => document.status === 'authorized');
  const pendingDocuments = documents.filter((document) => ['draft', 'processing'].includes(document.status));
  const companyReady = Boolean(company.document?.trim());

  async function createDraft(order: ServiceOrder, documentType: 'nfse' | 'nfe') {
    if (!canIssue) {
      setLocalError('Seu perfil não possui permissão para preparar documentos fiscais.');
      return;
    }
    if (mode !== 'supabase' || !supabase || !companyId || !user) {
      setLocalError('A preparação fiscal exige o ambiente conectado ao Supabase.');
      return;
    }

    const client = clients.find((item) => item.id === order.client_id);
    const check = validateOrder(order, client, company.document);
    if (!check.ready) {
      setLocalError(check.issues.join(' · '));
      return;
    }

    const duplicate = documents.find((document) =>
      document.service_order_id === order.id
      && document.document_type === documentType
      && ['draft', 'processing', 'authorized'].includes(document.status));
    if (duplicate) {
      setLocalError(`${documentLabels[documentType]} já possui documento ${fiscalStatusLabels[duplicate.status].toLowerCase()} para esta OS.`);
      return;
    }

    setSaving(true);
    setLocalError('');
    setSuccess('');
    try {
      const { error: insertError } = await supabase
        .from('fiscal_documents')
        .insert({
          company_id: companyId,
          service_order_id: order.id,
          document_type: documentType,
          status: 'draft',
          environment: 'homologation',
          total_amount: orderTotal(order),
          idempotency_key: crypto.randomUUID(),
          created_by: user.id,
        });
      if (insertError) throw insertError;

      setSuccess(`${documentLabels[documentType]} preparada como rascunho. A emissão só ocorrerá quando um gateway fiscal real estiver configurado.`);
      await loadDocuments();
    } catch (cause) {
      setLocalError(
        cause instanceof Error
          ? cause.message
          : 'Não foi possível preparar o documento fiscal.',
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="empty-state">
        <RefreshCw size={38} />
        <h3>Carregando Fiscal</h3>
        <p>Validando OS, clientes e dados da empresa.</p>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Fiscal"
        title="Fiscal e notas"
        description="Fila fiscal originada das Ordens de Serviço, preparação de NF-e/NFS-e e validação antes da integração de emissão."
        actions={<span className="ghost-button"><Settings2 /> Gateway real não configurado</span>}
      />

      {(error || localError || success) && (
        <section className="notice" style={{ marginBottom: 16 }}>
          {error || localError ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
          <div>
            <strong>{error || localError ? 'Atenção fiscal' : 'Documento preparado'}</strong>
            <p>{error || localError || success}</p>
          </div>
        </section>
      )}

      <div className="metrics-grid">
        <MetricCard label="OS para revisão" value={candidates.length} icon={FileClock} />
        <MetricCard label="Cadastro fiscal válido" value={ready.length} icon={CheckCircle2} tone="green" />
        <MetricCard label="Documentos preparados" value={pendingDocuments.length} icon={FilePlus2} tone="violet" />
        <MetricCard label="Valor elegível" value={money.format(eligibleAmount)} helper={`${authorized.length} autorizada(s) registradas`} icon={FileText} tone="violet" />
      </div>

      <section className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-head">
          <div><span className="eyebrow">Configuração fiscal</span><h2>Prontidão da empresa</h2></div>
          <span className={`stock-state ${companyReady ? 'ok' : 'critical'}`}>
            {companyReady ? 'Cadastro básico informado' : 'Cadastro incompleto'}
          </span>
        </div>

        <div className="fiscal-flow">
          <div className={`fiscal-step ${companyReady ? 'active' : ''}`}>
            <span>1</span><div><strong>Dados da empresa</strong><small>{company.document ? `Documento: ${company.document}` : 'Informe o documento da empresa em Administração.'}</small></div>
          </div>
          <div className="fiscal-step active">
            <span>2</span><div><strong>Validação da OS</strong><small>Cliente, itens e total são conferidos antes da preparação.</small></div>
          </div>
          <div className="fiscal-step active">
            <span>3</span><div><strong>Rascunho NF</strong><small>O Cronos registra o documento e mantém idempotência por empresa.</small></div>
          </div>
          <div className="fiscal-step">
            <span>4</span><div><strong>Gateway e protocolo</strong><small>XML/PDF, autorização e cancelamento dependem do provedor fiscal real.</small></div>
          </div>
        </div>

        <div className="notice">
          <ShieldAlert />
          <div>
            <strong>Emissão real permanece bloqueada por segurança.</strong>
            <p>O sistema já prepara e rastreia documentos, mas não simula autorização fiscal. Certificado, credenciais e integração do provedor ficarão somente no backend.</p>
          </div>
        </div>
      </section>

      <section className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-head">
          <div><span className="eyebrow">Fila fiscal</span><h2>OS prontas para faturamento/revisão</h2></div>
          <span className="ghost-button">{withIssues.length} pendência(s)</span>
        </div>

        {rows.length === 0 ? (
          <div className="empty-state">
            <FileSearch size={38} />
            <h3>Nenhuma OS pronta para revisão fiscal</h3>
            <p>As OS aparecerão aqui quando chegarem a “pronta para retirada” ou “entregue”.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>OS</th><th>Cliente</th><th>Status</th><th>Total</th><th>Validação</th><th>Documento</th><th>Ação</th></tr>
              </thead>
              <tbody>
                {rows.map(({ order, client, check, documents: orderDocuments }) => (
                  <tr key={order.id}>
                    <td><strong>{orderCode(order.order_number)}</strong><small>{order.equipment ?? 'Equipamento não identificado'}</small></td>
                    <td><strong>{order.client_name ?? client?.name ?? 'Cliente não identificado'}</strong><small>{client?.document || 'Documento não informado'}</small></td>
                    <td><StatusBadge status={order.status} /></td>
                    <td><strong>{money.format(orderTotal(order))}</strong></td>
                    <td>
                      {check.ready
                        ? <span className="stock-state ok"><CheckCircle2 size={14} /> Pronta</span>
                        : <div><span className="stock-state critical"><AlertCircle size={14} /> Revisar</span><small style={{ display: 'block', marginTop: 4 }}>{check.issues.join(' · ')}</small></div>}
                    </td>
                    <td>
                      {orderDocuments.length
                        ? orderDocuments.map((document) => (
                          <div key={document.id} style={{ marginBottom: 4 }}>
                            <strong>{documentLabels[document.document_type]}</strong>
                            <small>{fiscalStatusLabels[document.status]} · {document.environment ?? 'homologation'}</small>
                          </div>
                        ))
                        : <span className="muted">Não preparado</span>}
                    </td>
                    <td>
                      <div className="quick-actions">
                        <Link to={`/ordens/${order.id}`} className="ghost-button"><FileSearch size={15} /> Revisar OS</Link>
                        {canIssue && check.ready && (
                          <>
                            <button type="button" disabled={saving} onClick={() => void createDraft(order, 'nfse')}>
                              <FilePlus2 size={15} /> NFS-e
                            </button>
                            <button type="button" disabled={saving} onClick={() => void createDraft(order, 'nfe')}>
                              <FilePlus2 size={15} /> NF-e
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-head">
          <div><span className="eyebrow">Documentos</span><h2>Histórico fiscal preparado</h2></div>
          {documentsLoading && <span className="muted"><RefreshCw size={14} /> Atualizando</span>}
        </div>

        {documents.length === 0 ? (
          <div className="empty-state">
            <FileText size={38} />
            <h3>Nenhum documento fiscal registrado</h3>
            <p>Prepare uma NF-e ou NFS-e a partir de uma OS validada.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Tipo</th><th>OS</th><th>Status</th><th>Ambiente</th><th>Número / protocolo</th><th>Valor</th><th>Observação</th></tr></thead>
              <tbody>
                {documents.map((document) => {
                  const order = orders.find((item) => item.id === document.service_order_id);
                  return (
                    <tr key={document.id}>
                      <td><strong>{documentLabels[document.document_type]}</strong></td>
                      <td>{order ? orderCode(order.order_number) : '—'}</td>
                      <td>{fiscalStatusLabels[document.status]}</td>
                      <td>{document.environment ?? 'homologation'}</td>
                      <td><strong>{document.number || '—'}</strong><small>{document.protocol || document.provider_reference || 'Sem protocolo'}</small></td>
                      <td>{money.format(Number(document.total_amount ?? 0))}</td>
                      <td>{document.status === 'draft' ? 'Aguardando configuração do gateway' : document.error_message || document.provider || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="notice" style={{ marginTop: 20 }}>
        <Building2 />
        <div>
          <strong>Para emissão em produção</strong>
          <p>Precisamos escolher o provedor/API fiscal, configurar ambiente, certificado quando aplicável, credenciais segregadas por empresa, webhooks e armazenamento de XML/PDF/protocolos.</p>
        </div>
      </section>
    </>
  );
}
