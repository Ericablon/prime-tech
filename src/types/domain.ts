export type RoleCode = 'admin' | 'gestor' | 'atendimento' | 'comercial' | 'tecnico' | 'estoque' | 'financeiro' | 'fiscal';

export type Permission =
  | 'dashboard.view'
  | 'clients.view' | 'clients.manage'
  | 'equipment.view' | 'equipment.manage'
  | 'orders.view' | 'orders.create' | 'orders.tech' | 'orders.commercial' | 'orders.approve' | 'orders.deliver'
  | 'stock.view' | 'stock.reserve' | 'stock.consume' | 'stock.adjust'
  | 'finance.view' | 'finance.manage' | 'finance.dre'
  | 'fiscal.view' | 'fiscal.issue' | 'fiscal.cancel' | 'fiscal.settings'
  | 'reports.view'
  | 'users.manage' | 'permissions.manage' | 'settings.manage' | 'audit.view';

export interface UserProfile {
  id: string;
  full_name: string;
  email?: string;
  role_code: RoleCode;
  active?: boolean;
  permissions?: Permission[];
  organization_id?: string;
  company_id?: string;
  branch_id?: string;
}

export type OrderStatus =
  | 'triage' | 'waiting_technician' | 'diagnosis' | 'ready_for_commercial'
  | 'waiting_customer' | 'approved' | 'waiting_part' | 'in_repair'
  | 'quality_check' | 'ready_for_pickup' | 'delivered' | 'cancelled' | 'warranty';

export interface ServiceOrder {
  id: string;
  order_number: number;
  client_name: string;
  equipment: string;
  technician?: string;
  status: OrderStatus;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  reported_issue: string;
  diagnosis?: string;
  quote_total?: number;
  created_at: string;
  updated_at: string;
  scheduled_at?: string;
}

export interface StockItem {
  id: string;
  sku: string;
  name: string;
  physical: number;
  reserved: number;
  minimum: number;
  cost_price: number;
  sale_price: number;
  active: boolean;
}
