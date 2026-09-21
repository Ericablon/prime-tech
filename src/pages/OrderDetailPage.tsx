import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  FileText,
  Laptop,
  PackageCheck,
  UserRound,
  Wrench,
} from 'lucide-react';

import {
  type CSSProperties,
  type ReactNode,
} from 'react';

import {
  Link,
  useParams,
} from 'react-router-dom';

import { StatusBadge } from '../components/ui/StatusBadge';

import { useAuth } from '../contexts/AuthContext';
import { usePrimeTech } from '../contexts/PrimeTechContext';

import {
  dateTime,
  equipmentCode,
  money,
  orderCode,
} from '../lib/formatters';

import { can } from '../lib/permissions';

import type {
  PauseReason,
  TechnicalStatus,
} from '../types/domain';

const technicalLabels:
  Record<TechnicalStatus, string> = {
    not_started: 'Não iniciado',
    waiting_start: 'Aguardando início',
    in_progress: 'Em manutenção',
    paused: 'Pausado',
    waiting_part: 'Aguardando peça',
    quality_check: 'Testes / qualidade',
    completed: 'Concluído',
  };

const pauseLabels:
  Record<PauseReason, string> = {
    waiting_part: 'Aguardando peça',
    waiting_customer: 'Aguardando cliente',
    waiting_supplier: 'Aguardando fornecedor',
    additional_approval: 'Aguardando aprovação adicional',
    third_party: 'Serviço de terceiro',
    observation: 'Observação / testes',
    technical_issue: 'Problema técnico adicional',
    other: 'Outro motivo',
  };

export function OrderDetailPage() {
  const { id } = useParams();

  const { user } = useAuth();

  const {
    orders,
    clients,
    equipment,
    history,
    loading,
  } = usePrimeTech();

  if (loading) {
    return (
      <div className="empty-state">
        <Wrench size={38} />

        <h3>
          Carregando Ordem de Serviço
        </h3>

        <p>
          Buscando os dados atualizados da OS.
        </p>
      </div>
    );
  }

  const order =
    orders.find(
      (item) =>
        item.id === id,
    );

  if (!order) {
    return (
      <>
        <Link
          to="/ordens"
          className="back-link"
        >
          <ArrowLeft size={17} />
          Voltar
        </Link>

        <section
          className="panel empty-state"
          style={{
            marginTop: 20,
          }}
        >
          <AlertTriangle size={38} />

          <h3>
            Ordem de Serviço não encontrada
          </h3>

          <p>
            A OS pode ter sido removida, estar fora da empresa atual ou o endereço pode estar incorreto.
          </p>
        </section>
      </>
    );
  }

  const client =
    clients.find(
      (item) =>
        item.id ===
        order.client_id,
    );

  const equipmentItem =
    equipment.find(
      (item) =>
        item.id ===
        order.equipment_id,
    );

  const orderHistory =
    history
      .filter(
        (item) =>
          item.service_order_id ===
          order.id,
      )
      .sort(
        (a, b) =>
          new Date(
            b.changed_at,
          ).getTime() -
          new Date(
            a.changed_at,
          ).getTime(),
      );

  const diagnosisDone =
    Boolean(order.diagnosis) ||
    [
      'ready_for_commercial',
      'budget_ready',
      'waiting_customer',
      'approved',
      'waiting_part',
      'in_repair',
      'quality_check',
      'ready_for_pickup',
      'delivered',
    ].includes(
      order.status,
    );

  const commercialDone =
    order.approval_status ===
      'approved' ||
    [
      'approved',
      'waiting_part',
      'in_repair',
      'quality_check',
      'ready_for_pickup',
      'delivered',
    ].includes(
      order.status,
    );

  const executionDone =
    order.technical_status ===
      'completed' ||
    [
      'ready_for_pickup',
      'delivered',
    ].includes(
      order.status,
    );

  const qualityDone =
    Boolean(
      order.quality_checked_at,
    ) ||
    [
      'ready_for_pickup',
      'delivered',
    ].includes(
      order.status,
    );

  const delivered =
    order.status ===
    'delivered';

  const total =
    Number(
      order.total_amount ??
        order.quote_total ??
        0,
    );

  return (
    <>
      <div className="detail-head">
        <Link
          to="/ordens"
          className="back-link"
        >
          <ArrowLeft size={17} />
          Voltar
        </Link>

        <div>
          <span className="eyebrow">
            Ordem de Serviço
          </span>

          <h1>
            {orderCode(
              order.order_number,
            )}
          </h1>

          <p>
            {order.client_name ??
              client?.name ??
              'Cliente não identificado'}
            {' · '}
            {order.equipment ??
              'Equipamento não identificado'}
          </p>
        </div>

        <StatusBadge
          status={order.status}
        />
      </div>

      {order.technical_status ===
        'paused' && (
        <section
          style={{
            marginBottom: 16,
          }}
          className="notice"
        >
          <AlertTriangle />

          <div>
            <strong>
              Manutenção pausada
            </strong>

            <p>
              {order.pause_reason
                ? pauseLabels[
                    order.pause_reason
                  ]
                : 'Motivo não informado'}
              {order.pause_notes
                ? ` · ${order.pause_notes}`
                : ''}
            </p>
          </div>
        </section>
      )}

      <div className="order-grid">
        <section className="panel span-2">
          <div className="panel-head">
            <div>
              <span className="eyebrow">
                Acompanhamento
              </span>

              <h2>
                Fluxo da OS
              </h2>
            </div>
          </div>

          <div className="timeline">
            <TimelineItem
              done
              icon={
                <CheckCircle2 />
              }
              title="Entrada registrada"
              text={`OS aberta em ${formatDate(
                order.created_at,
              )}`}
            />

            <TimelineItem
              done={
                diagnosisDone
              }
              icon={<Wrench />}
              title="Diagnóstico técnico"
              text={
                order.diagnosis ||
                'Aguardando diagnóstico técnico.'
              }
            />

            <TimelineItem
              done={
                commercialDone
              }
              icon={<FileText />}
              title="Orçamento e aprovação"
              text={
                order.approval_status ===
                'approved'
                  ? 'Orçamento aprovado pelo cliente.'
                  : order.approval_status ===
                    'rejected'
                  ? 'Orçamento não aprovado.'
                  : 'Aguardando conclusão do processo comercial.'
              }
            />

            <TimelineItem
              done={
                executionDone
              }
              icon={
                <PackageCheck />
              }
              title="Execução técnica"
              text={
                order.technical_status
                  ? technicalLabels[
                      order
                        .technical_status
                    ]
                  : 'Aguardando início da execução.'
              }
            />

            <TimelineItem
              done={qualityDone}
              icon={
                <CheckCircle2 />
              }
              title="Testes e qualidade"
              text={
                qualityDone
                  ? 'Etapa de qualidade concluída.'
                  : 'Aguardando testes e checklist final.'
              }
            />

            <TimelineItem
              done={delivered}
              icon={
                <PackageCheck />
              }
              title="Entrega"
              text={
                delivered
                  ? `Equipamento entregue${
                      order.closed_at
                        ? ` em ${formatDate(
                            order.closed_at,
                          )}`
                        : ''
                    }.`
                  : 'Aguardando conclusão das etapas anteriores.'
              }
            />
          </div>
        </section>

        <aside className="panel">
          <div className="panel-head">
            <div>
              <span className="eyebrow">
                Situação
              </span>

              <h2>
                Operação atual
              </h2>
            </div>
          </div>

          <InfoBlock
            label="Técnico"
            value={
              order.technician ??
              'Não definido'
            }
          />

          <InfoBlock
            label="Situação técnica"
            value={
              order.technical_status
                ? technicalLabels[
                    order
                      .technical_status
                  ]
                : 'Não iniciada'
            }
          />

          <InfoBlock
            label="Última atualização"
            value={
              order.technical_update ??
              'Sem atualização técnica'
            }
          />

          <InfoBlock
            label="Previsão"
            value={
              order.estimated_days
                ? `${order.estimated_days} dia${
                    order.estimated_days ===
                    1
                      ? ''
                      : 's'
                  }`
                : 'Não informada'
            }
          />

          <InfoBlock
            label="Atualizado em"
            value={formatDate(
              order.updated_at,
            )}
          />

          <div
            className="action-stack"
            style={{
              marginTop: 18,
            }}
          >
            {can(
              user,
              'orders.tech',
            ) && (
              <Link
                className="primary-button"
                to="/tecnico"
              >
                <Wrench size={17} />
                Abrir operação técnica
              </Link>
            )}

            {can(
              user,
              'orders.commercial',
            ) && (
              <Link
                className="ghost-button"
                to="/comercial"
              >
                <FileText size={17} />
                Abrir Comercial
              </Link>
            )}
          </div>
        </aside>
      </div>

      <div
        className="dashboard-grid"
      >
        <section className="panel">
          <div className="panel-head">
            <div>
              <span className="eyebrow">
                Cliente
              </span>

              <h2>
                Dados do atendimento
              </h2>
            </div>

            <UserRound size={20} />
          </div>

          <InfoBlock
            label="Nome"
            value={
              client?.name ??
              order.client_name ??
              'Não identificado'
            }
          />

          <InfoBlock
            label="Documento"
            value={
              client?.document ??
              'Não informado'
            }
          />

          <InfoBlock
            label="Telefone"
            value={
              client?.phone ??
              'Não informado'
            }
          />

          <InfoBlock
            label="E-mail"
            value={
              client?.email ??
              'Não informado'
            }
          />
        </section>

        <section className="panel">
          <div className="panel-head">
            <div>
              <span className="eyebrow">
                Equipamento
              </span>

              <h2>
                Identificação técnica
              </h2>
            </div>

            <Laptop size={20} />
          </div>

          <InfoBlock
            label="Código"
            value={equipmentCode(
              equipmentItem?.technical_number,
            )}
          />

          <InfoBlock
            label="Equipamento"
            value={
              [
                equipmentItem?.category,
                equipmentItem?.brand,
                equipmentItem?.model,
              ]
                .filter(Boolean)
                .join(' ') ||
              order.equipment ||
              'Não identificado'
            }
          />

          <InfoBlock
            label="Número de série"
            value={
              equipmentItem?.serial_number ??
              'Não informado'
            }
          />

          <InfoBlock
            label="Acessórios"
            value={
              equipmentItem?.accessories ??
              'Nenhum informado'
            }
          />
        </section>
      </div>

      <div
        className="dashboard-grid"
        style={{
          marginTop: 16,
        }}
      >
        <section className="panel">
          <div className="panel-head">
            <div>
              <span className="eyebrow">
                Relato
              </span>

              <h2>
                Problema e diagnóstico
              </h2>
            </div>

            <Wrench size={20} />
          </div>

          <InfoBlock
            label="Problema relatado"
            value={
              order.reported_issue
            }
          />

          <InfoBlock
            label="Diagnóstico"
            value={
              order.diagnosis ??
              'Ainda não informado'
            }
          />

          <InfoBlock
            label="Observação técnica"
            value={
              order.technical_notes ??
              order.technical_update ??
              'Nenhuma observação'
            }
          />
        </section>

        <section className="panel">
          <div className="panel-head">
            <div>
              <span className="eyebrow">
                Orçamento
              </span>

              <h2>
                Valores da OS
              </h2>
            </div>

            <CircleDollarSign
              size={20}
            />
          </div>

          <InfoBlock
            label="Serviços"
            value={money.format(
              Number(
                order.total_services ??
                  0,
              ),
            )}
          />

          <InfoBlock
            label="Peças"
            value={money.format(
              Number(
                order.total_parts ??
                  0,
              ),
            )}
          />

          <InfoBlock
            label="Total"
            value={money.format(
              total,
            )}
            emphasis
          />

          <InfoBlock
            label="Aprovação"
            value={
              order.approval_status ===
              'approved'
                ? 'Aprovado'
                : order.approval_status ===
                  'rejected'
                ? 'Não aprovado'
                : 'Pendente'
            }
          />
        </section>
      </div>

      <section
        className="panel"
        style={{
          marginTop: 16,
        }}
      >
        <div className="panel-head">
          <div>
            <span className="eyebrow">
              Auditoria
            </span>

            <h2>
              Histórico da OS
            </h2>
          </div>

          <Clock3 size={20} />
        </div>

        {orderHistory.length ===
        0 ? (
          <div className="empty-state">
            <Clock3 size={32} />

            <h3>
              Nenhuma movimentação registrada
            </h3>

            <p>
              As próximas alterações de status e atualizações operacionais aparecerão aqui.
            </p>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gap: 10,
            }}
          >
            {orderHistory.map(
              (item) => (
                <article
                  key={item.id}
                  style={{
                    padding: 13,

                    border:
                      '1px solid var(--line)',

                    borderRadius: 12,

                    background:
                      '#0c1728',
                  }}
                >
                  <div
                    style={{
                      display:
                        'flex',

                      alignItems:
                        'center',

                      justifyContent:
                        'space-between',

                      gap: 12,
                    }}
                  >
                    <strong
                      style={{
                        fontSize: 13,
                      }}
                    >
                      {item.from_status
                        ? `${item.from_status} → ${item.to_status}`
                        : item.to_status}
                    </strong>

                    <small
                      style={{
                        color:
                          'var(--muted)',
                      }}
                    >
                      {formatDate(
                        item.changed_at,
                      )}
                    </small>
                  </div>

                  {item.notes && (
                    <p
                      style={{
                        color:
                          'var(--muted)',

                        fontSize: 12,

                        marginTop: 6,
                      }}
                    >
                      {item.notes}
                    </p>
                  )}

                  {item.changed_by_name && (
                    <small
                      style={{
                        display:
                          'block',

                        color:
                          'var(--muted)',

                        marginTop: 6,
                      }}
                    >
                      Por{' '}
                      {
                        item.changed_by_name
                      }
                    </small>
                  )}
                </article>
              ),
            )}
          </div>
        )}
      </section>
    </>
  );
}

function TimelineItem({
  done,
  icon,
  title,
  text,
}: {
  done: boolean;
  icon: ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div
      className={`timeline-item ${
        done ? 'done' : ''
      }`}
    >
      {icon}

      <div>
        <strong>
          {title}
        </strong>

        <small>
          {text}
        </small>
      </div>
    </div>
  );
}

function InfoBlock({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div
      style={{
        padding:
          '10px 0',

        borderBottom:
          '1px solid var(--line)',
      }}
    >
      <small
        style={{
          display: 'block',
          color: 'var(--muted)',
          marginBottom: 4,
        }}
      >
        {label}
      </small>

      <strong
        style={{
          display: 'block',
          fontSize:
            emphasis
              ? 18
              : 13,

          color:
            emphasis
              ? 'var(--blue2)'
              : undefined,
        }}
      >
        {value}
      </strong>
    </div>
  );
}

function formatDate(
  value?: string | null,
) {
  if (!value) {
    return 'Não informado';
  }

  const parsed =
    new Date(value);

  if (
    Number.isNaN(
      parsed.getTime(),
    )
  ) {
    return 'Data inválida';
  }

  return dateTime.format(
    parsed,
  );
}

const unusedStyle:
  CSSProperties = {};
