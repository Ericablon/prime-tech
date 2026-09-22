import { AlertTriangle, ArrowLeft, CircuitBoard, Laptop, Printer, Save, UserRound, Wrench } from 'lucide-react';
import { useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { PageHeader } from '../components/ui/PageHeader';
import { usePrimeTech } from '../contexts/PrimeTechContext';
import { useSessionDraft } from '../hooks/useSessionDraft';
import { equipmentCode } from '../lib/formatters';
import { defaultTechnicalSpecialties, inferTechnicalSpecialty, technicalSpecialtyLabel } from '../lib/technicalSpecialties';
import type { CreateOrderInput, Priority } from '../types/domain';

const initialForm: CreateOrderInput = {
  client_id: '', equipment_id: '', intake_type: 'Orçamento', reported_issue: '', priority: 'normal',
  technical_specialty_code: null, assigned_technician_id: null,
};
const closedStatuses = ['delivered', 'cancelled'];

export function NewOrderPage() {
  const navigate = useNavigate();
  const { clients, equipment, orders, loading, createOrder } = usePrimeTech();
  const [form, setForm, clearDraft] = useSessionDraft<CreateOrderInput>('new-order-form', initialForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const clientEquipment = useMemo(() => equipment.filter((item) => item.client_id === form.client_id), [equipment, form.client_id]);
  const selectedClient = useMemo(() => clients.find((client) => client.id === form.client_id), [clients, form.client_id]);
  const selectedEquipment = useMemo(() => equipment.find((item) => item.id === form.equipment_id), [equipment, form.equipment_id]);
  const activeOrder = useMemo(() => orders.find((order) => order.equipment_id === form.equipment_id && !closedStatuses.includes(order.status)), [form.equipment_id, orders]);

  function handleClientChange(clientId: string) {
    setError('');
    setForm((current) => ({ ...current, client_id: clientId, equipment_id: '', technical_specialty_code: null, assigned_technician_id: null }));
  }

  function handleEquipmentChange(equipmentId: string) {
    setError('');
    const item = equipment.find((entry) => entry.id === equipmentId);
    const specialty = item?.technical_specialty_code ?? inferTechnicalSpecialty(item?.category);
    setForm((current) => ({ ...current, equipment_id: equipmentId, technical_specialty_code: specialty, assigned_technician_id: null }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    if (!form.client_id) return setError('Selecione o cliente.');
    if (!form.equipment_id) return setError('Selecione o equipamento.');
    if (!form.technical_specialty_code) return setError('Defina a especialidade técnica responsável pela OS.');
    if (!form.reported_issue.trim()) return setError('Informe o problema relatado pelo cliente.');
    if (activeOrder) return setError(`Este equipamento já possui a OS #${activeOrder.order_number} ativa.`);

    setBusy(true);
    try {
      const created = await createOrder({ ...form, reported_issue: form.reported_issue.trim(), assigned_technician_id: form.assigned_technician_id ?? null });
      clearDraft();
      navigate(`/ordens/${created.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível criar a Ordem de Serviço.');
    } finally { setBusy(false); }
  }

  function cancelDraft() {
    clearDraft();
    navigate('/ordens');
  }

  return <>
    <PageHeader eyebrow="Comercial" title="Nova Ordem de Serviço" description="Abra a OS, defina a especialidade responsável e encaminhe o equipamento para a fila técnica correta. O rascunho fica salvo enquanto você navega pelo Cronos." />
    <section className="panel">
      <Link to="/ordens" className="back-link" style={{ marginBottom: 20 }}><ArrowLeft size={17} /> Voltar para Ordens de Serviço</Link>
      {loading ? <div className="empty-state"><Wrench size={38} /><h3>Carregando dados</h3><p>Buscando clientes e equipamentos cadastrados.</p></div> : (
        <form onSubmit={(event) => void handleSubmit(event)}>
          <div style={formGridStyle}>
            <label><FieldLabel>Cliente</FieldLabel><select required value={form.client_id} onChange={(e) => handleClientChange(e.target.value)} style={fieldStyle}><option value="">Selecione o cliente</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}{client.document ? ` · ${client.document}` : ''}</option>)}</select></label>
            <label><FieldLabel>Equipamento</FieldLabel><select required disabled={!form.client_id} value={form.equipment_id} onChange={(e) => handleEquipmentChange(e.target.value)} style={{ ...fieldStyle, opacity: form.client_id ? 1 : .55 }}><option value="">{!form.client_id ? 'Selecione o cliente primeiro' : clientEquipment.length ? 'Selecione o equipamento' : 'Cliente sem equipamentos'}</option>{clientEquipment.map((item) => <option key={item.id} value={item.id}>{equipmentCode(item.technical_number)} · {[item.category,item.brand,item.model].filter(Boolean).join(' ')}</option>)}</select>{form.client_id && clientEquipment.length === 0 && <small style={helpStyle}>Este cliente ainda não possui equipamentos. <Link to="/equipamentos" style={{ color: 'var(--blue2)' }}>Cadastrar equipamento</Link></small>}</label>
            <label><FieldLabel>Especialidade técnica</FieldLabel><select required value={form.technical_specialty_code ?? ''} onChange={(e) => setForm((v) => ({ ...v, technical_specialty_code: e.target.value || null, assigned_technician_id: null }))} style={fieldStyle}><option value="">Selecione a especialidade</option>{defaultTechnicalSpecialties.map((specialty) => <option key={specialty.code} value={specialty.code}>{specialty.shortLabel}</option>)}</select><small style={helpStyle}>O Cronos usa esta informação para separar filas e programação.</small></label>
            <label><FieldLabel>Tipo de entrada</FieldLabel><select value={form.intake_type} onChange={(e) => setForm((v) => ({ ...v, intake_type: e.target.value }))} style={fieldStyle}><option>Orçamento</option><option>Manutenção</option><option>Diagnóstico</option><option>Garantia</option></select></label>
            <label><FieldLabel>Prioridade</FieldLabel><select value={form.priority} onChange={(e) => setForm((v) => ({ ...v, priority: e.target.value as Priority }))} style={fieldStyle}><option value="low">Baixa</option><option value="normal">Normal</option><option value="high">Alta</option><option value="urgent">Urgente</option></select></label>
            <label style={{ gridColumn: '1 / -1' }}><FieldLabel>Problema relatado pelo cliente</FieldLabel><textarea required rows={5} value={form.reported_issue} onChange={(e) => setForm((v) => ({ ...v, reported_issue: e.target.value }))} placeholder="Descreva exatamente o problema informado pelo cliente..." style={{ ...fieldStyle, resize: 'vertical' }} /></label>
          </div>

          {selectedClient && selectedEquipment && <div style={summaryGridStyle}>
            <div style={summaryStyle}><UserRound size={19} /><div><strong>{selectedClient.name}</strong><small>{selectedClient.phone || selectedClient.email || 'Sem contato informado'}</small></div></div>
            <div style={summaryStyle}><Laptop size={19} /><div><strong>{[selectedEquipment.category,selectedEquipment.brand,selectedEquipment.model].filter(Boolean).join(' ')}</strong><small>{equipmentCode(selectedEquipment.technical_number)}{selectedEquipment.serial_number ? ` · Série ${selectedEquipment.serial_number}` : ''}</small></div></div>
            <div style={{ ...summaryStyle, gridColumn: '1 / -1' }}>{form.technical_specialty_code === 'impressoras' ? <Printer size={19} /> : <CircuitBoard size={19} />}<div><strong>Fila: {technicalSpecialtyLabel(form.technical_specialty_code)}</strong><small>Diagnóstico e programação serão organizados por esta especialidade.</small></div></div>
          </div>}

          {activeOrder && <div style={warningStyle}><AlertTriangle size={20} style={{ color: 'var(--amber)' }} /><div><strong>Equipamento já possui uma OS ativa</strong><p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 4 }}>A OS #{activeOrder.order_number} precisa ser concluída ou cancelada antes de outra.</p><Link to={`/ordens/${activeOrder.id}`} style={{ color: 'var(--blue2)', fontSize: 12, fontWeight: 700 }}>Abrir OS #{activeOrder.order_number}</Link></div></div>}
          {error && <div style={errorStyle}>{error}</div>}
          {!clients.length && <div className="notice" style={{ marginTop: 18 }}><AlertTriangle /><div><strong>Nenhum cliente cadastrado</strong><p>Cadastre o cliente e depois o equipamento.</p><Link to="/clientes" style={{ color: 'var(--blue2)', fontSize: 12, fontWeight: 700 }}>Ir para Clientes</Link></div></div>}

          <div className="form-footer" style={{ marginTop: 22, justifyContent: 'flex-end' }}><button type="button" className="ghost-button" onClick={cancelDraft}>Cancelar e descartar</button><button type="submit" className="primary-button" disabled={busy || !form.client_id || !form.equipment_id || !form.technical_specialty_code || !form.reported_issue.trim() || Boolean(activeOrder)}><Save size={17} />{busy ? 'Criando OS...' : 'Criar Ordem de Serviço'}</button></div>
        </form>
      )}
    </section>
    <section className="panel" style={{ marginTop: 16 }}><div className="panel-head"><div><span className="eyebrow">Próxima etapa</span><h2>Fluxo automático</h2></div></div><div className="flow-grid"><FlowItem number="1" title="OS aberta" text="Cliente, equipamento e especialidade ficam vinculados." /><FlowItem number="2" title="Fila especializada" text="A OS entra na fila correta para diagnóstico." /><FlowItem number="3" title="Retorno comercial" text="Após diagnóstico, volta ao Comercial para orçamento." /></div></section>
  </>;
}

function FieldLabel({ children }: { children: React.ReactNode }) { return <span style={{ display:'block',marginBottom:6,color:'var(--muted)',fontSize:12 }}>{children}</span>; }
function FlowItem({ number, title, text }: { number:string; title:string; text:string }) { return <article style={{ padding:15,borderRadius:12,border:'1px solid var(--line)',background:'#0c1728' }}><span style={{ width:28,height:28,display:'grid',placeItems:'center',borderRadius:8,background:'rgba(47,140,255,.15)',color:'var(--blue2)',fontSize:12,fontWeight:800,marginBottom:10 }}>{number}</span><strong style={{ display:'block',fontSize:13 }}>{title}</strong><p style={{ color:'var(--muted)',fontSize:12,marginTop:5,lineHeight:1.5 }}>{text}</p></article>; }
const formGridStyle: CSSProperties = { display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:16 };
const fieldStyle: CSSProperties = { width:'100%',minHeight:42,padding:'10px 12px',borderRadius:10,border:'1px solid var(--line)',background:'#0b1728',color:'#fff',outline:'none' };
const helpStyle: CSSProperties = { display:'block',marginTop:6,color:'var(--muted)',fontSize:11 };
const summaryGridStyle: CSSProperties = { marginTop:18,display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:12 };
const summaryStyle: CSSProperties = { display:'flex',alignItems:'center',gap:11,padding:13,border:'1px solid var(--line)',borderRadius:12,background:'#0c1728',color:'var(--blue2)' };
const warningStyle: CSSProperties = { marginTop:18,padding:14,display:'flex',gap:12,alignItems:'flex-start',border:'1px solid rgba(244,184,74,.28)',background:'rgba(244,184,74,.07)',borderRadius:12 };
const errorStyle: CSSProperties = { marginTop:18,padding:12,borderRadius:10,border:'1px solid rgba(239,101,113,.25)',background:'rgba(239,101,113,.08)',color:'#f3838c',fontSize:13 };
