# Vídeo de produto — 10/11/2026

> **12/11/2026 — Produtos e ChatGPT manual:** lojas unificadas em Produtos, sem entradas individuais no menu; briefing e prompt externo com rascunho preservado. Nenhuma OpenAI API. Estado, publicação e limites em [HISTORICO.md](./HISTORICO.md). Este registro prevalece sobre a navegação histórica abaixo.

> **Melhoria posterior:** seleção de fotos do anúncio com detecção local de texto, sugestões de exclusão de especificações/descrições e remoção de duplicatas. A busca de galeria depende da disponibilidade da origem e informa quando só há capa. Ver [GALERIA_DE_PRODUTO.md](./GALERIA_DE_PRODUTO.md).

## Entrega

O estúdio `/videos` abre por padrão em **Vídeo de produto**. O modo Personagens fica em aba separada, identificado como experimental; não é iniciado ao abrir o modo de produto. O responsável pediu priorizar o uso do aplicativo enquanto a atuação de personagens fica para evolução posterior.

Fluxo: adicionar fotos ou clipes → ordenar cenas → escolher formato, tempo e transição → revisar prévia → gerar → baixar e, com login, salvar na conta.

- Até oito cenas, de dois a cinco segundos por cena (máximo de 40 segundos).
- Fotos JPG/PNG/WebP até 10 MB; vídeos MP4/WebM/MOV até 50 MB, decodificáveis pelo navegador, com até dois minutos de origem. Limite combinado de 150 MB. A montagem aproveita trechos iniciais; mantém o último quadro se o clipe terminar antes da cena.
- Formatos vertical 720×1280, quadrado 720×720 e horizontal 1280×720.
- Transições suaves, deslizamento e corte; aproximação opcional nas fotos.
- Título, preço/destaque e chamada final opcionais. Enquadramento preserva a proporção da imagem.
- Importação da foto de um produto da própria conta usa a função autenticada existente `video-generation`.
- Prévia, cancelamento, reprodução e download do resultado. Exportação sem áudio, em MP4 quando suportado, com alternativa WebM. Manter a aba visível durante a exportação; mudança para segundo plano interrompe com mensagem e permite repetir.
- Geração e download funcionam sem login. Entrar antes de montar permite salvar o resultado na biblioteca privada; não há salvamento automático de um rascunho local ao navegar para login.

## Papel do Supabase e das ferramentas existentes

Conector autenticado confirmou `video-generation` v56, worker v40, `audio-generation` v13, `hybrid-video` v8 e `motion-generation` v12. Foram inspecionados os fontes remotos de geração, áudio e movimento. Isso confirma implantação/contratos; não comprova saldo ou validade de cada credencial de fornecedor.

Google TTS produz narração; MuseTalk anima fala sobre uma base; FASHN prepara roupa; SCAIL/VACE/Wan pertencem ao fluxo experimental de movimento. As evidências anteriores não demonstram mãos e ângulos de qualquer objeto com fidelidade. Não foram reativados ensaios ou consultadas inferências para esta entrega.

A montagem nova usa Canvas/MediaRecorder no navegador, sem chamar modelos de IA, Kaggle ou APIs de geração. Não consome créditos de inferência. O salvamento utiliza o bucket existente `mv-video-assets`, privado, aceitando MP4/WebM até 100 MB, em `<usuário>/product-videos/<nome>--<uuid>.<extensão>`.

Não houve migração, alteração de políticas, Secrets ou Edge Functions. RLS existente limita leitura, inclusão, alteração e exclusão à pasta do usuário autenticado. A biblioteca consulta os 20 resultados mais recentes desse diretório; links de reprodução expiram em cinco minutos e são renovados ao abrir novamente. Um upload incerto é conferido por tamanho e SHA-256 antes de ser considerado salvo, sem criar cópia duplicada. Falha de salvamento preserva o resultado para baixar e tentar salvar novamente.

## Verificações e limites

- 228 testes locais aprovados, TypeScript frontend/Edge e build estático aprovados; lint sem erros, com quatro avisos preexistentes nos controladores experimentais.
- Chromium exportou MP4 real de 4,0052 s, 720×1280, com duas imagens técnicas de controle. Testados também clipe como entrada, saída quadrada, prévia, download, cancelamento e repetição, sem erro JavaScript. Layout conferido em 1440×1000 e 390×844, sem overflow horizontal.
- Biblioteca testada no Chromium com sessão/respostas controladas: falha de upload preserva download, nova tentativa funciona, listagem sobrevive ao recarregamento e reprodução privada abre; nenhuma chamada a provedor de IA.
- Banco remoto: inserção e leitura pelo proprietário e invisibilidade para outra identidade verificadas sob papel `authenticated`, dentro de transações revertidas. Nenhum arquivo real ou usuário técnico foi criado por esse teste.
- **Limite de validação:** upload/download HTTP real no Storage com conta técnica não foi executado. O token de gerenciamento do terminal retornou HTTP401; o conector autenticado continua disponível. O teste controlado de interface não substitui esse ensaio remoto.
- Testes de navegador foram feitos no Chromium, não em aparelho físico ou Safari. Formatos e codecs dependem do navegador; não há garantia universal de MP4 em todos os dispositivos.

Ângulos diferentes exigem fotos reais desses lados. Mostrar mãos exige clipe já gravado. Aproximação/transição de uma foto não é rotação 3D ou demonstração física gerada. Narração, som dos clipes e criação de ângulos/mãos por IA não fazem parte desta montagem. A suspensão dos testes de personagens permanece em vigor.

Documentação consultada: [upload Supabase](https://supabase.com/docs/reference/javascript/storage-from-upload), [listagem Supabase](https://supabase.com/docs/reference/javascript/storage-from-list), [MediaRecorder e formatos](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/isTypeSupported_static), [Canvas captureStream](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/captureStream).

## Publicação

Publicado no Worker existente `meu-vendedor`, versão `b284e71c-b8af-42bd-af98-49fabad658b2`, preservando bindings, variáveis e os dois crons. URL: https://meu-vendedor.httpsgithubcomwarllemedicaosunshine-budget-guidegit.workers.dev/videos .

Verificação repetida na URL pública com Chromium: MP4 real de 4,007233 s em 720×1280, download, cancelamento, entrada de clipe e saída quadrada aprovados; nenhum erro JavaScript e nenhum overflow horizontal na largura de 390 px. Esse teste de exportação pública não usou respostas simuladas. O teste de biblioteca continua sendo o controlado descrito acima.
