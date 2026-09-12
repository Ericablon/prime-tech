import { resolveLogo } from "../lib/brand";
import { Navigate, useParams } from "react-router-dom";
import { usePrimeTech } from "../contexts/PrimeTechContext";
import { money, orderCode, shortDate } from "../lib/formatters";

export function OrderDocument() {
  const { id } = useParams();
  const { orders, clients, equipment, company } = usePrimeTech();
  const order = orders.find((o) => o.id === id);
  if (!order) return <Navigate to="/ordens" replace />;
  const client = clients.find((c) => c.id === order.client_id);
  const eq = equipment.find((e) => e.id === order.equipment_id);

  return <div className="print-page">
    <div className="no-print mb-4 flex justify-end"><button className="pt-btn-primary" onClick={() => window.print()}>Imprimir / Salvar PDF</button></div>
    <article className="print-sheet">
      <header className="print-header"><img src={resolveLogo(company.logo_url)} alt={company.trade_name} /><div><h1>{company.trade_name}</h1><p>{company.legal_name}</p><p>{[company.document, company.phone, company.whatsapp].filter(Boolean).join(" • ")}</p><p>{company.address}</p></div></header>
      <div className="print-title"><div><span>ORDEM DE SERVIÇO / ORÇAMENTO</span><strong>{orderCode(order.order_number)}</strong></div><div className="text-right"><span>Emissão</span><strong>{shortDate.format(new Date())}</strong></div></div>
      <section className="print-grid"><div><b>Cliente</b><span>{client?.name}</span></div><div><b>CPF/CNPJ</b><span>{client?.document || "—"}</span></div><div><b>Contato</b><span>{client?.phone || "—"}</span></div><div><b>E-mail</b><span>{client?.email || "—"}</span></div></section>
      <section className="print-box"><h2>Equipamento</h2><div className="print-grid"><div><b>Tipo</b><span>{eq?.category}</span></div><div><b>Marca / modelo</b><span>{eq?.brand} {eq?.model}</span></div><div><b>Nº de série</b><span>{eq?.serial_number || "—"}</span></div><div><b>Acessórios</b><span>{eq?.accessories || "—"}</span></div></div><p><b>Problema informado:</b> {order.reported_issue}</p></section>
      <section className="print-box"><h2>Diagnóstico técnico</h2><p>{order.diagnosis || "Aguardando diagnóstico técnico."}</p></section>
      <table className="print-table"><thead><tr><th>Tipo</th><th>Descrição</th><th>Qtd.</th><th>Unitário</th><th>Total</th></tr></thead><tbody>{(order.items ?? []).map((item) => <tr key={item.id}><td>{item.kind === "service" ? "Serviço" : "Peça"}</td><td>{item.description}</td><td>{item.quantity}</td><td>{money.format(item.unit_price)}</td><td>{money.format(item.unit_price * item.quantity)}</td></tr>)}{!order.items?.length && <tr><td colSpan={5}>Orçamento ainda não elaborado.</td></tr>}</tbody><tfoot><tr><td colSpan={4}>TOTAL</td><td>{money.format(order.total_amount)}</td></tr></tfoot></table>
      <section className="print-terms"><p>Validade do orçamento: {company.budget_validity_days} dias.</p><p>{company.warranty_text}</p></section>
      <div className="print-signatures"><div>Assinatura / autorização do cliente</div><div>Responsável Prime Tech</div></div>
      <footer>{company.footer_text || "Tecnologia que impulsiona."}</footer>
    </article>
  </div>;
}
