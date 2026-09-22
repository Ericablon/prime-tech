export type RoleCode =
  | 'admin'
  | 'gestor'
  | 'atendimento'
  | 'comercial'
  | 'tecnico'
  | 'estoque'
  | 'financeiro'
  | 'fiscal';

export type Permission =
  | 'dashboard.view'
  | 'clients.view'
  | 'clients.manage'
  | 'equipment.view'
  | 'equipment.manage'
  | 'orders.view'
  | 'orders.create'
  | 'orders.tech'
  | 'orders.commercial'
  | 'orders.approve'
  | 'orders.deliver'
  | 'stock.view'
  | 'stock.reserve'
  | 'stock.consume'
  | 'stock.adjust'
  | 'finance.view'
  | 'finance.manage'
  | 'finance.dre'
  | 'fiscal.view'
  | 'fiscal.issue'
  | 'fiscal.cancel'
  | 'fiscal.settings'
  | 'reports.view'
  | 'users.manage'
  | 'permissions.manage'
  | 'settings.manage'
  | 'audit.view';

export type Priority =
  | 'low'
  | 'normal'
  | 'high'
  | 'urgent';

export type ApprovalStatus =
  | 'pending'
  | 'approved'
  | 'rejected';

export type ItemKind =
  | 'service'
  | 'part';

/**
 * Código configurável de especialidade técnica.
 * O banco começa com `impressoras` e `computadores`, mas aceita novas
 * especialidades sem exigir alteração no frontend.
 */
export type TechnicalSpecialtyCode = string;

/**
 * Status geral da OS.
 *
 * Mantemos estados legados por compatibilidade
 * enquanto migramos o Cronos para o novo fluxo.
 */
export type OrderStatus =
  | 'triage'
  | 'waiting_technician'
  | 'diagnosis'
  | 'budget_ready'
  | 'ready_for_commercial'
  | 'waiting_customer'
  | 'approved'
  | 'in_repair'
  | 'waiting_part'
  | 'quality_check'
  | 'ready_for_pickup'
  | 'delivered'
  | 'cancelled'
  | 'warranty';

/**
 * Situação operacional real do equipamento.
 *
 * Essa informação será atualizada pelo técnico
 * e ficará disponível imediatamente para o Comercial.
 */
export type TechnicalStatus =
  | 'not_started'
  | 'waiting_start'
  | 'in_progress'
  | 'paused'
  | 'waiting_part'
  | 'quality_check'
  | 'completed';

/**
 * Motivo obrigatório quando uma manutenção for pausada.
 */
export type PauseReason =
  | 'waiting_part'
  | 'waiting_customer'
  | 'waiting_supplier'
  | 'additional_approval'
  | 'third_party'
  | 'observation'
  | 'technical_issue'
  | 'other';

export interface UserProfile {
  id: string;
  full_name: string;

  email?: string | null;
  phone?: string | null;
  job_title?: string | null;

  role_code: RoleCode;
  active?: boolean;

  permissions?: Permission[];

  organization_id?: string;
  company_id?: string;
  branch_id?: string;

  /** Especialidades habilitadas para o técnico no tenant ativo. */
  technical_specialty_codes?: TechnicalSpecialtyCode[];

  created_at?: string;
  updated_at?: string;
}

export interface Client {
  id: string;

  company_id?: string;

  person_type: 'pf' | 'pj';

  name: string;

  document?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;

  created_by?: string | null;

  created_at: string;
  updated_at?: string;
}

export interface Equipment {
  id: string;

  company_id?: string;

  technical_number?: number;

  client_id: string;

  category: string;
  technical_specialty_code?: TechnicalSpecialtyCode | null;

  brand?: string | null;
  model?: string | null;
  serial_number?: string | null;

  accessories?: string | null;
  notes?: string | null;

  created_by?: string | null;

  created_at: string;
  updated_at?: string;
}

export interface ServiceOrderItem {
  id: string;

  service_order_id: string;

  kind: ItemKind;

  description: string;

  quantity: number;
  unit_price: number;

  cost_price?: number | null;
  stock_item_id?: string | null;

  created_at?: string;
}

export interface ServiceOrder {
  id: string;

  order_number: number;

  company_id?: string;

  /**
   * Relacionamentos reais no banco.
   */
  client_id?: string;
  equipment_id?: string;

  assigned_technician_id?: string | null;
  technical_specialty_code?: TechnicalSpecialtyCode | null;

  /**
   * Campos prontos para exibição.
   * Mantidos para compatibilidade com o novo layout.
   */
  client_name?: string;
  equipment?: string;
  technician?: string;

  intake_type?: string;

  /**
   * Etapa geral da OS.
   */
  status: OrderStatus;

  /**
   * Situação da execução técnica.
   *
   * Exemplo:
   * orçamento aprovado + technical_status paused.
   */
  technical_status?: TechnicalStatus;

  priority: Priority;

  reported_issue: string;

  diagnosis?: string | null;
  technical_notes?: string | null;

  /**
   * Última atualização curta do técnico,
   * mostrada também para o Comercial.
   */
  technical_update?: string | null;

  /**
   * Dados da pausa.
   */
  pause_reason?: PauseReason | null;
  pause_notes?: string | null;

  /**
   * Situação comercial.
   */
  approval_status?: ApprovalStatus;
  approval_notes?: string | null;
  approved_at?: string | null;

  estimated_days?: number | null;

  /**
   * Financeiro/orçamento.
   */
  total_services?: number;
  total_parts?: number;
  total_amount?: number;

  /**
   * Campo de compatibilidade com o layout atual.
   */
  quote_total?: number;

  /**
   * Programação.
   */
  scheduled_at?: string | null;
  scheduled_duration_minutes?: number | null;
  schedule_notes?: string | null;

  /**
   * Linha do tempo técnica.
   */
  technical_started_at?: string | null;
  technical_paused_at?: string | null;
  technical_resumed_at?: string | null;
  technical_completed_at?: string | null;
  quality_checked_at?: string | null;

  created_at: string;
  updated_at: string;

  closed_at?: string | null;

  /**
   * Relacionamentos hidratados.
   */
  client?: Client;
  equipment_record?: Equipment;
  items?: ServiceOrderItem[];
}

export interface StockItem {
  id: string;

  company_id?: string;

  sku: string;
  name: string;

  /**
   * Campos originais do banco.
   * Podem não existir em objetos legados.
   */
  quantity?: number;
  reserved_quantity?: number;
  minimum_quantity?: number;

  /**
   * Modelo normalizado usado pela interface do Cronos.
   * Estes valores sempre existem após a normalização
   * realizada pelo PrimeTechContext.
   */
  physical: number;
  reserved: number;
  minimum: number;

  cost_price: number;
  sale_price: number;

  active?: boolean;

  created_at?: string;
  updated_at?: string;
}

export interface FinancialEntry {
  id: string;

  company_id?: string;

  type:
    | 'income'
    | 'expense';

  category: string;
  category_id?: string | null;
  account_id?: string | null;

  description: string;

  amount: number;

  occurred_at: string;
  competence_date?: string | null;

  service_order_id?: string | null;

  payment_method?: string | null;
  installment_id?: string | null;

  created_by?: string | null;
}

export interface PaymentInstallment {
  id: string;

  company_id?: string;
  plan_id: string;

  installment_number: number;
  installment_count: number;

  service_order_id?: string | null;

  type:
    | 'income'
    | 'expense';

  category: string;
  category_id?: string | null;
  account_id?: string | null;

  description: string;

  amount: number;

  due_date: string;
  competence_date?: string | null;

  payment_method: string;

  paid_at?: string | null;
}

export interface PaymentPlanInput {
  request_id: string;

  order_id: string | null;

  type:
    | 'income'
    | 'expense';

  category: string;

  description: string;

  amount: number;

  count: number;

  first_due: string;

  method: string;

  paid: boolean;
}

export interface OrderHistory {
  id: string;

  service_order_id: string;

  from_status?: string | null;
  to_status: string;

  notes?: string | null;

  changed_by?: string | null;
  changed_by_name?: string | null;

  changed_at: string;
}

export interface CompanySettings {
  id: string;

  company_id?: string;

  trade_name: string;

  legal_name?: string | null;
  document?: string | null;

  state_registration?: string | null;
  municipal_registration?: string | null;

  phone?: string | null;
  whatsapp?: string | null;

  email?: string | null;
  address?: string | null;

  instagram?: string | null;

  logo_url?: string | null;

  budget_validity_days: number;

  warranty_text?: string | null;
  footer_text?: string | null;
}

export interface CreateClientInput {
  person_type:
    | 'pf'
    | 'pj';

  name: string;

  document?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
}

export interface CreateEquipmentInput {
  client_id: string;

  category: string;
  technical_specialty_code?: TechnicalSpecialtyCode | null;

  brand?: string;
  model?: string;

  serial_number?: string;

  accessories?: string;
  notes?: string;
}

export interface CreateOrderInput {
  client_id: string;

  equipment_id: string;

  intake_type: string;

  reported_issue: string;

  priority: Priority;

  technical_specialty_code?: TechnicalSpecialtyCode | null;
  assigned_technician_id?: string | null;
}

export interface TechnicalUpdateInput {
  order_id: string;

  technical_status: TechnicalStatus;

  note: string;

  pause_reason?: PauseReason | null;

  estimated_days?: number | null;
}
