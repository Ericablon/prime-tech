import {
  AlertTriangle, ArrowDownCircle, ArrowUpCircle, Banknote, CheckCircle2, CircleDollarSign,
  FileText, ListPlus, Plus, PlusCircle, Printer, Search, TrendingUp, WalletCards, X,
} from 'lucide-react';
import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { PrintableReport } from '../components/reports/PrintableReport';
import { MetricCard } from '../components/ui/MetricCard';
import { PageHeader } from '../components/ui/PageHeader';
import { useAuth } from '../contexts/AuthContext';
import { usePrimeTech } from '../contexts/PrimeTechContext';
import { useSessionDraft } from '../hooks/useSessionDraft';
import { categoriesFor, dreGroupLabels, type DreGroup } from '../lib/financeCategories';
import { money, orderCode, paymentMethods, shortDate } from '../lib/formatters';
import { can } from '../lib/permissions';
import { supabase } from '../lib/supabase';

type View = 'overview' | 'receivable' | 'payable' | 'realized';
type Direction = 'income' | 'expense';
type EntryForm = { type:Direction; category:string; categoryId:string; accountId:string; description:string; amount:string; occurredAt:string; method:string };
type PlanForm = { type:Direction; category:string; categoryId:string; accountId:string; description:string; amount:string; count:string; firstDue:string; method:string; orderId:string };
type CategoryRow = { id:string; code:string; name:string; direction:'income'|'expense'|'both'; dre_group:DreGroup; sort_order:number; active:boolean };
type AccountRow = { id:string; name:string; account_type:string; active:boolean };
type QuickTarget = 'entry-category'|'plan-category'|'entry-account'|'plan-account'|null;

const today = () => new Date().toISOString().slice(0,10);
const initialEntry: EntryForm = { type:'income',category:'Serviços',categoryId:'',accountId:'',description:'',amount:'',occurredAt:today(),method:'pix' };
const initialPlan: PlanForm = { type:'income',category:'Serviços',categoryId:'',accountId:'',description:'',amount:'',count:'1',firstDue:today(),method:'pix',orderId:'' };
function isCurrentMonth(value:string){const d=new Date(value),n=new Date();return d.getFullYear()===n.getFullYear()&&d.getMonth()===n.getMonth();}
function slugify(value:string){return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');}

export function FinancialHubPage(){
  const { user, mode }=useAuth();
  const { finance,installments,orders,company,companyId,loading,error,addFinancialEntry,createPaymentPlan,settleInstallment }=usePrimeTech();
  const [searchParams]=useSearchParams();
  const [view,setView]=useState<View>('overview');
  const [showEntryForm,setShowEntryForm,clearShowEntry]=useSessionDraft('finance-entry-open',false);
  const [showPlanForm,setShowPlanForm,clearShowPlan]=useSessionDraft('finance-plan-open',false);
  const [entryForm,setEntryForm,clearEntry]=useSessionDraft<EntryForm>('finance-entry-form',initialEntry);
  const [planForm,setPlanForm,clearPlan]=useSessionDraft<PlanForm>('finance-plan-form',initialPlan);
  const [categories,setCategories]=useState<CategoryRow[]>([]);
  const [accounts,setAccounts]=useState<AccountRow[]>([]);
  const [quickTarget,setQuickTarget]=useState<QuickTarget>(null);
  const [newCategory,setNewCategory]=useState({name:'',dreGroup:'gross_revenue' as DreGroup});
  const [newAccount,setNewAccount]=useState({name:'',accountType:'cash'});
  const [saving,setSaving]=useState(false); const [localError,setLocalError]=useState(''); const [search,setSearch]=useState(()=>searchParams.get('busca')??''); const [printOpen,setPrintOpen]=useState(false);

  useEffect(()=>{
    const term=searchParams.get('busca')??'';
    setSearch(term);
    if(term)setView('realized');
  },[searchParams]);

  const loadCatalog=useCallback(async()=>{
    if(mode!=='supabase'||!supabase||!companyId){setCategories([]);setAccounts([]);return;}
    const [categoryResult,accountResult]=await Promise.all([
      supabase.from('financial_categories').select('id,code,name,direction,dre_group,sort_order,active').eq('company_id',companyId).eq('active',true).order('sort_order').order('name'),
      supabase.from('financial_accounts').select('id,name,account_type,active').eq('company_id',companyId).eq('active',true).order('name'),
    ]);
    if(categoryResult.error)console.warn('Catálogo financeiro indisponível:',categoryResult.error.message); else setCategories((categoryResult.data??[]) as CategoryRow[]);
    if(accountResult.error)console.warn('Contas financeiras indisponíveis:',accountResult.error.message); else setAccounts((accountResult.data??[]) as AccountRow[]);
  },[companyId,mode]);

  useEffect(()=>{void loadCatalog();},[loadCatalog]);

  const categoryOptions=useCallback((type:Direction)=>{
    const database=categories.filter((item)=>item.active&&(item.direction===type||item.direction==='both'));
    if(database.length)return database;
    return categoriesFor(type).map((item)=>({id:'',code:item.code,name:item.label,direction:type,dre_group:item.dreGroup,sort_order:item.order,active:true} as CategoryRow));
  },[categories]);

  useEffect(()=>{
    if(accounts.length){
      if(!entryForm.accountId)setEntryForm((v)=>({...v,accountId:accounts[0]?.id??''}));
      if(!planForm.accountId)setPlanForm((v)=>({...v,accountId:accounts[0]?.id??''}));
    }
  },[accounts,entryForm.accountId,planForm.accountId,setEntryForm,setPlanForm]);

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

  function setEntryType(type:Direction){const first=categoryOptions(type)[0];setEntryForm((v)=>({...v,type,category:first?.name??'',categoryId:first?.id??''}));}
  function setPlanType(type:Direction){const first=categoryOptions(type)[0];setPlanForm((v)=>({...v,type,category:first?.name??'',categoryId:first?.id??''}));}
  function closeEntry(discard=true){setShowEntryForm(false);clearShowEntry();setQuickTarget(null);if(discard)clearEntry();}
  function closePlan(discard=true){setShowPlanForm(false);clearShowPlan();setQuickTarget(null);if(discard)clearPlan();}

  function selectCategory(target:'entry'|'plan',categoryId:string){
    const type=target==='entry'?entryForm.type:planForm.type;
    const option=categoryOptions(type).find((item)=>item.id===categoryId)||categoryOptions(type).find((item)=>item.name===categoryId);
    if(target==='entry')setEntryForm((v)=>({...v,categoryId:option?.id??'',category:option?.name??categoryId}));
    else setPlanForm((v)=>({...v,categoryId:option?.id??'',category:option?.name??categoryId}));
  }

  async function createCategory(){
    if(!supabase||!companyId||mode!=='supabase')return setLocalError('Cadastro rápido de categoria exige Supabase.');
    const target=quickTarget;
    if(target!=='entry-category'&&target!=='plan-category')return;
    const type=target==='entry-category'?entryForm.type:planForm.type;
    const name=newCategory.name.trim();
    if(!name)return setLocalError('Informe o nome da categoria.');
    const existing=categories.find((item)=>item.name.toLowerCase()===name.toLowerCase()&&(item.direction===type||item.direction==='both'));
    if(existing){selectCategory(target==='entry-category'?'entry':'plan',existing.id);setQuickTarget(null);return;}
    setSaving(true);setLocalError('');
    try{
      const code=slugify(name)||`categoria_${Date.now()}`;
      const {data,error:insertError}=await supabase.from('financial_categories').insert({company_id:companyId,code,name,direction:type,dre_group:newCategory.dreGroup,sort_order:900,active:true}).select('id,code,name,direction,dre_group,sort_order,active').single();
      if(insertError)throw insertError;
      const created=data as CategoryRow;
      setCategories((current)=>[...current,created].sort((a,b)=>a.sort_order-b.sort_order||a.name.localeCompare(b.name)));
      selectCategory(target==='entry-category'?'entry':'plan',created.id);
      if(target==='entry-category')setEntryForm((v)=>({...v,categoryId:created.id,category:created.name})); else setPlanForm((v)=>({...v,categoryId:created.id,category:created.name}));
      setNewCategory({name:'',dreGroup:type==='income'?'gross_revenue':'operating_expense'});
      setQuickTarget(null);
    }catch(cause){setLocalError(cause instanceof Error?cause.message:'Não foi possível criar a categoria.');}
    finally{setSaving(false);}
  }

  async function createAccount(){
    if(!supabase||!companyId||mode!=='supabase')return setLocalError('Cadastro rápido de conta exige Supabase.');
    const target=quickTarget;
    if(target!=='entry-account'&&target!=='plan-account')return;
    const name=newAccount.name.trim();
    if(!name)return setLocalError('Informe o nome da conta.');
    const existing=accounts.find((item)=>item.name.toLowerCase()===name.toLowerCase());
    if(existing){if(target==='entry-account')setEntryForm((v)=>({...v,accountId:existing.id}));else setPlanForm((v)=>({...v,accountId:existing.id}));setQuickTarget(null);return;}
    setSaving(true);setLocalError('');
    try{
      const {data,error:insertError}=await supabase.from('financial_accounts').insert({company_id:companyId,name,account_type:newAccount.accountType,opening_balance:0,active:true}).select('id,name,account_type,active').single();
      if(insertError)throw insertError;
      const created=data as AccountRow;
      setAccounts((current)=>[...current,created].sort((a,b)=>a.name.localeCompare(b.name)));
      if(target==='entry-account')setEntryForm((v)=>({...v,accountId:created.id}));else setPlanForm((v)=>({...v,accountId:created.id}));
      setNewAccount({name:'',accountType:'cash'});setQuickTarget(null);
    }catch(cause){setLocalError(cause instanceof Error?cause.message:'Não foi possível criar a conta.');}
    finally{setSaving(false);}
  }

  async function submitEntry(event:FormEvent){event.preventDefault();const amount=Number(entryForm.amount.replace(',','.'));if(!entryForm.description.trim()||!entryForm.category)return setLocalError('Informe categoria e descrição do lançamento.');if(!Number.isFinite(amount)||amount<=0)return setLocalError('Informe um valor positivo.');setSaving(true);setLocalError('');try{await addFinancialEntry({type:entryForm.type,category:entryForm.category,category_id:entryForm.categoryId||null,account_id:entryForm.accountId||null,description:entryForm.description.trim(),amount,occurred_at:new Date(`${entryForm.occurredAt}T12:00:00`).toISOString(),competence_date:entryForm.occurredAt,payment_method:entryForm.method});clearEntry();clearShowEntry();setShowEntryForm(false);}catch(cause){setLocalError(cause instanceof Error?cause.message:'Não foi possível registrar o lançamento.');}finally{setSaving(false);}}
  async function submitPlan(event:FormEvent){event.preventDefault();const amount=Number(planForm.amount.replace(',','.'));const count=Number.parseInt(planForm.count,10);if(!planForm.description.trim()||!planForm.category)return setLocalError('Informe categoria e descrição da conta.');if(!Number.isFinite(amount)||amount<=0)return setLocalError('Informe um valor positivo.');if(!Number.isFinite(count)||count<1||count>36)return setLocalError('Informe entre 1 e 36 parcelas.');if(!planForm.firstDue)return setLocalError('Informe o primeiro vencimento.');setSaving(true);setLocalError('');try{await createPaymentPlan({request_id:crypto.randomUUID(),order_id:planForm.orderId||null,type:planForm.type,category:planForm.category,category_id:planForm.categoryId||null,account_id:planForm.accountId||null,description:planForm.description.trim(),amount,count,first_due:planForm.firstDue,method:planForm.method,paid:false});clearPlan();clearShowPlan();setShowPlanForm(false);}catch(cause){const message=cause instanceof Error?cause.message:'Não foi possível criar a conta.';setLocalError(message.includes('p_category_id')||message.includes('function')?'Execute a migration 0016 para habilitar categorias/contas nos parcelamentos.':message);}finally{setSaving(false);}}
  async function settle(id:string){setSaving(true);setLocalError('');try{await settleInstallment(id);}catch(cause){setLocalError(cause instanceof Error?cause.message:'Não foi possível baixar a parcela.');}finally{setSaving(false);}}
  if(loading)return <div className="empty-state"><WalletCards size={38}/><h3>Carregando Financeiro</h3><p>Consolidando caixa, contas a receber e contas a pagar.</p></div>;

  const canManage=can(user,'finance.manage');
  const renderCategory=(target:'entry'|'plan')=>{
    const form=target==='entry'?entryForm:planForm;const options=categoryOptions(form.type);const selectValue=form.categoryId||(options.some((item)=>item.name===form.category)?form.category:'');
    return <div className="select-with-action"><select value={selectValue} onChange={(e)=>selectCategory(target,e.target.value)}>{options.map((c)=><option key={c.id||c.code} value={c.id||c.name}>{c.name}</option>)}</select>{canManage&&<button type="button" className="select-add-button" title="Criar categoria financeira sem sair desta tela" onClick={()=>{setNewCategory({name:'',dreGroup:form.type==='income'?'gross_revenue':'operating_expense'});setQuickTarget(`${target}-category` as QuickTarget);}}><Plus size={17}/></button>}</div>;
  };
  const renderAccount=(target:'entry'|'plan')=>{const value=target==='entry'?entryForm.accountId:planForm.accountId;return <div className="select-with-action"><select value={value} onChange={(e)=>target==='entry'?setEntryForm((v)=>({...v,accountId:e.target.value})):setPlanForm((v)=>({...v,accountId:e.target.value}))}><option value="">Sem conta definida</option>{accounts.map((a)=><option key={a.id} value={a.id}>{a.name}</option>)}</select>{canManage&&<button type="button" className="select-add-button" title="Criar conta financeira sem sair desta tela" onClick={()=>{setNewAccount({name:'',accountType:'cash'});setQuickTarget(`${target}-account` as QuickTarget);}}><Plus size={17}/></button>}</div>};

  return <>
    <PageHeader eyebrow="Financeiro" title="Gestão financeira" description="Entradas, saídas, contas a receber/pagar, baixas e DRE. Categorias e contas podem ser criadas pelo + sem abandonar o lançamento." actions={<div className="quick-actions"><Link to="/financeiro/dre" className="ghost-button"><FileText size={16}/>DRE</Link><button type="button" className="ghost-button" onClick={()=>setPrintOpen(true)}><Printer size={16}/>Relatório</button><button type="button" className="ghost-button" onClick={()=>{setShowPlanForm((v)=>!v);setShowEntryForm(false);}}><ListPlus size={16}/>{showPlanForm?'Fechar conta':'Nova conta'}</button><button type="button" className="primary-button" onClick={()=>{setShowEntryForm((v)=>!v);setShowPlanForm(false);}}>{showEntryForm?<X size={16}/>:<PlusCircle size={16}/>} {showEntryForm?'Fechar':'Novo lançamento'}</button></div>} />
    {(error||localError)&&<section className="notice" style={{marginBottom:16}}><AlertTriangle size={20}/><div><strong>Não foi possível concluir a operação</strong><p>{localError||error}</p></div></section>}

    {(quickTarget==='entry-category'||quickTarget==='plan-category')&&<section className="panel inline-create-card" style={{marginBottom:16}}><div className="panel-head"><div><span className="eyebrow">Cadastro rápido</span><h2>Nova categoria financeira</h2></div><button type="button" className="ghost-button" onClick={()=>setQuickTarget(null)}><X size={15}/>Fechar</button></div><div className="form-grid"><label><span>Nome</span><input value={newCategory.name} onChange={(e)=>setNewCategory((v)=>({...v,name:e.target.value}))} placeholder="Ex.: Material de escritório"/></label><label><span>Grupo no DRE</span><select value={newCategory.dreGroup} onChange={(e)=>setNewCategory((v)=>({...v,dreGroup:e.target.value as DreGroup}))}>{Object.entries(dreGroupLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label></div><div className="quick-actions" style={{marginTop:12}}><button type="button" disabled={saving||!newCategory.name.trim()} onClick={()=>void createCategory()}><Plus size={15}/>Criar e selecionar</button></div></section>}

    {(quickTarget==='entry-account'||quickTarget==='plan-account')&&<section className="panel inline-create-card" style={{marginBottom:16}}><div className="panel-head"><div><span className="eyebrow">Cadastro rápido</span><h2>Nova conta financeira</h2></div><button type="button" className="ghost-button" onClick={()=>setQuickTarget(null)}><X size={15}/>Fechar</button></div><div className="form-grid"><label><span>Nome</span><input value={newAccount.name} onChange={(e)=>setNewAccount((v)=>({...v,name:e.target.value}))} placeholder="Ex.: Banco do Brasil"/></label><label><span>Tipo</span><select value={newAccount.accountType} onChange={(e)=>setNewAccount((v)=>({...v,accountType:e.target.value}))}><option value="cash">Caixa</option><option value="checking">Conta corrente</option><option value="savings">Poupança</option><option value="digital">Conta digital</option><option value="other">Outra</option></select></label></div><div className="quick-actions" style={{marginTop:12}}><button type="button" disabled={saving||!newAccount.name.trim()} onClick={()=>void createAccount()}><Plus size={15}/>Criar e selecionar</button></div></section>}

    {showPlanForm&&<section className="panel" style={{marginBottom:20}}><div className="panel-head"><div><span className="eyebrow">Contas</span><h2>Nova conta / parcelamento</h2></div></div><form onSubmit={(e)=>void submitPlan(e)} style={{display:'grid',gap:12}}><div className="form-grid">
      <label><span>Tipo</span><select value={planForm.type} onChange={(e)=>setPlanType(e.target.value as Direction)}><option value="income">Conta a receber</option><option value="expense">Conta a pagar</option></select></label>
      <label><span>OS vinculada (opcional)</span><select value={planForm.orderId} onChange={(e)=>setPlanForm((v)=>({...v,orderId:e.target.value}))}><option value="">Sem OS</option>{eligibleOrders.map((o)=><option key={o.id} value={o.id}>{orderCode(o.order_number)} · {o.client_name??'Cliente'}</option>)}</select></label>
      <label><span>Categoria</span>{renderCategory('plan')}</label>
      <label><span>Conta financeira</span>{renderAccount('plan')}</label>
      <label><span>Descrição</span><input value={planForm.description} onChange={(e)=>setPlanForm((v)=>({...v,description:e.target.value}))}/></label>
      <label><span>Valor total</span><input type="number" min="0.01" step="0.01" value={planForm.amount} onChange={(e)=>setPlanForm((v)=>({...v,amount:e.target.value}))}/></label>
      <label><span>Parcelas</span><input type="number" min="1" max="36" value={planForm.count} onChange={(e)=>setPlanForm((v)=>({...v,count:e.target.value}))}/></label>
      <label><span>Primeiro vencimento</span><input type="date" value={planForm.firstDue} onChange={(e)=>setPlanForm((v)=>({...v,firstDue:e.target.value}))}/></label>
      <label><span>Forma de pagamento</span><select value={planForm.method} onChange={(e)=>setPlanForm((v)=>({...v,method:e.target.value}))}>{Object.entries(paymentMethods).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
    </div><div className="quick-actions"><button type="submit" disabled={saving}><ListPlus size={16}/>{saving?'Criando...':'Criar conta'}</button><button type="button" className="ghost-button" onClick={()=>closePlan(true)}>Cancelar e descartar</button></div></form></section>}

    {showEntryForm&&<section className="panel" style={{marginBottom:20}}><div className="panel-head"><div><span className="eyebrow">Realizado</span><h2>Novo lançamento financeiro</h2></div></div><form onSubmit={(e)=>void submitEntry(e)} style={{display:'grid',gap:12}}><div className="form-grid">
      <label><span>Tipo</span><select value={entryForm.type} onChange={(e)=>setEntryType(e.target.value as Direction)}><option value="income">Entrada</option><option value="expense">Saída</option></select></label>
      <label><span>Categoria</span>{renderCategory('entry')}</label>
      <label><span>Conta financeira</span>{renderAccount('entry')}</label>
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
