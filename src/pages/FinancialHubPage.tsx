import {
  AlertTriangle, ArrowDownCircle, ArrowUpCircle, Banknote, CheckCircle2, CircleDollarSign,
  FileText, ListPlus, PlusCircle, Printer, Search, TrendingUp, WalletCards, X,
} from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { PrintableReport } from '../components/reports/PrintableReport';
import { MetricCard } from '../components/ui/MetricCard';
import { PageHeader } from '../components/ui/PageHeader';
import { useAuth } from '../contexts/AuthContext';
import { usePrimeTech } from '../contexts/PrimeTechContext';
import { useSessionDraft } from '../hooks/useSessionDraft';
import { categoriesFor } from '../lib/financeCategories';
import { money, orderCode, paymentMethods, shortDate } from '../lib/formatters';

type View = 'overview' | 'receivable' | 'payable' | 'realized';
type EntryForm = { type:'income'|'expense'; category:string; description:string; amount:string; occurredAt:string; method:string };
type PlanForm = { type:'income'|'expense'; category:string; description:string; amount:string; count:string; firstDue:string; method:string; orderId:string };
const today = () => new Date().toISOString().slice(0,10);
const initialEntry: EntryForm = { type:'income',category:'Serviços',description:'',amount:'',occurredAt:today(),method:'pix' };
const initialPlan: PlanForm = { type:'income',category:'Serviços',description:'',amount:'',count:'1',firstDue:today(),method:'pix',orderId:'' };
function isCurrentMonth(value:string){const d=new Date(value),n=new Date();return d.getFullYear()===n.getFullYear()&&d.getMonth()===n.getMonth();}

export function FinancialHubPage(){
  const { user }=useAuth();
  const { finance,installments,orders,company,loading,error,addFinancialEntry,createPaymentPlan,settleInstallment }=usePrimeTech();
  const [searchParams]=useSearchParams();
  const [view,setView]=useState<View>('overview');
  const [showEntryForm,setShowEntryForm,clearShowEntry]=useSessionDraft('finance-entry-open',false);
  const [showPlanForm,setShowPlanForm,clearShowPlan]=useSessionDraft('finance-plan-open',false);
  const [entryForm,setEntryForm,clearEntry]=useSessionDraft<EntryForm>('finance-entry-form',initialEntry);
  const [planForm,setPlanForm,clearPlan]=useSessionDraft<PlanForm>('finance-plan-form',initialPlan);
  const [saving,setSaving]=useState(false); const [localError,setLocalError]=useState(''); const [search,setSearch]=useState(()=>searchParams.get('busca')??''); const [printOpen,setPrintOpen]=useState(false);

  useEffect(()=>{
    const term=searchParams.get('busca')??'';
    setSearch(term);
    if(term)setView('realized');
  },[searchParams]);

  const monthEntries=useMemo(()=>finance.filter((entry)=>isCurrentMonth(entry.occurred_at)),[finance]);
  const revenues=monthEntries.filter((e)=>e.type==='income').reduce((s,e)=>s+Number(e.amount),0);
  const expenses=monthEntries.filter((e)=>e.type==='expense').reduce((s,e)=>s+Number(e.amount),0);
  const result=revenues-expenses;
  const openReceivables=installments.filter((i)=>i.type==='income'&&!i.paid_at);
  const openPayables=installments.filter((i)=>i.type==='expense'&&!i.paid_at);
  const pendingReceivables=openReceivables.reduce((s,i)=>s+Number(i.amount),0);
  const pendingPayables=openPayables.reduce((s,i)=>s+Number(i.amount),0);
  const overdueReceivables=openReceivables.filter((i)=>i.due_date<today());
  const overduePayables=openPayables.filter((i)=>i.due_date<today());
  const eligibleOrders=useMemo(()=>orders.filter((o)=>['approved','in_repair','waiting_part','quality_check','ready_for_pickup','delivered'].includes(o.status)),[orders]);
  const visibleInstallments=useMemo(()=>{const q=search.trim().toLowerCase();const base=view==='receivable'?openReceivables:view==='payable'?openPayables:installments.filter((i)=>!i.paid_at);if(!q)return base;return base.filter((i)=>`${i.description} ${i.category} ${i.payment_method}`.toLowerCase().includes(q));},[installments,openPayables,openReceivables,search,view]);
  const visibleEntries=useMemo(()=>{const q=search.trim().toLowerCase();if(!q)return finance;return finance.filter((e)=>`${e.description} ${e.category} ${e.payment_method??''}`.toLowerCase().includes(q));},[finance,search]);

  function setEntryType(type:'income'|'expense'){setEntryForm((v)=>({...v,type,category:categoriesFor(type)[0]?.label??''}));}
  function setPlanType(type:'income'|'expense'){setPlanForm((v)=>({...v,type,category:categoriesFor(type)[0]?.label??''}));}
  function closeEntry(discard=true){setShowEntryForm(false);clearShowEntry();if(discard)clearEntry();}
  function closePlan(discard=true){setShowPlanForm(false);clearShowPlan();if(discard)clearPlan();}

  async function submitEntry(event:FormEvent){event.preventDefault();const amount=Number(entryForm.amount.replace(',','.'));if(!entryForm.description.trim()||!entryForm.category)return setLocalError('Informe categoria e descrição do lançamento.');if(!Number.isFinite(amount)||amount<=0)return setLocalError('Informe um valor positivo.');setSaving(true);setLocalError('');try{await addFinancialEntry({type:entryForm.type,category:entryForm.category,description:entryForm.description.trim(),amount,occurred_at:new Date(`${entryForm.occurredAt}T12:00:00`).toISOString(),competence_date:entryForm.occurredAt,payment_method:entryForm.method});clearEntry();clearShowEntry();setShowEntryForm(false);}catch(cause){setLocalError(cause instanceof Error?cause.message:'Não foi possível registrar o lançamento.');}finally{setSaving(false);}}
  async function submitPlan(event:FormEvent){event.preventDefault();const amount=Number(planForm.amount.replace(',','.'));const count=Number.parseInt(planForm.count,10);if(!planForm.description.trim()||!planForm.category)return setLocalError('Informe categoria e descrição da conta.');if(!Number.isFinite(amount)||amount<=0)return setLocalError('Informe um valor positivo.');if(!Number.isFinite(count)||count<1||count>36)return setLocalError('Informe entre 1 e 36 parcelas.');if(!planForm.firstDue)return setLocalError('Informe o primeiro vencimento.');setSaving(true);setLocalError('');try{await createPaymentPlan({request_id:crypto.randomUUID(),order_id:planForm.orderId||null,type:planForm.type,category:planForm.category,description:planForm.description.trim(),amount,count,first_due:planForm.firstDue,method:planForm.method,paid:false});clearPlan();clearShowPlan();setShowPlanForm(false);}catch(cause){setLocalError(cause instanceof Error?cause.message:'Não foi possível criar a conta.');}finally{setSaving(false);}}
  async function settle(id:string){setSaving(true);setLocalError('');try{await settleInstallment(id);}catch(cause){setLocalError(cause instanceof Error?cause.message:'Não foi possível baixar a parcela.');}finally{setSaving(false);}}
  if(loading)return <div className="empty-state"><WalletCards size={38}/><h3>Carregando Financeiro</h3><p>Consolidando caixa, contas a receber e contas a pagar.</p></div>;

  return <>
    <PageHeader eyebrow="Financeiro" title="Gestão financeira" description="Entradas, saídas, contas a receber/pagar, baixas e DRE. Formulários incompletos ficam salvos temporariamente durante a sessão." actions={<div className="quick-actions"><Link to="/financeiro/dre" className="ghost-button"><FileText size={16}/>DRE</Link><button type="button" className="ghost-button" onClick={()=>setPrintOpen(true)}><Printer size={16}/>Relatório</button><button type="button" className="ghost-button" onClick={()=>{setShowPlanForm((v)=>!v);setShowEntryForm(false);}}><ListPlus size={16}/>{showPlanForm?'Fechar conta':'Nova conta'}</button><button type="button" className="primary-button" onClick={()=>{setShowEntryForm((v)=>!v);setShowPlanForm(false);}}>{showEntryForm?<X size={16}/>:<PlusCircle size={16}/>} {showEntryForm?'Fechar':'Novo lançamento'}</button></div>} />
    {(error||localError)&&<section className="notice" style={{marginBottom:16}}><AlertTriangle size={20}/><div><strong>Não foi possível concluir a operação</strong><p>{localError||error}</p></div></section>}

    {showPlanForm&&<section className="panel" style={{marginBottom:20}}><div className="panel-head"><div><span className="eyebrow">Contas</span><h2>Nova conta / parcelamento</h2></div></div><form onSubmit={(e)=>void submitPlan(e)} style={{display:'grid',gap:12}}><div className="form-grid">
      <label><span>Tipo</span><select value={planForm.type} onChange={(e)=>setPlanType(e.target.value as 'income'|'expense')}><option value="income">Conta a receber</option><option value="expense">Conta a pagar</option></select></label>
      <label><span>OS vinculada (opcional)</span><select value={planForm.orderId} onChange={(e)=>setPlanForm((v)=>({...v,orderId:e.target.value}))}><option value="">Sem OS</option>{eligibleOrders.map((o)=><option key={o.id} value={o.id}>{orderCode(o.order_number)} · {o.client_name??'Cliente'}</option>)}</select></label>
      <label><span>Categoria</span><select value={planForm.category} onChange={(e)=>setPlanForm((v)=>({...v,category:e.target.value}))}>{categoriesFor(planForm.type).map((c)=><option key={c.code} value={c.label}>{c.label}</option>)}</select></label>
      <label><span>Descrição</span><input value={planForm.description} onChange={(e)=>setPlanForm((v)=>({...v,description:e.target.value}))}/></label>
      <label><span>Valor total</span><input type="number" min="0.01" step="0.01" value={planForm.amount} onChange={(e)=>setPlanForm((v)=>({...v,amount:e.target.value}))}/></label>
      <label><span>Parcelas</span><input type="number" min="1" max="36" value={planForm.count} onChange={(e)=>setPlanForm((v)=>({...v,count:e.target.value}))}/></label>
      <label><span>Primeiro vencimento</span><input type="date" value={planForm.firstDue} onChange={(e)=>setPlanForm((v)=>({...v,firstDue:e.target.value}))}/></label>
      <label><span>Forma de pagamento</span><select value={planForm.method} onChange={(e)=>setPlanForm((v)=>({...v,method:e.target.value}))}>{Object.entries(paymentMethods).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
    </div><div className="quick-actions"><button type="submit" disabled={saving}><ListPlus size={16}/>{saving?'Criando...':'Criar conta'}</button><button type="button" className="ghost-button" onClick={()=>closePlan(true)}>Cancelar e descartar</button></div></form></section>}

    {showEntryForm&&<section className="panel" style={{marginBottom:20}}><div className="panel-head"><div><span className="eyebrow">Realizado</span><h2>Novo lançamento financeiro</h2></div></div><form onSubmit={(e)=>void submitEntry(e)} style={{display:'grid',gap:12}}><div className="form-grid">
      <label><span>Tipo</span><select value={entryForm.type} onChange={(e)=>setEntryType(e.target.value as 'income'|'expense')}><option value="income">Entrada</option><option value="expense">Saída</option></select></label>
      <label><span>Categoria</span><select value={entryForm.category} onChange={(e)=>setEntryForm((v)=>({...v,category:e.target.value}))}>{categoriesFor(entryForm.type).map((c)=><option key={c.code} value={c.label}>{c.label}</option>)}</select></label>
      <label><span>Descrição</span><input value={entryForm.description} onChange={(e)=>setEntryForm((v)=>({...v,description:e.target.value}))}/></label>
      <label><span>Valor</span><input type="number" min="0.01" step="0.01" value={entryForm.amount} onChange={(e)=>setEntryForm((v)=>({...v,amount:e.target.value}))}/></label>
      <label><span>Data / competência</span><input type="date" value={entryForm.occurredAt} onChange={(e)=>setEntryForm((v)=>({...v,occurredAt:e.target.value}))}/></label>
      <label><span>Forma de pagamento</span><select value={entryForm.method} onChange={(e)=>setEntryForm((v)=>({...v,method:e.target.value}))}>{Object.entries(paymentMethods).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
    </div><div className="quick-actions"><button type="submit" disabled={saving}><CircleDollarSign size={16}/>{saving?'Salvando...':'Registrar'}</button><button type="button" className="ghost-button" onClick={()=>closeEntry(true)}>Cancelar e descartar</button></div></form></section>}

    <div className="metrics-grid"><MetricCard label="Receitas no mês" value={money.format(revenues)} icon={ArrowUpCircle} tone="green"/><MetricCard label="Despesas no mês" value={money.format(expenses)} icon={ArrowDownCircle} tone="red"/><MetricCard label="Resultado" value={money.format(result)} icon={TrendingUp} tone={result>=0?'green':'red'}/><MetricCard label="A receber" value={money.format(pendingReceivables)} helper={`${overdueReceivables.length} vencida(s)`} icon={Banknote} tone="violet"/></div>

    <section className="panel" style={{marginBottom:16}}><div className="panel-head" style={{marginBottom:0}}><div><span className="eyebrow">Visões</span><h2>Financeiro operacional</h2></div><div className="quick-actions">{([['overview','Visão geral'],['receivable',`A receber (${openReceivables.length})`],['payable',`A pagar (${openPayables.length})`],['realized','Realizado']] as Array<[View,string]>).map(([value,label])=><button key={value} type="button" className={view===value?'primary-button':'ghost-button'} onClick={()=>setView(value)}>{label}</button>)}</div></div></section>

    {view!=='realized'&&<section className="panel" style={{marginBottom:20}}><div className="panel-head"><div><span className="eyebrow">Contas</span><h2>{view==='receivable'?'Contas a receber':view==='payable'?'Contas a pagar':'Contas em aberto'}</h2></div><strong>A receber: {money.format(pendingReceivables)} · A pagar: {money.format(pendingPayables)}</strong></div><div className="filters"><div className="filter-search"><Search size={16}/><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Buscar descrição, categoria ou pagamento..."/></div></div>{visibleInstallments.length===0?<div className="empty-state"><CheckCircle2 size={38}/><h3>Nenhuma conta nesta visão</h3></div>:<div className="table-wrap"><table><thead><tr><th>Vencimento</th><th>Descrição</th><th>Tipo</th><th>Parcela</th><th>Pagamento</th><th>Valor</th><th>Ação</th></tr></thead><tbody>{visibleInstallments.map((i)=>{const overdue=!i.paid_at&&i.due_date<today();return <tr key={i.id}><td><strong style={{color:overdue?'var(--red)':undefined}}>{shortDate.format(new Date(`${i.due_date}T12:00:00`))}</strong>{overdue&&<small>Vencida</small>}</td><td><strong>{i.description}</strong><small>{i.category}</small></td><td>{i.type==='income'?'Receber':'Pagar'}</td><td>{i.installment_number}/{i.installment_count}</td><td>{paymentMethods[i.payment_method as keyof typeof paymentMethods]??i.payment_method}</td><td><strong>{money.format(Number(i.amount))}</strong></td><td><button type="button" className="ghost-button" disabled={saving} onClick={()=>void settle(i.id)}><CheckCircle2 size={15}/>Baixar</button></td></tr>;})}</tbody></table></div>}</section>}

    {(view==='realized'||view==='overview')&&<section className="panel"><div className="panel-head"><div><span className="eyebrow">Realizado</span><h2>Entradas e saídas</h2></div></div>{view==='realized'&&<div className="filters"><div className="filter-search"><Search size={16}/><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Buscar lançamento..."/></div></div>}{visibleEntries.length===0?<div className="empty-state"><CircleDollarSign size={38}/><h3>Sem lançamentos realizados</h3></div>:<div className="table-wrap"><table><thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Tipo</th><th>Pagamento</th><th>Valor</th></tr></thead><tbody>{visibleEntries.slice(0,view==='overview'?12:200).map((e)=><tr key={e.id}><td>{shortDate.format(new Date(e.occurred_at))}</td><td><strong>{e.description}</strong></td><td>{e.category}</td><td>{e.type==='income'?'Entrada':'Saída'}</td><td>{e.payment_method?(paymentMethods[e.payment_method as keyof typeof paymentMethods]??e.payment_method):'—'}</td><td><strong style={{color:e.type==='income'?'var(--green)':'var(--red)'}}>{money.format(Number(e.amount))}</strong></td></tr>)}</tbody></table></div>}</section>}

    <PrintableReport open={printOpen} onClose={()=>setPrintOpen(false)} title="Relatório Financeiro" subtitle="Resumo gerencial do mês atual" company={company} generatedBy={user?.full_name} filters={[{label:'Competência',value:new Date().toLocaleDateString('pt-BR',{month:'long',year:'numeric'})}]}>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:20}}><PrintKpi label="Receitas" value={money.format(revenues)}/><PrintKpi label="Despesas" value={money.format(expenses)}/><PrintKpi label="Resultado" value={money.format(result)}/><PrintKpi label="A receber" value={money.format(pendingReceivables)}/></div>
    </PrintableReport>
    <section className="panel" style={{marginTop:16}}><div className="mini-kpis"><div><span>{overdueReceivables.length}</span><small>Recebíveis vencidos</small></div><div><span>{overduePayables.length}</span><small>Pagamentos vencidos</small></div><div><span>{installments.filter((i)=>Boolean(i.paid_at)).length}</span><small>Parcelas baixadas</small></div></div></section>
  </>;
}

function PrintKpi({label,value}:{label:string;value:string}){return <div style={{padding:10,border:'1px solid #d1d5db',borderRadius:6}}><small>{label}</small><strong style={{display:'block',marginTop:4}}>{value}</strong></div>;}
