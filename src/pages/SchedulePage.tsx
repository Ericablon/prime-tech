import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { usePrimeTech } from "../contexts/PrimeTechContext";
import { supabase } from "../lib/supabase";
import { can } from "../lib/permissions";
import { dateTime, orderCode } from "../lib/formatters";
import type { UserProfile } from "../types/domain";

type Appointment = { id: string; service_order_id: string; technician_id: string; starts_at: string; ends_at: string; notes: string; status: "scheduled" | "completed" | "cancelled" };
const storageKey = "cronos-demo-appointments";
export function SchedulePage() {
 const { user, mode } = useAuth();
 const { orders, clients } = usePrimeTech();
 const [appointments,setAppointments] = useState<Appointment[]>([]);
 const [technicians,setTechnicians] = useState<UserProfile[]>([]);
 const [notice,setNotice] = useState(""); const [busy,setBusy] = useState(false);
 const [form,setForm] = useState({service_order_id:"",technician_id:"",starts_at:"",ends_at:"",notes:""});
 const [day,setDay] = useState(""); const [mine,setMine] = useState(user?.role_code === "tecnico");
 const manage = can(user,"admin.manage");
 async function load() {
  if(mode === "demo") { setAppointments(JSON.parse(localStorage.getItem(storageKey) || "[]")); setTechnicians([{id:"demo-tecnico",full_name:"Técnico Prime Tech",role_code:"tecnico"},{id:"demo-gestor",full_name:"Gestor Prime Tech",role_code:"gestor"}]); return; }
  if(!supabase) return;
  const result=await supabase.from("service_appointments").select("*").order("starts_at");
  if(result.error) throw result.error; setAppointments(result.data);
  if(manage) { const people=await supabase.from("profiles").select("id,full_name,role_code").eq("active",true).in("role_code",["tecnico","gestor"]); if(people.error) throw people.error; setTechnicians(people.data as UserProfile[]); }
 }
 useEffect(()=>{void load().catch((e)=>setNotice(e.message));},[mode,user?.id]);
 async function save() {
  setBusy(true); setNotice("");
  try {
   const start=new Date(form.starts_at), end=new Date(form.ends_at);
   if(!form.service_order_id || !form.technician_id || !Number.isFinite(+start) || !Number.isFinite(+end) || end<=start) throw new Error("Selecione OS, técnico e um período válido.");
   const record={...form,starts_at:start.toISOString(),ends_at:end.toISOString(),status:"scheduled" as const};
   if(mode==="supabase" && supabase) { const {error}=await supabase.from("service_appointments").upsert(record,{onConflict:"service_order_id"}); if(error) throw error; }
   else { if(appointments.some(a=>a.service_order_id!==record.service_order_id && a.technician_id===record.technician_id && a.status==="scheduled" && new Date(a.starts_at)<end && new Date(a.ends_at)>start)) throw new Error("Técnico ocupado nesse horário."); const next=[...appointments.filter(a=>a.service_order_id!==record.service_order_id),{...record,id:crypto.randomUUID()}]; localStorage.setItem(storageKey,JSON.stringify(next)); }
   await load(); setNotice("Serviço programado.");
  } catch(e) {setNotice(e && typeof e==="object" && "message" in e ? String(e.message):"Falha ao salvar programação.");} finally{setBusy(false);}
 }
 async function changeStatus(a:Appointment,status:Appointment["status"]) {
  setBusy(true); try { if(mode==="supabase" && supabase){const {error}=await supabase.from("service_appointments").update({status}).eq("id",a.id).select("id").single();if(error)throw error;}else{localStorage.setItem(storageKey,JSON.stringify(appointments.map(x=>x.id===a.id?{...x,status}:x)));} await load();setNotice("Programação atualizada.");} catch(e){setNotice(e && typeof e==="object" && "message" in e?String(e.message):"Falha na atualização.");}finally{setBusy(false);}
 }
 const filtered=appointments.filter(a=>(!mine||a.technician_id===user?.id)&&(!day||new Date(a.starts_at).toLocaleDateString("sv-SE")===day));
 return <div className="space-y-5"><header><h1 className="pt-page-title">Programação técnica</h1><p className="pt-page-subtitle">Organize os horários e abra o orçamento diretamente pelo celular.</p></header>
 {notice&&<p role="status" className="pt-card">{notice}</p>}
 <section className="pt-card flex flex-wrap items-end gap-4"><label><span className="pt-label">Dia</span><input type="date" className="pt-input" value={day} onChange={e=>setDay(e.target.value)}/></label><label className="flex gap-2 items-center py-3"><input type="checkbox" checked={mine} onChange={e=>setMine(e.target.checked)}/>Somente meus serviços</label><button className="pt-btn-secondary" onClick={()=>{setDay("");setMine(false);}}>Limpar filtros</button></section>
 {manage&&<form className="pt-card space-y-4" onSubmit={e=>{e.preventDefault();void save();}}><h2 className="pt-section-title">Programar ou reagendar OS</h2><div className="grid gap-4 md:grid-cols-2"><label><span className="pt-label">Ordem de serviço</span><select className="pt-input" required value={form.service_order_id} onChange={e=>setForm({...form,service_order_id:e.target.value})}><option value="">Selecione</option>{orders.filter(o=>!["cancelled","delivered"].includes(o.status)).map(o=><option key={o.id} value={o.id}>{orderCode(o.order_number)} · {clients.find(c=>c.id===o.client_id)?.name}</option>)}</select></label><label><span className="pt-label">Técnico responsável</span><select className="pt-input" required value={form.technician_id} onChange={e=>setForm({...form,technician_id:e.target.value})}><option value="">Selecione</option>{technicians.map(t=><option key={t.id} value={t.id}>{t.full_name}</option>)}</select></label><label><span className="pt-label">Início</span><input className="pt-input" type="datetime-local" required value={form.starts_at} onChange={e=>setForm({...form,starts_at:e.target.value})}/></label><label><span className="pt-label">Fim previsto</span><input className="pt-input" type="datetime-local" required value={form.ends_at} onChange={e=>setForm({...form,ends_at:e.target.value})}/></label></div><label className="block"><span className="pt-label">Orientações para o serviço</span><textarea className="pt-input" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></label><button disabled={busy} className="pt-btn-primary">{busy?"Salvando…":"Salvar programação"}</button></form>}
 <div className="grid gap-4 lg:grid-cols-2">{filtered.map(a=>{const order=orders.find(o=>o.id===a.service_order_id);return <article key={a.id} className="pt-card space-y-3"><div className="flex justify-between gap-3"><strong>{order?orderCode(order.order_number):"Ordem de serviço"}</strong><span className="text-sm text-muted">{a.status==="scheduled"?"Programado":a.status==="completed"?"Concluído":"Cancelado"}</span></div><p>{clients.find(c=>c.id===order?.client_id)?.name}</p><p className="text-sm">{dateTime.format(new Date(a.starts_at))} até {dateTime.format(new Date(a.ends_at))}</p><p className="text-sm text-muted">{technicians.find(t=>t.id===a.technician_id)?.full_name || (a.technician_id===user?.id?"Você":"Técnico designado")}</p><p className="whitespace-pre-wrap text-sm">{a.notes}</p><div className="flex flex-wrap gap-2"><Link className="pt-btn-primary" to={`/ordens/${a.service_order_id}`}>Abrir OS / orçamento</Link>{manage&&a.status==="scheduled"&&<><button disabled={busy} className="pt-btn-secondary" onClick={()=>void changeStatus(a,"completed")}>Concluir agenda</button><button disabled={busy} className="pt-btn-secondary" onClick={()=>void changeStatus(a,"cancelled")}>Cancelar agenda</button></>}</div></article>})}</div>{!filtered.length&&<p className="pt-card text-muted">Nenhum serviço programado para este filtro.</p>}
 </div>;
}
