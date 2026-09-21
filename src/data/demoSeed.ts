import type { ServiceOrder, StockItem } from '../types/domain';
export const demoOrders: ServiceOrder[] = [
 { id:'os-1048',order_number:1048,client_name:'Comercial Andrade',equipment:'Notebook Dell Latitude',technician:'Carlos Silva',status:'diagnosis',priority:'high',reported_issue:'Não liga após queda de energia',created_at:'2026-09-21T08:10:00-03:00',updated_at:'2026-09-21T09:12:00-03:00',scheduled_at:'2026-09-21T08:30:00-03:00' },
 { id:'os-1047',order_number:1047,client_name:'Maria Santos',equipment:'Impressora Epson L3250',technician:'Carlos Silva',status:'waiting_part',priority:'normal',reported_issue:'Falha de alimentação de papel',diagnosis:'Kit tracionador desgastado',quote_total:420,created_at:'2026-09-20T10:00:00-03:00',updated_at:'2026-09-21T08:50:00-03:00' },
 { id:'os-1046',order_number:1046,client_name:'Clínica Horizonte',equipment:'Desktop Lenovo',technician:'Ana Costa',status:'ready_for_commercial',priority:'urgent',reported_issue:'Sistema reiniciando',diagnosis:'SSD com falhas SMART; substituição recomendada',quote_total:650,created_at:'2026-09-20T09:00:00-03:00',updated_at:'2026-09-21T09:05:00-03:00' },
 { id:'os-1045',order_number:1045,client_name:'João Almeida',equipment:'iPhone 14',technician:'Ana Costa',status:'waiting_customer',priority:'normal',reported_issue:'Tela quebrada',diagnosis:'Troca completa do display',quote_total:1150,created_at:'2026-09-19T14:20:00-03:00',updated_at:'2026-09-20T17:30:00-03:00' },
 { id:'os-1044',order_number:1044,client_name:'Escritório Lima',equipment:'Notebook Lenovo ThinkPad',technician:'Carlos Silva',status:'in_repair',priority:'high',reported_issue:'Superaquecimento',diagnosis:'Limpeza completa e troca de pasta térmica',quote_total:280,created_at:'2026-09-19T11:00:00-03:00',updated_at:'2026-09-21T07:50:00-03:00' },
 { id:'os-1043',order_number:1043,client_name:'Mercado Central',equipment:'Desktop Dell Optiplex',technician:'Ana Costa',status:'quality_check',priority:'normal',reported_issue:'Lentidão extrema',diagnosis:'Upgrade SSD e memória',quote_total:890,created_at:'2026-09-18T09:00:00-03:00',updated_at:'2026-09-21T08:15:00-03:00' },
];
export const demoStock: StockItem[] = [
 {id:'stk-1',sku:'SSD-480-KG',name:'SSD 480 GB',physical:10,reserved:4,minimum:4,cost_price:165,sale_price:290,active:true},
 {id:'stk-2',sku:'MEM-8-DDR4',name:'Memória 8 GB DDR4',physical:8,reserved:2,minimum:4,cost_price:110,sale_price:190,active:true},
 {id:'stk-3',sku:'PASTA-5G',name:'Pasta térmica 5 g',physical:3,reserved:1,minimum:5,cost_price:18,sale_price:45,active:true},
 {id:'stk-4',sku:'KIT-EP-L32',name:'Kit tracionador Epson L32xx',physical:1,reserved:1,minimum:2,cost_price:120,sale_price:220,active:true},
];
