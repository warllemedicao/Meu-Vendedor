# Atualizações — Meu Vendedor

## Estado vigente — 08/11/2026: fluxo Google + MuseTalk

A arquitetura sincronizada foi implementada e publicada como piloto: base aprovada no Supabase → voz fixa Google → MuseTalk 1.5/Kaggle T4 → FFmpeg → MP4 privado. Dois MP4s reais foram concluídos: três segundos em 152,378 s de notebook; 8,496 s de fala em 127,829 s de notebook e 135 s entre registro da tarefa e entrega. Inferência/codificação silenciosa: 7,829 s e 21,279 s; pico de 6,54 GiB. Boca/rosto ainda precisam de ajuste visual; bases permanecem sem aprovação para anúncios. Não há garantia de 15 vídeos/dia nem de 4K. Novas gerações não acionam provedores com créditos do fluxo antigo.

Estado completo, limites e continuidade: [ARQUITETURA_VIDEO_SINCRONIZADO.md](./ARQUITETURA_VIDEO_SINCRONIZADO.md). Os registros anteriores abaixo são históricos.

## 07/11/2026 — Google Chirp 3 HD substitui ElevenLabs

- Credenciais Google TTS cadastradas pelo responsável e validadas; catálogo real com 30 vozes pt-BR. Vozes fixas Ana/Aoede, Carla/Kore, Rafael/Charon e Lucas/Puck.
- Quatro MP3s reais decodificados, com 5,256–6,408 s de duração e 1,933–2,658 s por pedido com arquivamento técnico. Idempotência e isolamento entre contas confirmados. Contas temporárias removidas e diagnóstico encerrado com 410.
- Limite mensal global do aplicativo em 900.000 caracteres, com reserva atômica e persistente; 287 caracteres no teste. Não cobre uso externo do projeto Google nem garante faturamento total zero.
- Narração, vozes, histórico e exportação opcional no estúdio usam Google. Kaggle/MuseTalk automático **continua pendente**, sem novo vídeo ou consumo de GPU nesta entrega.
- Supabase áudio v13, vídeo v53, worker v37; migração `20261107233234_google_tts_budget.sql` aplicada. Cloudflare `8b342aae-1ead-4fa7-aec0-24720ad68d2e`, mantendo crons e Secrets.
- 214 testes na suíte completa; cinco focados após correção final de JSON nulo. Lint, TypeScript frontend/Edge e build estático aprovados. Chromium desktop/celular com respostas controladas verificou o seletor e ausência de overflow. Evidência completa em [GOOGLE_TTS.md](./GOOGLE_TTS.md).

## 07/11/2026 — primeiro vídeo Hunyuan no Kaggle

- Checkpoint 480p I2V step-distilled gerou MP4 novo de dois segundos, 480×848, 24 fps e 232.825 bytes em 558,729 s incluindo codificação. NF4 e offload por componente; prompt inteiro de 94 tokens.
- MP4 decodificado, quadros inspecionados e upload privado relido por SHA-256. Escrita pequena do produto varia; fala/lip sync não validados.
- Seis segundos falhou por VRAM. Comparação FP16 por blocos teve ajustes de hooks e foi interrompida a pedido do usuário antes de concluir outro MP4, para preservar o uso do ChatGPT. Kaggle segue fora do fallback.
- Notebook temporário interrompido removido; diagnósticos desativados. Saldo Kaggle observado: 28h55min. Scripts, relatórios e instruções de retomada em [TESTE_HUNYUAN_DESTILADO.md](./TESTE_HUNYUAN_DESTILADO.md).

## 07/11/2026 — testes reais Kaggle e capacidade

- Ampliação CPU para 2160×3840 validada em 40,773 s; MP4 de 14,74 MB enviado ao Storage privado e conferido por SHA-256. É ampliação de vídeo Magic Hour existente, não geração nativa 4K.
- HunyuanVideo 1.5: primeira configuração falhou em dependências; FP16 foi encerrado durante carga; NF4 carregou e falhou na geração por falta de VRAM. Nenhum MP4 novo do modelo. Kaggle permanece fora do fallback.
- API confirmou 30h semanais; testes consumiram mais 18 min 35,7 s. Meta de 15 vídeos/dia exigiria até 13 min 43 s por vídeo com reserva de 20%, ainda sem throughput comprovado.
- Scripts, relatórios e calculador adicionados; 208 testes aprovados, lint e TypeScript Edge aprovados. Diagnósticos temporários encerrados com HTTP 410. Relatório completo: [TESTES_KAGGLE_E_CAPACIDADE.md](./TESTES_KAGGLE_E_CAPACIDADE.md).

## 07/11/2026 — identidade e direção visual

- Pesquisa de modelos para personagem realista: HunyuanVideo 1.5 I2V, Wan 2.2, família LTX e MuseTalk; requisitos e limites em [QUALIDADE_VISUAL_E_PROMPTS.md](./QUALIDADE_VISUAL_E_PROMPTS.md). Nenhum novo modelo foi executado.
- Corrigida a identidade no prompt de Carla/Rafael/Lucas; referência fotográfica tem prioridade. Composição e animação recebem direções separadas e coerentes, preservando ambiente e produto.
- Perfil de voz/emoção traduzidos em instruções; fala aprovada não é cortada silenciosamente. Direção excessiva retorna erro claro antes da submissão de vídeo.
- Nenhum novo pedido de geração de teste iniciado nesta revisão. Qualidade visual ainda depende da próxima avaliação real. Suíte completa com 204 testes aprovados; após ajuste do limite FLUX, cinco testes focados aprovados. Lint, TypeScript frontend/Edge e build estático aprovados. Supabase `video-generation-worker` v32 e Cloudflare `5cf22553-5ede-4f77-b07f-fc925fb2c02d` publicados; autenticação e crons preservados.

## 07/11/2026 — 1min.ai e diagnóstico Kaggle

- 1min.ai / Seedance integrado ao seletor, capacidades, inventário e processamento assíncrono até o Storage privado; mensagens de saldo insuficiente e proteção contra reenvio incerto.
- Automático tenta 1min.ai, Magic Hour, Google e Replicate. Seleção explícita preservada; nenhum conector novo se torna bloqueio global para os anteriores.
- Chave 1min.ai aceita. Teste real recusado pelo fornecedor: 1.632.960 créditos exigidos / 280.000 disponíveis. **Não há MP4 1min.ai validado nesta entrega.**
- Kaggle confirmou cota de 30h e executou notebook privado de GPU com sucesso. **Wan e lip sync continuam pendentes**; Kaggle não está habilitado no fallback de usuários.
- Migração `20261107050118_onemin_video_provider.sql` aplicada e reconciliada com o histórico remoto. RLS e privilégios internos preservados.
- Supabase publicado: `video-generation` **v48**, `video-generation-worker` **v31**, `kaggle-pilot` **v2**. Diagnóstico temporário encerrado com HTTP 410.
- Suite completa: **200 testes aprovados**; após ajuste final, **27 testes focados aprovados**. Lint, TypeScript frontend/Edge e build estático das 17 rotas verificados. Não foi feita nova validação visual em Chromium nesta entrega.

Cloudflare publicado na versão `d7a1db16-9e83-4c66-a12d-ec2512ec9179`, com os crons de vídeo e marketplace preservados. As alterações desta entrega serão versionadas em `main`. Detalhes e pendências em [ONEMIN_E_KAGGLE.md](./ONEMIN_E_KAGGLE.md). Arquitetura consolidada em [ARQUITETURA.md](./ARQUITETURA.md).
