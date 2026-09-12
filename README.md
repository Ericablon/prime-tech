# Prime Tech • Sistema de Assistência Técnica

Starter funcional e estruturado para o fluxo real da Prime Tech.

## O que já funciona

- Login em **modo demonstração** com 3 perfis: Atendimento, Técnico e Gestor.
- Sidebar filtrada por permissão.
- Dashboard diferente para cada perfil.
- Cadastro de clientes.
- Cadastro de equipamentos.
- Abertura de Ordem de Serviço pelo Atendimento/Gestor.
- Fila e tela de OS.
- Diagnóstico técnico + itens de orçamento separados entre **serviço** e **peça**.
- Envio do orçamento para aprovação do cliente.
- Atendimento/Gestor registra aprovação ou recusa.
- Técnico inicia manutenção, marca aguardando peça e conclui.
- Atendimento/Gestor registra entrega.
- Estoque inicial.
- Financeiro e DRE simplificada como base.
- Módulo Fiscal preparado para NFS-e / NF-e / NFC-e.
- Documento de OS/orçamento em A4 com **logo Prime Tech** e impressão/PDF pelo navegador.
- Administração dos dados da empresa usados nos documentos.
- Tema claro/escuro com identidade visual inspirada na logo e fachada.
- Persistência local no modo demo para testar sem banco.

## Stack

- React + TypeScript + Vite
- Tailwind CSS v4
- React Router
- Lucide Icons
- Supabase: PostgreSQL + Auth + Storage + Edge Functions

## Minha recomendação para o banco agora

**Use um novo projeto Supabase Free, exclusivo da Prime Tech.**

Para este primeiro ciclo ele é a melhor relação entre simplicidade e arquitetura porque já reúne:

1. PostgreSQL relacional, ideal para OS, estoque, financeiro e fiscal.
2. Autenticação.
3. Row Level Security (RLS).
4. Storage para fotos de equipamentos, documentos, XML/PDF e logos.
5. Edge Functions para integrações futuras, inclusive emissão fiscal server-side.

Não reutilize Supabase de outro projeto. Crie um novo projeto/organização conforme a sua estrutura.

Alternativas como banco PostgreSQL separado são válidas, mas no início obrigariam a combinar banco + autenticação + storage + backend. Para a Prime Tech isso aumenta a complexidade sem trazer vantagem importante agora.

## 1. Rodar sem banco

```bash
npm install
cp .env.example .env
npm run dev
```

Deixe:

```env
VITE_DATA_MODE=demo
```

A tela de login mostrará os três acessos de demonstração.

## 2. Criar o Supabase

Crie um **novo projeto Supabase** e execute no SQL Editor:

```text
supabase/migrations/0001_prime_tech_core.sql
```

O SQL cria:

- roles
- permissions
- role_permissions
- profiles
- company_settings
- clients
- equipment
- service_orders
- service_order_items
- service_order_status_history
- stock_items
- stock_movements
- cash_sessions
- financial_entries
- fiscal_documents
- audit_logs
- RLS
- regras de transição das OS

## 3. Configurar o frontend para Supabase

Crie `.env`:

```env
VITE_DATA_MODE=supabase
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=SUA_ANON_KEY
```

**Nunca coloque `service_role` no Vite/frontend.**

## 4. Usuários

O banco nasce com 3 perfis:

- `atendimento`
- `tecnico`
- `gestor`

O starter cria um profile automaticamente quando um usuário do Supabase Auth é criado. Enquanto não construirmos a Edge Function administrativa de usuários, ajuste o primeiro gestor via SQL após criar o usuário:

```sql
update public.profiles
set role_code = 'gestor'
where id = 'UUID-DO-USUARIO';
```

### Segurança importante

Para produção, **desative cadastro público de usuários**. Usuários deverão ser criados pelo Gestor através de uma função server-side protegida. Não permita que alguém se cadastre livremente como Atendimento.

## 5. Fluxo implementado

```text
Atendimento
  ↓
Cliente + equipamento + nova OS
  ↓
Aguardando técnico
  ↓
Técnico faz diagnóstico e orçamento
  ↓
Aguardando cliente
  ↓
Atendimento registra aprovação
  ↓
Aprovado
  ↓
Técnico inicia manutenção
  ↓
Em manutenção / aguardando peça
  ↓
Concluído
  ↓
Aguardando retirada
  ↓
Atendimento entrega
  ↓
OS encerrada
```

## 6. Fiscal

O módulo fiscal do starter é **estrutura**, não emissão real ainda.

A emissão real de NFS-e / NF-e / NFC-e deverá ser feita por:

```text
Frontend
  ↓
Edge Function / backend seguro
  ↓
Integração fiscal
  ↓
Prefeitura / SEFAZ
```

Certificados digitais, tokens, senhas e secrets **não podem ficar no frontend**.

A modelagem já separa `service` de `part`, o que será necessário para tributação, estoque, custos e DRE.

## 7. Documentos e logo

A logo padrão está em:

```text
public/brand/prime-tech-logo.jpeg
```

O documento A4 de OS/orçamento está em:

```text
src/documents/OrderDocument.tsx
```

As configurações da empresa ficam em `company_settings` e alimentam os documentos automaticamente.

## 8. Próximas etapas recomendadas

1. Criar novo repositório GitHub da Prime Tech.
2. Criar novo projeto Supabase.
3. Rodar a migration.
4. Testar ponta a ponta Atendimento → Técnico → Atendimento.
5. Adicionar upload de fotos da entrada/saída e Storage privado.
6. Implementar usuários/permissões no painel Gestor.
7. Implementar movimentação real de estoque vinculada à OS.
8. Implementar caixa, pagamentos e fechamento de caixa.
9. Evoluir a DRE e custos.
10. Integrar o provedor fiscal via Edge Function.
11. Criar garantias e reabertura de OS.
12. Criar relatórios e PDFs adicionais com identidade da Prime Tech.

## Observação sobre a logo

A imagem fornecida foi incluída como referência visual no starter. Para produção, o ideal é substituir por uma versão oficial da logo em PNG/SVG com fundo adequado para documentos claros e interface escura.
