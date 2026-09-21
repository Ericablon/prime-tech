# Cronos v0.3 — Reestruturação SaaS

Esta entrega reorganiza o Cronos como produto de assistência técnica com base para multiempresa.

## Incluído nesta versão
- Design system escuro responsivo e login sem imagem de fundo.
- Sidebar hierárquica por módulos/submódulos e permissões.
- Dashboard executivo com operação, comercial, estoque, financeiro e fiscal.
- Painel Técnico orientado a celular/PWA.
- Painel Comercial conectado à fila de diagnóstico técnico.
- Estoque com leitura físico/reservado/disponível e migration para idempotência.
- Financeiro separado em visão geral e DRE.
- Motor Fiscal com interface de gateway desacoplada e migration de idempotência/configuração.
- RBAC ampliado no frontend para Atendimento, Comercial, Técnico, Estoque, Financeiro, Fiscal, Gestor e Admin.
- Migration 0002 para organizações, empresas, unidades, acesso por empresa e travas de duplicidade.

## Antes de produção
1. Aplique a migration 0002 apenas em ambiente de desenvolvimento/homologação e revise conflitos com os dados atuais.
2. Migre as RLS legadas para políticas tenant-aware usando `user_company_access` antes de ativar multiempresa.
3. Configure `VITE_DATA_MODE=supabase`, URL e anon key apenas no ambiente adequado.
4. Conecte um gateway fiscal homologado e guarde segredos/certificados no backend/secret manager, nunca no navegador.
5. Homologue NFS-e/NF-e com os dados fiscais reais da empresa antes de habilitar produção.
6. Acrescente testes automatizados dos fluxos críticos: duplicidade, estoque, aprovação, faturamento, fiscal e permissões.

## Fluxo alvo
Cliente → Equipamento → OS → Técnico → Diagnóstico → Comercial → Orçamento → Aprovação → Reserva/Estoque → Execução → Qualidade → Entrega → Financeiro → Fiscal.
