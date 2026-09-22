import { Edit3, Laptop, Plus, Search, Wrench, X } from 'lucide-react';
import { useMemo, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';

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
const emptyForm: EquipmentForm = { client_id:'',category:'Notebook',brand:'',model:'',serial_number:'',accessories:'',notes:'' };

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
  const { clients,equipment,orders,loading,error:contextError,createEquipment,refresh }=usePrimeTech();
  const [search,setSearch]=useState('');
  const [open,setOpen,clearOpen]=useSessionDraft('equipment-form-open',false);
  const [form,setForm,clearForm]=useSessionDraft<EquipmentForm>('equipment-form',emptyForm);
  const [busy,setBusy]=useState(false); const [formError,setFormError]=useState('');

  const filteredEquipment=useMemo(()=>{const term=search.trim().toLowerCase();if(!term)return equipment;return equipment.filter((item)=>{const client=clients.find((c)=>c.id===item.client_id);return [equipmentCode(item.technical_number),client?.name,item.category,item.brand,item.model,item.serial_number,item.accessories].filter(Boolean).join(' ').toLowerCase().includes(term);});},[clients,equipment,search]);

  function handleOpen(){
    setFormError('');
    if(!clients.length){setFormError('Cadastre um cliente antes de cadastrar um equipamento.');setOpen(true);return;}
    clearForm();
    setForm({...emptyForm,client_id:clients[0]?.id??''});
    setOpen(true);
  }
  function openEdit(item: Equipment){setForm(toForm(item));setFormError('');setOpen(true);}
  function handleClose(){clearOpen();clearForm();setFormError('');}

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
    <PageHeader eyebrow="Comercial" title="Equipamentos" description="Cadastro e histórico dos equipamentos vinculados aos clientes e às Ordens de Serviço. Cadastros de teste também podem ser editados." actions={can(user,'equipment.manage')?<button type="button" className="primary-button" onClick={handleOpen}><Plus size={17}/>Novo equipamento</button>:undefined}/>
    {open&&<section className="panel" style={{marginBottom:18}}><div className="panel-head"><div><span className="eyebrow">Cadastro</span><h2>{form.id?'Editar equipamento':'Novo equipamento'}</h2></div><button type="button" className="ghost-button small" onClick={handleClose}><X size={16}/>Fechar</button></div>
      {clients.length>0&&<form onSubmit={handleSubmit} style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:14}}>
        <label><FieldLabel>Cliente proprietário</FieldLabel><select required value={form.client_id} onChange={(e)=>setForm((v)=>({...v,client_id:e.target.value}))} style={fieldStyle}><option value="">Selecione o cliente</option>{clients.map((c)=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label><FieldLabel>Categoria</FieldLabel><select required value={form.category} onChange={(e)=>setForm((v)=>({...v,category:e.target.value}))} style={fieldStyle}>{['Notebook','Desktop','Impressora','Smartphone','Tablet','Monitor','Nobreak','Servidor','Outro'].map((v)=><option key={v}>{v}</option>)}</select></label>
        <label><FieldLabel>Marca</FieldLabel><input value={form.brand??''} onChange={(e)=>setForm((v)=>({...v,brand:e.target.value}))} placeholder="Ex.: Dell, Epson, Lenovo" style={fieldStyle}/></label>
        <label><FieldLabel>Modelo</FieldLabel><input value={form.model??''} onChange={(e)=>setForm((v)=>({...v,model:e.target.value}))} placeholder="Modelo do equipamento" style={fieldStyle}/></label>
        <label><FieldLabel>Número de série</FieldLabel><input value={form.serial_number??''} onChange={(e)=>setForm((v)=>({...v,serial_number:e.target.value}))} placeholder="Número de série" style={fieldStyle}/><small style={{display:'block',marginTop:5,color:'var(--muted)',fontSize:11}}>O Cronos impede número de série duplicado.</small></label>
        <label><FieldLabel>Acessórios recebidos</FieldLabel><input value={form.accessories??''} onChange={(e)=>setForm((v)=>({...v,accessories:e.target.value}))} placeholder="Carregador, fonte, cabo, bolsa..." style={fieldStyle}/></label>
        <label style={{gridColumn:'1 / -1'}}><FieldLabel>Estado físico / observações</FieldLabel><textarea value={form.notes??''} onChange={(e)=>setForm((v)=>({...v,notes:e.target.value}))} placeholder="Riscos, trincas, peças faltantes..." style={{...fieldStyle,minHeight:90,resize:'vertical'}}/></label>
        {formError&&<FormError>{formError}</FormError>}
        <div style={{gridColumn:'1 / -1',display:'flex',justifyContent:'flex-end',gap:10}}><button type="button" className="ghost-button" onClick={handleClose} disabled={busy}>Cancelar</button><button className="primary-button" disabled={busy||!form.client_id||!form.category.trim()}>{busy?'Salvando...':form.id?'Salvar alterações':'Salvar equipamento'}</button></div>
      </form>}
      {!clients.length&&formError&&<><FormError>{formError}</FormError><p style={{marginTop:14,color:'var(--muted)',fontSize:13}}>O equipamento sempre precisa pertencer a um cliente cadastrado.</p></>}
    </section>}

    {contextError&&<section className="notice" style={{marginBottom:16}}><div><strong>Não foi possível carregar todos os dados</strong><p>{contextError}</p></div></section>}
    <section className="panel"><div className="filters"><div className="filter-search"><Search size={16}/><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Buscar por cliente, equipamento, marca, modelo ou série"/></div></div>
      {loading?<div className="empty-state"><Laptop size={38}/><h3>Carregando equipamentos</h3><p>Buscando os equipamentos cadastrados.</p></div>:filteredEquipment.length===0?<div className="empty-state"><Laptop size={38}/><h3>Nenhum equipamento encontrado</h3><p>Cadastre um equipamento ou altere a busca.</p></div>:<div className="table-wrap"><table><thead><tr><th>Código / equipamento</th><th>Cliente</th><th>Série</th><th>Histórico</th><th>Situação atual</th>{can(user,'equipment.manage')&&<th>Ação</th>}</tr></thead><tbody>{filteredEquipment.map((item)=>{const client=clients.find((c)=>c.id===item.client_id);const itemOrders=orders.filter((o)=>o.equipment_id===item.id).sort((a,b)=>new Date(b.updated_at).getTime()-new Date(a.updated_at).getTime());const current=itemOrders.find((o)=>!['delivered','cancelled'].includes(o.status));return <tr key={item.id}><td><strong>{[item.category,item.brand,item.model].filter(Boolean).join(' ')}</strong><small>{equipmentCode(item.technical_number)}</small></td><td><strong>{client?.name??'Cliente não localizado'}</strong><small>{client?.phone||'Sem telefone'}</small></td><td>{item.serial_number||'—'}</td><td><span className="muted"><Wrench size={14}/>{itemOrders.length} OS</span></td><td>{current?<><StatusBadge status={current.status}/><small style={{marginTop:6}}>OS #{String(current.order_number).padStart(6,'0')}</small></>:<span className="stock-state ok">Sem OS ativa</span>}</td>{can(user,'equipment.manage')&&<td><button type="button" className="ghost-button" onClick={()=>openEdit(item)}><Edit3 size={15}/>Editar</button></td>}</tr>;})}</tbody></table></div>}
    </section>
  </>;
}
function FieldLabel({children}:{children:ReactNode}){return <span style={{display:'block',fontSize:12,marginBottom:6,color:'var(--muted)'}}>{children}</span>;}
function FormError({children}:{children:ReactNode}){return <div style={{gridColumn:'1 / -1',padding:12,borderRadius:10,background:'rgba(239,101,113,.08)',border:'1px solid rgba(239,101,113,.22)',color:'#f3838c',fontSize:13}}>{children}</div>;}
const fieldStyle:CSSProperties={width:'100%',minHeight:42,borderRadius:10,border:'1px solid var(--line)',background:'var(--surface2)',color:'var(--premium-text)',padding:'10px 12px',outline:'none'};
