import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FileText,
  PackageCheck,
  PackageSearch,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  RotateCcw,
  Send,
  Wrench,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { PageHeader } from '../components/ui/PageHeader';
import { StatusBadge } from '../components/ui/StatusBadge';
import { useAuth } from '../contexts/AuthContext';
import { usePrimeTech } from '../contexts/PrimeTechContext';
import { orderCode } from '../lib/formatters';

import type {
  PauseReason,
  ServiceOrder,
  TechnicalStatus,
} from '../types/domain';

type ActionMode =
  | 'diagnosis'
  | 'pause'
  | 'update'
  | null;

const technicalLabels: Record<TechnicalStatus, string> = {
  not_started: 'Não iniciado',
  waiting_start: 'Aguardando início',
  in_progress: 'Em manutenção',
  paused: 'Pausado',
  waiting_part: 'Aguardando peça',
  quality_check: 'Testes / qualidade',
  completed: 'Concluído',
};

const pauseLabels: Record<PauseReason, string> = {
  waiting_part: 'Aguardando peça',
  waiting_customer: 'Aguardando cliente',
  waiting_supplier: 'Aguardando fornecedor',
  additional_approval: 'Aguardando aprovação adicional',
  third_party: 'Serviço de terceiro',
  observation: 'Observação / testes',
  technical_issue: 'Problema técnico adicional',
  other: 'Outro motivo',
};

function isToday(value?: string | null) {
  if (!value) return false;

  const date = new Date(value);
  const today = new Date();

  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

function technicalStatus(order: ServiceOrder): TechnicalStatus {
  return order.technical_status ?? 'not_started';
}

export function TechnicianPage() {
  const { user } = useAuth();

  const {
    orders,
    loading,
    error,
    updateTechnical,
    updateTechnicalStatus,
  } = usePrimeTech();

  const [actionMode, setActionMode] =
    useState<ActionMode>(null);

  const [selectedId, setSelectedId] =
    useState<string | null>(null);

  const [diagnosis, setDiagnosis] =
    useState('');

  const [estimatedDays, setEstimatedDays] =
    useState('1');

  const [note, setNote] =
    useState('');

  const [pauseReason, setPauseReason] =
    useState<PauseReason>('waiting_part');

  const [saving, setSaving] =
    useState(false);

  const [localError, setLocalError] =
    useState('');

  const visibleOrders = useMemo(() => {
    const active = orders.filter(
      (order) =>
        !['delivered', 'cancelled'].includes(
          order.status,
        ),
    );

    if (!user) {
      return [];
    }

    if (
      user.role_code === 'admin' ||
      user.role_code === 'gestor'
    ) {
      return active;
    }

    return active.filter(
      (order) =>
        !order.assigned_technician_id ||
        order.assigned_technician_id === user.id,
    );
  }, [orders, user]);

  const selectedOrder =
    visibleOrders.find(
      (order) => order.id === selectedId,
    ) ?? null;

  const inProgress = visibleOrders.filter(
    (order) =>
      technicalStatus(order) === 'in_progress' ||
      order.status === 'diagnosis' ||
      order.status === 'in_repair',
  ).length;

  const paused = visibleOrders.filter(
    (order) =>
      technicalStatus(order) === 'paused' ||
      order.status === 'waiting_part',
  ).length;

  const completedToday = visibleOrders.filter(
    (order) =>
      isToday(order.technical_completed_at),
  ).length;

  function closeAction() {
    setActionMode(null);
    setSelectedId(null);
    setDiagnosis('');
    setEstimatedDays('1');
    setNote('');
    setPauseReason('waiting_part');
    setLocalError('');
  }

  function openDiagnosis(order: ServiceOrder) {
    setSelectedId(order.id);
    setActionMode('diagnosis');
    setDiagnosis(order.diagnosis ?? '');
    setEstimatedDays(
      String(order.estimated_days ?? 1),
    );
    setNote('');
    setLocalError('');
  }

  function openPause(order: ServiceOrder) {
    setSelectedId(order.id);
    setActionMode('pause');
    setPauseReason(
      order.pause_reason ?? 'waiting_part',
    );
    setNote('');
    setLocalError('');
  }

  function openUpdate(order: ServiceOrder) {
    setSelectedId(order.id);
    setActionMode('update');
    setNote('');
    setLocalError('');
  }

  async function runStatusAction(
    order: ServiceOrder,
    status: TechnicalStatus,
    actionNote: string,
  ) {
    setSaving(true);
    setLocalError('');

    try {
      await updateTechnicalStatus({
        order_id: order.id,
        technical_status: status,
        note: actionNote,
        estimated_days:
          order.estimated_days ?? null,
      });

      closeAction();
    } catch (cause) {
      setLocalError(
        cause instanceof Error
          ? cause.message
          : 'Não foi possível atualizar a OS.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveDiagnosis(
    submit: boolean,
  ) {
    if (!selectedOrder) return;

    const cleanDiagnosis = diagnosis.trim();
    const days =
      Number.parseInt(estimatedDays, 10);

    if (!cleanDiagnosis) {
      setLocalError(
        'Informe o diagnóstico técnico.',
      );
      return;
    }

    if (
      !Number.isFinite(days) ||
      days < 0
    ) {
      setLocalError(
        'Informe um prazo válido.',
      );
      return;
    }

    const items =
      (selectedOrder.items ?? []).map(
        (item) => ({
          kind: item.kind,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          cost_price: item.cost_price,
          stock_item_id: item.stock_item_id,
          created_at: item.created_at,
        }),
      );

    setSaving(true);
    setLocalError('');

    try {
      await updateTechnical(
        selectedOrder.id,
        cleanDiagnosis,
        days,
        items,
        submit,
      );

      closeAction();
    } catch (cause) {
      setLocalError(
        cause instanceof Error
          ? cause.message
          : 'Não foi possível salvar o diagnóstico.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function savePause() {
    if (!selectedOrder) return;

    if (!note.trim()) {
      setLocalError(
        'Informe o motivo da pausa.',
      );
      return;
    }

    setSaving(true);
    setLocalError('');

    try {
      await updateTechnicalStatus({
        order_id: selectedOrder.id,
        technical_status: 'paused',
        pause_reason: pauseReason,
        note: note.trim(),
        estimated_days:
          selectedOrder.estimated_days ?? null,
      });

      closeAction();
    } catch (cause) {
      setLocalError(
        cause instanceof Error
          ? cause.message
          : 'Não foi possível pausar a manutenção.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveUpdate() {
    if (!selectedOrder) return;

    if (!note.trim()) {
      setLocalError(
        'Informe a atualização técnica.',
      );
      return;
    }

    setSaving(true);
    setLocalError('');

    try {
      await updateTechnicalStatus({
        order_id: selectedOrder.id,
        technical_status:
          technicalStatus(selectedOrder),
        note: note.trim(),
        pause_reason:
          selectedOrder.pause_reason ?? null,
        estimated_days:
          selectedOrder.estimated_days ?? null,
      });

      closeAction();
    } catch (cause) {
      setLocalError(
        cause instanceof Error
          ? cause.message
          : 'Não foi possível registrar a atualização.',
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="empty-state">
        <RefreshCw size={38} />
        <h3>Carregando painel técnico</h3>
        <p>
          Buscando as Ordens de Serviço da empresa.
        </p>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Operação técnica"
        title="Painel do técnico"
        description="Diagnóstico, manutenção, pausas, testes e conclusão das Ordens de Serviço."
      />

      {(error || localError) && (
        <section
          className="notice"
          style={{ marginBottom: 16 }}
        >
          <AlertTriangle size={20} />
          <div>
            <strong>
              Não foi possível concluir a operação
            </strong>
            <p>{localError || error}</p>
          </div>
        </section>
      )}

      <div className="tech-summary">
        <article>
          <ClipboardList />
          <div>
            <strong>
              {visibleOrders.length}
            </strong>
            <span>OS disponíveis</span>
          </div>
        </article>

        <article>
          <PlayCircle />
          <div>
            <strong>{inProgress}</strong>
            <span>Em andamento</span>
          </div>
        </article>

        <article>
          <PackageSearch />
          <div>
            <strong>{paused}</strong>
            <span>Pausadas</span>
          </div>
        </article>

        <article>
          <CheckCircle2 />
          <div>
            <strong>
              {completedToday}
            </strong>
            <span>Concluídas hoje</span>
          </div>
        </article>
      </div>

      {visibleOrders.length === 0 ? (
        <section
          className="panel empty-state"
          style={{ marginTop: 20 }}
        >
          <Wrench size={38} />
          <h3>
            Nenhuma OS disponível
          </h3>
          <p>
            Não existem Ordens de Serviço abertas para
            este técnico no momento.
          </p>
        </section>
      ) : (
        <div className="mobile-work-list">
          {visibleOrders.map((order) => {
            const techStatus =
              technicalStatus(order);

            const waitingCommercial =
              [
                'ready_for_commercial',
                'budget_ready',
                'waiting_customer',
              ].includes(order.status);

            const canDiagnose =
              [
                'waiting_technician',
                'diagnosis',
              ].includes(order.status);

            const canStartMaintenance =
              order.status === 'approved' &&
              techStatus !== 'in_progress';

            const canOperate =
              order.status === 'in_repair' &&
              techStatus === 'in_progress';

            const canResume =
              techStatus === 'paused' ||
              order.status === 'waiting_part';

            const inQuality =
              techStatus === 'quality_check' ||
              order.status === 'quality_check';

            return (
              <article
                className="work-card"
                key={order.id}
              >
                <div className="work-card-top">
                  <div>
                    <span className="order-number">
                      {orderCode(
                        order.order_number,
                      )}
                    </span>

                    <h3>
                      {order.client_name ??
                        'Cliente não identificado'}
                    </h3>

                    <p>
                      {order.equipment ??
                        'Equipamento não identificado'}
                    </p>
                  </div>

                  <StatusBadge
                    status={order.status}
                  />
                </div>

                <div className="work-meta">
                  <span>
                    <Clock3 size={15} />
                    {technicalLabels[
                      techStatus
                    ]}
                  </span>

                  <span>
                    <Wrench size={15} />
                    {order.reported_issue}
                  </span>
                </div>

                {order.technical_update && (
                  <div
                    className="notice"
                    style={{
                      marginTop: 12,
                      marginBottom: 0,
                    }}
                  >
                    <FileText size={18} />
                    <div>
                      <strong>
                        Última atualização
                      </strong>
                      <p>
                        {
                          order.technical_update
                        }
                      </p>
                    </div>
                  </div>
                )}

                {techStatus === 'paused' && (
                  <div
                    className="notice"
                    style={{
                      marginTop: 12,
                      marginBottom: 0,
                    }}
                  >
                    <PauseCircle size={18} />
                    <div>
                      <strong>
                        Manutenção pausada
                      </strong>
                      <p>
                        {order.pause_reason
                          ? pauseLabels[
                              order
                                .pause_reason
                            ]
                          : 'Motivo não informado'}
                        {order.pause_notes
                          ? ` · ${order.pause_notes}`
                          : ''}
                      </p>
                    </div>
                  </div>
                )}

                {waitingCommercial && (
                  <div
                    className="notice"
                    style={{
                      marginTop: 12,
                      marginBottom: 0,
                    }}
                  >
                    <Send size={18} />
                    <div>
                      <strong>
                        Etapa comercial
                      </strong>
                      <p>
                        Diagnóstico aguardando orçamento
                        ou decisão do cliente.
                      </p>
                    </div>
                  </div>
                )}

                <div
                  className="quick-actions"
                  style={{
                    flexWrap: 'wrap',
                    marginTop: 14,
                  }}
                >
                  <Link
                    to={`/ordens/${order.id}`}
                    className="ghost-button"
                  >
                    <FileText size={16} />
                    Ver OS
                  </Link>

                  {canDiagnose && (
                    <button
                      type="button"
                      onClick={() =>
                        openDiagnosis(order)
                      }
                    >
                      <ClipboardList
                        size={16}
                      />
                      Diagnóstico
                    </button>
                  )}

                  {canStartMaintenance && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() =>
                        void runStatusAction(
                          order,
                          'in_progress',
                          'Manutenção iniciada.',
                        )
                      }
                    >
                      <PlayCircle size={16} />
                      Iniciar manutenção
                    </button>
                  )}

                  {canOperate && (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          openPause(order)
                        }
                      >
                        <PauseCircle
                          size={16}
                        />
                        Pausar
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          openUpdate(order)
                        }
                      >
                        <FileText size={16} />
                        Atualização
                      </button>

                      <button
                        type="button"
                        disabled={saving}
                        onClick={() =>
                          void runStatusAction(
                            order,
                            'quality_check',
                            'Manutenção enviada para testes e controle de qualidade.',
                          )
                        }
                      >
                        <PackageCheck
                          size={16}
                        />
                        Enviar para testes
                      </button>
                    </>
                  )}

                  {canResume && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() =>
                        void runStatusAction(
                          order,
                          'in_progress',
                          'Manutenção retomada.',
                        )
                      }
                    >
                      <RotateCcw size={16} />
                      Retomar
                    </button>
                  )}

                  {inQuality && (
                    <>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() =>
                          void runStatusAction(
                            order,
                            'in_progress',
                            'Equipamento retornou dos testes para manutenção.',
                          )
                        }
                      >
                        <RotateCcw
                          size={16}
                        />
                        Voltar manutenção
                      </button>

                      <button
                        type="button"
                        disabled={saving}
                        onClick={() =>
                          void runStatusAction(
                            order,
                            'completed',
                            'Manutenção concluída e equipamento liberado para retirada.',
                          )
                        }
                      >
                        <CheckCircle2
                          size={16}
                        />
                        Concluir
                      </button>
                    </>
                  )}
                </div>

                {selectedOrder?.id ===
                  order.id &&
                  actionMode && (
                    <section
                      className="panel"
                      style={{
                        marginTop: 16,
                        padding: 16,
                      }}
                    >
                      {actionMode ===
                        'diagnosis' && (
                        <>
                          <span className="eyebrow">
                            Diagnóstico técnico
                          </span>

                          <h3
                            style={{
                              marginTop: 4,
                            }}
                          >
                            Registrar diagnóstico
                          </h3>

                          <label
                            style={{
                              display: 'grid',
                              gap: 6,
                              marginTop: 14,
                            }}
                          >
                            <span>
                              Diagnóstico
                            </span>

                            <textarea
                              rows={5}
                              value={diagnosis}
                              onChange={(
                                event,
                              ) =>
                                setDiagnosis(
                                  event.target
                                    .value,
                                )
                              }
                              placeholder="Descreva o diagnóstico técnico..."
                            />
                          </label>

                          <label
                            style={{
                              display: 'grid',
                              gap: 6,
                              marginTop: 12,
                            }}
                          >
                            <span>
                              Prazo estimado em
                              dias
                            </span>

                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={
                                estimatedDays
                              }
                              onChange={(
                                event,
                              ) =>
                                setEstimatedDays(
                                  event.target
                                    .value,
                                )
                              }
                            />
                          </label>

                          <div
                            className="quick-actions"
                            style={{
                              marginTop: 14,
                              flexWrap: 'wrap',
                            }}
                          >
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() =>
                                void saveDiagnosis(
                                  false,
                                )
                              }
                            >
                              <ClipboardList
                                size={16}
                              />
                              Salvar diagnóstico
                            </button>

                            <button
                              type="button"
                              disabled={saving}
                              onClick={() =>
                                void saveDiagnosis(
                                  true,
                                )
                              }
                            >
                              <Send size={16} />
                              Enviar ao Comercial
                            </button>

                            <button
                              type="button"
                              className="ghost-button"
                              disabled={saving}
                              onClick={closeAction}
                            >
                              Cancelar
                            </button>
                          </div>
                        </>
                      )}

                      {actionMode ===
                        'pause' && (
                        <>
                          <span className="eyebrow">
                            Pausar manutenção
                          </span>

                          <h3
                            style={{
                              marginTop: 4,
                            }}
                          >
                            Informe o motivo
                          </h3>

                          <label
                            style={{
                              display: 'grid',
                              gap: 6,
                              marginTop: 14,
                            }}
                          >
                            <span>
                              Motivo da pausa
                            </span>

                            <select
                              value={
                                pauseReason
                              }
                              onChange={(
                                event,
                              ) =>
                                setPauseReason(
                                  event.target
                                    .value as PauseReason,
                                )
                              }
                            >
                              {Object.entries(
                                pauseLabels,
                              ).map(
                                ([
                                  value,
                                  label,
                                ]) => (
                                  <option
                                    key={
                                      value
                                    }
                                    value={
                                      value
                                    }
                                  >
                                    {label}
                                  </option>
                                ),
                              )}
                            </select>
                          </label>

                          <label
                            style={{
                              display: 'grid',
                              gap: 6,
                              marginTop: 12,
                            }}
                          >
                            <span>
                              Observação
                            </span>

                            <textarea
                              rows={4}
                              value={note}
                              onChange={(
                                event,
                              ) =>
                                setNote(
                                  event.target
                                    .value,
                                )
                              }
                              placeholder="Explique o que está impedindo a continuidade..."
                            />
                          </label>

                          <div
                            className="quick-actions"
                            style={{
                              marginTop: 14,
                            }}
                          >
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() =>
                                void savePause()
                              }
                            >
                              <PauseCircle
                                size={16}
                              />
                              Confirmar pausa
                            </button>

                            <button
                              type="button"
                              className="ghost-button"
                              disabled={saving}
                              onClick={closeAction}
                            >
                              Cancelar
                            </button>
                          </div>
                        </>
                      )}

                      {actionMode ===
                        'update' && (
                        <>
                          <span className="eyebrow">
                            Atualização técnica
                          </span>

                          <h3
                            style={{
                              marginTop: 4,
                            }}
                          >
                            Registrar andamento
                          </h3>

                          <label
                            style={{
                              display: 'grid',
                              gap: 6,
                              marginTop: 14,
                            }}
                          >
                            <span>
                              Atualização
                            </span>

                            <textarea
                              rows={4}
                              value={note}
                              onChange={(
                                event,
                              ) =>
                                setNote(
                                  event.target
                                    .value,
                                )
                              }
                              placeholder="Ex.: troca realizada, equipamento em montagem, testes preliminares..."
                            />
                          </label>

                          <div
                            className="quick-actions"
                            style={{
                              marginTop: 14,
                            }}
                          >
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() =>
                                void saveUpdate()
                              }
                            >
                              <FileText
                                size={16}
                              />
                              Salvar atualização
                            </button>

                            <button
                              type="button"
                              className="ghost-button"
                              disabled={saving}
                              onClick={closeAction}
                            >
                              Cancelar
                            </button>
                          </div>
                        </>
                      )}
                    </section>
                  )}
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
