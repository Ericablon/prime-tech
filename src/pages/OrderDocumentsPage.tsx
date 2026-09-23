import { AlertTriangle, ArrowLeft, FileText, Printer } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';

import { OrderPrintActions } from '../components/orders/OrderPrintActions';
import { PageHeader } from '../components/ui/PageHeader';
import { StatusBadge } from '../components/ui/StatusBadge';
import { useAuth } from '../contexts/AuthContext';
import { usePrimeTech } from '../contexts/PrimeTechContext';
import { money, orderCode } from '../lib/formatters';
import type { ServiceOrder } from '../types/domain';

type OrderEquipmentSnapshot = ServiceOrder & { equipment_description?: string | null };

export function OrderDocumentsPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { orders, clients, equipment, company, loading } = usePrimeTech();

  if (loading) {
    return <div className="empty-state"><Printer size={38} /><h3>Carregando documentos da OS</h3></div>;
  }

  const order = orders.find((item) => item.id === id);
  if (!order) {
    return (
      <section className="panel empty-state">
        <AlertTriangle size={38} />
        <h3>Ordem de Serviço não encontrada</h3>
        <Link to="/ordens" className="ghost-button"><ArrowLeft size={16} /> Voltar</Link>
      </section>
    );
  }

  const snapshot = order as OrderEquipmentSnapshot;
  const client = clients.find((item) => item.id === order.client_id);
  const equipmentItem = equipment.find((item) => item.id === order.equipment_id);
  const equipmentLabel = snapshot.equipment_description?.trim() || (equipmentItem ? [equipmentItem.category, equipmentItem.brand, equipmentItem.model].filter(Boolean).join(' ') : order.equipment ?? 'Equipamento');
  const total = Number(order.total_amount ?? order.quote_total ?? 0);

  return (
    <>
      <PageHeader
        eyebrow="Documentos do cliente"
        title={`${orderCode(order.order_number)} · Impressão`}
        description="Gere a Ordem de Serviço completa ou o orçamento em formato A4 para imprimir ou salvar em PDF e entregar ao cliente."
        actions={<Link to={`/ordens/${order.id}`} className="ghost-button"><ArrowLeft size={16} /> Voltar para OS</Link>}
      />

      <section className="panel" style={{ marginBottom: 18 }}>
        <div className="panel-head">
          <div><span className="eyebrow">Resumo</span><h2>{client?.name ?? order.client_name ?? 'Cliente'}</h2></div>
          <StatusBadge status={order.status} />
        </div>
        <div className="mini-kpis">
          <div><span>{orderCode(order.order_number)}</span><small>Ordem de Serviço</small></div>
          <div><span>{equipmentLabel}</span><small>Equipamento recebido</small></div>
          <div><span>{money.format(total)}</span><small>Total do orçamento</small></div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div><span className="eyebrow">Impressão</span><h2>Escolha o documento</h2></div>
          <FileText size={22} />
        </div>
        <div className="notice" style={{ marginBottom: 18 }}>
          <Printer size={19} />
          <div><strong>Pronto para entregar ao cliente</strong><p>A OS inclui cadastro, equipamento recebido, relato, diagnóstico, serviços/produtos, valores, condições e assinaturas. O orçamento mostra somente as informações comerciais necessárias para aprovação.</p></div>
        </div>
        <OrderPrintActions order={order} client={client} equipment={equipmentItem} company={company} generatedBy={user?.full_name} />
      </section>
    </>
  );
}
