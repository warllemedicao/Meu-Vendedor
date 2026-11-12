# Continuidade do projeto — próxima sessão

## CI/CD GitHub Actions — configuração em andamento (12/11/2026)

Pedido: publicar automaticamente em cada push na `main`, usando GitHub Actions, Supabase `jzchlrvxdaffnrgbvabv` e o Worker Cloudflare existente `meu-vendedor`.

Enviados à `main` no commit `65d50b437b4d54cd932feab51dccca034e8c8278`: workflow `.github/workflows/ci-cd.yml`, verificador de migrações pendentes `scripts/check-pending-migrations.mjs`, testes `tests/check-pending-migrations.test.mjs` e documentação em `SUPABASE.md`, `CLOUDFLARE.md`, `PUBLICACAO.md` e `historico.md`. A ordem definida é validações/build → histórico de migrations remoto e gate de risco → migrações pendentes sem atualizar Vault/seed/roles → `publication-schedule` e Edge Functions alteradas → Worker existente → verificações remotas. Concorrência do deploy é serializada; Workers Builds precisa estar desativado/verificado antes de habilitar o publicador Actions.

**Não está concluído:** YAML/Bash do workflow, cinco testes do guard, `git diff --check`, `npm run typecheck`, `npm run typecheck:edge` e `npm run build:pages` passaram. A suíte global identificou 267 testes, mas foi interrompida no teste PGlite de claim de áudio (“Promise resolution is still pending but the event loop has already resolved”): 44 passaram e 223 foram cancelados; o teste PGlite isolado reproduziu o problema. `npm run lint` recebeu SIGTERM em duas tentativas. A execução real [43297281147](https://github.com/warllemedicao/Meu-Vendedor/actions/runs/43297281147) falhou na preflight porque faltam as variáveis públicas `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; testes e deploy ficaram skipped. A consulta de Actions Secrets/variáveis/ambientes e branch protection retornou HTTP 403; a tentativa de configurar as duas variáveis não alterou o repositório. Workers Builds permanece não confirmado. Nenhum deploy/migration remoto foi executado.

Antes do primeiro deploy, o responsável deve configurar (sem enviar valores no chat): Secrets `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`; variáveis `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; verificar/desligar Workers Builds para esse Worker e definir `CLOUDFLARE_WORKERS_BUILDS_DISABLED=true`. Para migrações sinalizadas como alto risco, configurar revisores obrigatórios no ambiente `supabase-high-risk-migrations` e só então habilitar `SUPABASE_HIGH_RISK_APPROVAL_CONFIGURED=true`. O workflow falha explicitamente se algum pré-requisito estiver ausente; não contornar falhas de autenticação.

Após o push, acompanhar o workflow; registrar URL/ID, status de cada etapa, migrations aplicadas, estado/versão de `publication-schedule`, ID/versão Cloudflare e smoke tests. Se Secret, proteção, acesso remoto ou Workers Builds impedir a publicação, registrar a mensagem/status exatos e deixar a entrega como bloqueada/incompleta. Não declarar concluído sem pipeline real e verificações remotas aprovadas.

## Regra de leitura integral de Markdown — 12/11/2026

Antes de qualquer tarefa numa nova conversa, identifique por Git e leia no contexto do agente **todos os Markdown versionados**, incluindo subpastas, sem excluir documentos por nome. Faça a leitura em lotes se necessário; priorize esta continuidade, `historico.md`, `HISTORICO.md`, README e documentos arquiteturais, mas depois leia todos os demais. Manter um registro por caminho com estado integral/parcial/não lido e apresentá-lo antes de modificar arquivos. Script com conteúdo descartado, mera listagem/contagem, resumo ou abertura/reabertura da página não constitui leitura do agente.

Não altere código até concluir a leitura inicial integral. Antes de cada modificação, releia os documentos relacionados e confira código e Git. Se limites de contexto ou acesso impedirem a leitura, declare os arquivos afetados e a limitação; não afirme conclusão. Informe contradições entre documentos ou divergências com a implementação antes de decidir como prosseguir. Inicie o procedimento assim que receber a primeira solicitação: não há garantia de leitura automática ao abrir o chat/página.

Nesta tarefa foram lidos integralmente os **52/52** Markdown versionados (0 parcial, 0 não lidos), incluindo `historico.md` e esta continuidade. O inventário completo está registrado na entrada de 12/11/2026 em `historico.md`. Foi encontrada discrepância histórica em `HISTORICO.md` (contagem 49 e status antigo “em andamento”); esse arquivo ficou fora do escopo de edição. As instruções foram atualizadas em `AGENTS.md` e `.github/copilot-instructions.md`; não houve alteração de funcionalidade. `scripts/read-project-docs.sh`, sintaxe Bash, JSON do Codespace e `git diff --check` foram validados. A configuração foi commitada em `a37958f` e enviada a `origin/main`; este registro de confirmação é uma atualização documental separada. Não alegar que a abertura da página por si só carrega os Markdown no contexto.

## Configuração permanente de contexto — 12/11/2026

Foram criadas instruções em `AGENTS.md` e `.github/copilot-instructions.md` para listar e ler os arquivos Markdown versionados antes de qualquer tarefa, começando por esta continuidade e pelo histórico. Quando o conjunto exceder o contexto ou algum arquivo estiver inacessível, a próxima sessão deve informar precisamente o que leu, o que leu parcialmente e o que não conseguiu ler; não deve declarar a leitura completa. O terminal não injeta seu conteúdo no contexto do Copilot.

O script `scripts/read-project-docs.sh` e o `postStartCommand` em `.devcontainer/devcontainer.json` verificam os Markdown no início do Codespace sem exibir conteúdo, alterar arquivos, fazer commits, deploys ou operações pagas. A branch tinha 50 Markdown; os dois novos arquivos de instruções elevam o total versionado a 52. Nesta sessão foram lidos integralmente `README.md`, `ARQUITETURA.md`, `SUPABASE.md`, `CLOUDFLARE.md`, `PUBLICACAO.md`, `INTEGRACOES.md` e este arquivo. O início recente de `historico.md` foi consultado parcialmente; os demais documentos não foram lidos no contexto desta sessão. `bash -n` e a validação do JSON passaram; com as instruções incluídas no índice Git, a varredura leu 52/52 arquivos sem exibir o conteúdo e o estado Git/hash do patch preexistente permaneceram inalterados. Nenhum deploy, cobrança ou alteração remota foi executado. A varredura do terminal não substitui a leitura contextual do agente.

## Correção mais recente — Individual Seller fechado para BR

Documento oficial Developer account registration (10/09/2026), fornecido pelo responsável, declara **Individual Seller: Closed for BR**. No Brasil, Registered Business Seller exige empresa/documentos válidos e um pedido nos últimos30 dias; ISV exige empresa registrada, produto ativo, integrações demonstráveis e conta de avaliação. CPF não substitui registro empresarial. Perfil foi relatado como em análise após envio de CPF em campos empresariais; não há confirmação de app criado/aprovado. Guia informa análise ISV em10 dias úteis e correção por Go to Profile → Edit em caso de recusa. Conta de avaliação criada, login validado, sem dados/conexões do proprietário; senha entregue separadamente e não versionada. API de vídeo autoriza afiliados com auth_type=user, mas elegibilidade do desenvolvedor e habilitação BR ainda dependem da Shopee. Política de proteção de dados prevê obrigações de segurança além do anexo opcional para PII. Detalhes e correções no início de [historico.md](./historico.md). Este bloco prevalece sobre a proposta abaixo de tentar perfil brasileiro Individual Seller.

## Prioridade mais recente — cadastro do app Shopee Video Management, 11/11/2026

O responsável pediu atualizar historico.md e seguir passo a passo para criar o app de vídeo. Documentação oficial copiada da sessão autenticada **confirma autorização Affiliate com auth_type=user e APIs de vídeo baseadas em user_id**. Somente categoria **Shopee Video Management** oferece o contrato; categorias não podem ser alteradas nem receber endpoints extras. Isso corrige conclusões anteriores de autorização somente para vendedor. Ainda faltam elegibilidade do perfil pessoa física no Brasil, app/aprovação e produtos aceitos. Não criar loja com CPF como garantia de acesso. Chamado2120492660289695840 está In Progress; e-mails recebidos foram automáticos. Empresa antiga consultada consta baixada, sem comprovante oficial emitido. Começar por requisitos/campos reais de Developer account registration → Shopee Seller/Brazil; depois categoria disponível em App List. O guia Livestream omite BR na lista de suporte, mas não prova restrição idêntica no módulo de vídeos. Registro completo e limites no início de [historico.md](./historico.md). Nenhum envio de mídia, implementação de API ou GPU autorizado/iniciado por este registro documental.

## Destino de publicação esclarecido — 11/11/2026

Frontend publicado na versão Cloudflare `b067dd69-f43a-4142-83cb-4add262b6a0d`. 250 testes, tipos, lint, build e navegador controlado desktop/mobile aprovados. Falta validar o receptor no celular real e obter acesso específico para postagem por API de criador afiliado.

O responsável quer divulgar em **Shopee → Live e Vídeos → Vídeos**, não na vitrine. Consulta autenticada nas duas conexões atuais confirmou somente `generateShortLink` e `generateBatchShortLink` como mutations; nenhuma operação de vídeo no contrato Affiliate Open API. Há publicação por API em integrações para vendedores, com autorização específica, mas acesso equivalente para esta conta de afiliado ainda não foi confirmado. Diagnóstico encerrado v2/HTTP410. A interface foi ajustada com destino visível, botão Compartilhar para Shopee Vídeo, cópia do nome do produto e instruções para concluir no aplicativo. Web Share não escolhe o receptor nem confirma postagem. Evidência, limites e requisitos para automatizar em [SHOPEE_VIDEO_PUBLICACAO.md](./SHOPEE_VIDEO_PUBLICACAO.md). Publicação do frontend e verificações desta rodada devem ser conferidas nesse relatório.

## Nova fonte oficial de fotos confirmada — 10/11/2026

Após pergunta sobre Compartilhar → Baixar todas as imagens do aplicativo, a consulta autenticada descobriu quatro feeds disponíveis em listItemFeeds/getItemFeedData. Vinte produtos amostrados retornaram image_link e image_link_3 com URLs distintas; duas fotos do mesmo item foram baixadas e visualmente conferidas,1024×1024 e hashes diferentes. Isto corrige/amplia a conclusão anterior baseada apenas em productOfferV2 e HTML do anúncio.

A fonte ainda NÃO está integrada ao seletor do site. Não se comprovou equivalente de todas as imagens do aplicativo. Próxima implementação deve usar feeds com índice/paginação e validação estrita da identidade loja/item/conta, sem misturar variantes nem varrer todos os dados por clique. Relatório em GALERIA_DE_PRODUTO.md; evidência em tests/results/2026-11-10-affiliate-feed-images-live.json. Nenhuma alteração de app nesta investigação; diagnóstico encerrado v4/HTTP410.

## Link no pop-up e fotos do anúncio — 10/11/2026

Botão Gerar meu link de divulgação inserido imediatamente abaixo do campo no primeiro passo do pop-up, para produto Shopee da conexão. Gera pela API existente, preenche a caixa e preserva salvamento em Meus links. Fluxo testado no navegador com resposta controlada.

Coleta já consultava o endereço do anúncio, além da capa. Teste público em navegador normal, aguardando os scripts, chegou a Página indisponível/pedido de login da Shopee, sem galeria. Não foi possível validar importação completa por esse caminho; não dizer que o anúncio possui apenas uma foto. Seletor agora oferece Abrir anúncio na Shopee e a mensagem explica corretamente o acesso limitado, preservando envio de fotos do dispositivo.

Sete testes da galeria, tipos frontend/Edge, lint, build de 17 rotas e navegador com posição/preenchimento do botão e mobile aprovados. Cloudflare `c3582268-a693-4897-9ca6-317ddf96568c`; Supabase product-gallery v3. Detalhes e evidências em [GALERIA_DE_PRODUTO.md](./GALERIA_DE_PRODUTO.md). Sem geração de mídia, GPU ou postagem nesta rodada.

## Assistente por etapas, IA visual e narrador — 10/11/2026

Novo pedido entregue: aviso informativo removido; criação em pop-up com quatro etapas (produto/roteiro → vídeo → narração/aprovação → compartilhar). IA recebe foto e prepara fala, prompts PT/EN, legenda e hashtags. Groq visão validada com foto real do catálogo; Gemini sem saldo pré-pago, OpenRouter gratuito não confirmou resposta utilizável. Usuário revisa o roteiro antes de avançar, pois a amostra teve termos que exigem correção. Google TTS existente conectado ao editor; navegador aplica voz ao vídeo/imagem e exige aprovação antes do compartilhamento completo. Teste de navegador gerou MP4 real com trilha de áudio sintético e recuperou rascunho; não confundir com síntese TTS real ou postagem.

A publicação/vitrine Shopee NÃO é automática nesta integração. Produto precisa ser vinculado ao vídeo; link na legenda não substitui o vínculo. Vitrine recebe produto por seleção/importação própria na conta Shopee, conforme fontes oficiais no relatório. Pergunta sobre loja de vendedor/vitrine de afiliado ficou sem resposta nesta sessão; não presumir publicação nas duas.

246 testes, tipos frontend/Edge, lint e build aprovados. Cloudflare `132378e4-5e85-442f-8667-d6aa4a0f939e`; Supabase `campaign-content` v2; diagnóstico encerrado HTTP410; endpoint sem login HTTP401. Detalhes e limites em [ASSISTENTE_DE_DIVULGACAO.md](./ASSISTENTE_DE_DIVULGACAO.md). Nenhuma GPU ou postagem real iniciada.

## Correção posterior — catálogo Shopee em 10/11/2026

O responsável informou que Início/Ofertas mostrava lojas indisponíveis, pediu atualização automática ao trocar abas e acesso além da lista pequena. Confirmado: vitrine pública HTTP503; conexões privadas funcionando; corte interno de 60 produtos. Todas as visualizações agora usam a conexão Shopee quando autenticado, atualizam ao entrar e consultam páginas sem corte total de 60. Busca por nome é enviada à API. A Shopee retornou System Error código10000 para palavras; fallback explícito permite filtrar páginas da listagem geral e continuar carregando, sem fingir busca global. O cron inicial continua com sua seleção antiga, independente da navegação paginada.

241 testes aprovados, TypeScript frontend/Edge, lint sem erros e build de 17 rotas. Navegador controlado com 80 produtos, troca de abas, busca, link e mobile aprovado. API real confirmou página4 com 20 produtos e próxima página disponível; nenhum link foi gerado nos testes. Supabase marketplace v31; diagnóstico encerrado HTTP410. Relatório e evidências em [DIVULGACAO_INTEGRADA.md](./DIVULGACAO_INTEGRADA.md).

## Retomada autorizada em 10/11/2026

O responsável pediu “faça isso agora”, autorizando a implementação do pedido abaixo. A área unificada e o fluxo produto → link → criação/importação → preparação da publicação foram implementados e publicados na versão Cloudflare `8f951b5b-ff29-4e6a-ac25-bb2069477dc3`. Estado e limites em [DIVULGACAO_INTEGRADA.md](./DIVULGACAO_INTEGRADA.md). A instrução de apenas registrar abaixo passa a ser histórica. Geração externa no Gemini/Flow e postagem final na Shopee continuam exigindo ação do usuário; não iniciar ensaios de GPU automaticamente.

## Próxima sessão — pedido do responsável em 10/11/2026

**Instrução desta sessão: apenas salvar a mensagem abaixo, fazer commit e push. Não implementar as mudanças do site agora.** Retomar o planejamento a partir deste pedido na próxima sessão. As funcionalidades descritas são desejadas, não entregues; este registro não autoriza iniciar GPU, gerar conteúdo ou publicar em redes sociais agora.

### Mensagem do responsável preservada

chat vamos dar uma organizada no site temos 5 abas no site q poderiam estar apenas em uma aba porem com opção do usuario mudar o filtro "inicio oferta,dasboard, produtos, rada de tendencia, top 10"

2 - qdo o usuario esclher um produto ao clicar em ver e divulgar a aba q abrir ja tem q vir alem dos dados do produto q vem hoje ferramenta para gerar video

3  - qdo o usuario clicar em gera e salvar link deve abrir aa do gerador de video/imagem assim eu consigo criar o video da diulgação no propio link. qdo o video tiver pronto ele é enviado para a publicação junto com o meu link de vendedor.

4 - fora do meu vendedor eu faço assim hoje.:

Passo a passo para Divulgar video na shopee

1 -  em criadores de conteudo eu clico no produto.
2 - clico em compartilhe para ganhar
3 - clico para baixar todas as imagens
4 - pego a imagem e jogo no gemini e peço para criar um prompt de acordo com o chat.
5 -  nesse prompt peço o chat para colocar uma pessoa gerada por inteligencia usando o produto em um ambiente de acordo com o produto, depois ele gera uma fala atratativa elogiando o produto e chamando para clicar no link

""  [INSTRUÇÃO DE PROMPT PRÉ-DEFINIDO]

Você atuará como um Especialista em Prompts para IAs de Vídeo (como Flow, Runway, Sora, Kling).

Ao receber a imagem de um produto de vestuário:
1. Identifique automaticamente se o produto é MASCULINO ou FEMININO e liste os detalhes visuais da peça (cor, modelo, tecido, gola, estampas, corte).
2. Selecione o personagem adequado (homem elegante/moderno ou mulher estilosa/elegante).
3. Crie uma fala persuasiva, atrativa e direta em português divulgando a peça e convidando o público a clicar no link para aproveitar a promoção.
4. Gere o PROMPT FINAL em Inglês e Português pronto para ser colado nas ferramentas de geração de vídeo.

Estrutura do Prompt a ser gerado:
- Descrição detalhada do modelo vestindo a peça exata da imagem.
- Ação/gesto do modelo exibindo o caimento e qualidade do produto.
- Cenário coerente com a proposta da peça.
- A fala exata em português com tom persuasivo de vendas e chamada para ação (CTA).
- Especificações técnicas de câmera (Medium shot, realistic lighting, 4k, cinematic commercial).

6 - baixo o video no google flow
7 - volto na shopww e copio o nome do produto
8 - clico em compartilhe e ganhe
9 - seelciono shopee video
10 - seleciono meu video na galeria
11- clico em proximo
12 - coloco o nome do produto na legenda
13 - add as hadtags
14  - clico em postarqueria q essee modo fosse integrado na ferramenta da shopee qdo eu for vender por ele.

apenas salve essa msg em continuar amanha.md oara continuar faça o commi e git puxh

### Pontos para retomar

- Unificar Início/Ofertas, Dashboard, Produtos, Radar de Tendências e Top 10 em uma área com filtros de visualização.
- Em **Ver e divulgar**, manter os dados do produto e disponibilizar a criação de vídeo/imagem no contexto do anúncio.
- Em **Gerar e salvar link**, abrir a criação de mídia preservando produto e link de afiliado, seguindo depois para preparação da publicação com o vídeo/imagem e esse link.
- Usar o fluxo manual descrito acima como referência: fotos do anúncio → análise/prompt bilíngue e fala → geração/importação de mídia → nome do produto, legenda, hashtags e link → publicação Shopee Vídeo.
- Antes de implementar a etapa de publicação, verificar o mecanismo efetivamente disponível para a conta Shopee e distinguir preparação/compartilhamento de publicação integrada. A descrição do fluxo desejado não comprova que uma API de postagem já esteja disponível.

## Estado entregue antes deste novo pedido

> **Fotos do anúncio — 10/11/2026:** galeria e filtro de texto adicionados ao vídeo de produto. Backend `product-gallery` v2; OCR local testado com tabela de medidas/descrição e revisão manual. A coleta completa de galeria real da Shopee ainda depende da fonte e de validação com conta normal; não apresentar o teste controlado como prova dessa coleta. Estado em [GALERIA_DE_PRODUTO.md](./GALERIA_DE_PRODUTO.md).

> **Prioridade atual — 10/11/2026:** modo **Vídeo de produto** implementado como entrada de `/videos`, com fotos/clipes reais, transições, aproximação, exportação sem áudio e biblioteca privada. Personagens em aba experimental separada; não retomar seus ensaios/GPU automaticamente. Ver entrega, validações e limite do teste remoto de upload em [VIDEO_DE_PRODUTO.md](./VIDEO_DE_PRODUTO.md). Os estados de 09/11 abaixo permanecem como histórico dos experimentos suspensos.

> **ÚLTIMA INSTRUÇÃO — processo encerrado para preservar crédito, 09/11/2026:** não iniciar GPU sem nova instrução. Há **4 s de trabalho preservados**, incluindo uma continuação nova, no Storage privado `mv-video-assets/operator/ana-six-20261109/resume/resume-four-seconds.mp4`. O bruto de 49 quadros também está no mesmo diretório. A montagem foi normalizada localmente e ainda precisa de revisão visual. Falta gerar **apenas a última continuação de 2 s**, com seed 44, após configurar novo job com o seed de 4 s e seu hash. Não repetir as duas continuações do job antigo. O vídeo novo de 6 s **não foi concluído**; existe somente uma prévia de 6 s em câmera lenta do trecho antigo. `ana-six-test` fechado, versão 10/HTTP410 verificada. Relatório, hashes, falhas e passos exatos em [TESTE_ANA_MIDI.md](./TESTE_ANA_MIDI.md) e `executors/kaggle/results/2026-11-09-ana-six-stopped.json`. Esta instrução prevalece sobre todas as autorizações e estados abaixo.

> **Nova autorização vigente:** entregar vídeo final de 6 segundos da Ana/vestido midi. Notebook `mv-ana-six-20261109-r1` (`144014985`) enviado; não duplicar. Método e limites em [TESTE_ANA_MIDI.md](./TESTE_ANA_MIDI.md). Esta instrução é posterior às suspensões históricas abaixo.

> **Estado final consolidado — 09/11/2026 16:22 UTC:** a sessão que conduziu os testes encerrou o controlador `ana-midi-test` na versão 19; HTTP410 verificado. Hunyuan r2 entregou o MP4; Wan r2 não chegou à inferência após dez minutos na fila. Foram solicitados os cancelamentos dos quatro notebooks temporários, inclusive Hunyuan r2 após sua entrega. A última consulta devolveu **CANCEL_REQUESTED para todos os quatro**, sem confirmação de término remoto. Isso supera o retrato parcial da recuperação abaixo, que ainda mostrava Hunyuan r2 RUNNING e controlador somente em leitura. A origem das mudanças foi a própria sessão de teste, não uma retomada de GPU. Relatórios finais em [TESTE_ANA_MIDI.md](./TESTE_ANA_MIDI.md). Não reenviar ou reativar automaticamente.


> **Retorno posterior nesta recuperação:** o controlador passou a responder
> `generation_disabled: true`; Wan r1/r2 e Hunyuan r1 aparecem como
> `CANCEL_REQUESTED`. Hunyuan r2 aparece remotamente como `RUNNING`, apesar
> do MP4 concluído e preservado anteriormente. Não confundir entrega de arquivo
> com encerramento da sessão. Nenhuma submissão ou solicitação de cancelamento
> foi enviada nesta recuperação; a origem dessa mudança do controlador não foi
> determinada. Cancelamento solicitado não comprova encerramento confirmado.
> Não retomar GPU automaticamente. A comparação Wan continua sem MP4.
> Verificação local: 225 testes aprovados, sintaxe dos scripts Python conferida
> e `git diff --check` aprovado.

> **Recuperação do terminal — 09/11/2026, 16:15 UTC:** a última tarefa é a comparação Ana/vestido midi, autorizada mais recentemente que as suspensões históricas abaixo. Hunyuan r2 concluído. Wan **r2** confirmado no Kaggle (`143998541`), ainda sem callback/log/MP4; controlador em `submitting`, status bruto remoto `{}` compatível com padrão de fila do SDK. Não reenviar. Aguardar retorno, recuperar e inspecionar resultado, comparar e encerrar controlador temporário. Evidência em `executors/kaggle/results/2026-11-09-ana-midi-recovery.json`; detalhes em [TESTE_ANA_MIDI.md](./TESTE_ANA_MIDI.md). Git sem commits locais à frente de `origin/main`; há scripts e documentos ainda sem commit. A decisão de substituir o estúdio por links externos continua sem aprovação.

> **Comparação encerrada — 09/11/2026:** vídeo antigo veio de FASHN VTON → SCAIL-2 → áudio, confirmado por configuração e hash. Hunyuan r2 entregou MP4 silencioso de 2 s, com movimento discreto; Wan não chegou à inferência após problemas de confirmação/fila. Controlador HTTP410 verificado. Kaggle devolve CANCEL_REQUESTED para os quatro notebooks; término remoto não confirmado. Relatório em [TESTE_ANA_MIDI.md](./TESTE_ANA_MIDI.md). Não retomar GPU nem reenviar automaticamente.

> **Decisão adiada — última instrução de 09/11/2026:** o responsável considera trocar a geração interna por um seletor de sites e botão para abrir Google Flow/Gemini, onde já está conseguindo produzir vídeos. Pediu explicitamente não alterar nada ainda e decidirá amanhã. Foram debatidos acesso externo simples, preparação de imagens/textos no app com geração externa e API paga; nenhuma opção foi aprovada. Registrar e aguardar a decisão, sem remover recursos, mudar o estúdio, publicar, contratar serviços ou retomar ensaios/GPU. Conversa salva em [historico.md](./historico.md).

> **Interrupção vigente em 09/11/2026:** o responsável encerrou os ensaios por mistura de referências de anúncios e pediu somente o registro do histórico. Não iniciar, reenviar ou retomar geração/GPU sem nova instrução. A última tentativa StableAnimator foi cancelada durante download de pesos; não houve inferência de vídeo nem roupa aplicada à Carla nesta rodada. SwiftTry não foi executado. Resultados e entradas: [historico.md](./historico.md) e [PESQUISA_VIDEO_ALTERNATIVAS.md](./PESQUISA_VIDEO_ALTERNATIVAS.md). O endpoint temporário `video-research` foi encerrado com HTTP 410.

> **Revisão vigente:** o responsável rejeitou a camiseta de exemplo e proibiu reiniciar os testes. Correções e limites em [AUDITORIA_GERADOR_VIDEO.md](./AUDITORIA_GERADOR_VIDEO.md); conversa e decisões em [historico.md](./historico.md). Nenhum resultado da camisa do anúncio foi aprovado.

## Interrompido pelo responsável

Testes de movimento interrompidos a pedido do responsável. A imagem FASHN da camisa na Carla foi rejeitada como errada; não tratá-la como resultado aprovado. Não reiniciar GPU sem nova instrução.

## Complemento autorizado — movimento e roupa

O responsável ampliou o escopo e autorizou implementação, publicação e testes no Kaggle, Supabase e Cloudflare. A integração experimental está em [MOVIMENTO_E_PRODUTO.md](./MOVIMENTO_E_PRODUTO.md): Wan Animate, SCAIL-2, VACE e FASHN. FASHN já entregou uma imagem real da Carla vestindo a camiseta da referência; validação de movimento está em andamento. Não confundir integração com aprovação de qualidade ou interação exata com qualquer objeto. O relatório final desse complemento prevalece sobre as pendências antigas de movimento abaixo.

## Estado confirmado do modo de voz fixa em 08/11/2026

O fluxo **foto falante + cartão da imagem do produto** está publicado e disponível no estúdio. O botão principal usa Google TTS → MuseTalk 1.5 no Kaggle → MP4 privado, em 720×1280/25 fps, com fala limitada a 15 segundos. Carla e Rafael têm referências realistas plus size; os quatro perfis estão aprovados para esse formato e guardados em `mv_presenter_profiles`.

Foi concluída uma geração real pelo botão publicado, incluindo login, upload do produto, nova narração, processamento Kaggle e MP4 na biblioteca. Também foram validados quatro MP4s de referência, histórico por usuário, cancelamento cooperativo, recuperação de resultado e acesso privado. O relatório versionado é [2026-11-08-presenter-product-validation.json](./executors/kaggle/results/2026-11-08-presenter-product-validation.json); a entrega e os limites estão em [ENTREGA_VIDEO_COM_PRODUTO.md](./ENTREGA_VIDEO_COM_PRODUTO.md).

Frontend Cloudflare publicado na versão `627f251b-955c-4175-a065-f00bce5c26d4`; Supabase `hybrid-video` v8. Os diagnósticos temporários foram encerrados (HTTP 410), contas técnicas removidas e não há tarefas híbridas ativas. A suíte concluiu com 219 testes; lint, TypeScript frontend/Edge e build das 17 rotas passaram. Commit da implementação enviado para `origin/main`: `91e553481c211af5fe3dcea88c29c00ab61331bf`.

## O que revisar e corrigir na próxima sessão

1. **Revisão visual humana antes de ampliar a promessa de qualidade:** abrir as amostras finais de Carla e Rafael e o MP4 da geração real no relatório. Anotar defeitos reproduzíveis de alinhamento, suavização, tremor ou identidade da boca. Corrigir apenas defeitos observados e voltar a conferir os quadros e o vídeo completo. O alinhamento foi melhorado, mas a textura ainda pode variar e não há certificação de sincronismo perfeito.
2. **Validar o cartão com um produto real autorizado:** gerar no app com uma imagem de produto de teste da própria conta e confirmar enquadramento, legibilidade e ausência de corte. A geração E2E usou um cartão técnico de controle; ele não prova a apresentação de um produto real. Não reutilizar imagem de cliente sem autorização.
3. **Conferir a experiência após a geração:** confirmar estados de espera/falha/cancelamento, reprodução e download na biblioteca em desktop e celular, usando uma conta normal. Se ocorrer defeito, guardar o estado/ID técnico e corrigir antes de tentar novamente; evitar reenvio de tarefa incerta, pois GPU pode ser consumida.
4. **Reavaliar limites e licenças antes de uso comercial ampliado:** revisar termos vigentes do MuseTalk e de cada componente, materiais de produto enviados, Google TTS e capacidade/cota Kaggle. Os testes não comprovam disponibilidade contínua, SLA nem 15 vídeos por dia.

## Pendências registradas antes da ampliação de escopo

- Movimento corporal, gestos e atuação natural; a base atual é uma fotografia estática com animação facial.
- Troca de roupa ou cenário e novas bases (por exemplo, cozinha/oficina). Não estão conectadas a geração automática FLUX nem a um fluxo de aprovação por variante.
- Sessão persistente de modelos para reduzir a preparação por job, capacidade diária comprovada e geração nativa 4K.
- Publicação no YouTube, catálogo das lojas, SMTP e demais integrações continuam sendo pendências independentes do fluxo de vídeo.

## Regras para retomar

- Começar pela revisão das evidências existentes; não iniciar notebook/GPU apenas para repetir os testes já concluídos.
- Se uma correção exigir nova renderização, usar primeiro uma amostra curta autorizada e registrar nova evidência no relatório. Não afirmar que testes controlados da interface representam uma geração real.
- Não reativar provedores pagos antigos, não excluir Secrets e não publicar tokens, cookies ou URLs assinadas.
- Depois de qualquer mudança: rodar as verificações pertinentes, atualizar este arquivo e [ENTREGA_VIDEO_COM_PRODUTO.md](./ENTREGA_VIDEO_COM_PRODUTO.md); documentar a nova evidência e limites.

## Histórico

Os registros anteriores desta continuidade descreviam estados de piloto que foram superados pela entrega acima. Para histórico de outras funcionalidades, consultar [ATUALIZACOES.md](./ATUALIZACOES.md) e os documentos específicos. A situação vigente do fluxo de vídeo é sempre a descrita em [ENTREGA_VIDEO_COM_PRODUTO.md](./ENTREGA_VIDEO_COM_PRODUTO.md).

Frontend desta correção publicado no Cloudflare `e553299a-b481-4246-aca1-d6a64f1c94b4`.

### Atualização do agendamento — 12/11/2026

TikTok — publicação assistida foi acrescentado como destino independente ao lado de Pinterest; “Outro aplicativo” permanece. A interface e a Edge Function agora aceitam o payload de múltiplos destinos que a interface realmente envia. A migração aditiva `20261112190000_publication_tiktok_destination.sql` e os testes locais contemplam dois registros separados para Pinterest e TikTok no mesmo horário. O vencimento continua solicitando ação manual; não existe publicação automática nem confirmação automática.

Esta correção está validada apenas localmente: 262 testes, typecheck frontend, typecheck Edge Function e build estático para Cloudflare passaram; lint teve zero erros e quatro avisos preexistentes. O cenário de 20/11/2026 às 18:00 `America/Sao_Paulo` foi validado em testes, sem criação remota ou postagem real. O commit `6fc16adac36463a671b163e7192855a9182fa493` foi enviado à `main` e o hash remoto foi confirmado. Não foi possível consultar/aplicar migrações ou publicar a Edge Function: a API do Supabase respondeu HTTP 401. A API/listagem do Worker existente `meu-vendedor` respondeu HTTP 403 (“No access to the specified resource”). Não declarar a entrega publicada.

### PRÓXIMA ETAPA — COMPARTILHAMENTO EM REDES SOCIAIS

Após concluir a publicação e validação do agendamento assistido:

1. **Facebook Stories:** pesquisar e confirmar permissões oficiais vigentes para compartilhar vídeos e imagens nos Stories.
2. **TikTok:** verificar APIs oficiais, autorização, elegibilidade e permissões concedidas para compartilhar ou publicar no perfil do usuário. O destino assistido já existe; publicação pelo perfil continua pendente.
3. **Kwai:** verificar se existe integração oficial disponível, seus requisitos e permissões de publicação.
4. **Compartilhamento por aplicativos instalados no celular:** investigar e implementar posteriormente os mecanismos oficiais do Android e iPhone para compartilhar vídeos, legendas, hashtags e links usando aplicativos e sessões já autenticadas, sem depender de APIs de publicação quando houver suporte a compartilhamento manual.

Não implementar essas melhorias futuras nesta etapa. Se não houver API oficialmente autorizada, oferecer apenas compartilhamento manual/assistido e nunca declarar postagem automática. O estado atual dos agendamentos, testes e publicações está registrado em [PUBLICACAO.md](./PUBLICACAO.md) e [historico.md](./historico.md).
