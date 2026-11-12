# Instrucoes permanentes do Meu Vendedor

## Contexto documental antes de cada tarefa

1. Antes de executar qualquer tarefa, identifique e liste todos os arquivos Markdown versionados pelo Git (`.md`, sem diferenciar maiusculas de minusculas).
2. Leia integralmente os documentos versionados, nesta ordem de prioridade quando existirem: `CONTINUAR_AMANHA.md`, `historico.md`, `HISTORICO.md`, `README.md`, `ARQUITETURA.md`, `SUPABASE.md`, `CLOUDFLARE.md`, `PUBLICACAO.md` e `INTEGRACOES.md`. Em seguida, leia os demais arquivos Markdown versionados.
3. Se algum documento estiver inacessivel ou o conjunto exceder os limites de contexto, nao presuma que a leitura foi concluida. Informe quais documentos foram lidos integralmente, parcialmente ou nao foram lidos e solicite autorizacao antes de prosseguir com contexto parcial.
4. Considere os registros mais recentes para recuperar o estado das tarefas, mas confira o codigo e o Git antes de assumir que algo foi implementado ou publicado.
5. Antes de qualquer alteracao solicitada, apresente um resumo do estado do projeto, das pendencias e dos documentos efetivamente lidos.

## Seguranca e escopo

6. Iniciar uma sessao nao autoriza executar deploy, alterar codigo ou modificar documentos. Nenhum desses atos deve ocorrer apenas por iniciar uma sessao.
7. Preserve alteracoes locais e worktrees existentes. Nunca descarte trabalho local alheio a tarefa.
8. Nao modifique o projeto `gilfinanceiro`.
9. Nunca registre credenciais, tokens, cookies, chaves ou Secrets em arquivos Markdown.
10. Depois de cada tarefa de desenvolvimento autorizada, atualize `historico.md` e `CONTINUAR_AMANHA.md` com resultados, limitacoes e pendencias.

## Inicializacao do Codespace

O script `scripts/read-project-docs.sh` lista e le os arquivos Markdown versionados sem exibir seu conteudo. Essa verificacao de terminal nao carrega os documentos para o contexto do Copilot. Ao receber a primeira tarefa de cada sessao, siga as instrucoes acima e faca a leitura documental no proprio contexto.
