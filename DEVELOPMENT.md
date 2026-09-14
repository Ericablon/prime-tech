# Ambiente de desenvolvimento — 14/09/2026

- Repositório: https://github.com/Ericablon/prime-tech (público).
- Desenvolvimento: branch `develop`; workflow `.github/workflows/development.yml`.
- Supabase: projeto `Primetech`, referência `gwvssoaqvqcmofdsirtl`, organização Ericablon.
- Região efetiva: Oregon (`us-west-2`).
- 16 tabelas com RLS e 36 políticas instaladas pelo SQL Editor. A execução manual não registra histórico de migrations da CLI.
- Login conectado ao Supabase; novos perfis ficam inativos até ativação pelo Gestor.
- Administração: busca de colaboradores, papel, ativação/desativação e permissões por papel salvas via RPC. Gestor protegido; autoalteração de acesso bloqueada.
- Nesta etapa, novos usuários são criados no Supabase Auth. Convites diretamente pelo painel ainda não foram implementados.

## Primeiro acesso

Criar a conta do responsável no Supabase Auth, confirmar sua identidade e ativar seu perfil como Gestor no SQL Editor. Não colocar senhas no repositório. O endereço de e-mail do responsável ainda precisa ser informado.

## Validação

`npm run build` passou com a configuração real do Supabase.
Consultas confirmaram 16/16 tabelas com RLS, nenhum acesso anônimo a profiles e nenhuma execução anônima da RPC administrativa.
Teste transacional passou para Gestor, Técnico, cadastro pendente, bloqueio de autoalteração e tentativa de escalada. Os usuários de teste foram revertidos com ROLLBACK.
A validação autenticada completa da interface depende do primeiro acesso do responsável.

## Configuração

O workflow usa apenas URL e chave publicável Supabase. As variáveis do repositório VITE_DATA_MODE, VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY podem substituir esses valores. Nunca incluir chave secreta/service_role no frontend.

A migration inicial destina-se a banco vazio; não executar novamente sobre o banco instalado. Mudanças futuras devem usar migrations incrementais.

## Próximas funcionalidades

Convites administrativos, recuperação de senha, fotos em Storage privado, integração fiscal e movimentações completas de estoque/caixa seguem como próximas etapas. O sistema permanece em desenvolvimento.
