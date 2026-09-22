# Cronos / Prime Tech — mapa de reaproveitamento do Itamix Operations Hub

Este documento registra o que será reaproveitado conceitualmente e tecnicamente do pacote **Itamix Operations Hub** na evolução do Cronos.

## Princípio

Não copiar regras específicas de concreteira para o Cronos. Reaproveitar padrões maduros de arquitetura, fluxo, relatórios e controle, adaptando-os ao domínio de assistência técnica.

## 1. Financeiro

Referências principais do Itamix:

- `db/migrations/003_finance_foundation.sql`
- `db/migrations/021_delivery_to_receivable.sql`
- `db/migrations/022_financial_monthly_closing.sql`
- `db/migrations/023_financial_dre_reports.sql`
- `db/migrations/024_financial_closing_by_account.sql`
- `db/migrations/046_payment_terms_installments.sql`
- `db/migrations/048_payment_methods_and_plans.sql`
- `db/migrations/049_payment_snapshots_and_financial_schedule.sql`
- `src/pages/financeiro/*`
- `src/components/financeiro/*`

Adaptação Cronos:

- contas financeiras / caixas e bancos;
- contas a receber e a pagar;
- parcelas e baixas;
- categorias financeiras estruturadas;
- competência financeira;
- DRE gerencial por categoria;
- relatórios financeiros imprimíveis em A4/PDF;
- integração futura automática da OS aprovada/concluída com contas a receber.

## 2. Comercial

Referências principais:

- `db/migrations/004_commercial_foundation.sql`
- `db/migrations/005_commercial_flow_improvements.sql`
- `src/components/comercial/QuoteFormModal.tsx`
- `src/components/comercial/PaymentConditionSection.tsx`
- `src/pages/comercial/Orcamentos.tsx`
- `src/pages/comercial/Pedidos.tsx`
- `src/pages/comercial/Relatorios.tsx`

Adaptação Cronos:

- orçamento originado pelo diagnóstico técnico;
- condições de pagamento e parcelamento;
- follow-up;
- aprovação/reprovação;
- snapshots de preço e condição comercial;
- conversão do orçamento aprovado em execução técnica/financeiro.

## 3. Estoque

Referências principais:

- `db/migrations/010_inventory_foundation.sql`
- `db/migrations/029_inventory_weighted_average_cost.sql`
- `src/components/estoque/InventoryMovementFormModal.tsx`
- `src/components/estoque/StockAdjustmentModal.tsx`
- `src/pages/estoque/*`

Adaptação Cronos:

- saldo físico, reservado e disponível;
- movimentação de entrada, saída, ajuste, reserva e consumo por OS;
- idempotência das movimentações;
- estoque mínimo e alertas;
- custo médio em etapa posterior;
- rastreabilidade completa do material usado em cada OS.

## 4. Programação técnica

Referências principais:

- `db/migrations/011_operation_foundation.sql`
- `db/migrations/019_operation_schedule_by_site.sql`
- `src/pages/operacao/Programacao.tsx`
- `src/components/operacao/DayScheduleModal.tsx`
- `src/components/operacao/ScheduleDetailModal.tsx`
- `src/components/operacao/ScheduleEditModal.tsx`

Adaptação Cronos:

- programação por data/hora;
- técnico responsável;
- duração estimada;
- observações da programação;
- conflitos de agenda;
- separação por especialidade técnica;
- visão diária e futura.

## 5. Especialidades técnicas

O Cronos começa com duas especialidades:

1. **Impressoras**
2. **Computadores**

A implementação deve ser configurável. A OS recebe uma `technical_specialty_code`, e o vínculo de técnicos a especialidades é uma relação própria, permitindo que um técnico tenha uma ou mais especialidades.

O sistema deve impedir atribuição incompatível quando o técnico já possuir especialidades configuradas.

## 6. Fiscal / NF

Referências principais:

- `db/migrations/044_fiscal_dfe_foundation.sql`
- `gateway/itamix-fiscal-gateway/*`
- `src/types/fiscal.ts`
- `src/hooks/useReceivedFiscalDocuments.ts`

Adaptação Cronos:

- manter credenciais/certificados somente no servidor;
- gateway fiscal desacoplado do frontend;
- homologação e produção separadas;
- logs de sincronização/emissão;
- idempotência;
- suporte futuro a NF-e/NFS-e por provedor configurável.

O frontend não deve afirmar que uma NF foi emitida enquanto não houver gateway fiscal real configurado e confirmação do provedor.

## 7. Relatórios e PDF

Referências principais:

- `src/components/financeiro/PrintableReport.tsx`
- `src/components/financeiro/FinancialReportPrintTemplate.tsx`
- `src/components/reports/ModuleReportsPage.tsx`
- `src/utils/financialReports.ts`

Adaptação Cronos:

- relatório operacional;
- relatório técnico;
- comercial;
- financeiro;
- estoque;
- fiscal;
- DRE;
- filtros por período, cliente, técnico, especialidade e status;
- visual A4 com cabeçalho da Prime Tech e opção "Imprimir / Salvar PDF".

## 8. Dashboards

Referências principais:

- `src/pages/dashboards/VisaoGeral.tsx`
- `src/pages/dashboards/Comercial.tsx`
- `src/pages/dashboards/Financeiro.tsx`
- `src/pages/dashboards/Estoque.tsx`
- `src/pages/dashboards/Operacao.tsx`

Adaptação Cronos:

- cockpit executivo geral;
- cards por módulo;
- alertas críticos;
- funil comercial;
- fila por especialidade;
- tempo médio técnico;
- estoque crítico;
- contas a receber/pagar;
- resultado e DRE;
- visão consolidada respeitando RBAC e tenant.

## Ordem de implementação

### Fase A — fundação

- especialidades técnicas;
- categorias e contas financeiras;
- DRE por categorias;
- ledger de reserva/consumo/ajuste de estoque;
- duração/notas de programação.

### Fase B — UX operacional

- seleção de especialidade na abertura da OS;
- programação por especialidade/técnico;
- movimentos de estoque;
- financeiro por categoria/conta;
- relatórios imprimíveis.

### Fase C — gestão

- dashboards detalhados por módulo;
- relatórios com filtros e PDF;
- indicadores comparativos e histórico.

### Fase D — fiscal real

- escolha/configuração de provedor;
- adapter server-side;
- credenciais/certificado;
- emissão/cancelamento/consulta;
- XML/PDF/webhooks/logs.
