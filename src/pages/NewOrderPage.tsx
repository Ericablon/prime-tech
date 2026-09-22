import {
  AlertTriangle,
  ArrowLeft,
  CircuitBoard,
  Laptop,
  Plus,
  Printer,
  Save,
  UserRound,
  Wrench,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { PageHeader } from '../components/ui/PageHeader';
import { useAuth } from '../contexts/AuthContext';
import { usePrimeTech } from '../contexts/PrimeTechContext';
import { useSessionDraft } from '../hooks/useSessionDraft';
import { equipmentCode } from '../lib/formatters';
import { can } from '../lib/permissions';
import { supabase } from '../lib/supabase';
import { defaultTechnicalSpecialties, inferTechnicalSpecialty, technicalSpecialtyLabel } from '../lib/technicalSpecialties';
import type { CreateOrderInput, Priority } from '../types/domain';

const initialForm: CreateOrderInput = {
  client_id: '', equipment_id: '', intake_type: 'Orçamento', reported_issue: '', priority: 'normal',
  technical_specialty_code: null, assigned_technician_id: null,
};
const closedStatuses = ['delivered', 'cancelled'];

type QuickCreate = 'client' | 'equipment' | 'specialty' | null;
type SpecialtyOption = { code: string; label: string };

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function NewOrderPage() {
  const navigate = useNavigate();
  const { user, mode } = useAuth();
  const {
    clients,
    equipment,
    orders,
    companyId,
    loading,
    createClient,
    createEquipment,
    createOrder,
  } = usePrimeTech();
  const [form, setForm, clearDraft] = useSessionDraft<CreateOrderInput>('new-order-form', initialForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [quickCreate, setQuickCreate] = useState<QuickCreate>(null);
  const [specialties, setSpecialties] = useState<SpecialtyOption[]>(
    defaultTechnicalSpecialties.map((item) => ({ code: item.code, label: item.shortLabel })),
  );
  const [newClient, setNewClient] = useState({ personType: 'pf' as 'pf' | 'pj', name: '', document: '', phone: '' });
  const [newEquipment, setNewEquipment] = useState({ category: 'Notebook', brand: '', model: '', serial: '' });
  const [newSpecialty, setNewSpecialty] = useState({ name: '', description: '' });

  useEffect(() => {
    if (mode !== 'supabase' || !supabase || !companyId) return;
    let alive = true;
    void supabase
      .from('technical_specialties')
      .select('code,name')
      .eq('company_id', companyId)
      .eq('active', true)
      .order('sort_order')
      .order('name')
      .then(({ data, error: specialtyError }) => {
        if (!alive || specialtyError) return;
        const next = new Map<string, SpecialtyOption>();
        defaultTechnicalSpecialties.forEach((item) => next.set(item.code, { code: item.code, label: item.shortLabel }));
        (data ?? []).forEach((item) => next.set(String(item.code), { code: String(item.code), label: String(item.name) }));
        setSpecialties(Array.from(next.values()));
      });
    return () => { alive = false; };
  }, [companyId, mode]);

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

  async function createQuickClient() {
    if (!newClient.name.trim()) return setError('Informe o nome do cliente.');
    setBusy(true); setError('');
    try {
      const created = await createClient({
        person_type: newClient.personType,
        name: newClient.name.trim(),
        document: newClient.document.replace(/\D/g, '') || undefined,
        phone: newClient.phone.trim() || undefined,
      });
      setForm((current) => ({ ...current, client_id: created.id, equipment_id: '', technical_specialty_code: null, assigned_technician_id: null }));
      setNewClient({ personType: 'pf', name: '', document: '', phone: '' });
      setQuickCreate('equipment');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível cadastrar o cliente.');
    } finally { setBusy(false); }
  }

  async function createQuickEquipment() {
    if (!form.client_id) return setError('Selecione ou cadastre o cliente primeiro.');
    if (!newEquipment.category.trim()) return setError('Informe a categoria do equipamento.');
    setBusy(true); setError('');
    try {
      const inferred = inferTechnicalSpecialty(newEquipment.category);
      const created = await createEquipment({
        client_id: form.client_id,
        category: newEquipment.category.trim(),
        technical_specialty_code: inferred,
        brand: newEquipment.brand.trim() || undefined,
        model: newEquipment.model.trim() || undefined,
        serial_number: newEquipment.serial.trim() || undefined,
      });
      setForm((current) => ({
        ...current,
        equipment_id: created.id,
        technical_specialty_code: created.technical_specialty_code ?? inferred,
        assigned_technician_id: null,
      }));
      setNewEquipment({ category: 'Notebook', brand: '', model: '', serial: '' });
      setQuickCreate(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível cadastrar o equipamento.');
    } finally { setBusy(false); }
  }

  async function createQuickSpecialty() {
    if (!newSpecialty.name.trim()) return setError('Informe o nome da especialidade.');
    if (!supabase || !companyId || mode !== 'supabase') return setError('O cadastro de especialidade exige conexão com o Supabase.');
    const code = slugify(newSpecialty.name);
    if (!code) return setError('Informe um nome válido para a especialidade.');

    setBusy(true); setError('');
    try {
      const { data, error: insertError } = await supabase
        .from('technical_specialties')
        .insert({
          company_id: companyId,
          code,
          name: newSpecialty.name.trim(),
          description: newSpecialty.description.trim() || null,
          active: true,
          sort_order: 1000,
        })
        .select('code,name')
        .single();
      if (insertError) throw insertError;
      const option = { code: String(data.code), label: String(data.name) };
      setSpecialties((current) => [...current.filter((item) => item.code !== option.code), option]);
      setForm((current) => ({ ...current, technical_specialty_code: option.code, assigned_technician_id: null }));
      setNewSpecialty({ name: '', description: '' });
      setQuickCreate(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível cadastrar a especialidade.');
    } finally { setBusy(false); }
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
    <PageHeader eyebrow="Comercial" title="Nova Ordem de Serviço" description="Abra a OS sem sair da tela: cliente, equipamento e especialidade podem ser cadastrados pelos atalhos +. Cada OS recebe automaticamente um número único de identificação." />
    <section className="panel">
      <Link to="/ordens" className="back-link" style={{ marginBottom: 20 }}><ArrowLeft size={17} /> Voltar para Ordens de Serviço</Link>
      {loading ? <div className="empty-state"><Wrench size={38} /><h3>Carregando dados</h3><p>Buscando clientes e equipamentos cadastrados.</p></div> : (
        <form onSubmit={(event) => void handleSubmit(event)}>
          <div style={formGridStyle}>
            <label>
              <FieldLabel>Cliente</FieldLabel>
              <div className="select-with-action">
                <select required value={form.client_id} onChange={(e) => handleClientChange(e.target.value)} style={fieldStyle}>
                  <option value="">Selecione o cliente</option>
                  {clients.map((client) => <option key={client.id} value={client.id}>{client.name}{client.document ? ` · ${client.document}` : ''}</option>)}
                </select>
                {can(user, 'clients.manage') && <button type="button" className="select-add-button" title="Cadastrar cliente sem sair da OS" onClick={() => setQuickCreate(quickCreate === 'client' ? null : 'client')}><Plus size={18} /></button>}
              </div>
            </label>

            <label>
              <FieldLabel>Equipamento</FieldLabel>
              <div className="select-with-action">
                <select required disabled={!form.client_id} value={form.equipment_id} onChange={(e) => handleEquipmentChange(e.target.value)} style={{ ...fieldStyle, opacity: form.client_id ? 1 : .72 }}>
                  <option value="">{!form.client_id ? 'Selecione o cliente primeiro' : clientEquipment.length ? 'Selecione o equipamento' : 'Cliente sem equipamentos'}</option>
                  {clientEquipment.map((item) => <option key={item.id} value={item.id}>{equipmentCode(item.technical_number)} · {[item.category,item.brand,item.model].filter(Boolean).join(' ')}</option>)}
                </select>
                {can(user, 'equipment.manage') && <button type="button" className="select-add-button" disabled={!form.client_id} title="Cadastrar equipamento sem sair da OS" onClick={() => setQuickCreate(quickCreate === 'equipment' ? null : 'equipment')}><Plus size={18} /></button>}
              </div>
              {form.client_id && clientEquipment.length === 0 && <small style={helpStyle}>Nenhum equipamento ainda. Use o botão + ao lado para cadastrar agora.</small>}
            </label>

            {quickCreate === 'client' && (
              <div className="inline-create-card">
                <div className="panel-head"><div><span className="eyebrow">Cadastro rápido</span><h3>Novo cliente</h3></div><button type="button" className="ghost-button small" onClick={() => setQuickCreate(null)}><X size={15} /> Fechar</button></div>
                <div className="form-grid">
                  <label><span>Tipo</span><select value={newClient.personType} onChange={(e) => setNewClient((v) => ({ ...v, personType: e.target.value as 'pf' | 'pj' }))}><option value="pf">Pessoa Física</option><option value="pj">Pessoa Jurídica</option></select></label>
                  <label><span>Nome / Razão social</span><input value={newClient.name} onChange={(e) => setNewClient((v) => ({ ...v, name: e.target.value }))} /></label>
                  <label><span>CPF / CNPJ</span><input value={newClient.document} onChange={(e) => setNewClient((v) => ({ ...v, document: e.target.value }))} /></label>
                  <label><span>Telefone / WhatsApp</span><input value={newClient.phone} onChange={(e) => setNewClient((v) => ({ ...v, phone: e.target.value }))} /></label>
                </div>
                <div className="quick-actions" style={{ marginTop: 12 }}><button type="button" disabled={busy || !newClient.name.trim()} onClick={() => void createQuickClient()}><Save size={15} /> Salvar e selecionar cliente</button></div>
              </div>
            )}

            {quickCreate === 'equipment' && (
              <div className="inline-create-card">
                <div className="panel-head"><div><span className="eyebrow">Cadastro rápido</span><h3>Novo equipamento de {selectedClient?.name ?? 'cliente'}</h3></div><button type="button" className="ghost-button small" onClick={() => setQuickCreate(null)}><X size={15} /> Fechar</button></div>
                <div className="form-grid">
                  <label><span>Categoria</span><select value={newEquipment.category} onChange={(e) => setNewEquipment((v) => ({ ...v, category: e.target.value }))}>{['Notebook','Desktop','Impressora','Smartphone','Tablet','Monitor','Nobreak','Servidor','Outro'].map((value) => <option key={value}>{value}</option>)}</select></label>
                  <label><span>Marca</span><input value={newEquipment.brand} onChange={(e) => setNewEquipment((v) => ({ ...v, brand: e.target.value }))} /></label>
                  <label><span>Modelo</span><input value={newEquipment.model} onChange={(e) => setNewEquipment((v) => ({ ...v, model: e.target.value }))} /></label>
                  <label><span>Número de série</span><input value={newEquipment.serial} onChange={(e) => setNewEquipment((v) => ({ ...v, serial: e.target.value }))} /></label>
                </div>
                <div className="quick-actions" style={{ marginTop: 12 }}><button type="button" disabled={busy || !form.client_id} onClick={() => void createQuickEquipment()}><Save size={15} /> Salvar e selecionar equipamento</button></div>
              </div>
            )}

            <label>
              <FieldLabel>Especialidade técnica</FieldLabel>
              <div className="select-with-action">
                <select required value={form.technical_specialty_code ?? ''} onChange={(e) => setForm((v) => ({ ...v, technical_specialty_code: e.target.value || null, assigned_technician_id: null }))} style={fieldStyle}>
                  <option value="">Selecione a especialidade</option>
                  {specialties.map((specialty) => <option key={specialty.code} value={specialty.code}>{specialty.label}</option>)}
                </select>
                {can(user, 'settings.manage') && <button type="button" className="select-add-button" title="Criar nova especialidade técnica" onClick={() => setQuickCreate(quickCreate === 'specialty' ? null : 'specialty')}><Plus size={18} /></button>}
              </div>
              <small style={helpStyle}>A especialidade separa a OS por área e limita a atribuição aos técnicos compatíveis.</small>
            </label>

            <label><FieldLabel>Tipo de entrada</FieldLabel><select value={form.intake_type} onChange={(e) => setForm((v) => ({ ...v, intake_type: e.target.value }))} style={fieldStyle}><option>Orçamento</option><option>Manutenção</option><option>Diagnóstico</option><option>Garantia</option></select></label>

            {quickCreate === 'specialty' && (
              <div className="inline-create-card">
                <div className="panel-head"><div><span className="eyebrow">Categoria técnica</span><h3>Nova especialidade</h3></div><button type="button" className="ghost-button small" onClick={() => setQuickCreate(null)}><X size={15} /> Fechar</button></div>
                <div className="form-grid">
                  <label><span>Nome</span><input value={newSpecialty.name} onChange={(e) => setNewSpecialty((v) => ({ ...v, name: e.target.value }))} placeholder="Ex.: Redes e infraestrutura" /></label>
                  <label><span>Descrição</span><input value={newSpecialty.description} onChange={(e) => setNewSpecialty((v) => ({ ...v, description: e.target.value }))} placeholder="Escopo da área técnica" /></label>
                </div>
                <div className="quick-actions" style={{ marginTop: 12 }}><button type="button" disabled={busy || !newSpecialty.name.trim()} onClick={() => void createQuickSpecialty()}><Save size={15} /> Criar e selecionar especialidade</button></div>
              </div>
            )}

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
          {!clients.length && <div className="notice" style={{ marginTop: 18 }}><AlertTriangle /><div><strong>Nenhum cliente cadastrado</strong><p>Use o botão + ao lado de Cliente para cadastrar sem sair da OS.</p></div></div>}

          <div className="form-footer" style={{ marginTop: 22, justifyContent: 'flex-end' }}><button type="button" className="ghost-button" onClick={cancelDraft}>Cancelar e descartar</button><button type="submit" className="primary-button" disabled={busy || !form.client_id || !form.equipment_id || !form.technical_specialty_code || !form.reported_issue.trim() || Boolean(activeOrder)}><Save size={17} />{busy ? 'Criando OS...' : 'Criar Ordem de Serviço'}</button></div>
        </form>
      )}
    </section>
    <section className="panel" style={{ marginTop: 16 }}><div className="panel-head"><div><span className="eyebrow">Próxima etapa</span><h2>Fluxo automático</h2></div></div><div className="flow-grid"><FlowItem number="1" title="OS identificada" text="O banco gera automaticamente um número único como OS #000001." /><FlowItem number="2" title="Fila especializada" text="A OS entra na área técnica correta e só aceita técnicos compatíveis quando configurados." /><FlowItem number="3" title="Retorno comercial" text="Após diagnóstico, volta ao Comercial para orçamento e prazo ao cliente." /></div></section>
  </>;
}

function FieldLabel({ children }: { children: React.ReactNode }) { return <span style={{ display:'block',marginBottom:6,color:'var(--muted)',fontSize:12 }}>{children}</span>; }
function FlowItem({ number, title, text }: { number:string; title:string; text:string }) { return <article style={{ padding:15,borderRadius:12,border:'1px solid var(--line)',background:'var(--surface2)' }}><span style={{ width:28,height:28,display:'grid',placeItems:'center',borderRadius:8,background:'rgba(47,140,255,.15)',color:'var(--blue2)',fontSize:12,fontWeight:800,marginBottom:10 }}>{number}</span><strong style={{ display:'block',fontSize:13 }}>{title}</strong><p style={{ color:'var(--muted)',fontSize:12,marginTop:5,lineHeight:1.5 }}>{text}</p></article>; }
const formGridStyle: CSSProperties = { display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:16 };
const fieldStyle: CSSProperties = { width:'100%',minHeight:42,padding:'10px 12px',borderRadius:10,border:'1px solid var(--line)',background:'var(--surface2)',color:'var(--premium-text)',outline:'none' };
const helpStyle: CSSProperties = { display:'block',marginTop:6,color:'var(--muted)',fontSize:11 };
const summaryGridStyle: CSSProperties = { marginTop:18,display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:12 };
const summaryStyle: CSSProperties = { display:'flex',alignItems:'center',gap:11,padding:13,border:'1px solid var(--line)',borderRadius:12,background:'var(--surface2)',color:'var(--blue2)' };
const warningStyle: CSSProperties = { marginTop:18,padding:14,display:'flex',gap:12,alignItems:'flex-start',border:'1px solid rgba(244,184,74,.28)',background:'rgba(244,184,74,.07)',borderRadius:12 };
const errorStyle: CSSProperties = { marginTop:18,padding:12,borderRadius:10,border:'1px solid rgba(239,101,113,.25)',background:'rgba(239,101,113,.08)',color:'#f3838c',fontSize:13 };
