import { useMemo, useState } from "react";
import { Navigate, Link, useParams } from "react-router-dom";
import { Printer } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { usePrimeTech } from "../contexts/PrimeTechContext";
import { can } from "../lib/permissions";
import { money, orderCode, dateTime } from "../lib/formatters";
import { StatusBadge } from "../components/ui/StatusBadge";
import type { ItemKind } from "../types/domain";

export function OrderDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { orders, clients, equipment, updateTechnical, transitionOrder, loading } = usePrimeTech();
  const order = orders.find((o) => o.id === id);
  const client = clients.find((c) => c.id === order?.client_id);
  const eq = equipment.find((e) => e.id === order?.equipment_id);
  const [diagnosis, setDiagnosis] = useState(order?.diagnosis ?? "");
  const [days, setDays] = useState(order?.estimated_days ?? 2);
  const [items, setItems] = useState<Array<{ kind: ItemKind; description: string; quantity: number; unit_price: number; cost_price?: number }>>(() => order?.items?.map((i) => ({ kind: i.kind, description: i.description, quantity: i.quantity, unit_price: i.unit_price, cost_price: i.cost_price ?? undefined })) ?? []);
  const [newItem, setNewItem] = useState({ kind: "service" as ItemKind, description: "", quantity: 1, unit_price: 0, cost_price: 0 });
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  async function run(action: () => Promise<void>, success: string) { setBusy(true); setNotice(''); try { await action(); setNotice(success); } catch (error) { setNotice(error && typeof error === 'object' && 'message' in error ? String(error.message) : 'Não foi possível salvar. Tente novamente.'); } finally { setBusy(false); } }
  const total = useMemo(() => items.reduce((acc, i) => acc + i.quantity * i.unit_price, 0), [items]);

  if (loading) return <div className="pt-card">Carregando ordem de serviço…</div>;
  if (!order) return <Navigate to="/ordens" replace />;

  const canTech = can(user, "orders.tech");
  const canApproval = can(user, "orders.customer_approval");
  const canDelivery = can(user, "orders.delivery");

  return <div className="space-y-6">{notice && <p role="status" className="pt-card">{notice}</p>}
    <div className="flex flex-wrap items-end justify-between gap-4"><div><div className="flex items-center gap-3"><h1 className="pt-page-title">{orderCode(order.order_number)}</h1><StatusBadge status={order.status} /></div><p className="pt-page-subtitle">Aberta em {dateTime.format(new Date(order.created_at))}</p></div><Link className="pt-btn-secondary" to={`/documentos/os/${order.id}`} target="_blank"><Printer size={17} /> Orçamento / impressão</Link></div>

    <div className="grid gap-5 lg:grid-cols-3">
      <section className="pt-card lg:col-span-2"><h2 className="pt-section-title">Atendimento</h2><div className="mt-4 grid gap-4 sm:grid-cols-2"><Info label="Cliente" value={client?.name} /><Info label="Contato" value={client?.phone} /><Info label="Equipamento" value={[eq?.category, eq?.brand, eq?.model].filter(Boolean).join(" • ")} /><Info label="Nº de série" value={eq?.serial_number} /><Info label="Acessórios" value={eq?.accessories} /><Info label="Tipo de entrada" value={order.intake_type} /></div><div className="mt-4"><Info label="Problema informado" value={order.reported_issue} /></div></section>
      <section className="pt-card"><h2 className="pt-section-title">Resumo financeiro</h2><div className="mt-4 space-y-3 text-sm"><Line label="Serviços" value={money.format(order.total_services)} /><Line label="Peças" value={money.format(order.total_parts)} /><div className="border-t pt-3"><Line label="Total" value={money.format(order.total_amount)} strong /></div></div></section>
    </div>

    {canTech && ["waiting_technician", "diagnosis"].includes(order.status) ? <section className="pt-card"><h2 className="pt-section-title">Diagnóstico e orçamento técnico</h2><p className="pt-section-description">Ao enviar, a OS irá para “Aguardando cliente”.</p><div className="mt-5 grid gap-4 md:grid-cols-3"><div className="md:col-span-2"><label className="pt-label">Diagnóstico</label><textarea className="pt-input min-h-28" value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} /></div><div><label className="pt-label">Prazo estimado (dias)</label><input className="pt-input" type="number" min="1" value={days} onChange={(e) => setDays(Number(e.target.value))} /></div></div>
      <div className="mt-5 rounded-2xl border border-border p-4"><h3 className="font-semibold">Itens do orçamento</h3><div className="mt-3 grid gap-3 md:grid-cols-5"><select aria-label="Tipo do item" className="pt-input" value={newItem.kind} onChange={(e) => setNewItem((s) => ({ ...s, kind: e.target.value as ItemKind }))}><option value="service">Serviço</option><option value="part">Peça</option></select><input className="pt-input md:col-span-2" placeholder="Descrição" value={newItem.description} onChange={(e) => setNewItem((s) => ({ ...s, description: e.target.value }))} /><input className="pt-input" aria-label="Quantidade" inputMode="decimal" type="number" min="0.001" step="0.001" value={newItem.quantity} onChange={(e) => setNewItem((s) => ({ ...s, quantity: Number(e.target.value) }))} /><input className="pt-input" aria-label="Valor unitário" inputMode="decimal" type="number" min="0" step="0.01" placeholder="Valor" value={newItem.unit_price} onChange={(e) => setNewItem((s) => ({ ...s, unit_price: Number(e.target.value) }))} /></div><button type="button" className="pt-btn-secondary mt-3" onClick={() => { if (!newItem.description.trim() || !Number.isFinite(newItem.quantity) || newItem.quantity <= 0 || !Number.isFinite(newItem.unit_price) || newItem.unit_price < 0) { setNotice("Revise a descrição, a quantidade e o valor."); return; } setItems((s) => [...s, newItem]); setNewItem({ kind: "service", description: "", quantity: 1, unit_price: 0, cost_price: 0 }); }}>Adicionar item</button>
      <div className="mt-4 space-y-2">{items.map((item, index) => <div key={`${item.description}-${index}`} className="flex flex-wrap gap-3 items-center justify-between rounded-xl bg-surface-2 px-3 py-2 text-sm"><span>{item.kind === "service" ? "Serviço" : "Peça"} • {item.description} × {item.quantity}</span><div className="flex items-center gap-3"><strong>{money.format(item.quantity * item.unit_price)}</strong><button className="text-red-400" onClick={() => setItems((s) => s.filter((_, i) => i !== index))}>remover</button></div></div>)}</div><div className="mt-4 text-right font-semibold">Total: {money.format(total)}</div></div>
      <div className="mt-5 flex flex-wrap justify-end gap-3"><button disabled={busy} className="pt-btn-secondary" onClick={() => run(() => updateTechnical(order.id, diagnosis, days, items, false), "Rascunho salvo")}>Salvar rascunho</button><button disabled={busy || !diagnosis.trim() || !items.length || days < 1} className="pt-btn-primary" onClick={() => run(() => updateTechnical(order.id, diagnosis, days, items, true), "Orçamento enviado")}>{busy ? "Salvando…" : "Enviar orçamento"}</button></div>
    </section> : null}

    {order.diagnosis ? <section className="pt-card"><h2 className="pt-section-title">Diagnóstico técnico</h2><p className="mt-3 text-sm leading-6">{order.diagnosis}</p>{order.items?.length ? <div className="mt-4 overflow-x-auto"><table className="pt-table"><thead><tr><th>Tipo</th><th>Descrição</th><th>Qtd.</th><th>Unitário</th><th>Total</th></tr></thead><tbody>{order.items.map((item) => <tr key={item.id}><td>{item.kind === "service" ? "Serviço" : "Peça"}</td><td>{item.description}</td><td>{item.quantity}</td><td>{money.format(item.unit_price)}</td><td>{money.format(item.quantity * item.unit_price)}</td></tr>)}</tbody></table></div> : null}</section> : null}

    <section className="pt-card"><h2 className="pt-section-title">Ações do fluxo</h2><div className="mt-4 flex flex-wrap gap-3">
      {canApproval && order.status === "waiting_customer" && <><button className="pt-btn-primary" disabled={busy} onClick={() => run(() => transitionOrder(order.id, "approved", "Cliente aprovou o orçamento"), "Status atualizado")}>Cliente aprovou</button><button className="pt-btn-danger" disabled={busy} onClick={() => run(() => transitionOrder(order.id, "cancelled", "Cliente recusou o orçamento"), "Status atualizado")}>Cliente recusou</button></>}
      {canTech && order.status === "approved" && <button className="pt-btn-primary" disabled={busy} onClick={() => run(() => transitionOrder(order.id, "in_repair", "Manutenção iniciada"), "Status atualizado")}>Iniciar manutenção</button>}
      {canTech && order.status === "in_repair" && <><button className="pt-btn-secondary" disabled={busy} onClick={() => run(() => transitionOrder(order.id, "waiting_part", "Aguardando peça"), "Status atualizado")}>Aguardando peça</button><button className="pt-btn-primary" disabled={busy} onClick={() => run(() => transitionOrder(order.id, "ready_for_pickup", "Manutenção concluída"), "Status atualizado")}>Concluir manutenção</button></>}
      {canTech && order.status === "waiting_part" && <button className="pt-btn-primary" disabled={busy} onClick={() => run(() => transitionOrder(order.id, "in_repair", "Peça disponível"), "Status atualizado")}>Retomar manutenção</button>}
      {canDelivery && order.status === "ready_for_pickup" && <button className="pt-btn-primary" disabled={busy} onClick={() => run(() => transitionOrder(order.id, "delivered", "Equipamento entregue ao cliente"), "Status atualizado")}>Confirmar entrega</button>}
      {!((canApproval && order.status === "waiting_customer") || (canTech && ["approved", "in_repair", "waiting_part"].includes(order.status)) || (canDelivery && order.status === "ready_for_pickup")) && <p className="text-sm text-muted">Nenhuma ação disponível para este perfil no status atual.</p>}
    </div></section>
  </div>;
}

function Info({ label, value }: { label: string; value?: string | null }) { return <div><p className="text-xs uppercase tracking-wider text-muted">{label}</p><p className="mt-1 font-medium">{value || "—"}</p></div>; }
function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) { return <div className={`flex justify-between ${strong ? "text-base font-semibold" : ""}`}><span className="text-muted">{label}</span><span>{value}</span></div>; }
