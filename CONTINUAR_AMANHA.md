# Continuidade do projeto — próxima sessão

> **Prioridade atual — 10/11/2026:** modo **Vídeo de produto** implementado como entrada de `/videos`, com fotos/clipes reais, transições, aproximação, exportação sem áudio e biblioteca privada. Personagens em aba experimental separada; não retomar seus ensaios/GPU automaticamente. Ver entrega, validações e limite do teste remoto de upload em [VIDEO_DE_PRODUTO.md](./VIDEO_DE_PRODUTO.md). Os estados de 09/11 abaixo permanecem como histórico dos experimentos suspensos.

> **ÚLTIMA INSTRUÇÃO — processo encerrado para preservar crédito, 09/11/2026:** não iniciar GPU sem nova instrução. Há **4 s de trabalho preservados**, incluindo uma continuação nova, no Storage privado `mv-video-assets/operator/ana-six-20261109/resume/resume-four-seconds.mp4`. O bruto de 49 quadros também está no mesmo diretório. A montagem foi normalizada localmente e ainda precisa de revisão visual. Falta gerar **apenas a última continuação de 2 s**, com seed 44, após configurar novo job com o seed de 4 s e seu hash. Não repetir as duas continuações do job antigo. O vídeo novo de 6 s **não foi concluído**; existe somente uma prévia de 6 s em câmera lenta do trecho antigo. `ana-six-test` fechado, versão 10/HTTP410 verificada. Relatório, hashes, falhas e passos exatos em [TESTE_ANA_MIDI.md](./TESTE_ANA_MIDI.md) e `executors/kaggle/results/2026-11-09-ana-six-stopped.json`. Esta instrução prevalece sobre todas as autorizações e estados abaixo.

> **Nova autorização vigente:** entregar vídeo final de 6 segundos da Ana/vestido midi. Notebook `mv-ana-six-20261109-r1` (`144014985`) enviado; não duplicar. Método e limites em [TESTE_ANA_MIDI.md](./TESTE_ANA_MIDI.md). Esta instrução é posterior às suspensões históricas abaixo.

> **Estado final consolidado — 09/11/2026 16:22 UTC:** a sessão que conduziu os testes encerrou o controlador `ana-midi-test` na versão 19; HTTP410 verificado. Hunyuan r2 entregou o MP4; Wan r2 não chegou à inferência após dez minutos na fila. Foram solicitados os cancelamentos dos quatro notebooks temporários, inclusive Hunyuan r2 após sua entrega. A última consulta devolveu **CANCEL_REQUESTED para todos os quatro**, sem confirmação de término remoto. Isso supera o retrato parcial da recuperação abaixo, que ainda mostrava Hunyuan r2 RUNNING e controlador somente em leitura. A origem das mudanças foi a própria sessão de teste, não uma retomada de GPU. Relatórios finais em [TESTE_ANA_MIDI.md](./TESTE_ANA_MIDI.md). Não reenviar ou reativar automaticamente.


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

> **Recuperação do terminal — 09/11/2026, 16:15 UTC:** a última tarefa é a comparação Ana/vestido midi, autorizada mais recentemente que as suspensões históricas abaixo. Hunyuan r2 concluído. Wan **r2** confirmado no Kaggle (`143998541`), ainda sem callback/log/MP4; controlador em `submitting`, status bruto remoto `{}` compatível com padrão de fila do SDK. Não reenviar. Aguardar retorno, recuperar e inspecionar resultado, comparar e encerrar controlador temporário. Evidência em `executors/kaggle/results/2026-11-09-ana-midi-recovery.json`; detalhes em [TESTE_ANA_MIDI.md](./TESTE_ANA_MIDI.md). Git sem commits locais à frente de `origin/main`; há scripts e documentos ainda sem commit. A decisão de substituir o estúdio por links externos continua sem aprovação.

> **Comparação encerrada — 09/11/2026:** vídeo antigo veio de FASHN VTON → SCAIL-2 → áudio, confirmado por configuração e hash. Hunyuan r2 entregou MP4 silencioso de 2 s, com movimento discreto; Wan não chegou à inferência após problemas de confirmação/fila. Controlador HTTP410 verificado. Kaggle devolve CANCEL_REQUESTED para os quatro notebooks; término remoto não confirmado. Relatório em [TESTE_ANA_MIDI.md](./TESTE_ANA_MIDI.md). Não retomar GPU nem reenviar automaticamente.

> **Decisão adiada — última instrução de 09/11/2026:** o responsável considera trocar a geração interna por um seletor de sites e botão para abrir Google Flow/Gemini, onde já está conseguindo produzir vídeos. Pediu explicitamente não alterar nada ainda e decidirá amanhã. Foram debatidos acesso externo simples, preparação de imagens/textos no app com geração externa e API paga; nenhuma opção foi aprovada. Registrar e aguardar a decisão, sem remover recursos, mudar o estúdio, publicar, contratar serviços ou retomar ensaios/GPU. Conversa salva em [historico.md](./historico.md).

> **Interrupção vigente em 09/11/2026:** o responsável encerrou os ensaios por mistura de referências de anúncios e pediu somente o registro do histórico. Não iniciar, reenviar ou retomar geração/GPU sem nova instrução. A última tentativa StableAnimator foi cancelada durante download de pesos; não houve inferência de vídeo nem roupa aplicada à Carla nesta rodada. SwiftTry não foi executado. Resultados e entradas: [historico.md](./historico.md) e [PESQUISA_VIDEO_ALTERNATIVAS.md](./PESQUISA_VIDEO_ALTERNATIVAS.md). O endpoint temporário `video-research` foi encerrado com HTTP 410.

> **Revisão vigente:** o responsável rejeitou a camiseta de exemplo e proibiu reiniciar os testes. Correções e limites em [AUDITORIA_GERADOR_VIDEO.md](./AUDITORIA_GERADOR_VIDEO.md); conversa e decisões em [historico.md](./historico.md). Nenhum resultado da camisa do anúncio foi aprovado.

## Interrompido pelo responsável

Testes de movimento interrompidos a pedido do responsável. A imagem FASHN da camisa na Carla foi rejeitada como errada; não tratá-la como resultado aprovado. Não reiniciar GPU sem nova instrução.

## Complemento autorizado — movimento e roupa

O responsável ampliou o escopo e autorizou implementação, publicação e testes no Kaggle, Supabase e Cloudflare. A integração experimental está em [MOVIMENTO_E_PRODUTO.md](./MOVIMENTO_E_PRODUTO.md): Wan Animate, SCAIL-2, VACE e FASHN. FASHN já entregou uma imagem real da Carla vestindo a camiseta da referência; validação de movimento está em andamento. Não confundir integração com aprovação de qualidade ou interação exata com qualquer objeto. O relatório final desse complemento prevalece sobre as pendências antigas de movimento abaixo.

## Estado confirmado do modo de voz fixa em 08/11/2026

O fluxo **foto falante + cartão da imagem do produto** está publicado e disponível no estúdio. O botão principal usa Google TTS → MuseTalk 1.5 no Kaggle → MP4 privado, em 720×1280/25 fps, com fala limitada a 15 segundos. Carla e Rafael têm referências realistas plus size; os quatro perfis estão aprovados para esse formato e guardados em `mv_presenter_profiles`.

Foi concluída uma geração real pelo botão publicado, incluindo login, upload do produto, nova narração, processamento Kaggle e MP4 na biblioteca. Também foram validados quatro MP4s de referência, histórico por usuário, cancelamento cooperativo, recuperação de resultado e acesso privado. O relatório versionado é [2026-11-08-presenter-product-validation.json](./executors/kaggle/results/2026-11-08-presenter-product-validation.json); a entrega e os limites estão em [ENTREGA_VIDEO_COM_PRODUTO.md](./ENTREGA_VIDEO_COM_PRODUTO.md).

Frontend Cloudflare publicado na versão `627f251b-955c-4175-a065-f00bce5c26d4`; Supabase `hybrid-video` v8. Os diagnósticos temporários foram encerrados (HTTP 410), contas técnicas removidas e não há tarefas híbridas ativas. A suíte concluiu com 219 testes; lint, TypeScript frontend/Edge e build das 17 rotas passaram. Commit da implementação enviado para `origin/main`: `91e553481c211af5fe3dcea88c29c00ab61331bf`.

## O que revisar e corrigir na próxima sessão

1. **Revisão visual humana antes de ampliar a promessa de qualidade:** abrir as amostras finais de Carla e Rafael e o MP4 da geração real no relatório. Anotar defeitos reproduzíveis de alinhamento, suavização, tremor ou identidade da boca. Corrigir apenas defeitos observados e voltar a conferir os quadros e o vídeo completo. O alinhamento foi melhorado, mas a textura ainda pode variar e não há certificação de sincronismo perfeito.
2. **Validar o cartão com um produto real autorizado:** gerar no app com uma imagem de produto de teste da própria conta e confirmar enquadramento, legibilidade e ausência de corte. A geração E2E usou um cartão técnico de controle; ele não prova a apresentação de um produto real. Não reutilizar imagem de cliente sem autorização.
3. **Conferir a experiência após a geração:** confirmar estados de espera/falha/cancelamento, reprodução e download na biblioteca em desktop e celular, usando uma conta normal. Se ocorrer defeito, guardar o estado/ID técnico e corrigir antes de tentar novamente; evitar reenvio de tarefa incerta, pois GPU pode ser consumida.
4. **Reavaliar limites e licenças antes de uso comercial ampliado:** revisar termos vigentes do MuseTalk e de cada componente, materiais de produto enviados, Google TTS e capacidade/cota Kaggle. Os testes não comprovam disponibilidade contínua, SLA nem 15 vídeos por dia.

## Pendências registradas antes da ampliação de escopo

- Movimento corporal, gestos e atuação natural; a base atual é uma fotografia estática com animação facial.
- Troca de roupa ou cenário e novas bases (por exemplo, cozinha/oficina). Não estão conectadas a geração automática FLUX nem a um fluxo de aprovação por variante.
- Sessão persistente de modelos para reduzir a preparação por job, capacidade diária comprovada e geração nativa 4K.
- Publicação no YouTube, catálogo das lojas, SMTP e demais integrações continuam sendo pendências independentes do fluxo de vídeo.

## Regras para retomar

- Começar pela revisão das evidências existentes; não iniciar notebook/GPU apenas para repetir os testes já concluídos.
- Se uma correção exigir nova renderização, usar primeiro uma amostra curta autorizada e registrar nova evidência no relatório. Não afirmar que testes controlados da interface representam uma geração real.
- Não reativar provedores pagos antigos, não excluir Secrets e não publicar tokens, cookies ou URLs assinadas.
- Depois de qualquer mudança: rodar as verificações pertinentes, atualizar este arquivo e [ENTREGA_VIDEO_COM_PRODUTO.md](./ENTREGA_VIDEO_COM_PRODUTO.md); documentar a nova evidência e limites.

## Histórico

Os registros anteriores desta continuidade descreviam estados de piloto que foram superados pela entrega acima. Para histórico de outras funcionalidades, consultar [ATUALIZACOES.md](./ATUALIZACOES.md) e os documentos específicos. A situação vigente do fluxo de vídeo é sempre a descrita em [ENTREGA_VIDEO_COM_PRODUTO.md](./ENTREGA_VIDEO_COM_PRODUTO.md).
