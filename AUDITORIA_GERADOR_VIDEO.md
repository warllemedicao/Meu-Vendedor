# Auditoria do gerador — 08/11/2026

## Conclusão e restrição vigente

**O objetivo visual ainda não foi validado. Não reiniciar os testes de geração.** O responsável pediu apenas correções e registro em `historico.md`. Esta revisão não chama inferência de imagem, vídeo ou voz, não submete notebook e não aloca GPU. Verificações de software não comprovam fidelidade visual.

O erro anterior foi usar uma camiseta de exemplo FASHN no lugar da foto do anúncio. Não foi falta de um Secret. As avaliações anteriores de roupa válida/aprovada estão revogadas. Histórico: [historico.md](./historico.md).

## Entradas efetivamente identificadas

- Oferta: **Camisa II Flamengo & Shopee 2026**, Shopee, anúncio `https://shopee.com.br/product/1467914390/56269351386`.
- Imagem original: `https://cf.shopee.com.br/file/br-11134207-820lk-mv387fqpgs8zac`.
- Dois registros da mesma oferta, em duas contas, com uma única imagem/link. O aplicativo filtra pelo usuário autenticado; não escolher globalmente o primeiro ID.
- Download para inspeção: JPEG 532×532, SHA-256 `73ccd4990382d1e0efb4ca768ec79afa8f948e502e5aff0687f32d6a286465e7`. Cópia local ignorada pelo Git: `artifacts/motion/flamengo-anuncio-original.jpg`.
- Conferência visual: camisa preta no cabide, gola V vermelha/preta, punhos vermelhos e emblema vermelho. A foto contém cenário; não foi recortada ou transformada nesta auditoria. Não inventar escudos, patrocinadores ou detalhes ausentes.
- Carla cadastrada: asset `6c2b638e-eb97-4d23-a159-69aacfa65511`, Storage `operator/hybrid-assets/carla-v2.webp`, aprovado para o formato antigo de foto falante/cartão. Objeto privado presente, WebP de 131.826 bytes.
- Arquivo local `public/presenters/carla-v2.webp`: SHA-256 `acf2757d16f9f3c724dc731250a83390eeab2901c2884455ecbf94ed0dbb40f9`, igual ao perfil cadastrado. Foto frontal, plus size e meio corpo. Isso não constitui aprovação de atuação, roupa nova ou pernas geradas.
- A nova conferência calcula o hash do arquivo remoto efetivamente utilizado; não presume igualdade apenas pelo nome do objeto.

## Secrets: presença não é execução nem saldo

Nomes listados no projeto `jzchlrvxdaffnrgbvabv`; valores não expostos. Código remoto `motion-generation` v11 e `audio-generation` v13 inspecionado antes das correções. Um Secret só participa quando a função o lê e chama sua API. Referência oficial: https://supabase.com/docs/guides/functions/secrets.

| Secret ou grupo presente | Uso observado | Necessidade para este fluxo |
| --- | --- | --- |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Sessão, banco, arquivos privados e URLs temporárias | Necessários no backend; chave administrativa nunca vai ao navegador/notebook |
| `KAGGLE_API_TOKEN` | Submissão privada e cota de GPU em `motion-generation`/`hybrid-video` | Necessário para executar FASHN/SCAIL/VACE/Wan; não usado para escolher a camisa |
| `GOOGLE_TTS_PROJECT_ID`, `GOOGLE_TTS_SERVICE_ACCOUNT_JSON` | Voz Google em `audio-generation` | Necessários no modo de voz; o modo de movimento continua sem áudio |
| `GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY` | Roteiro opcional no fluxo antigo, sujeito às regras de gratuidade | Não são chamados para vestir a peça, conferir visualmente roupa ou animar no Kaggle |
| `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_AI_API_TOKEN` | Integração antiga de imagem | Não necessários para FASHN/SCAIL/VACE; não resolvem a escolha incorreta do produto |
| `CLOUDFLARE_BILLING_READ_TOKEN` | Consulta de faturamento | Não gera vídeo nem valida fidelidade |
| `MAGIC_HOUR_API_KEY`, `ONEMIN_API_KEY` | Adaptadores anteriores de vídeo | Não chamados pelo novo executor; não ativar fallback por crédito |
| `RUNWAYML_API_SECRET` | Credencial catalogada, sem adaptador de vídeo integrado | Não participa da geração atual |
| `HUGGINGFACE_TOKEN` | Credencial catalogada | Os pesos públicos deste executor são baixados sem esse Secret; ausência de uso não é o erro da camisa |
| `MODAL_TOKEN_ID`, `MODAL_TOKEN_SECRET` | Infraestrutura separada/anterior | Não participam do notebook de movimento |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | OAuth/integrações Google | Não necessários para vestir roupa ou animar |
| `SHOPEE_APP_ID`, `SHOPEE_SENHA`, `MV_CREDENTIAL_ENCRYPTION_KEY` | Integração de loja/credenciais | Auxiliam sincronização do catálogo; a imagem é importada pela oferta da conta |
| `MV_SYNC_JOB_TOKEN`, `MV_VIDEO_WORKER_SECRET` | Agendamentos e processador anterior | Não substituem o token Kaggle nem os modelos de roupa |
| `SUPABASE_DB_URL`, `SUPABASE_JWKS`, `SUPABASE_PUBLISHABLE_KEYS`, `SUPABASE_SECRET_KEYS` | Ambiente/plataforma | Não são modelos de geração |

`REPLICATE_API_TOKEN` e Secrets ElevenLabs não constam da listagem atual. Não são necessários ao caminho novo. Não foram feitas chamadas pagas, consultas de saldo nem testes de credenciais de cada fornecedor nesta revisão; a presença do nome não comprova validade ou franquia.

Cloudflare hospeda a interface e o Worker de rotas/agendamentos. Secrets encontrados no Worker: `MV_FLOW_EXECUTOR_SECRET`, `MV_SUPABASE_PUBLISHABLE_KEY`, `MV_SYNC_JOB_TOKEN`, `MV_VIDEO_WORKER_SECRET`. Não é o executor dos modelos de movimento; estes rodam no Kaggle e recebem capacidades temporárias dos próprios arquivos.

## Correções desta revisão

1. **Conferência antes de gerar:** ação `inspect-inputs` autenticada valida caminhos/conta/asset, calcula SHA-256 e devolve prévias da foto exata do produto, da base cadastrada e da referência enviada. Não cria job ou chama Kaggle.
2. **Pedido vinculado aos arquivos:** `generate` exige os hashes conferidos e compara com o conteúdo atual. Mudança de imagem invalida a conferência. O executor verifica novamente os arquivos recebidos antes dos modelos.
3. **Referência vestida compatível:** resultado FASHN só pode alimentar uma animação quando é da mesma conta, está concluído e corresponde ao mesmo asset e hash do produto. Resultados antigos sem rastreabilidade não são aceitos automaticamente.
4. **Produto registrado também na animação:** a foto do produto deixa de ser exclusiva da etapa FASHN. Nos outros motores ela fica no pedido como origem auditável; isso não significa que SCAIL receba automaticamente um condicionamento separado de produto.
5. **Origem de catálogo:** quando há `sourceProductId`, o backend consulta a oferta da conta e exige o caminho produzido pelo importador daquele produto. Upload manual continua explicitamente distinto.
6. **Revisão visual explícita:** o botão de geração exige confirmação das imagens. Trocar produto, personagem, referência ou opções invalida a revisão anterior; uma resposta assíncrona de uma seleção antiga é descartada.
7. **Wan desabilitado:** o piloto falhou durante amostragem e a configuração posterior não foi validada. O backend recusa novas chamadas Wan; a interface começa pela etapa de roupa.
8. **Inventário Kaggle:** corrigido de ferramenta sem integração para etapa de vídeo integrada. O indicador não certifica qualidade do resultado.
9. **Diagnóstico encerrado:** conta técnica removida, artefatos preservados na auditoria e `motion-qa` substituída por resposta HTTP 410 sem acesso administrativo nem capacidade de criar tarefas.
10. **Documentação corrigida:** rejeição da camiseta de exemplo, resultado SCAIL concluído mas não aprovado e instrução de não reiniciar ensaios registrados no histórico e continuidade.

Arquivos de código desta revisão: `src/components/videos/MotionVideo.tsx`, `VideoStudio.tsx`, `src/lib/motion-video.ts`, `supabase/functions/motion-generation/index.ts`, `_shared/contracts.ts`, `executors/kaggle/motion_runner.py`, bundle `_shared/runner.ts`, `video-generation/_shared/provider-inventory.ts` e `tests/motion-video.test.mjs`. Sem nova migração: os dados de rastreabilidade ficam no JSON de entrada já existente. O bloco de contrato foi coberto por verificações locais de software, sem renderização.

## Limites que continuam pendentes

- FASHN usa um adaptador direto do modelo, com processamento próprio para foto de peça isolada. Não é o pipeline completo oficial com parser. O anúncio no cabide ainda não foi testado; não há promessa de fidelidade de emblema ou caimento.
- A confirmação visual impede avanço inadvertido no fluxo normal, mas não prova automaticamente identidade ou exatidão da roupa. Comparação visual continua obrigatória numa futura execução autorizada.
- Corpo inteiro, verso da peça, calça e ângulos ocultos não estão demonstrados por esta foto de meio corpo.
- A voz Google/MuseTalk e a animação corporal são caminhos separados. Ainda não existe entrega validada que combine fala sincronizada, atuação e camisa fiel em movimento.
- SCAIL entregou 2 s em 18min11s no ensaio anterior; não há garantia de velocidade, 4K, cota ilimitada ou produtividade diária. Esse vídeo utilizou a roupa de exemplo rejeitada e não foi aprovado.
- A consulta de logs Kaggle recusou `kernels.get` na rodada anterior; o executor usa callbacks. Nenhum acesso adicional foi solicitado.
- O aviso Supabase de proteção contra senhas vazadas permanece uma pendência independente. As tabelas internas sem políticas de cliente são intencionais e não explicam o erro da camisa.

## Fluxo para uma futura execução, somente após nova instrução

1. Selecionar a oferta da conta e importar a foto original, sem substituição por exemplo.
2. Conferir produto, Carla cadastrada e referência que será enviada, com seus hashes.
3. Executar apenas a etapa de vestir, se novamente autorizada; comparar rosto/biotipo, gola, mangas, emblema, cores e proporções. Reprovar se qualquer detalhe essencial não corresponder.
4. Só usar uma imagem vestida revisada do mesmo produto/personagem como referência de movimento. Conferir o vídeo-base e eventual máscara quadro a quadro.
5. Conferir o vídeo completo, identidade e detalhes da peça durante o movimento; depois tratar áudio e exportação. Arquivo entregue não é aprovação de qualidade.

Publicação e verificações finais constam no registro de encerramento abaixo. Não realizar ensaio de GPU para preencher esta seção.

## Encerramento da revisão

- Publicado Cloudflare: `e383d328-4bfe-4cca-bf06-fe4a7042863e`; ambos os crons preservados.
- Supabase: `motion-generation` v12; `motion-qa` v12 responde 410. A única alteração em `video-generation` v56 e `video-generation-worker` v40 foi o indicador de integração Kaggle no inventário; demais arquivos e configurações dessas funções foram preservados.
- 225 verificações locais de software aprovadas. TypeScript frontend e Edge, lint e build estático de 17 rotas aprovados. A primeira checagem TypeScript concorrente com o build encontrou arquivos gerados temporariamente ausentes; a checagem sequencial após o build passou. O primeiro teste de isolamento foi atualizado para fornecer também o produto da segunda conta, e a suíte completa passou na repetição corrigida.
- Consulta final: zero tarefas ativas de movimento e zero híbridas. Conta técnica removida. Nenhuma nova renderização, síntese de voz, submissão Kaggle ou chamada de inferência nesta revisão.
- Não foi feita inspeção em navegador nem validação visual de uma nova roupa/vídeo. O comportamento de fidelidade permanece pendente por instrução do responsável.
- Alterações salvas no workspace; sem commit ou push nesta revisão.
