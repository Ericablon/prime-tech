import type {
  Client,
  CompanySettings,
  Equipment,
  FinancialEntry,
  ServiceOrder,
  StockItem,
} from '../types/domain';

const now = new Date().toISOString();

export const demoCompany: CompanySettings = {
  id: 'company-1',
  trade_name: 'Prime Tech',
  legal_name: 'Prime Tech Tecnologia',
  document: '',
  phone: '',
  whatsapp: '',
  email: '',
  address: '',
  instagram: '@primetech.oficial',
  logo_url: '/brand/prime-tech-logo.jpeg',
  budget_validity_days: 7,
  warranty_text:
    'Garantia conforme serviço executado e condições descritas na ordem de serviço.',
  footer_text: 'Tecnologia que impulsiona.',
};

export const demoClients: Client[] = [
  {
    id: 'c1',
    person_type: 'pj',
    name: 'Comercial Andrade',
    document: '12.345.678/0001-90',
    phone: '(75) 99999-1122',
    email: 'contato@andrade.com',
    address: 'Itaberaba/BA',
    created_at: now,
  },
  {
    id: 'c2',
    person_type: 'pf',
    name: 'Maria Santos',
    document: '123.456.789-00',
    phone: '(75) 98888-4567',
    email: 'maria@email.com',
    address: 'Itaberaba/BA',
    created_at: now,
  },
  {
    id: 'c3',
    person_type: 'pj',
    name: 'Clínica Horizonte',
    document: '45.780.112/0001-03',
    phone: '(75) 3333-8899',
    email: 'administracao@horizonte.com',
    address: 'Itaberaba/BA',
    created_at: now,
  },
  {
    id: 'c4',
    person_type: 'pf',
    name: 'João Almeida',
    document: '987.654.321-00',
    phone: '(75) 97777-4510',
    email: 'joao@email.com',
    address: 'Itaberaba/BA',
    created_at: now,
  },
];

export const demoEquipment: Equipment[] = [
  {
    id: 'e1',
    technical_number: 1001,
    client_id: 'c1',
    category: 'Notebook',
    brand: 'Dell',
    model: 'Latitude',
    serial_number: 'DELL-001',
    accessories: 'Carregador',
    notes: 'Equipamento recebido sem avarias externas.',
    created_at: now,
  },
  {
    id: 'e2',
    technical_number: 1002,
    client_id: 'c2',
    category: 'Impressora',
    brand: 'Epson',
    model: 'L3250',
    serial_number: 'EPSON-002',
    accessories: 'Cabo de energia',
    notes: '',
    created_at: now,
  },
  {
    id: 'e3',
    technical_number: 1003,
    client_id: 'c3',
    category: 'Desktop',
    brand: 'Lenovo',
    model: 'ThinkCentre',
    serial_number: 'LENOVO-003',
    accessories: 'Cabo de energia',
    notes: '',
    created_at: now,
  },
  {
    id: 'e4',
    technical_number: 1004,
    client_id: 'c4',
    category: 'Smartphone',
    brand: 'Apple',
    model: 'iPhone 14',
    serial_number: 'APL-004',
    accessories: '',
    notes: 'Tela trincada.',
    created_at: now,
  },
];

export const demoOrders: ServiceOrder[] = [
  {
    id: 'os-1048',
    order_number: 1048,

    client_id: 'c1',
    equipment_id: 'e1',

    client_name: 'Comercial Andrade',
    equipment: 'Notebook Dell Latitude',
    technician: 'Carlos Silva',

    intake_type: 'Orçamento',

    status: 'diagnosis',
    technical_status: 'in_progress',

    priority: 'high',

    reported_issue:
      'Não liga após queda de energia.',

    diagnosis:
      'Diagnóstico eletrônico em andamento.',

    technical_update:
      'Equipamento aberto e placa principal em análise.',

    approval_status: 'pending',

    estimated_days: 2,

    total_services: 0,
    total_parts: 0,
    total_amount: 0,

    created_at: '2026-09-21T08:10:00-03:00',
    updated_at: '2026-09-21T09:12:00-03:00',

    scheduled_at: '2026-09-21T08:30:00-03:00',

    technical_started_at:
      '2026-09-21T08:45:00-03:00',
  },

  {
    id: 'os-1047',
    order_number: 1047,

    client_id: 'c2',
    equipment_id: 'e2',

    client_name: 'Maria Santos',
    equipment: 'Impressora Epson L3250',
    technician: 'Carlos Silva',

    intake_type: 'Manutenção',

    /**
     * Orçamento já aprovado.
     * Execução pausada aguardando peça.
     */
    status: 'waiting_part',
    technical_status: 'paused',

    priority: 'normal',

    reported_issue:
      'Falha de alimentação de papel.',

    diagnosis:
      'Kit tracionador desgastado.',

    technical_update:
      'Equipamento desmontado. Serviço pausado até chegada do kit tracionador.',

    pause_reason: 'waiting_part',
    pause_notes:
      'Peça solicitada ao fornecedor.',

    approval_status: 'approved',
    approval_notes:
      'Cliente aprovou orçamento.',
    approved_at:
      '2026-09-20T15:30:00-03:00',

    estimated_days: 3,

    total_services: 200,
    total_parts: 220,
    total_amount: 420,
    quote_total: 420,

    technical_started_at:
      '2026-09-21T08:00:00-03:00',

    technical_paused_at:
      '2026-09-21T08:50:00-03:00',

    created_at:
      '2026-09-20T10:00:00-03:00',

    updated_at:
      '2026-09-21T08:50:00-03:00',
  },

  {
    id: 'os-1046',
    order_number: 1046,

    client_id: 'c3',
    equipment_id: 'e3',

    client_name: 'Clínica Horizonte',
    equipment: 'Desktop Lenovo',
    technician: 'Ana Costa',

    intake_type: 'Orçamento',

    status: 'ready_for_commercial',
    technical_status: 'completed',

    priority: 'urgent',

    reported_issue:
      'Sistema reiniciando.',

    diagnosis:
      'SSD com falhas SMART; substituição recomendada.',

    technical_update:
      'Diagnóstico concluído e enviado ao Comercial.',

    approval_status: 'pending',

    estimated_days: 1,

    total_services: 180,
    total_parts: 470,
    total_amount: 650,
    quote_total: 650,

    technical_completed_at:
      '2026-09-21T09:00:00-03:00',

    created_at:
      '2026-09-20T09:00:00-03:00',

    updated_at:
      '2026-09-21T09:05:00-03:00',
  },

  {
    id: 'os-1045',
    order_number: 1045,

    client_id: 'c4',
    equipment_id: 'e4',

    client_name: 'João Almeida',
    equipment: 'iPhone 14',
    technician: 'Ana Costa',

    intake_type: 'Orçamento',

    status: 'waiting_customer',
    technical_status: 'waiting_start',

    priority: 'normal',

    reported_issue:
      'Tela quebrada.',

    diagnosis:
      'Troca completa do display.',

    technical_update:
      'Diagnóstico concluído. Aguardando aprovação do orçamento.',

    approval_status: 'pending',

    estimated_days: 1,

    total_services: 250,
    total_parts: 900,
    total_amount: 1150,
    quote_total: 1150,

    created_at:
      '2026-09-19T14:20:00-03:00',

    updated_at:
      '2026-09-20T17:30:00-03:00',
  },

  {
    id: 'os-1044',
    order_number: 1044,

    client_id: 'c1',
    equipment_id: 'e1',

    client_name: 'Comercial Andrade',
    equipment: 'Notebook Dell Latitude',
    technician: 'Carlos Silva',

    intake_type: 'Manutenção',

    status: 'in_repair',
    technical_status: 'in_progress',

    priority: 'high',

    reported_issue:
      'Superaquecimento.',

    diagnosis:
      'Necessária limpeza interna e troca de pasta térmica.',

    technical_update:
      'Limpeza concluída. Iniciando montagem e testes.',

    approval_status: 'approved',
    approved_at:
      '2026-09-20T09:10:00-03:00',

    estimated_days: 1,

    total_services: 280,
    total_parts: 0,
    total_amount: 280,
    quote_total: 280,

    technical_started_at:
      '2026-09-21T07:30:00-03:00',

    created_at:
      '2026-09-19T11:00:00-03:00',

    updated_at:
      '2026-09-21T07:50:00-03:00',
  },

  {
    id: 'os-1043',
    order_number: 1043,

    client_id: 'c3',
    equipment_id: 'e3',

    client_name: 'Clínica Horizonte',
    equipment: 'Desktop Lenovo',
    technician: 'Ana Costa',

    intake_type: 'Manutenção',

    status: 'quality_check',
    technical_status: 'quality_check',

    priority: 'normal',

    reported_issue:
      'Lentidão extrema.',

    diagnosis:
      'Necessário upgrade de SSD e memória.',

    technical_update:
      'Manutenção finalizada. Equipamento em testes de qualidade.',

    approval_status: 'approved',
    approved_at:
      '2026-09-19T12:00:00-03:00',

    estimated_days: 2,

    total_services: 250,
    total_parts: 640,
    total_amount: 890,
    quote_total: 890,

    technical_started_at:
      '2026-09-20T08:00:00-03:00',

    technical_completed_at:
      '2026-09-21T08:00:00-03:00',

    created_at:
      '2026-09-18T09:00:00-03:00',

    updated_at:
      '2026-09-21T08:15:00-03:00',
  },

  {
    id: 'os-1042',
    order_number: 1042,

    client_id: 'c2',
    equipment_id: 'e2',

    client_name: 'Maria Santos',
    equipment: 'Impressora Epson L3250',
    technician: 'Ana Costa',

    intake_type: 'Manutenção',

    status: 'ready_for_pickup',
    technical_status: 'completed',

    priority: 'normal',

    reported_issue:
      'Impressão falhando.',

    diagnosis:
      'Necessária manutenção preventiva.',

    technical_update:
      'Manutenção e testes concluídos. Equipamento liberado para entrega.',

    approval_status: 'approved',
    approved_at:
      '2026-09-18T14:00:00-03:00',

    estimated_days: 1,

    total_services: 180,
    total_parts: 0,
    total_amount: 180,
    quote_total: 180,

    technical_started_at:
      '2026-09-19T08:00:00-03:00',

    technical_completed_at:
      '2026-09-19T11:00:00-03:00',

    quality_checked_at:
      '2026-09-19T11:30:00-03:00',

    created_at:
      '2026-09-18T10:00:00-03:00',

    updated_at:
      '2026-09-19T11:30:00-03:00',
  },
];

export const demoStock: StockItem[] = [
  {
    id: 'stk-1',
    sku: 'SSD-480-KG',
    name: 'SSD 480 GB',

    quantity: 10,
    reserved_quantity: 4,
    minimum_quantity: 4,

    physical: 10,
    reserved: 4,
    minimum: 4,

    cost_price: 165,
    sale_price: 290,

    active: true,
  },
  {
    id: 'stk-2',
    sku: 'MEM-8-DDR4',
    name: 'Memória 8 GB DDR4',

    quantity: 8,
    reserved_quantity: 2,
    minimum_quantity: 4,

    physical: 8,
    reserved: 2,
    minimum: 4,

    cost_price: 110,
    sale_price: 190,

    active: true,
  },
  {
    id: 'stk-3',
    sku: 'PASTA-5G',
    name: 'Pasta térmica 5 g',

    quantity: 3,
    reserved_quantity: 1,
    minimum_quantity: 5,

    physical: 3,
    reserved: 1,
    minimum: 5,

    cost_price: 18,
    sale_price: 45,

    active: true,
  },
  {
    id: 'stk-4',
    sku: 'KIT-EP-L32',
    name: 'Kit tracionador Epson L32xx',

    quantity: 1,
    reserved_quantity: 1,
    minimum_quantity: 2,

    physical: 1,
    reserved: 1,
    minimum: 2,

    cost_price: 120,
    sale_price: 220,

    active: true,
  },
];

export const demoFinance: FinancialEntry[] = [
  {
    id: 'f1',
    type: 'income',
    category: 'Serviços',
    description: 'OS #1042',
    amount: 180,
    occurred_at: now,
    service_order_id: 'os-1042',
    payment_method: 'pix',
  },
  {
    id: 'f2',
    type: 'income',
    category: 'Serviços',
    description: 'OS #1043',
    amount: 890,
    occurred_at: now,
    service_order_id: 'os-1043',
    payment_method: 'credit_card',
  },
  {
    id: 'f3',
    type: 'expense',
    category: 'Compras',
    description: 'Reposição de componentes',
    amount: 580,
    occurred_at: now,
    service_order_id: null,
    payment_method: 'pix',
  },
];
