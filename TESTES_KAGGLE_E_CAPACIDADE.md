# Testes Kaggle e capacidade — 07/11/2026

> Atualização posterior: o checkpoint destilado produziu um MP4 novo de dois segundos. As medições abaixo são o histórico do primeiro benchmark. Resultados posteriores em [TESTE_HUNYUAN_DESTILADO.md](./TESTE_HUNYUAN_DESTILADO.md).

## Escopo e evidência

Testes privados com a conta já autorizada, sem compra de créditos. Scripts reproduzíveis em `executors/kaggle/`; cálculos em `scripts/calculate-video-capacity.mjs`. As tentativas ficam registradas em `mv_ai_provider_audits` com prefixo `kaggle-benchmark-20261107`. Resultados de uma configuração não representam todas as bibliotecas de vídeo.

## Ampliação 4K: aprovada

Foi utilizado um MP4 Magic Hour já concluído. Esse teste mede pós-processamento e entrega, não geração pelo Kaggle.

| Medição | Resultado |
|---|---:|
| Entrada | 480 × 854; 24 fps; 6,04 s; 833.153 bytes |
| Saída H.264 | 2160 × 3840; 24 fps; 6,02 s; 14.741.478 bytes |
| Ampliação Lanczos + codificação | 40,773 s |
| Execução completa do script | 46,612 s |
| Transferência e verificação no Supabase | 1,991 s |
| Hardware | 4 CPUs; GPU não solicitada |

O upload privado foi relido e conferido por tamanho e SHA-256: `4ef1f2c7c46661408aff3962a2e5fa940e816530f47cc770e0f04decd0b60b43`. A inspeção de quadros confirmou preservação do conteúdo e da marca d'água original. A ampliação não recupera detalhes reais ausentes na origem e não equivale a geração nativa 4K.

Nesse arquivo, o tamanho cresceu 17,69 vezes; a quantidade de pixels cresceu 20,23 vezes. Isso não permite inferir proporcionalidade de tempo de inferência. Mantido esse tamanho por arquivo, 105 vídeos ocupariam aproximadamente 1,55 GB; 450 vídeos, 6,63 GB, além do tráfego de entrega. Quinze ampliações por dia consumiriam cerca de 10,2 minutos de CPU apenas nessa etapa, excluindo preparação e transferência.

## Geração HunyuanVideo 1.5 I2V

Modelo: `hunyuanvideo-community/HunyuanVideo-1.5-Diffusers-480p_i2v`, revisão `5a700ee883ff4c1b3d887ec4188755a7a5e2f698`. Pesos consultados: 54.224.260.124 bytes. Ambiente medido: duas Tesla T4, cada uma com 15.636.037.632 bytes de VRAM, e 33.658.159.104 bytes de RAM. Duas GPUs não formam automaticamente um único bloco de memória para o pipeline.

- Tentativa inicial: conflito de dependências; nenhuma inferência. Compatibilidade corrigida no script seguinte.
- Tentativa FP16: instalação em 21,286 s e download em 250,934 s. O processo foi encerrado com `Killed` durante o carregamento, por volta de 504 s. O registro não confirma a causa exata; pressão de RAM é uma hipótese. Nenhum MP4 produzido.
- Tentativa NF4 (4 bits): download em 246,995 s; carregamento concluído em 223,785 s. Na chamada de geração ocorreu `OutOfMemoryError`: solicitação de 3,45 GiB com somente 2,87 GiB livres na GPU 0 (14,56 GiB totais). A tentativa terminou em 565,953 s, sem MP4. Quantização e offload por modelo não bastaram nessa configuração.

Sem uma inferência concluída, não existe medição válida de vídeos por hora nem validação do realismo do personagem, consistência do produto, movimento ou sincronização labial. Um prompt em inglês bem estruturado ajuda a direção; não resolve insuficiência de recursos nem garante qualidade sozinho.

## Capacidade: contas condicionais

A API da conta confirmou 108.000 segundos (30 horas) semanais de GPU. Para 15 vídeos/dia são necessários 105 vídeos/semana. O orçamento seria de **17 min 9 s por vídeo**, incluindo a preparação amortizada e as falhas. Reservando 20% da cota, cai para **13 min 43 s por vídeo**. Esses limites são requisitos, não tempos obtidos pelo modelo.

| Tempo hipotético por vídeo | Vídeos/semana com 20% de reserva |
|---|---:|
| 5 min | 288 |
| 10 min | 144 |
| 15 min | 96 |
| 20 min | 72 |
| 30 min | 48 |
| 60 min | 24 |

A tabela ignora preparação e falhas adicionais. O calculador permite introduzir preparação por sessão, limite de duração e taxa de sucesso para uma projeção mais conservadora. Não multiplicar a cota por quantidade de GPUs sem comprovação da contabilização do fornecedor.

## 1min.ai e custo

O pedido real anterior exigiu 1.632.960 créditos e encontrou 280.000 disponíveis: faltaram 1.352.960. Isso comprova saldo insuficiente para aquele pedido, não créditos fictícios nem impossibilidade de qualquer outro modelo. Não houve MP4 validado pelo 1min.ai.

Os testes não fizeram compra de créditos. GPU gratuita continua tendo cota; armazenamento, tráfego e infraestrutura devem ser contabilizados conforme o plano contratado. Não foi calculado preço em reais sem contrato e tarifa efetivos.

## Validação do projeto

Suíte completa: 208 testes aprovados, incluindo três testes de capacidade com preparação por sessão, margem, sucesso e entradas inválidas. Lint, TypeScript Edge e compilação sintática dos scripts Python aprovados. Estes scripts não habilitam Kaggle no fluxo de geração dos lojistas.

## Cota efetivamente consumida e conclusão

Cota antes: 13,869 s usados. Depois dos testes: 1.129,563 s usados, zero reservado, limite de 108.000 s. Consumo adicional medido: **1.115,694 s (18 min 35,7 s)**. Saldo observado: **106.870,437 s (29 h 41 min 10,4 s)**. Próxima renovação informada: 14/11/2026 às 00:00 UTC. O consumo é o retornado pela API, sem multiplicação pelo número de GPUs.

**Resposta final: a ampliação para 4K e a entrega no Supabase foram comprovadas; HunyuanVideo 1.5 nessa configuração Kaggle não foi validado como gerador de produção.** Não existe ainda base medida para prometer 15 vídeos realistas por dia, geração nativa 4K ou apresentador falando. Outros modelos, distribuição entre GPUs e offload por blocos exigem experimentos próprios; não foram aprovados por extrapolação destes resultados.

A estratégia sustentada pela evidência é gerar na resolução que o modelo suportar, avaliar identidade/produto/movimento, e ampliar somente o resultado aprovado. O prompt deve preservar a referência e descrever cena, iluminação, câmera e uma ação plausível; sua qualidade não substitui a validação do motor. Não há justificativa para trocar agora o motor funcional por este executor experimental.

Os dois endpoints temporários foram substituídos por HTTP 410 ao concluir as medições; artefatos e auditorias permanecem privados. Nenhum novo gerador foi habilitado para os usuários.
