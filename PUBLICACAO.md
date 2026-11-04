# Publicações — Meu Vendedor

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

## Base Supabase — frontend publicado, ativação do banco pendente

Código preparado com catálogo de cinco plataformas, rotas de autenticação, perfil e gerenciamento manual de links. Migração validada em PostgreSQL local e testes de RLS aprovados. A autorização Supabase está pendente: não há migração remota aplicada nem variáveis públicas configuradas neste momento. A interface deve continuar informando essa pendência e não apresentar operações de banco como ativas. O frontend foi publicado com sucesso no Worker existente a partir do commit `00e5e01`. Versão Cloudflare: `70877960-c543-4b34-ac35-50ccbeda8e55`. `/dashboard`, `/contas`, `/entrar`, `/redefinir-senha`, `/afiliados` e `/configuracoes` responderam HTTP 200; CSS e JavaScript também. Uma rota inexistente respondeu 404. A tela de entrada foi conferida exibindo configuração em preparação, sem simular autenticação ativa.

Validação local: 6 testes aprovados, TypeScript e linter aprovados, build estático aprovado. Os testes de cadastro, confirmação de e-mail, login e persistência no Supabase hospedado ainda não foram realizados, pois a autorização desse serviço não foi concluída.
