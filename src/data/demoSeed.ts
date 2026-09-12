import type {
  Client,
  CompanySettings,
  Equipment,
  FinancialEntry,
  ServiceOrder,
  StockItem,
} from "../types/domain";

const now = new Date().toISOString();

export const demoCompany: CompanySettings = {
  id: "company-1",
  trade_name: "Prime Tech",
  legal_name: "Prime Tech Tecnologia",
  document: "",
  phone: "",
  whatsapp: "",
  email: "",
  address: "",
  instagram: "@primetech.oficial",
  logo_url: "/brand/prime-tech-logo.jpeg",
  budget_validity_days: 7,
  warranty_text: "Garantia conforme serviço executado e condições descritas na ordem de serviço.",
  footer_text: "Tecnologia que impulsiona.",
};

export const demoClients: Client[] = [
  {
    id: "c1",
    person_type: "pf",
    name: "João da Silva",
    document: "",
    phone: "(75) 99999-0001",
    email: "joao@email.com",
    address: "Itaberaba/BA",
    created_at: now,
  },
  {
    id: "c2",
    person_type: "pj",
    name: "Comercial Horizonte Ltda",
    document: "",
    phone: "(75) 99999-0002",
    email: "ti@horizonte.com",
    address: "Itaberaba/BA",
    created_at: now,
  },
];

export const demoEquipment: Equipment[] = [
  {
    id: "e1",
    client_id: "c1",
    category: "Notebook",
    brand: "Dell",
    model: "Inspiron",
    serial_number: "DEMO-001",
    accessories: "Carregador",
    notes: "Marcas leves na tampa.",
    created_at: now,
  },
  {
    id: "e2",
    client_id: "c2",
    category: "Impressora",
    brand: "Epson",
    model: "L3250",
    serial_number: "DEMO-002",
    accessories: "Cabo de energia",
    notes: "",
    created_at: now,
  },
];

export const demoOrders: ServiceOrder[] = [
  {
    id: "o1",
    order_number: 125,
    client_id: "c1",
    equipment_id: "e1",
    intake_type: "Orçamento",
    status: "waiting_technician",
    priority: "normal",
    reported_issue: "Equipamento não liga.",
    approval_status: "pending",
    total_services: 0,
    total_parts: 0,
    total_amount: 0,
    created_at: now,
    updated_at: now,
  },
  {
    id: "o2",
    order_number: 126,
    client_id: "c2",
    equipment_id: "e2",
    intake_type: "Manutenção",
    status: "waiting_customer",
    priority: "high",
    reported_issue: "Falha na impressão e atolamento frequente.",
    diagnosis: "Conjunto de tração necessita manutenção preventiva e substituição de roletes.",
    approval_status: "pending",
    estimated_days: 2,
    total_services: 180,
    total_parts: 90,
    total_amount: 270,
    items: [
      {
        id: "i1",
        service_order_id: "o2",
        kind: "service",
        description: "Manutenção preventiva",
        quantity: 1,
        unit_price: 180,
      },
      {
        id: "i2",
        service_order_id: "o2",
        kind: "part",
        description: "Kit de roletes",
        quantity: 1,
        unit_price: 90,
        cost_price: 45,
      },
    ],
    created_at: now,
    updated_at: now,
  },
];

export const demoStock: StockItem[] = [
  { id: "s1", sku: "SSD-480", name: "SSD 480 GB", quantity: 8, minimum_quantity: 3, cost_price: 155, sale_price: 220 },
  { id: "s2", sku: "FONTE-19V", name: "Fonte Notebook 19V", quantity: 3, minimum_quantity: 2, cost_price: 80, sale_price: 145 },
  { id: "s3", sku: "ROLETE-L3250", name: "Kit rolete Epson L3250", quantity: 1, minimum_quantity: 2, cost_price: 45, sale_price: 90 },
];

export const demoFinance: FinancialEntry[] = [
  { id: "f1", type: "income", category: "Serviços", description: "OS #000120", amount: 350, occurred_at: now, service_order_id: null },
  { id: "f2", type: "income", category: "Peças", description: "Venda de SSD", amount: 220, occurred_at: now, service_order_id: null },
  { id: "f3", type: "expense", category: "Compras", description: "Reposição de componentes", amount: 180, occurred_at: now, service_order_id: null },
];
