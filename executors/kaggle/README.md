# Benchmarks privados no Kaggle

## Estado vigente — 08/11/2026: fluxo Google + MuseTalk

A arquitetura sincronizada foi implementada e publicada como piloto: base aprovada no Supabase → voz fixa Google → MuseTalk 1.5/Kaggle T4 → FFmpeg → MP4 privado. Dois MP4s reais foram concluídos: três segundos em 152,378 s de notebook; 8,496 s de fala em 127,829 s de notebook e 135 s entre registro da tarefa e entrega. Inferência/codificação silenciosa: 7,829 s e 21,279 s; pico de 6,54 GiB. Boca/rosto ainda precisam de ajuste visual; bases permanecem sem aprovação para anúncios. Não há garantia de 15 vídeos/dia nem de 4K. Novas gerações não acionam provedores com créditos do fluxo antigo.

Estado completo, limites e continuidade: [ARQUITETURA_VIDEO_SINCRONIZADO.md](../../ARQUITETURA_VIDEO_SINCRONIZADO.md). Os registros anteriores abaixo são históricos.

Scripts de teste, separados da geração dos usuários. Não são um servidor persistente nem utilizam túneis.

- `benchmark.py`: tentativa de imagem-para-vídeo HunyuanVideo 1.5, com modelo e dependências fixados, medições por etapa, duas sementes para execução inicial/quente e limite externo de sessão.
- `distilled_benchmark.py`: checkpoint 480p I2V step-distilled, 12 passos e VAE em blocos. O padrão é o modo `model`, NF4 no gerador e texto, contexto de 256 tokens, apenas 49 quadros: configuração que produziu MP4 de dois segundos. O teste de 145 quadros exige `attempt_six_seconds="yes"` e orçamento de sessão; seis segundos ainda não foram validados. Modo `hybrid` (gerador FP16 por blocos, texto quantizado) continua experimental e foi interrompido antes de produzir MP4. O modo de blocos com todo o NF4 falhou. Não gera áudio; não tratar os modos experimentais como aprovados.
- `upscale_benchmark.py`: ampliação Lanczos de um vídeo já concluído para 2160×3840, sem GPU. Não representa geração nativa 4K nem recuperação de detalhes reais.
- `../../scripts/calculate-video-capacity.mjs`: projeções com tempo de preparação por sessão, tempo por vídeo, margem de cota, duração máxima e taxa de sucesso. Cenários hipotéticos têm identificação explícita.

Configuração de lançamento é injetada no notebook privado em `BENCHMARK_CONFIG`. Inclui uma URL temporária para a referência e um callback com segredo descartável limitado ao teste. Nenhum token Kaggle, chave Supabase administrativa ou segredo de fornecedor é enviado ao notebook. Não inserir a configuração concreta no Git.

O controlador temporário utiliza a API oficial Kaggle e os Secrets existentes no Supabase. Lançamentos possuem claim no banco para impedir duplicação. O endpoint de teste é substituído por HTTP 410 depois das medições; os arquivos permanecem privados. O resultado 4K é verificado por tamanho e SHA-256 após upload e leitura do Storage.

Resultados medidos e limitações devem ser registrados no relatório da execução. Um MP4 ampliado não comprova inferência do modelo, qualidade de personagem ou sincronização labial. Falha de instalação não deve ser contabilizada como renderização. Mudança de dependência/modelo/configuração deve gerar nova tentativa identificada.
