import {
  AlertTriangle, Camera, CheckCircle2, ClipboardList, Clock3, FileText, Image as ImageIcon,
  PackageCheck, PackageSearch, PauseCircle, PlayCircle, RefreshCw, RotateCcw, Send, UploadCloud, Wrench,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { PageHeader } from '../components/ui/PageHeader';
import { StatusBadge } from '../components/ui/StatusBadge';
import { useAuth } from '../contexts/AuthContext';
import { usePrimeTech } from '../contexts/PrimeTechContext';
import { useSessionDraft } from '../hooks/useSessionDraft';
import { orderCode } from '../lib/formatters';
import { supabase } from '../lib/supabase';
import type { PauseReason, ServiceOrder, TechnicalStatus } from '../types/domain';

type ActionMode='diagnosis'|'pause'|'update'|'photo'|null;
type TechDraft={actionMode:ActionMode;selectedId:string|null;diagnosis:string;estimatedDays:string;note:string;pauseReason:PauseReason};
type Attachment={id:string;file_name:string;storage_path:string;note?:string|null;created_at:string;url?:string};
const initialDraft:TechDraft={actionMode:null,selectedId:null,diagnosis:'',estimatedDays:'1',note:'',pauseReason:'waiting_part'};
const technicalLabels:Record<TechnicalStatus,string>={not_started:'Não iniciado',waiting_start:'Aguardando início',in_progress:'Em manutenção',paused:'Pausado',waiting_part:'Aguardando peça',quality_check:'Testes / qualidade',completed:'Concluído'};
const pauseLabels:Record<PauseReason,string>={waiting_part:'Aguardando peça',waiting_customer:'Aguardando cliente',waiting_supplier:'Aguardando fornecedor',additional_approval:'Aguardando aprovação adicional',third_party:'Serviço de terceiro',observation:'Observação / testes',technical_issue:'Problema técnico adicional',other:'Outro motivo'};
function isToday(value?:string|null){if(!value)return false;const d=new Date(value),t=new Date();return d.getFullYear()===t.getFullYear()&&d.getMonth()===t.getMonth()&&d.getDate()===t.getDate();}
function technicalStatus(order:ServiceOrder):TechnicalStatus{return order.technical_status??'not_started';}

export function TechnicianPage(){
  const {user,mode}=useAuth();
  const {orders,companyId,loading,error,updateTechnical,updateTechnicalStatus}=usePrimeTech();
  const [searchParams]=useSearchParams();
  const focusedOrderId=searchParams.get('os');
  const [draft,setDraft,clearDraft]=useSessionDraft<TechDraft>('technician-action',initialDraft);
  const [saving,setSaving]=useState(false);
  const [localError,setLocalError]=useState('');
  const [attachments,setAttachments]=useState<Attachment[]>([]);
  const [photoFile,setPhotoFile]=useState<File|null>(null);

  const visibleOrders=useMemo(()=>{
    const active=orders.filter((order)=>!['delivered','cancelled'].includes(order.status));
    if(!user)return[];
    if(user.role_code==='admin'||user.role_code==='gestor')return active;
    return active.filter((order)=>!order.assigned_technician_id||order.assigned_technician_id===user.id);
  },[orders,user]);

  const selectedOrder=visibleOrders.find((order)=>order.id===draft.selectedId)??null;
  const inProgress=visibleOrders.filter((order)=>technicalStatus(order)==='in_progress'||order.status==='diagnosis'||order.status==='in_repair').length;
  const paused=visibleOrders.filter((order)=>technicalStatus(order)==='paused'||order.status==='waiting_part').length;
  const completedToday=visibleOrders.filter((order)=>isToday(order.technical_completed_at)).length;

  useEffect(()=>{
    if(!focusedOrderId||!visibleOrders.some((order)=>order.id===focusedOrderId))return;
    const timer=window.setTimeout(()=>{
      document.getElementById(`technician-order-${focusedOrderId}`)?.scrollIntoView({behavior:'smooth',block:'center'});
    },80);
    return()=>window.clearTimeout(timer);
  },[focusedOrderId,visibleOrders]);

  function closeAction(){clearDraft();setPhotoFile(null);setAttachments([]);setLocalError('');}
  function openDiagnosis(order:ServiceOrder){setDraft({actionMode:'diagnosis',selectedId:order.id,diagnosis:order.diagnosis??'',estimatedDays:String(order.estimated_days??1),note:'',pauseReason:'waiting_part'});setLocalError('');}
  function openPause(order:ServiceOrder){setDraft({actionMode:'pause',selectedId:order.id,diagnosis:'',estimatedDays:String(order.estimated_days??1),note:'',pauseReason:order.pause_reason??'waiting_part'});setLocalError('');}
  function openUpdate(order:ServiceOrder){setDraft({actionMode:'update',selectedId:order.id,diagnosis:'',estimatedDays:String(order.estimated_days??1),note:'',pauseReason:order.pause_reason??'waiting_part'});setLocalError('');}

  async function loadAttachments(orderId:string){
    const db=supabase;
    if(mode!=='supabase'||!db||!companyId){setAttachments([]);return;}
    const{data,error:listError}=await db.from('service_order_attachments').select('id,file_name,storage_path,note,created_at').eq('company_id',companyId).eq('service_order_id',orderId).order('created_at',{ascending:false});
    if(listError)throw listError;
    const rows=(data??[]) as Attachment[];
    const withUrls=await Promise.all(rows.map(async(item)=>{const{data:signed}=await db.storage.from('technical-attachments').createSignedUrl(item.storage_path,3600);return{...item,url:signed?.signedUrl};}));
    setAttachments(withUrls);
  }

  function openPhoto(order:ServiceOrder){
    setDraft({actionMode:'photo',selectedId:order.id,diagnosis:'',estimatedDays:String(order.estimated_days??1),note:'',pauseReason:order.pause_reason??'waiting_part'});
    setPhotoFile(null);setLocalError('');
    void loadAttachments(order.id).catch((cause)=>setLocalError(cause instanceof Error?cause.message:'Não foi possível carregar as fotos.'));
  }

  async function runStatusAction(order:ServiceOrder,status:TechnicalStatus,actionNote:string){
    setSaving(true);setLocalError('');
    try{await updateTechnicalStatus({order_id:order.id,technical_status:status,note:actionNote,estimated_days:order.estimated_days??null});closeAction();}
    catch(cause){setLocalError(cause instanceof Error?cause.message:'Não foi possível atualizar a OS.');}
    finally{setSaving(false);}
  }

  async function saveDiagnosis(submit:boolean){
    if(!selectedOrder)return;
    const clean=draft.diagnosis.trim(),days=Number.parseInt(draft.estimatedDays,10);
    if(!clean)return setLocalError('Informe o diagnóstico técnico.');
    if(!Number.isFinite(days)||days<0)return setLocalError('Informe um prazo válido.');
    const items=(selectedOrder.items??[]).map((item)=>({kind:item.kind,description:item.description,quantity:item.quantity,unit_price:item.unit_price,cost_price:item.cost_price,stock_item_id:item.stock_item_id,created_at:item.created_at}));
    setSaving(true);setLocalError('');
    try{await updateTechnical(selectedOrder.id,clean,days,items,submit);closeAction();}
    catch(cause){setLocalError(cause instanceof Error?cause.message:'Não foi possível salvar o diagnóstico.');}
    finally{setSaving(false);}
  }

  async function savePause(){
    if(!selectedOrder)return;
    if(!draft.note.trim())return setLocalError('Informe o motivo da pausa.');
    setSaving(true);setLocalError('');
    try{await updateTechnicalStatus({order_id:selectedOrder.id,technical_status:'paused',pause_reason:draft.pauseReason,note:draft.note.trim(),estimated_days:selectedOrder.estimated_days??null});closeAction();}
    catch(cause){setLocalError(cause instanceof Error?cause.message:'Não foi possível pausar a manutenção.');}
    finally{setSaving(false);}
  }

  async function saveUpdate(){
    if(!selectedOrder)return;
    if(!draft.note.trim())return setLocalError('Informe a atualização técnica.');
    setSaving(true);setLocalError('');
    try{await updateTechnicalStatus({order_id:selectedOrder.id,technical_status:technicalStatus(selectedOrder),note:draft.note.trim(),pause_reason:selectedOrder.pause_reason??null,estimated_days:selectedOrder.estimated_days??null});closeAction();}
    catch(cause){setLocalError(cause instanceof Error?cause.message:'Não foi possível registrar a atualização.');}
    finally{setSaving(false);}
  }

  async function uploadPhoto(){
    const db=supabase;
    if(!selectedOrder||!photoFile||!companyId||!user||!db||mode!=='supabase')return;
    if(!photoFile.type.startsWith('image/'))return setLocalError('Selecione uma imagem válida.');
    if(photoFile.size>15*1024*1024)return setLocalError('A foto deve ter no máximo 15 MB.');
    setSaving(true);setLocalError('');
    try{
      const safeName=photoFile.name.replace(/[^a-zA-Z0-9._-]/g,'-');
      const path=`${companyId}/${selectedOrder.id}/${crypto.randomUUID()}-${safeName}`;
      const{error:uploadError}=await db.storage.from('technical-attachments').upload(path,photoFile,{contentType:photoFile.type,upsert:false});
      if(uploadError)throw uploadError;
      const{error:rowError}=await db.from('service_order_attachments').insert({company_id:companyId,service_order_id:selectedOrder.id,uploaded_by:user.id,kind:'photo',file_name:photoFile.name,storage_path:path,mime_type:photoFile.type,file_size:photoFile.size,note:draft.note.trim()||null});
      if(rowError){await db.storage.from('technical-attachments').remove([path]);throw rowError;}
      setPhotoFile(null);setDraft((v)=>({...v,note:''}));await loadAttachments(selectedOrder.id);
    }catch(cause){
      const message=cause instanceof Error?cause.message:'Não foi possível salvar a foto.';
      setLocalError(message.includes('service_order_attachments')?'Execute a migration 0013 antes de usar fotos técnicas.':message);
    }finally{setSaving(false);}
  }

  useEffect(()=>{
    if(draft.actionMode==='photo'&&draft.selectedId)void loadAttachments(draft.selectedId).catch(()=>undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[companyId,draft.actionMode,draft.selectedId,mode]);

  if(loading)return <div className="empty-state"><RefreshCw size={38}/><h3>Carregando painel técnico</h3><p>Buscando as Ordens de Serviço da empresa.</p></div>;

  const focusedVisible=Boolean(focusedOrderId&&visibleOrders.some((order)=>order.id===focusedOrderId));

  return <>
    <PageHeader eyebrow="Operação técnica" title="Painel do técnico" description="Feito para celular: diagnóstico, manutenção, pausas, atualizações, fotos e conclusão da OS com ações rápidas."/>
    {(error||localError)&&<section className="notice" style={{marginBottom:16}}><AlertTriangle size={20}/><div><strong>Não foi possível concluir a operação</strong><p>{localError||error}</p></div></section>}
    {focusedOrderId&&!focusedVisible&&<section className="notice" style={{marginBottom:16}}><AlertTriangle size={20}/><div><strong>A OS indicada não está disponível neste painel</strong><p>Ela pode estar concluída, cancelada ou atribuída a outro técnico. <Link to={`/ordens/${focusedOrderId}`}>Abrir a OS</Link>.</p></div></section>}

    <div className="tech-summary tech-summary-mobile"><article><ClipboardList/><div><strong>{visibleOrders.length}</strong><span>OS disponíveis</span></div></article><article><PlayCircle/><div><strong>{inProgress}</strong><span>Em andamento</span></div></article><article><PackageSearch/><div><strong>{paused}</strong><span>Pausadas</span></div></article><article><CheckCircle2/><div><strong>{completedToday}</strong><span>Concluídas hoje</span></div></article></div>

    {visibleOrders.length===0?<section className="panel empty-state tech-empty"><Wrench size={38}/><h3>Nenhuma OS disponível</h3><p>Não existem Ordens de Serviço abertas para este técnico.</p></section>:<div className="mobile-work-list technician-mobile-list">{visibleOrders.map((order)=>{
      const techStatus=technicalStatus(order);
      const waitingCommercial=['ready_for_commercial','budget_ready','waiting_customer'].includes(order.status);
      const canDiagnose=['waiting_technician','diagnosis'].includes(order.status);
      const canStartMaintenance=order.status==='approved'&&techStatus!=='in_progress';
      const canOperate=order.status==='in_repair'&&techStatus==='in_progress';
      const canResume=techStatus==='paused'||order.status==='waiting_part';
      const inQuality=techStatus==='quality_check'||order.status==='quality_check';
      const focused=focusedOrderId===order.id;

      return <article id={`technician-order-${order.id}`} className={`work-card technician-work-card ${draft.selectedId===order.id||focused?'active':''}`} style={focused?{outline:'2px solid var(--blue2)',outlineOffset:3}:undefined} key={order.id}>
        <div className="work-card-top"><div><span className="order-number">{orderCode(order.order_number)}{focused?' · OS selecionada':''}</span><h3>{order.client_name??'Cliente não identificado'}</h3><p>{order.equipment??'Equipamento não identificado'}</p></div><StatusBadge status={order.status}/></div>
        <div className="work-meta"><span><Clock3 size={15}/>{technicalLabels[techStatus]}</span><span><Wrench size={15}/>{order.reported_issue}</span></div>
        {order.technical_update&&<div className="notice compact-notice"><FileText size={18}/><div><strong>Última atualização</strong><p>{order.technical_update}</p></div></div>}
        {techStatus==='paused'&&<div className="notice compact-notice"><PauseCircle size={18}/><div><strong>Manutenção pausada</strong><p>{order.pause_reason?pauseLabels[order.pause_reason]:'Motivo não informado'}{order.pause_notes?` · ${order.pause_notes}`:''}</p></div></div>}
        {waitingCommercial&&<div className="notice compact-notice"><Send size={18}/><div><strong>Etapa comercial</strong><p>Diagnóstico aguardando orçamento ou decisão do cliente.</p></div></div>}

        <div className="quick-actions technician-actions">
          <Link to={`/ordens/${order.id}`} className="ghost-button"><FileText size={17}/>Ver OS</Link>
          <Link to={`/ordens/${order.id}/documentos`} className="ghost-button">Imprimir</Link>
          <button type="button" className="ghost-button" onClick={()=>openPhoto(order)}><Camera size={17}/>Fotos</button>
          {canDiagnose&&<button type="button" onClick={()=>openDiagnosis(order)}><ClipboardList size={17}/>Diagnóstico</button>}
          {canStartMaintenance&&<button type="button" disabled={saving} onClick={()=>void runStatusAction(order,'in_progress','Manutenção iniciada.')}><PlayCircle size={17}/>Iniciar</button>}
          {canOperate&&<><button type="button" onClick={()=>openPause(order)}><PauseCircle size={17}/>Pausar</button><button type="button" onClick={()=>openUpdate(order)}><FileText size={17}/>Atualizar</button><button type="button" disabled={saving} onClick={()=>void runStatusAction(order,'quality_check','Manutenção enviada para testes e controle de qualidade.')}><PackageCheck size={17}/>Enviar para testes</button></>}
          {canResume&&<button type="button" disabled={saving} onClick={()=>void runStatusAction(order,'in_progress','Manutenção retomada.')}><RotateCcw size={17}/>Retomar</button>}
          {inQuality&&<><button type="button" disabled={saving} onClick={()=>void runStatusAction(order,'in_progress','Equipamento retornou dos testes para manutenção.')}><RotateCcw size={17}/>Voltar manutenção</button><button type="button" disabled={saving} onClick={()=>void runStatusAction(order,'completed','Manutenção concluída e equipamento liberado para retirada.')}><CheckCircle2 size={17}/>Concluir</button></>}
        </div>

        {selectedOrder?.id===order.id&&draft.actionMode&&<section className="panel technician-action-panel">
          {draft.actionMode==='diagnosis'&&<><span className="eyebrow">Diagnóstico técnico</span><h3>Registrar diagnóstico</h3><label><span>Diagnóstico</span><textarea rows={5} value={draft.diagnosis} onChange={(e)=>setDraft((v)=>({...v,diagnosis:e.target.value}))}/></label><label><span>Prazo estimado em dias</span><input type="number" min="0" value={draft.estimatedDays} onChange={(e)=>setDraft((v)=>({...v,estimatedDays:e.target.value}))}/></label><div className="quick-actions technician-form-actions"><button type="button" disabled={saving} onClick={()=>void saveDiagnosis(false)}><ClipboardList size={17}/>Salvar</button><button type="button" disabled={saving} onClick={()=>void saveDiagnosis(true)}><Send size={17}/>Enviar ao Comercial</button><button type="button" className="ghost-button" onClick={closeAction}>Cancelar</button></div></>}
          {draft.actionMode==='pause'&&<><span className="eyebrow">Pausar manutenção</span><h3>Informe o motivo</h3><label><span>Motivo</span><select value={draft.pauseReason} onChange={(e)=>setDraft((v)=>({...v,pauseReason:e.target.value as PauseReason}))}>{Object.entries(pauseLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label><span>Observação</span><textarea rows={4} value={draft.note} onChange={(e)=>setDraft((v)=>({...v,note:e.target.value}))}/></label><div className="quick-actions technician-form-actions"><button type="button" disabled={saving} onClick={()=>void savePause()}><PauseCircle size={17}/>Confirmar pausa</button><button type="button" className="ghost-button" onClick={closeAction}>Cancelar</button></div></>}
          {draft.actionMode==='update'&&<><span className="eyebrow">Atualização técnica</span><h3>Registrar andamento</h3><label><span>Atualização</span><textarea rows={4} value={draft.note} onChange={(e)=>setDraft((v)=>({...v,note:e.target.value}))}/></label><div className="quick-actions technician-form-actions"><button type="button" disabled={saving} onClick={()=>void saveUpdate()}><FileText size={17}/>Salvar atualização</button><button type="button" className="ghost-button" onClick={closeAction}>Cancelar</button></div></>}
          {draft.actionMode==='photo'&&<><span className="eyebrow">Registro visual</span><h3>Fotos da manutenção</h3><label className="camera-upload"><Camera size={24}/><strong>Tirar foto ou escolher imagem</strong><small>No celular, o navegador pode abrir a câmera traseira.</small><input type="file" accept="image/*" capture="environment" onChange={(e)=>setPhotoFile(e.target.files?.[0]??null)}/></label>{photoFile&&<div className="notice compact-notice"><ImageIcon size={18}/><div><strong>{photoFile.name}</strong><p>{Math.ceil(photoFile.size/1024)} KB pronta para enviar</p></div></div>}<label><span>Observação da foto (opcional)</span><textarea rows={3} value={draft.note} onChange={(e)=>setDraft((v)=>({...v,note:e.target.value}))}/></label><div className="quick-actions technician-form-actions"><button type="button" disabled={saving||!photoFile} onClick={()=>void uploadPhoto()}><UploadCloud size={17}/>{saving?'Enviando...':'Salvar foto'}</button><button type="button" className="ghost-button" onClick={closeAction}>Fechar</button></div>{attachments.length>0&&<div className="tech-photo-grid">{attachments.map((item)=><a key={item.id} href={item.url} target="_blank" rel="noreferrer" className="tech-photo-card">{item.url?<img src={item.url} alt={item.note||item.file_name}/>:<ImageIcon/>}<span>{item.note||item.file_name}</span></a>)}</div>}</>}
        </section>}
      </article>;
    })}</div>}
  </>;
}
