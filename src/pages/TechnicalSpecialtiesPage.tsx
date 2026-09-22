import {
  AlertTriangle,
  CheckCircle2,
  CircuitBoard,
  Plus,
  Printer,
  RefreshCw,
  Save,
  UserCog,
  Users,
} from 'lucide-react';
import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

import { PageHeader } from '../components/ui/PageHeader';
import { useAuth } from '../contexts/AuthContext';
import { usePrimeTech } from '../contexts/PrimeTechContext';
import { technicalSpecialtyLabel } from '../lib/technicalSpecialties';
import { supabase } from '../lib/supabase';

type Specialty = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  active: boolean;
  sort_order: number;
};

type Technician = {
  id: string;
  full_name: string;
  email?: string | null;
};

type Mapping = {
  user_id: string;
  technical_specialty_id: string;
  is_primary: boolean;
  active: boolean;
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

export function TechnicalSpecialtiesPage() {
  const { mode } = useAuth();
  const { companyId } = usePrimeTech();

  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [newSpecialty, setNewSpecialty] = useState({ name: '', description: '' });

  const load = useCallback(async () => {
    if (mode !== 'supabase' || !supabase || !companyId) {
      setLoading(false);
      setError('A gestão de especialidades exige o ambiente conectado ao Supabase.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const [{ data: specialtyData, error: specialtyError }, { data: accessData, error: accessError }] = await Promise.all([
        supabase
          .from('technical_specialties')
          .select('id, code, name, description, active, sort_order')
          .eq('company_id', companyId)
          .order('sort_order')
          .order('name'),
        supabase
          .from('user_company_access')
          .select('user_id, role_code')
          .eq('company_id', companyId)
          .eq('active', true),
      ]);

      if (specialtyError) throw specialtyError;
      if (accessError) throw accessError;

      const techIds = (accessData ?? [])
        .filter((row) => String(row.role_code) === 'tecnico')
        .map((row) => String(row.user_id));

      let profileData: Array<{ id: string; full_name: string; email?: string | null }> = [];
      if (techIds.length) {
        const { data, error: profileError } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', techIds)
          .order('full_name');
        if (profileError) throw profileError;
        profileData = (data ?? []) as typeof profileData;
      }

      const { data: mappingData, error: mappingError } = await supabase
        .from('profile_technical_specialties')
        .select('user_id, technical_specialty_id, is_primary, active')
        .eq('company_id', companyId)
        .eq('active', true);
      if (mappingError) throw mappingError;

      setSpecialties((specialtyData ?? []) as Specialty[]);
      setTechnicians(profileData as Technician[]);
      setMappings((mappingData ?? []) as Mapping[]);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Não foi possível carregar as especialidades técnicas.',
      );
    } finally {
      setLoading(false);
    }
  }, [companyId, mode]);

  useEffect(() => {
    void load();
  }, [load]);

  const configuredTechnicians = useMemo(
    () => new Set(mappings.map((mapping) => mapping.user_id)).size,
    [mappings],
  );

  function hasMapping(userId: string, specialtyId: string) {
    return mappings.some(
      (mapping) => mapping.user_id === userId
        && mapping.technical_specialty_id === specialtyId
        && mapping.active,
    );
  }

  async function toggleMapping(userId: string, specialtyId: string, enabled: boolean) {
    if (!supabase || !companyId) return;

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      if (enabled) {
        const { error: upsertError } = await supabase
          .from('profile_technical_specialties')
          .upsert({
            company_id: companyId,
            user_id: userId,
            technical_specialty_id: specialtyId,
            active: true,
            is_primary: false,
          }, { onConflict: 'company_id,user_id,technical_specialty_id' });
        if (upsertError) throw upsertError;
      } else {
        const { error: deleteError } = await supabase
          .from('profile_technical_specialties')
          .delete()
          .eq('company_id', companyId)
          .eq('user_id', userId)
          .eq('technical_specialty_id', specialtyId);
        if (deleteError) throw deleteError;
      }

      setSuccess('Especialidades do técnico atualizadas.');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível atualizar o técnico.');
    } finally {
      setSaving(false);
    }
  }

  async function createSpecialty(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !companyId) return;

    const name = newSpecialty.name.trim();
    const code = slugify(name);
    if (!name || !code) {
      setError('Informe um nome válido para a especialidade.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const { error: insertError } = await supabase
        .from('technical_specialties')
        .insert({
          company_id: companyId,
          code,
          name,
          description: newSpecialty.description.trim() || null,
          active: true,
          sort_order: (specialties.at(-1)?.sort_order ?? 0) + 10,
        });
      if (insertError) throw insertError;

      setNewSpecialty({ name: '', description: '' });
      setShowNew(false);
      setSuccess('Nova especialidade cadastrada.');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível cadastrar a especialidade.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="empty-state">
        <RefreshCw size={38} />
        <h3>Carregando especialidades</h3>
        <p>Buscando técnicos e áreas de atuação da empresa.</p>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Administração"
        title="Especialidades técnicas"
        description="Separe a operação por área técnica e defina quais profissionais podem receber cada tipo de OS."
        actions={(
          <button type="button" className="primary-button" onClick={() => setShowNew((value) => !value)}>
            <Plus size={16} /> Nova especialidade
          </button>
        )}
      />

      {(error || success) && (
        <section className="notice" style={{ marginBottom: 16 }}>
          {error ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />}
          <div>
            <strong>{error ? 'Atenção' : 'Configuração atualizada'}</strong>
            <p>{error || success}</p>
          </div>
        </section>
      )}

      {showNew && (
        <section className="panel" style={{ marginBottom: 16 }}>
          <div className="panel-head">
            <div><span className="eyebrow">Cadastro</span><h2>Nova especialidade</h2></div>
          </div>
          <form onSubmit={(event) => void createSpecialty(event)} style={{ display: 'grid', gap: 12 }}>
            <div className="form-grid">
              <label>
                <span>Nome</span>
                <input
                  value={newSpecialty.name}
                  onChange={(event) => setNewSpecialty((value) => ({ ...value, name: event.target.value }))}
                  placeholder="Ex.: Redes e infraestrutura"
                />
              </label>
              <label>
                <span>Descrição</span>
                <input
                  value={newSpecialty.description}
                  onChange={(event) => setNewSpecialty((value) => ({ ...value, description: event.target.value }))}
                  placeholder="Escopo da especialidade"
                />
              </label>
            </div>
            <div className="quick-actions">
              <button type="submit" disabled={saving}><Save size={16} /> Salvar</button>
              <button type="button" className="ghost-button" onClick={() => setShowNew(false)}>Cancelar</button>
            </div>
          </form>
        </section>
      )}

      <div className="tech-summary">
        <article>
          <Printer />
          <div><strong>{specialties.filter((item) => item.code === 'impressoras' && item.active).length}</strong><span>Área de impressoras</span></div>
        </article>
        <article>
          <CircuitBoard />
          <div><strong>{specialties.filter((item) => item.code === 'computadores' && item.active).length}</strong><span>Área de computadores</span></div>
        </article>
        <article>
          <Users />
          <div><strong>{technicians.length}</strong><span>Técnicos cadastrados</span></div>
        </article>
        <article>
          <UserCog />
          <div><strong>{configuredTechnicians}</strong><span>Técnicos classificados</span></div>
        </article>
      </div>

      <section className="panel" style={{ marginTop: 20 }}>
        <div className="panel-head">
          <div>
            <span className="eyebrow">Matriz técnica</span>
            <h2>Técnicos x especialidades</h2>
          </div>
          <span className="ghost-button">{specialties.filter((item) => item.active).length} especialidade(s)</span>
        </div>

        {technicians.length === 0 ? (
          <div className="empty-state">
            <Users size={38} />
            <h3>Nenhum técnico encontrado</h3>
            <p>Cadastre o acesso de um usuário com papel Técnico para configurar as áreas de atuação.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Técnico</th>
                  {specialties.filter((item) => item.active).map((specialty) => (
                    <th key={specialty.id}>{specialty.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {technicians.map((technician) => (
                  <tr key={technician.id}>
                    <td>
                      <strong>{technician.full_name}</strong>
                      <small>{technician.email || 'E-mail não informado'}</small>
                    </td>
                    {specialties.filter((item) => item.active).map((specialty) => {
                      const checked = hasMapping(technician.id, specialty.id);
                      return (
                        <td key={specialty.id}>
                          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={saving}
                              onChange={(event) => void toggleMapping(technician.id, specialty.id, event.target.checked)}
                            />
                            <span className={`stock-state ${checked ? 'ok' : ''}`}>
                              {checked ? 'Habilitado' : 'Não habilitado'}
                            </span>
                          </label>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel" style={{ marginTop: 16 }}>
        <div className="panel-head"><div><span className="eyebrow">Áreas cadastradas</span><h2>Catálogo técnico</h2></div></div>
        <div className="settings-grid">
          {specialties.map((specialty) => (
            <article key={specialty.id}>
              {specialty.code === 'impressoras' ? <Printer /> : specialty.code === 'computadores' ? <CircuitBoard /> : <UserCog />}
              <h3>{specialty.name}</h3>
              <p>{specialty.description || technicalSpecialtyLabel(specialty.code)}</p>
              <small>Código: {specialty.code} · {specialty.active ? 'Ativa' : 'Inativa'}</small>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
