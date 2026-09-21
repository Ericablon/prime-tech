# Checklist de implantação — Cronos v0.3

## 1. GitHub
- Subir este conteúdo em uma branch nova, por exemplo `rework/cronos-saas-v1`.
- Não substituir `develop`/`main` antes de revisar o diff.
- Rodar `npm ci` e `npm run build` em ambiente com acesso ao npm.

## 2. Banco
- Criar backup/snapshot antes de qualquer migration.
- Rodar consultas de pré-checagem para CPF/CNPJ, serial de equipamento, SKU e OS ativas duplicadas.
- Aplicar `0002_cronos_saas_foundation.sql` em homologação.
- Backfill de `company_id` nos registros existentes.
- Só então aplicar `0003_cronos_tenant_rbac.sql`; ele é fail-closed para linhas sem empresa.
- Validar RLS com usuários reais de cada papel.

## 3. Fiscal
- Manter ambiente `homologation` até testes completos.
- Configurar gateway/API, certificado e credenciais no backend/secret manager.
- Nunca colocar certificado, token secreto ou service-role no frontend.
- Testar emissão, rejeição, consulta, cancelamento e idempotência.

## 4. Operação
- Validar fluxo completo: Cliente → Equipamento → OS → Diagnóstico → Comercial → Aprovação → Estoque → Execução → Qualidade → Entrega → Financeiro → Fiscal.
- Confirmar que técnico não vê/edita financeiro e fiscal.
- Confirmar que comercial não altera diagnóstico técnico.
- Confirmar bloqueios de duplicidade e estoque insuficiente.
