export type FinancialDirection = 'income' | 'expense';

export type DreGroup =
  | 'gross_revenue'
  | 'deduction'
  | 'cost_of_sales'
  | 'operating_expense'
  | 'financial_expense'
  | 'other_income'
  | 'other_expense';

export interface FinancialCategoryDefinition {
  code: string;
  label: string;
  direction: FinancialDirection;
  dreGroup: DreGroup;
  order: number;
}

export const financialCategories: FinancialCategoryDefinition[] = [
  { code: 'servicos', label: 'Serviços', direction: 'income', dreGroup: 'gross_revenue', order: 10 },
  { code: 'pecas', label: 'Peças', direction: 'income', dreGroup: 'gross_revenue', order: 20 },
  { code: 'venda_equipamentos', label: 'Venda de equipamentos', direction: 'income', dreGroup: 'gross_revenue', order: 30 },
  { code: 'outras_receitas', label: 'Outras receitas', direction: 'income', dreGroup: 'other_income', order: 90 },
  { code: 'impostos_taxas', label: 'Impostos e taxas', direction: 'expense', dreGroup: 'deduction', order: 110 },
  { code: 'custo_pecas', label: 'Custo de peças e materiais', direction: 'expense', dreGroup: 'cost_of_sales', order: 120 },
  { code: 'folha_pessoal', label: 'Folha e pessoal', direction: 'expense', dreGroup: 'operating_expense', order: 210 },
  { code: 'aluguel', label: 'Aluguel', direction: 'expense', dreGroup: 'operating_expense', order: 220 },
  { code: 'energia', label: 'Energia', direction: 'expense', dreGroup: 'operating_expense', order: 230 },
  { code: 'internet_telefonia', label: 'Internet e telefonia', direction: 'expense', dreGroup: 'operating_expense', order: 240 },
  { code: 'transporte', label: 'Transporte e deslocamento', direction: 'expense', dreGroup: 'operating_expense', order: 250 },
  { code: 'manutencao', label: 'Manutenção e conservação', direction: 'expense', dreGroup: 'operating_expense', order: 260 },
  { code: 'marketing', label: 'Marketing e comercial', direction: 'expense', dreGroup: 'operating_expense', order: 270 },
  { code: 'taxas_financeiras', label: 'Taxas e despesas financeiras', direction: 'expense', dreGroup: 'financial_expense', order: 310 },
  { code: 'outras_despesas', label: 'Outras despesas', direction: 'expense', dreGroup: 'other_expense', order: 390 },
];

export const dreGroupLabels: Record<DreGroup, string> = {
  gross_revenue: 'Receita operacional bruta',
  deduction: 'Deduções / impostos',
  cost_of_sales: 'Custos de peças e materiais',
  operating_expense: 'Despesas operacionais',
  financial_expense: 'Despesas financeiras',
  other_income: 'Outras receitas',
  other_expense: 'Outras despesas',
};

export const dreGroupOrder: DreGroup[] = [
  'gross_revenue',
  'other_income',
  'deduction',
  'cost_of_sales',
  'operating_expense',
  'financial_expense',
  'other_expense',
];

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

export function categoriesFor(direction: FinancialDirection) {
  return financialCategories
    .filter((item) => item.direction === direction)
    .sort((a, b) => a.order - b.order);
}

export function resolveFinancialCategory(
  label: string,
  direction: FinancialDirection,
): FinancialCategoryDefinition {
  const normalized = normalize(label);
  const match = financialCategories.find(
    (item) => item.direction === direction
      && (normalize(item.label) === normalized || item.code === normalized),
  );

  if (match) return match;

  return direction === 'income'
    ? { code: 'custom_income', label: label || 'Outras receitas', direction, dreGroup: 'other_income', order: 999 }
    : { code: 'custom_expense', label: label || 'Outras despesas', direction, dreGroup: 'other_expense', order: 999 };
}
