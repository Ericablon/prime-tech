import type { UserProfile } from '../types/domain';
import { can } from './permissions';

export const catalogLabels = { equipment_category: 'Tipos de equipamento', brand: 'Marcas', intake_type: 'Tipos de entrada', supplier: 'Fornecedores', purchase_type: 'Tipos de compra', finance_category: 'Categorias financeiras', payment_method: 'Formas de pagamento', payment_term: 'Condições de pagamento', service: 'Serviços' };
export type CatalogKind = keyof typeof catalogLabels;
export interface CatalogEntry { id: string; kind: CatalogKind; code: string; name: string; details: Record<string, string | number>; active: boolean; }
export function manageCatalog(user: UserProfile | null, kind: CatalogKind) {
  return can(user, 'admin.manage') || (['supplier','purchase_type','finance_category','payment_method','payment_term'].includes(kind) ? can(user,'finance.manage') : kind === 'service' ? can(user,'orders.tech') || can(user,'orders.customer_approval') : can(user,'equipment.manage'));
}
const seeds: Array<[CatalogKind,string,string,Record<string,string|number>?]> = [
 ['equipment_category','notebook','Notebook'],['equipment_category','desktop','Desktop'],['equipment_category','celular','Celular'],['brand','dell','Dell'],['brand','lenovo','Lenovo'],['brand','samsung','Samsung'],
 ['intake_type','orcamento','Orçamento'],['intake_type','manutencao','Manutenção'],['intake_type','garantia','Garantia'],['intake_type','avaliacao','Avaliação técnica'],
 ['purchase_type','pecas','Compra de peças'],['purchase_type','consumo','Material de consumo'],['finance_category','servicos','Serviços de assistência'],['finance_category','vendas','Vendas'],['finance_category','compras','Compras'],['finance_category','despesas','Despesas operacionais'],
 ['payment_method','cash','Dinheiro'],['payment_method','pix','Pix'],['payment_method','credit_card','Cartão de crédito'],['payment_method','debit_card','Cartão de débito'],['payment_method','boleto','Boleto'],['payment_method','transfer','Transferência'],
 ['payment_term','avista','À vista',{installments:1}],['payment_term','3x','3 parcelas mensais',{installments:3}],['service','diagnostico','Avaliação técnica',{price:0}],
];
export const catalogSeeds: CatalogEntry[] = seeds.map(([kind,code,name,details])=>({id:`seed-${kind}-${code}`,kind,code,name,details:details??{},active:true}));
export const businessDay = (date: string | Date = new Date()) => new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo'}).format(new Date(date));
