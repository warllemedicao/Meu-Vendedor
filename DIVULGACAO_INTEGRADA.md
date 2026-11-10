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
