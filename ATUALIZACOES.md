# Atualizações — Meu Vendedor

## 07/11/2026 — 1min.ai e diagnóstico Kaggle

- 1min.ai / Seedance integrado ao seletor, capacidades, inventário e processamento assíncrono até o Storage privado; mensagens de saldo insuficiente e proteção contra reenvio incerto.
- Automático tenta 1min.ai, Magic Hour, Google e Replicate. Seleção explícita preservada; nenhum conector novo se torna bloqueio global para os anteriores.
- Chave 1min.ai aceita. Teste real recusado pelo fornecedor: 1.632.960 créditos exigidos / 280.000 disponíveis. **Não há MP4 1min.ai validado nesta entrega.**
- Kaggle confirmou cota de 30h e executou notebook privado de GPU com sucesso. **Wan e lip sync continuam pendentes**; Kaggle não está habilitado no fallback de usuários.
- Migração `20261107050118_onemin_video_provider.sql` aplicada e reconciliada com o histórico remoto. RLS e privilégios internos preservados.
- Supabase publicado: `video-generation` **v48**, `video-generation-worker` **v31**, `kaggle-pilot` **v2**. Diagnóstico temporário encerrado com HTTP 410.
- Suite completa: **200 testes aprovados**; após ajuste final, **27 testes focados aprovados**. Lint, TypeScript frontend/Edge e build estático das 17 rotas verificados. Não foi feita nova validação visual em Chromium nesta entrega.

Cloudflare publicado na versão `d7a1db16-9e83-4c66-a12d-ec2512ec9179`, com os crons de vídeo e marketplace preservados. As alterações desta entrega serão versionadas em `main`. Detalhes e pendências em [ONEMIN_E_KAGGLE.md](./ONEMIN_E_KAGGLE.md). Arquitetura consolidada em [ARQUITETURA.md](./ARQUITETURA.md).
