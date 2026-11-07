# Personagens realistas e direção de prompts — 07/11/2026

## Modelos pesquisados

O caso principal do Meu Vendedor exige imagem-para-vídeo: preservar um personagem e um produto aprovados. Demonstrações texto-para-vídeo não comprovam fidelidade a essas referências. Nenhum dos modelos abaixo foi instalado ou executado no Kaggle nesta revisão; as recomendações são candidatos a benchmark, não resultados medidos no projeto.

| Candidato | Papel | Requisitos e prioridade |
| --- | --- | --- |
| HunyuanVideo 1.5 I2V | Animação de imagem com foco em continuidade visual | Primeiro candidato a piloto: documentação informa mínimo de 14GB com offload. Esse mínimo não comprova compatibilidade de kernels, memória de CPU ou velocidade na T4 do Kaggle; começar com a variante I2V 480p. |
| Wan 2.2 TI2V-5B | Texto/imagem para vídeo | Candidato para comparação de identidade, mãos e produto. A configuração oficial informa ao menos 24GB; não declarar que roda diretamente em uma T4. Quantização/offload adicionais exigem testes. Duas T4 não somam VRAM automaticamente para uma única execução. |
| LTX-2 / família 2.5 | Vídeo e áudio, com variantes de referência | Candidato quando áudio sincronizado for prioridade. Pipelines de qualidade maior exigem mais memória e tempo. Não equiparar os requisitos da API Magic Hour aos do modelo executado localmente. |
| MuseTalk 1.5 | Sincronização labial sobre vídeo e áudio já existentes | Complemento ao gerador, não substituto da animação do corpo/produto. Avaliar rosto, dentes e boca em português; a documentação de velocidade usa V100, não comprova velocidade em T4. |

Fontes primárias:

- [HunyuanVideo 1.5: requisitos, I2V e reescrita de prompts](https://github.com/Tencent-Hunyuan/HunyuanVideo-1.5).
- [Wan 2.2: TI2V-5B, requisitos e expansão de prompt](https://github.com/Wan-Video/Wan2.2).
- [LTX: pipelines e direção de prompt](https://github.com/Lightricks/LTX-2).
- [MuseTalk 1.5: áudio para sincronização labial](https://github.com/TMElyralab/MuseTalk).

## O papel do prompt

Prompt é essencial, mas não garante perfeição. Qualidade depende também da imagem inicial, capacidade do modelo, resolução, inferência e fidelidade temporal. Um modelo sem suporte a áudio não ganha fala por receber uma instrução de áudio.

O projeto possui duas coisas diferentes: sugestão de roteiro publicitário via OpenRouter/Groq/Gemini, e direção visual montada pelo worker. A qualidade do roteiro textual não comprova análise visual das fotos. Nesta revisão a direção visual foi estruturada em código; **não foi adicionada uma nova chamada multimodal para analisar as referências**.

Para evolução do diretor automático, priorizar um modelo com visão que receba as imagens reais e produza uma estrutura validada: fatos visíveis, identidade a preservar, enquadramento, iluminação, ação viável, movimento, câmera, cenário e fala exata. Gemini é um candidato com a chave já existente; o próprio Hunyuan recomenda Gemini ou modelos via vLLM para reescrita. OpenRouter/Groq atuais continuam opções para roteiro/revisão textual, sem assumir visão ou disponibilidade de um modelo novo. O compilador deve adaptar idioma, parâmetros e áudio ao gerador efetivamente escolhido.

## Correções aplicadas agora

- O worker anterior distinguia somente Ana dos demais: Carla, Rafael e Lucas recebiam a descrição de um homem esguio. A nova composição prioriza a identidade da foto do apresentador, sem inventar atributos pelo nome e sem impor o mesmo corpo a personagens diferentes.
- Direção centralizada em `visual-direction.ts`, separando quadro inicial e movimento. A imagem descreve textura de pele, cabelo e tecido, perspectiva, foco, luz e sombras coerentes, produto visível e mãos em posição simples.
- O vídeo preserva cenário e iluminação do quadro aprovado, em vez de mandar substituir o fundo novamente durante a animação. Usa um plano com câmera fixa e uma ação pequena compatível com seis segundos.
- Vestuário orienta caimento; apresentação mantém o produto estável; demonstração não inventa resultados de funcionamento. O modo de movimento distingue postura quase estática de movimento contínuo discreto.
- IDs de perfil de voz e emoção foram convertidos em instruções legíveis. Narração externa pede que o personagem não articule palavras.
- A fala aprovada não é mais cortada em 800 caracteres. Quando a direção completa excede os 2.000 caracteres aceitos pelo adaptador mais restritivo, a tarefa encerra com `video_prompt_too_long` antes de enviar a geração de vídeo e a interface orienta encurtar o roteiro. A etapa de imagem pode já ter ocorrido; não se declara rejeição anterior a todo consumo.
- A composição respeita o limite de 2.048 caracteres do FLUX, incluindo o escape JSON; resumos de metadados são reduzidos para caber, preservando referências e direção visual.
- A alteração do prompt altera a chave de cache das novas composições. Imagens já persistidas em tarefas em andamento continuam preservadas; nenhum pedido foi reenviado nesta revisão.

## Como validar a qualidade

Comparar os candidatos usando a mesma imagem aprovada, ação simples e duração. Manter configurações e sementes registradas dentro de cada modelo, sem assumir equivalência de sementes entre modelos. Avaliar identidade, pele, mãos, produto, continuidade, movimento, fala, tempo e memória. Começar com uma entrega de imagem-para-vídeo; adicionar voz/lip sync após validar a animação. Nenhuma melhoria visual é declarada como comprovada antes da avaliação do MP4.
