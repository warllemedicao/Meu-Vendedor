## Implementação parcial — 14/11/2026 (a validar)

**Diagnóstico de abrangência:** não era falha exclusiva da Shopee. `PublicationComposer` iniciava Shopee como `other_app` e todas as demais lojas como `pinterest`; `PublicationCenter` iniciava qualquer sessão em `kwai`. Essas escolhas eram silenciosas e não preservavam necessariamente a intenção do usuário. A API Web Share abre o seletor do sistema, sem garantir o aplicativo receptor.

**Alterado na main:** `publication-share.ts` adiciona `shopee_video` e `defaultShareTarget` (Shopee → Shopee Vídeos, demais origens → Outro aplicativo); `PublicationComposer.tsx` usa destino inicial apropriado e botão **Compartilhar em outros locais**; `publication-package.ts` inclui Shopee Vídeos; `PublicationCenter.tsx` deixa o destino sem seleção até escolha explícita, oferece Shopee e separa compartilhamento genérico; `VideoStudio.tsx` apresenta fluxo de três etapas em linguagem simples e recolhe voz/movimento/formato em **Configurações avançadas**. Adicionado `tests/video-sharing-ui-contract.test.mjs`.

**Ainda pendente:** validação real com navegador/celular, typecheck, lint e build; publicação Cloudflare; persistência de destino entre TODOS os módulos, recarregamentos e biblioteca; editor com timeline e presets Flow/YouTube Create/Dreamina. A Shopee ainda exige postagem manual e vinculação do produto; não alegar publicação automática. A central independente agora pede destino explícito; não infere marketplace de uma etapa que não recebe esse dado.

# Plano de evolução — Estúdio de Vídeos e publicação

**Data:** 14/11/2026  
**Status:** planejamento aprovado para implementação futura; nenhuma integração nova está comprovada ou publicada por este documento.  
**Prioridade:** simplificar o fluxo, corrigir o destino Shopee e elevar a qualidade dos roteiros/prompts sem regredir Início, Produtos e Lojas e redes.

## 0. Regras de proteção (não regredir)

- **Início** (`/`) permanece no menu lateral e apresenta publicamente o Meu Vendedor, recursos, política de privacidade e termos. Essencial para avaliação das plataformas.
- **Produtos** (`/produtos`) exibe produtos e catálogos, sem diretório de todas as lojas, cartões de requisitos ou formulários de integração. Não reintroduzir `marketplaceDirectory`/`ManualMarketplaceCampaign` em `ProductsWorkspace`.
- **Lojas e redes** (`/entrar#google`, preservando redirecionamentos antigos) centraliza conectar/desconectar e status. Não duplicar conectores em outras abas.
- Rodar `tests/products-home-navigation-contract.test.mjs` e testes do fluxo de vídeo/publicação antes de deploy. Não substituir conteúdo público nem quebrar login/OAuth.

## 1. Problemas observados e diagnóstico inicial de código

1. **Estúdio complexo:** `src/components/videos/VideoStudio.tsx` contém muitas opções, serviços, modos e etapas; separar fluxo principal das opções avançadas e diagnósticos.
2. **Destino Shopee não preservado:** `src/components/videos/PublicationCenter.tsx` inicializa `platform` como `kwai` e recebe somente `generated` e `defaultTitle`. Não recebe o marketplace escolhido no início. `navigator.share` abre a folha de compartilhamento do sistema e **não garante** envio ao aplicativo Shopee. Investigar a origem da escolha da loja, o modelo do projeto e os componentes de publicação antes de implementar. Não prometer publicação direta na Shopee sem API/permissão confirmada.
3. **Qualidade de roteiro e prompt:** separar briefing comercial, roteiro falado, storyboard e instruções específicas de cada ferramenta. Não inventar preço, desconto, atributos ou funcionalidades do produto.
4. **Editor básico:** avaliar evolução de montagem (cortes, duração por cena, texto, legendas, transições, trilha e exportação), sem confundir editor local com geração de vídeo por IA.

## 2. Fluxo ideal da interface (simples e guiado)

**Etapa 1 — Produto e destino:** selecionar loja de origem (ex.: Shopee), produto/imagens, link oficial de afiliado e rede de publicação. Diferenciar claramente **loja de origem** de **destino da publicação**. Se a intenção for publicar na Shopee Vídeo/Live, validar disponibilidade de integração; se não houver API, oferecer fluxo manual específico e indicar a limitação.

**Etapa 2 — Criar conteúdo:** escolher objetivo (apresentar produto, demonstração, try-on etc.), duração, proporção e ferramenta geradora. Mostrar um botão **Criar roteiro e prompt** e prévia editável; ocultar controles técnicos em **Configurações avançadas**. Preservar imagens/referências e voz/identidade de personagens.

**Etapa 3 — Gerar ou importar:** botão principal conforme a ferramenta: **Gerar no Meu Vendedor** quando houver integração autorizada, ou **Copiar prompt e abrir ferramenta** quando for fluxo externo. Permitir importar MP4 exportado de Flow, Dreamina, YouTube Create etc. Nunca indicar que gerou automaticamente se apenas abriu outro site.

**Etapa 4 — Editar e compartilhar:** prévia vertical, editor com recursos úteis e ações principais **Publicar/Preparar para [destino escolhido]**, **Compartilhar em outros locais**, **Baixar vídeo**. Preservar a escolha inicial entre etapas, refresh, edição e biblioteca; pedir confirmação antes de qualquer publicação real.

**UI:** indicador de progresso de quatro passos, status em linguagem simples, apenas opções pertinentes ao modo ativo, ajuda contextual curta, sem longos blocos técnicos. Biblioteca, histórico, diagnóstico e créditos em painéis secundários. Suporte desktop/celular e acessibilidade.

## 3. Arquitetura recomendada: agente de roteiro + adaptadores de ferramenta

**Sim, usar pré-comandos específicos por ferramenta é o desenho recomendado.** Não criar agentes isolados sem necessidade; um **núcleo editorial comum** produz fatos verificados, objetivo, audiência, estrutura de cenas, fala PT-BR, tempo e CTA. Adaptadores especializados traduzem isso para as capacidades de cada gerador. Versões dos presets e limites devem ficar centralizados, testáveis e editáveis sem alterar lógica de produto.

**Pipeline:** dados autorizados do produto → briefing estruturado → roteiro comercial → storyboard cronometrado → adaptador da ferramenta → validação de limites → prévia/edição → geração externa ou interna → importação/edição → publicação.

**Contrato de saída:** `productFacts`, `sourceMarketplace`, `publishDestination`, `affiliateUrl`, `durationSeconds`, `aspectRatio`, `scenes[]` (início/fim, visual, movimento, fala, áudio), `spokenScriptPtBr`, `toolPrompt`, `toolId`, `promptVersion`, `warnings[]`. Guardar versão e permitir regenerar somente uma cena. Validar se a fala cabe no tempo e se o vídeo respeita o limite do provedor.

**Qualidade:** descrição cinematográfica com ações observáveis, câmera coerente, continuidade visual, imagem fiel ao produto, iluminação, ritmo, ambiente sonoro e CTA natural. Evitar listas de adjetivos vazios, repetição, promessas não verificáveis e personagens inconsistentes. Não presumir que idioma inglês sempre será superior em todos os modelos; comparar empiricamente.

### Preset Google Flow / Veo (proposta)

Direção visual preferencial em **inglês natural e estruturado**, em frases completas nesta ordem: (1) enquadramento/movimento de câmera; (2) sujeito e características estáveis; (3) ação contínua; (4) ambiente; (5) luz/estética; (6) áudio/ritmo, quando suportado. Fala explícita em **português brasileiro**, com tempo por cena e separação de direção visual e fala. Respeitar capacidades reais do modelo escolhido, referências de imagem e duração. Preservar descrição universal dos personagens por cena quando necessário.

### Preset YouTube Create (proposta, limite informado pelo responsável)

**Máximo de 900 caracteres** no campo de prompt/roteiro informado pelo usuário, com meta de **até 880–890** para margem; validar contagem em caracteres Unicode conforme comportamento observado da ferramenta. Mostrar contador e bloquear ultrapassagem, sem truncamento silencioso. Compactar por prioridade: produto fiel → ação → cenário/câmera → estilo → fala/CTA → áudio. Gerar versão curta completa e uma versão expandida para arquivo do projeto. Verificar se o limite de 900 se aplica exatamente ao recurso de criação usado (app/versão/campo).

### Preset Dreamina (proposta)

Investigar modelos, limite de caracteres, duração, formatos, imagens de referência, renovação de créditos/tokens, direitos de uso e eventual API oficial. Até existir integração suportada: **Copiar prompt → Abrir Dreamina → gerar com créditos da própria conta → baixar → importar vídeo no Meu Vendedor**. Não automatizar login, contornar limites nem alegar integração direta sem autorização.

### Outros adaptadores

Adicionar presets por provedor (Google Flow, YouTube Create, Dreamina, modelos integrados existentes) com `maxChars`, idiomas, modos imagem→vídeo/texto→vídeo, duração, formato, suporte a fala, áudio e referências. O seletor exibe somente capacidades confirmadas e fallback manual quando necessário.

## 4. Publicação: corrigir a Shopee sem perder outros destinos

- Rastrear o campo **loja escolhida** no início e persistir `sourceMarketplace` separadamente de `publishDestination`. Uma loja de origem Shopee **não significa automaticamente** que o destino será Shopee; a interface deve perguntar/mostrar essa decisão e preservá-la.
- Remover default silencioso `kwai` quando existe destino escolhido; selecionar o destino salvo ou pedir escolha explícita.
- Para Shopee, oferecer ação específica **Preparar para Shopee** (vídeo, legenda, link e instruções), com publicação automática somente se houver API e escopo autorizados e teste real. Não usar `navigator.share` como se fosse integração direta com Shopee.
- Manter **Compartilhar em outros locais** como ação independente: folha de compartilhamento do sistema quando disponível, download e copiar legenda/link como alternativas.
- Cobrir com testes: seleção inicial Shopee → geração → editor → biblioteca → retorno à publicação; destino mantido após reload; outra rede escolhida explicitamente; ausência de API; navegador sem Web Share; prevenção de publicações involuntárias.

## 5. Editor de vídeo: melhorar sem depender de terceiros

**MVP:** importar múltiplos vídeos/fotos; organizar cenas; aparar início/fim; duração por cena; pelo menos 3 transições úteis; texto/legenda com prévia; áudio/narração; formato 9:16; exportar MP4 quando tecnicamente suportado, ou informar formato real sem renomear arquivo. Salvar projeto editável e preservar vídeo original.

**Fase posterior:** templates, trilha, efeitos leves, timeline visual, legendas automáticas, prévias otimizadas e renderização robusta. Avaliar performance em celulares e custo computacional antes de prometer processamento em navegador.

## 6. Pesquisa de viabilidade das novas ferramentas

- **YouTube Create:** o responsável relata criação e salvamento na galeria com marca-d'água. Verificar disponibilidade regional/dispositivo, função específica de IA, limite efetivo de caracteres, termos, marca-d'água, licença e exportação; não confundir YouTube Create com a API YouTube Data ou integração OAuth do canal.
- **Dreamina:** o responsável relata tokens/créditos. Verificar renovação, restrições de uso, API oficial, formatos, exportação e custos. Créditos da interface web não equivalem necessariamente a créditos de API.
- **Critério de integração:** primeiro fluxo externo assistido e importação, depois integração nativa apenas com API documentada, permissões e viabilidade verificadas.

## 7. Ordem de implementação e aceite

**P0 — Auditoria e contrato de navegação:** mapear telas e estado; preservar Início, Produtos, Lojas e redes; registrar testes de regressão. **Aceite:** nenhuma loja reaparece em Produtos e Início permanece no menu.

**P1 — Destino e publicação:** rastrear seleção Shopee, separar origem/destino, manter escolha e ação específica; compartilhar em outros locais. **Aceite:** seleção preservada de ponta a ponta, sem alegação falsa de publicação direta.

**P2 — Estúdio guiado:** reduzir a quatro passos, opções avançadas recolhidas, mensagens claras. **Aceite:** criar e exportar sem navegar por painéis técnicos; fluxos atuais continuam funcionando.

**P3 — Qualidade de prompts:** núcleo editorial e presets por provedor, limite YouTube Create e contador, Flow em inglês com fala PT-BR, Dreamina. **Aceite:** prompts válidos por ferramenta, testes de comprimento, duração, fatos e consistência.

**P4 — Ferramentas externas:** pesquisar e adicionar atalhos assistidos, copiar prompt e importar resultado. **Aceite:** usuário conclui o fluxo sem promessas de API inexistente.

**P5 — Editor avançado:** cortes, cenas, texto, áudio, transições e exportação. **Aceite:** teste com MP4 real e projeto reeditável.

**P6 — Testes e entrega:** testes unitários/integração, build, lint, typecheck, verificação visual desktop/mobile, publicação Cloudflare e teste real de Shopee/compartilhamento. Documentar limitações e resultado. Não declarar funcionalidades prontas antes de validar.

## 8. Arquivos a inspecionar ao executar

- `src/components/videos/VideoStudio.tsx`
- `src/components/videos/PublicationCenter.tsx`
- `src/lib/video-studio.ts`, `src/lib/publication-package.ts`
- `src/components/marketplace/ProductsWorkspace.tsx`
- `src/lib/navigation.ts`, `src/components/layout/Sidebar.tsx`
- Componentes do editor de vídeo e integrações externas efetivamente usados pelo estúdio.

**Importante:** este documento registra o plano e não modifica interface, lógica de geração, secrets, Supabase ou Cloudflare. Implementar incrementalmente e testar cada fase antes de publicar.
