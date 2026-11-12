# Histórico de alterações

O histórico anterior está preservado integralmente em [historico.md](./historico.md). Este arquivo usa o nome solicitado na atualização de 12/11/2026.

## 12/11/2026 — Produtos unificados e ChatGPT manual

### Objetivo e análise

Revisados os 49 arquivos Markdown versionados, o estado limpo da main e os commits recentes. A implementação começou em `ebfb35f5aa147e47662f97f92cc9cb41bc169ae6`. As decisões atuais preservam Gemini, Flow, Shopee e os motores existentes, sem OpenAI API ou nova geração/GPU de teste.

### Implementação

- Uma entrada principal **Produtos** no menu. Mercado Livre, AliExpress, Lojas e a antiga entrada Ofertas deixam o menu; as rotas anteriores permanecem acessíveis. Produtos fica ativo também nas rotas compatíveis.
- `/produtos`, `/` e `/lojas` reutilizam `ProductsWorkspace`, com Todas as lojas, Shopee, Mercado Livre, AliExpress, Amazon, TikTok Shop, Magalu e SHEIN. O filtro fica na URL e respeita voltar/avançar.
- Catálogo público e catálogos autorizados são reunidos por loja. Shopee conectada continua no componente original; não esconde mais as outras lojas. Os filtros de pesquisa e formulários são mantidos montados ao alternar loja. APIs sem credenciais e Magalu/SHEIN não implementadas têm estados explícitos; nenhum produto fictício é gerado.
- Fluxos manuais usam o componente existente e preservam URLs oficiais de afiliado. A consulta e o estado privado continuam exigindo sessão e autorização.
- `ManualChatGPTPrompt`: copia um briefing explícito do produto, abre `https://chatgpt.com/` em outra aba e aceita até 30.000 caracteres com quebras de linha. Nenhum texto é enviado automaticamente. URLs, padrões de credenciais, e-mail e CPF são omitidos do briefing; sessão/arquivos/links não são serializados.
- Rascunhos de prompt em memória/sessionStorage por conta e contexto, com isolamento entre usuários e produtos. Aplicar é uma ação explícita; Gemini pode preparar a fala, mas não substitui a direção manual aplicada.
- Campanhas encaminham a direção manual ao prompt usado no Flow, com a fala do narrador separada. O estúdio de montagem permite copiar a direção, abrir Flow e importar o vídeo como mídia existente. Montagem de fotos não interpreta prompts.
- Personagens mantêm configurações ao alternar abas. A direção manual fica disponível para copiar ao Flow; o usuário pode voltar ao prompt automático para usar os motores internos. Isso evita enviar instruções visuais como fala ou fingir suporte a direção livre nos motores de foto falante.

### Arquivos

Rotas `page.tsx`, `produtos/page.tsx`, `lojas/page.tsx`; `Sidebar.tsx`, `navigation.ts`; `ProductsWorkspace.tsx`, `PublicProductCatalog.tsx`, `RemoteCatalog.tsx`; `ManualChatGPTPrompt.tsx`, `ProductCampaign.tsx`, `ProductVideoStudio.tsx`, `VideoStudio.tsx`, `VideoWorkspace.tsx`; `manual-chatgpt.ts`, `useManualPromptDraft.ts`, testes e documentação indicada no commit.

### Validação anterior à publicação

`npm ci`, lint, typecheck frontend/Edge, **254 testes** e build estático das 26 páginas aprovados. Lint: zero erros, quatro avisos preexistentes. Testes novos verificam o briefing sem credenciais/URLs privadas e isolamento das chaves de rascunho. Não foi criada OPENAI_API_KEY, nova API paga ou assinatura.

### Supabase

Mudanças exclusivamente no frontend; nenhum deployment ou migração necessário. Confirmadas funções ACTIVE: `marketplace` v31, `catalog` v30, `catalog-public` v30, `campaign-content` v2 e `video-generation` v56. Autenticação, Secrets e RLS preservados. Não foram feitas consultas comerciais privadas sem conta de teste.

### Publicação

Em andamento. Após a verificação, registrar o commit da implementação, deployment, testes reais e limites abaixo, em commit documental separado.
