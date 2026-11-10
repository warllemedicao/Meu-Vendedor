# Fotos do anúncio para vídeos — 10/11/2026

## Diagnóstico e limite da origem

O catálogo atual `mv_products` armazena apenas `image_url`; a consulta `productOfferV2` implementada também solicita uma única imagem. Não existe galeria persistida no banco. A consulta pública de um anúncio Shopee real retornou uma aplicação JavaScript sem JSON da galeria ou identificação do item no HTML recebido. Isso não comprova acesso às demais fotos por esse caminho.

A melhoria tenta ler a galeria estruturada do próprio anúncio, quando ela estiver disponível. Não usa imagens genéricas da página, recomendações, variantes de outros itens, adivinhação de URLs nem caminhos alternativos para contornar restrições. Se não houver galeria acessível, informa que só encontrou a capa. Não promete recuperar todas as fotos de todo anúncio Shopee.

## Fluxo disponível

Em `/videos`, modo **Vídeo de produto**, seção **Fotos do anúncio · seleção com filtro de texto**:

1. Com login, escolher um produto do próprio catálogo e clicar **Buscar fotos do anúncio**.
2. Alternativamente, usar **Analisar fotos do dispositivo** com fotos salvas do anúncio, inclusive sem login.
3. Aguardar a leitura local de texto e revisar as miniaturas. Possíveis tabelas de medidas, especificações, descrições longas e leituras incertas ficam desmarcadas. Texto curto de marca/rótulo não é excluído indiscriminadamente.
4. Corrigir a seleção se necessário e adicionar as fotos às cenas. A seleção respeita as oito vagas do vídeo; depois é possível ordenar as cenas.

Até 12 fotos e 60 MB por lote local. Arquivos repetidos são descartados por SHA-256, incluindo fotos já adicionadas às cenas. Cancelamento preserva as miniaturas já carregadas para revisão manual. Trocar de produto invalida a galeria anterior. Falha ou demora da análise deixa fotos não analisadas desmarcadas.

O filtro usa Tesseract.js 6.0.1 e dados de português 1.0.0, com dependências fixadas no lockfile. Worker, WebAssembly e idioma são copiados localmente no pré-build; a análise não baixa modelos de um CDN externo nem usa Gemini ou créditos de IA. O motor é carregado apenas quando a análise é solicitada. Os arquivos públicos gerados, cerca de 36 MB no total, são ignorados pelo Git e reproduzidos por `scripts/prepare-product-ocr.mjs`; cada navegador só busca os componentes de que precisa.

## Backend e proteção

Nova função Supabase `product-gallery` v2, com `auth.getUser` antes de consultar produto por `user_id` e `id`. O cliente envia somente o ID do produto; URL e usuário arbitrários não são usados como origem. A função suporta anúncios Shopee e monta o endereço canônico com os IDs cadastrados.

O parser aceita imagens de nós estruturados que correspondam ao item e loja ou à identidade/título do produto JSON-LD, recusando identidade canônica divergente. Não executa JavaScript do anúncio. IDs Int64 são preservados. Downloads de imagem aceitam apenas HTTPS nos CDNs aprovados, com validação de redirecionamentos, assinatura PNG/JPEG/WebP e limite de 5 MB por foto, 12 fotos e 40 MB de bytes no servidor.

As fotos importadas ficam no Storage privado existente, sob `<usuário>/inputs/gallery-<produto>-<sha256>.<extensão>`. Cache e importações concorrentes conferem o conteúdo por hash sem sobrescrever arquivos. A interface verifica novamente usuário, produto e formato do caminho antes de baixar. Há coalescência de pedidos do mesmo produto e espera de 20 segundos por usuário por instância; não é um limitador distribuído.

Não houve alteração de esquema, políticas ou Secrets. A função não gera vídeo, não inicia GPU e não chama modelos pagos. O aviso preexistente de proteção contra senhas vazadas permanece; as tabelas internas sem políticas de cliente continuam privadas por desenho.

## Validações

- 235 testes locais aprovados: correspondência de produto, recomendações/variantes, duplicatas, Int64, bloqueios, redirecionamentos, limites, autenticação e filtro de texto.
- Chromium com OCR real: foto técnica limpa selecionada, tabela de medidas e descrição longa desmarcadas; revisão manual, duplicata, cancelamento e largura de 390 px aprovados. Nenhum erro JavaScript ou pedido a CDN de OCR/API de geração.
- Interface de importação testada com sessão e respostas controladas: três fotos, filtro, título correto, rejeição de caminho de outra conta e aviso de apenas capa. Isso não é uma coleta autenticada bem-sucedida de galeria real da Shopee.
- Função publicada e requisição remota sem sessão recusada com HTTP401.
- TypeScript frontend/Edge e lint sem erros novos. Build repetido fora do sandbox após a falha ambiental conhecida de captura `--showConfig`.

**Limites:** OCR pode falhar em texto pequeno, estilizado ou ilegível e não certifica que a foto pertence à mesma cor/variante. Diagramas sem texto podem passar. O filtro é uma sugestão revisável. A galeria completa depende da fonte; no anúncio real consultado ela não foi exposta no HTML. A extração completa e o upload com conta normal ainda precisam de validação remota.

Fontes técnicas: [Tesseract.js, instalação local](https://github.com/naptha/tesseract.js/blob/master/docs/local-installation.md), [API OCR](https://github.com/naptha/tesseract.js/blob/master/docs/api.md). A consulta do catálogo implementada pode ser conferida em `supabase/functions/marketplace/_shared/shopee.ts`.

## Publicação

Backend `product-gallery` v2 publicado. Frontend no Worker existente `meu-vendedor`, versão `d1f3092b-9dbd-489b-b8d7-1a677c35b509`, preservando bindings, variáveis e os dois crons. URL: https://meu-vendedor.httpsgithubcomwarllemedicaosunshine-budget-guidegit.workers.dev/videos .

OCR real repetido no site público: foto limpa selecionada, especificação e descrição longa desmarcadas, correção manual, descarte de duplicata e cancelamento aprovados. Nenhum erro JavaScript ou chamada a CDN de OCR/provedor de geração; sem overflow horizontal em 390 px. Esse ensaio usa imagens técnicas locais; não demonstra extração de uma galeria comercial completa.


## Retorno de 10/11/2026 — link no pop-up e galeria pelo anúncio

O responsável pediu o botão de gerar link imediatamente abaixo de Seu link de divulgação no primeiro passo do pop-up, preenchendo a caixa, e perguntou se consultar o link do produto recuperaria mais fotos.

- Botão **Gerar meu link de divulgação** adicionado no primeiro passo para produto Shopee da própria conexão. Chama `marketplace`/`generate_link`, preenche o campo e mantém o salvamento existente em Meus links. Falhas preservam o link anterior, sem afirmar sucesso. A geração externa na ficha continua disponível.
- A coleta já usa o endereço canônico do anúncio com os IDs do produto, além da capa armazenada no catálogo. Não era uma leitura exclusivamente da imagem de API. A resposta agora informa o endereço canônico e o seletor oferece **Abrir anúncio na Shopee** também no pop-up, ao lado da busca das fotos. A opção de selecionar/analisar fotos do dispositivo permanece.
- Corrigida a mensagem quando só a capa é recuperada: não atribui ao lojista uma ausência de fotos. Explica que a galeria não foi lida neste acesso e que o anúncio pode conter outras imagens.
- Validação real adicional: dois anúncios públicos consultados em Chromium normal inicialmente renderizaram sem galeria. Um deles foi acompanhado por mais 15 segundos até terminar o carregamento e levou a `shopee.com.br/verify/traffic/error`, mostrando Página indisponível e pedindo login. Não foram usados cookies de conta, login, stealth ou resolução de desafios. Não há evidência de galeria completa importada nesta rodada, e não se prometeu desbloqueá-la.
- Evidência sanitizada: `tests/results/2026-11-10-gallery-source-live.json`. Esse resultado não prova que todos os anúncios bloqueiam a leitura ou que a Shopee tenha apenas uma foto por produto.
- Sete testes de galeria aprovados, frontend/Edge TypeScript, lint pertinente e build de 17 rotas aprovados. Navegador com sessão/API simuladas verificou botão imediatamente abaixo do campo, preenchimento automático, abertura do pop-up sem gerar link fora, acesso ao anúncio e mobile sem overflow. Não foi gerado um link real nesse teste. Evidência: `tests/results/2026-11-10-link-gallery-browser.json`.
- Supabase `product-gallery` v3. Nenhuma mudança de esquema ou Secrets, sem inferência/GPU e sem postagem.

Frontend desta correção: Cloudflare `c3582268-a693-4897-9ca6-317ddf96568c`.
