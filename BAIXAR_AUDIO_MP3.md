# Ferramenta Baixar áudio MP3

## O que foi adicionado

Foi criada a página **Baixar áudio MP3** em `/baixar-audio` e adicionada ao menu principal. Ela recebe um link direto HTTPS, baixa o conteúdo no navegador e salva o arquivo como `audio.mp3`.

## Como usar

1. Abra **Baixar áudio MP3** no menu.
2. Cole o endereço direto de um arquivo `.mp3` público, ou de um endpoint que retorne `Content-Type: audio/mpeg`.
3. Confirme que tem autorização para baixar e usar o arquivo.
4. Clique em **Baixar audio.mp3** para buscar e validar o arquivo.
5. Quando estiver pronto, clique em **Salvar audio.mp3** para iniciar o download.

O arquivo não é enviado ao backend nem armazenado pelo Meu Vendedor. O download é feito com `fetch` no navegador, verificado por tipo de conteúdo e assinatura MP3 e limitado a 50 MB.

## Estratégia e limites

- **Acesso direto, não extração de páginas:** a ferramenta não interpreta links de YouTube, Spotify, redes sociais ou páginas de streaming, não contorna DRM, paywalls ou controles de acesso, e não converte outros formatos para MP3.
- **CORS:** por ser uma aplicação web, o site que hospeda o arquivo precisa autorizar a leitura pelo navegador via CORS. Se o servidor não permitir, a ferramenta informa que não conseguiu acessar; ela não usa proxy nem tenta contornar a restrição.
- **HTTPS:** são aceitos somente links HTTPS sem usuário/senha embutidos.
- **Permissão:** use somente arquivos que você criou, tem licença para baixar ou cuja licença/termos permitam o download. A confirmação na interface não substitui essa responsabilidade.
- **Sem serviços ou custos externos:** a implementação usa APIs nativas do navegador; não foram adicionados pacotes, serviços de terceiros ou chamadas ao servidor do projeto.

## Pesquisa e referências

A abordagem escolhida segue o modelo de leitura cross-origin do navegador: `fetch()` só consegue ler recursos de outra origem quando o servidor autoriza CORS. Um proxy backend poderia evitar essa limitação, mas também faria o servidor buscar URLs arbitrárias, exigindo controles adicionais de SSRF, limites de tráfego e regras de direitos; por isso, não foi adotado.

- MDN — [Cross-Origin Resource Sharing (CORS)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS)
- MDN — [`URL.createObjectURL()`](https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL_static) e [`URL.revokeObjectURL()`](https://developer.mozilla.org/en-US/docs/Web/API/URL/revokeObjectURL_static)
