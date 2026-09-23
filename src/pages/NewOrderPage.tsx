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
import { can } from '../lib/permissions';
import { supabase } from '../lib/supabase';
import { defaultTechnicalSpecialties, inferTechnicalSpecialty, technicalSpecialtyLabel } from '../lib/technicalSpecialties';
import type { Priority } from '../types/domain';

type NewOrderForm = {
  client_id: string;
  equipment_description: string;
  equipment_serial_number: string;
  equipment_accessories: string;
  equipment_notes: string;
  intake_type: string;
  reported_issue: string;
  priority: Priority;
  technical_specialty_code: string | null;
};

type QuickCreate = 'client' | 'specialty' | null;
type SpecialtyOption = { code: string; label: string };

const initialForm: NewOrderForm = {
  client_id: '',
  equipment_description: '',
  equipment_serial_number: '',
  equipment_accessories: '',
  equipment_notes: '',
  intake_type: 'Orçamento',
  reported_issue: '',
  priority: 'normal',
  technical_specialty_code: null,
};

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
    companyId,
    loading,
    createClient,
    createEquipment,
    createOrder,
    refresh,
  } = usePrimeTech();

  const [form, setForm, clearDraft] = useSessionDraft<NewOrderForm>('new-order-form-v2', initialForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [quickCreate, setQuickCreate] = useState<QuickCreate>(null);
  const [specialties, setSpecialties] = useState<SpecialtyOption[]>(
    defaultTechnicalSpecialties.map((item) => ({ code: item.code, label: item.shortLabel })),
  );
  const [newClient, setNewClient] = useState({ personType: 'pf' as 'pf' | 'pj', name: '', document: '', phone: '' });
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

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === form.client_id),
    [clients, form.client_id],
  );

  function handleClientChange(clientId: string) {
    setError('');
    setForm((current) => ({ ...current, client_id: clientId }));
  }

  function handleEquipmentDescription(value: string) {
    setForm((current) => ({
      ...current,
      equipment_description: value,
      technical_specialty_code: current.technical_specialty_code || (value.trim() ? inferTechnicalSpecialty(value) : null),
    }));
  }

  async function createQuickClient() {
    if (!newClient.name.trim()) return setError('Informe o nome do cliente.');
    setBusy(true);
    setError('');
    try {
      const created = await createClient({
        person_type: newClient.personType,
        name: newClient.name.trim(),
        document: newClient.document.replace(/\D/g, '') || undefined,
        phone: newClient.phone.trim() || undefined,
      });
      setForm((current) => ({ ...current, client_id: created.id }));
      setNewClient({ personType: 'pf', name: '', document: '', phone: '' });
      setQuickCreate(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível cadastrar o cliente.');
    } finally {
      setBusy(false);
    }
  }

  async function createQuickSpecialty() {
    if (!newSpecialty.name.trim()) return setError('Informe o nome da especialidade.');
    if (!supabase || !companyId || mode !== 'supabase') return setError('O cadastro de especialidade exige conexão com o Supabase.');
    const code = slugify(newSpecialty.name);
    if (!code) return setError('Informe um nome válido para a especialidade.');

    setBusy(true);
    setError('');
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
      setForm((current) => ({ ...current, technical_specialty_code: option.code }));
      setNewSpecialty({ name: '', description: '' });
      setQuickCreate(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível cadastrar a especialidade.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    if (!form.client_id) return setError('Selecione o cliente.');
    if (!form.equipment_description.trim()) return setError('Descreva o equipamento recebido.');
    if (!form.technical_specialty_code) return setError('Defina a especialidade técnica responsável pela OS.');
    if (!form.reported_issue.trim()) return setError('Informe o problema relatado pelo cliente.');

    setBusy(true);
    try {
      let orderId: string;

      if (mode === 'supabase') {
        if (!supabase || !companyId) throw new Error('Empresa atual não identificada.');
        const { data, error: insertError } = await supabase
          .from('service_orders')
          .insert({
            company_id: companyId,
            client_id: form.client_id,
            equipment_id: null,
            equipment_description: form.equipment_description.trim(),
            equipment_serial_number: form.equipment_serial_number.trim().toUpperCase() || null,
            equipment_accessories: form.equipment_accessories.trim() || null,
            equipment_notes: form.equipment_notes.trim() || null,
            technical_specialty_code: form.technical_specialty_code,
            intake_type: form.intake_type,
            reported_issue: form.reported_issue.trim(),
            priority: form.priority,
            assigned_technician_id: null,
            status: 'waiting_technician',
            approval_status: 'pending',
            opened_by: user?.id,
          })
          .select('id')
          .single();

        if (insertError) throw insertError;
        orderId = String(data.id);
        await refresh();
      } else {
        // O modo demo mantém o modelo legado internamente para que os testes
        // continuem sem tocar no Supabase real. Para o usuário, o fluxo é igual:
        // basta descrever o equipamento, sem cadastrá-lo previamente.
        const transientEquipment = await createEquipment({
          client_id: form.client_id,
          category: form.equipment_description.trim(),
          technical_specialty_code: form.technical_specialty_code,
          serial_number: form.equipment_serial_number.trim().toUpperCase() || undefined,
          accessories: form.equipment_accessories.trim() || undefined,
          notes: form.equipment_notes.trim() || undefined,
        });
        const created = await createOrder({
          client_id: form.client_id,
          equipment_id: transientEquipment.id,
          intake_type: form.intake_type,
          reported_issue: form.reported_issue.trim(),
          priority: form.priority,
          technical_specialty_code: form.technical_specialty_code,
          assigned_technician_id: null,
        });
        orderId = created.id;
      }

      clearDraft();
      navigate(`/ordens/${orderId}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível criar a Ordem de Serviço.');
    } finally {
      setBusy(false);
    }
  }

  function cancelDraft() {
    clearDraft();
    navigate('/ordens');
  }

  return <>
    <PageHeader
      eyebrow="Comercial"
      title="Nova Ordem de Serviço"
      description="Selecione o cliente e descreva o equipamento que acabou de entrar. Não é necessário cadastrar ou selecionar um equipamento antes de abrir a OS."
    />

    <section className="notice" style={{ marginBottom: 16 }}>
      <Laptop size={20} />
      <div>
        <strong>Entrada rápida de equipamento</strong>
        <p>A descrição, número de série, acessórios e estado físico ficam registrados nesta OS exatamente como foram recebidos no balcão.</p>
      </div>
    </section>

    <section className="panel">
      <Link to="/ordens" className="back-link" style={{ marginBottom: 20 }}><ArrowLeft size={17} /> Voltar para Ordens de Serviço</Link>

      {loading ? <div className="empty-state"><Wrench size={38} /><h3>Carregando dados</h3><p>Buscando clientes e configurações da empresa.</p></div> : (
        <form onSubmit={(event) => void handleSubmit(event)}>
          <div style={formGridStyle}>
            <label>
              <FieldLabel>Cliente</FieldLabel>
              <div className="select-with-action">
                <select required value={form.client_id} onChange={(event) => handleClientChange(event.target.value)} style={fieldStyle}>
                  <option value="">Selecione o cliente</option>
                  {clients.map((client) => <option key={client.id} value={client.id}>{client.name}{client.document ? ` · ${client.document}` : ''}</option>)}
                </select>
                {can(user, 'clients.manage') && <button type="button" className="select-add-button" title="Cadastrar cliente sem sair da OS" onClick={() => setQuickCreate(quickCreate === 'client' ? null : 'client')}><Plus size={18} /></button>}
              </div>
            </label>

            <label>
              <FieldLabel>Equipamento recebido</FieldLabel>
              <input
                required
                value={form.equipment_description}
                onChange={(event) => handleEquipmentDescription(event.target.value)}
                placeholder="Ex.: Notebook Lenovo Ideapad 3 / Impressora Epson L3250"
                style={fieldStyle}
              />
              <small style={helpStyle}>Escreva como você quer que o equipamento apareça na OS e no orçamento.</small>
            </label>

            {quickCreate === 'client' && (
              <div className="inline-create-card" style={{ gridColumn: '1 / -1' }}>
                <div className="panel-head"><div><span className="eyebrow">Cadastro rápido</span><h3>Novo cliente</h3></div><button type="button" className="ghost-button small" onClick={() => setQuickCreate(null)}><X size={15} /> Fechar</button></div>
                <div className="form-grid">
                  <label><span>Tipo</span><select value={newClient.personType} onChange={(event) => setNewClient((value) => ({ ...value, personType: event.target.value as 'pf' | 'pj' }))}><option value="pf">Pessoa Física</option><option value="pj">Pessoa Jurídica</option></select></label>
                  <label><span>Nome / Razão social</span><input value={newClient.name} onChange={(event) => setNewClient((value) => ({ ...value, name: event.target.value }))} /></label>
                  <label><span>CPF / CNPJ</span><input value={newClient.document} onChange={(event) => setNewClient((value) => ({ ...value, document: event.target.value }))} /></label>
                  <label><span>Telefone / WhatsApp</span><input value={newClient.phone} onChange={(event) => setNewClient((value) => ({ ...value, phone: event.target.value }))} /></label>
                </div>
                <div className="quick-actions" style={{ marginTop: 12 }}><button type="button" disabled={busy || !newClient.name.trim()} onClick={() => void createQuickClient()}><Save size={15} /> Salvar e selecionar cliente</button></div>
              </div>
            )}

            <label>
              <FieldLabel>Número de série</FieldLabel>
              <input value={form.equipment_serial_number} onChange={(event) => setForm((value) => ({ ...value, equipment_serial_number: event.target.value }))} placeholder="Opcional" style={fieldStyle} />
            </label>

            <label>
              <FieldLabel>Acessórios recebidos</FieldLabel>
              <input value={form.equipment_accessories} onChange={(event) => setForm((value) => ({ ...value, equipment_accessories: event.target.value }))} placeholder="Carregador, fonte, cabo, bolsa..." style={fieldStyle} />
            </label>

            <label style={{ gridColumn: '1 / -1' }}>
              <FieldLabel>Estado físico / observações do equipamento</FieldLabel>
              <textarea value={form.equipment_notes} onChange={(event) => setForm((value) => ({ ...value, equipment_notes: event.target.value }))} rows={3} placeholder="Ex.: tampa riscada, carcaça trincada, sem parafuso, equipamento molhado..." style={{ ...fieldStyle, resize: 'vertical' }} />
            </label>

            <label>
              <FieldLabel>Especialidade técnica</FieldLabel>
              <div className="select-with-action">
                <select required value={form.technical_specialty_code ?? ''} onChange={(event) => setForm((value) => ({ ...value, technical_specialty_code: event.target.value || null }))} style={fieldStyle}>
                  <option value="">Selecione a especialidade</option>
                  {specialties.map((specialty) => <option key={specialty.code} value={specialty.code}>{specialty.label}</option>)}
                </select>
                {can(user, 'settings.manage') && <button type="button" className="select-add-button" title="Criar nova especialidade técnica" onClick={() => setQuickCreate(quickCreate === 'specialty' ? null : 'specialty')}><Plus size={18} /></button>}
              </div>
              <small style={helpStyle}>A especialidade organiza a fila técnica; o Cronos tenta sugerir uma conforme a descrição do equipamento.</small>
            </label>

            <label>
              <FieldLabel>Tipo de entrada</FieldLabel>
              <select value={form.intake_type} onChange={(event) => setForm((value) => ({ ...value, intake_type: event.target.value }))} style={fieldStyle}>
                <option>Orçamento</option><option>Manutenção</option><option>Diagnóstico</option><option>Garantia</option>
              </select>
            </label>

            {quickCreate === 'specialty' && (
              <div className="inline-create-card" style={{ gridColumn: '1 / -1' }}>
                <div className="panel-head"><div><span className="eyebrow">Categoria técnica</span><h3>Nova especialidade</h3></div><button type="button" className="ghost-button small" onClick={() => setQuickCreate(null)}><X size={15} /> Fechar</button></div>
                <div className="form-grid">
                  <label><span>Nome</span><input value={newSpecialty.name} onChange={(event) => setNewSpecialty((value) => ({ ...value, name: event.target.value }))} placeholder="Ex.: Redes e infraestrutura" /></label>
                  <label><span>Descrição</span><input value={newSpecialty.description} onChange={(event) => setNewSpecialty((value) => ({ ...value, description: event.target.value }))} placeholder="Escopo da área técnica" /></label>
                </div>
                <div className="quick-actions" style={{ marginTop: 12 }}><button type="button" disabled={busy || !newSpecialty.name.trim()} onClick={() => void createQuickSpecialty()}><Save size={15} /> Criar e selecionar especialidade</button></div>
              </div>
            )}

            <label>
              <FieldLabel>Prioridade</FieldLabel>
              <select value={form.priority} onChange={(event) => setForm((value) => ({ ...value, priority: event.target.value as Priority }))} style={fieldStyle}>
                <option value="low">Baixa</option><option value="normal">Normal</option><option value="high">Alta</option><option value="urgent">Urgente</option>
              </select>
            </label>

            <label style={{ gridColumn: '1 / -1' }}>
              <FieldLabel>Problema relatado pelo cliente</FieldLabel>
              <textarea required rows={5} value={form.reported_issue} onChange={(event) => setForm((value) => ({ ...value, reported_issue: event.target.value }))} placeholder="Descreva exatamente o problema informado pelo cliente..." style={{ ...fieldStyle, resize: 'vertical' }} />
            </label>
          </div>

          {selectedClient && form.equipment_description.trim() && (
            <div style={summaryGridStyle}>
              <div style={summaryStyle}><UserRound size={19} /><div><strong>{selectedClient.name}</strong><small>{selectedClient.phone || selectedClient.email || 'Sem contato informado'}</small></div></div>
              <div style={summaryStyle}><Laptop size={19} /><div><strong>{form.equipment_description.trim()}</strong><small>{form.equipment_serial_number.trim() ? `Série ${form.equipment_serial_number.trim().toUpperCase()}` : 'Série não informada'}</small></div></div>
              <div style={{ ...summaryStyle, gridColumn: '1 / -1' }}>{form.technical_specialty_code === 'impressoras' ? <Printer size={19} /> : <CircuitBoard size={19} />}<div><strong>Fila: {technicalSpecialtyLabel(form.technical_specialty_code)}</strong><small>Esta descrição ficará congelada na OS, sem depender de um cadastro permanente de equipamento.</small></div></div>
            </div>
          )}

          {error && <div style={errorStyle}><AlertTriangle size={17} /> {error}</div>}
          {!clients.length && <div className="notice" style={{ marginTop: 18 }}><AlertTriangle /><div><strong>Nenhum cliente cadastrado</strong><p>Use o botão + ao lado de Cliente para cadastrar sem sair da OS.</p></div></div>}

          <div className="form-footer" style={{ marginTop: 22, justifyContent: 'flex-end' }}>
            <button type="button" className="ghost-button" onClick={cancelDraft}>Cancelar e descartar</button>
            <button type="submit" className="primary-button" disabled={busy || !form.client_id || !form.equipment_description.trim() || !form.technical_specialty_code || !form.reported_issue.trim()}>
              <Save size={17} />{busy ? 'Criando OS...' : 'Criar Ordem de Serviço'}
            </button>
          </div>
        </form>
      )}
    </section>

    <section className="panel" style={{ marginTop: 16 }}>
      <div className="panel-head"><div><span className="eyebrow">Próxima etapa</span><h2>Fluxo automático</h2></div></div>
      <div className="flow-grid">
        <FlowItem number="1" title="OS identificada" text="O banco gera automaticamente um número único como OS #000001." />
        <FlowItem number="2" title="Equipamento registrado na OS" text="Descrição, série, acessórios e estado físico ficam preservados exatamente como entraram na loja." />
        <FlowItem number="3" title="Fila especializada" text="A OS segue para a área técnica correta e depois retorna ao Comercial para orçamento e aprovação." />
      </div>
    </section>
  </>;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span style={{ display: 'block', marginBottom: 6, color: 'var(--muted)', fontSize: 12 }}>{children}</span>;
}

function FlowItem({ number, title, text }: { number: string; title: string; text: string }) {
  return <article style={{ padding: 15, borderRadius: 12, border: '1px solid var(--line)', background: 'var(--surface2)' }}><span style={{ width: 28, height: 28, display: 'grid', placeItems: 'center', borderRadius: 8, background: 'rgba(47,140,255,.15)', color: 'var(--blue2)', fontSize: 12, fontWeight: 800, marginBottom: 10 }}>{number}</span><strong style={{ display: 'block', fontSize: 13 }}>{title}</strong><p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 5, lineHeight: 1.5 }}>{text}</p></article>;
}

const formGridStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 16 };
const fieldStyle: CSSProperties = { width: '100%', minHeight: 42, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--surface2)', color: 'var(--premium-text)', outline: 'none' };
const helpStyle: CSSProperties = { display: 'block', marginTop: 6, color: 'var(--muted)', fontSize: 11 };
const summaryGridStyle: CSSProperties = { marginTop: 18, display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 12 };
const summaryStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: 11, padding: 13, border: '1px solid var(--line)', borderRadius: 12, background: 'var(--surface2)', color: 'var(--blue2)' };
const errorStyle: CSSProperties = { marginTop: 18, padding: 12, display: 'flex', gap: 8, alignItems: 'center', borderRadius: 10, border: '1px solid rgba(239,101,113,.25)', background: 'rgba(239,101,113,.08)', color: '#f3838c', fontSize: 13 };
