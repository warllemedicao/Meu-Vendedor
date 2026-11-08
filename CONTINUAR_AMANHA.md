# Continuidade do projeto — próxima sessão

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
