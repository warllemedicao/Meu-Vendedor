# Marketplaces — entrega de 11/11/2026

## Implementação

A navegação **Marketplaces / Lojas** e os sete cartões aparecem na página inicial mesmo com Shopee conectada. Rotas: `/lojas`, `/shopee`, `/amazon`, `/mercado-livre`, `/aliexpress`, `/tiktok-shop`, `/magalu` e `/shein`.

Todas compartilham `ManualMarketplaceCampaign`: produto, URL oficial, imagem autorizada opcional, roteiro editável, descrição, hashtags, cópia exata do link e material para Pin. `ProductCampaign` reutiliza o roteiro e encaminha ao editor existente, montagem local ou Flow/importação. URLs preservam ordem e codificação dos parâmetros; validar o domínio não comprova atribuição de comissão. Imagens locais podem ser adicionadas no editor. A publicação Pinterest é manual, sem API de postagem conectada.

O fluxo manual não exige API nem login. Análise de imagem por IA, voz e salvamento privado exigem sessão e serviços disponíveis. A seleção no catálogo privado agora acessa o mesmo editor, sem acionar catálogos de lojas não selecionadas. Shopee mantém autenticação, produtos, geração de links e agendamento existentes.

| Loja | Manual | Automático |
| --- | --- | --- |
| Shopee | Link oficial, roteiro, editor e materiais | Conector existente por conta autorizada; nenhuma nova credencial criada |
| Amazon | Link oficial de Associado, roteiro, editor e materiais | Creators API exige credenciais e elegibilidade; vitrine depende de configuração própria |
| Mercado Livre | Link oficial, roteiro, editor e materiais | Token de catálogo não equivale à geração de link de comissão |
| AliExpress | Link oficial existente, roteiro, editor e materiais | Solicitação Under Review; API de catálogo/link preparada, sem aprovação presumida |
| TikTok Shop | Link oficial, roteiro, editor e materiais | Aplicativo, região, papel e escopos próprios exigidos |
| Magalu | Link oficial, roteiro, editor e materiais | Catálogo de afiliados não implementado/contrato não confirmado |
| SHEIN | Link oficial, roteiro, editor e materiais | Catálogo de afiliados não implementado/contrato não confirmado |

## Supabase

Auditoria dos arquivos remotos e dependências: `catalog` v30, `marketplace` v31 e `campaign-content` v2 correspondem à main. A vitrine `catalog-public` v29 tinha uma cópia antiga de `_shared/shopee.ts`; publicada como **v30**, incluindo todas as dependências relativas e o tratamento atual de falha do provedor. Nenhuma migração, política RLS, configuração Auth ou Secret foi alterado. O JWT próprio de cada função foi preservado.

Aliases suportados exclusivamente no servidor, vinculados ao UUID autenticado:

- `MERCADO_LIVRE_API`: objeto JSON com `userId`, `accessToken`, `categoryId`.
- `ALIEXPRESS_API`: objeto JSON com `userId`, `appKey`, `appSecret`, `trackingId`.
- `MV_CATALOG_ACCOUNTS`: mapa por usuário; a configuração já existente prevalece sobre os aliases.

Não existem campos de credenciais de API no formulário manual. Ausência de credenciais deixa o catálogo desconfigurado; jamais produz link fictício. A ferramenta de gerenciamento desta sessão não expõe a listagem de Secrets do Supabase; a presença dos aliases não foi presumida. Sem conta de teste autenticada, configurações individuais e consultas comerciais privadas não foram executadas.

## Validação

`npm ci`, lint (zero erros; quatro avisos preexistentes), TypeScript frontend/Edge, **252 testes** e build estático de 26 páginas aprovados. Os testes novos cobrem URLs oficiais das sete lojas, rejeição de domínios falsos/credenciais e preservação de links assinados. O fluxo público e os estados sem autorização foram conferidos no Worker publicado; evidências finais na seção abaixo.

Nenhuma inferência de IA, tarefa GPU, assinatura ou geração paga foi iniciada. MP4 gerado com IA e postagem automática não foram validados nesta entrega. O editor e as configurações existentes foram preservados. Autenticação/RLS cobertas pelos testes locais não equivalem a login comercial real.

## Publicação e evidências

- Código da aplicação publicado a partir de `4b84b4718dfe851b74f4e475a40b972947a7a7bf`, main. O registro posterior de evidências não altera os arquivos da aplicação.
- Worker `meu-vendedor`; versão `d542b246-aa1e-4fda-b94a-5528d63fde1f`; deployment `577bed8b-7523-48c3-9980-c6ceeb3f705c`, 100% do tráfego. [Site / Lojas](https://meu-vendedor.httpsgithubcomwarllemedicaosunshine-budget-guidegit.workers.dev/lojas).
- O Wrangler local não possui sessão de CLI; o pacote validado com `wrangler deploy --dry-run` e `wrangler.jsonc` foi enviado pela conexão Cloudflare autorizada. Não foram alterados domínios, Secrets, bindings, namespace Durable Object, crons ou o Worker `gilfinanceiro`; bindings e agendas comparados antes/depois.
- Onze páginas públicas retornaram HTTP 200, com bytes idênticos ao build validado, incluindo todas as lojas, início, estúdio e política.
- Navegador desktop: sete formulários preenchidos com dados sintéticos; roteiro e link transferidos para o editor; cópia Mercado Livre preservou exatamente `%2B` e parâmetros. Montagem/Flow abrem; descrição e hashtags preparadas. Zero erros do aplicativo no console (mensagens da extensão do ambiente foram desconsideradas).
- Supabase: endpoints privados sem sessão retornam 401. Vitrine pública de Shopee, Amazon e TikTok retorna `503 catalog_not_configured`, exibido como indisponibilidade de dados, sem bloquear campanhas manuais. O catálogo privado Shopee já existente continua separado da vitrine pública; não foi testado login comercial nesta execução.
- Logs da vitrine reconsultados após a publicação: três respostas OPTIONS 204 e doze respostas 503, coerentes com `catalog_not_configured`; não comprovam sucesso de consulta comercial. Saúde sem alertas. Avisos preexistentes de tabelas internas com RLS sem política e proteção contra senhas vazadas desativada não foram modificados. [Orientação sobre proteção de senha](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- **Limite do teste móvel:** não foi possível validar a largura móvel nesta sessão. O Chromium auxiliar apresentou erro de privacidade/certificado e não foi contornado; o navegador cloud usado nos testes públicos não expõe controle de viewport. Desktop de 1363 px sem overflow horizontal. Não declarar teste móvel como concluído.
- Evidência estruturada: [tests/results/2026-11-11-marketplaces.json](./tests/results/2026-11-11-marketplaces.json).
