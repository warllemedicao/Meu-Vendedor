# Conexões e sincronização de marketplaces

> **Revisão autenticada — 06/11/2026:** O responsável informou acesso à Shopee. A consulta autenticada ao Supabase não encontrou conexões nem produtos sincronizados; a função marketplace está ACTIVE v19. É necessário cadastrar App ID/Secret aprovados em Contas Conectadas e validar a sincronização. A vitrine pública usa configuração própria e continua sem fonte. Veja [CONTINUAR_AMANHA.md](./CONTINUAR_AMANHA.md). Este bloco prevalece sobre os registros anteriores de falta de acesso ou versões históricas abaixo.

## Entrega atual

Revisão documental em 06/11/2026: o conector e suas limitações permanecem iguais. A publicação mais recente do Worker adicionou o agendador de vídeos sem alterar credenciais, contratos ou comportamento das integrações de marketplace. O cron de marketplace continua configurado a cada 30 minutos; sua execução comercial depende de conexões Shopee válidas.

Primeiro conector implementado: **Shopee Affiliate Open API Brasil**. O usuário entra no Meu Vendedor e configura App ID e Secret da API em `/contas`. A senha da conta Shopee não é solicitada. A conexão só é salva como válida após uma consulta autorizada; falhas não criam produtos nem simulam sucesso.

O backend está na função Supabase `marketplace`. Ele valida a sessão com Supabase Auth em toda chamada de usuário, filtra os registros pelo usuário validado e usa credenciais cifradas no servidor. O JWT do Meu Vendedor não autoriza a conta Shopee automaticamente.

## Fluxo disponível

1. Conectar a Open API em Contas Conectadas.
2. Consultar até 60 ofertas via `productOfferV2` (três páginas de 20), usando a seleção de desempenho e ordenação por vendas informadas documentadas no Explorer.
3. Ver produtos, imagem, loja, faixa de preço, comissão estimada, avaliação, desconto e vendas informadas em `/produtos`.
4. Gerar o link pela operação `generateShortLink`, com as credenciais da própria conexão.
5. Salvar automaticamente o link em Meus links; copiar ou compartilhar pelas opções do dispositivo.
6. Atualizar manualmente ou pela rotina agendada, com origem, horário e falhas identificados.

O catálogo não é o ranking global da Shopee e não equivale a todo o marketplace. Descrição detalhada, variações, estoque e frete não são fornecidos pela consulta usada. A API e o checkout determinam condições finais. Comissão estimada não é comissão validada ou paga. Não há publicação em vitrine/rede social nem sincronização de relatórios financeiros nesta entrega.

Referência do contrato: [Explorer oficial brasileiro](https://open-api.affiliate.shopee.com.br/explorer/v2), consultado em 04/11/2026. Assinatura SHA-256 calculada no backend sobre App ID, timestamp, corpo exato e Secret. Não usar autenticação de vendedores Shopee como substituta deste contrato.

## Atualização periódica

O Worker possui cron a cada 30 minutos. O cron chama a função com `MV_SYNC_JOB_TOKEN`, validado no servidor. Somente conexões validadas e com sincronização antiga entram na fila; até duas contas são processadas por execução para respeitar o tempo de execução. Essa capacidade inicial exige dimensionamento quando crescer o número de contas.

Cada conta possui um bloqueio de operação com validade de 120 segundos, identificador próprio e intervalo mínimo de cinco segundos entre tentativas. Uma transação só publica o catálogo se ainda possui o bloqueio válido. Respostas 429, indisponibilidade e erros do provedor são tratados sem expor conteúdo bruto. Falhas preservam o último catálogo, explicitamente identificado pela data. Produtos fora da última seleção não são apresentados como parte da coleta atual.

A sincronização não é em tempo real. Conexões com recusa da API são marcadas para atenção e exigem atualização/reconexão. Desconectar elimina credenciais e cache no Meu Vendedor; revogar a chave na Shopee é uma ação separada no portal oficial. Links já salvos manualmente são preservados.

## Banco e credenciais

Migração `20261104000200_marketplace_connections.sql`:

- `mv_connections`: estado e data da conexão, com leitura do próprio usuário e escrita exclusiva do backend.
- `mv_connection_secrets`: ciphertext AES-256-GCM e versão da chave; nenhum acesso por usuários anônimos ou autenticados.
- `mv_products`: catálogo por conexão e usuário, com chaves externas e última sincronização.
- `mv_sync_runs`: histórico sanitizado de sucesso/falha.
- `mv_generated_links`: links gerados, vinculados ao produto e ao registro em Meus links.
- `mv_connector_locks`: controle de concorrência e intervalo de chamadas, acessível apenas ao backend.

Todas as tabelas têm RLS habilitada e forçada. As RPCs privilegiadas só podem ser executadas por `service_role`. Identidade e conexão não são aceitas como autoridade a partir de um `userId` enviado pelo cliente.

`MV_CREDENTIAL_ENCRYPTION_KEY` é uma chave aleatória de 32 bytes em base64, armazenada apenas nos segredos da função Supabase. AES-GCM usa IV aleatório e contexto associado ao usuário/plataforma/versão. Não rotacionar essa chave sem plano de recifragem dos registros existentes. O Worker recebe somente o segredo de agendamento, nunca a chave de cifragem ou o Secret Shopee.

A tela envia credenciais uma vez por HTTPS, limpa o formulário e não as persiste no armazenamento do navegador, URLs ou logs. O backend não retorna credenciais, respostas brutas de erro ou dados privados de outros usuários. O compartilhamento usa apenas o link de afiliado validado.

## Contratos das outras plataformas

| Plataforma | Evidência oficial | Dependência antes de habilitar a conexão |
| --- | --- | --- |
| TikTok Shop | [Autorização de criadores](https://partner.tiktokshop.com/docv2/page/678e3a362dccb8030ea6f98c) e [Affiliate APIs](https://partner.tiktokshop.com/docv2/page/affiliate-integration) | Aplicativo, escopos e aprovação; validar mercado e papel da conta. Login TikTok genérico não concede acesso comercial automaticamente. |
| Amazon | [Creators API](https://associados.amazon.com.br/creatorsapi/docs/en-us/get-started/using-curl) | Credenciais e elegibilidade no programa; o fluxo documentado usa `client_credentials`, não simplesmente a senha do comprador. |
| Mercado Livre | [OAuth de marketplace](https://developers.mercadolivre.com.br/autenticacao-e-autorizacao) | API específica de afiliados/geração de links ainda não confirmada em fonte oficial. Não habilitar um conector de vendedor como se fosse afiliado. |
| Magazine Luiza | [APIs de marketplace](https://developers.magalu.com/docs/apis/) | Acesso aos recursos de Influenciador Magalu ainda não confirmado; APIs de vendedor não comprovam esse acesso. |

Essas quatro conexões não foram implementadas nem apresentadas como ativas. Nenhuma credencial de aplicativos desses programas foi fornecida ou criada por esta entrega. O acesso administrativo a Cloudflare/Supabase não substitui aprovação comercial de cada plataforma.

## Verificação

Testes locais cobrem assinatura, preservação de Int64, paginação limitada, normalização, falha parcial, URLs, erros sanitizados, AES-GCM, concorrência e RLS. Backend e Worker têm verificação TypeScript própria (`npm run typecheck:edge`).

A suíte completa aprovada em 06/11/2026 possui 89 testes, incluindo conectores e módulo de vídeos. Esse total não representa uma chamada comercial real à Shopee.

Os testes remotos do endpoint e do banco usaram duas contas temporárias do Meu Vendedor, sem envio de mensagens, removidas ao final. Confirmaram autenticação obrigatória, bloqueio de origem não permitida, acesso negado às credenciais/RPCs, isolamento entre usuários e ausência de conexão fictícia.

**Ainda não foi feito teste de sucesso autenticado na Shopee:** nenhuma credencial Shopee real foi fornecida. O usuário deve conectá-la pela tela segura do app; não enviar Secret pelo chat. Os testes de sucesso do adaptador usam respostas controladas e não são apresentados como dados de produção.
