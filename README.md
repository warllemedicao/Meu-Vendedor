# Meu Vendedor — Viral Commerce AI

> **Fotos do anúncio — 10/11/2026:** busca de galeria quando disponível e análise local de fotos para retirar da seleção sugerida especificações, descrições longas e duplicatas. Revisão manual antes de adicionar às cenas; a loja pode disponibilizar apenas a foto principal. Detalhes em [GALERIA_DE_PRODUTO.md](./GALERIA_DE_PRODUTO.md).

> **Atualização de 10/11/2026:** `/videos` abre no modo **Vídeo de produto**, com fotos/clipes reais, transições, aproximação, prévia e exportação, sem personagem ou créditos de IA. Salvamento privado na conta pelo Storage existente. Personagens continuam em área experimental separada; testes de GPU não foram retomados. Entrega e limites em [VIDEO_DE_PRODUTO.md](./VIDEO_DE_PRODUTO.md).

> **Continuidade mais recente:** ensaio de 6 s encerrado a pedido do responsável; 4 s preservados para retomada, sem resultado novo de 6 s aprovado. Não iniciar GPU sem nova instrução. Ver [CONTINUAR_AMANHA.md](./CONTINUAR_AMANHA.md).

> **Atualização de 09/11/2026:** origem do vídeo Ana/vestido midi confirmada: FASHN → SCAIL-2 → áudio. Comparação posterior: Hunyuan entregou vídeo curto; Wan não chegou à inferência. Testes encerrados, controlador HTTP410 e cancelamentos remotos sem confirmação de término. Evidências em [TESTE_ANA_MIDI.md](./TESTE_ANA_MIDI.md).

> **Revisão vigente:** o responsável rejeitou a camiseta de exemplo e proibiu reiniciar os testes. Correções e limites em [AUDITORIA_GERADOR_VIDEO.md](./AUDITORIA_GERADOR_VIDEO.md); conversa e decisões em [historico.md](./historico.md). Nenhum resultado da camisa do anúncio foi aprovado.

Modo experimental de movimento, roupa e edição por máscara: [implementação e evidências](./MOVIMENTO_E_PRODUTO.md). A amostra FASHN usou o produto errado e foi rejeitada; os resultados técnicos não são aprovação visual. Os ensaios estão interrompidos.

## Estado vigente — 08/11/2026: foto falante com produto

Carla e Rafael têm referências fotográficas realistas, plus size, próprias e selecionáveis. Os quatro perfis ficam em `mv_presenter_profiles`, com identidade, arquivo/hash e voz fixa Google. Quatro bases foram validadas com MP4s reais de 10–13 segundos e habilitadas para o formato **foto falante + cartão com a imagem enviada do produto**, em 720×1280.

O botão principal usa o fluxo Google TTS/MuseTalk. Histórico privado, cancelamento cooperativo, renovação de acesso e recuperação sem reenviar a GPU foram implementados. Corpo, roupa e cenário permanecem os da base; não há geração nativa 4K, sessão persistente de modelos ou garantia de 15 vídeos/dia.

Estado consolidado, validações, publicação e limites: [ENTREGA_VIDEO_COM_PRODUTO.md](./ENTREGA_VIDEO_COM_PRODUTO.md). **Este bloco prevalece sobre os registros históricos abaixo**, inclusive referências antigas a bases desabilitadas ou geração Kaggle ainda não implementada.

Aplicativo de gerenciamento de afiliados e produção de vídeos. Frontend Next.js na Cloudflare; autenticação, banco, Storage privado e funções no Supabase.

## Histórico — piloto inicial Google + MuseTalk de 08/11/2026

A arquitetura sincronizada foi implementada e publicada como piloto: base aprovada no Supabase → voz fixa Google → MuseTalk 1.5/Kaggle T4 → FFmpeg → MP4 privado. Dois MP4s reais foram concluídos: três segundos em 152,378 s de notebook; 8,496 s de fala em 127,829 s de notebook e 135 s entre registro da tarefa e entrega. Inferência/codificação silenciosa: 7,829 s e 21,279 s; pico de 6,54 GiB. Boca/rosto ainda precisam de ajuste visual; bases permanecem sem aprovação para anúncios. Não há garantia de 15 vídeos/dia nem de 4K. Novas gerações não acionam provedores com créditos do fluxo antigo.

Estado completo, limites e continuidade: [ARQUITETURA_VIDEO_SINCRONIZADO.md](./ARQUITETURA_VIDEO_SINCRONIZADO.md). Os registros anteriores abaixo são históricos.

## Publicação e validação

Estado vigente em 08/11/2026: fluxo de foto falante com cartão de produto publicado; quatro apresentadores aprovados para esse formato. A entrega real, as verificações e os limites estão em [ENTREGA_VIDEO_COM_PRODUTO.md](./ENTREGA_VIDEO_COM_PRODUTO.md). Próxima revisão e correções estão em [CONTINUAR_AMANHA.md](./CONTINUAR_AMANHA.md).

Commit publicado em `main`: `91e553481c211af5fe3dcea88c29c00ab61331bf`. Cloudflare `627f251b-955c-4175-a065-f00bce5c26d4`; Supabase `hybrid-video` v8. Foram aprovados 219 testes, lint, TypeScript frontend/Edge e build estático das 17 rotas. As atualizações antigas abaixo são histórico e não substituem o estado vigente.

## Executar localmente

Requisitos: Node.js 24 e npm. Copie `.env.example` para `.env.local` e configure somente a URL e a chave pública do Supabase. Credenciais de serviços ficam no backend.

```bash
npm ci
npm run dev
```

```bash
npm test
npm run lint
npm run typecheck
npm run typecheck:edge
npm run build:pages
```

`build:pages` exporta para `out/`. A publicação usa Wrangler; commit/push não substituem o deploy. A falha ambiental de captura TypeScript `--showConfig` no sandbox e a validação fora dele estão registradas em [PUBLICACAO.md](./PUBLICACAO.md).

## Documentação

- [AJUSTES_ESTUDIO.md](./AJUSTES_ESTUDIO.md): botão, voz, Google e limites da validação.
- [GOOGLE_OAUTH_SETUP.md](./GOOGLE_OAUTH_SETUP.md) e [YOUTUBE_CONEXAO.md](./YOUTUBE_CONEXAO.md): configuração e autorização do canal.
- [ELEVENLABS.md](./ELEVENLABS.md): síntese, privacidade, exportação e licença.
- [VIDEOS_IA.md](./VIDEOS_IA.md), [CREDITOS_DA_CONTA.md](./CREDITOS_DA_CONTA.md): pipeline e política ativa de créditos.
- [SUPABASE.md](./SUPABASE.md), [CLOUDFLARE.md](./CLOUDFLARE.md), [ARQUITETURA.md](./ARQUITETURA.md): infraestrutura e histórico técnico.
- [CATALOGO_APIS.md](./CATALOGO_APIS.md), [CONECTORES.md](./CONECTORES.md), [INTEGRACOES.md](./INTEGRACOES.md), [ESCOPO.md](./ESCOPO.md): afiliados e escopo.

Nunca versionar `.env.local`, chaves privadas, tokens, cookies ou credenciais das lojas. RLS e autenticação de backend continuam obrigatórias. O runtime usa créditos das contas e pode consumir saldo/cobrança conforme o fornecedor; não promete gratuidade ilimitada.
