import {
  AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Boxes, CheckCircle2, ClipboardCheck, Edit3,
  PackageCheck, PackageMinus, PackagePlus, RefreshCw, Save, Search, SlidersHorizontal, X,
} from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { MetricCard } from '../components/ui/MetricCard';
import { PageHeader } from '../components/ui/PageHeader';
import { useAuth } from '../contexts/AuthContext';
import { usePrimeTech } from '../contexts/PrimeTechContext';
import { useSessionDraft } from '../hooks/useSessionDraft';
import { money, orderCode } from '../lib/formatters';
import { can } from '../lib/permissions';
import { supabase } from '../lib/supabase';
import type { StockItem } from '../types/domain';

type MovementType='reserve'|'release'|'consume'|'adjust';
const movementLabels:Record<MovementType,string>={reserve:'Reservar para OS',release:'Liberar reserva',consume:'Consumir na OS',adjust:'Ajustar saldo'};
const emptyForm={sku:'',name:'',physical:'0',minimum:'0',cost:'0',sale:'0'};
const emptyMovement={quantity:'1',orderId:'',notes:''};
type EditForm={id:string;sku:string;name:string;minimum:string;cost:string;sale:string;active:boolean};

export function StockPage(){
  const {user,mode}=useAuth();
  const {stock,orders,loading,error,addStockItem,refresh}=usePrimeTech();
  const [searchParams]=useSearchParams();
  const [showForm,setShowForm,clearShowForm]=useSessionDraft('stock-form-open',false);
  const [form,setForm,clearForm]=useSessionDraft('stock-new-item',emptyForm);
  const [selectedItemId,setSelectedItemId,clearSelected]=useSessionDraft<string|null>('stock-movement-item',null);
  const [movementType,setMovementType]=useSessionDraft<MovementType>('stock-movement-type','reserve');
  const [movementForm,setMovementForm,clearMovement]=useSessionDraft('stock-movement-form',emptyMovement);
  const [editForm,setEditForm]=useState<EditForm|null>(null);
  const [saving,setSaving]=useState(false);
  const [localError,setLocalError]=useState('');
  const [search,setSearch]=useState(()=>searchParams.get('busca')??'');
  const selectedItem=stock.find((item)=>item.id===selectedItemId)??null;

  useEffect(()=>{setSearch(searchParams.get('busca')??'');},[searchParams]);

  const totals=useMemo(()=>stock.reduce((acc,item)=>{const physical=Number(item.physical??item.quantity??0);const reserved=Number(item.reserved??item.reserved_quantity??0);const minimum=Number(item.minimum??item.minimum_quantity??0);acc.physical+=physical;acc.reserved+=reserved;acc.available+=Math.max(physical-reserved,0);acc.value+=physical*Number(item.cost_price??0);if(physical-reserved<=minimum)acc.critical+=1;return acc;},{physical:0,reserved:0,available:0,critical:0,value:0}),[stock]);
  const visibleStock=useMemo(()=>{const value=search.trim().toLowerCase();if(!value)return stock;return stock.filter((item)=>item.name.toLowerCase().includes(value)||item.sku.toLowerCase().includes(value));},[search,stock]);
  const activeOrders=useMemo(()=>orders.filter((order)=>!['delivered','cancelled'].includes(order.status)),[orders]);
  const canReserve=can(user,'stock.reserve');
  const canConsume=can(user,'stock.consume');
  const canAdjust=can(user,'stock.adjust');
  const canMove=canReserve||canConsume||canAdjust;

  function resetForm(){clearForm();setLocalError('');}
  function closeNew(){resetForm();clearShowForm();setShowForm(false);}
  function openMovement(item:StockItem,type:MovementType){setEditForm(null);setSelectedItemId(item.id);setMovementType(type);setMovementForm(emptyMovement);setLocalError('');}
  function closeMovement(){clearSelected();clearMovement();setSelectedItemId(null);setLocalError('');}
  function openEdit(item:StockItem){closeMovement();setEditForm({id:item.id,sku:item.sku,name:item.name,minimum:String(Number(item.minimum??item.minimum_quantity??0)),cost:String(Number(item.cost_price??0)),sale:String(Number(item.sale_price??0)),active:item.active!==false});setLocalError('');}

  async function submit(event:FormEvent){
    event.preventDefault();
    if(!canAdjust)return setLocalError('Seu perfil não pode cadastrar itens de estoque.');
    const physical=Number(form.physical.replace(',','.'));const minimum=Number(form.minimum.replace(',','.'));const cost=Number(form.cost.replace(',','.'));const sale=Number(form.sale.replace(',','.'));
    if(!form.sku.trim()||!form.name.trim())return setLocalError('Informe SKU e nome do item.');
    if(![physical,minimum,cost,sale].every(Number.isFinite)||physical<0||minimum<0||cost<0||sale<0)return setLocalError('Quantidades e valores devem ser válidos e não negativos.');
    setSaving(true);setLocalError('');
    try{await addStockItem({sku:form.sku.trim(),name:form.name.trim(),quantity:physical,reserved_quantity:0,minimum_quantity:minimum,physical,reserved:0,minimum,cost_price:cost,sale_price:sale,active:true});closeNew();}
    catch(cause){setLocalError(cause instanceof Error?cause.message:'Não foi possível cadastrar o item.');}
    finally{setSaving(false);}
  }

  async function saveEdit(event:FormEvent){
    event.preventDefault();
    if(!editForm||!canAdjust)return;
    if(mode!=='supabase'||!supabase)return setLocalError('A edição do cadastro exige Supabase.');
    const minimum=Number(editForm.minimum.replace(',','.'));const cost=Number(editForm.cost.replace(',','.'));const sale=Number(editForm.sale.replace(',','.'));
    if(!editForm.sku.trim()||!editForm.name.trim())return setLocalError('Informe SKU e descrição.');
    if(![minimum,cost,sale].every(Number.isFinite)||minimum<0||cost<0||sale<0)return setLocalError('Mínimo, custo e venda precisam ser valores não negativos.');
    setSaving(true);setLocalError('');
    try{
      const {error:updateError}=await supabase.from('stock_items').update({sku:editForm.sku.trim(),name:editForm.name.trim(),minimum_quantity:minimum,cost_price:cost,sale_price:sale,active:editForm.active}).eq('id',editForm.id);
      if(updateError){if(updateError.code==='23505')throw new Error('Já existe outro item com este SKU.');throw updateError;}
      await refresh();setEditForm(null);
    }catch(cause){setLocalError(cause instanceof Error?cause.message:'Não foi possível editar o item.');}
    finally{setSaving(false);}
  }

  async function submitMovement(event:FormEvent){
    event.preventDefault();if(!selectedItem)return;
    const quantity=Number(movementForm.quantity.replace(',','.'));
    if(!Number.isFinite(quantity)||quantity===0)return setLocalError('Informe uma quantidade válida e diferente de zero.');
    if(movementType!=='adjust'&&quantity<0)return setLocalError('A quantidade deve ser maior que zero.');
    if(movementType==='reserve'&&!canReserve)return setLocalError('Seu perfil não pode reservar estoque.');
    if((movementType==='consume'||movementType==='release')&&!canConsume&&!canReserve)return setLocalError('Seu perfil não pode consumir ou liberar reservas.');
    if(movementType==='adjust'&&!canAdjust)return setLocalError('Seu perfil não pode ajustar estoque.');
    if(mode!=='supabase'||!supabase)return setLocalError('Movimentações transacionais exigem Supabase.');
    setSaving(true);setLocalError('');
    const common={p_stock_item_id:selectedItem.id,p_quantity:Math.abs(quantity),p_service_order_id:movementForm.orderId||null,p_notes:movementForm.notes.trim()||null,p_idempotency_key:crypto.randomUUID()};
    try{
      if(movementType==='reserve'){const{error:e}=await supabase.rpc('reserve_stock',common);if(e)throw e;}
      else if(movementType==='release'){const{error:e}=await supabase.rpc('release_stock_reservation',common);if(e)throw e;}
      else if(movementType==='consume'){const{error:e}=await supabase.rpc('consume_stock',common);if(e)throw e;}
      else{const{error:e}=await supabase.rpc('adjust_stock',{p_stock_item_id:selectedItem.id,p_delta:quantity,p_notes:movementForm.notes.trim()||null,p_idempotency_key:crypto.randomUUID()});if(e)throw e;}
      await refresh();closeMovement();
    }catch(cause){setLocalError(cause instanceof Error?cause.message:'Não foi possível registrar a movimentação.');}
    finally{setSaving(false);}
  }

  if(loading)return <div className="empty-state"><RefreshCw size={38}/><h3>Carregando estoque</h3><p>Conferindo peças e materiais.</p></div>;

  return <>
    <PageHeader eyebrow="Estoque" title="Peças e materiais" description="Cadastros podem ser editados; saldo físico continua protegido pelo histórico de movimentações para não quebrar a rastreabilidade." actions={canAdjust?<button className="primary-button" type="button" onClick={()=>setShowForm((v)=>!v)}>{showForm?<X/>:<PackagePlus/>}{showForm?'Fechar':'Novo item'}</button>:undefined}/>
    {(error||localError)&&<section className="notice" style={{marginBottom:16}}><AlertTriangle size={20}/><div><strong>Não foi possível concluir a operação</strong><p>{localError||error}</p></div></section>}

    {showForm&&canAdjust&&<section className="panel" style={{marginBottom:20}}><div className="panel-head"><div><span className="eyebrow">Cadastro</span><h2>Novo item de estoque</h2></div></div><form onSubmit={(e)=>void submit(e)} style={{display:'grid',gap:12}}><div className="form-grid"><label><span>SKU</span><input value={form.sku} onChange={(e)=>setForm((v)=>({...v,sku:e.target.value}))}/></label><label><span>Descrição</span><input value={form.name} onChange={(e)=>setForm((v)=>({...v,name:e.target.value}))}/></label><label><span>Quantidade inicial</span><input type="number" min="0" step="0.01" value={form.physical} onChange={(e)=>setForm((v)=>({...v,physical:e.target.value}))}/></label><label><span>Estoque mínimo</span><input type="number" min="0" step="0.01" value={form.minimum} onChange={(e)=>setForm((v)=>({...v,minimum:e.target.value}))}/></label><label><span>Custo unitário</span><input type="number" min="0" step="0.01" value={form.cost} onChange={(e)=>setForm((v)=>({...v,cost:e.target.value}))}/></label><label><span>Preço de venda</span><input type="number" min="0" step="0.01" value={form.sale} onChange={(e)=>setForm((v)=>({...v,sale:e.target.value}))}/></label></div><div className="quick-actions"><button type="submit" disabled={saving}><PackagePlus size={16}/>{saving?'Salvando...':'Cadastrar item'}</button><button type="button" className="ghost-button" onClick={closeNew}>Cancelar e descartar</button></div></form></section>}

    {editForm&&canAdjust&&<section className="panel" style={{marginBottom:20}}><div className="panel-head"><div><span className="eyebrow">Editar cadastro</span><h2>{editForm.name}</h2><p className="muted">Para alterar o saldo físico use Ajustar saldo; a edição abaixo não reescreve o histórico.</p></div><button type="button" className="ghost-button" onClick={()=>setEditForm(null)}><X size={16}/>Fechar</button></div><form onSubmit={(e)=>void saveEdit(e)} style={{display:'grid',gap:12}}><div className="form-grid"><label><span>SKU</span><input value={editForm.sku} onChange={(e)=>setEditForm((v)=>v?{...v,sku:e.target.value}:v)}/></label><label><span>Descrição</span><input value={editForm.name} onChange={(e)=>setEditForm((v)=>v?{...v,name:e.target.value}:v)}/></label><label><span>Estoque mínimo</span><input type="number" min="0" step="0.01" value={editForm.minimum} onChange={(e)=>setEditForm((v)=>v?{...v,minimum:e.target.value}:v)}/></label><label><span>Custo unitário</span><input type="number" min="0" step="0.01" value={editForm.cost} onChange={(e)=>setEditForm((v)=>v?{...v,cost:e.target.value}:v)}/></label><label><span>Preço de venda</span><input type="number" min="0" step="0.01" value={editForm.sale} onChange={(e)=>setEditForm((v)=>v?{...v,sale:e.target.value}:v)}/></label><label className="ghost-button" style={{alignSelf:'end',justifyContent:'flex-start'}}><input type="checkbox" checked={editForm.active} onChange={(e)=>setEditForm((v)=>v?{...v,active:e.target.checked}:v)}/> Item ativo</label></div><div className="quick-actions"><button type="submit" className="primary-button" disabled={saving}><Save size={16}/>{saving?'Salvando...':'Salvar alterações'}</button></div></form></section>}

    {selectedItem&&canMove&&<section className="panel" style={{marginBottom:20}}><div className="panel-head"><div><span className="eyebrow">Movimentação</span><h2>{selectedItem.name}</h2><p className="muted">Físico {selectedItem.physical} · Reservado {selectedItem.reserved} · Disponível {Math.max(selectedItem.physical-selectedItem.reserved,0)}</p></div><button type="button" className="ghost-button" onClick={closeMovement}><X size={16}/>Fechar</button></div><form onSubmit={(e)=>void submitMovement(e)} style={{display:'grid',gap:12}}><div className="form-grid"><label><span>Tipo</span><select value={movementType} onChange={(e)=>setMovementType(e.target.value as MovementType)}>{canReserve&&<option value="reserve">Reservar para OS</option>}{(canReserve||canConsume)&&<option value="release">Liberar reserva</option>}{canConsume&&<option value="consume">Consumir na OS</option>}{canAdjust&&<option value="adjust">Ajustar saldo</option>}</select></label><label><span>{movementType==='adjust'?'Ajuste (+ entrada / - saída)':'Quantidade'}</span><input type="number" step="0.01" value={movementForm.quantity} onChange={(e)=>setMovementForm((v)=>({...v,quantity:e.target.value}))}/></label>{movementType!=='adjust'&&<label><span>OS vinculada (opcional)</span><select value={movementForm.orderId} onChange={(e)=>setMovementForm((v)=>({...v,orderId:e.target.value}))}><option value="">Sem OS</option>{activeOrders.map((o)=><option key={o.id} value={o.id}>{orderCode(o.order_number)} · {o.client_name??'Cliente'}</option>)}</select></label>}<label><span>Observação</span><input value={movementForm.notes} onChange={(e)=>setMovementForm((v)=>({...v,notes:e.target.value}))}/></label></div><div className="quick-actions"><button type="submit" disabled={saving}><ClipboardCheck size={16}/>{saving?'Registrando...':movementLabels[movementType]}</button><button type="button" className="ghost-button" onClick={closeMovement}>Cancelar</button></div></form></section>}

    <div className="metrics-grid"><MetricCard label="Itens cadastrados" value={stock.length} icon={Boxes}/><MetricCard label="Unidades reservadas" value={totals.reserved} icon={PackageCheck} tone="violet"/><MetricCard label="Estoque crítico" value={totals.critical} icon={AlertTriangle} tone="amber"/><MetricCard label="Valor em estoque" value={money.format(totals.value)} icon={CheckCircle2} tone="green"/></div>
    <section className="panel"><div className="panel-head"><div><span className="eyebrow">Posição</span><h2>Saldo por item</h2></div><div className="filter-search"><Search size={16}/><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Buscar SKU ou item..."/></div></div>{visibleStock.length===0?<div className="empty-state"><Boxes size={38}/><h3>{stock.length?'Nenhum item encontrado':'Estoque vazio'}</h3></div>:<div className="table-wrap"><table><thead><tr><th>SKU / item</th><th>Físico</th><th>Reservado</th><th>Disponível</th><th>Mínimo</th><th>Custo</th><th>Venda</th><th>Situação</th>{canMove&&<th>Ações</th>}</tr></thead><tbody>{visibleStock.map((item)=>{const physical=Number(item.physical??item.quantity??0);const reserved=Number(item.reserved??item.reserved_quantity??0);const minimum=Number(item.minimum??item.minimum_quantity??0);const available=physical-reserved;const critical=available<=minimum;return <tr key={item.id}><td><strong>{item.name}</strong><small>{item.sku}</small></td><td>{physical}</td><td>{reserved}</td><td><strong>{available}</strong></td><td>{minimum}</td><td>{money.format(Number(item.cost_price??0))}</td><td>{money.format(Number(item.sale_price??0))}</td><td><span className={`stock-state ${critical?'critical':'ok'}`}>{critical?'Repor estoque':'Normal'}</span></td>{canMove&&<td><div className="quick-actions">{canAdjust&&<button type="button" title="Editar cadastro" onClick={()=>openEdit(item)}><Edit3 size={15}/></button>}{canReserve&&available>0&&<button type="button" title="Reservar" onClick={()=>openMovement(item,'reserve')}><ArrowDownToLine size={15}/></button>}{canConsume&&physical>0&&<button type="button" title="Consumir" onClick={()=>openMovement(item,'consume')}><PackageMinus size={15}/></button>}{(canReserve||canConsume)&&reserved>0&&<button type="button" title="Liberar" onClick={()=>openMovement(item,'release')}><ArrowUpFromLine size={15}/></button>}{canAdjust&&<button type="button" title="Ajustar saldo" onClick={()=>openMovement(item,'adjust')}><SlidersHorizontal size={15}/></button>}</div></td>}</tr>;})}</tbody></table></div>}</section>
  </>;
}
