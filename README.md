# Cronos • Prime Tech

Sistema integrado de assistência técnica, reestruturado como base SaaS multiempresa.

## Stack
React 19 + TypeScript + Vite + Supabase + Tailwind CSS + Lucide.

## Execução local
```bash
npm ci
cp .env.example .env
npm run dev
```
Por padrão `VITE_DATA_MODE=demo`, permitindo avaliar o novo layout sem banco.

## O que existe nesta entrega
- Login redesenhado sem imagem de fundo.
- Layout responsivo com navegação hierárquica.
- Dashboard executivo.
- Painéis Técnico e Comercial.
- OS, clientes, equipamentos, agenda, estoque, financeiro, DRE, fiscal, relatórios e administração.
- RBAC frontend ampliado.
- PWA shell básico para uso móvel.
- Interface de gateway fiscal desacoplado.
- Migrations para multiempresa, duplicidade, idempotência e RLS tenant-aware.

Leia `CRONOS_REWORK.md` e `MIGRATION_CHECKLIST.md` antes de aplicar migrations em banco existente.

## Segurança
O frontend usa apenas chave pública/anon do Supabase. Segredos fiscais, certificado, tokens privados e `service_role` devem permanecer exclusivamente no backend/secret manager.
