# Imagens de produtos sincronizados no vídeo — 07/11/2026

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
