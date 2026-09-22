# CRONOS — Ativação do módulo fiscal

O Cronos está preparado para NF-e, NFC-e e NFS-e usando um adapter de backend para Focus NFe. A emissão real só deve ser habilitada depois da homologação completa.

## 1. Banco de dados

Aplicar, em ordem, todas as migrations pendentes até:

- `0011_cronos_fiscal_emission_foundation.sql`

A migration 0011 cria a estrutura fiscal de emitente, destinatário, produtos, serviços, snapshots da nota, pagamentos e RPCs de validação/preparação.

## 2. Cadastro no Cronos

Abrir `Fiscal > Configuração fiscal` e preencher:

- razão social / CNPJ;
- inscrição estadual e municipal, quando aplicáveis;
- regime tributário;
- endereço fiscal e código IBGE;
- ambiente inicialmente `Homologação`;
- séries, quando necessárias;
- produtos com NCM, CFOP, unidade, origem e CST/CSOSN/PIS/COFINS/IPI;
- regras fiscais dos serviços com código de tributação, LC 116, CNAE e ISS.

Os valores tributários devem ser validados pela contabilidade da Prime Tech antes de produção.

## 3. Provedor fiscal

A implementação atual usa Focus NFe como primeiro adapter. Criar a empresa/emitente no provedor e concluir o credenciamento/certificado exigido para os documentos que serão emitidos.

Nunca salvar token do provedor no frontend, em `VITE_*`, na tabela `fiscal_settings` ou em arquivos versionados.

## 4. Secrets da Edge Function

Configurar no projeto Supabase correto:

- `FOCUS_NFE_TOKEN_HOMOLOGATION`
- `FOCUS_NFE_TOKEN_PRODUCTION` (somente quando a produção for homologada)

O Supabase fornece automaticamente `SUPABASE_URL` e `SUPABASE_ANON_KEY` para a Edge Function.

## 5. Publicar a Edge Function

A função está em:

`supabase/functions/fiscal-gateway/index.ts`

Ela deve ser publicada com verificação JWT habilitada. Exemplo usando Supabase CLI autenticada no projeto correto:

```bash
supabase functions deploy fiscal-gateway --project-ref <PROJECT_REF>
```

Não use `--no-verify-jwt`.

## 6. Homologação

Antes de produção, testar pelo menos:

1. OS somente com serviço -> NFS-e;
2. OS somente com produto -> NF-e;
3. OS mista -> NFS-e do serviço + NF-e dos produtos;
4. Pix;
5. cartão de débito;
6. cartão de crédito;
7. boleto;
8. parcelamento;
9. rejeição de nota por dado fiscal incorreto;
10. reconsulta de documento;
11. cancelamento autorizado;
12. download de XML/PDF;
13. tentativa de emissão duplicada;
14. usuário sem permissão fiscal;
15. isolamento entre empresas.

## 7. Produção

Somente depois da homologação:

- cadastrar o token de produção;
- conferir certificado/credenciamento;
- conferir tributação com a contabilidade;
- mudar `Fiscal > Configuração fiscal > Ambiente` para `Produção`;
- marcar explicitamente `Confirmo emissão real`.

O frontend pede confirmação adicional antes de transmitir um documento em produção.

## Segurança

- Token do provedor: somente secret da Edge Function.
- Emissão/cancelamento: protegidos por autenticação e permissões de empresa.
- Documentos usam referência/idempotência para evitar duplicidade.
- Itens e pagamentos são congelados em snapshots antes da transmissão.
- XML, PDF, protocolo, chave, número e erros ficam ligados ao documento fiscal.
