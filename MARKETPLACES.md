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

`npm ci`, lint (zero erros; quatro avisos preexistentes), TypeScript frontend/Edge, **252 testes** e build estático de 26 páginas aprovados. Os testes novos cobrem URLs oficiais das sete lojas, rejeição de domínios falsos/credenciais e preservação de links assinados. O fluxo público e os estados sem autorização serão conferidos no Worker publicado; evidências finais na seção abaixo.

Nenhuma inferência de IA, tarefa GPU, assinatura ou geração paga foi iniciada. MP4 gerado com IA e postagem automática não foram validados nesta entrega. O editor e as configurações existentes foram preservados. Autenticação/RLS cobertas pelos testes locais não equivalem a login comercial real.

## Publicação e evidências

Em andamento: completar com o deployment e resultados observados antes de encerrar a tarefa.
