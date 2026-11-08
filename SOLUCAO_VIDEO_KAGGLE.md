# Caminho para vídeo no Kaggle — pesquisa de 07/11/2026

## Estado vigente — 08/11/2026: fluxo Google + MuseTalk

A arquitetura sincronizada foi implementada e publicada como piloto: base aprovada no Supabase → voz fixa Google → MuseTalk 1.5/Kaggle T4 → FFmpeg → MP4 privado. Dois MP4s reais foram concluídos: três segundos em 152,378 s de notebook; 8,496 s de fala em 127,829 s de notebook e 135 s entre registro da tarefa e entrega. Inferência/codificação silenciosa: 7,829 s e 21,279 s; pico de 6,54 GiB. Boca/rosto ainda precisam de ajuste visual; bases permanecem sem aprovação para anúncios. Não há garantia de 15 vídeos/dia nem de 4K. Novas gerações não acionam provedores com créditos do fluxo antigo.

Estado completo, limites e continuidade: [ARQUITETURA_VIDEO_SINCRONIZADO.md](./ARQUITETURA_VIDEO_SINCRONIZADO.md). Os registros anteriores abaixo são históricos.

## Conclusão

Priorizar um piloto Hunyuan 1.5 com atenção econômica em memória compatível com T4 e comparar com LTX-Video 2B 0.9.8 destilado. São caminhos técnicos, ainda sem novo benchmark. Nenhuma equivalência de qualidade, latência ou capacidade comercial foi demonstrada por esta pesquisa. Nenhum notebook iniciado, saldo consumido ou serviço de produção alterado nesta revisão.

## Evidência local

- `executors/kaggle/results/2026-11-07-hunyuan-step-model.json`: duas T4, aproximadamente 14,56 GiB por GPU; geração usou GPU 0.
- 49 quadros, 12 passos, 480×848: vídeo final de dois segundos em 558,729 s, além da preparação.
- 145 quadros: falha de VRAM na atenção, solicitação adicional de 3,36 GiB com 2,98 GiB livres.
- A pilha de erro não comprova qual kernel SDPA foi efetivamente selecionado. Investigar backend antes de atribuir a causa a atenção matemática.
- A tentativa híbrida R3 é inconclusiva; registrou apenas cerca de 2,75 GiB de RAM disponível no último relatório. Não repetir esse modo sem controlar RAM e offload.

## Primeiro caminho: preservar Hunyuan e corrigir a execução

1. Fixar versões compatíveis com T4/SM75 e executar diagnóstico pequeno de atenção com o mesmo dtype, dimensão de cabeça e máscara do modelo.
2. Identificar o kernel real. Comparar SDPA eficiente, xFormers e SageAttention 1 quando suportados pela operação; não presumir compatibilidade apenas pelo nome da biblioteca.
3. Usar FP16 no cálculo na T4. Não copiar presets BF16, FP8, FlashAttention 2 ou SageAttention 2 destinados a gerações posteriores de GPU.
4. Manter a configuração NF4 por componente que já produziu vídeo. Comparar 12 e 8 passos com a mesma referência e quantidade de quadros. Menos passos reduz trabalho de inferência; não garante diminuir o pico de memória de uma operação.
5. Só após o diagnóstico, aumentar a duração em estágios. Se necessário, comparar 384×672 a 480×848, medindo perda de detalhe. Resolução reduzida é configuração experimental, não preset de qualidade aprovado.
6. Codificar texto e imagem, descarregar encoders e liberar referências que não serão mais usadas. Medir GPU e RAM por fase; não apenas memória após a falha.
7. Aproveitar a segunda GPU somente com distribuição explícita suportada pelo pipeline. Duas T4 não são uma GPU de 32 GB. Medir custo de transferência antes de escolher paralelismo.
8. Reutilizar instalação/pesos e pipeline carregado entre pedidos dentro da mesma sessão; encerrar a sessão quando não houver trabalho. Sessão ociosa também pode consumir cota.

O código oficial rejeita combinar step-distillation e cache de inferência. Não somar essas otimizações indiscriminadamente.

## Alternativa prioritária: LTX-Video 2B 0.9.8 destilado

O fabricante descreve a variante como adequada a geração rápida e menor uso de VRAM. Aceita condicionamento por imagem. É candidata a teste no hardware, sem comprovação de qualidade equivalente ao Hunyuan para nossos rostos e produtos.

- Usar a imagem inicial aprovada do teste Hunyuan para comparação.
- Adaptar o cálculo a FP16 e verificar estabilidade numérica: a configuração oficial usa BF16 e não deve ser copiada sem ajuste para T4.
- Respeitar o scheduler destilado oficial; o YAML 0.9.8 é multiescala, com duas passagens. Não substituí-lo por uma quantidade arbitrária de passos.
- Primeiro medir geração base; medir refinamento/ampliação separadamente.
- Não confundir LTX-Video 2B 0.9.x com LTX-2/2.5 ou com o serviço Magic Hour. São execuções distintas.
- Confirmar a licença do arquivo/checkpoint escolhido antes de habilitar anúncios; disponibilidade para download não basta.

WanGP é um executor alternativo com suporte a Hunyuan e LTXV, processamento sem interface e configurações para GPUs antigas. Deve ser avaliado como alternativa à implementação de hooks própria, sem presumir ganho medido na T4.

## Critérios de aprovação

- MP4 vertical completo com duração pretendida, sem falta de memória.
- Comparação de rosto, mãos, roupa, letras e forma do produto contra a referência.
- Registrar preparação, inferência, codificação, pico GPU/RAM e falhas separadamente.
- Meta anterior: 105 vídeos/semana em 30h, com 20% de reserva, permite média total de aproximadamente 13min43s por vídeo; preparação amortizada e falhas entram nessa média. A cota disponível atual precisa ser consultada antes do piloto.
- Animação silenciosa não aprova apresentador falando. Voz em português e lip sync são fases adicionais que também precisam caber no orçamento. Não reativar ou integrar automaticamente na fila de usuários.

## Fontes primárias consultadas

- Hunyuan e variantes destiladas: https://github.com/Tencent-Hunyuan/HunyuanVideo-1.5
- Restrição de cache + destilação: https://github.com/Tencent-Hunyuan/HunyuanVideo-1.5/blob/main/generate.py
- Backends Diffusers: https://huggingface.co/docs/diffusers/optimization/attention_backends
- FlashAttention e limitações Turing/BF16: https://github.com/Dao-AILab/flash-attention
- xFormers: https://github.com/facebookresearch/xformers
- WanGP, instalação por geração de GPU e CLI: https://github.com/deepbeepmeep/Wan2GP
- LTX-Video 2B: https://github.com/Lightricks/LTX-Video
- Scheduler/preset 0.9.8: https://github.com/Lightricks/LTX-Video/blob/main/configs/ltxv-2b-0.9.8-distilled.yaml
- Wan 2.2: https://github.com/Wan-Video/Wan2.2 (TI2V-5B oficial exige 24GB no exemplo; não é a primeira aposta para uma T4).
