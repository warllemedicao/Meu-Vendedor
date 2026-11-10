# Ofertas, criação e publicação — 10/11/2026

## Entrega

- Menu único **Ofertas e produtos**, com filtros Início/Ofertas, Dashboard, Meus produtos, Radar de Tendências e Top 10. As quatro rotas anteriores abrem a mesma área com sua visualização selecionada. O filtro também é preservado na URL e responde a voltar/avançar.
- Dashboard calcula os totais sobre as ofertas carregadas. Radar explora volume informado, sem afirmar crescimento temporal. Top 10 limita os resultados filtrados a dez conforme a ordenação escolhida; não é ranking global nem seleção por IA.
- **Ver e divulgar** abre a criação na ficha, mantendo dados e foto do anúncio. Disponível na vitrine e no catálogo conectado. Na vitrine pública, o link é informado pelo usuário; a geração oficial continua no catálogo da conexão Shopee.
- **Gerar e salvar meu link** mantém a operação existente da API Shopee e leva à criação de mídia com o endereço retornado. Produto não é substituído ao abrir a montagem.
- Fluxo de personagem: preparar instrução com anúncio, detalhes confirmados, personagem, cenário e fala; copiar e anexar foto no Gemini; obter prompts finais em português/inglês para imagem/vídeo; abrir Flow e importar mídia pronta. A análise visual e a geração são externas e não foram automatizadas por esta entrega. Não há inferência/GPU disparada automaticamente.
- Montagem interna continua disponível com fotos/clipes, produto pré-selecionado, título/preço e resultado encaminhado à preparação de publicação. A biblioteca privada existente permanece disponível.
- Mídia importada ou exportada abre preparação com legenda, hashtags e link. Download, cópia e compartilhamento nativo de arquivos quando suportado pelo navegador.
- Rascunho da última divulgação salvo em IndexedDB por ID da conta, incluindo Blob, legenda, hashtags e link. Retomado em **Publicações**. É local ao navegador/dispositivo, não sincroniza com Supabase e é substituído ao salvar outro. Mudança de conta remonta o editor e não mostra o rascunho de outra conta.

## Shopee Vídeo

A integração instalada usa a Affiliate Open API para consultar ofertas e gerar links. Não há operação implementada de postagem de Shopee Vídeo. O portal oficial de API exige aplicação JavaScript/autenticação; a pesquisa pública não confirmou uma permissão de postagem para esta conta. A ausência de confirmação não prova inexistência de API de vídeo para outros tipos de conta.

A interface prepara os materiais e permite compartilhamento do dispositivo, sem marcar o conteúdo como publicado. Para concluir: Compartilhe para ganhar → Shopee Vídeo → selecionar mídia → conferir legenda e vínculo com produto → postar na Shopee. O suporte ao envio de texto junto com arquivo depende do aplicativo receptor; copiar a publicação continua disponível.

## Validação

- 235 testes existentes aprovados, mais 3 novos testes de composição, links e instrução de prompt.
- TypeScript e build de produção aprovados, 17 rotas. O build exigiu execução fora do sandbox, pois subprocessos Node internos retornavam saída vazia ao executar `tsc --showConfig`.
- Lint sem erros; quatro avisos preexistentes nos controladores experimentais Kaggle. `git diff --check` aprovado.
- Playwright com catálogo simulado: Top 10, contexto do anúncio no prompt, mídia e link na publicação, layout desktop/mobile sem overflow, Dashboard, histórico de navegação, rota anterior Produtos. Persistência real em IndexedDB: Blob, legenda e link recuperados; outra chave de conta não recebe o rascunho. Evidência em `tests/results/2026-11-10-campaign-browser.json`.
- O teste não fez login, não gerou link real na API, não executou IA/GPU e não compartilhou/postou conteúdo. Não é validação de publicação no Shopee Vídeo ou geração real no Flow.
- Cloudflare publicado na versão `8f951b5b-ff29-4e6a-ac25-bb2069477dc3`, após dry run. Página inicial e `/publicacoes` consultadas por HTTP com sucesso e conteúdo novo confirmado.
- URL: https://meu-vendedor.httpsgithubcomwarllemedicaosunshine-budget-guidegit.workers.dev

## Correção do catálogo — retorno do responsável em 10/11/2026

**Problema:** Ofertas usava a vitrine pública separada, retornando HTTP503. As duas conexões privadas Shopee estavam ativas e o banco tinha 120 registros atuais, 60 por conexão. A sincronização buscava três páginas de 20 e a tela também tinha `.limit(60)`. Trocar abas relia somente a seleção salva, sem ampliar a busca.

**Correção:** todas as cinco visualizações usam a conexão Shopee da conta autenticada quando disponível. Cada entrada na visualização inicia uma consulta autenticada à API. A ação `browse_products` consulta uma página por vez e retorna `hasNextPage`; busca por nome e ordenação são enviadas à Shopee, sem restringir a `listType:2`. Novos produtos são salvos somente na conexão e conta autenticadas, para manter a ficha, fotos e geração de link. O cron antigo continua atualizando sua seleção inicial de 60, mas a navegação interativa já não depende dessa seleção e o link não é recusado apenas por ficar fora dela; validade temporal e expiração continuam conferidas.

A lista carrega novas páginas ao rolar, com botão de continuidade como alternativa; não há um teto total de 60 na navegação. Isto permite explorar o catálogo liberado pela API, não garante que a Shopee exponha todos os anúncios ou todas as condições de afiliado da plataforma. Total global não é inventado. Coalescência de solicitações simultâneas e cache privado de 10 segundos evitam duplicação de chamadas na troca rápida de visualização.

**Falha real da Shopee:** introspecção autenticada confirmou `keyword`, `page`, `limit` e `sortType`. Página 1 e página 4 entregaram 20 produtos cada, com IDs iniciais diferentes e `hasNextPage:true`. Consulta por “vestido” retornou `extensions.code:10000`, System Error, inclusive com consulta mínima e `listType:0`. Esse erro agora é tratado como falha interna do provedor. Quando só a pesquisa falha, o sistema carrega a listagem sem palavra, identifica explicitamente a pesquisa como filtro local e permite consultar mais páginas por botão. Não apresenta a listagem geral como resultado completo daquela busca. Erros de autenticação ou limites não são ocultados por esse fallback.

A vitrine pública continua isolada, sem usar credenciais privadas para visitantes. Sua configuração indisponível não foi preenchida com chaves pessoais. Tentativas públicas agora ocorrem automaticamente ao entrar, voltar à janela, reconectar a rede e a cada minuto; não dependem de botão de atualização.

**Validação:** 241 testes passaram, incluindo paginação além da terceira página, validação de parâmetros e fallback do código10000. TypeScript frontend/Edge, lint sem erros (quatro avisos anteriores), build de 17 rotas e revisão de whitespace aprovados. Navegador com conta/API simuladas validou 80 itens em quatro páginas, troca de visualização atualizando, envio de palavra-chave, link no produto, mobile e fallback transparente. Consulta real foi somente de catálogo, sem criar link/venda/postagem. Evidências: `tests/results/2026-11-10-catalog-browser.json` e `tests/results/2026-11-10-catalog-live.json`.

Supabase `marketplace` v31. Diagnóstico temporário encerrado em HTTP410. Versão final do frontend registrada na continuidade após publicação.

Frontend desta correção publicado no Cloudflare `e553299a-b481-4246-aca1-d6a64f1c94b4`.
