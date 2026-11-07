# Hunyuan destilado no Kaggle — 07/11/2026

## Resultado já comprovado

O checkpoint `hunyuanvideo-community/HunyuanVideo-1.5-Diffusers-480p_i2v_step_distilled`, revisão `854c04a4c8a53d990b418c7478f0802c0fc8c726`, gerou um MP4 novo a partir da referência de um apresentador com produto. Isso é inferência real, distinta da ampliação de um vídeo Magic Hour medida anteriormente.

| Medição do vídeo curto | Resultado |
|---|---:|
| Quadros solicitados/gerados | 49 |
| MP4 final após corte | 48 quadros; 2,00 s; 24 fps |
| Resolução nativa dos quadros | 480 × 848 |
| Passos | 12 |
| Inferência e decodificação | 556,009 s |
| Inferência, decodificação e codificação | 558,729 s (9 min 18,7 s) |
| Instalação / download / carregamento | 23,775 / 182,037 / 150,071 s |
| Pico de memória alocada na GPU | 10.614.864.384 bytes |
| Arquivo final | 232.825 bytes; H.264; sem áudio |

Configuração bem-sucedida para esse vídeo: NF4 no gerador e no codificador de texto, FP16 no cálculo, offload por componente, VAE com tiling e slicing, contexto máximo de 256 tokens. O prompt em inglês tinha 94 tokens e não foi truncado. O scheduler do checkpoint usa shift 7 e guidance 1. A máquina disponibilizou duas T4; esta configuração executou a inferência na GPU 0, sem somar automaticamente a VRAM das duas placas.

O MP4 foi decodificado localmente por inteiro. Quadros em 0, 1 e 1,9 s foram inspecionados: rosto, roupa, fundo e composição próximos da referência, com pequeno movimento. A escrita pequena no produto se altera. Esta inspeção não comprova fidelidade comercial de marca, sincronização labial ou qualidade em todas as cenas. O teste usa o cenário da referência, sem validar a criação automática de cenários pelo diretor.

O arquivo foi enviado ao Storage privado e relido com tamanho e SHA-256 correspondentes: `079011758ce65ae8f7fe43d5fecca3691b6486525310329fd86d4c8a8e35bd98`. O vídeo técnico não foi inserido como job fictício na biblioteca dos lojistas.

## Comparação das tentativas

1. NF4 com offload por blocos no gerador e nos encoders: carregou em 136,495 s, mas falhou ao iniciar a geração com acesso CUDA inválido. Nenhum MP4 nessa tentativa.
2. NF4 com offload por componente e contexto de 256 tokens: produziu o vídeo curto acima. Na mesma sessão, a tentativa de 145 quadros para seis segundos falhou por VRAM na atenção do gerador: alocação de 3,36 GiB com 2,98 GiB livres. O sucesso do vídeo curto permanece válido mesmo com o status final `failed` da tentativa longa.
3. Gerador FP16 por blocos, somente texto em NF4: carregou os pesos, mas a instalação de hooks sequenciais do Accelerate falhou com `Params4bit.__new__() got an unexpected keyword argument '_is_hf_initialized'`. Nenhuma inferência nessa configuração inicial.
4. Primeira correção: o encoder quantizado passou a usar movimento por módulo e descarregamento após o forward. Carregou em 188,953 s, mas a inferência falhou no SigLIP com `Tensor on device meta is not on the expected device cuda:0!`, devido a pesos usados diretamente pela operação de atenção.
5. Segunda correção: movimento por módulo também no encoder de imagem, mantendo hooks de blocos no gerador FP16. Carregou em 142,508 s e entrou na geração curta, com pelo menos 45 s de inferência reportados sem erro. **Interrompida a pedido do usuário para preservar o limite de uso do ChatGPT, antes de produzir MP4.** Não é um sucesso validado nem uma falha de geração confirmada. O notebook temporário dessa tentativa foi removido; relatório e código foram preservados.

Os relatórios por tentativa ficam em `executors/kaggle/results/` e nas auditorias `kaggle-benchmark-20261107-hunyuan-step-*` do Supabase. O executor é `executors/kaggle/distilled_benchmark.py`; as configurações são experimentais e não são habilitadas automaticamente na produção.

## Interpretação de capacidade

O tempo de dois segundos não deve ser dividido ou multiplicado para prometer uma taxa de vídeos de seis segundos: atenção, memória, preparação e decodificação não escalam necessariamente de forma linear. O requisito anterior de 13 min 43 s por vídeo, para 105 vídeos semanais com 20% de reserva, permanece uma meta, não uma capacidade demonstrada por este MP4 curto.

O teste foi realizado em 480p, sem geração nem ampliação 4K. A ampliação separada de um MP4 existente já havia passado em CPU; ela não resolve o limite de memória durante a geração.

Fontes de configuração: [checkpoint destilado](https://huggingface.co/hunyuanvideo-community/HunyuanVideo-1.5-Diffusers-480p_i2v_step_distilled), [Hunyuan oficial](https://github.com/Tencent-Hunyuan/HunyuanVideo-1.5), [offload e memória](https://huggingface.co/docs/diffusers/optimization/memory).

## Encerramento e retomada

O usuário informou 4% restante de uso aqui. Não há acesso à porcentagem de uso da conta ChatGPT nem forma de aguardar com precisão o marco de 1%; por isso o teste foi encerrado e o relatório entregue sem depender desse marco. Os endpoints temporários foram desativados com HTTP 410. Nenhuma execução de teste foi deixada intencionalmente ativa. O MP4 de dois segundos permanece no Storage privado e localmente em `/tmp/meu-vendedor-benchmarks/generation/short_generation.mp4`.

Cota Kaggle observada após o encerramento: 3.887,604 s usados de 108.000 s, zero reservado. Saldo: aproximadamente **28 h 55 min 12 s**; renovação informada para 14/11/2026 às 00:00 UTC. Incremento desta rodada sobre os 1.129,563 s anteriores: **45 min 58 s**. Esse saldo não representa o limite de uso do ChatGPT.

Para retomar, partir da configuração de dois segundos comprovada ou realizar um novo experimento identificado no modo `hybrid`; não repetir as combinações de hooks que já falharam. Não reutilizar os gates ou URLs temporários desta execução. O script passa a executar somente o vídeo curto por padrão; seis segundos exigem opção explícita e têm uma estimativa conservadora para caber na sessão. Isso não é uma projeção de capacidade comercial.

Validação desta entrega: sintaxe dos três scripts Python aprovada; três testes do calculador aprovados; MP4 curto decodificado por inteiro e quadros inspecionados. A suíte de 208 testes passou na entrega anterior; não foi repetida para mudanças isoladas em scripts de benchmark e documentação.
