# Publicações — Meu Vendedor

## Catálogo publicado no Cloudflare — confirmado

Após autorização do responsável, em 04/11/2026 às 18:59 UTC foi publicado o build do commit `5d56fb8` no Worker existente `meu-vendedor`, conta `2cd6c753710fbaba6b94e33ef662c9b3`. Versão ativa: `29c743ed-e672-4e98-b059-0213bd9a0ec8`, com 100% do tráfego. Foram enviados 73 assets novos/modificados; preservados o segredo de agendamento e o cron de 30 minutos.

Verificação pública: `/dashboard` respondeu HTTP 200 com o título “Encontre seu próximo produto” e as sete plataformas; o painel demonstrativo anterior não está no HTML. `/` e `/dashboard` usam o mesmo catálogo. Autenticação Wrangler e dry-run de publicação foram verificados. Não houve teste visual em navegador nem consulta comercial autenticada nesta publicação.

A função Supabase `catalog` já está ACTIVE na versão 1, conforme registro abaixo. A publicação da interface não concede acesso às APIs comerciais: ainda é necessário configurar credenciais por usuário e validar as consultas reais. Magalu/SHEIN permanecem sem contrato de catálogo de afiliados confirmado. Os registros de publicação pendente abaixo são históricos e foram superados por esta publicação.

## Correção de rota e publicação do backend de catálogo

Em 04/11/2026, a inspeção por HTTP confirmou que `/dashboard` ainda servia o painel demonstrativo anterior. A rota foi corrigida no código para apresentar o mesmo catálogo de `/`; é necessário publicar os assets para a correção aparecer no Worker.

A função Supabase `catalog` foi publicada no projeto `jzchlrvxdaffnrgbvabv`: versão 1, status ACTIVE, `verify_jwt=true`. Verificação remota: preflight OPTIONS retornou 204 com a origem correta e POST sem sessão retornou 401. Não foram criadas contas de teste nem configuradas credenciais comerciais por esta publicação. A verificação não comprova sucesso nas APIs de lojas.

Na primeira verificação, a publicação do frontend estava pendente de autenticação do Wrangler. A autorização foi posteriormente concedida e a publicação concluída, conforme registro no início deste documento. O commit/push anterior, isoladamente, não havia atualizado o site.

## Catálogo inicial de sete plataformas — alteração local

Em 04/11/2026, a rota `/` foi alterada no checkout para apresentar oportunidades e disponibilidade de Amazon, Mercado Livre, TikTok Shop, Magalu, Shopee, SHEIN e AliExpress. Além da Shopee por conta autorizada, o código inclui a função `catalog` com consultas Amazon, Mercado Livre, TikTok Shop e AliExpress. A nova função e seus segredos por usuário ainda precisam ser publicados/configurados e testados com acesso comercial real. Magalu e SHEIN não têm adaptador de afiliados. Detalhes em `CATALOGO_APIS.md`.

Esta alteração **não foi publicada**: a consulta `wrangler whoami` informou ausência de autenticação no ambiente atual; a instalação temporária de autenticação usada anteriormente também não está disponível. Os registros abaixo são históricos e não comprovam que a página nova esteja na produção. Não foi criada hospedagem alternativa.

## Cloudflare Workers — endereço público confirmado

Em 04/11/2026, autorização OAuth do Wrangler confirmada e Worker existente `meu-vendedor` localizado na conta autorizada.

- URL pública: https://meu-vendedor.httpsgithubcomwarllemedicaosunshine-budget-guidegit.workers.dev
- Deployment existente consultado: `7743d9c0-8349-4818-a4ba-6a6c3903f064`.
- Versão ativa consultada: `ea8236cc-67d9-488e-a653-676900ebb5a6`.
- Testes HTTP: `/` redireciona ao dashboard; `/dashboard`, `/contas` e `/produtos` respondem 200 sem autenticação ChatGPT.
- O código remoto contém o frontend Meu Vendedor. Não foi necessário sobrescrever o Worker para confirmar a publicação existente.
- A consulta a Workers Builds retornou 403 com a autorização atual. Não foi possível confirmar/configurar o vínculo automático GitHub por essa API. Não confundir esse limite com o acesso público, que foi testado separadamente.
- Requisições com o User-Agent padrão do Python receberam erro Cloudflare 1010; o teste com identificador de navegador funcionou. Não foram alteradas proteções da conta.
- Credenciais OAuth permanecem fora do repositório. Nenhum segredo foi inserido neste documento.

## Sites — publicação anterior de análise

Versão 1 publicada com sucesso em 04/11/2026 pelo Sites.

- URL: https://meu-vendedor-painel.greybadge24.chatgpt.site
- Acesso: privado, para o proprietário na conta ChatGPT usada na publicação.
- Projeto Sites: `appgprj_6aeb24b5b5d88191b82a1114a430488c`.
- Deployment: `appgdep_6aeb2589c8608191bf05844639801e2c`.
- Commit da fonte de publicação: `43852f55da7feeee1d0e53f0e68d63686fb0902a` (repositório de fontes do Sites; separado do GitHub do projeto).
- Checkout usado: `/tmp/meu-vendedor-online-20261104`. A fonte está salva no repositório do Sites; o diretório temporário não é sua única cópia.

## O que está disponível

Dashboard com dados demonstrativos, menu, tema claro/escuro e página Contas Conectadas com quatro plataformas e seus requisitos. As outras rotas são apresentações dos módulos futuros. Ainda não há cadastro de todas as lojas, ações para entrar/se afiliar em cada loja, APIs externas, autenticação própria ou persistência.

## Como foi publicado

Foi preparada uma cópia do frontend existente com `output: "export"` em `next.config.ts` para servir páginas estáticas. O build `npm run build -- --webpack` passou, incluindo a checagem TypeScript. O diretório `out` foi empacotado e publicado; o frontend não foi recriado e o compilador/configuração do checkout GitHub foi preservado. A publicação foi confirmada pela hospedagem; não houve inspeção visual em navegador nesta execução.

Para futuras alterações, reutilizar o mesmo ID de projeto Sites e abrir sua fonte salva, preservando o acesso privado. Não criar outro Site para atualizar este painel.

## Supabase

Não conectado a esta conversa nesta publicação. Não há configuração Supabase no código nem variáveis Supabase disponíveis no ambiente. A versão estática atual não depende do banco. A integração Supabase foi sugerida para habilitação pelo responsável; sua existência no catálogo não comprova acesso ao projeto dele. Após a conexão, identificar o projeto correto antes de consultar ou alterar estruturas.

## Base Supabase — ativação concluída

Projeto `meu-vendedor` (`jzchlrvxdaffnrgbvabv`) autorizado e saudável. Migração `20261104000100` aplicada e registrada no histórico remoto. Tabelas `mv_platforms`, `mv_profiles` e `mv_affiliate_links` com RLS habilitada e forçada; políticas e privilégios conferidos.

Site URL, retornos de cadastro/recuperação e senha mínima de 8 caracteres configurados. Confirmação de e-mail mantida habilitada. Configurações remotas não declaradas foram preservadas. A configuração publicável foi incluída no build via `.env.local`, ignorado pelo Git.

Frontend conectado publicado no mesmo Worker. Versão Cloudflare ativa: `31d1b45c-bb40-4d95-bae8-ec172dac1cb4`. `/entrar`, `/afiliados`, `/configuracoes` e `/contas` responderam HTTP 200; bundle público conferido com a URL e a chave publicável do projeto correto. O aviso de configuração pendente não aparece nesta publicação. A publicação anterior sem configuração tinha versão `70877960-c543-4b34-ac35-50ccbeda8e55`.

Validações locais: 6 testes, TypeScript, linter e build estático aprovados. Validações remotas de API: catálogo de cinco plataformas; bloqueio anônimo; login por senha de duas contas; perfil; CRUD do proprietário; bloqueio entre usuários; bloqueio de falsificação do proprietário e URLs inseguras; logout. As duas contas temporárias foram criadas já confirmadas sem enviar mensagens e removidas ao final. Nenhuma chave administrativa foi colocada no frontend ou Git.

Limites: não houve teste visual em navegador nesta execução. A entrega de e-mails de confirmação e recuperação ainda precisa ser validada; SMTP próprio não foi configurado. A ligação de builds automáticos GitHub/Cloudflare permanece não confirmada pela API Workers Builds com a autorização atual. APIs das lojas não foram ativadas.
