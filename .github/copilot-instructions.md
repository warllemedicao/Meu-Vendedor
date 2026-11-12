# Instrucoes permanentes do Copilot — Meu Vendedor

Antes de executar qualquer tarefa neste repositorio, siga `AGENTS.md`. Em especial:

1. Identifique e liste todos os arquivos Markdown versionados pelo Git (`.md`, sem diferenciar maiusculas de minusculas).
2. Leia integralmente, quando existirem, `CONTINUAR_AMANHA.md`, `historico.md`, `HISTORICO.md`, `README.md`, `ARQUITETURA.md`, `SUPABASE.md`, `CLOUDFLARE.md`, `PUBLICACAO.md` e `INTEGRACOES.md`, nessa ordem; depois leia os demais Markdown versionados.
3. Se houver limite de contexto ou arquivo inacessivel, nao declare a leitura completa. Informe quais documentos foram lidos integralmente, parcialmente ou nao foram lidos e solicite autorizacao para prosseguir com contexto parcial.
4. Use os registros mais recentes como contexto, mas verifique o codigo e o Git antes de afirmar que algo foi implementado ou publicado.
5. Antes de qualquer alteracao solicitada, apresente o estado do projeto, suas pendencias e os documentos efetivamente lidos.
6. Nao faca deploy, altere codigo ou modifique documentos apenas porque uma sessao comecou.
7. Preserve alteracoes locais e worktrees existentes.
8. Nao modifique o projeto `gilfinanceiro`.
9. Nao registre credenciais ou Secrets em arquivos Markdown.
10. Ao concluir cada tarefa de desenvolvimento autorizada, atualize `historico.md` e `CONTINUAR_AMANHA.md` com resultados, limitacoes e pendencias.

`scripts/read-project-docs.sh` apenas lista e le os arquivos Markdown versionados no terminal, sem exibir seus conteudos. Essa execucao nao incorpora os documentos ao contexto do Copilot; faca a leitura acima por conta propria ao receber a primeira tarefa da sessao.
