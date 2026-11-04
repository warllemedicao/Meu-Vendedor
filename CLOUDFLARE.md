# Publicação do Meu Vendedor no Cloudflare Pages

Estado atual: Worker existente `meu-vendedor` confirmado e site público testado em https://meu-vendedor.httpsgithubcomwarllemedicaosunshine-budget-guidegit.workers.dev.

A autorização OAuth permitiu consultar o Worker e a versão ativa. O vínculo de builds automáticos com GitHub não pôde ser confirmado pela API, que retornou 403. Detalhes em `PUBLICACAO.md`.

As instruções abaixo descrevem a opção alternativa Cloudflare Pages preparada anteriormente. Não é necessário criar um segundo projeto Pages para abrir a publicação atual do Worker.

## Valores deste projeto

| Campo | Valor |
| --- | --- |
| Repositório | `warllemedicao/Meu-Vendedor` |
| Nome sugerido | `meu-vendedor` (sujeito a disponibilidade) |
| Branch de produção | `main` |
| Framework | Next.js (Static HTML Export) |
| Build | `npm run build:pages` |
| Saída | `out` |
| Raiz | raiz do repositório; deixar em branco |
| Node | `24`, também declarado em `.node-version` |

Sem variáveis de banco ou segredos nesta publicação. O comando específico define `MEU_VENDEDOR_STATIC_EXPORT=1` e usa Webpack. `npm run build` continua sem exportação estática.

## Ação do proprietário

No [painel Cloudflare](https://dash.cloudflare.com/), abrir Workers & Pages → Create application → Pages → Connect to Git / Import an existing Git repository. Autorizar o aplicativo no GitHub apenas para este repositório, selecionar o projeto e preencher os valores acima. Revisar e publicar com Save and Deploy.

A hospedagem informará o endereço real `*.pages.dev`; ele ainda não foi criado nem verificado nesta preparação. Não configurar domínio ou Cloudflare Access para esta primeira publicação pública. A vinculação autoriza Cloudflare a ler o código e publicar builds; não concede acesso à conta Cloudflare ao assistente.

## Verificação

Abrir o endereço fornecido em janela anônima e conferir `/dashboard` e `/contas`. Se o repositório não aparecer, conferir a instalação do aplicativo em GitHub → Settings → Applications → Installed GitHub Apps. Se houver erro de build, consultar o primeiro erro no log e conferir comando, branch e diretório de saída.

A exportação serve o frontend atual. Não executa backend FastAPI, API Routes ou código de servidor em runtime; recursos futuros precisarão de Supabase, funções ou Workers conforme seu desenho.

Referências: [integração Git](https://developers.cloudflare.com/pages/get-started/git-integration/) e [Next.js estático](https://developers.cloudflare.com/pages/framework-guides/nextjs/deploy-a-static-nextjs-site/).

## Configuração do Worker no repositório

`wrangler.jsonc` permite servir a pasta `out` no Worker `meu-vendedor`, sem recriar o projeto. `npm run deploy:cloudflare` executa o build estático e Wrangler. Esta configuração suporta a base Supabase no navegador; não cria serviços de banco. Valores públicos Supabase precisam existir no ambiente de build após ativação do projeto. A publicação de uma versão sem configuração mantém o aviso de acesso em preparação.
