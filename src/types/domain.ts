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
  | 'schedule.manage'
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

export type Priority = 'low' | 'normal' | 'high' | 'urgent';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export type ItemKind = 'service' | 'part';
export type TechnicalSpecialtyCode = string;

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

export type TechnicalStatus =
  | 'not_started'
  | 'waiting_start'
  | 'in_progress'
  | 'paused'
  | 'waiting_part'
  | 'quality_check'
  | 'completed';

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
  technical_specialty_codes?: TechnicalSpecialtyCode[];
  created_at?: string;
  updated_at?: string;
}

export interface FiscalAddressFields {
  street?: string | null;
  address_number?: string | null;
  address_complement?: string | null;
  district?: string | null;
  city?: string | null;
  city_code?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country_code?: string | null;
  country_name?: string | null;
}

export interface Client extends FiscalAddressFields {
  id: string;
  company_id?: string;
  person_type: 'pf' | 'pj';
  name: string;
  document?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  state_registration?: string | null;
  municipal_registration?: string | null;
  ie_indicator?: '1' | '2' | '9';
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
  is_order_snapshot?: boolean;
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
  fiscal_service_rule_id?: string | null;
  fiscal_ncm?: string | null;
  fiscal_cest?: string | null;
  fiscal_cfop?: string | null;
  fiscal_unit?: string | null;
  fiscal_tax_origin?: string | null;
  fiscal_icms_situation?: string | null;
  fiscal_pis_situation?: string | null;
  fiscal_cofins_situation?: string | null;
  fiscal_ipi_situation?: string | null;
  fiscal_ibs_cbs_situation?: string | null;
  fiscal_ibs_cbs_classification?: string | null;
  created_at?: string;
}

export interface ServiceOrder {
  id: string;
  order_number: number;
  company_id?: string;
  client_id?: string;
  equipment_id?: string;
  equipment_description?: string | null;
  equipment_serial_number?: string | null;
  equipment_accessories?: string | null;
  equipment_notes?: string | null;
  assigned_technician_id?: string | null;
  technical_specialty_code?: TechnicalSpecialtyCode | null;
  client_name?: string;
  equipment?: string;
  technician?: string;
  intake_type?: string;
  status: OrderStatus;
  technical_status?: TechnicalStatus;
  priority: Priority;
  reported_issue: string;
  diagnosis?: string | null;
  technical_notes?: string | null;
  technical_update?: string | null;
  pause_reason?: PauseReason | null;
  pause_notes?: string | null;
  approval_status?: ApprovalStatus;
  approval_notes?: string | null;
  approved_at?: string | null;
  estimated_days?: number | null;
  total_services?: number;
  total_parts?: number;
  total_amount?: number;
  quote_total?: number;
  scheduled_at?: string | null;
  scheduled_duration_minutes?: number | null;
  schedule_notes?: string | null;
  technical_started_at?: string | null;
  technical_paused_at?: string | null;
  technical_resumed_at?: string | null;
  technical_completed_at?: string | null;
  quality_checked_at?: string | null;
  created_at: string;
  updated_at: string;
  closed_at?: string | null;
  client?: Client;
  equipment_record?: Equipment;
  items?: ServiceOrderItem[];
}

export interface StockItem {
  id: string;
  company_id?: string;
  sku: string;
  name: string;
  quantity?: number;
  reserved_quantity?: number;
  minimum_quantity?: number;
  physical: number;
  reserved: number;
  minimum: number;
  cost_price: number;
  sale_price: number;
  active?: boolean;
  barcode?: string | null;
  ncm?: string | null;
  cest?: string | null;
  commercial_unit?: string | null;
  tax_origin?: string | null;
  cfop_internal?: string | null;
  cfop_interstate?: string | null;
  icms_situation?: string | null;
  pis_situation?: string | null;
  cofins_situation?: string | null;
  ipi_situation?: string | null;
  ibs_cbs_situation?: string | null;
  ibs_cbs_classification?: string | null;
  ibs_cbs_payload?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface FinancialEntry {
  id: string;
  company_id?: string;
  type: 'income' | 'expense';
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
  type: 'income' | 'expense';
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
  type: 'income' | 'expense';
  category: string;
  category_id?: string | null;
  account_id?: string | null;
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

export interface CompanySettings extends FiscalAddressFields {
  id: string;
  company_id?: string;
  trade_name: string;
  legal_name?: string | null;
  document?: string | null;
  state_registration?: string | null;
  municipal_registration?: string | null;
  tax_regime?: 'simples_nacional' | 'simples_excesso' | 'regime_normal' | 'mei' | null;
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

export interface CreateClientInput extends FiscalAddressFields {
  person_type: 'pf' | 'pj';
  name: string;
  document?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  state_registration?: string;
  municipal_registration?: string;
  ie_indicator?: '1' | '2' | '9';
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
  equipment_description?: string | null;
  equipment_serial_number?: string | null;
  equipment_accessories?: string | null;
  equipment_notes?: string | null;
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
