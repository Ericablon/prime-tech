# Auditoria geral do CRONOS — 23/09/2026

## Escopo e limite da auditoria

Auditoria estática do código da branch `develop`, das migrations e do pipeline de build/deploy. O projeto Prime Tech no Supabase não está conectado às ferramentas desta sessão, portanto esta auditoria **não substitui um teste E2E autenticado no banco real**.

O CI atual executa TypeScript + build Vite e deploya o GitHub Pages. Não existe, neste momento, suíte automatizada de testes unitários, integração ou E2E.

## Índice de prontidão

- **82/100 — núcleo operacional**, considerando Fiscal e recuperação de senha como itens deliberadamente postergados.
- **74/100 — produto completo**, incluindo Fiscal, recuperação por e-mail, automação de testes e acabamento SaaS/multiempresa.

O percentual não significa que 82% das linhas estão concluídas; é uma avaliação de prontidão operacional baseada em fluxos, segurança, persistência, consistência e verificabilidade.

## Fluxos auditados

### Autenticação e sessão

- Login Supabase implementado.
- Login por botão funciona conforme fluxo existente; Enter recebeu correção direta por teclado em 23/09/2026 e ainda precisa de validação E2E no navegador autenticado.
- Logout implementado.
- Rascunhos `sessionStorage` passam a ser limpos no logout para evitar reaproveitamento entre usuários da mesma sessão do navegador.
- Troca interna da própria senha adicionada em `/conta/senha`, validando a senha atual antes da alteração.

### Usuários, perfis e permissões

- Cadastro por convite via Edge Function `admin-users`.
- Edição de nome, perfil, perfil personalizado e situação.
- Perfis personalizados e permissões por empresa.
- Definição administrativa de nova senha adicionada à Edge Function e à tela de usuários.
- Gestor precisa possuir `users.manage` para alterar senha de outro usuário.
- Usuários não administradores não podem criar/promover/editar administrador nem definir senha de administrador.
- A própria senha deve ser alterada pelo usuário na tela de conta.

### Clientes

- Cadastro funcional.
- Edição funcional.
- Busca e busca global integradas.
- Rascunho temporário preservado na sessão.
- Não há exclusão funcional exposta; deve-se decidir futuramente entre inativação/soft-delete ou exclusão controlada.

### Equipamentos

- Cadastro e edição funcionais.
- Cadastro rápido de cliente sem sair da tela.
- Busca e busca global integradas.
- Rascunho temporário.
- Não há exclusão funcional exposta.

### Ordens de Serviço

- Criação de OS com identificação numérica gerada no banco.
- Bloqueio de segunda OS ativa para o mesmo equipamento.
- Validação de vínculo cliente/equipamento.
- Detalhe, histórico e status disponíveis.
- Composição de serviços/produtos integrada ao estoque.
- Ajuste de 23/09/2026: orçamento de serviço não é mais bloqueado por regra fiscal ausente. A regra pode ser completada antes da NFS-e.

### Operação técnica

- Diagnóstico.
- Estimativa de prazo.
- Salvar rascunho técnico e enviar ao Comercial.
- Pausa, retomada, atualizações, testes e conclusão.
- Fotos privadas vinculadas à OS quando infraestrutura da migration correspondente está aplicada.
- Checklist de limpeza/qualidade.
- Programação com técnico, data, horário, duração e observações.

**Ponto de atenção:** a programação usa hoje `orders.commercial || orders.tech`; falta uma permissão específica como `schedule.manage` para separar execução técnica de poder de reagendar/atribuir OS.

### Comercial

- Fila comercial.
- Orçamento e aprovação/reprovação.
- Registro de contatos/follow-up.
- Painel de carga dos técnicos.
- Estimativa operacional baseada na fila.

**Ponto de atenção:** atalhos de OS para Técnico/Comercial chegam ao módulo, mas não necessariamente abrem a OS já focada no painel operacional.

### Estoque

- Cadastro de item.
- Edição de cadastro.
- Reserva, liberação, consumo e ajuste por RPC.
- Reserva automática após aprovação da OS.
- Consumo automático quando a OS chega a pronta para retirada.
- Liberação automática em cancelamento.
- Histórico e saldo inicial rastreáveis.

**Ponto de atenção:** alguns controles de interface ainda devem ser revisados para esconder ações para quem possui somente `stock.view`; o banco continua sendo a proteção final via RLS/RPC.

### Financeiro

- Entradas e saídas.
- Contas a pagar/receber e parcelamento.
- Baixa de parcelas.
- Categorias financeiras dinâmicas.
- Contas/caixas dinâmicos.
- Cadastro rápido com `+`.
- DRE por competência.
- Relatórios/PDF.

Migrations `0016` e `0017` foram ajustadas durante a implantação e informadas como aplicadas com sucesso.

### Relatórios

- Relatório gerencial.
- DRE em PDF.
- Marca d'água Prime Tech em documento imprimível.
- Filtros e consolidações implementados.

### Busca global

- Busca módulos, OS, clientes, documentos/contatos, equipamentos, estoque e financeiro.
- OS abre diretamente no detalhe.
- Demais tipos usam filtro na página de destino.

### Notificações

- Central calcula alertas operacionais de OS, comercial, estoque, financeiro e fiscal.
- Estado de lido é local ao navegador.

**Ponto de atenção:** ainda não é uma central de notificações persistida/realtime no servidor; não existe push ou histórico de leitura por usuário no backend.

### Tema e UX

- Tema claro e escuro.
- Contraste revisado.
- Login premium e responsivo.
- Memória temporária em vários formulários.
- PDF permanece claro para impressão, independente do tema do sistema.

### Fiscal

Fundação técnica existente, mas ativação real foi deliberadamente postergada. Não considerar emissão fiscal pronta para produção enquanto token/provedor/certificado/configurações fiscais não forem validados E2E.

### Recuperação de senha por e-mail

Páginas e templates existem, mas configuração final do Supabase/template/domínio foi deliberadamente postergada.

## Principais riscos/pêndencias antes de considerar produção madura

1. Criar testes automatizados (unitários + integração + Playwright/E2E) e incluí-los no CI.
2. Rodar roteiro E2E no Supabase real para cada papel: gestor, comercial, técnico, estoque e financeiro.
3. Criar permissão específica para programação técnica.
4. Revisar todos os controles visíveis contra a matriz de permissões, além da proteção no banco.
5. Evoluir notificações para persistência/realtime caso sejam necessárias como mecanismo operacional crítico.
6. Se houver multiempresa real, implementar seletor explícito de empresa/unidade; hoje o contexto resolve o primeiro acesso ativo.
7. Fazer deep-link/foco da OS ao abrir Técnico/Comercial a partir de uma OS específica.
8. Decidir política de inativação/soft-delete de clientes e equipamentos em vez de exclusão física.
9. Ativar e testar Fiscal.
10. Configurar e testar recuperação de senha por e-mail.

## Critério para subir de 82 para 90+

O maior ganho não virá de novas telas, e sim de **verificação automatizada**: testes E2E dos fluxos críticos, correção dos pontos de permissão e confirmação no Supabase real. Depois disso, com Fiscal e recovery ativados, o sistema pode se aproximar de uma condição de produção madura.
