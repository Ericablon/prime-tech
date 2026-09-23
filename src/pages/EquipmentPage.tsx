import { Edit3, Laptop, Plus, Save, Search, Wrench, X } from 'lucide-react';
import { useEffect, useMemo, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';

import { PageHeader } from '../components/ui/PageHeader';
import { StatusBadge } from '../components/ui/StatusBadge';
import { useAuth } from '../contexts/AuthContext';
import { usePrimeTech } from '../contexts/PrimeTechContext';
import { useSessionDraft } from '../hooks/useSessionDraft';
import { equipmentCode } from '../lib/formatters';
import { can } from '../lib/permissions';
import { supabase } from '../lib/supabase';
import type { CreateEquipmentInput, Equipment } from '../types/domain';

type EquipmentForm = CreateEquipmentInput & { id?: string };
type EquipmentWithSnapshotFlag = Equipment & { is_order_snapshot?: boolean };
const emptyForm: EquipmentForm = { client_id:'',category:'Notebook',brand:'',model:'',serial_number:'',accessories:'',notes:'' };
const emptyQuickClient={name:'',document:'',phone:''};

function toForm(item: Equipment): EquipmentForm {
  return {
    id: item.id,
    client_id: item.client_id,
    category: item.category,
    technical_specialty_code: item.technical_specialty_code ?? null,
    brand: item.brand ?? '',
    model: item.model ?? '',
    serial_number: item.serial_number ?? '',
    accessories: item.accessories ?? '',
    notes: item.notes ?? '',
  };
}

export function EquipmentPage(){
  const { user, mode }=useAuth();
  const { clients,equipment,orders,loading,error:contextError,createClient,createEquipment,refresh }=usePrimeTech();
  const [searchParams]=useSearchParams();
  const [search,setSearch]=useState(()=>searchParams.get('busca')??'');
  const [open,setOpen,clearOpen]=useSessionDraft('equipment-form-open',false);
  const [form,setForm,clearForm]=useSessionDraft<EquipmentForm>('equipment-form',emptyForm);
  const [quickClientOpen,setQuickClientOpen]=useState(false);
  const [quickClient,setQuickClient]=useState(emptyQuickClient);
  const [busy,setBusy]=useState(false); const [formError,setFormError]=useState('');

  useEffect(()=>{setSearch(searchParams.get('busca')??'');},[searchParams]);

  const permanentEquipment=useMemo(
    ()=>equipment.filter((item)=>!(item as EquipmentWithSnapshotFlag).is_order_snapshot),
    [equipment],
  );
  const filteredEquipment=useMemo(()=>{const term=search.trim().toLowerCase();if(!term)return permanentEquipment;return permanentEquipment.filter((item)=>{const client=clients.find((c)=>c.id===item.client_id);return [equipmentCode(item.technical_number),client?.name,item.category,item.brand,item.model,item.serial_number,item.accessories].filter(Boolean).join(' ').toLowerCase().includes(term);});},[clients,permanentEquipment,search]);

  function handleOpen(){
    setFormError('');
    clearForm();
    setForm({...emptyForm,client_id:clients[0]?.id??''});
    setQuickClientOpen(false);
    setOpen(true);
  }
  function openEdit(item: Equipment){setForm(toForm(item));setFormError('');setQuickClientOpen(false);setOpen(true);}
  function handleClose(){clearOpen();clearForm();setQuickClientOpen(false);setQuickClient(emptyQuickClient);setFormError('');}

  async function createQuickClient(){
    if(!quickClient.name.trim())return setFormError('Informe o nome do cliente.');
    setBusy(true);setFormError('');
    try{
      const created=await createClient({
        person_type:quickClient.document.replace(/\D/g,'').length>11?'pj':'pf',
        name:quickClient.name.trim(),
        document:quickClient.document.replace(/\D/g,'')||undefined,
        phone:quickClient.phone.trim()||undefined,
      });
      setForm((current)=>({...current,client_id:created.id}));
      setQuickClient(emptyQuickClient);
      setQuickClientOpen(false);
    }catch(cause){setFormError(cause instanceof Error?cause.message:'Não foi possível cadastrar o cliente.');}
    finally{setBusy(false);}
  }

  async function handleSubmit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!form.client_id)return setFormError('Selecione o cliente proprietário do equipamento.');
    if(!form.category.trim())return setFormError('Informe a categoria do equipamento.');
    setBusy(true);setFormError('');
    try{
      const payload={
        client_id:form.client_id,
        category:form.category.trim(),
        brand:form.brand?.trim()||null,
        model:form.model?.trim()||null,
        serial_number:form.serial_number?.trim().toUpperCase()||null,
        accessories:form.accessories?.trim()||null,
        notes:form.notes?.trim()||null,
      };
      if(form.id){
        if(mode!=='supabase'||!supabase)throw new Error('Edição de equipamento exige conexão com o Supabase.');
        const {error}=await supabase.from('equipment').update(payload).eq('id',form.id);
        if(error){if(error.code==='23505')throw new Error('Já existe um equipamento com este número de série.');throw error;}
        await refresh();
      }else{
        await createEquipment({
          client_id:payload.client_id,
          category:payload.category,
          brand:payload.brand??undefined,
          model:payload.model??undefined,
          serial_number:payload.serial_number??undefined,
          accessories:payload.accessories??undefined,
          notes:payload.notes??undefined,
        });
      }
      handleClose();
    }catch(cause){setFormError(cause instanceof Error?cause.message:'Não foi possível salvar o equipamento.');}
    finally{setBusy(false);}
  }

  return <>
    <PageHeader eyebrow="Comercial" title="Equipamentos" description="Cadastro opcional para equipamentos recorrentes ou patrimônio do cliente. Equipamentos apenas descritos durante a abertura de uma OS não aparecem nesta lista." actions={can(user,'equipment.manage')?<button type="button" className="primary-button" onClick={handleOpen}><Plus size={17}/>Novo equipamento</button>:undefined}/>
    {open&&<section className="panel" style={{marginBottom:18}}><div className="panel-head"><div><span className="eyebrow">Cadastro</span><h2>{form.id?'Editar equipamento':'Novo equipamento'}</h2></div><button type="button" className="ghost-button small" onClick={handleClose}><X size={16}/>Fechar</button></div>
      <form onSubmit={handleSubmit} style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:14}}>
        <label>
          <FieldLabel>Cliente proprietário</FieldLabel>
          <div className="select-with-action">
            <select required value={form.client_id} onChange={(e)=>setForm((v)=>({...v,client_id:e.target.value}))} style={fieldStyle}>
              <option value="">Selecione o cliente</option>
              {clients.map((c)=><option key={c.id} value={c.id}>{c.name}{c.document?` · ${c.document}`:''}</option>)}
            </select>
            {can(user,'clients.manage')&&<button type="button" className="select-add-button" title="Cadastrar cliente sem sair desta tela" onClick={()=>setQuickClientOpen((value)=>!value)}><Plus size={18}/></button>}
          </div>
        </label>
        <label><FieldLabel>Categoria</FieldLabel><select required value={form.category} onChange={(e)=>setForm((v)=>({...v,category:e.target.value}))} style={fieldStyle}>{['Notebook','Desktop','Impressora','Smartphone','Tablet','Monitor','Nobreak','Servidor','Outro'].map((v)=><option key={v}>{v}</option>)}</select></label>

        {quickClientOpen&&<div className="inline-create-card" style={{gridColumn:'1 / -1'}}>
          <div className="panel-head"><div><span className="eyebrow">Cadastro rápido</span><h3>Novo cliente</h3></div><button type="button" className="ghost-button small" onClick={()=>setQuickClientOpen(false)}><X size={15}/>Fechar</button></div>
          <div className="form-grid">
            <label><span>Nome / Razão social</span><input value={quickClient.name} onChange={(e)=>setQuickClient((v)=>({...v,name:e.target.value}))} placeholder="Nome do cliente"/></label>
            <label><span>CPF / CNPJ</span><input value={quickClient.document} onChange={(e)=>setQuickClient((v)=>({...v,document:e.target.value}))} placeholder="Somente números ou formatado"/></label>
            <label><span>Telefone / WhatsApp</span><input value={quickClient.phone} onChange={(e)=>setQuickClient((v)=>({...v,phone:e.target.value}))} placeholder="Contato"/></label>
          </div>
          <div className="quick-actions" style={{marginTop:12}}><button type="button" disabled={busy||!quickClient.name.trim()} onClick={()=>void createQuickClient()}><Save size={15}/>Salvar e selecionar</button></div>
        </div>}

        <label><FieldLabel>Marca</FieldLabel><input value={form.brand??''} onChange={(e)=>setForm((v)=>({...v,brand:e.target.value}))} placeholder="Ex.: Dell, Epson, Lenovo" style={fieldStyle}/></label>
        <label><FieldLabel>Modelo</FieldLabel><input value={form.model??''} onChange={(e)=>setForm((v)=>({...v,model:e.target.value}))} placeholder="Modelo do equipamento" style={fieldStyle}/></label>
        <label><FieldLabel>Número de série</FieldLabel><input value={form.serial_number??''} onChange={(e)=>setForm((v)=>({...v,serial_number:e.target.value}))} placeholder="Número de série" style={fieldStyle}/><small style={{display:'block',marginTop:5,color:'var(--muted)',fontSize:11}}>O Cronos impede número de série duplicado.</small></label>
        <label><FieldLabel>Acessórios recebidos</FieldLabel><input value={form.accessories??''} onChange={(e)=>setForm((v)=>({...v,accessories:e.target.value}))} placeholder="Carregador, fonte, cabo, bolsa..." style={fieldStyle}/></label>
        <label style={{gridColumn:'1 / -1'}}><FieldLabel>Estado físico / observações</FieldLabel><textarea value={form.notes??''} onChange={(e)=>setForm((v)=>({...v,notes:e.target.value}))} placeholder="Riscos, trincas, peças faltantes..." style={{...fieldStyle,minHeight:90,resize:'vertical'}}/></label>
        {formError&&<FormError>{formError}</FormError>}
        <div style={{gridColumn:'1 / -1',display:'flex',justifyContent:'flex-end',gap:10}}><button type="button" className="ghost-button" onClick={handleClose} disabled={busy}>Cancelar</button><button className="primary-button" disabled={busy||!form.client_id||!form.category.trim()}>{busy?'Salvando...':form.id?'Salvar alterações':'Salvar equipamento'}</button></div>
      </form>
    </section>}

    {contextError&&<section className="notice" style={{marginBottom:16}}><div><strong>Não foi possível carregar todos os dados</strong><p>{contextError}</p></div></section>}
    <section className="panel"><div className="filters"><div className="filter-search"><Search size={16}/><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Buscar por cliente, equipamento, marca, modelo ou série"/></div></div>
      {loading?<div className="empty-state"><Laptop size={38}/><h3>Carregando equipamentos</h3><p>Buscando os equipamentos cadastrados.</p></div>:filteredEquipment.length===0?<div className="empty-state"><Laptop size={38}/><h3>Nenhum equipamento encontrado</h3><p>Cadastre um equipamento recorrente ou altere a busca.</p></div>:<div className="table-wrap"><table><thead><tr><th>Código / equipamento</th><th>Cliente</th><th>Série</th><th>Histórico</th><th>Situação atual</th>{can(user,'equipment.manage')&&<th>Ação</th>}</tr></thead><tbody>{filteredEquipment.map((item)=>{const client=clients.find((c)=>c.id===item.client_id);const itemOrders=orders.filter((o)=>o.equipment_id===item.id).sort((a,b)=>new Date(b.updated_at).getTime()-new Date(a.updated_at).getTime());const current=itemOrders.find((o)=>!['delivered','cancelled'].includes(o.status));return <tr key={item.id}><td><strong>{[item.category,item.brand,item.model].filter(Boolean).join(' ')}</strong><small>{equipmentCode(item.technical_number)}</small></td><td><strong>{client?.name??'Cliente não localizado'}</strong><small>{client?.phone||'Sem telefone'}</small></td><td>{item.serial_number||'—'}</td><td><span className="muted"><Wrench size={14}/>{itemOrders.length} OS</span></td><td>{current?<><StatusBadge status={current.status}/><small style={{marginTop:6}}>OS #{String(current.order_number).padStart(6,'0')}</small></>:<span className="stock-state ok">Sem OS ativa</span>}</td>{can(user,'equipment.manage')&&<td><button type="button" className="ghost-button" onClick={()=>openEdit(item)}><Edit3 size={15}/>Editar</button></td>}</tr>;})}</tbody></table></div>}
    </section>
  </>;
}
function FieldLabel({children}:{children:ReactNode}){return <span style={{display:'block',fontSize:12,marginBottom:6,color:'var(--muted)'}}>{children}</span>;}
function FormError({children}:{children:ReactNode}){return <div style={{gridColumn:'1 / -1',padding:12,borderRadius:10,background:'rgba(239,101,113,.08)',border:'1px solid rgba(239,101,113,.22)',color:'#f3838c',fontSize:13}}>{children}</div>;}
const fieldStyle:CSSProperties={width:'100%',minHeight:42,borderRadius:10,border:'1px solid var(--line)',background:'var(--surface2)',color:'var(--premium-text)',padding:'10px 12px',outline:'none'};
