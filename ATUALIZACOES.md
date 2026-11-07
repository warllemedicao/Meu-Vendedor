# Atualizações — Meu Vendedor

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
