# CRONOS — NFS-e Nacional direta com certificado A1

O CRONOS usa o Supabase como backend e, nesta fase, emite **NFS-e de serviços diretamente pela API oficial da NFS-e Nacional / SEFIN Nacional**, sem Focus NFe e sem mensalidade de provedor fiscal.

NF-e e NFC-e de produtos permanecem desativadas até a integração direta com a SEFAZ.

## 1. Banco de dados

Aplicar, em ordem, todas as migrations pendentes até:

- `0012_cronos_fiscal_certificate_storage.sql` — bucket privado e cadastro do A1;
- `0020_cronos_nfse_nacional_direct.sql` — NFS-e Nacional direta, metadados do A1, DPS e XML;
- `0021_cronos_nfse_nacional_lock.sql` — trava o sistema no emissor direto e impede retorno acidental para Focus NFe.

## 2. Certificado A1

O arquivo `.pfx` ou `.p12` fica no bucket privado `fiscal-certificates`.

A senha **não é gravada na tabela nem no Storage**. Para desbloquear o A1 existem duas opções:

1. informar a senha durante a validação/emissão; ou
2. configurar a senha como secret da Edge Function `CRONOS_A1_PASSWORD` para não precisar digitá-la em cada emissão.

Nunca colocar a senha do A1 em arquivo versionado, `VITE_*`, localStorage, tabela pública ou código-fonte.

Ao desbloquear o A1, o `fiscal-gateway` extrai e registra:

- titular / subject;
- emissor do certificado;
- número de série;
- CPF/CNPJ encontrado no certificado;
- início da validade;
- vencimento;
- data da última validação.

O gateway também confere se o CPF/CNPJ do A1 corresponde ao emitente cadastrado no CRONOS. Quando seguro, pode preencher CNPJ e razão social ausentes. Regime tributário, inscrição municipal, endereço, código IBGE e regras de serviço não são informações confiáveis do certificado e continuam sendo cadastro fiscal da empresa.

## 3. Configuração fiscal

Abrir `Fiscal > Configuração fiscal` e manter inicialmente o ambiente em **Homologação / Produção restrita**.

Preencher pelo menos:

- razão social e CNPJ;
- inscrição municipal;
- regime tributário;
- endereço fiscal;
- município e código IBGE de 7 dígitos;
- série da DPS;
- regra fiscal do serviço com Código de Tributação Nacional, CNAE/LC 116 quando aplicável e configuração do ISSQN;
- opção do Simples Nacional e demais parâmetros da NFS-e exigidos para o regime da empresa.

A tributação deve ser validada pela contabilidade antes de produção.

## 4. Edge Function

A função é:

`supabase/functions/fiscal-gateway/index.ts`

Ela executa quatro ações principais:

- `certificate_info` — desbloqueia o A1, valida titularidade e grava metadados;
- `issue` — monta a DPS, assina com o A1 e transmite à SEFIN Nacional;
- `status` — consulta a situação da NFS-e;
- `cancel` — fluxo reservado para cancelamento conforme suporte/retorno do ambiente nacional.

Publicar a função no projeto Supabase correto com JWT habilitado:

```bash
supabase functions deploy fiscal-gateway --project-ref gwvssoaqvqcmofdsirtl
```

Não usar `--no-verify-jwt`.

## 5. Homologação

Antes de produção, executar uma OS de teste com **somente serviço** e validar:

1. A1 desbloqueado com sucesso;
2. CPF/CNPJ do A1 igual ao emitente;
3. validade do certificado;
4. cadastro do tomador;
5. regra fiscal do serviço;
6. preparação do documento fiscal;
7. geração de número de DPS;
8. assinatura da DPS;
9. transmissão ao ambiente restrito da NFS-e Nacional;
10. retorno da chave/número/status;
11. armazenamento do XML autorizado no bucket privado;
12. consulta posterior da nota;
13. bloqueio de duplicidade;
14. bloqueio para usuário sem permissão fiscal.

## 6. Produção

Somente depois da homologação completa:

- confirmar os dados do emitente e tributação com a contabilidade;
- alterar o ambiente fiscal para `Produção`;
- marcar explicitamente `Confirmo emissão real`;
- emitir primeiro uma NFS-e real de baixo risco e conferir no portal nacional/contabilidade.

O frontend exige confirmação adicional antes de transmitir em produção.

## Segurança

- A1: bucket privado.
- Senha do A1: nunca persistida no banco; somente em memória por chamada ou secret da Edge Function.
- Emissão: protegida por sessão e permissões da empresa.
- Numeração da DPS: alocação atômica no banco.
- XML: bucket privado por empresa.
- Documentos fiscais: vinculados à OS e mantêm status, chave, número, protocolo, erros e sincronização.
