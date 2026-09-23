import { FileText, Printer } from 'lucide-react';
import { useMemo, useState } from 'react';

import { dateTime, equipmentCode, money, orderCode } from '../../lib/formatters';
import type { Client, CompanySettings, Equipment, ServiceOrder } from '../../types/domain';
import { PrintableReport } from '../reports/PrintableReport';

type PrintMode = 'order' | 'quote' | null;

type Props = {
  order: ServiceOrder;
  client?: Client;
  equipment?: Equipment;
  company: CompanySettings;
  generatedBy?: string | null;
};

const statusLabels: Record<string, string> = {
  triage: 'Triagem',
  waiting_technician: 'Aguardando técnico',
  diagnosis: 'Diagnóstico',
  budget_ready: 'Orçamento pronto',
  ready_for_commercial: 'Pronto para Comercial',
  waiting_customer: 'Aguardando cliente',
  approved: 'Aprovado',
  in_repair: 'Em manutenção',
  waiting_part: 'Aguardando peça',
  quality_check: 'Testes / qualidade',
  ready_for_pickup: 'Pronto para retirada',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
  warranty: 'Garantia',
};

const priorityLabels: Record<string, string> = {
  low: 'Baixa',
  normal: 'Normal',
  high: 'Alta',
  urgent: 'Urgente',
};

function line(label: string, value?: string | number | null) {
  return (
    <div style={{ padding: '5px 0', borderBottom: '1px solid #e5e7eb' }}>
      <strong>{label}:</strong> {value === null || value === undefined || value === '' ? 'Não informado' : value}
    </div>
  );
}

function sectionTitle(title: string) {
  return <h3 style={{ margin: '18px 0 8px', fontSize: 13, textTransform: 'uppercase', letterSpacing: '.04em' }}>{title}</h3>;
}

export function OrderPrintActions({ order, client, equipment, company, generatedBy }: Props) {
  const [mode, setMode] = useState<PrintMode>(null);
  const items = order.items ?? [];
  const totalServices = useMemo(
    () => items.filter((item) => item.kind === 'service').reduce((sum, item) => sum + Number(item.quantity) * Number(item.unit_price), 0),
    [items],
  );
  const totalParts = useMemo(
    () => items.filter((item) => item.kind === 'part').reduce((sum, item) => sum + Number(item.quantity) * Number(item.unit_price), 0),
    [items],
  );
  const total = totalServices + totalParts || Number(order.total_amount ?? order.quote_total ?? 0);
  const equipmentLabel = [equipment?.category, equipment?.brand, equipment?.model].filter(Boolean).join(' ') || order.equipment || 'Equipamento';
  const validity = Math.max(Number(company.budget_validity_days ?? 7), 1);

  return (
    <>
      <div className="quick-actions" style={{ flexWrap: 'wrap' }}>
        <button type="button" className="ghost-button" onClick={() => setMode('order')}>
          <Printer size={16} /> Imprimir OS
        </button>
        <button type="button" className="primary-button" onClick={() => setMode('quote')}>
          <FileText size={16} /> Imprimir orçamento
        </button>
      </div>

      <PrintableReport
        open={mode === 'order'}
        onClose={() => setMode(null)}
        title={`Ordem de Serviço ${orderCode(order.order_number)}`}
        subtitle="Via completa para acompanhamento e entrega ao cliente"
        company={company}
        generatedBy={generatedBy}
        filters={[
          { label: 'Status', value: statusLabels[order.status] ?? order.status },
          { label: 'Abertura', value: dateTime.format(new Date(order.created_at)) },
          { label: 'Prioridade', value: priorityLabels[order.priority] ?? order.priority },
        ]}
      >
        {sectionTitle('Cliente')}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
          {line('Nome / Razão social', client?.name ?? order.client_name)}
          {line('CPF / CNPJ', client?.document)}
          {line('Telefone', client?.phone)}
          {line('E-mail', client?.email)}
          {line('Endereço', client?.address || [client?.street, client?.address_number, client?.district, client?.city, client?.state].filter(Boolean).join(', '))}
        </div>

        {sectionTitle('Equipamento recebido')}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
          {line('Código', equipmentCode(equipment?.technical_number))}
          {line('Equipamento', equipmentLabel)}
          {line('Número de série', equipment?.serial_number)}
          {line('Acessórios recebidos', equipment?.accessories)}
          {line('Estado físico / observações', equipment?.notes)}
          {line('Tipo de entrada', order.intake_type)}
        </div>

        {sectionTitle('Atendimento')}
        {line('Problema relatado pelo cliente', order.reported_issue)}
        {line('Diagnóstico técnico', order.diagnosis)}
        {line('Última atualização técnica', order.technical_update)}
        {line('Observações técnicas', order.technical_notes)}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
          {line('Técnico responsável', order.technician)}
          {line('Prazo estimado', order.estimated_days == null ? null : `${order.estimated_days} dia(s)`)}
          {line('Programação', order.scheduled_at ? dateTime.format(new Date(order.scheduled_at)) : null)}
          {line('Duração programada', order.scheduled_duration_minutes ? `${order.scheduled_duration_minutes} min` : null)}
        </div>
        {order.schedule_notes && line('Observação da programação', order.schedule_notes)}
        {order.pause_notes && line('Motivo / observação da pausa', order.pause_notes)}

        {sectionTitle('Serviços e produtos')}
        <ItemsTable order={order} />
        <Totals services={totalServices || Number(order.total_services ?? 0)} parts={totalParts || Number(order.total_parts ?? 0)} total={total} />

        {sectionTitle('Condições e observações')}
        {line('Situação do orçamento', order.approval_status === 'approved' ? 'Aprovado' : order.approval_status === 'rejected' ? 'Não aprovado' : 'Pendente')}
        {order.approval_notes && line('Observação da aprovação', order.approval_notes)}
        {company.warranty_text && line('Garantia', company.warranty_text)}
        {company.footer_text && line('Observações da empresa', company.footer_text)}

        <SignatureBlock />
      </PrintableReport>

      <PrintableReport
        open={mode === 'quote'}
        onClose={() => setMode(null)}
        title={`Orçamento ${orderCode(order.order_number)}`}
        subtitle="Proposta de serviços e produtos para aprovação do cliente"
        company={company}
        generatedBy={generatedBy}
        filters={[
          { label: 'Cliente', value: client?.name ?? order.client_name ?? 'Cliente' },
          { label: 'Equipamento', value: equipmentLabel },
          { label: 'Validade', value: `${validity} dia(s)` },
        ]}
      >
        <div style={{ padding: 12, border: '1px solid #dbe3ee', borderRadius: 7, background: '#f8fafc' }}>
          <strong>{client?.name ?? order.client_name ?? 'Cliente'}</strong>
          <div>{client?.document ? `CPF/CNPJ: ${client.document}` : ''}</div>
          <div>{client?.phone ? `Contato: ${client.phone}` : ''}</div>
          <div style={{ marginTop: 5 }}><strong>Equipamento:</strong> {equipmentLabel}{equipment?.serial_number ? ` · Série ${equipment.serial_number}` : ''}</div>
        </div>

        {sectionTitle('Diagnóstico / necessidade')}
        {line('Problema relatado', order.reported_issue)}
        {order.diagnosis && line('Diagnóstico técnico', order.diagnosis)}

        {sectionTitle('Itens do orçamento')}
        <ItemsTable order={order} />
        <Totals services={totalServices || Number(order.total_services ?? 0)} parts={totalParts || Number(order.total_parts ?? 0)} total={total} />

        <div style={{ marginTop: 18, padding: 12, border: '1px solid #dbe3ee', borderRadius: 7 }}>
          <strong>Condições do orçamento</strong>
          <p style={{ margin: '6px 0 0' }}>Validade: {validity} dia(s) a partir da emissão deste documento.</p>
          {order.estimated_days != null && <p style={{ margin: '4px 0 0' }}>Prazo técnico estimado após aprovação: {order.estimated_days} dia(s), sujeito à disponibilidade de peças e condições informadas.</p>}
          {company.warranty_text && <p style={{ margin: '4px 0 0' }}>Garantia: {company.warranty_text}</p>}
          {company.footer_text && <p style={{ margin: '4px 0 0' }}>{company.footer_text}</p>}
        </div>

        <div style={{ marginTop: 34, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 34 }}>
          <div style={{ borderTop: '1px solid #111827', paddingTop: 6, textAlign: 'center' }}>Aprovação do cliente</div>
          <div style={{ borderTop: '1px solid #111827', paddingTop: 6, textAlign: 'center' }}>Data</div>
        </div>
      </PrintableReport>
    </>
  );
}

function ItemsTable({ order }: { order: ServiceOrder }) {
  const items = order.items ?? [];
  if (!items.length) {
    return <div style={{ padding: 12, border: '1px solid #e5e7eb', borderRadius: 7 }}>Nenhum serviço ou produto foi incluído nesta OS.</div>;
  }

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th style={th}>Tipo</th>
          <th style={th}>Descrição</th>
          <th style={{ ...th, textAlign: 'right' }}>Qtd.</th>
          <th style={{ ...th, textAlign: 'right' }}>Unitário</th>
          <th style={{ ...th, textAlign: 'right' }}>Total</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.id}>
            <td style={td}>{item.kind === 'service' ? 'Serviço' : 'Produto'}</td>
            <td style={td}>{item.description}</td>
            <td style={{ ...td, textAlign: 'right' }}>{Number(item.quantity)}</td>
            <td style={{ ...td, textAlign: 'right' }}>{money.format(Number(item.unit_price))}</td>
            <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{money.format(Number(item.quantity) * Number(item.unit_price))}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Totals({ services, parts, total }: { services: number; parts: number; total: number }) {
  return (
    <div style={{ marginTop: 12, marginLeft: 'auto', width: 300, display: 'grid', gap: 4 }}>
      <div style={totalLine}><span>Serviços</span><strong>{money.format(services)}</strong></div>
      <div style={totalLine}><span>Produtos / peças</span><strong>{money.format(parts)}</strong></div>
      <div style={{ ...totalLine, fontSize: 15, borderTop: '2px solid #111827', paddingTop: 7 }}><span>Total</span><strong>{money.format(total)}</strong></div>
    </div>
  );
}

function SignatureBlock() {
  return (
    <div style={{ marginTop: 42, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 34 }}>
      <div style={{ borderTop: '1px solid #111827', paddingTop: 6, textAlign: 'center' }}>Assinatura do cliente / responsável</div>
      <div style={{ borderTop: '1px solid #111827', paddingTop: 6, textAlign: 'center' }}>Responsável Prime Tech</div>
    </div>
  );
}

const th = { padding: '7px 8px', borderBottom: '1px solid #cbd5e1', color: '#475569', textAlign: 'left' as const, fontSize: 10, textTransform: 'uppercase' as const };
const td = { padding: '7px 8px', borderBottom: '1px solid #e5e7eb', verticalAlign: 'top' as const };
const totalLine = { display: 'flex', justifyContent: 'space-between', gap: 12, padding: '3px 0' };
