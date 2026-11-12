# Assistente de divulgação — 10/11/2026

> **12/11/2026 — Produtos e ChatGPT manual:** lojas unificadas em Produtos, sem entradas individuais no menu; briefing e prompt externo com rascunho preservado. Nenhuma OpenAI API. Estado, publicação e limites em [HISTORICO.md](./HISTORICO.md). Este registro prevalece sobre a navegação histórica abaixo.

## Pedido e comportamento

O responsável pediu remover a mensagem informativa do catálogo, organizar a criação em pop-up por partes, analisar a foto com IA para narrar benefícios e, após aprovação do vídeo, preparar link, legenda, hashtags e compartilhar. Perguntou se a postagem poderia ir à loja/vitrine Shopee.

- Removido o aviso “Produtos para divulgar na Shopee / Atualização automática…”, que era informativo, sem representar erro. Os erros reais continuam sendo exibidos.
- Criado diálogo modal com quatro etapas: Produto e roteiro → Criar vídeo → Narração e aprovação → Compartilhar. Gerar link na ficha abre o diálogo mantendo o endereço. Voltar e fechar preservam o trabalho no editor enquanto a ficha estiver aberta.
- A primeira etapa permite analisar a foto original ou uma foto enviada para a área privada da conta. A IA recebe bytes da imagem e título/detalhes como dados, preparando descrição, benefícios sustentados, fala, legenda, hashtags e prompts em português e inglês. É necessário revisar e aprovar o roteiro; a análise pode errar termos ou propriedades. Alterar a foto invalida o roteiro anterior.
- Nova função `campaign-content` valida sessão com Auth, seleciona produto por usuário, valida caminho privado e formato real da imagem, limita bytes/entrada e não aceita URL arbitrária do cliente. Usa importador existente de fotos Shopee com hosts permitidos. Nenhuma chave sai do backend.
- Rotas de visão: OpenRouter gratuito com teto de preço zero → Groq `qwen/qwen3.8-27b` → Gemini `gemini-3.8-flash`. Se falharem, a interface informa erro e permite edição manual; não afirma que uma sugestão só de texto analisou a foto.
- Na etapa de vídeo, montagem interna com fotos/clipes e geração/importação externa pelo Flow. O pop-up não faz geração automática de personagem no Flow nem inicia GPU.
- Narração usa a integração Google TTS já existente, com voz selecionável, finalidade comercial e limites/idempotência do backend de áudio. O navegador combina o vídeo com a voz e entrega arquivo novo. Para imagem importada, cria vídeo vertical e aplica a voz. A fala não é cortada: mantém o último quadro se o áudio for mais longo. Usuário pode declarar que o vídeo importado já tem narração e preservar seu áudio original.
- A fala/voz alteradas invalidam o resultado correspondente. O compartilhamento exige aprovação do vídeo e link válido. A aprovação guarda o último rascunho local da conta, com Blob, legenda, hashtags e link, retomável em Publicações.
- A etapa final já vem preenchida com título/legenda, hashtags específicas e link, com botão principal “Compartilhar vídeo, legenda e link”. Web Share depende do navegador e aplicativo receptor. Download/cópia continuam disponíveis; não se marca conteúdo como postado apenas por compartilhar.

## Shopee Vídeo, vitrine e loja

Fontes oficiais consultadas em 10/11/2026:

- [Conheça a Shopee Video](https://help.shopee.com.br/portal/10/article/164977-Conhe%C3%A7a-a-Shopee-Video): o produto deve ser adicionado/vinculado ao vídeo no momento da publicação. Link na legenda ou comentários não substitui esse vínculo para atribuição do Shopee Vídeo.
- [Vitrine do Afiliado](https://help.shopee.com.br/portal/10/article/124390-Conhe%C3%A7a-a-ferramenta-Minha-Cole%C3%A7%C3%A3o): adicionar produtos à vitrine é ação própria, com seleção de produtos ou importação por link.

A integração Affiliate Open API instalada consulta ofertas e gera links. Não foi confirmada operação autorizada para postar Shopee Vídeo ou adicionar à vitrine automaticamente nesta conta. O aplicativo prepara o material e o compartilhamento; o vínculo do produto e a conclusão da postagem/vitrine são feitos na Shopee. Não se deve prometer que o vídeo será inserido automaticamente numa loja de vendedor, nem equiparar loja de vendedor a vitrine de afiliado. Foi enviada pergunta de esclarecimento sobre qual delas o responsável utiliza; sem resposta até o registro, o fluxo preserva o contexto de afiliado já existente.

## Verificações e limites

- Teste real de visão: foto de power bank do catálogo enviada ao modelo Groq e resultado estruturado recebido. Foto conferida visualmente. O rascunho incluiu termos que exigem revisão (“retrátil” e “sobrecarregado”); não foi aprovado automaticamente como anúncio final. Evidência em `tests/results/2026-11-10-campaign-vision-live.json`.
- Gemini respondeu HTTP402, saldo pré-pago esgotado. Não houve compra de créditos. A rota gratuita OpenRouter não entregou resultado utilizável na validação; a rota Groq foi confirmada.
- Navegador com conta/visão/TTS simulados: quatro etapas, abertura ao gerar link, montagem real de imagem para vídeo, composição real com áudio sintético, um stream de áudio no MP4 exportado, aprovação, rascunho, texto completo, compartilhamento simulado e layout desktop/celular sem overflow. Evidência em `tests/results/2026-11-10-wizard-browser.json`. Não é teste de síntese TTS real ou postagem Shopee.
- Endpoint de análise rejeitou anônimo com HTTP401. Diagnóstico temporário encerrado e HTTP410 confirmado. Nenhum vídeo/post foi enviado a terceiros e nenhuma GPU foi iniciada.
- 246 testes aprovados, build de 17 rotas, tipos frontend/Edge e lint pertinente sem erros. Cloudflare `132378e4-5e85-442f-8667-d6aa4a0f939e`; Supabase `campaign-content` v2. Página inicial consultada por HTTP e novo bundle confirmado.
