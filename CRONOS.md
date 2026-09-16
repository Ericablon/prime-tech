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

## Fluxo Comercial e Técnico — 16/09/2026

1. Comercial cadastra cliente/equipamento, recebe código TEC e abre a OS.
2. Técnico avalia, registra diagnóstico/itens/prazo e envia ao Comercial.
3. Comercial revisa valores, apresenta o orçamento e registra envio e decisão do cliente.
4. Aprovação libera manutenção; revisão devolve à avaliação.
5. Técnico descreve o serviço executado e devolve ao Comercial.
6. Comercial registra contato, condições de pagamento, recebimentos e entrega. Entrega parcelada não exige quitação integral.

A programação permite reservar um horário por OS, com conflito por técnico. As filas podem ser atualizadas pelo botão Atualizar filas.

O painel financeiro registra entradas/saídas e planos de pagamento, vinculados à OS ou avulsos para vendas/serviços. Métodos: dinheiro, Pix, crédito, débito, boleto e transferência. Parcelas mensais (até 36), com vencimentos e baixa individual. Entrada e saldo parcelado podem ser registrados como planos separados respeitando o total da OS. O caixa considera apenas baixas confirmadas; a condição de pagamento não é receita recebida.

Aplicar `supabase/setup/commercial-workflow.sql` uma vez após os setups anteriores. Não reaplicar o arquivo completo: ele adiciona colunas, tabelas e políticas.

Validação: build aprovado; transações com rollback testaram fluxo completo, código técnico, parcelas/centavos, fim de mês, repetição sem duplicar e limite do saldo. Perfis temporários testaram orçamento técnico sem acesso financeiro e Comercial com revisão/aprovação/recebimento sem permissão para executar manutenção. Interface em demonstração validou três parcelas, baixa de uma e filas na largura de celular.

Não há envio automático ao cliente, processamento de cartão, emissão/registro bancário de boleto ou conciliação automática de Pix. O Comercial realiza o contato/cobrança externamente e registra aqui o resultado. Emissão fiscal e baixa automática de estoque continuam fora desta versão.

Após o fluxo comercial, aplicar `supabase/setup/quote-stage-guard.sql` para restringir alteração dos itens às etapas de avaliação técnica ou revisão comercial. Para alterar um orçamento já enviado ao cliente, usar Devolver ao Técnico para revisão.
