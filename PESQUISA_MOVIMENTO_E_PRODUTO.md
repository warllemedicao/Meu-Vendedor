# Movimento, roupa e interação com produto — pesquisa de 08/11/2026

Pesquisa documental solicitada pelo responsável. Este documento registra a fase de pesquisa; a implementação autorizada posterior está em MOVIMENTO_E_PRODUTO.md. Na fase de pesquisa, nenhum modelo foi instalado, GPU iniciada ou produção alterada. As recomendações são candidatos a teste, não capacidades demonstradas no Meu Vendedor.

## Conclusão e prioridade

Há ferramentas sem cobrança por geração para executar com pesos locais. Não foi encontrada uma solução demonstrada que garanta qualquer produto, interação fisicamente correta, fidelidade exata e execução contínua gratuita na T4. Software sem créditos continua exigindo computação e cota.

Prioridade proposta: Wan2.2-Animate quantizado com vídeo condutor; comparar SCAIL-2 GGUF. Para roupas, avaliar primeiro a imagem vestida com FASHN VTON 1.5 e somente depois animar. Para objetos, preservar um vídeo autorizado do próprio produto sempre que disponível, editando o apresentador com máscara em vez de regenerar o produto inteiro. Essa última estratégia é proposta técnica, não um resultado validado.

## Candidatos e evidências primárias

| Ferramenta | Papel e disponibilidade | Limite decisivo |
| --- | --- | --- |
| [Wan2.2-Animate](https://github.com/Wan-Video/Wan2.2) | Imagem do personagem e vídeo condutor; animação ou substituição por máscara; pesos disponíveis | Não é um provador de roupa nem garantia de identidade de produto. Base Apache-2.0; conferir componentes e variantes |
| [Workflow Kaggle/T4](https://github.com/kelvinweijun/wan-2.2-animate-comfyui-kaggle) | Autor disponibiliza notebooks e workflows GGUF Q3/Q6 para Kaggle, 2 T4 e RAM de 32 GB | Referência positiva de implantação, sem benchmark nosso. Inclui túneis/Gradio e dependências que não devem ser copiadas automaticamente para produção |
| [SCAIL-2](https://github.com/zai-org/SCAIL-2) | Transferência direta de vídeo, máscaras, substituição e múltiplas referências | Código Apache-2.0; cartão dos pesos MIT. Não confundir SCAIL-Preview com SCAIL-2 |
| [SCAIL-2 com pouca VRAM](https://github.com/dvelm/SCAIL-2-Unlimited-Video-Low-VRAM) | Autor declara execução em 8–12 GB com GGUF e segmentos | Relato externo, sem validação em nossa T4. Comprimento por segmentos não é cota ilimitada |
| [FASHN VTON 1.5](https://github.com/fashn-AI/fashn-vton-1.5) | Foto de pessoa + peça; camisa, calça, saia, vestido; código e pesos Apache-2.0 | Gera imagem. Parser auxiliar herda licença SegFormer; não declarar pipeline inteiro liberado para anúncios |
| [VACE](https://github.com/ali-vilab/VACE) | Referências, edição de vídeo e máscaras; variantes Wan 1.3B/14B Apache-2.0 | 1.3B é opção menor para ensaio; fidelidade a mão, marca e produto precisa ser medida |
| [Motion Mirror](https://github.com/halli75/motion-mirror) | Empacota VACE com extração de pose e execução local | Autor declara cerca de 9 GB para 1.3B e identidade mais fraca; variante rápida 1.3B usa pesos não comerciais |
| [AnchorCrafter](https://github.com/cangcz/AnchorCrafter/tree/master) | Referência humana e de objeto, controle HOI; código e links de pesos publicados | Checkpoint descrito como ajustado em cinco objetos de teste. Não prova generalização a qualquer anúncio. Licenças e disponibilidade dos arquivos precisam ser conferidas antes de executar |
| [OmniShow](https://github.com/Correr-Zhou/OmniShow) | Demonstra humano + produto + pose + áudio | README informa que checkpoints treinados não foram incluídos por política interna. Rodar Wan base não reproduz automaticamente a demonstração |
| [HOI-Swap](https://github.com/zihuixue/HOISwap) | Pesquisa direcionada à troca de objeto na mão | Pesos não liberados por restrições informadas pelos autores; código de treino/inferência por solicitação |
| [Re-HOLD](https://fyycs.github.io/Re-HOLD/) | Pesquisa em mãos, objeto, textura e contato | Página consultada demonstra o método, mas não forneceu caminho confirmado de pesos/instalação |
| [CatV2TON](https://github.com/Zheng-Chong/CatV2TON) | Try-on em imagem e vídeo; pesos e inferência | CC BY-NC-SA 4.0, inadequado como liberação automática para anúncios |
| [MusePose](https://github.com/TMElyralab/MusePose) | É o equivalente mais literal ao MuseTalk para pose corporal | Modelo para pesquisa não comercial; README informa 16 GB em 512×512×48 e limitações em rosto/roupa |
| [UniAnimate](https://github.com/ali-vilab/UniAnimate) | Corpo guiado por pose; autor informa aproximadamente 12 GB | Modelo explicitamente para pesquisa/uso não comercial |
| [JoyAI-Video-Edit](https://github.com/jd-opensource/JoyAI-Video-Edit) | Edição de vídeo com referência, pesos e código | Implantação em tempo real anunciada usa hardware superior, incluindo RTX 5090 32 GB. Não extrapolar para T4 |
| [OmniTryOn](https://github.com/xcltql666/OminTryOn) | Try-on em vídeo com múltiplos itens; aponta código/pesos | Documentação limitada; cartão de pesos consultado sem descrição. Não aprovado quanto a licença, RAM ou T4 |

## Roupas: detalhe técnico e licença auxiliar

O cartão [FASHN](https://huggingface.co/fashn-ai/fashn-vton-1.5) informa aproximadamente 8 GB de VRAM, saída 576×864 e possíveis alterações do biotipo/resíduos da roupa anterior. O README converte pesos para FP32 em hardware anterior a Ampere: a estimativa não deve ser presumida para T4. Carla e Rafael exigem revisão explícita de preservação plus size.

O [parser oficial](https://github.com/fashn-AI/fashn-human-parser#license) herda os termos do [SegFormer](https://github.com/NVlabs/SegFormer/blob/master/LICENSE), que limitam seu uso a pesquisa/avaliação não comercial. Investigar substituição do parser por componente compatível ou autorização própria antes de liberar o conjunto no app. O modo chamado segmentation-free não comprova, por si só, ausência de parser no processamento.

## Vídeo-base e exatidão

Vídeo-base ajuda porque fornece trajetória, postura, ritmo e oclusão. Para um barbeador, preferir uma base mostrando a ação de barbear com objeto de geometria semelhante; gesticular com a mão vazia não fornece o contato necessário. Um único ângulo da foto não registra verso, laterais nem partes ocultas do produto.

Separar três entradas: imagem do personagem, referências do produto e vídeo da atuação. Aceitar link requer obter um arquivo de vídeo permitido e acessível; uma página de anúncio não é um MP4 direto. Os modelos normalmente recebem arquivos/quadros, não o endereço de uma rede social.

Para o primeiro ensaio, usar 2–4 segundos, câmera fixa, mãos/produto visíveis e movimento simples. Se o vídeo mostra o mesmo produto real, procurar preservar seus pixels e oclusões na composição final. Máscaras nas bordas e na mão precisam de inspeção; trocar todo o corpo pode regenerar justamente o contato que desejamos conservar.

## Plano de avaliação proposto

1. Fixar revisões, listar modelos/componentes, confirmar licenças e memória antes de iniciar GPU. Não copiar presets BF16/FP8 da comunidade como garantia para T4.
2. Medir transferência corporal com Wan-Animate usando a mesma base e comparar SCAIL-2 se necessário.
3. Validar uma camisa e uma calça com cor, estampa, corte e biotipo preservados na imagem; avaliar novamente após animar.
4. Testar um objeto rígido, primeiro sendo segurado, depois usado. Registrar contato, dedos, orientação, proporção, botões e continuidade.
5. Adicionar Google TTS/MuseTalk somente após aprovar movimento/produto; mãos atravessando o rosto podem interferir no tratamento labial.
6. Medir preparação, inferência, RAM/VRAM, duração, consumo Kaggle e falhas. Não repetir os testes Hunyuan/LTX já fracassados como se fossem uma nova hipótese.

## Descoberta em blogs e redes

Foram consultados resultados de blogs técnicos e discussões públicas Reddit/ComfyUI para encontrar workflows e relatos. Declarações de 8–12 GB e resultados bonitos não substituem benchmarks. As conclusões técnicas acima se apoiam em repositórios, cartões de modelo, páginas dos autores e licenças.

Pistas comunitárias: [SCAIL-2 com pouca VRAM](https://www.reddit.com/r/StableDiffusion/comments/1vv65qb/scail2_on_8gb_vram_generate_unlimitedlength/), [workflows SCAIL-2](https://www.reddit.com/r/comfyui/comments/1u3b76b/scail2_workflows_for_comfyui/), [discussão Wan Animate](https://www.reddit.com/r/StableDiffusion/comments/1nntmch/wan_22_animate_workflow_for_low_vram_gpu_cards/) e [lançamento FASHN](https://fashn.ai/blog/fashn-vton-1-5-open-source-release). Essas referências são descoberta e experiência externa; não significam testes executados no Meu Vendedor.
