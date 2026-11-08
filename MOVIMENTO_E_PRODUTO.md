# Movimento e produto — implementação de 08/11/2026

> **Revisão vigente:** o responsável rejeitou a camiseta de exemplo e proibiu reiniciar os testes. Correções e limites em [AUDITORIA_GERADOR_VIDEO.md](./AUDITORIA_GERADOR_VIDEO.md); conversa e decisões em [historico.md](./historico.md). Nenhum resultado da camisa do anúncio foi aprovado.

Implementação autorizada pelo responsável após a pesquisa em [PESQUISA_MOVIMENTO_E_PRODUTO.md](./PESQUISA_MOVIMENTO_E_PRODUTO.md). A autorização inclui Cloudflare, Supabase e testes Kaggle. Não inclui compra automática de créditos ou alteração de planos; os novos executores não chamam fornecedores de vídeo por crédito.

## Interrupção e revisão do responsável

O responsável interrompeu os testes e rejeitou a imagem da camisa na Carla: o resultado visual está errado para o objetivo solicitado. A geração técnica do PNG não valida fidelidade da roupa, identidade ou qualidade. As descrições anteriores de imagem válida ficam revogadas. Não retomar GPU ou melhorias sem nova instrução.

## Código integrado

- **Wan Animate:** grafo ComfyUI com modelo 14B GGUF Q3, DWPose e descarregamento por blocos. Recebe imagem preparada e vídeo condutor.
- **SCAIL-2:** GGUF Q3, SAM3, máscaras de identidade, animação e substituição. Não é SCAIL-Preview.
- **VACE:** modelo Wan 1.3B, referência, vídeo e máscara de edição. A região preta da máscara é recomposta com os quadros originais antes da codificação; H.264 pode introduzir diferenças de compressão. Não garante produto perfeito nas regiões que forem editadas.
- **FASHN:** modelo de roupa e DWPose executados diretamente, com peça isolada e entrada sem segmentação. Não importa o pipeline/parser SegFormer nem baixa seus pesos. Produz imagem para revisão; resultado pode ser selecionado como referência da animação.

Entradas do modo de movimento: uma foto aprovada ou imagem preparada do usuário, vídeo-base MP4/WebM até 40 MB, direção, semente e duração de 2–4 segundos. Imagens até 10 MB. Importação por link aceita somente MP4/WebM direto de CDNs explicitamente permitidos, sem cookies ou redirecionamentos. Páginas de redes sociais não são baixadas automaticamente.

Saída de animação inicial: 288×512, 16 fps, sem áudio, para avaliar atuação, identidade e produto antes de ampliar a resolução. O modo de voz fixa Google/MuseTalk continua disponível separadamente; a nova integração não declara sincronização labial de rostos em movimento.

AnchorCrafter, OmniShow, HOI-Swap, Re-HOLD, MusePose, CatV2TON, UniAnimate, JoyAI e OmniTryOn constam do catálogo com motivos reais de indisponibilidade. Não são adaptadores executáveis aprovados por haver uma opção no seletor. Motion Mirror usa a família VACE, já representada pelo adaptador próprio; sua variante rápida 1.3B não comercial não é carregada.

## Fila e proteção dos dados

`motion-generation` valida a sessão em cada operação de usuário. Callback exige segredo descartável por tarefa, guardado como SHA-256 no banco. O notebook recebe apenas URLs temporárias e capacidade do próprio callback, nunca tokens administrativos Supabase ou Kaggle.

`mv_motion_jobs` tem RLS forçada e nenhuma permissão direta para clientes. Claim exclusivo do backend valida caminhos privados e apresentador aprovado, serializa admissão com o MuseTalk e mantém idempotência durável. Pedido incerto não é reenviado. Variação/semente permite novo teste intencional após conclusão.

Histórico privado, renovação de URL, cancelamento cooperativo e recuperação por arquivo existente estão integrados. O token Kaggle atual permite submissão/cota, mas a consulta de logs testada recusou `kernels.get`; recuperação por status remoto depende dessa permissão. Falha de consulta não provoca reenvio nem declara conclusão fictícia.

Notebook privado, até uma hora por sessão, exigindo ao menos uma hora de cota disponível antes da submissão. Servidor ComfyUI acessível apenas em loopback dentro do notebook, sem túnel público. Git e pesos têm revisões fixadas; dependências transitivas dos projetos ainda podem variar e exigem verificação no runtime.

## Verificação

O piloto FASHN real com Carla entregou PNG de 486×864 e 406.309 bytes, SHA-256 `3990bc8f71a89f148a4367e7df5c02a332e71755ae04c223f36ec37943c22225`. Foram 60,405 s de preparo, 260,445 s de inferência e 321,465 s no notebook, com pico alocado de 5.691.386.880 bytes. Inspeção da imagem comparou rosto/biotipo e a camiseta preta com estampa da referência pública do próprio FASHN. A referência do teste é uma peça vestida em outro modelo, não uma foto isolada; o resultado não prova qualquer roupa ou detalhe em todos os ângulos. Cópia local em `artifacts/motion/carla-fashn.png`.

As duas tentativas anteriores falharam no preparo dos tensores de pose em tons de cinza. O adaptador foi corrigido para preservar um canal e usar preenchimento compatível. Não são resultados de inferência nem vídeos de movimento.

224 testes locais aprovados na primeira suíte completa após a integração. Testes adicionais cobrem propriedade de arquivos, limites, assinaturas, URLs recusadas, bundle Python, grafos e disputa da GPU. TypeScript frontend/Edge, lint e build estático aprovados durante a implementação. Evidências finais e resultado dos pilotos devem ser conferidos no relatório de testes antes de declarar um motor validado.

O build requer `.env.local` ignorado pelo Git com URL e chave **publicável** do Supabase. O Codespace começou sem essas variáveis; foram configuradas localmente para evitar publicar um frontend sem autenticação.

O token administrativo do terminal Supabase recusou publicação com `edge_functions_write` ausente. A conexão Supabase desta sessão publicou a nova função com sucesso; não foi necessário alterar o token. O código remoto do fluxo antigo foi preservado.

O piloto VACE entregou MP4 real de 2 s, 288×512/16 fps, 32 quadros, 327.602 bytes; SHA-256 `d4bc47f28fcbf2ab6437074f94a80149324dac4b925cf027d644ef066b48a7d8`. Preparo 197,648 s, inferência/codificação 229,636 s, total 427,829 s. A referência oficial inicial continha dois personagens lado a lado; máscara retangular técnica. O arquivo decodifica, mas não demonstra substituição convincente pela Carla. Fora da máscara, com margem de 6 px nas bordas, o erro RGB médio após H.264 foi 2,0552/255 nos 32 quadros. Não é validação de interação com produto nem igualdade exata de pixels. Cópia local `artifacts/motion/vace-mask-smoke.mp4`.

Wan passou da inicialização corrigida e iniciou amostragem, mas o processo ComfyUI encerrou após alguns passos, sem MP4. O log disponível não confirma a causa. Uma nova configuração reduz cache intermediário; sua eficácia não deve ser presumida.

## Publicação e acessos

Cloudflare atualizado na revisão para `e383d328-4bfe-4cca-bf06-fe4a7042863e`, com ambos os crons preservados. Supabase `motion-generation` v12 e migração `20261108184055` aplicados; o fluxo antigo `hybrid-video` v8 foi mantido. O acesso Kaggle foi autorizado expressamente pelo responsável e funciona para submissão e uso da GPU; `kernels.get` continua ausente no token. Não é necessário fornecer senha de conta nem colar tokens no chat.

## Limites

Integração de código não comprova fidelidade a qualquer camisa, calça, barbeador ou produto. Foto única não contém verso ou geometria oculta. Vídeo real do produto, atuação compatível, referências adequadas e revisão visual continuam necessários. Carla e Rafael precisam de referência de corpo inteiro para peças inferiores; a fotografia de meio corpo não demonstra caimento de calças.

Não há promessa de 15 vídeos/dia, 4K nativo, execução instantânea ou cota gratuita ilimitada. O limite inicial é um ensaio curto em resolução reduzida. A ampliação do uso depende de resultados reais.
