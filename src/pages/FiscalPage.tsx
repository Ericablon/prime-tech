import {
  AlertCircle,
  Building2,
  CheckCircle2,
  FileClock,
  FileSearch,
  FileText,
  RefreshCw,
  Settings2,
  ShieldAlert,
} from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';

import { MetricCard } from '../components/ui/MetricCard';
import { PageHeader } from '../components/ui/PageHeader';
import { StatusBadge } from '../components/ui/StatusBadge';
import { usePrimeTech } from '../contexts/PrimeTechContext';
import { money, orderCode } from '../lib/formatters';
import type { Client, ServiceOrder } from '../types/domain';

type FiscalCheck = {
  ready: boolean;
  issues: string[];
};

function orderTotal(order: ServiceOrder) {
  return Number(order.total_amount ?? order.quote_total ?? 0);
}

function validateOrder(order: ServiceOrder, client: Client | undefined, companyDocument?: string | null): FiscalCheck {
  const issues: string[] = [];

  if (!companyDocument?.trim()) issues.push('CNPJ/CPF da empresa não configurado');
  if (!client?.document?.trim()) issues.push('CPF/CNPJ do cliente ausente');
  if (orderTotal(order) <= 0) issues.push('OS sem valor faturável');
  if (!(order.items ?? []).length) issues.push('OS sem itens discriminados');

  return { ready: issues.length === 0, issues };
}

export function FiscalPage() {
  const {
    orders,
    clients,
    company,
    loading,
    error,
  } = usePrimeTech();

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
      };
    }),
    [candidates, clients, company.document],
  );

  const ready = rows.filter((row) => row.check.ready);
  const withIssues = rows.filter((row) => !row.check.ready);
  const eligibleAmount = ready.reduce((sum, row) => sum + orderTotal(row.order), 0);
  const companyReady = Boolean(company.document?.trim());

  if (loading) {
    return <div className="empty-state"><RefreshCw size={38}/><h3>Carregando Fiscal</h3><p>Validando OS, clientes e dados da empresa.</p></div>;
  }

  return <>
    <PageHeader
      eyebrow="Fiscal"
      title="Motor Fiscal Cronos"
      description="Fila fiscal originada das Ordens de Serviço, com validação antes de qualquer integração de emissão."
      actions={<span className="ghost-button"><Settings2/> Gateway não configurado</span>}
    />

    {error && <section className="notice" style={{ marginBottom: 16 }}>
      <AlertCircle size={20}/><div><strong>Falha ao carregar dados fiscais</strong><p>{error}</p></div>
    </section>}

    <div className="metrics-grid">
      <MetricCard label="Prontas para revisão" value={candidates.length} icon={FileClock}/>
      <MetricCard label="Cadastro fiscal válido" value={ready.length} icon={CheckCircle2} tone="green"/>
      <MetricCard label="Com pendências" value={withIssues.length} icon={AlertCircle} tone="red"/>
      <MetricCard label="Valor elegível" value={money.format(eligibleAmount)} icon={FileText} tone="violet"/>
    </div>

    <section className="panel" style={{ marginBottom: 20 }}>
      <div className="panel-head">
        <div><span className="eyebrow">Configuração fiscal</span><h2>Prontidão da empresa</h2></div>
        <span className={`stock-state ${companyReady ? 'ok' : 'critical'}`}>{companyReady ? 'Cadastro básico informado' : 'Cadastro incompleto'}</span>
      </div>

      <div className="fiscal-flow">
        <div className={`fiscal-step ${companyReady ? 'active' : ''}`}><span>1</span><div><strong>Dados da empresa</strong><small>{company.document ? `Documento: ${company.document}` : 'Informe o documento da empresa em Administração.'}</small></div></div>
        <div className="fiscal-step active"><span>2</span><div><strong>Validação da OS</strong><small>Cliente, itens e total são conferidos antes da emissão.</small></div></div>
        <div className="fiscal-step"><span>3</span><div><strong>Gateway fiscal</strong><small>Adaptador existente, porém nenhum provedor real está configurado.</small></div></div>
        <div className="fiscal-step"><span>4</span><div><strong>XML/PDF e protocolo</strong><small>Será habilitado quando o provedor fiscal e as credenciais por empresa forem definidos.</small></div></div>
      </div>

      <div className="notice">
        <ShieldAlert/>
        <div>
          <strong>Emissão real permanece bloqueada por segurança.</strong>
          <p>As migrations 0001–0004 não adicionam um provedor fiscal operacional. O Cronos pode preparar e validar a fila, mas não deve gerar uma NF-e/NFS-e fictícia.</p>
        </div>
      </div>
    </section>

    <section className="panel">
      <div className="panel-head"><div><span className="eyebrow">Fila fiscal</span><h2>OS prontas para faturamento/revisão</h2></div></div>

      {rows.length === 0 ? <div className="empty-state"><FileSearch size={38}/><h3>Nenhuma OS pronta para revisão fiscal</h3><p>As OS aparecerão aqui quando chegarem a “pronta para retirada” ou “entregue”.</p></div> : <div className="table-wrap"><table>
        <thead><tr><th>OS</th><th>Cliente</th><th>Status</th><th>Total</th><th>Validação</th><th>Ação</th></tr></thead>
        <tbody>{rows.map(({ order, client, check }) => <tr key={order.id}>
          <td><strong>{orderCode(order.order_number)}</strong><small>{order.equipment ?? 'Equipamento não identificado'}</small></td>
          <td><strong>{order.client_name ?? client?.name ?? 'Cliente não identificado'}</strong><small>{client?.document || 'Documento não informado'}</small></td>
          <td><StatusBadge status={order.status}/></td>
          <td><strong>{money.format(orderTotal(order))}</strong></td>
          <td>{check.ready
            ? <span className="stock-state ok"><CheckCircle2 size={14}/> Pronta</span>
            : <div><span className="stock-state critical"><AlertCircle size={14}/> Revisar</span><small style={{ display: 'block', marginTop: 4 }}>{check.issues.join(' · ')}</small></div>}
          </td>
          <td><Link to={`/ordens/${order.id}`} className="ghost-button"><FileSearch size={15}/> Revisar OS</Link></td>
        </tr>)}</tbody>
      </table></div>}
    </section>

    <section className="notice" style={{ marginTop: 20 }}>
      <Building2/>
      <div><strong>Próximo requisito para emissão em produção</strong><p>Definir o provedor/API fiscal, ambiente, certificado quando aplicável, credenciais segregadas por empresa e armazenamento dos retornos/protocolos.</p></div>
    </section>
  </>;
}
