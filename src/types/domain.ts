export type RoleCode = "atendimento" | "tecnico" | "gestor";

export type OrderStatus =
  | "triage"
  | "waiting_technician"
  | "diagnosis"
  | "budget_ready"
  | "waiting_customer"
  | "approved"
  | "in_repair"
  | "waiting_part"
  | "ready_for_pickup"
  | "delivered"
  | "cancelled"
  | "warranty";

export type ApprovalStatus = "pending" | "approved" | "rejected";
export type Priority = "low" | "normal" | "high" | "urgent";
export type ItemKind = "service" | "part";

export interface UserProfile {
  id: string;
  full_name: string;
  role_code: RoleCode;
}

export interface Client {
  id: string;
  person_type: "pf" | "pj";
  name: string;
  document?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  created_at: string;
}

export interface Equipment {
  id: string;
  client_id: string;
  category: string;
  brand?: string | null;
  model?: string | null;
  serial_number?: string | null;
  accessories?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface ServiceOrderItem {
  id: string;
  service_order_id: string;
  kind: ItemKind;
  description: string;
  quantity: number;
  unit_price: number;
  cost_price?: number | null;
}

export interface ServiceOrder {
  id: string;
  order_number: number;
  client_id: string;
  equipment_id: string;
  assigned_technician_id?: string | null;
  intake_type: string;
  status: OrderStatus;
  priority: Priority;
  reported_issue: string;
  diagnosis?: string | null;
  technical_notes?: string | null;
  approval_status: ApprovalStatus;
  approval_notes?: string | null;
  approved_at?: string | null;
  estimated_days?: number | null;
  total_services: number;
  total_parts: number;
  total_amount: number;
  created_at: string;
  updated_at: string;
  client?: Client;
  equipment?: Equipment;
  items?: ServiceOrderItem[];
}

export interface StockItem {
  id: string;
  sku: string;
  name: string;
  quantity: number;
  minimum_quantity: number;
  cost_price: number;
  sale_price: number;
}

export interface FinancialEntry {
  id: string;
  type: "income" | "expense";
  category: string;
  description: string;
  amount: number;
  occurred_at: string;
  service_order_id?: string | null;
}

export interface CompanySettings {
  id: string;
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

export interface CreateOrderInput {
  client_id: string;
  equipment_id: string;
  intake_type: string;
  reported_issue: string;
  priority: Priority;
}

export interface CreateClientInput {
  person_type: "pf" | "pj";
  name: string;
  document?: string;
  phone?: string;
  email?: string;
  address?: string;
}

export interface CreateEquipmentInput {
  client_id: string;
  category: string;
  brand?: string;
  model?: string;
  serial_number?: string;
  accessories?: string;
  notes?: string;
}
