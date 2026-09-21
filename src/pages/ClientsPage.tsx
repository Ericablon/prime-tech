import {
  Plus,
  Search,
  Users,
  X,
} from 'lucide-react';

import {
  useMemo,
  useState,
} from 'react';

import { PageHeader } from '../components/ui/PageHeader';

import { useAuth } from '../contexts/AuthContext';
import { usePrimeTech } from '../contexts/PrimeTechContext';

import { can } from '../lib/permissions';

import type {
  CreateClientInput,
} from '../types/domain';

const emptyForm: CreateClientInput = {
  person_type: 'pf',
  name: '',
  document: '',
  phone: '',
  email: '',
  address: '',
  notes: '',
};

export function ClientsPage() {
  const { user } = useAuth();

  const {
    clients,
    equipment,
    orders,
    loading,
    error: contextError,
    createClient,
  } = usePrimeTech();

  const [search, setSearch] =
    useState('');

  const [open, setOpen] =
    useState(false);

  const [busy, setBusy] =
    useState(false);

  const [formError, setFormError] =
    useState('');

  const [form, setForm] =
    useState<CreateClientInput>(
      emptyForm,
    );

  const filteredClients =
    useMemo(() => {
      const term =
        search
          .trim()
          .toLowerCase();

      if (!term) {
        return clients;
      }

      return clients.filter(
        (client) => {
          const haystack = [
            client.name,
            client.document,
            client.phone,
            client.email,
            client.address,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();

          return haystack.includes(
            term,
          );
        },
      );
    }, [
      clients,
      search,
    ]);

  const handleClose = () => {
    setOpen(false);
    setFormError('');
    setForm(emptyForm);
  };

  const handleSubmit =
    async (
      event: React.FormEvent<HTMLFormElement>,
    ) => {
      event.preventDefault();

      setBusy(true);
      setFormError('');

      try {
        await createClient({
          ...form,

          name:
            form.name.trim(),

          document:
            form.document?.trim(),

          phone:
            form.phone?.trim(),

          email:
            form.email?.trim(),

          address:
            form.address?.trim(),

          notes:
            form.notes?.trim(),
        });

        handleClose();
      } catch (cause) {
        setFormError(
          cause instanceof Error
            ? cause.message
            : 'Não foi possível cadastrar o cliente.',
        );
      } finally {
        setBusy(false);
      }
    };

  return (
    <>
      <PageHeader
        eyebrow="Comercial"
        title="Clientes"
        description="Cadastro único de clientes, integrado aos equipamentos e às Ordens de Serviço."
        actions={
          can(
            user,
            'clients.manage',
          ) ? (
            <button
              type="button"
              className="primary-button"
              onClick={() =>
                setOpen(true)
              }
            >
              <Plus size={17} />

              Novo cliente
            </button>
          ) : undefined
        }
      />

      {open && (
        <section
          className="panel"
          style={{
            marginBottom: 18,
          }}
        >
          <div className="panel-head">
            <div>
              <span className="eyebrow">
                Cadastro
              </span>

              <h2>
                Novo cliente
              </h2>
            </div>

            <button
              type="button"
              className="ghost-button small"
              onClick={handleClose}
            >
              <X size={16} />
              Fechar
            </button>
          </div>

          <form
            onSubmit={handleSubmit}
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(2, minmax(0, 1fr))',
              gap: 14,
            }}
          >
            <label>
              <span
                style={{
                  display: 'block',
                  fontSize: 12,
                  marginBottom: 6,
                  color:
                    'var(--muted)',
                }}
              >
                Tipo de pessoa
              </span>

              <select
                value={
                  form.person_type
                }
                onChange={(event) =>
                  setForm(
                    (current) => ({
                      ...current,

                      person_type:
                        event.target
                          .value as
                          | 'pf'
                          | 'pj',
                    }),
                  )
                }
                style={fieldStyle}
              >
                <option value="pf">
                  Pessoa Física
                </option>

                <option value="pj">
                  Pessoa Jurídica
                </option>
              </select>
            </label>

            <label>
              <FieldLabel>
                Nome / Razão social
              </FieldLabel>

              <input
                required
                value={form.name}
                onChange={(event) =>
                  setForm(
                    (current) => ({
                      ...current,
                      name:
                        event.target
                          .value,
                    }),
                  )
                }
                placeholder={
                  form.person_type ===
                  'pj'
                    ? 'Razão social'
                    : 'Nome completo'
                }
                style={fieldStyle}
              />
            </label>

            <label>
              <FieldLabel>
                CPF / CNPJ
              </FieldLabel>

              <input
                value={
                  form.document ?? ''
                }
                onChange={(event) =>
                  setForm(
                    (current) => ({
                      ...current,

                      document:
                        event.target
                          .value,
                    }),
                  )
                }
                placeholder="CPF ou CNPJ"
                style={fieldStyle}
              />
            </label>

            <label>
              <FieldLabel>
                Telefone / WhatsApp
              </FieldLabel>

              <input
                value={
                  form.phone ?? ''
                }
                onChange={(event) =>
                  setForm(
                    (current) => ({
                      ...current,

                      phone:
                        event.target
                          .value,
                    }),
                  )
                }
                placeholder="Telefone"
                style={fieldStyle}
              />
            </label>

            <label>
              <FieldLabel>
                E-mail
              </FieldLabel>

              <input
                type="email"
                value={
                  form.email ?? ''
                }
                onChange={(event) =>
                  setForm(
                    (current) => ({
                      ...current,

                      email:
                        event.target
                          .value,
                    }),
                  )
                }
                placeholder="E-mail"
                style={fieldStyle}
              />
            </label>

            <label>
              <FieldLabel>
                Endereço
              </FieldLabel>

              <input
                value={
                  form.address ?? ''
                }
                onChange={(event) =>
                  setForm(
                    (current) => ({
                      ...current,

                      address:
                        event.target
                          .value,
                    }),
                  )
                }
                placeholder="Endereço"
                style={fieldStyle}
              />
            </label>

            <label
              style={{
                gridColumn:
                  '1 / -1',
              }}
            >
              <FieldLabel>
                Observações
              </FieldLabel>

              <textarea
                value={
                  form.notes ?? ''
                }
                onChange={(event) =>
                  setForm(
                    (current) => ({
                      ...current,

                      notes:
                        event.target
                          .value,
                    }),
                  )
                }
                placeholder="Informações adicionais sobre o cliente"
                style={{
                  ...fieldStyle,
                  minHeight: 90,
                  resize: 'vertical',
                }}
              />
            </label>

            {formError && (
              <div
                style={{
                  gridColumn:
                    '1 / -1',

                  padding: 12,

                  borderRadius: 10,

                  background:
                    'rgba(239,101,113,.08)',

                  border:
                    '1px solid rgba(239,101,113,.22)',

                  color:
                    '#f3838c',

                  fontSize: 13,
                }}
              >
                {formError}
              </div>
            )}

            <div
              style={{
                gridColumn:
                  '1 / -1',

                display: 'flex',
                justifyContent:
                  'flex-end',

                gap: 10,
              }}
            >
              <button
                type="button"
                className="ghost-button"
                onClick={handleClose}
                disabled={busy}
              >
                Cancelar
              </button>

              <button
                className="primary-button"
                disabled={
                  busy ||
                  !form.name.trim()
                }
              >
                {busy
                  ? 'Salvando...'
                  : 'Salvar cliente'}
              </button>
            </div>
          </form>
        </section>
      )}

      {contextError && (
        <section
          className="notice"
          style={{
            marginBottom: 16,
          }}
        >
          <div>
            <strong>
              Não foi possível carregar todos os dados
            </strong>

            <p>
              {contextError}
            </p>
          </div>
        </section>
      )}

      <section className="panel">
        <div className="filters">
          <div className="filter-search">
            <Search size={16} />

            <input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value,
                )
              }
              placeholder="Buscar por nome, CPF/CNPJ, telefone ou e-mail"
            />
          </div>
        </div>

        {loading ? (
          <div className="empty-state">
            <Users />

            <h3>
              Carregando clientes
            </h3>

            <p>
              Buscando os dados da empresa.
            </p>
          </div>
        ) : filteredClients.length ===
          0 ? (
          <div className="empty-state">
            <Users />

            <h3>
              Nenhum cliente encontrado
            </h3>

            <p>
              Cadastre o primeiro cliente ou altere sua busca.
            </p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Documento</th>
                  <th>Contato</th>
                  <th>Equipamentos</th>
                  <th>OS</th>
                </tr>
              </thead>

              <tbody>
                {filteredClients.map(
                  (client) => {
                    const equipmentCount =
                      equipment.filter(
                        (item) =>
                          item.client_id ===
                          client.id,
                      ).length;

                    const orderCount =
                      orders.filter(
                        (order) =>
                          order.client_id ===
                          client.id,
                      ).length;

                    return (
                      <tr
                        key={
                          client.id
                        }
                      >
                        <td>
                          <strong>
                            {
                              client.name
                            }
                          </strong>

                          <small>
                            {client.person_type ===
                            'pj'
                              ? 'Pessoa Jurídica'
                              : 'Pessoa Física'}
                          </small>
                        </td>

                        <td>
                          {client.document ||
                            '—'}
                        </td>

                        <td>
                          <strong>
                            {client.phone ||
                              '—'}
                          </strong>

                          <small>
                            {client.email ||
                              'Sem e-mail'}
                          </small>
                        </td>

                        <td>
                          <strong>
                            {
                              equipmentCount
                            }
                          </strong>

                          <small>
                            equipamento
                            {equipmentCount ===
                            1
                              ? ''
                              : 's'}
                          </small>
                        </td>

                        <td>
                          <strong>
                            {orderCount}
                          </strong>

                          <small>
                            ordem
                            {orderCount ===
                            1
                              ? ''
                              : 'ens'}
                          </small>
                        </td>
                      </tr>
                    );
                  },
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function FieldLabel({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <span
      style={{
        display: 'block',
        fontSize: 12,
        marginBottom: 6,
        color: 'var(--muted)',
      }}
    >
      {children}
    </span>
  );
}

const fieldStyle:
  React.CSSProperties = {
    width: '100%',
    minHeight: 42,

    borderRadius: 10,

    border:
      '1px solid var(--line)',

    background: '#0b1728',

    color: '#ffffff',

    padding: '10px 12px',

    outline: 'none',
  };
