# Google, Flow e YouTube Create — 06/11/2026

## Estado vigente — 07/11/2026

Login Google e conexão do canal YouTube confirmados pelo responsável. Nova chave Gemini aceita pelo catálogo/modelos consultados; geração de vídeo Google ainda requer teste real. Gerar vídeo foi corrigido para validar ao clicar e mostrar pendências; ElevenLabs aparece em Outra voz junto das características da voz, com prévia/exportação opcional e áudio nativo mantido na geração. Flow remoto saiu da central; Flow/Create permanecem pendentes no seletor. Frontend Cloudflare `a1a5dd36-76b7-4954-99f6-d9d5f5b72b90`; video-generation v44. Retomada e pendências em [CONTINUAR_AMANHA.md](./CONTINUAR_AMANHA.md) e [AJUSTES_ESTUDIO.md](./AJUSTES_ESTUDIO.md).

## Histórico técnico — registros anteriores

Os registros abaixo preservam decisões e validações das entregas anteriores; afirmações divergentes não substituem o estado vigente acima.

> **Correção de geração e ajustes solicitados — 07/11/2026:** botão Gerar vídeo deixou de depender de bloqueios silenciosos da interface; valida campos ao clicar, reconsulta disponibilidade e mostra erro junto à ação, com limites de espera e idempotência preservada. Navegador Flow retirado da central; Flow/Create aparecem somente como opções pendentes no seletor. ElevenLabs movida para Outra voz ao lado de Característica da voz, filtrada pelo tipo; prévia/exportação usam o roteiro existente e geração mantém a voz nativa. Chave Gemini anterior recusada com API_KEY_INVALID; após atualização pelo responsável, catálogo e modelos de roteiro/vídeo responderam HTTP 200. Isso não comprova inferência ou faturamento de vídeo Google. Teste UI de desktop/celular preparou imagens e confirmou um pedido por clique com fila simulada, mesmo após falha inicial 503; nenhum vídeo real novo foi solicitado. Detalhes em [AJUSTES_ESTUDIO.md](./AJUSTES_ESTUDIO.md).

Este registro substitui os estados anteriores de Google/Flow. A integração está parcialmente entregue: conexão experimental do Flow e adaptador oficial de vídeo Google implementados; executor externo de conexão Modal implantado e testado; login pessoal, automação de geração e importação do resultado ainda pendentes.

## Estado vigente: navegador externo Modal implantado

As credenciais Modal existentes no Supabase foram utilizadas com transferência temporária cifrada, sem valores no chat, Git ou logs. A função temporária de transferência foi desativada, passando a exigir JWT e responder 410. O acesso administrativo funcionou; a pendência de implantação por falta de credenciais registrada anteriormente foi superada.

Aplicativo `meu-vendedor-flow` publicado no Modal. O Worker usa o endpoint privado `/control`, autenticado por segredo próprio, e deriva a identidade do Durable Object do usuário autenticado no Supabase. O navegador nasce sob demanda em sandbox isolado, com duração máxima de dez minutos e timeout de inatividade de dois minutos. Desconexão encerra o sandbox. O controlador escala a zero quando ocioso. O navegador não usa a franquia Browser Run da Cloudflare; o aplicativo e o cofre cifrado continuam na Cloudflare.

Teste real aprovado: acesso anônimo ao controlador recusado com 401, navegador Chrome aberto, tela Google Flow em português capturada (54.599 bytes), screenshot anônimo recusado, inspeção informou login necessário e sandbox encerrado no finally. Nenhum login Google foi simulado como concluído e nenhum vídeo foi gerado. O teste local do Durable Object confirmou isolamento entre usuários, conta divergente, salvamento cifrado e desconexão; as respostas do provedor nesse teste eram simuladas.

Cloudflare publicado na versão `36419765-2996-4b5b-b662-07f53b3bb068`. Supabase atualizado com diagnóstico ElevenLabs: `video-generation` v38 e `video-generation-worker` v23. Migração Google permanece aplicada. Documentação de implantação: [executors/google-flow/README.md](./executors/google-flow/README.md).

**Próximo passo:** abrir Conta e conexões → Google e redes → Conectar / reabrir Flow, concluir pessoalmente o login Google e validar conta/sessão. O Google pode recusar o login remoto ou exigir confirmação. Depois, implementar e testar submissão de vídeo, acompanhamento, validação e importação do MP4; essas etapas continuam pendentes e Flow permanece indisponível no seletor de geração. O diagnóstico do executor informa `generationReady: false`. Não há integração automática do YouTube Create móvel.

ElevenLabs: consulta de plano/saldo adicionada sem inferência, mas a chave `ELEVENLABS_API` autenticada: plano Free, uso zero e 10.000 créditos restantes. Plano Free não oferece licença comercial para os anúncios. Detalhes e fontes em [ELEVENLABS.md](./ELEVENLABS.md).

Validação desta entrega: 156 testes Node aprovados, lint e TypeScript aprovados, Python compilado e build estático das 17 rotas concluído. Testes visuais com janela Modal simulada em 1440×900 e 390×844 confirmaram conexão/estados sem reload indevido e sem overflow; a API pública recusou chamada sem sessão com 401. Não confundir esses testes simulados de UI/DO com o teste real separado do navegador Modal nem com um login Google já confirmado.

## Correção da conexão pelo aplicativo

Após o relato de indisponibilidade pelo responsável, o teste do caminho Worker → Durable Object → Modal reproduziu a falha. Causa confirmada: `redirect: "error"` não é aceito no fetch do runtime Cloudflare usado pelo Durable Object. O cliente agora usa `redirect: "manual"` e recusa respostas 3xx, preservando o segredo sem seguir destinos externos. Teste de regressão cobre o bloqueio de redirecionamento.

A chamada real pelo Worker corrigido retornou HTTP 200, estado `browser_open` e host de visualização Modal; a desconexão técnica retornou HTTP 200/`disconnected`. A rota e o método temporários de diagnóstico foram removidos antes da publicação final. Novas sessões usam o nome interno derivado `modal-v1:<user.id>`, separado das sessões legadas Browser Run. Essa migração requer novo login Google; não transfere automaticamente o cofre da sessão experimental anterior.

Commit/push versionam o checkout no GitHub; publicação no Worker é uma operação separada. O erro não era causado por ausência de commit. A mensagem de geração em preparação continua correta: conexão de navegador foi entregue, automação e importação de vídeo ainda não.

## Seleção de ferramenta e executor sob demanda

A tela de produção agora oferece uma caixa imediatamente acima de Gerar vídeo: Automático, Google Flow, YouTube Create, Google Omni API, Magic Hour e Replicate. O backend informa disponibilidade por credenciais; isso não comprova saldo ou sucesso de geração. A escolha é persistida em request_data.generationTool. Somente Automático permite fallback; seleção explícita filtra os adaptadores inclusive após falhas e retomadas. Pedidos antigos sem seleção mantêm o comportamento automático.

Flow e YouTube Create aparecem indisponíveis. O backend rejeita esses pedidos antes de enfileirar ou consumir geração de imagem. A conexão foi migrada para o executor Modal descrito acima. O navegador externo funciona; geração automática e importação de vídeos ainda não estão implementadas. Não confundir uma conexão de login com um adaptador de geração pronto.

Plano do executor: iniciar por pedido autenticado, carregar perfil Google isolado por usuário, impedir sessões concorrentes do mesmo perfil, acompanhar geração sem repetir submissão incerta, baixar e validar o MP4, guardar no Storage e biblioteca, então encerrar o navegador em finally. Perfil e artefatos precisam persistir fora do container. É necessário validar login Google e automação reais antes de habilitar Flow na seleção.

YouTube Create é aplicativo móvel; não foi identificada API pública do editor. Não existe automação implementada dele. Google Omni API é uma alternativa separada, com faturamento próprio, sem transferência dos benefícios do Flow/Create. Referência: https://support.google.com/youtube/answer/16631240?hl=pt-BR . Modal permite containers de funções escalarem a zero: https://modal.com/docs/guide/scale .

Publicação da seleção: Cloudflare `62bb0236-24a3-45dd-ae1c-2e1ebcbf4284`, Supabase `video-generation` v33 e `video-generation-worker` v17. Validação: 151 testes aprovados, lint e TypeScript aprovados, build estático concluído. Chromium testou a UI publicada em 1440×900 e 390×844 com autenticação/capabilities simulados, seleção preservada, opções indisponíveis bloqueadas e ausência de overflow. Nenhuma geração real foi enviada nem novo executor provisionado.

## Falha ao reabrir o Flow — 06/11/2026, 15:41 UTC

O responsável relatou a mensagem genérica ao conectar. A API Cloudflare recusou a criação de outro navegador com HTTP 429. A consulta pelo binding informou **694,969 segundos de uso**, nenhuma sessão ativa, uma aquisição permitida e espera de aquisição zero. Os dados apontam para esgotamento da franquia diária gratuita de dez minutos, embora a resposta REST observada tenha informado somente “Rate limit exceeded”. A assinatura específica Workers não foi confirmada pelo conector de billing (403); não confundir esse limite com créditos Google/Flow.

Correção: respostas distinguem cota diária explícita, restrição temporária, sessão ocupada, sessão expirada e indisponibilidade. O frontend usa mensagens permitidas, preserva erros brutos no servidor e respeita cooldown/Retry-After, sem repetir a verificação durante o bloqueio. Cota diária explícita aguarda o próximo dia UTC; 429 genérico não é falsamente rotulado como cota diária. Logs operacionais registram apenas códigos e contagens permitidas.

Referências de navegadores já encerrados são descartadas antes de reabrir; falhas transitórias de consulta não apagam a referência. O timeout de inatividade remoto foi reduzido de dez minutos para um minuto, enquanto o limite de duração da janela permanece dez minutos e a interface aberta continua verificando a cada quinze segundos. Isso reduz consumo quando a aba do app é fechada; não devolve o tempo já utilizado.

O bloqueio do fornecedor **continua sendo uma dependência externa**: mensagem/código corrigidos não liberam a cota. Nenhum plano ou faturamento foi alterado. Fonte: [limites e renovação UTC do Browser Run](https://developers.cloudflare.com/browser-run/limits/).

Correção publicada na versão Cloudflare `67400bad-c08a-4871-94de-3ce16a6511ca`. Onze testes focados de API/cron/estado/erro aprovados, lint e TypeScript Edge aprovados e build estático concluído. Chromium validou mensagem de cota, ocultação de erro bruto e botões bloqueados em desktop/celular na URL publicada com respostas simuladas. Runtime local verificou persistência do cooldown: três ações, incluindo a primeira recusa, geraram somente uma chamada ao provedor. Isso valida o tratamento; não comprova liberação da cota ou login real.

## Conta e credenciais verificadas

- Projeto consultado: `jzchlrvxdaffnrgbvabv`. Auth público respondeu `external.google=false`, `external.email=true`.
- A consulta inicial encontrou um usuário; a consulta posterior, após nova interação do responsável, encontrou dois usuários, ambos com e-mail confirmado e identidade `email`, sem identidade Google. O login mais recente é de 06/11/2026 às 14:57 UTC. Usar um endereço Gmail no cadastro por senha não equivale a OAuth Google.
- Os logs registram uma tentativa com `OAuth state parameter missing`. Isso não identifica a causa da tentativa relatada nem autoriza remover `state`/PKCE.
- O inventário do runtime confirmou `GEMINI_API_KEY`. A auditoria privada de 15:15 UTC autenticou os catálogos `gemini-3.8-flash` e `gemini-omni-1.2-flash`.
- A auditoria `google-auth-config` encontrou chave Gemini, mas não Client ID/Secret nos aliases reconhecidos: `GOOGLE_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_ID`, `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_OAUTH_CLIENT_SECRET`, `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET`. Isso não enumera Secrets cadastrados sob nomes arbitrários nem lê a configuração privada do provedor Auth.
- A CLI não tem sessão administrativa Supabase; seu comando de listar Secrets recusou a consulta. A confirmação acima veio do runtime e das tabelas/logs privados via conector autenticado, sem expor valores.
- O conector administrativo desta sessão e o navegador do usuário têm autorizações independentes. O login feito pelo usuário no app não é transferido ao agente. O cadastro pode ser consultado no banco; cookies e sessão pessoal do navegador não são compartilhados.

Para habilitar OAuth, ainda é necessário configurar um cliente OAuth Web no Google Auth Platform e cadastrar seu Client ID/Secret em **Supabase → Authentication → Sign In / Providers → Google**. Retorno Google: `https://jzchlrvxdaffnrgbvabv.supabase.co/auth/v1/callback`. Conferir também a allowlist de retorno ao `/entrar` do app. Colocar uma chave Gemini nos Secrets não habilita o provedor Auth. Não enviar chaves pelo chat.

A tela **Meu acesso** agora informa confirmação do e-mail e vínculo Google, consulta a disponibilidade real do provedor e oferece **Atualizar cadastro**, usando `getUser()` no servidor. Não foi concluído login OAuth real nesta revisão.

## Flow: sessão por usuário

**Conta e conexões → Google e redes → Conectar / reabrir Flow** cria um Chrome remoto no Modal e uma visualização privada dentro do aplicativo, com opção de ampliar. Cada usuário autenticado tem um Durable Object próprio; o backend valida o JWT no Supabase e deriva o identificador da sessão, sem aceitar IDs, cookies ou comandos de navegador enviados pelo cliente.

O usuário conclui pessoalmente o acesso Google e eventuais verificações nesse navegador. Não há contorno de CAPTCHA, bloqueio ou autenticação. O teste ainda precisa confirmar se o Google aceita o login nessa infraestrutura. Se bloquear, registrar o erro e reavaliar o executor; não simular sucesso.

- A conta esperada é o mesmo e-mail confirmado do Meu Vendedor. Conta diferente aparece como divergente.
- **Verificar conta e créditos** inspeciona apenas indicadores limitados da interface do Flow. A conexão só é marcada verificada quando a conta esperada e o editor forem identificados. Mudanças no DOM podem exigir ajuste.
- Após relato de estado confuso, a tela distingue navegador aberto, login necessário, conta ainda não identificada, conta divergente e conexão confirmada. Há instruções junto à janela e atualização automática a cada 15 segundos enquanto aberta, sem recarregar a tela de login. A ausência de um marcador de conta não é tratada como prova de logout.
- O saldo é mostrado apenas quando um indicador inequívoco de créditos estiver visível. Caso contrário, permanece desconhecido; abrir o menu de perfil do Flow pode ser necessário. Não há sincronização automática de plano ou benefício por OAuth.
- **Autorizar salvar sessão** cifra os cookies Google no servidor com AES-GCM, vinculados ao objeto do usuário. A chave deriva do segredo operacional existente; sua rotação invalida as sessões salvas. Não há cookies no frontend, Git, logs ou metadados de usuário.
- A sessão salva tem validade máxima de sete dias e limpeza agendada. O Google pode expirar o acesso antes. Desconectar apaga os cookies locais e encerra o navegador; revogar acessos na conta Google é uma operação separada.
- Cada navegador fecha após dez minutos, inclusive quando houver interação. Esse limite serve à prova técnica; não é garantia de tempo suficiente para uma geração. A visualização Modal usa token opaco no fragmento da URL, válido somente enquanto o sandbox existir. Esse token permite tela e comandos limitados de teclado/mouse, sem acesso à RPC de cookies. Não é persistido no frontend.
- O navegador usa restrições de domínio para recursos Google, sem gravação da sessão. A conexão atual consome recursos Modal conforme o plano existente; nenhum plano foi contratado ou alterado. O fallback Browser Run permanece no código para ambientes sem URL do executor, sem troca automática quando Modal falha.

Os benefícios são os da conta autenticada **no Flow**, sujeitos ao plano e saldo reais. Não pertencem à chave Gemini nem à conta do administrador do Meu Vendedor. Ainda falta validar a conta real, persistência/revogação e o saldo nessa interface. Submissão automática, acompanhamento do trabalho, associação ao produto e importação privada do MP4 **não foram implementados nesta etapa**. O pipeline de vídeos continua usando APIs, não o navegador Flow.

## YouTube Create e alternativa oficial

Pesquisa nas fontes oficiais identificou **YouTube Create** como aplicativo Android/iOS. Não foi encontrada API pública para comandar seu editor ou gastar seus benefícios pelo Meu Vendedor. A YouTube Data API gerencia recursos e uploads; não é uma API do editor Create. Automação móvel não foi instalada. Caso o responsável se referisse ao YouTube Studio, revisar o recurso exato; a pesquisa assumiu Create.

Alternativa adicionada: **Gemini Omni 1.2 Flash**, pela Interactions API oficial. O adaptador integra a fila existente com imagem de referência, vídeo vertical de seis segundos em 720p, áudio nativo solicitado no prompt, polling e validação/armazenamento privado do MP4. Ordem: Magic Hour → Google vídeo → Replicate. Rejeição confirmada permite fallback; timeout ou submissão incerta não provoca outro envio.

Esse caminho usa `GEMINI_API_KEY` ou `GOOGLE_API_KEY` no backend e o faturamento do projeto da API. **Não usa a franquia Plus/Flow nem o benefício gratuito do YouTube Create.** Saldo/custo desconhecidos permanecem desconhecidos. O catálogo do modelo respondeu, mas geração, suporte ao modo assíncrono com essa conta, áudio, qualidade e cobrança ainda precisam de teste real. Nenhuma inferência foi iniciada nesta revisão.

Migração `20261106151423_google_video_provider.sql` aplicada e reconciliada com o histórico remoto. Amplia as listas de provedores e preserva RLS e permissões das RPCs; acesso de cliente à gravação de tentativas permanece negado. Supabase publicado: `video-generation` v32 e `video-generation-worker` v16. Heartbeat autenticado confirmado após a atualização; fila contém somente a tarefa concluída anterior.

## Validação

146 testes aprovados, lint e TypeScript frontend/Edge aprovados, exportação estática das 17 rotas concluída. O build precisou sair do sandbox pelo problema de captura `--showConfig` já documentado. Testes incluem contrato REST Google, falhas/timeout sem duplicação, retomada até armazenamento, migração reaplicável, proteção da API Flow e distinção dos estados de conexão. Runtime local Cloudflare confirmou RPC, estado inicial e desconexão do Durable Object; isso não testa login ou cookies de uma conta real.

Chromium em 1440×900 e 390×844 verificou a central e a alternativa YouTube/Google, sem erro JavaScript ou overflow. A API pública do Flow recusou chamadas sem sessão com 401. Uma sessão real Browser Run foi criada e encerrada pela API administrativa, sem login. Verificações com respostas controladas da interface não comprovam geração nem sincronização real.

Frontend/Worker publicados na versão `6b158f42-30e1-4fbf-8059-b5268bd982fc`, com Browser Run, Durable Object SQLite por usuário, logs/traces e os dois crons preservados. A revisão não criou novos usuários nem tarefas de vídeo e não alterou Secrets ou configuração Auth. Arquivos locais da entrega permanecem para revisão/versionamento no repositório.

## Fontes oficiais

- [Supabase Google OAuth](https://supabase.com/docs/guides/auth/social-sign-in/auth-google)
- [Google Flow — créditos](https://support.google.com/flow/answer/16526234?hl=pt-BR)
- [YouTube Create — projetos](https://support.google.com/youtube/answer/13521789?hl=pt-BR)
- [YouTube Data API](https://developers.google.com/youtube/data/reference/rest)
- [Gemini vídeo](https://ai.google.dev/gemini-api/docs/video)
- [Gemini Omni](https://ai.google.dev/gemini-api/docs/omni)
- [Interactions em segundo plano](https://ai.google.dev/gemini-api/docs/background-execution)
- [Browser Run — binding](https://developers.cloudflare.com/browser-run/reference/browser-binding-api/)
- [Browser Run — Live View](https://developers.cloudflare.com/browser-run/features/live-view/)
- [Browser Run — limites](https://developers.cloudflare.com/browser-run/limits/)
