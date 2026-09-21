import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { useAuth } from './AuthContext';

import {
  demoClients,
  demoCompany,
  demoEquipment,
  demoFinance,
  demoOrders,
  demoStock,
} from '../data/demoSeed';

import { supabase } from '../lib/supabase';

import type {
  Client,
  CompanySettings,
  CreateClientInput,
  CreateEquipmentInput,
  CreateOrderInput,
  Equipment,
  FinancialEntry,
  OrderHistory,
  OrderStatus,
  PaymentInstallment,
  PaymentPlanInput,
  ServiceOrder,
  ServiceOrderItem,
  StockItem,
  TechnicalStatus,
  TechnicalUpdateInput,
} from '../types/domain';

interface PrimeTechContextValue {
  clients: Client[];
  equipment: Equipment[];
  orders: ServiceOrder[];
  stock: StockItem[];
  finance: FinancialEntry[];

  installments: PaymentInstallment[];
  history: OrderHistory[];

  company: CompanySettings;

  companyId: string | null;

  loading: boolean;
  error: string;

  refresh: () => Promise<void>;

  createClient: (
    input: CreateClientInput,
  ) => Promise<Client>;

  createEquipment: (
    input: CreateEquipmentInput,
  ) => Promise<Equipment>;

  createOrder: (
    input: CreateOrderInput,
  ) => Promise<ServiceOrder>;

  updateTechnical: (
    id: string,
    diagnosis: string,
    estimatedDays: number,
    items: Omit<
      ServiceOrderItem,
      'id' | 'service_order_id'
    >[],
    submit?: boolean,
  ) => Promise<void>;

  updateTechnicalStatus: (
    input: TechnicalUpdateInput,
  ) => Promise<void>;

  transitionOrder: (
    id: string,
    status: OrderStatus,
    notes?: string,
  ) => Promise<void>;

  updateCompany: (
    input: Partial<CompanySettings>,
  ) => Promise<void>;

  addFinancialEntry: (
    entry: Omit<FinancialEntry, 'id'>,
  ) => Promise<void>;

  createPaymentPlan: (
    input: PaymentPlanInput,
  ) => Promise<void>;

  settleInstallment: (
    id: string,
  ) => Promise<void>;

  recordContact: (
    id: string,
    notes: string,
  ) => Promise<void>;

  addStockItem: (
    item: Omit<StockItem, 'id'>,
  ) => Promise<void>;
}

interface PrimeTechState {
  clients: Client[];
  equipment: Equipment[];
  orders: ServiceOrder[];
  stock: StockItem[];
  finance: FinancialEntry[];

  installments: PaymentInstallment[];
  history: OrderHistory[];

  company: CompanySettings;
}

const PrimeTechContext =
  createContext<PrimeTechContextValue | undefined>(
    undefined,
  );

const STORAGE_KEY =
  'cronos-demo-data-v2';

const uuid = () =>
  crypto.randomUUID();

const now = () =>
  new Date().toISOString();

function initialDemoState(): PrimeTechState {
  const saved =
    localStorage.getItem(STORAGE_KEY);

  if (saved) {
    try {
      const parsed =
        JSON.parse(saved) as Partial<PrimeTechState>;

      return {
        clients:
          parsed.clients ?? demoClients,

        equipment:
          parsed.equipment ??
          demoEquipment,

        orders:
          parsed.orders ?? demoOrders,

        stock:
          parsed.stock ?? demoStock,

        finance:
          parsed.finance ??
          demoFinance,

        installments:
          parsed.installments ?? [],

        history:
          parsed.history ?? [],

        company:
          parsed.company ??
          demoCompany,
      };
    } catch {
      localStorage.removeItem(
        STORAGE_KEY,
      );
    }
  }

  return {
    clients: demoClients,
    equipment: demoEquipment,
    orders: demoOrders,
    stock: demoStock,
    finance: demoFinance,
    installments: [],
    history: [],
    company: demoCompany,
  };
}

function emptySupabaseState(): PrimeTechState {
  return {
    clients: [],
    equipment: [],
    orders: [],
    stock: [],
    finance: [],
    installments: [],
    history: [],
    company: demoCompany,
  };
}

function normalizeDocument(
  value?: string | null,
) {
  return (value ?? '')
    .replace(/\D/g, '')
    .trim();
}

function normalizeSerial(
  value?: string | null,
) {
  return (value ?? '')
    .trim()
    .toUpperCase();
}

function getEquipmentLabel(
  item?: Equipment,
) {
  if (!item) {
    return 'Equipamento não identificado';
  }

  return [
    item.category,
    item.brand,
    item.model,
  ]
    .filter(Boolean)
    .join(' ');
}

function deriveTechnicalStatus(
  status: OrderStatus,
): TechnicalStatus {
  switch (status) {
    case 'diagnosis':
      return 'in_progress';

    case 'ready_for_commercial':
    case 'budget_ready':
    case 'waiting_customer':
    case 'approved':
      return 'waiting_start';

    case 'in_repair':
      return 'in_progress';

    case 'waiting_part':
      return 'paused';

    case 'quality_check':
      return 'quality_check';

    case 'ready_for_pickup':
    case 'delivered':
      return 'completed';

    default:
      return 'not_started';
  }
}

function technicalStatusToOrderStatus(
  technicalStatus: TechnicalStatus,
  current: ServiceOrder,
): OrderStatus {
  switch (technicalStatus) {
    case 'waiting_start':
      return current.approval_status ===
        'approved'
        ? 'approved'
        : current.status;

    case 'in_progress':
      return current.approval_status ===
        'approved'
        ? 'in_repair'
        : 'diagnosis';

    case 'paused':
      return current.pause_reason ===
        'waiting_part'
        ? 'waiting_part'
        : 'in_repair';

    case 'quality_check':
      return 'quality_check';

    case 'completed':
      return 'ready_for_pickup';

    default:
      return current.status;
  }
}

export function PrimeTechProvider({
  children,
}: {
  children: ReactNode;
}) {
  const {
    mode,
    user,
  } = useAuth();

  const [state, setState] =
    useState<PrimeTechState>(() =>
      mode === 'demo'
        ? initialDemoState()
        : emptySupabaseState(),
    );

  const [
    companyId,
    setCompanyId,
  ] = useState<string | null>(
    user?.company_id ?? null,
  );

  const [
    loading,
    setLoading,
  ] = useState(
    mode === 'supabase',
  );

  const [
    error,
    setError,
  ] = useState('');

  useEffect(() => {
    if (mode !== 'demo') {
      return;
    }

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(state),
    );
  }, [
    mode,
    state,
  ]);

  const resolveCompanyId =
    useCallback(async () => {
      if (user?.company_id) {
        setCompanyId(
          user.company_id,
        );

        return user.company_id;
      }

      if (
        mode !== 'supabase' ||
        !supabase ||
        !user
      ) {
        return null;
      }

      try {
        const {
          data,
          error: accessError,
        } = await supabase
          .from(
            'user_company_access',
          )
          .select(
            'company_id',
          )
          .eq(
            'user_id',
            user.id,
          )
          .eq(
            'active',
            true,
          )
          .limit(1)
          .maybeSingle();

        if (
          accessError ||
          !data?.company_id
        ) {
          return null;
        }

        const id =
          String(
            data.company_id,
          );

        setCompanyId(id);

        return id;
      } catch {
        /**
         * Compatibilidade com banco legado,
         * antes da migration SaaS.
         */
        return null;
      }
    }, [
      mode,
      user,
    ]);

  const refresh =
    useCallback(async () => {
      if (
        mode !== 'supabase' ||
        !supabase ||
        !user
      ) {
        return;
      }

      setLoading(true);
      setError('');

      try {
        const tenantId =
          await resolveCompanyId();

        const clientsPromise =
          tenantId
            ? supabase
                .from('clients')
                .select('*')
                .eq(
                  'company_id',
                  tenantId,
                )
                .order('name')
            : supabase
                .from('clients')
                .select('*')
                .order('name');

        const equipmentPromise =
          tenantId
            ? supabase
                .from('equipment')
                .select('*')
                .eq(
                  'company_id',
                  tenantId,
                )
                .order(
                  'created_at',
                  {
                    ascending:
                      false,
                  },
                )
            : supabase
                .from('equipment')
                .select('*')
                .order(
                  'created_at',
                  {
                    ascending:
                      false,
                  },
                );

        const ordersPromise =
          tenantId
            ? supabase
                .from(
                  'service_orders',
                )
                .select(
                  '*, items:service_order_items(*)',
                )
                .eq(
                  'company_id',
                  tenantId,
                )
                .order(
                  'created_at',
                  {
                    ascending:
                      false,
                  },
                )
            : supabase
                .from(
                  'service_orders',
                )
                .select(
                  '*, items:service_order_items(*)',
                )
                .order(
                  'created_at',
                  {
                    ascending:
                      false,
                  },
                );

        const stockPromise =
          tenantId
            ? supabase
                .from(
                  'stock_items',
                )
                .select('*')
                .eq(
                  'company_id',
                  tenantId,
                )
                .order('name')
            : supabase
                .from(
                  'stock_items',
                )
                .select('*')
                .order('name');

        const financePromise =
          tenantId
            ? supabase
                .from(
                  'financial_entries',
                )
                .select('*')
                .eq(
                  'company_id',
                  tenantId,
                )
                .order(
                  'occurred_at',
                  {
                    ascending:
                      false,
                  },
                )
            : supabase
                .from(
                  'financial_entries',
                )
                .select('*')
                .order(
                  'occurred_at',
                  {
                    ascending:
                      false,
                  },
                );

        const [
          clientsResult,
          equipmentResult,
          ordersResult,
          stockResult,
          financeResult,
          companyResult,
          installmentsResult,
          historyResult,
        ] = await Promise.all([
          clientsPromise,
          equipmentPromise,
          ordersPromise,
          stockPromise,
          financePromise,

          supabase
            .from(
              'company_settings',
            )
            .select('*')
            .limit(1)
            .maybeSingle(),

          supabase
            .from(
              'payment_installments',
            )
            .select('*')
            .order('due_date'),

          supabase
            .from(
              'service_order_status_history',
            )
            .select('*')
            .order(
              'changed_at',
              {
                ascending:
                  false,
              },
            ),
        ]);

        const firstError = [
          clientsResult.error,
          equipmentResult.error,
          ordersResult.error,
          stockResult.error,
          financeResult.error,
          companyResult.error,
          installmentsResult.error,
          historyResult.error,
        ].find(Boolean);

        if (firstError) {
          throw firstError;
        }

        const clients =
          (clientsResult.data ??
            []) as Client[];

        const equipment =
          (equipmentResult.data ??
            []) as Equipment[];

        let technicianNames =
          new Map<
            string,
            string
          >();

        try {
          const {
            data: profiles,
          } = await supabase
            .from('profiles')
            .select(
              'id, full_name',
            );

          technicianNames =
            new Map(
              (
                profiles ?? []
              ).map(
                (profile) => [
                  String(
                    profile.id,
                  ),
                  String(
                    profile.full_name ??
                      '',
                  ),
                ],
              ),
            );
        } catch {
          technicianNames =
            new Map();
        }

        const orders =
          (
            ordersResult.data ??
            []
          ).map((raw) => {
            const order =
              raw as unknown as ServiceOrder;

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

            const total =
              Number(
                order.total_amount ??
                  order.quote_total ??
                  0,
              );

            return {
              ...order,

              client,

              equipment_record:
                equipmentItem,

              client_name:
                client?.name ??
                order.client_name ??
                'Cliente não identificado',

              equipment:
                getEquipmentLabel(
                  equipmentItem,
                ),

              technician:
                order.assigned_technician_id
                  ? technicianNames.get(
                      order.assigned_technician_id,
                    ) ??
                    'Técnico definido'
                  : undefined,

              technical_status:
                order.technical_status ??
                deriveTechnicalStatus(
                  order.status,
                ),

              total_services:
                Number(
                  order.total_services ??
                    0,
                ),

              total_parts:
                Number(
                  order.total_parts ??
                    0,
                ),

              total_amount:
                total,

              quote_total:
                total,
            } satisfies ServiceOrder;
          });

        const stock =
          (
            stockResult.data ??
            []
          ).map((raw) => {
            const item =
              raw as unknown as StockItem;

            const physical =
              Number(
                item.quantity ??
                  item.physical ??
                  0,
              );

            const reserved =
              Number(
                item.reserved_quantity ??
                  item.reserved ??
                  0,
              );

            const minimum =
              Number(
                item.minimum_quantity ??
                  item.minimum ??
                  0,
              );

            return {
              ...item,
              quantity:
                physical,
              reserved_quantity:
                reserved,
              minimum_quantity:
                minimum,
              physical,
              reserved,
              minimum,
              cost_price:
                Number(
                  item.cost_price ??
                    0,
                ),
              sale_price:
                Number(
                  item.sale_price ??
                    0,
                ),
            };
          });

        setState({
          clients,
          equipment,
          orders,

          stock,

          finance:
            (
              financeResult.data ??
              []
            ) as FinancialEntry[],

          installments:
            (
              installmentsResult.data ??
              []
            ) as PaymentInstallment[],

          history:
            (
              historyResult.data ??
              []
            ) as OrderHistory[],

          company:
            (
              companyResult.data ??
              demoCompany
            ) as CompanySettings,
        });
      } catch (cause) {
        console.error(
          'Erro ao carregar Cronos:',
          cause,
        );

        setError(
          cause instanceof Error
            ? cause.message
            : 'Não foi possível carregar os dados do sistema.',
        );
      } finally {
        setLoading(false);
      }
    }, [
      mode,
      resolveCompanyId,
      user,
    ]);

  useEffect(() => {
    if (
      mode !== 'supabase'
    ) {
      setLoading(false);
      return;
    }

    setState(
      emptySupabaseState(),
    );

    if (!user) {
      setLoading(false);
      return;
    }

    void refresh();
  }, [
    mode,
    user?.id,
    refresh,
  ]);

  const createClient =
    useCallback(
      async (
        input: CreateClientInput,
      ) => {
        const normalizedDocument =
          normalizeDocument(
            input.document,
          );

        if (
          normalizedDocument &&
          state.clients.some(
            (client) =>
              normalizeDocument(
                client.document,
              ) ===
              normalizedDocument,
          )
        ) {
          throw new Error(
            'Já existe um cliente cadastrado com este CPF/CNPJ.',
          );
        }

        const payload = {
          ...input,

          document:
            normalizedDocument ||
            null,

          company_id:
            companyId ??
            undefined,

          created_by:
            user?.id,
        };

        if (
          mode ===
            'supabase' &&
          supabase
        ) {
          const {
            data,
            error: insertError,
          } = await supabase
            .from('clients')
            .insert(payload)
            .select()
            .single();

          if (insertError) {
            if (
              insertError.code ===
              '23505'
            ) {
              throw new Error(
                'Este CPF/CNPJ já está cadastrado.',
              );
            }

            throw insertError;
          }

          await refresh();

          return data as Client;
        }

        const client: Client = {
          id: uuid(),

          ...input,

          document:
            normalizedDocument ||
            null,

          company_id:
            companyId ??
            undefined,

          created_by:
            user?.id,

          created_at:
            now(),
        };

        setState(
          (current) => ({
            ...current,

            clients: [
              ...current.clients,
              client,
            ],
          }),
        );

        return client;
      },
      [
        companyId,
        mode,
        refresh,
        state.clients,
        user?.id,
      ],
    );

  const createEquipment =
    useCallback(
      async (
        input: CreateEquipmentInput,
      ) => {
        const serial =
          normalizeSerial(
            input.serial_number,
          );

        if (
          !state.clients.some(
            (client) =>
              client.id ===
              input.client_id,
          )
        ) {
          throw new Error(
            'Cliente não encontrado.',
          );
        }

        if (
          serial &&
          state.equipment.some(
            (item) =>
              normalizeSerial(
                item.serial_number,
              ) === serial,
          )
        ) {
          throw new Error(
            'Já existe um equipamento com este número de série.',
          );
        }

        const payload = {
          ...input,

          serial_number:
            serial || null,

          company_id:
            companyId ??
            undefined,

          created_by:
            user?.id,
        };

        if (
          mode ===
            'supabase' &&
          supabase
        ) {
          const {
            data,
            error: insertError,
          } = await supabase
            .from('equipment')
            .insert(payload)
            .select()
            .single();

          if (insertError) {
            if (
              insertError.code ===
              '23505'
            ) {
              throw new Error(
                'Já existe um equipamento com este número de série.',
              );
            }

            throw insertError;
          }

          await refresh();

          return data as Equipment;
        }

        const technicalNumber =
          Math.max(
            0,
            ...state.equipment.map(
              (item) =>
                item.technical_number ??
                0,
            ),
          ) + 1;

        const equipment: Equipment = {
          id: uuid(),

          technical_number:
            technicalNumber,

          ...input,

          serial_number:
            serial || null,

          company_id:
            companyId ??
            undefined,

          created_by:
            user?.id,

          created_at:
            now(),
        };

        setState(
          (current) => ({
            ...current,

            equipment: [
              equipment,
              ...current.equipment,
            ],
          }),
        );

        return equipment;
      },
      [
        companyId,
        mode,
        refresh,
        state.clients,
        state.equipment,
        user?.id,
      ],
    );

  const createOrder =
    useCallback(
      async (
        input: CreateOrderInput,
      ) => {
        const closedStatuses: OrderStatus[] =
          [
            'delivered',
            'cancelled',
          ];

        const duplicated =
          state.orders.find(
            (order) =>
              order.equipment_id ===
                input.equipment_id &&
              !closedStatuses.includes(
                order.status,
              ),
          );

        if (duplicated) {
          throw new Error(
            `Este equipamento já possui a OS #${duplicated.order_number} ativa.`,
          );
        }

        const client =
          state.clients.find(
            (item) =>
              item.id ===
              input.client_id,
          );

        if (!client) {
          throw new Error(
            'Cliente não encontrado.',
          );
        }

        const equipmentItem =
          state.equipment.find(
            (item) =>
              item.id ===
              input.equipment_id,
          );

        if (!equipmentItem) {
          throw new Error(
            'Equipamento não encontrado.',
          );
        }

        if (
          equipmentItem.client_id !==
          input.client_id
        ) {
          throw new Error(
            'Este equipamento não pertence ao cliente selecionado.',
          );
        }

        const payload = {
          ...input,

          company_id:
            companyId ??
            undefined,

          status:
            'waiting_technician',

          approval_status:
            'pending',

          opened_by:
            user?.id,
        };

        if (
          mode ===
            'supabase' &&
          supabase
        ) {
          const {
            data,
            error: insertError,
          } = await supabase
            .from(
              'service_orders',
            )
            .insert(payload)
            .select()
            .single();

          if (insertError) {
            if (
              insertError.code ===
              '23505'
            ) {
              throw new Error(
                'Este equipamento já possui uma Ordem de Serviço ativa.',
              );
            }

            throw insertError;
          }

          await refresh();

          return data as ServiceOrder;
        }

        const nextNumber =
          Math.max(
            0,
            ...state.orders.map(
              (order) =>
                order.order_number,
            ),
          ) + 1;

        const order: ServiceOrder = {
          id: uuid(),

          order_number:
            nextNumber,

          ...input,

          company_id:
            companyId ??
            undefined,

          client_name:
            client.name,

          equipment:
            getEquipmentLabel(
              equipmentItem,
            ),

          status:
            'waiting_technician',

          technical_status:
            'waiting_start',

          approval_status:
            'pending',

          total_services: 0,
          total_parts: 0,
          total_amount: 0,
          quote_total: 0,

          created_at:
            now(),

          updated_at:
            now(),
        };

        setState(
          (current) => ({
            ...current,

            orders: [
              order,
              ...current.orders,
            ],
          }),
        );

        return order;
      },
      [
        companyId,
        mode,
        refresh,
        state.clients,
        state.equipment,
        state.orders,
        user?.id,
      ],
    );

  const updateTechnical =
    useCallback(
      async (
        id: string,
        diagnosis: string,
        estimatedDays: number,
        items: Omit<
          ServiceOrderItem,
          'id' |
            'service_order_id'
        >[],
        submit = true,
      ) => {
        if (
          mode ===
            'supabase' &&
          supabase
        ) {
          const current =
            state.orders.find(
              (order) =>
                order.id === id,
            );

          const {
            error: rpcError,
          } = await supabase.rpc(
            'save_technical_quote',
            {
              p_order_id:
                id,

              p_diagnosis:
                diagnosis,

              p_days:
                estimatedDays,

              p_items:
                items,

              p_submit:
                submit,

              p_expected_updated_at:
                current?.updated_at,
            },
          );

          if (rpcError) {
            throw rpcError;
          }

          await refresh();
          return;
        }

        const totals =
          items.reduce(
            (
              result,
              item,
            ) => {
              const total =
                item.quantity *
                item.unit_price;

              if (
                item.kind ===
                'service'
              ) {
                result.services +=
                  total;
              } else {
                result.parts +=
                  total;
              }

              return result;
            },
            {
              services: 0,
              parts: 0,
            },
          );

        setState(
          (current) => ({
            ...current,

            orders:
              current.orders.map(
                (order) => {
                  if (
                    order.id !== id
                  ) {
                    return order;
                  }

                  const total =
                    totals.services +
                    totals.parts;

                  return {
                    ...order,

                    diagnosis,

                    estimated_days:
                      estimatedDays,

                    items:
                      items.map(
                        (item) => ({
                          ...item,

                          id: uuid(),

                          service_order_id:
                            id,
                        }),
                      ),

                    total_services:
                      totals.services,

                    total_parts:
                      totals.parts,

                    total_amount:
                      total,

                    quote_total:
                      total,

                    status:
                      submit
                        ? 'ready_for_commercial'
                        : order.status,

                    technical_status:
                      submit
                        ? 'waiting_start'
                        : 'in_progress',

                    technical_update:
                      submit
                        ? 'Diagnóstico concluído e enviado ao Comercial.'
                        : 'Diagnóstico técnico atualizado.',

                    updated_at:
                      now(),
                  };
                },
              ),
          }),
        );
      },
      [
        mode,
        refresh,
        state.orders,
      ],
    );

  const transitionOrder =
    useCallback(
      async (
        id: string,
        status: OrderStatus,
        notes?: string,
      ) => {
        if (
          mode ===
            'supabase' &&
          supabase
        ) {
          const {
            error: rpcError,
          } = await supabase.rpc(
            'transition_service_order',
            {
              p_order_id:
                id,

              p_new_status:
                status,

              p_notes:
                notes ?? null,
            },
          );

          if (rpcError) {
            throw rpcError;
          }

          await refresh();
          return;
        }

        setState(
          (current) => {
            const currentOrder =
              current.orders.find(
                (order) =>
                  order.id === id,
              );

            if (!currentOrder) {
              return current;
            }

            const changedAt =
              now();

            return {
              ...current,

              history: [
                {
                  id: uuid(),

                  service_order_id:
                    id,

                  from_status:
                    currentOrder.status,

                  to_status:
                    status,

                  notes:
                    notes ?? '',

                  changed_by:
                    user?.id,

                  changed_by_name:
                    user?.full_name,

                  changed_at:
                    changedAt,
                },

                ...current.history,
              ],

              orders:
                current.orders.map(
                  (order) => {
                    if (
                      order.id !== id
                    ) {
                      return order;
                    }

                    return {
                      ...order,

                      status,

                      technical_status:
                        deriveTechnicalStatus(
                          status,
                        ),

                      approval_status:
                        status ===
                        'approved'
                          ? 'approved'
                          : status ===
                              'cancelled' &&
                            order.status ===
                              'waiting_customer'
                          ? 'rejected'
                          : order.approval_status,

                      approved_at:
                        status ===
                        'approved'
                          ? changedAt
                          : order.approved_at,

                      closed_at:
                        status ===
                        'delivered'
                          ? changedAt
                          : order.closed_at,

                      updated_at:
                        changedAt,
                    };
                  },
                ),
            };
          },
        );
      },
      [
        mode,
        refresh,
        user?.full_name,
        user?.id,
      ],
    );

  const updateTechnicalStatus =
    useCallback(
      async (
        input: TechnicalUpdateInput,
      ) => {
        const order =
          state.orders.find(
            (item) =>
              item.id ===
              input.order_id,
          );

        if (!order) {
          throw new Error(
            'Ordem de Serviço não encontrada.',
          );
        }

        if (
          input.technical_status ===
            'paused' &&
          !input.pause_reason
        ) {
          throw new Error(
            'Informe o motivo da pausa.',
          );
        }

        if (
          !input.note.trim()
        ) {
          throw new Error(
            'Informe uma atualização do serviço.',
          );
        }

        const changedAt =
          now();

        const nextOrder: ServiceOrder = {
          ...order,

          technical_status:
            input.technical_status,

          technical_update:
            input.note.trim(),

          pause_reason:
            input.technical_status ===
            'paused'
              ? input.pause_reason ??
                null
              : null,

          pause_notes:
            input.technical_status ===
            'paused'
              ? input.note.trim()
              : null,

          estimated_days:
            input.estimated_days ??
            order.estimated_days,

          technical_started_at:
            input.technical_status ===
              'in_progress' &&
            !order.technical_started_at
              ? changedAt
              : order.technical_started_at,

          technical_paused_at:
            input.technical_status ===
            'paused'
              ? changedAt
              : order.technical_paused_at,

          technical_resumed_at:
            input.technical_status ===
              'in_progress' &&
            order.technical_status ===
              'paused'
              ? changedAt
              : order.technical_resumed_at,

          technical_completed_at:
            input.technical_status ===
            'completed'
              ? changedAt
              : order.technical_completed_at,

          quality_checked_at:
            input.technical_status ===
            'quality_check'
              ? changedAt
              : order.quality_checked_at,

          updated_at:
            changedAt,
        };

        nextOrder.status =
          technicalStatusToOrderStatus(
            input.technical_status,
            nextOrder,
          );

        if (
          mode ===
            'supabase' &&
          supabase
        ) {
          const payload = {
            technical_status:
              nextOrder.technical_status,

            technical_update:
              nextOrder.technical_update,

            pause_reason:
              nextOrder.pause_reason,

            pause_notes:
              nextOrder.pause_notes,

            estimated_days:
              nextOrder.estimated_days,

            technical_started_at:
              nextOrder.technical_started_at,

            technical_paused_at:
              nextOrder.technical_paused_at,

            technical_resumed_at:
              nextOrder.technical_resumed_at,

            technical_completed_at:
              nextOrder.technical_completed_at,

            quality_checked_at:
              nextOrder.quality_checked_at,

            status:
              nextOrder.status,

            updated_at:
              changedAt,
          };

          const {
            error: updateError,
          } = await supabase
            .from(
              'service_orders',
            )
            .update(payload)
            .eq(
              'id',
              input.order_id,
            );

          if (updateError) {
            throw updateError;
          }

          const {
            error: historyError,
          } = await supabase
            .from(
              'service_order_status_history',
            )
            .insert({
              service_order_id:
                input.order_id,

              from_status:
                order.status,

              to_status:
                nextOrder.status,

              notes:
                `Atualização técnica: ${input.note.trim()}`,

              changed_by:
                user?.id,
            });

          if (historyError) {
            console.error(
              'Não foi possível registrar histórico técnico:',
              historyError,
            );
          }

          await refresh();
          return;
        }

        setState(
          (current) => ({
            ...current,

            history: [
              {
                id: uuid(),

                service_order_id:
                  input.order_id,

                from_status:
                  order.status,

                to_status:
                  nextOrder.status,

                notes:
                  `Atualização técnica: ${input.note.trim()}`,

                changed_by:
                  user?.id,

                changed_by_name:
                  user?.full_name,

                changed_at:
                  changedAt,
              },

              ...current.history,
            ],

            orders:
              current.orders.map(
                (item) =>
                  item.id ===
                  input.order_id
                    ? nextOrder
                    : item,
              ),
          }),
        );
      },
      [
        mode,
        refresh,
        state.orders,
        user?.full_name,
        user?.id,
      ],
    );

  const updateCompany =
    useCallback(
      async (
        input: Partial<CompanySettings>,
      ) => {
        if (
          mode ===
            'supabase' &&
          supabase
        ) {
          const payload = {
            ...state.company,
            ...input,
          };

          delete (
            payload as Partial<CompanySettings>
          ).company_id;

          const {
            error: updateError,
          } = await supabase
            .from(
              'company_settings',
            )
            .upsert(payload);

          if (updateError) {
            throw updateError;
          }

          await refresh();
          return;
        }

        setState(
          (current) => ({
            ...current,

            company: {
              ...current.company,
              ...input,
            },
          }),
        );
      },
      [
        mode,
        refresh,
        state.company,
      ],
    );

  const addFinancialEntry =
    useCallback(
      async (
        entry: Omit<
          FinancialEntry,
          'id'
        >,
      ) => {
        if (
          !Number.isFinite(
            entry.amount,
          ) ||
          entry.amount <= 0
        ) {
          throw new Error(
            'Informe um valor positivo.',
          );
        }

        if (
          mode ===
            'supabase' &&
          supabase
        ) {
          const {
            error: insertError,
          } = await supabase
            .from(
              'financial_entries',
            )
            .insert({
              ...entry,

              company_id:
                companyId ??
                undefined,

              created_by:
                user?.id,
            });

          if (insertError) {
            throw insertError;
          }

          await refresh();
          return;
        }

        setState(
          (current) => ({
            ...current,

            finance: [
              {
                ...entry,
                id: uuid(),
              },

              ...current.finance,
            ],
          }),
        );
      },
      [
        companyId,
        mode,
        refresh,
        user?.id,
      ],
    );

  const createPaymentPlan =
    useCallback(
      async (
        input: PaymentPlanInput,
      ) => {
        if (
          mode ===
            'supabase' &&
          supabase
        ) {
          const args =
            Object.fromEntries(
              Object.entries(
                input,
              ).map(
                ([
                  key,
                  value,
                ]) => [
                  `p_${key}`,
                  value,
                ],
              ),
            );

          const {
            error: rpcError,
          } = await supabase.rpc(
            'create_payment_plan',
            args,
          );

          if (rpcError) {
            throw rpcError;
          }

          await refresh();
          return;
        }

        if (
          input.count < 1 ||
          input.count > 36
        ) {
          throw new Error(
            'Quantidade de parcelas inválida.',
          );
        }

        const amountCents =
          Math.round(
            input.amount * 100,
          );

        if (
          amountCents <
          input.count
        ) {
          throw new Error(
            'Valor insuficiente para a quantidade de parcelas.',
          );
        }

        const planId =
          input.request_id ||
          uuid();

        if (
          state.installments.some(
            (item) =>
              item.plan_id ===
              planId,
          )
        ) {
          throw new Error(
            'Este plano de pagamento já foi criado.',
          );
        }

        const rows: PaymentInstallment[] =
          Array.from(
            {
              length:
                input.count,
            },
            (
              _,
              index,
            ) => {
              const due =
                new Date(
                  `${input.first_due}T12:00:00`,
                );

              const originalDay =
                due.getDate();

              due.setDate(1);

              due.setMonth(
                due.getMonth() +
                  index,
              );

              const lastDay =
                new Date(
                  due.getFullYear(),
                  due.getMonth() +
                    1,
                  0,
                ).getDate();

              due.setDate(
                Math.min(
                  originalDay,
                  lastDay,
                ),
              );

              const base =
                Math.floor(
                  amountCents /
                    input.count,
                );

              const remainder =
                amountCents %
                input.count;

              const cents =
                base +
                (index <
                remainder
                  ? 1
                  : 0);

              return {
                id: uuid(),

                plan_id:
                  planId,

                installment_number:
                  index + 1,

                installment_count:
                  input.count,

                service_order_id:
                  input.order_id,

                type:
                  input.type,

                category:
                  input.category,

                description:
                  input.description,

                amount:
                  cents / 100,

                due_date:
                  due.toLocaleDateString(
                    'sv-SE',
                  ),

                payment_method:
                  input.method,

                paid_at:
                  input.paid
                    ? now()
                    : null,
              };
            },
          );

        setState(
          (current) => ({
            ...current,

            installments: [
              ...current.installments,
              ...rows,
            ],
          }),
        );
      },
      [
        mode,
        refresh,
        state.installments,
      ],
    );

  const settleInstallment =
    useCallback(
      async (
        id: string,
      ) => {
        if (
          mode ===
            'supabase' &&
          supabase
        ) {
          const {
            error: rpcError,
          } = await supabase.rpc(
            'settle_installment',
            {
              p_id: id,
            },
          );

          if (rpcError) {
            throw rpcError;
          }

          await refresh();
          return;
        }

        setState(
          (current) => {
            const item =
              current.installments.find(
                (installment) =>
                  installment.id ===
                  id,
              );

            if (
              !item ||
              item.paid_at
            ) {
              return current;
            }

            const paidAt =
              now();

            return {
              ...current,

              installments:
                current.installments.map(
                  (installment) =>
                    installment.id ===
                    id
                      ? {
                          ...installment,
                          paid_at:
                            paidAt,
                        }
                      : installment,
                ),

              finance: [
                {
                  id: uuid(),

                  type:
                    item.type,

                  category:
                    item.category,

                  description:
                    item.description,

                  amount:
                    item.amount,

                  occurred_at:
                    paidAt,

                  service_order_id:
                    item.service_order_id,

                  payment_method:
                    item.payment_method,

                  installment_id:
                    item.id,
                },

                ...current.finance,
              ],
            };
          },
        );
      },
      [
        mode,
        refresh,
      ],
    );

  const recordContact =
    useCallback(
      async (
        id: string,
        notes: string,
      ) => {
        if (
          !notes.trim()
        ) {
          throw new Error(
            'Informe a observação do contato.',
          );
        }

        if (
          mode ===
            'supabase' &&
          supabase
        ) {
          const {
            error: rpcError,
          } = await supabase.rpc(
            'record_order_contact',
            {
              p_order_id:
                id,

              p_notes:
                notes.trim(),
            },
          );

          if (rpcError) {
            throw rpcError;
          }

          await refresh();
          return;
        }

        const order =
          state.orders.find(
            (item) =>
              item.id === id,
          );

        if (!order) {
          return;
        }

        setState(
          (current) => ({
            ...current,

            history: [
              {
                id: uuid(),

                service_order_id:
                  id,

                from_status:
                  order.status,

                to_status:
                  order.status,

                notes:
                  `Contato comercial: ${notes.trim()}`,

                changed_by:
                  user?.id,

                changed_by_name:
                  user?.full_name,

                changed_at:
                  now(),
              },

              ...current.history,
            ],
          }),
        );
      },
      [
        mode,
        refresh,
        state.orders,
        user?.full_name,
        user?.id,
      ],
    );

  const addStockItem =
    useCallback(
      async (
        item: Omit<
          StockItem,
          'id'
        >,
      ) => {
        if (
          state.stock.some(
            (existing) =>
              existing.sku
                .trim()
                .toUpperCase() ===
              item.sku
                .trim()
                .toUpperCase(),
          )
        ) {
          throw new Error(
            'Já existe um item com este SKU.',
          );
        }

        const quantity =
          item.quantity ??
          item.physical ??
          0;

        const reserved =
          item.reserved_quantity ??
          item.reserved ??
          0;

        const minimum =
          item.minimum_quantity ??
          item.minimum ??
          0;

        if (
          mode ===
            'supabase' &&
          supabase
        ) {
          const {
            error: insertError,
          } = await supabase
            .from(
              'stock_items',
            )
            .insert({
              sku:
                item.sku
                  .trim()
                  .toUpperCase(),

              name:
                item.name.trim(),

              quantity,

              reserved_quantity:
                reserved,

              minimum_quantity:
                minimum,

              cost_price:
                item.cost_price,

              sale_price:
                item.sale_price,

              company_id:
                companyId ??
                undefined,
            });

          if (insertError) {
            if (
              insertError.code ===
              '23505'
            ) {
              throw new Error(
                'Já existe um item com este SKU.',
              );
            }

            throw insertError;
          }

          await refresh();
          return;
        }

        const next: StockItem = {
          ...item,

          id: uuid(),

          sku:
            item.sku
              .trim()
              .toUpperCase(),

          quantity,

          reserved_quantity:
            reserved,

          minimum_quantity:
            minimum,

          physical:
            quantity,

          reserved,

          minimum,

          active:
            item.active ??
            true,
        };

        setState(
          (current) => ({
            ...current,

            stock: [
              next,
              ...current.stock,
            ],
          }),
        );
      },
      [
        companyId,
        mode,
        refresh,
        state.stock,
      ],
    );

  const value =
    useMemo<PrimeTechContextValue>(
      () => ({
        clients:
          state.clients,

        equipment:
          state.equipment,

        orders:
          state.orders,

        stock:
          state.stock,

        finance:
          state.finance,

        installments:
          state.installments,

        history:
          state.history,

        company:
          state.company,

        companyId,

        loading,
        error,

        refresh,

        createClient,
        createEquipment,
        createOrder,

        updateTechnical,
        updateTechnicalStatus,

        transitionOrder,

        updateCompany,

        addFinancialEntry,

        createPaymentPlan,
        settleInstallment,

        recordContact,

        addStockItem,
      }),
      [
        state,
        companyId,
        loading,
        error,
        refresh,
        createClient,
        createEquipment,
        createOrder,
        updateTechnical,
        updateTechnicalStatus,
        transitionOrder,
        updateCompany,
        addFinancialEntry,
        createPaymentPlan,
        settleInstallment,
        recordContact,
        addStockItem,
      ],
    );

  return (
    <PrimeTechContext.Provider
      value={value}
    >
      {children}
    </PrimeTechContext.Provider>
  );
}

export function usePrimeTech() {
  const context =
    useContext(
      PrimeTechContext,
    );

  if (!context) {
    throw new Error(
      'usePrimeTech deve ser usado dentro de PrimeTechProvider',
    );
  }

  return context;
}
