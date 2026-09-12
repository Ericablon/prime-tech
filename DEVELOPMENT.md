# Prime Tech — desenvolvimento

Projeto extraído do starter fornecido, mantendo React, Vite, TypeScript, Tailwind e identidade visual. A logo enviada está em `public/brand/prime-tech-logo.jpeg`.

## Executar

Use Node.js 22 ou superior. Execute `npm ci --ignore-scripts`, depois `npm run dev`. O modo inicial é demonstração, com dados no navegador. Não use dados reais nessa demonstração.

## GitHub

A branch de desenvolvimento é `develop`. O workflow `.github/workflows/development.yml` verifica pull requests e publica pushes dessa branch no GitHub Pages. Após criar o repositório e enviar o código, selecione GitHub Actions em Settings → Pages. Rotas usam hash para permitir atualizar páginas diretamente no GitHub Pages. Assets usam caminhos relativos.

O repositório remoto e a publicação ainda dependem de autenticação e confirmação da conta GitHub.

## Supabase

O projeto remoto ainda não foi criado nem recebeu SQL. A organização e eventual custo precisam ser definidos. A migração original ainda precisa de revisão completa e testes de permissões em banco de desenvolvimento antes de ser aplicada.

Foi corrigida a origem do perfil no cadastro: `role_code` agora vem de `raw_app_meta_data`, que é controlado pelo servidor, e não dos metadados editáveis pelo usuário. Desative cadastro público antes de disponibilizar o banco e crie usuários por administração confiável.

Para conectar, configure as variáveis de repositório `VITE_DATA_MODE=supabase`, `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`. Localmente, use `.env.local`. Nunca use service_role ou chave secreta no frontend. Configuração ausente em modo Supabase mostra erro, sem liberar acesso demo automaticamente.

## Pendências funcionais herdadas

Emissão fiscal real, administração de usuários por backend, uploads privados e movimentação integrada de estoque/caixa ainda não estão concluídos. O envio do orçamento atualmente faz várias gravações separadas; deve virar uma transação no backend antes do uso operacional. A revisão completa de RLS e os testes entre os três perfis continuam pendentes.

## Validação

Dependências fixadas com lockfile. A compilação TypeScript e a geração do bundle são verificadas nesta preparação. O teste ponta a ponta com autenticação real depende do Supabase de desenvolvimento. O CSS avulso fornecido serviu de referência; o CSS do starter foi mantido porque já implementa a mesma paleta e os componentes usados pelo aplicativo.
