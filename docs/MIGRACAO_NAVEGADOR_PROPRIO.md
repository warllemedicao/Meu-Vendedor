# Migração para navegador próprio — Meu Vendedor

## Decisão
Substituir integralmente a dependência do Hyperbrowser por Chromium controlado pelo projeto, mantendo a automação Python/Playwright do Modal e a telemetria do Supabase. O acesso visual deve funcionar pelo navegador do celular.

## Regra de segurança da migração
Trabalhar nesta branch até que o navegador próprio esteja autenticado, testado e conectado ao executor. Não remover serviços, tabelas, segredos ou rotas de produção antes de confirmar o substituto. Não copiar perfis, cookies, senhas, tokens de sessão ou URLs assinadas do provedor antigo para o novo ambiente. Histórico Git já publicado não é apagado por uma exclusão comum de arquivos.

## Inventário inicial de dependências a substituir
- `executors/google-flow/modal_app.py`: conexão CDP e ciclo de vida da sessão remota; preservar etapas do Flow e diagnósticos.
- `executors/google-flow/flow_diagnostics.py`: preservar observação, eventos e validação de referências.
- `supabase/functions/hyperbrowser-profile/index.ts`: substituir por controlador independente de provedor, com autenticação.
- `src/components/auth/HyperbrowserProfile.tsx` e `AccountHub.tsx`: migrar para interface Navegador Próprio, responsiva para celular.
- `scripts/hyperbrowser-flow-navigate.mjs`, `scripts/hyperbrowser-executor-server.mjs`: avaliar remoção após desativação de dependências.
- `supabase/migrations/20261115024946_hyperbrowser_profiles_server_only.sql`: migração histórica imutável; criar nova migração para nova tabela e limpeza futura, sem reescrever a migração já aplicada.
- `.github/workflows/deploy-hyperbrowser-modal.yml`: substituir workflow após novo executor estar pronto.
- Documentação, testes, configurações e segredos: auditar todas as referências, sem publicar valores secretos.

## Sequência de implementação
1. Inventariar referências, rotas, tabelas, variáveis e deploys ativos; mapear chamadas entre frontend, Edge Function, Modal e navegador.
2. Construir serviço Chromium + Playwright + visualização remota no celular. Isolar por usuário, exigir autorização em cada endpoint, proteger VNC/WebSocket e configurar HTTPS.
3. Definir armazenamento de sessão criptografado, privado e com ciclo de vida explícito; autenticação Google somente na página oficial.
4. Criar API de sessão (criar, visualizar, status, encerrar) e integrá-la ao Meu Vendedor. Evitar múltiplos controladores simultâneos.
5. Adaptar Modal para conectar ao Chromium próprio; preservar prompts, anexos, 9:16, diagnósticos, limites e idempotência.
6. Testar manualmente no celular; validar reinício, desconexão, sessão expirada, imagens e etapa de aprovação antes de qualquer geração com créditos.
7. Após aprovação dos testes, remover SDK, endpoints, referências de interface e segredos antigos; desativar Edge Function antiga e recursos externos; executar testes e deploy.
8. Atualizar `historico.md` com commits, resultados reais e pendências, sem declarar sucesso sem verificação.

## Decisões de hospedagem pendentes
Validar tecnicamente se o Hugging Face Spaces gratuito suporta a duração, disponibilidade, transmissão visual e persistência exigidas. Não depender de ping artificial como garantia de serviço sempre ativo. Modal permanece como executor enquanto a nova hospedagem do navegador é avaliada.

## Critérios de aceite
- Login visual e navegação utilizáveis pelo Chrome do celular.
- Nenhuma rota pública permite controle do navegador sem autorização.
- Persistência testada após reinício, sem armazenar senha em texto.
- Modal conecta-se ao navegador próprio e produz eventos rastreáveis no Supabase.
- Nenhuma referência executável ao Hyperbrowser permanece após corte definitivo.
- Fluxo do Google Flow testado sem cobrança não autorizada ou cliques duplicados.
