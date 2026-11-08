# Imagens de produtos sincronizados no vídeo — 07/11/2026

## Estado vigente — 08/11/2026: foto falante com produto

Carla e Rafael têm referências fotográficas realistas, plus size, próprias e selecionáveis. Os quatro perfis ficam em `mv_presenter_profiles`, com identidade, arquivo/hash e voz fixa Google. Quatro bases foram validadas com MP4s reais de 10–13 segundos e habilitadas para o formato **foto falante + cartão com a imagem enviada do produto**, em 720×1280.

O botão principal usa o fluxo Google TTS/MuseTalk. Histórico privado, cancelamento cooperativo, renovação de acesso e recuperação sem reenviar a GPU foram implementados. Corpo, roupa e cenário permanecem os da base; não há geração nativa 4K, sessão persistente de modelos ou garantia de 15 vídeos/dia.

Estado consolidado, validações, publicação e limites: [ENTREGA_VIDEO_COM_PRODUTO.md](./ENTREGA_VIDEO_COM_PRODUTO.md). **Este bloco prevalece sobre os registros históricos abaixo**, inclusive referências antigas a bases desabilitadas ou geração Kaggle ainda não implementada.

## Falha confirmada

Selecionar um produto da lista preenchia nome, preço, link e `imageUrl`, deixando `productImage` e `imageStoragePath` vazios. A prévia exibia a imagem externa, mas a validação e o preparo do vídeo só consideravam arquivo manual ou caminho privado. O responsável identificou que baixar a mesma foto e reenviá-la permitia prosseguir.

## Correção

- O estúdio reconhece foto de produto sincronizado como entrada disponível e informa que ela será preparada automaticamente ao gerar.
- A ação autenticada `import-product-image` recebe apenas `productId`. O backend consulta a imagem em `mv_products` filtrando pelo ID do usuário autenticado e do produto, sem aceitar URL ou proprietário enviados pelo cliente.
- A foto é carregada pelo servidor a partir dos CDNs Shopee suportados, sem depender de CORS do navegador. URLs arbitrárias e redirecionamentos fora desses CDNs são recusados.
- O conteúdo é limitado a 10 MB e verificado como JPEG, PNG ou WebP pelos bytes. A cópia fica no bucket privado `mv-video-assets`, em `userId/inputs/product-productId-hash.ext`.
- Nome derivado do produto/conteúdo permite reutilização sem sobrescrever. Importações concorrentes verificam os bytes existentes.
- A geração usa essa cópia para preparar a referência reduzida pelo mesmo fluxo já usado no envio manual. Não foi alterado o worker de vídeo nem os provedores.
- Trocar de produto limpa prévias/cache anteriores; uma importação que termina depois da troca não substitui a imagem do novo produto. Fotos enviadas manualmente continuam tendo prioridade.
- Produtos sem imagem, origem indisponível e falha de armazenamento retornam mensagens específicas, sem tratar uma prévia como arquivo já preparado.

A importação atual atende aos produtos Shopee sincronizados em `mv_products`; outras plataformas exigem definição dos seus CDNs quando seus conectores forem disponibilizados. Não foi criada nova tabela ou migração.

## Validação

186 testes Node aprovados, incluindo oito casos novos de importação, autenticação, propriedade do produto, limites, formato, redirecionamento e concorrência. TypeScript frontend/Edge e lint aprovados. Uma foto real sincronizada foi baixada pelo mesmo módulo: JPEG de 209.628 bytes, sem inferência ou consumo de créditos de IA.

Chromium em 1440×900 e 390×844 selecionou um produto da lista, reconheceu a imagem preenchida, importou-a pela ação autenticada simulada, decodificou os bytes JPEG reais, preparou as referências e registrou um único pedido mesmo com clique duplo. O campo de envio manual permaneceu vazio. Sessão, Storage e fila de interface eram simulados; nenhum vídeo real novo foi enviado.

Função `video-generation` publicada na versão 45, mantendo a verificação JWT e a autenticação por usuário. Frontend publicado na versão Cloudflare `ef952e64-9d8f-47a3-96ac-26579c3fd8a5`; fluxo automático conferido na URL publicada em desktop/celular com fila simulada.
