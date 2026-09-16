import { useState } from "react";
import { usePrimeTech } from "../contexts/PrimeTechContext";
import { useAuth } from "../contexts/AuthContext";
import { can } from "../lib/permissions";
import { money, paymentMethods, shortDate } from "../lib/formatters";

export function PaymentPanel({orderId}:{orderId?:string}) {
 const {orders,installments,finance,createPaymentPlan,settleInstallment}=usePrimeTech(); const {user}=useAuth();
 const order=orders.find(o=>o.id===orderId); const [requestId,setRequestId]=useState(()=>crypto.randomUUID());
 const [busy,setBusy]=useState(false);const [notice,setNotice]=useState("");const [count,setCount]=useState(1);const [kind,setKind]=useState<"income"|"expense">("income");
 const rows=installments.filter(p=>!orderId||p.service_order_id===orderId);
 const allocated=rows.filter(p=>p.type==="income").reduce((a,p)=>a+p.amount,0)+finance.filter(f=>f.service_order_id===orderId&&f.type==="income"&&!f.installment_id).reduce((a,p)=>a+p.amount,0);
 const balance=order?Math.max(0,Math.round((order.total_amount-allocated)*100)/100):undefined;
 const eligible=!order||["approved","in_repair","waiting_part","ready_for_pickup","delivered"].includes(order.status);
 const today=new Date().toLocaleDateString("sv-SE");
 if(!can(user,"finance.view"))return null;
 return <section className="pt-card space-y-4"><h2 className="pt-section-title">{order?"Pagamento da OS":"Vendas, serviços e contas a pagar / receber"}</h2>
 <p className="text-sm text-muted">Registre as condições combinadas. Só confirme a baixa após verificar o pagamento. Pix, cartão e boleto são registros internos.</p>
 {order&&<p>Valor ainda sem condições de pagamento: <strong>{money.format(balance!)}</strong></p>}
 {notice&&<p role="status">{notice}</p>}
 {can(user,"finance.manage")&&eligible&&(!order||balance!>0)&&<form className="grid gap-3 md:grid-cols-3" onSubmit={async e=>{e.preventDefault();const form=e.currentTarget;const d=new FormData(form);setBusy(true);setNotice("");try{await createPaymentPlan({request_id:requestId,order_id:orderId??null,type:order?"income":kind,category:String(d.get("category")),description:String(d.get("description")),amount:Number(d.get("amount")),count,first_due:String(d.get("due")),method:String(d.get("method")),paid:d.get("paid")==="on"});setRequestId(crypto.randomUUID());setNotice("Condições registradas.");form.reset();setCount(1);}catch(err){setNotice(err&&typeof err==="object"&&"message"in err?String(err.message):"Não foi possível salvar.");}finally{setBusy(false);}}}>
 {!order&&<label><span className="pt-label">Movimento</span><select className="pt-input" value={kind} onChange={e=>setKind(e.target.value as "income"|"expense")}><option value="income">Venda / serviço — receber</option><option value="expense">Compra / despesa — pagar</option></select></label>}
 <label><span className="pt-label">Categoria</span><input name="category" required className="pt-input" defaultValue={order?"Serviços de assistência":"Vendas"}/></label>
 <label><span className="pt-label">Descrição / cliente ou fornecedor</span><input name="description" required minLength={3} className="pt-input" defaultValue={order?`Pagamento OS #${order.order_number}`:""}/></label>
 <label><span className="pt-label">Valor total (R$)</span><input name="amount" required className="pt-input" type="number" inputMode="decimal" step="0.01" min="0.01" max={balance} defaultValue={balance}/></label>
 <label><span className="pt-label">Forma de pagamento</span><select name="method" className="pt-input">{Object.entries(paymentMethods).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
 <label><span className="pt-label">Parcelas mensais (1 = à vista)</span><input type="number" min="1" max="36" required className="pt-input" value={count} onChange={e=>setCount(Number(e.target.value))}/></label>
 <label><span className="pt-label">Primeiro vencimento</span><input name="due" type="date" required className="pt-input" defaultValue={today}/></label>
 {count===1&&<label className="flex gap-2 items-center"><input name="paid" type="checkbox"/>Pagamento já confirmado</label>}
 <button className="pt-btn-primary" disabled={busy}>{busy?"Salvando…":"Registrar condições"}</button></form>}
 {!eligible&&<p className="text-muted">As condições de pagamento ficam disponíveis após a aprovação do cliente.</p>}
 <div className="space-y-3">{rows.map(p=><div key={p.id} className="rounded-xl border border-border p-3 flex flex-wrap gap-3 items-center justify-between"><div><strong>{p.description} · {p.installment_number}/{p.installment_count}</strong><p className="text-sm text-muted">{p.type==="income"?"Receber":"Pagar"} · {shortDate.format(new Date(p.due_date+"T12:00:00"))} · {paymentMethods[p.payment_method]} · {p.paid_at?"Liquidado":p.due_date<today?"Em atraso":"Em aberto"}</p></div><strong>{money.format(p.amount)}</strong>{!p.paid_at&&can(user,"finance.manage")&&<button disabled={busy} className="pt-btn-secondary" onClick={async()=>{setBusy(true);try{await settleInstallment(p.id);setNotice("Pagamento confirmado e registrado no caixa.");}catch(e){setNotice(e&&typeof e==="object"&&"message"in e?String(e.message):"Falha na baixa.");}finally{setBusy(false);}}}>{p.type==="income"?"Confirmar recebimento":"Confirmar pagamento"}</button>}</div>)}</div>
 </section>;
}
