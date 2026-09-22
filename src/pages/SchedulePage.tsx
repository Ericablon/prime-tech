import {
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  CircuitBoard,
  Clock3,
  Printer,
  Save,
  UserRound,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { PageHeader } from '../components/ui/PageHeader';
import { StatusBadge } from '../components/ui/StatusBadge';
import { useAuth } from '../contexts/AuthContext';
import { usePrimeTech } from '../contexts/PrimeTechContext';
import { dateTime, orderCode } from '../lib/formatters';
import { can } from '../lib/permissions';
import {
  defaultTechnicalSpecialties,
  technicalSpecialtyLabel,
} from '../lib/technicalSpecialties';
import { supabase } from '../lib/supabase';
import type { ServiceOrder } from '../types/domain';

type TechnicianOption = {
  id: string;
  fullName: string;
  specialtyCodes: string[];
};

function inputDate(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10);
}

function inputTime(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(11, 16);
}

function durationLabel(minutes?: number | null) {
  if (!minutes) return 'Duração não definida';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}min` : `${hours}h`;
}

export function SchedulePage() {
  const { mode, user } = useAuth();
  const { orders, companyId, loading, error, refresh } = usePrimeTech();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState('60');
  const [notes, setNotes] = useState('');
  const [technicianId, setTechnicianId] = useState('');
  const [technicians, setTechnicians] = useState<TechnicianOption[]>([]);
  const [specialtyFilter, setSpecialtyFilter] = useState('all');
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState('');

  const canSchedule = can(user, 'orders.commercial') || can(user, 'orders.tech');

  useEffect(() => {
    if (mode !== 'supabase' || !companyId) {
      setTechnicians([]);
      return;
    }

    const client = supabase;
    if (!client) {
      setTechnicians([]);
      return;
    }

    let alive = true;

    const loadTechnicians = async () => {
      try {
        const { data: accessData, error: accessError } = await client
          .from('user_company_access')
          .select('user_id, role_code')
          .eq('company_id', companyId)
          .eq('active', true);
        if (accessError) throw accessError;

        const techIds = (accessData ?? [])
          .filter((row) => String(row.role_code) === 'tecnico')
          .map((row) => String(row.user_id));

        if (!techIds.length) {
          if (alive) setTechnicians([]);
          return;
        }

        const { data: profileData, error: profileError } = await client
          .from('profiles')
          .select('id, full_name')
          .in('id', techIds)
          .order('full_name');
        if (profileError) throw profileError;

        let specialtyCodesByUser = new Map<string, string[]>();

        try {
          const [{ data: specialtyData, error: specialtyError }, { data: mappingData, error: mappingError }] = await Promise.all([
            client
              .from('technical_specialties')
              .select('id, code')
              .eq('company_id', companyId)
              .eq('active', true),
            client
              .from('profile_technical_specialties')
              .select('user_id, technical_specialty_id')
              .eq('company_id', companyId)
              .eq('active', true),
          ]);

          if (!specialtyError && !mappingError) {
            const codeById = new Map(
              (specialtyData ?? []).map((item) => [String(item.id), String(item.code)]),
            );

            specialtyCodesByUser = new Map();
            (mappingData ?? []).forEach((mapping) => {
              const code = codeById.get(String(mapping.technical_specialty_id));
              if (!code) return;
              const userId = String(mapping.user_id);
              specialtyCodesByUser.set(userId, [
                ...(specialtyCodesByUser.get(userId) ?? []),
                code,
              ]);
            });
          }
        } catch {
          // Compatibilidade enquanto a migration de especialidades ainda não estiver aplicada.
        }

        if (!alive) return;

        setTechnicians((profileData ?? []).map((profile) => ({
          id: String(profile.id),
          fullName: String(profile.full_name ?? 'Técnico'),
          specialtyCodes: specialtyCodesByUser.get(String(profile.id)) ?? [],
        })));
      } catch {
        if (alive) setTechnicians([]);
      }
    };

    void loadTechnicians();

    return () => {
      alive = false;
    };
  }, [companyId, mode]);

  const openOrders = useMemo(
    () => orders
      .filter((order) => !['delivered', 'cancelled'].includes(order.status))
      .sort((a, b) => {
        if (a.scheduled_at && b.scheduled_at) {
          return new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime();
        }
        if (a.scheduled_at) return -1;
        if (b.scheduled_at) return 1;
        return a.order_number - b.order_number;
      }),
    [orders],
  );

  const visibleOrders = useMemo(
    () => specialtyFilter === 'all'
      ? openOrders
      : openOrders.filter((order) => order.technical_specialty_code === specialtyFilter),
    [openOrders, specialtyFilter],
  );

  const scheduled = openOrders.filter((order) => Boolean(order.scheduled_at));
  const unscheduled = openOrders.length - scheduled.length;
  const today = new Date();
  const todayCount = scheduled.filter((order) => {
    const value = new Date(order.scheduled_at as string);
    return value.getFullYear() === today.getFullYear()
      && value.getMonth() === today.getMonth()
      && value.getDate() === today.getDate();
  }).length;

  const printersCount = openOrders.filter(
    (order) => order.technical_specialty_code === 'impressoras',
  ).length;
  const computersCount = openOrders.filter(
    (order) => order.technical_specialty_code === 'computadores',
  ).length;

  function compatibleTechnicians(order: ServiceOrder) {
    return technicians.filter((technician) =>
      technician.specialtyCodes.length === 0
      || !order.technical_specialty_code
      || technician.specialtyCodes.includes(order.technical_specialty_code),
    );
  }

  function openEditor(order: ServiceOrder) {
    if (!canSchedule) {
      setLocalError('Seu perfil pode consultar a agenda, mas não pode alterar a programação técnica.');
      return;
    }

    setEditingId(order.id);
    setDate(inputDate(order.scheduled_at));
    setTime(inputTime(order.scheduled_at) || '08:00');
    setDuration(String(order.scheduled_duration_minutes ?? 60));
    setNotes(order.schedule_notes ?? '');
    setTechnicianId(order.assigned_technician_id ?? '');
    setLocalError('');
  }

  async function saveSchedule(order: ServiceOrder) {
    if (!canSchedule) {
      setLocalError('Seu perfil não possui permissão para alterar a programação técnica.');
      return;
    }

    const durationMinutes = Number.parseInt(duration, 10);

    if (!date || !time) {
      setLocalError('Informe data e horário da programação.');
      return;
    }

    if (!Number.isFinite(durationMinutes) || durationMinutes < 15 || durationMinutes > 1440) {
      setLocalError('Informe uma duração entre 15 e 1440 minutos.');
      return;
    }

    if (technicianId) {
      const technician = technicians.find((item) => item.id === technicianId);
      if (
        technician
        && technician.specialtyCodes.length > 0
        && order.technical_specialty_code
        && !technician.specialtyCodes.includes(order.technical_specialty_code)
      ) {
        setLocalError('O técnico selecionado não está habilitado para esta especialidade.');
        return;
      }
    }

    const client = supabase;
    if (mode !== 'supabase' || !client) {
      setLocalError('A alteração da agenda está disponível no ambiente conectado ao Supabase.');
      return;
    }

    setSaving(true);
    setLocalError('');

    try {
      const scheduledAt = new Date(`${date}T${time}:00`).toISOString();
      const { error: updateError } = await client
        .from('service_orders')
        .update({
          scheduled_at: scheduledAt,
          scheduled_duration_minutes: durationMinutes,
          schedule_notes: notes.trim() || null,
          assigned_technician_id: technicianId || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id);

      if (updateError) throw updateError;
      await refresh();
      setEditingId(null);
    } catch (cause) {
      setLocalError(
        cause instanceof Error
          ? cause.message
          : 'Não foi possível salvar a programação.',
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="empty-state">
        <CalendarClock size={38} />
        <h3>Carregando programação</h3>
        <p>Organizando as Ordens de Serviço abertas.</p>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Operação técnica"
        title="Programação técnica"
        description="Agenda das OS por especialidade, técnico responsável, data, horário e duração estimada."
      />

      {(error || localError) && (
        <section className="notice" style={{ marginBottom: 16 }}>
          <AlertTriangle size={20} />
          <div><strong>Não foi possível concluir a operação</strong><p>{localError || error}</p></div>
        </section>
      )}

      <div className="tech-summary">
        <article><CalendarDays /><div><strong>{scheduled.length}</strong><span>Programadas</span></div></article>
        <article><Clock3 /><div><strong>{todayCount}</strong><span>Para hoje</span></div></article>
        <article><Printer /><div><strong>{printersCount}</strong><span>Impressoras</span></div></article>
        <article><CircuitBoard /><div><strong>{computersCount}</strong><span>Computadores</span></div></article>
      </div>

      <section className="panel" style={{ marginTop: 20, marginBottom: 16 }}>
        <div className="panel-head" style={{ marginBottom: 0 }}>
          <div><span className="eyebrow">Filtrar programação</span><h2>Fila por especialidade</h2></div>
          <div className="quick-actions">
            <button type="button" className={specialtyFilter === 'all' ? 'primary-button' : 'ghost-button'} onClick={() => setSpecialtyFilter('all')}>
              Todas ({openOrders.length})
            </button>
            {defaultTechnicalSpecialties.map((specialty) => {
              const count = openOrders.filter((order) => order.technical_specialty_code === specialty.code).length;
              return (
                <button key={specialty.code} type="button" className={specialtyFilter === specialty.code ? 'primary-button' : 'ghost-button'} onClick={() => setSpecialtyFilter(specialty.code)}>
                  {specialty.shortLabel} ({count})
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="panel">
        {visibleOrders.length === 0 ? (
          <div className="empty-state">
            <CheckCircle2 size={38} />
            <h3>Sem OS nesta fila</h3>
            <p>{specialtyFilter === 'all' ? 'A programação técnica está livre.' : `Não existem OS abertas em ${technicalSpecialtyLabel(specialtyFilter)}.`}</p>
          </div>
        ) : (
          <div className="schedule-list">
            {visibleOrders.map((order) => {
              const editing = editingId === order.id;
              const availableTechnicians = compatibleTechnicians(order);

              return (
                <article key={order.id}>
                  <div className="schedule-time">
                    <Clock3 />
                    <strong>{order.scheduled_at ? dateTime.format(new Date(order.scheduled_at)) : 'Sem agenda'}</strong>
                  </div>

                  <div style={{ minWidth: 0, flex: 1 }}>
                    <span>{orderCode(order.order_number)}</span>
                    <h3>{order.client_name ?? 'Cliente não identificado'}</h3>
                    <p>{order.equipment ?? 'Equipamento não identificado'} · {order.technician ?? 'Técnico a confirmar'}</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                      <span className="status">{technicalSpecialtyLabel(order.technical_specialty_code)}</span>
                      <span className="status">{durationLabel(order.scheduled_duration_minutes)}</span>
                      <StatusBadge status={order.status} />
                    </div>

                    {order.schedule_notes && !editing && <p style={{ marginTop: 8 }}>Programação: {order.schedule_notes}</p>}

                    {editing && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginTop: 12, alignItems: 'end' }}>
                        <label style={{ display: 'grid', gap: 4 }}>
                          <span>Data</span>
                          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
                        </label>
                        <label style={{ display: 'grid', gap: 4 }}>
                          <span>Horário</span>
                          <input type="time" value={time} onChange={(event) => setTime(event.target.value)} />
                        </label>
                        <label style={{ display: 'grid', gap: 4 }}>
                          <span>Duração (min)</span>
                          <input type="number" min="15" max="1440" step="15" value={duration} onChange={(event) => setDuration(event.target.value)} />
                        </label>
                        <label style={{ display: 'grid', gap: 4 }}>
                          <span>Técnico responsável</span>
                          <select value={technicianId} onChange={(event) => setTechnicianId(event.target.value)}>
                            <option value="">A confirmar</option>
                            {availableTechnicians.map((technician) => (
                              <option key={technician.id} value={technician.id}>
                                {technician.fullName}
                                {technician.specialtyCodes.length ? ` · ${technician.specialtyCodes.map(technicalSpecialtyLabel).join(', ')}` : ''}
                              </option>
                            ))}
                          </select>
                          {technicians.length > 0 && availableTechnicians.length === 0 && (
                            <small className="muted">Nenhum técnico compatível configurado.</small>
                          )}
                        </label>
                        <label style={{ display: 'grid', gap: 4, gridColumn: 'span 2' }}>
                          <span>Observações da programação</span>
                          <textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Peças previstas, prioridade, instruções de bancada..." />
                        </label>
                        <div className="quick-actions" style={{ gridColumn: '1 / -1' }}>
                          <button type="button" disabled={saving} onClick={() => void saveSchedule(order)}><Save size={15} /> Salvar</button>
                          <button type="button" className="ghost-button" disabled={saving} onClick={() => setEditingId(null)}>Cancelar</button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'grid', gap: 8, justifyItems: 'end' }}>
                    <CalendarDays className="schedule-icon" />
                    {order.assigned_technician_id && <span className="status"><UserRound size={13} /> {order.technician ?? 'Técnico'}</span>}
                    {canSchedule && (
                      <button type="button" className="ghost-button" onClick={() => openEditor(order)}>
                        <CalendarClock size={15} />{order.scheduled_at ? 'Reagendar' : 'Programar'}
                      </button>
                    )}
                    <Link to={`/ordens/${order.id}`} className="ghost-button">Ver OS</Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="panel" style={{ marginTop: 16 }}>
        <div className="mini-kpis">
          <div><span>{unscheduled}</span><small>OS sem data/hora</small></div>
          <div><span>{technicians.length}</span><small>Técnicos disponíveis</small></div>
          <div><span>{openOrders.filter((order) => !order.assigned_technician_id).length}</span><small>OS sem técnico definido</small></div>
        </div>
      </section>
    </>
  );
}
