# Auditoria de prontidão para piloto real — CRONOS

Data: 23/09/2026  
Branch auditada: `develop`

## Conclusão executiva

O CRONOS está apto para **piloto real controlado na loja**, usando dados reais da operação, desde que o piloto seja tratado como homologação assistida e não como produção definitiva.

Classificação atual:

- **87/100 — prontidão para piloto operacional real**
- **78/100 — prontidão para produção madura**

O último pipeline da branch `develop` concluiu build e deploy com sucesso. A migration `0018_cronos_schedule_notifications.sql` foi informada pelo responsável como aplicada no Supabase.

## O que está pronto para o piloto

### Autenticação e sessão
- Login Supabase por e-mail e senha.
- Logout.
- Troca interna da própria senha.
- Gestor/Admin pode definir senha de outro usuário pela Edge Function `admin-users`, respeitando as regras de administrador.
- Rascunhos de sessão são limpos no logout e ao trocar empresa/unidade.
- Existe seletor de empresa/unidade para usuários com mais de um acesso.

### Usuários, perfis e permissões
- Perfis base e personalizados.
- Permissões por empresa.
- Convite/cadastro e edição de usuários.
- `schedule.manage` separa consulta da agenda de poder de programar/reagendar.
- A programação também é protegida no banco por trigger, não apenas na interface.
- Ações de estoque são escondidas quando o usuário possui apenas permissão de visualização.

### Clientes e equipamentos
- Cadastro, edição e busca.
- Validação de duplicidade de CPF/CNPJ e número de série conforme regras do banco.
- Equipamento vinculado ao cliente.
- Criação rápida de cliente em fluxos que dependem do cadastro.

### Ordens de Serviço
- Número de OS gerado no banco.
- Bloqueio de segunda OS ativa para o mesmo equipamento.
- Criação, detalhe, histórico e acompanhamento do fluxo.
- Deep-link para abrir a OS específica no Técnico e no Comercial.
- Programação técnica por data, horário, duração, responsável e observações.
- Impressão da OS completa e do orçamento em A4/PDF.

### Técnico
- Diagnóstico e prazo estimado.
- Atualização de andamento.
- Pausa e retomada.
- Envio para testes/qualidade.
- Conclusão.
- Fotos privadas vinculadas à OS quando a infraestrutura de storage correspondente está aplicada.
- Checklist de limpeza/qualidade.

### Comercial
- Fila de orçamentos.
- Serviços e produtos na OS.
- Aprovação/recusa.
- Registro de contato/follow-up.
- Visão de carga técnica para orientar prazo.
- Impressão de orçamento para o cliente.

### Estoque
- Cadastro e edição de item.
- Entrada/ajuste, reserva, liberação e consumo por RPC.
- Integração com OS e rastreabilidade.
- Permissões visuais revisadas nas ações principais.

### Financeiro
- Entradas e saídas.
- Contas a pagar/receber.
- Parcelamento e baixa.
- Categorias e contas dinâmicas.
- DRE e relatórios.

### Notificações
- Alertas operacionais de OS, Comercial, Estoque, Financeiro e Fiscal.
- Estado de leitura persistido por usuário/empresa após a migration 0018.
- Atualização realtime preparada para as tabelas operacionais principais.
- Não existe push notification nativo/browser neste momento; a central funciona dentro do sistema.

### Relatórios
- Relatórios gerenciais e DRE.
- Impressão/PDF.
- Marca d'água e identidade Prime Tech.
- OS e orçamento específicos para entrega ao cliente.

## Pendências que não impedem um piloto controlado

### 1. Testes automatizados
O `package.json` executa TypeScript + build Vite, mas não possui suíte unitária, integração ou Playwright/E2E. Portanto, o pipeline prova que o código compila, não que cada clique funciona contra o banco real.

**Impacto no piloto:** exige roteiro manual diário nos primeiros dias.

### 2. Enter no login
O código possui `onSubmit` e tratamento explícito de Enter nos inputs, mas o comportamento já foi relatado como inconsistente no navegador real. O login pelo botão funciona.

**Impacto no piloto:** baixo; é uma falha de UX, não bloqueio de autenticação.

### 3. Multiempresa ainda não deve ser considerada pronta para produção
O contexto operacional troca `company_id`, mas `company_settings` ainda é carregado com `.limit(1).maybeSingle()` e sua tabela original não é tenantizada por `company_id`.

Isso significa que logo, CNPJ, endereço, garantia e rodapé dos documentos podem ficar globais quando houver mais de uma empresa real.

Além disso, `payment_installments` e `service_order_status_history` são carregados sem filtro explícito de `company_id` no frontend e dependem das políticas RLS para isolamento.

**Impacto no piloto:** nenhum se o piloto usar apenas a Prime Tech / uma empresa. Não liberar múltiplas empresas reais até a correção.

### 4. Fiscal
A fundação existe, mas emissão real foi deliberadamente postergada. Não usar o Fiscal como processo oficial durante o piloto até token, certificado, ambiente e emissão em homologação serem validados.

### 5. Recuperação de senha por e-mail
As telas existem, mas o fluxo externo por e-mail/domínio foi postergado. Durante o piloto, usar a troca interna de senha e a definição administrativa quando necessário.

### 6. Inativação de clientes e equipamentos
Ainda falta uma política formal de ativo/inativo/soft-delete. Não apagar registros diretamente no banco durante o piloto.

## Roteiro mínimo para liberar o piloto

Antes do primeiro atendimento real, executar uma OS de teste do começo ao fim com cada papel real do sistema:

1. Gestor cria/valida usuários e permissões.
2. Comercial/Atendimento cadastra cliente e equipamento.
3. Abre OS.
4. Técnico registra diagnóstico e prazo.
5. Comercial monta orçamento, imprime e registra aprovação.
6. Gestor/Comercial programa técnico.
7. Estoque reserva/consome item quando houver peça.
8. Técnico executa, pausa/retoma se necessário, envia para qualidade e conclui.
9. Comercial/Atendimento imprime OS final e entrega.
10. Financeiro registra/baixa o recebimento e confere relatório/DRE.
11. Conferir notificação, histórico da OS e rastreabilidade do estoque.

Se esse roteiro passar sem erro de permissão, RLS, RPC ou status, o sistema pode permanecer em piloto real controlado.

## Regras sugeridas para o piloto

- Usar **uma empresa real apenas** até tenantizar `company_settings`.
- Manter o processo antigo/planilha como contingência por alguns dias, sem duplicar decisões financeiras automaticamente.
- Não emitir nota fiscal oficial pelo CRONOS ainda.
- Não excluir registros diretamente no Supabase.
- Anotar toda ocorrência com: usuário, OS, tela, ação, horário e mensagem de erro.
- Conferir diariamente: OS abertas, estoque reservado, parcelas, notificações e histórico.

## Próxima etapa técnica

Após o piloto começar, a prioridade deve ser:

1. corrigir `company_settings` por empresa e aplicar filtros tenant explícitos;
2. criar Playwright/E2E para o fluxo completo;
3. corrigir definitivamente o Enter do login com teste de navegador;
4. criar inativação de clientes/equipamentos;
5. somente depois ativar Fiscal e recuperação externa de senha.
