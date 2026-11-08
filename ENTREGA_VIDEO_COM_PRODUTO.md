# Vídeo com voz e produto — entrega de 08/11/2026

> **Revisão vigente:** o responsável rejeitou a camiseta de exemplo e proibiu reiniciar os testes. Correções e limites em [AUDITORIA_GERADOR_VIDEO.md](./AUDITORIA_GERADOR_VIDEO.md); conversa e decisões em [historico.md](./historico.md). Nenhum resultado da camisa do anúncio foi aprovado.

## Complemento de movimento e roupa

Foi autorizado um modo experimental separado com vídeo-base, roupa e edição por máscara. Implementação e evidências em [MOVIMENTO_E_PRODUTO.md](./MOVIMENTO_E_PRODUTO.md). Este documento descreve a entrega do modo de voz fixa; seus limites não devem ser interpretados como ausência do novo código.

## Escopo desta entrega

O fluxo principal é Google TTS → MuseTalk 1.5 com calibração semântica dos lábios → cartão com a foto real enviada → MP4 H.264/AAC privado. O botão principal **Gerar vídeo** utiliza esse fluxo por padrão. As ferramentas antigas continuam separadas, sem fallback pago deste fluxo.

Carla e Rafael têm fotografias novas, realistas e plus size, e deixaram de apresentar “referência visual pendente”. Identidade visual, biotipo, arquivo, hash, voz fixa e preferências dos quatro personagens estão em `mv_presenter_profiles`. Procedência e prompts completos: [REFERENCIAS_APRESENTADORES.md](./REFERENCIAS_APRESENTADORES.md).

A liberação se refere ao formato **foto falante + cartão do produto**. Corpo, roupa e cenário são os da base escolhida; os controles de direção não transformam essa fotografia em uma atuação corporal ou em uma troca de roupa. Não apresentar este formato como filmagem humana de corpo inteiro.

## Melhorias implementadas

- Parser facial oficial com máscara restrita à boca; posição dos lábios da referência e da primeira imagem gerada usada para calibrar a montagem. Corrigidos os recortes e a duplicação de boca observada na validação de Rafael.
- Checkpoint ResNet18 oficial em formato compatível com PyTorch recente, verificado pelo prefixo SHA-256 `f37072fd`; sem desativar globalmente a proteção `weights_only`.
- Saída vertical fixa 720×1280, 25 fps, com preservação de proporção. A foto do produto aparece no painel inferior, sem inventar sua aparência nem alegar que o personagem a vestiu.
- Preparação da imagem local ou importação da imagem do produto sincronizado antes de gerar a voz. Caminho privado validado no backend; produto de outra conta e traversal são recusados.
- Idempotência inclui usuário, base, áudio e imagem do produto. Trocar o produto não reaproveita indevidamente o vídeo anterior; repetir o mesmo pedido não inicia outra GPU.
- Roteiro curto sugerido com apenas a fala, até 180 caracteres. Texto editado não é cortado silenciosamente. Limite efetivo de áudio no executor: 15 segundos.
- Histórico no servidor e acesso pela biblioteca e pela aba de produção. Uma URL expirada pode ser renovada; um arquivo indisponível não impede consultar os outros resultados.
- Cancelamento cooperativo: o pedido é confirmado na próxima comunicação do executor. Não significa interrupção instantânea da GPU nem devolução da cota consumida.
- Recuperação supervisionada: verifica arquivo privado ou estado remoto do notebook; não relança uma submissão incerta. Repetição de callback tem tentativas limitadas.
- Relatórios técnicos em `mv_presenter_validations`, privados ao backend. Perfis aprovados são legíveis para sessões autenticadas, sem permissão de alteração pelos clientes.

## Validação

Quatro MP4s finais foram concluídos, decodificados no Chromium e conferidos por SHA-256, com áudio não silencioso e inspeção de quadros:

| Personagem | Áudio de entrada | Total no notebook | Saída |
|---|---:|---:|---|
| Ana | 12,192 s | 174,483 s | 720×1280, 25 fps |
| Carla | 12,816 s | 176,297 s | 720×1280, 25 fps |
| Rafael | 11,232 s | 179,865 s | 720×1280, 25 fps |
| Lucas | 10,512 s | 173,552 s | 720×1280, 25 fps |

Evidência versionada: [relatório dos quatro personagens](./executors/kaggle/results/2026-11-08-presenter-product-validation.json). As durações de reprodução ficam ligeiramente menores por arredondamento dos quadros e codificação AAC.

219 testes passaram; lint, TypeScript frontend/Edge, build das 17 rotas e dry run do Worker aprovados. As migrações foram exercitadas em Postgres local, incluindo propriedade do produto, idempotência, cancelamento e permissões do catálogo.

A API publicada foi verificada com sessão real: quatro perfis, histórico autenticado HTTP 200, acesso anônimo HTTP 401, tarefa inexistente HTTP 404, cancelamento `cancelling` → `cancelled` e recuperação de arquivo sem callback → `completed`. Um arquivo removido não derruba a listagem. Contas técnicas desses testes foram removidas.

Chromium em 1440×900 e 390×844 confirmou seleção de Carla/Rafael, imagem privada do produto no pedido, voz correta, roteiro de fala curto, botão principal usando o fluxo novo, recuperação de disponibilidade após página aberta antes da aprovação, ausência de erro JavaScript e de overflow. Essas verificações de interface usam respostas controladas para a geração.

Também foi concluída uma geração **real pelo botão publicado**, sem respostas simuladas: sessão autenticada → upload privado da foto → nova narração Google/Kore → claim do backend → Kaggle → MP4 → biblioteca. O vídeo de Carla tem 4,48 s, 192.735 bytes e SHA-256 `2541b28ea29dbc9aaffc3002bbb0251300be97c13baaacb46cf9a8ad1bd89258`; foi decodificado com áudio não silencioso e sem erro JavaScript. Foram 152,759 s de notebook e 158 s entre registro da tarefa e callback final, além do tempo anterior de voz/interface. O resultado foi copiado ao namespace privado do operador antes da remoção da conta técnica.

O teste real também identificou e corrigiu uma incompatibilidade na entrega da narração: a API retorna `id` e URL assinada, sem campo `status`. Um teste de contrato agora cobre respostas novas e em cache, exercitando o handler real de áudio; a interface foi revalidada com esse contrato.

As medições de notebook incluem instalação, download, preparação, inferência, codificação e upload. Não equivalem ao tempo completo desde o clique: voz Google, espera Kaggle e rede também participam da jornada. Os testes longos reutilizaram o áudio Google existente duas vezes para exercitar durações de 10–13 segundos; não são novas narrações espontâneas longas nem um lote de modelos aquecidos.

O cartão azul/branco dos testes é uma imagem técnica de controle, não um produto comercial fictício mostrado aos usuários. Em uso normal, o cartão recebe a imagem enviada ou importada da conta.

## Publicação e banco

- Frontend Cloudflare: `627f251b-955c-4175-a065-f00bce5c26d4`.
- Supabase `hybrid-video`: v8, autenticação de usuário validada dentro da função.
- Migrações locais reconciliadas com o histórico remoto: `20261108025035`, `20261108025651`, `20261108030234`, `20261108030712`.
- Google TTS e funções antigas preservados; nenhum Secret antigo apagado e nenhum provedor com créditos reativado.
- Diagnóstico temporário e contas técnicas: encerrados; `presenter-qa` responde HTTP 410, zero contas técnicas restantes e zero tarefas híbridas ativas no encerramento.

## Limites que permanecem

A saída deste modo é 720p vertical, com corpo estático e animação da fala. Cenários animados, movimentos naturais de corpo inteiro, troca de roupa/ambiente, composição integrada FLUX para novas bases e geração nativa 4K não foram entregues por esta implementação. Exigem bases e motores próprios; as preferências de briefing não comprovam esses recursos.

Cada pedido ainda usa um notebook. Não há sessão persistente com modelos compartilhados entre pedidos. O lote validado não constitui garantia de 15 vídeos por dia, de fila imediata ou de disponibilidade contínua do Kaggle. Cotas e falhas do serviço continuam relevantes. O limite local de admissão e o controle mensal de voz continuam ativos.

A qualidade de boca e textura é a de um avatar por IA, ainda sujeita a suavização e variações entre quadros. O recorte calibrado melhora alinhamento; não certifica perfeição de sincronismo percebido nem preservação fotográfica de cada detalhe da boca.

Publicação/agendamento no YouTube, catálogo comercial das lojas, SMTP e demais módulos futuros continuam nos documentos próprios. Esta entrega não os declara concluídos.

## Retomada

Use este documento e as evidências versionadas para conferir o fluxo antes de iniciar novos testes. Resultados privados duráveis ficam no Storage; `artifacts/hybrid/` contém cópias locais ignoradas pelo Git. Não registrar URLs assinadas, tokens ou credenciais nos Markdown.

Referências oficiais consultadas: [MuseTalk e licença](https://github.com/TMElyralab/MuseTalk#disclaimerlicense), [parser facial da revisão usada](https://github.com/TMElyralab/MuseTalk/tree/0a89dec45a0192b824e3cf4daf96c239440c5ed8/musetalk/utils/face_parsing), [montagem oficial](https://github.com/TMElyralab/MuseTalk/blob/0a89dec45a0192b824e3cf4daf96c239440c5ed8/musetalk/utils/blending.py). A licença declarada do MuseTalk permite uso comercial de seu código/modelo; os demais componentes e os materiais enviados têm condições próprias.
