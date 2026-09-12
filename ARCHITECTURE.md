# Arquitetura Prime Tech

## Perfis

### Atendimento
- CRUD clientes/equipamentos.
- Abre OS.
- Consulta diagnóstico/orçamento.
- Registra aprovação/recusa do cliente.
- Registra retirada/entrega.
- Não acessa DRE, custos internos ou administração.

### Técnico
- Consulta clientes/equipamentos vinculados às OS.
- Recebe fila técnica.
- Diagnostica.
- Monta orçamento.
- Inicia/pausa/conclui manutenção.
- Registra peças usadas.
- Não aprova orçamento em nome do cliente.

### Gestor
- Acesso total.
- Estoque, financeiro, caixa, DRE, custos, fiscal, relatórios e administração.

## Regra central

A aprovação do orçamento é uma fronteira de responsabilidade:

- Técnico: **elabora**.
- Atendimento/Gestor: **registra decisão do cliente**.
- Técnico: **executa somente depois de aprovado**.

## Domínios principais

- Identity/RBAC
- CRM
- Equipment Registry
- Service Orders
- Budgeting
- Workshop / Technical Work
- Inventory
- Finance / Cash / DRE
- Fiscal
- Documents
- Reports
- Audit

## Fiscal

Separar valores de serviço e peça desde a origem. Não acoplar emissão fiscal ao componente React. Criar contrato server-side de provedor fiscal para permitir troca de fornecedor sem reescrever o sistema.
