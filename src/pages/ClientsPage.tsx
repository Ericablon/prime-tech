import { Edit3, Plus, Search, Users, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { PageHeader } from '../components/ui/PageHeader';
import { useAuth } from '../contexts/AuthContext';
import { usePrimeTech } from '../contexts/PrimeTechContext';
import { useSessionDraft } from '../hooks/useSessionDraft';
import { can } from '../lib/permissions';
import { supabase } from '../lib/supabase';
import type { Client, CreateClientInput } from '../types/domain';

type ClientForm = CreateClientInput & { id?: string };

const emptyForm: ClientForm = {
  person_type: 'pf',
  name: '',
  document: '',
  phone: '',
  email: '',
  address: '',
  notes: '',
  state_registration: '',
  municipal_registration: '',
  ie_indicator: '9',
  street: '',
  address_number: '',
  address_complement: '',
  district: '',
  city: '',
  city_code: '',
  state: 'BA',
  postal_code: '',
  country_code: '1058',
  country_name: 'Brasil',
};

function toForm(client: Client): ClientForm {
  return {
    id: client.id,
    person_type: client.person_type,
    name: client.name,
    document: client.document ?? '',
    phone: client.phone ?? '',
    email: client.email ?? '',
    address: client.address ?? '',
    notes: client.notes ?? '',
    state_registration: client.state_registration ?? '',
    municipal_registration: client.municipal_registration ?? '',
    ie_indicator: client.ie_indicator ?? '9',
    street: client.street ?? '',
    address_number: client.address_number ?? '',
    address_complement: client.address_complement ?? '',
    district: client.district ?? '',
    city: client.city ?? '',
    city_code: client.city_code ?? '',
    state: client.state ?? 'BA',
    postal_code: client.postal_code ?? '',
    country_code: client.country_code ?? '1058',
    country_name: client.country_name ?? 'Brasil',
  };
}

export function ClientsPage() {
  const { user, mode } = useAuth();
  const { clients, equipment, orders, loading, error: contextError, createClient, refresh } = usePrimeTech();
  const [searchParams] = useSearchParams();

  const [search, setSearch] = useState(() => searchParams.get('busca') ?? '');
  const [open, setOpen, clearOpenDraft] = useSessionDraft('client-form-open', false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm, clearFormDraft] = useSessionDraft<ClientForm>('client-form', emptyForm);

  useEffect(() => {
    setSearch(searchParams.get('busca') ?? '');
  }, [searchParams]);

  const filteredClients = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return clients;
    return clients.filter((client) => [client.name, client.document, client.phone, client.email, client.city, client.state]
      .filter(Boolean).join(' ').toLowerCase().includes(term));
  }, [clients, search]);

  const close = () => {
    clearOpenDraft();
    clearFormDraft();
    setFormError('');
  };

  const openNew = () => {
    clearFormDraft();
    setFormError('');
    setOpen(true);
  };

  const openEdit = (client: Client) => {
    setForm(toForm(client));
    setFormError('');
    setOpen(true);
  };

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setFormError('');

    const payload: CreateClientInput = {
      ...form,
      name: form.name.trim(),
      document: form.document?.replace(/\D/g, '') || undefined,
      phone: form.phone?.trim(),
      email: form.email?.trim(),
      address: form.address?.trim(),
      notes: form.notes?.trim(),
      state_registration: form.state_registration?.trim(),
      municipal_registration: form.municipal_registration?.trim(),
      street: form.street?.trim(),
      address_number: form.address_number?.trim(),
      address_complement: form.address_complement?.trim(),
      district: form.district?.trim(),
      city: form.city?.trim(),
      city_code: form.city_code?.replace(/\D/g, ''),
      state: form.state?.toUpperCase().trim(),
      postal_code: form.postal_code?.replace(/\D/g, ''),
      country_code: '1058',
      country_name: 'Brasil',
    };

    try {
      if (form.id) {
        if (mode !== 'supabase' || !supabase) throw new Error('Edição de cliente exige conexão com o Supabase.');
        const { error } = await supabase.from('clients').update(payload).eq('id', form.id);
        if (error) throw error;
        await refresh();
      } else {
        await createClient(payload);
      }
      close();
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Não foi possível salvar o cliente.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Comercial"
        title="Clientes"
        description="Cadastro único de clientes, endereço fiscal, equipamentos e Ordens de Serviço."
        actions={can(user, 'clients.manage') ? <button type="button" className="primary-button" onClick={openNew}><Plus size={17} /> Novo cliente</button> : undefined}
      />

      {open && (
        <section className="panel" style={{ marginBottom: 18 }}>
          <div className="panel-head">
            <div><span className="eyebrow">Cadastro</span><h2>{form.id ? 'Editar cliente' : 'Novo cliente'}</h2></div>
            <button type="button" className="ghost-button small" onClick={close}><X size={16} /> Fechar</button>
          </div>

          <div className="notice" style={{ marginBottom: 14 }}>
            <div><strong>Rascunho automático</strong><p>Você pode trocar de módulo para consultar um CNPJ ou outra informação e voltar: os dados permanecem nesta sessão até salvar ou cancelar.</p></div>
          </div>

          <form onSubmit={(event) => void handleSubmit(event)} style={{ display: 'grid', gap: 16 }}>
            <div className="form-grid">
              <label><span>Tipo de pessoa</span><select value={form.person_type} onChange={(e) => setForm((v) => ({ ...v, person_type: e.target.value as 'pf' | 'pj' }))}><option value="pf">Pessoa Física</option><option value="pj">Pessoa Jurídica</option></select></label>
              <label><span>Nome / Razão social</span><input required value={form.name} onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))} /></label>
              <label><span>CPF / CNPJ</span><input value={form.document ?? ''} onChange={(e) => setForm((v) => ({ ...v, document: e.target.value }))} /></label>
              <label><span>Telefone / WhatsApp</span><input value={form.phone ?? ''} onChange={(e) => setForm((v) => ({ ...v, phone: e.target.value }))} /></label>
              <label><span>E-mail</span><input type="email" value={form.email ?? ''} onChange={(e) => setForm((v) => ({ ...v, email: e.target.value }))} /></label>
              <label><span>Indicador IE</span><select value={form.ie_indicator ?? '9'} onChange={(e) => setForm((v) => ({ ...v, ie_indicator: e.target.value as '1' | '2' | '9' }))}><option value="9">Não contribuinte</option><option value="1">Contribuinte ICMS</option><option value="2">Contribuinte isento</option></select></label>
              <label><span>Inscrição Estadual</span><input value={form.state_registration ?? ''} onChange={(e) => setForm((v) => ({ ...v, state_registration: e.target.value }))} /></label>
              <label><span>Inscrição Municipal</span><input value={form.municipal_registration ?? ''} onChange={(e) => setForm((v) => ({ ...v, municipal_registration: e.target.value }))} /></label>
            </div>

            <div>
              <span className="eyebrow">Endereço fiscal</span>
              <div className="form-grid" style={{ marginTop: 10 }}>
                <label><span>CEP</span><input value={form.postal_code ?? ''} onChange={(e) => setForm((v) => ({ ...v, postal_code: e.target.value }))} /></label>
                <label><span>Logradouro</span><input value={form.street ?? ''} onChange={(e) => setForm((v) => ({ ...v, street: e.target.value }))} /></label>
                <label><span>Número</span><input value={form.address_number ?? ''} onChange={(e) => setForm((v) => ({ ...v, address_number: e.target.value }))} /></label>
                <label><span>Complemento</span><input value={form.address_complement ?? ''} onChange={(e) => setForm((v) => ({ ...v, address_complement: e.target.value }))} /></label>
                <label><span>Bairro</span><input value={form.district ?? ''} onChange={(e) => setForm((v) => ({ ...v, district: e.target.value }))} /></label>
                <label><span>Município</span><input value={form.city ?? ''} onChange={(e) => setForm((v) => ({ ...v, city: e.target.value }))} /></label>
                <label><span>Código IBGE</span><input value={form.city_code ?? ''} onChange={(e) => setForm((v) => ({ ...v, city_code: e.target.value }))} /></label>
                <label><span>UF</span><input maxLength={2} value={form.state ?? ''} onChange={(e) => setForm((v) => ({ ...v, state: e.target.value.toUpperCase() }))} /></label>
              </div>
            </div>

            <label><span>Observações</span><textarea rows={3} value={form.notes ?? ''} onChange={(e) => setForm((v) => ({ ...v, notes: e.target.value }))} /></label>

            {formError && <div className="notice"><div><strong>Não foi possível salvar</strong><p>{formError}</p></div></div>}
            <div className="quick-actions"><button type="button" className="ghost-button" onClick={close} disabled={busy}>Cancelar</button><button className="primary-button" disabled={busy || !form.name.trim()}>{busy ? 'Salvando...' : 'Salvar cliente'}</button></div>
          </form>
        </section>
      )}

      {contextError && <section className="notice" style={{ marginBottom: 16 }}><div><strong>Não foi possível carregar todos os dados</strong><p>{contextError}</p></div></section>}

      <section className="panel">
        <div className="filters"><div className="filter-search"><Search size={16} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome, CPF/CNPJ, telefone, e-mail ou cidade" /></div></div>

        {loading ? <div className="empty-state"><Users /><h3>Carregando clientes</h3></div> : filteredClients.length === 0 ? <div className="empty-state"><Users /><h3>Nenhum cliente encontrado</h3><p>Cadastre o primeiro cliente ou altere sua busca.</p></div> : (
          <div className="table-wrap"><table><thead><tr><th>Cliente</th><th>Documento</th><th>Contato</th><th>Fiscal</th><th>Equipamentos</th><th>OS</th>{can(user, 'clients.manage') && <th>Ação</th>}</tr></thead><tbody>
            {filteredClients.map((client) => {
              const equipmentCount = equipment.filter((item) => item.client_id === client.id).length;
              const orderCount = orders.filter((order) => order.client_id === client.id).length;
              const fiscalReady = Boolean(client.document && client.street && client.city && client.state && client.postal_code);
              return <tr key={client.id}>
                <td><strong>{client.name}</strong><small>{client.person_type === 'pj' ? 'Pessoa Jurídica' : 'Pessoa Física'}</small></td>
                <td>{client.document || '—'}</td>
                <td><strong>{client.phone || '—'}</strong><small>{client.email || 'Sem e-mail'}</small></td>
                <td><span className={`stock-state ${fiscalReady ? 'ok' : 'critical'}`}>{fiscalReady ? 'Cadastro fiscal OK' : 'Completar fiscal'}</span><small>{client.city ? `${client.city}/${client.state ?? ''}` : 'Endereço incompleto'}</small></td>
                <td><strong>{equipmentCount}</strong><small>equipamento{equipmentCount === 1 ? '' : 's'}</small></td>
                <td><strong>{orderCount}</strong><small>ordem{orderCount === 1 ? '' : 'ens'}</small></td>
                {can(user, 'clients.manage') && <td><button type="button" className="ghost-button" onClick={() => openEdit(client)}><Edit3 size={15} /> Editar</button></td>}
              </tr>;
            })}
          </tbody></table></div>
        )}
      </section>
    </>
  );
}
