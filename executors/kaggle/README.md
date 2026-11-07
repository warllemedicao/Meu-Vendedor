# Benchmarks privados no Kaggle

Scripts de teste, separados da geração dos usuários. Não são um servidor persistente nem utilizam túneis.

- `benchmark.py`: tentativa de imagem-para-vídeo HunyuanVideo 1.5, com modelo e dependências fixados, medições por etapa, duas sementes para execução inicial/quente e limite externo de sessão.
- `upscale_benchmark.py`: ampliação Lanczos de um vídeo já concluído para 2160×3840, sem GPU. Não representa geração nativa 4K nem recuperação de detalhes reais.
- `../../scripts/calculate-video-capacity.mjs`: projeções com tempo de preparação por sessão, tempo por vídeo, margem de cota, duração máxima e taxa de sucesso. Cenários hipotéticos têm identificação explícita.

Configuração de lançamento é injetada no notebook privado em `BENCHMARK_CONFIG`. Inclui uma URL temporária para a referência e um callback com segredo descartável limitado ao teste. Nenhum token Kaggle, chave Supabase administrativa ou segredo de fornecedor é enviado ao notebook. Não inserir a configuração concreta no Git.

O controlador temporário utiliza a API oficial Kaggle e os Secrets existentes no Supabase. Lançamentos possuem claim no banco para impedir duplicação. O endpoint de teste é substituído por HTTP 410 depois das medições; os arquivos permanecem privados. O resultado 4K é verificado por tamanho e SHA-256 após upload e leitura do Storage.

Resultados medidos e limitações devem ser registrados no relatório da execução. Um MP4 ampliado não comprova inferência do modelo, qualidade de personagem ou sincronização labial. Falha de instalação não deve ser contabilizada como renderização. Mudança de dependência/modelo/configuração deve gerar nova tentativa identificada.
