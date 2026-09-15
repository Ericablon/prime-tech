# Cronos — desenvolvimento

Sistema de assistência técnica da Prime Tech. Referência visual e de fluxo: Itamix, adaptada para clientes, equipamentos, ordens de serviço e técnicos.

## Fluxo disponível

- Login Supabase, mostrar/ocultar senha e controle de perfil ativo.
- Gestor administra usuários existentes e permissões por perfil.
- Técnico elabora diagnóstico, peças/serviços, quantidade, preço e prazo; salva rascunho ou envia orçamento para aprovação.
- Orçamento salvo por transação SQL, com validação de status e proteção contra edição desatualizada.
- Programação técnica por OS, técnico, início e fim, com bloqueio de sobreposição e reagendamento.
- Cadastro de peças com saldo inicial e lançamentos financeiros manuais.

## Banco

Aplicar as migrations existentes antes de `supabase/setup/cronos-operational.sql`. O setup operacional é executado uma única vez. `cronos-reschedule-fix.sql` atualiza instalações que receberam a primeira versão do gatilho; pode ser reaplicado.

## Validação em 15/09/2026

- Build TypeScript/Vite aprovado.
- Supabase: transação de teste com rollback validou total, envio de orçamento, conflito de agenda e reagendamento sem duplicar.
- Interface em demonstração: orçamento em largura móvel, sem transbordamento horizontal, rascunho persistido após recarregar.

## Limites desta versão

Ainda não há emissão fiscal integrada, baixa automática de estoque ou convite de usuário pelo próprio sistema. Novos usuários são criados no Supabase Auth e ativados pelo gestor. A validação final com contas reais de atendimento e técnico ainda é necessária. O ambiente publicado segue sendo de desenvolvimento.
