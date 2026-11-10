# Ana e vestido midi — comparação autorizada em 09/11/2026

## Encerramento solicitado — 09/11/2026, preservação para próxima sessão

O responsável informou aproximadamente 5% de crédito restante e pediu adiantar
o processo ou encerrá-lo com relatório/histórico para continuar depois. A
porcentagem é informação do responsável, sem medição independente. **Processo
encerrado; não retomar GPU sem nova instrução. Nenhum notebook r4 foi enviado.**

Resultado real: Hunyuan r3 gerou uma continuação de 49 quadros, 480×832/24 fps,
2,04 s, em 579,999 s de geração e 582,311 s incluindo codificação. A montagem
falhou porque o vídeo inicial era 480×848. É erro de normalização do adaptador,
não falha de inferência. A primeira tentativa T4 r1 não iniciou; r2 foi
interrompido no carregamento para corrigir conversão float/Pillow. O pedido
P100 recebeu duas T4 no runtime; não atribuir esses resultados à P100.

Arquivos preservados e decodificados integralmente:

- `artifacts/ana-six-20261109/continuation-2-raw-49frames.mp4`: todos os 49 quadros
  novos, inclusive o último necessário à referência seguinte.
- `artifacts/ana-six-20261109/resume-four-seconds.mp4`: montagem de **4,00 s e
  96 quadros**, 480×848, com os 48 quadros iniciais e os quadros 1..48 da
  continuação, normalizados localmente. **Ainda sem revisão visual de qualidade.**
- Ambos enviados com sucesso ao Storage privado `mv-video-assets`, sob
  `operator/ana-six-20261109/resume/`, com os mesmos nomes. Não dependem apenas
  do terminal. Hashes e tamanhos no relatório final.
- Prévia de 6,00 s/144 quadros em
  `artifacts/ana-six-20261109/ana-vestido-midi-camera-lenta-6s-exatos.mp4`.
  É câmera lenta interpolada do trecho antigo de 2 s; não é a geração nova
  completa e não satisfaz, por si, aprovação de qualidade comercial.
- Diagnósticos r2/r3 e referências anteriores preservados localmente.

Correções preparadas, **sem nova execução de GPU**: conversão float 0..1 para
uint8 somente nas referências/montagem; exportação da montagem via Pillow;
normalização das dimensões; suporte a seed de 96 quadros para gerar apenas
a continuação restante. Sintaxe, conversão e normalização local verificadas.

**Retomada exata:** revisar visualmente os 4 s preservados; configurar novo
controlador/job com o caminho privado e hash dessa montagem de 4 s, novo ID e
novas capacidades; gerar **somente `continuation_3`, seed 44, 49 quadros**.
Descartar o primeiro quadro repetido, normalizar para 480×848 e acrescentar
os 48 restantes: total de 144 quadros/6 s. Não rerodar o antigo controlador
com o seed de 2 s, pois repetiria o trabalho já salvo. Conferir duração,
rosto, mãos, roupa e junções antes de aprovar a entrega. Não há áudio novo.

Encerramento remoto solicitado para r3: DeleteKernel respondeu sem erro;
a consulta posterior retornou 403. Isso não é confirmação explícita
CANCEL_ACKNOWLEDGED. O filho havia terminado com diagnóstico arquivado e
o controlador estava terminal. `ana-six-test` substituído por **HTTP410,
versão 10**, verificado por requisição real; recusa submissões e callbacks.
Última consulta: 20.535,7411393 s usados, 0 reservados de 108.000 s; a diferença
da cota não foi atribuída exclusivamente a um job. Hunyuan antigo r2 agora
COMPLETE; Wan antigo r2 ainda CANCEL_REQUESTED. Não declarar todas as sessões
da conta encerradas com base apenas em reserva zero.

Relatório consolidado: [2026-11-09-ana-six-stopped.json](./executors/kaggle/results/2026-11-09-ana-six-stopped.json).
Nenhuma compra de créditos, alteração do estúdio, commit ou push nesta rodada.

O responsável identificou o produto como vestido midi feminino e autorizou testar
Hunyuan primeiro e Wan depois, pedindo antes investigar o vídeo preservado em
`mv-video-assets/operator/ana-vidi-20261108/inputs/final-ana-vidi.mp4`.
Não houve autorização para comprar créditos. Não alterar o estúdio nesta comparação.

## Descoberta do ensaio anterior

A pasta e seus oito objetos existem. O histórico local não mencionava esse ensaio.
Os IDs da imagem intermediária e do vídeo não têm mais registros em `mv_motion_jobs`.
A função temporária `ana-vidi-qa` está encerrada, HTTP 410, sem código anterior.
Os logs confirmam criação de conta técnica, uso de `mv_motion_jobs` e preservação
dos arquivos. A leitura do notebook antigo pelo token Kaggle retornou HTTP 403.
A consulta inicial usava o slug derivado do ID completo. O Kaggle criou o
notebook pelo título: `mv-motion-scail-52e3dabb`. A busca pelo título recuperou
a configuração com ID `52e3dabb-0175-4990-a52c-0f1e628f97ce`, engine `scail`,
seed `20261108`, modo `animate`, 2 segundos.

**Motor confirmado: SCAIL-2**, com relatório `adapter: scail`, estado `completed`
e SHA-256 exatamente igual ao MP4 preservado. Preparação: 280,102 s; inferência:
991,033 s; total: 1.271,815 s (21 min 11,815 s). O áudio foi acrescentado depois,
pois o stream de vídeo do final e do intermediário é idêntico.

Evidência recuperada: `executors/kaggle/results/2026-11-09-ana-midi-provenance.json`.
As negativas anteriores de `kernels.get` neste ensaio eram causadas pelo slug
incorreto; não comprovam falta de permissão no notebook correto.

| Arquivo preservado | SHA-256 | Evidência |
|---|---|---|
| `inputs/product-vidi.jpg` | `f8369d01d66b48319d3e4878e0bdd410d46923f96acbe410b1c8074423ce1c6b` | Vestido midi envelope laranja, manga curta, decote V, detalhe metálico na cintura. Foto de anúncio com modelo. |
| `inputs/ana-reference.png` | `730f1cb91565a4020a30b303f00d37c8903aeb1f35ecd085124f6a58e198c800` | Referência histórica com outra roupa, no corredor. Não é o arquivo cadastrado `public/presenters/ana.webp`. |
| `motion/1d1ca4cd-685c-415a-82eb-419dacb3705f.png` | `5df249ae228a9c7b6658fd4fd80a281c66a037ce87980f7b69682f5202ba4182` | Imagem intermediária com o vestido aplicado. Utilizada como base fixa da comparação; sua existência não certifica fidelidade de cor ou identidade. |
| `inputs/ana-driver.mp4` | `268918740bf2de47870c52ae4767551e8ac673fa371fc1557bab891d3371c65e` | Condutor, 2,1 s, 576×1024, 30 fps, sem áudio. |
| `motion/52e3dabb-0175-4990-a52c-0f1e628f97ce.mp4` | `101d9664f06b5b6249499d2b53a9f4975957566a7cc38a665e22919d7c6fff99` | Movimento, 2 s, 288×512, 16 fps, sem áudio. |
| `inputs/final-ana-vidi.mp4` | `2b63a45301cd3a9b80519331d037d4fc2feb5d95859e53a3178b4eb27615583a` | Final, mesmos parâmetros e stream de vídeo, com AAC estéreo acrescentado. Decodificação integral aprovada. |

Quadros em 0, 1 e 1,9 s do final mostram mudança de pose, mãos e giro parcial.
Não atribuir ao Hunyuan: o executor Hunyuan comprovado usava 480×848/24 fps,
enquanto o vídeo preservado corresponde aos parâmetros do executor de movimento.
A imagem intermediária aparenta vestido mais vermelho/saturado que o anúncio.

## Imagem intermediária confirmada

Notebook `mv-motion-fashn-1d1ca4cd`: configuração `engine: fashn`, ID
`1d1ca4cd-685c-415a-82eb-419dacb3705f`, seed `20261108`. Relatório concluído
com SHA-256 idêntico ao PNG preservado. Preparação 60,431 s, inferência
281,886 s, total 343,334 s. Assim, a sequência antiga foi **FASHN → SCAIL-2
→ adição de áudio**. Evidência: `2026-11-09-ana-midi-image-provenance.json`.

## Comparação atual

Ambos os testes usam a **mesma imagem histórica com o vestido já aplicado**.
Isso avalia animação dessa base, não uma nova aplicação da roupa à foto oficial
de Ana. O Hunyuan recebe a imagem; o Wan Animate recebe a imagem e o condutor.
O executor confirma hashes das entradas antes de carregar modelos.

- Hunyuan: checkpoint destilado fixado em `854c04a4c8a53d990b418c7478f0802c0fc8c726`,
  NF4, offload por componente, 12 passos, 49 quadros, corte para 2 s, sem áudio.
  Submetido como `mv-ana-midi-20261109-hunyuan-r1`.
- Wan: Wan2.2 Animate 14B Q3_K_M, grafo existente com `--cache-none`,
  FP16 e block swap; 2 s, 288×512/16 fps, sem áudio. Executar depois do Hunyuan.
- Supervisão limitada a 1.800 s para Hunyuan e 3.300 s para Wan; notebook termina
  após o ensaio. Não há serviço persistente nem alteração dos motores do estúdio.
- Artefatos privados em `operator/ana-midi-20261109/`. Diagnósticos em bucket
  privado separado. Endpoint temporário autenticado por capacidade aleatória;
  prazo máximo até 10/11/2026 00:00 UTC, encerramento explícito após conclusão.

Resultados consolidados abaixo. Submissão,
instalação ou entrega de MP4 não significam aprovação visual.

## Andamento das submissões

Hunyuan r1 ficou 15 minutos sem callback, saída ou reserva de GPU. O cancelamento
remoto foi solicitado; `DeleteKernel` retornou HTTP503 e o estado remoto passou
a `CANCEL_REQUESTED`. Sua capacidade de callback foi revogada. Não declarar
confirmação remota de encerramento. Qualquer início tardio falha na primeira
consulta ao controlador, antes de instalar/carregar o modelo.

Hunyuan r2 usa `kernelExecutionType: SAVE_AND_RUN_ALL` explicitamente. Submetido
às 15:40:47 UTC; GPU e entradas confirmadas por callback às 15:41 UTC. Notebook
`mv-ana-midi-20261109-hunyuan-r2`, ID remoto `143991402`. A mudança foi seguida
pelo início; não prova isoladamente a causa da espera anterior.

## Resultado Hunyuan r2

Concluído e arquivado: 2 s, 480×848/24 fps, sem áudio, 151.247 bytes.
SHA-256 `e10729e4c41528e2109db1a0dc10da0b7fd6a411250f7ad47c0d78995dcf3a81`.
Geração/codificação 596,561 s; supervisor total 1.031,645 s. Decodificação
integral aprovada, tamanho/hash conferidos. Inspecionados quadros 0, 1 e 1,9 s:
movimento discreto, composição e vestido próximos da base, suavização e
variações no rosto/mãos. A cor mais vermelha já estava na base FASHN. Não
constitui aprovação de fidelidade comercial nem nova aplicação da roupa.
Relatório: `2026-11-09-ana-midi-hunyuan-r2.json`. Wan submetido após essa revisão.

## Recuperação após fechamento do terminal — 09/11/2026

O responsável pediu recuperar o estado e continuar. Os arquivos temporários em
`/tmp/mv-ana-midi` sobreviveram. A tentativa Wan mais recente é **r2**, notebook
`mv-ana-midi-20261109-wan-r2`, ID `143998541`, versão 1; o arquivo de submissão
confirma `submitted`. Isso atualiza a referência anterior a Wan r1 na continuidade.

Consulta às 16:15 UTC: controlador ainda em `submitting`, sem callback, logs
ou arquivos de saída. O notebook e seu código estão preservados no Kaggle.
O status bruto remoto é `{}`: no SDK oficial preservado localmente,
`ApiGetKernelSessionStatusResponse` inicia com `KernelWorkerStatus.QUEUED = 0`.
Portanto a resposta é compatível com o valor padrão de fila omitido na serialização;
não comprova que a inferência começou, terminou ou falhou. A data `lastRunTime`
retornada diverge da submissão e não foi usada para calcular duração.

Cota consultada: `20.171,6060671 s` usados, `0 s` reservados de `108.000 s`.
O aumento desde a submissão não pode ser atribuído ao Wan sem callback/log.
Não foi enviado novo notebook nesta recuperação. Evidência sem credenciais:
`executors/kaggle/results/2026-11-09-ana-midi-recovery.json`.

Falta obter o retorno da execução já enviada, recuperar MP4 ou diagnóstico,
conferir integridade e qualidade, comparar com Hunyuan/SCAIL e encerrar o endpoint
temporário após a conclusão. Não reenviar automaticamente uma submissão pendente.


> **Retorno posterior nesta recuperação:** o controlador passou a responder
> `generation_disabled: true`; Wan r1/r2 e Hunyuan r1 aparecem como
> `CANCEL_REQUESTED`. Hunyuan r2 aparece remotamente como `RUNNING`, apesar
> do MP4 concluído e preservado anteriormente. Não confundir entrega de arquivo
> com encerramento da sessão. Nenhuma submissão ou solicitação de cancelamento
> foi enviada nesta recuperação; a origem dessa mudança do controlador não foi
> determinada. Cancelamento solicitado não comprova encerramento confirmado.
> Não retomar GPU automaticamente. A comparação Wan continua sem MP4.
> Verificação local: 225 testes aprovados, sintaxe dos scripts Python conferida
> e `git diff --check` aprovado.

## Resultado Wan e encerramento

Wan r1: SaveKernel excedeu 30 s; fonte salva, sem callback, saída ou reserva de
GPU observada antes do cancelamento. Wan r2: submissão confirmada com prazo de
60 s, ID remoto `143998541`; permaneceu dez minutos em estado padrão QUEUED,
sem callback nem log. **Não houve inferência Wan nesta rodada.** Não classificar
como falha visual ou de memória do modelo. Sem terceira tentativa.

Na conferência final, o Hunyuan r2 ainda aparecia RUNNING apesar da entrega do
arquivo; foi solicitado seu encerramento também. DeleteKernel retornou HTTP503,
e todos os quatro estados passaram a CANCEL_REQUESTED. A rota legada retornou
HTTP404. Não houve confirmação CANCEL_ACKNOWLEDGED. Não declarar todas as
sessões encerradas nem usar reserva zero como prova universal de encerramento.

Endpoint `ana-midi-test` substituído por HTTP410, versão 19, verificado por
requisição real. Novas submissões e callbacks recusados. Os supervisores
consultam o endpoint antes de preparar/carregar modelos; inícios tardios não
conseguem entrar nessa etapa. Nenhum Secret, política de Storage ou provedor
pago foi alterado.

Cota final observada: 20.277,1955079 s usados, 0 s reservados, 108.000 s totais.
Variação desde a consulta inicial: 2.132,6783686 s (35 min 32,678 s).
É uma observação da conta ao longo da janela; não equivale ao tempo de inferência
nem prova atribuição exclusiva da diferença a um único processo. O supervisor
Hunyuan levou 1.031,645 s; seu notebook remoto não teve encerramento imediato
confirmado quando entregou o arquivo.

Relatórios: `2026-11-09-ana-midi-final.json` e `2026-11-09-ana-midi-cleanup.json`.
Resultado privado: `mv-video-assets/operator/ana-midi-20261109/hunyuan-r2.mp4`.
Cópias locais em `artifacts/ana-midi-20261109/`, ignoradas pelo Git.
Nenhum resultado aprovado comercialmente; nenhuma compra realizada.
Não retomar GPU nem fazer terceira submissão sem nova instrução.

## Limitação técnica descoberta

O gerador de produção constrói um slug antes de submeter, mas usa outro título.
Neste ensaio antigo, o Kaggle derivou o endereço do título. A busca com o slug
construído retornava 403; com o nome real, fonte e relatório foram recuperados.
Isso não comprova falta de permissão da conta. Uma futura correção de recuperação
deve persistir o ref real retornado pelo SaveKernel. Esta comparação não alterou
o gerador de produção.

## Nova autorização — entrega final de 6 segundos

O responsável pediu retomar e entregar vídeo final de 6 s com qualidade. A nova
instrução autoriza GPU para essa entrega; não autoriza compra de créditos.
Preparado controlador separado `ana-six-test`, com expiração às 23:59 UTC de
09/11/2026, job `ana-six-20261109-r1` e notebook de título idêntico ao slug
`mv-ana-six-20261109-r1`. Os endpoints antigos permanecem encerrados.

Método: preservar os 48 quadros do Hunyuan r2 e gerar duas continuações novas de
49 quadros, cada uma condicionada ao último quadro anterior; descartar o primeiro
quadro repetido de cada continuação, somando 144 quadros/24 fps = 6 s. Não é
loop, câmera simulada nem inferência única de 145 quadros. Resolução esperada
480×848, sem áudio; nenhum texto de narração novo foi fornecido neste pedido.
A qualidade e as junções serão examinadas após a geração. Não declarar entrega
aprovada antes dessa revisão. A base histórica permanece diferente da Ana oficial
e já contém a cor mais vermelha do vestido FASHN.

Configuração: Hunyuan NF4 por componente, 12 passos por continuação, seeds 43/44;
checkpoint fixado na revisão comprovada. Supervisor limitado a 3.900 s e sessão
a 4.200 s. Novos tokens são privados e não versionados. Fontes reproduzíveis:
`scripts/build-ana-six-test.py` e `executors/kaggle/ana_six_controller.ts`.

### Fila T4 e alternativa P100

T4 r1 (`144014985`) ficou aproximadamente 10 minutos sem callback/log. Foi
solicitado cancelamento cooperativo e remoto; o controle foi trocado para r2,
revogando a autorização de callbacks/início de r1. A consulta de estado após
a solicitação remota retornou 403; não há confirmação explícita de encerramento
da sessão. Nenhuma inferência r1 confirmada. Relatório r1 preservado.

P100 r2: notebook `mv-ana-six-20261109-r2`, ID `144028201`, submissão confirmada.
Às 16:38 UTC ainda sem callback. Não submeter outro notebook automaticamente.

Alternativa local disponível em `artifacts/ana-six-20261109/ana-vestido-midi-camera-lenta-6s-exatos.mp4`:
6,00 s, 144 quadros/24 fps, 480×848, sem áudio, decodificação integral aprovada.
É o MP4 Hunyuan de 2 s alongado com interpolação de movimento, com aproximadamente
0,21 s de quadro final mantido para completar a duração. Não houve nova inferência
nesse arquivo. A versão foi apresentada ao responsável como câmera lenta, não
como resultado das duas continuações. Rosto suave e variações nas mãos continuam
presentes; não há aprovação de fidelidade comercial. Hash e estado de GPU em
`executors/kaggle/results/2026-11-09-ana-six-progress.json`.

### Início confirmado de r2

Às 16:40 UTC r2 entrou em RUNNING, com callback e verificação das entradas.
O hardware reportado é **duas Tesla T4 (15.636.037.632 bytes por placa)**,
Torch 2.11.0+cu130/Python 3.13.16, apesar do pedido `NvidiaTeslaP100` no
SaveKernel. Não atribuir o resultado a P100. A inferência usa GPU 0, sem somar
VRAM automaticamente. Dependências instaladas em 22,818 s; download em curso.

### Correção da montagem antes da inferência

Revisão do código oficial Diffusers v0.42.1 confirmou que a saída padrão `np`
é float 0..1 e que `export_to_video` multiplica arrays NumPy por 255. A montagem
inicial converteria float diretamente em Pillow e também exportaria arrays uint8
com multiplicação incorreta. Erro do adaptador, identificado antes de inferência.
R2 foi interrompido durante carregamento de pesos; ZIP recuperado (1.685 bytes),
relatório com `runs: []` e último estágio `weights_downloaded`. Isso não é uma
falha de inferência do modelo.

Corrigido: conversão explícita para uint8 somente na referência/montagem,
exportação da sequência montada como imagens Pillow para evitar multiplicação
dupla e qualidade intermediária 9/10. Checagem local com NumPy/Pillow passou:
144 quadros, extremos de cor 0/255, referência igual ao último quadro e tipos
compatíveis. Notebook corrigido r3 usa a mesma base e os mesmos seeds; não
reutiliza callbacks de r1/r2.
